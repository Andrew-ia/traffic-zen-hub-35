import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getPool, closeDatabasePool } from "../config/database.js";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

dotenv.config({ path: ".env.local" });

const BASE_DIR = path.join(process.env.HOME || "", "Documents", "Mercado Livre");
const BUCKET = "product-assets";
const workspaceId =
  process.argv[2]?.trim() ||
  process.env.WORKSPACE_ID ||
  process.env.VITE_WORKSPACE_ID ||
  "00000000-0000-0000-0000-000000000010";

if (!workspaceId) {
  console.error("⚠️  Informe o workspaceId: npx tsx server/scripts/upload-local-product-videos.ts <workspace-uuid>");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const pool = getPool();

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".avi"]);
const ALWAYS_TRANSCODE = true; // força gerar .mp4 com nome padronizado

function isVideo(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

function guessContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mkv") return "video/x-matroska";
  if (ext === ".avi") return "video/x-msvideo";
  return "application/octet-stream";
}

function extractSku(filePath: string): string | null {
  const m = filePath.match(/sku\\s*[-:]?\\s*(\\d+)/i);
  if (m?.[1]) return m[1].trim();
  return null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "video";
}

async function loadProducts(): Promise<Array<{ id: string; name: string; sku: string | null }>> {
  const { rows } = await pool.query<{ id: string; name: string; sku: string | null }>(
    `select id, name, sku from products_hub where workspace_id = $1`,
    [workspaceId]
  );
  return rows;
}

function findProductByName(products: Array<{ id: string; name: string; sku: string | null }>, candidate: string): string | null {
  const normCandidate = normalizeText(candidate);
  const matches = products.filter((p) => {
    const normName = normalizeText(p.name);
    return normName.includes(normCandidate) || normCandidate.includes(normName);
  });
  if (matches.length === 1) return matches[0].id;
  return null;
}

function transcodeToMp4(inputPath: string, productSku: string | null, productId: string) {
  const base = path.parse(inputPath).name;
  const safeName = slugify(base);
  const fileLabel = productSku || productId;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "product-video-"));
  const outputPath = path.join(tmpDir, `${fileLabel}-${safeName}.mp4`);

  // Se for mp4 e não for forçar transcode, apenas copia
  if (!ALWAYS_TRANSCODE && path.extname(inputPath).toLowerCase() === ".mp4") {
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }

  const ffmpegBin = ffmpegInstaller?.path || "ffmpeg";
  const ffmpeg = spawnSync(ffmpegBin, [
    "-y",
    "-i", inputPath,
    "-movflags", "+faststart",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    outputPath,
  ], { stdio: "inherit" });

  if (ffmpeg.error) {
    throw new Error(`ffmpeg não encontrado ou falhou: ${ffmpeg.error.message}`);
  }
  if (ffmpeg.status !== 0) {
    throw new Error(`ffmpeg retornou status ${ffmpeg.status}`);
  }

  return outputPath;
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Erro ao listar buckets: ${error.message}`);
  }
  if (data?.some((b) => b.name === BUCKET)) return;
  const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (createError) throw new Error(`Erro ao criar bucket: ${createError.message}`);
}

async function findProductIdBySku(sku: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `select id from products_hub where workspace_id = $1 and sku = $2 limit 1`,
    [workspaceId, sku]
  );
  return rows[0]?.id ?? null;
}

async function uploadVideo(productId: string, filePath: string, originalPath: string, productSku: string | null) {
  const fileName = path.basename(filePath);
  const storagePath = `${workspaceId}/${productId}/videos/${fileName}`;
  const buffer = fs.readFileSync(filePath);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    upsert: true,
    contentType: guessContentType(filePath),
  });
  if (uploadError) {
    throw new Error(`Erro ao subir ${fileName}: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) throw new Error(`Falha ao obter URL pública para ${fileName}`);

  await pool.query(
    `
      insert into product_assets (product_id, type, url, is_primary, metadata)
      values ($1, 'video', $2, false, $3::jsonb)
      on conflict (product_id, url)
      do update set metadata = coalesce(product_assets.metadata, '{}'::jsonb) || excluded.metadata
    `,
    [productId, publicUrl, JSON.stringify({ source: "local_upload", file: fileName, local_path: originalPath, sku: productSku })]
  );

  // Atualiza video_url principal
  await pool.query(
    `
      update products_hub
      set video_url = coalesce(products_hub.video_url, $2)
      where id = $1
    `,
    [productId, publicUrl]
  );

  console.log(`✅ Upload OK: ${fileName} -> ${publicUrl}`);
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  console.log(`🎯 Workspace: ${workspaceId}`);
  console.log(`📂 Pasta: ${BASE_DIR}`);
  await ensureBucket();

  const products = await loadProducts();
  console.log(`📦 Produtos carregados do hub: ${products.length}`);

  const allFiles = walk(BASE_DIR).filter(isVideo);
  console.log(`🔍 Vídeos encontrados: ${allFiles.length}`);

  let uploaded = 0;
  const unmatched: string[] = [];
  const failed: string[] = [];

  for (const file of allFiles) {
    const sku = extractSku(file);
    let productId: string | null = null;
    let productSku: string | null = sku || null;

    if (sku) {
      productId = await findProductIdBySku(sku);
    }

    if (!productId) {
      // tenta por nome de pasta (produto)
      const parentDir = path.basename(path.dirname(file));
      const grandParent = path.basename(path.dirname(path.dirname(file)));
      productId = findProductByName(products, parentDir) || findProductByName(products, grandParent);
      if (productId) {
        const prod = products.find((p) => p.id === productId);
        productSku = prod?.sku || null;
      }
    }

    if (!productId) {
      unmatched.push(file);
      continue;
    }

    try {
      const mp4Path = transcodeToMp4(file, productSku, productId);
      await uploadVideo(productId, mp4Path, file, productSku);
      uploaded += 1;
    } catch (err: any) {
      failed.push(`${file} => ${err?.message || err}`);
      console.error(`❌ Falha ao subir ${file}:`, err?.message || err);
    }
  }

  console.log(`🏁 Finalizado. Vídeos enviados: ${uploaded}/${allFiles.length}`);
  if (unmatched.length) {
    console.log("⚠️  Arquivos sem match de produto:");
    unmatched.slice(0, 10).forEach((f) => console.log(" -", f));
    if (unmatched.length > 10) console.log(` ... +${unmatched.length - 10} outros`);
  }
  if (failed.length) {
    console.log("❌ Falhas ao subir:");
    failed.slice(0, 10).forEach((f) => console.log(" -", f));
    if (failed.length > 10) console.log(` ... +${failed.length - 10} outros`);
  }
  await closeDatabasePool();
}

main().catch(async (err) => {
  console.error("Erro geral:", err);
  await closeDatabasePool();
  process.exit(1);
});
