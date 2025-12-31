import dotenv from "dotenv";
import { getPool, closeDatabasePool } from "../config/database.js";

dotenv.config({ path: ".env.local" });

const workspaceId =
  process.argv[2]?.trim() ||
  process.env.WORKSPACE_ID ||
  process.env.VITE_WORKSPACE_ID ||
  "00000000-0000-0000-0000-000000000010";

async function main() {
  const db = getPool();
  console.log(`🎯 Workspace: ${workspaceId}`);

  // Busca pares duplicados de vídeo (mesmo product, com extensão .mov + .mp4)
  const { rows } = await db.query<{
    product_id: string;
    mp4_url: string;
    mov_url: string;
    mov_id: string;
  }>(
    `
      with vids as (
        select
          pa.id,
          pa.product_id,
          pa.url,
          case
            when lower(pa.url) like '%.mp4' then 'mp4'
            when lower(pa.url) like '%.mov' then 'mov'
            else null
          end as ext
        from product_assets pa
        where pa.type = 'video'
          and pa.product_id in (select id from products_hub where workspace_id = $1)
      ),
      pairs as (
        select
          m.product_id,
          m.url as mp4_url,
          o.url as mov_url,
          o.id as mov_id
        from vids m
        join vids o on o.product_id = m.product_id
          and m.ext = 'mp4'
          and o.ext = 'mov'
      )
      select distinct product_id, mp4_url, mov_url, mov_id from pairs
    `,
    [workspaceId]
  );

  if (!rows.length) {
    console.log("Nenhum par MP4/MOV duplicado encontrado.");
    await closeDatabasePool();
    return;
  }

  console.log(`🔍 Encontrados ${rows.length} vídeos .mov para remover (mantendo .mp4).`);

  for (const row of rows) {
    try {
      await db.query(`delete from product_assets where id = $1`, [row.mov_id]);
      console.log(`✅ Removido MOV duplicado para produto ${row.product_id}`);
    } catch (err: any) {
      console.error(`❌ Falha ao remover MOV do produto ${row.product_id}:`, err?.message || err);
    }
  }

  await closeDatabasePool();
  console.log("🏁 Limpeza concluída.");
}

main().catch(async (err) => {
  console.error("Erro geral:", err);
  await closeDatabasePool();
  process.exit(1);
});
