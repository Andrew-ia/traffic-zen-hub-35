import dotenv from "dotenv";
import { google } from "googleapis";
import { getPool, closeDatabasePool } from "../config/database.js";
import { Readable } from "stream";

dotenv.config({ path: ".env.local" });

const workspaceId =
  process.argv[2]?.trim() ||
  process.env.WORKSPACE_ID ||
  process.env.VITE_WORKSPACE_ID ||
  "00000000-0000-0000-0000-000000000010";

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error("❌ Configure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REFRESH_TOKEN no .env.local");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:8080/callback");
oauth2.setCredentials({ refresh_token: refreshToken });

const youtube = google.youtube({ version: "v3", auth: oauth2 });
const pool = getPool();

async function fetchPendingVideos(limit = 10) {
  const { rows } = await pool.query<{
    product_id: string;
    url: string;
    name: string;
    sku: string | null;
  }>(
    `
      select
        pa.product_id,
        pa.url,
        p.name,
        p.sku
      from product_assets pa
      join products_hub p on p.id = pa.product_id
      where pa.type = 'video'
        and p.workspace_id = $1
        and (p.video_url is null or p.video_url not like 'https://www.youtube.com%')
      order by p.updated_at desc nulls last, p.created_at desc
      limit $2
    `,
    [workspaceId, limit]
  );
  return rows;
}

async function uploadOneVideo(item: { product_id: string; url: string; name: string; sku: string | null }) {
  const videoResp = await fetch(item.url);
  if (!videoResp.ok || !videoResp.body) {
    throw new Error(`Falha ao baixar vídeo: ${videoResp.status} ${videoResp.statusText}`);
  }

  const nodeStream = typeof Readable.fromWeb === "function"
    ? Readable.fromWeb(videoResp.body as any)
    : (videoResp.body as any);

  const title = item.sku ? `${item.sku} - ${item.name}` : item.name;

  const uploadResp = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: title.slice(0, 95),
        description: `Upload automático do TrafficPro para ${item.name}`,
      },
      status: { privacyStatus: "unlisted" },
    },
    media: {
      body: nodeStream as any,
    },
  });

  const videoId = uploadResp.data.id;
  if (!videoId) {
    throw new Error("YouTube não retornou videoId");
  }
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  await pool.query(
    `
      update products_hub
      set video_url = $2, updated_at = now()
      where id = $1
    `,
    [item.product_id, youtubeUrl]
  );

  await pool.query(
    `
      update product_assets
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('youtube_video_id', $2::text, 'youtube_url', $3::text)
      where product_id = $1 and type = 'video'
    `,
    [item.product_id, videoId, youtubeUrl]
  );

  console.log(`✅ YouTube uploaded: ${youtubeUrl}`);
}

async function main() {
  console.log(`🎯 Workspace: ${workspaceId}`);
  const argLimit = Number(process.argv[3]) || 25;
  const items = await fetchPendingVideos(argLimit);
  if (items.length === 0) {
    console.log("Nenhum vídeo pendente para subir ao YouTube.");
    await closeDatabasePool();
    return;
  }
  console.log(`🔄 Subindo ${items.length} vídeos para YouTube...`);

  for (const item of items) {
    try {
      await uploadOneVideo(item);
    } catch (err: any) {
      console.error(`❌ Falha no produto ${item.product_id}:`, err?.message || err);
    }
  }

  await closeDatabasePool();
  console.log("🏁 Finalizado.");
}

main().catch(async (err) => {
  console.error("Erro geral:", err);
  await closeDatabasePool();
  process.exit(1);
});
