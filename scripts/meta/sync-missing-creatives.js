#!/usr/bin/env node
/**
 * Script para buscar e vincular criativos faltantes
 *
 * Problema: Alguns ads têm creative_id no metadata mas não têm creative_asset_id
 * Solução: Buscar esses criativos da API do Meta e vincular aos ads
 */

import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const {
  META_ACCESS_TOKEN,
  META_WORKSPACE_ID,
  SUPABASE_DATABASE_URL,
} = process.env;

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API error ${response.status}: ${text}`);
  }
  return response.json();
}

function buildUrl(path, params = {}) {
  const url = new URL(`${GRAPH_URL}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  return url;
}

async function fetchCreativeDetails(accessToken, creativeId) {
  const url = buildUrl(`${creativeId}`, {
    fields: ["id", "name", "body", "thumbnail_url", "image_url", "object_story_spec", "asset_feed_spec", "status"].join(","),
    access_token: accessToken,
  });
  return fetchJson(url);
}

function deriveCreativeType(creative) {
  const story = creative.object_story_spec ?? {};
  if (story.video_data) return "video";
  if (story.carousel_data) return "carousel";
  if (story.image_data) return "image";
  if (creative.image_url) return "image";
  return "text";
}

function buildCreativePayload(creative) {
  const story = creative.object_story_spec ?? {};
  const type = deriveCreativeType(creative);

  let storageUrl = creative.image_url ?? null;
  let thumbnailUrl = creative.thumbnail_url ?? storageUrl ?? null;
  let textContent = creative.body ?? null;
  let durationSeconds = null;
  let aspectRatio = null;

  if (story.video_data) {
    storageUrl = story.video_data.video_url ?? storageUrl;
    thumbnailUrl = story.video_data.image_url ?? thumbnailUrl;
    textContent = story.video_data.message ?? textContent;
  }

  if (story.image_data) {
    storageUrl = storageUrl ?? story.image_data.image_url ?? null;
    thumbnailUrl = story.image_data.image_url ?? thumbnailUrl;
    textContent = story.image_data.message ?? textContent;
  }

  if (story.link_data) {
    textContent = textContent ?? story.link_data.message ?? null;
  }

  if (story.carousel_data?.cards?.length) {
    textContent = textContent ?? story.carousel_data.cards.map((card) => card.title).filter(Boolean).join(" • ");
  }

  const metadata = {
    metaCreativeId: creative.id,
    object_story_spec: story,
    asset_feed_spec: creative.asset_feed_spec ?? null,
    body: creative.body ?? null,
    thumbnail_url: creative.thumbnail_url ?? null,
    image_url: creative.image_url ?? null,
    status: creative.status ?? null,
  };

  return {
    externalId: creative.id,
    name: creative.name ?? `Creative ${creative.id}`,
    type,
    storageUrl,
    thumbnailUrl,
    textContent,
    durationSeconds,
    aspectRatio,
    metadata,
    hash: creative.id,
  };
}

async function upsertCreativeAsset(client, workspaceId, creative) {
  const metadataJson = JSON.stringify({
    ...creative.metadata,
  });

  const existing = await client.query(
    `
      SELECT id
      FROM creative_assets
      WHERE workspace_id = $1
        AND metadata->>'metaCreativeId' = $2
      LIMIT 1
    `,
    [workspaceId, creative.externalId],
  );

  if (existing.rows[0]) {
    const creativeId = existing.rows[0].id;
    await client.query(
      `
        UPDATE creative_assets
        SET
          type = $2,
          name = $3,
          storage_url = $4,
          thumbnail_url = $5,
          duration_seconds = $6,
          aspect_ratio = $7,
          text_content = $8,
          metadata = $9::jsonb,
          hash = $10,
          updated_at = now()
        WHERE id = $1
      `,
      [
        creativeId,
        creative.type,
        creative.name,
        creative.storageUrl,
        creative.thumbnailUrl,
        creative.durationSeconds,
        creative.aspectRatio,
        creative.textContent,
        metadataJson,
        creative.hash,
      ],
    );
    return creativeId;
  }

  const insert = await client.query(
    `
      INSERT INTO creative_assets (
        workspace_id,
        type,
        name,
        storage_url,
        thumbnail_url,
        duration_seconds,
        aspect_ratio,
        text_content,
        hash,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id
    `,
    [
      workspaceId,
      creative.type,
      creative.name,
      creative.storageUrl,
      creative.thumbnailUrl,
      creative.durationSeconds,
      creative.aspectRatio,
      creative.textContent,
      creative.hash,
      metadataJson,
    ],
  );

  return insert.rows[0].id;
}

async function main() {
  try {
    const accessToken = assertEnv(META_ACCESS_TOKEN, "META_ACCESS_TOKEN");
    const workspaceId = assertEnv(META_WORKSPACE_ID, "META_WORKSPACE_ID");
    const databaseUrl = assertEnv(SUPABASE_DATABASE_URL, "SUPABASE_DATABASE_URL");

    console.log('\n🔍 Buscando criativos faltantes...\n');

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      // Buscar ads sem creative_asset_id
      const { rows: adsWithoutCreative } = await client.query(`
        SELECT id, name, external_id, metadata
        FROM ads
        WHERE creative_asset_id IS NULL
        AND metadata IS NOT NULL
      `);

      console.log(`📊 Encontrados ${adsWithoutCreative.length} ads sem criativo vinculado`);

      // Extrair creative_ids únicos do metadata
      const creativeIdsSet = new Set();
      const adsByCreativeId = new Map();

      for (const ad of adsWithoutCreative) {
        if (ad.metadata && ad.metadata.creative_id) {
          const creativeId = ad.metadata.creative_id;
          creativeIdsSet.add(creativeId);

          if (!adsByCreativeId.has(creativeId)) {
            adsByCreativeId.set(creativeId, []);
          }
          adsByCreativeId.get(creativeId).push(ad.id);
        }
      }

      const creativeIds = Array.from(creativeIdsSet);
      console.log(`🎨 ${creativeIds.length} criativos únicos para buscar\n`);

      if (creativeIds.length === 0) {
        console.log('✅ Nenhum criativo faltante encontrado!');
        return;
      }

      // Buscar criativos da API do Meta
      let fetchedCount = 0;
      let errorCount = 0;
      const creativeAssetIdMap = new Map();

      for (const creativeId of creativeIds) {
        try {
          console.log(`📥 Buscando creative ${creativeId}...`);
          const creative = await fetchCreativeDetails(accessToken, creativeId);

          // Criar/atualizar no banco
          const payload = buildCreativePayload(creative);
          const creativeAssetId = await upsertCreativeAsset(client, workspaceId, payload);
          creativeAssetIdMap.set(creativeId, creativeAssetId);

          fetchedCount++;
          console.log(`   ✅ ${creative.name || creativeId} (${payload.type})`);

          // Pequeno delay para não bater rate limit
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Erro ao buscar ${creativeId}:`, error.message);
        }
      }

      console.log(`\n📦 ${fetchedCount} criativos salvos no banco`);
      if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} erros ao buscar criativos (podem estar deletados no Meta)`);
      }

      // Vincular criativos aos ads
      console.log('\n🔗 Vinculando criativos aos anúncios...');
      let linkedCount = 0;

      for (const [creativeId, creativeAssetId] of creativeAssetIdMap.entries()) {
        const adIds = adsByCreativeId.get(creativeId) || [];

        for (const adId of adIds) {
          await client.query(`
            UPDATE ads
            SET creative_asset_id = $1, updated_at = now()
            WHERE id = $2
          `, [creativeAssetId, adId]);
          linkedCount++;
        }
      }

      console.log(`✅ ${linkedCount} anúncios vinculados aos criativos\n`);
      console.log('🎉 Sincronização de criativos concluída com sucesso!');

    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exitCode = 1;
  }
}

main();
