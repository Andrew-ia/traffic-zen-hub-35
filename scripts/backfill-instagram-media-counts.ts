import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function fetchCounts(mediaId: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/v24.0/${mediaId}`)
  url.searchParams.set('fields', 'like_count,comments_count')
  url.searchParams.set('access_token', accessToken)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`fetchCounts ${mediaId} ${resp.status}`)
  const json = await resp.json()
  return {
    like_count: Number(json.like_count ?? 0),
    comments_count: Number(json.comments_count ?? 0),
  }
}

async function main() {
  const workspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim()
  const accessToken = (process.env.IG_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN || '').trim()
  const days = Number(process.argv[2] || '30')
  const connStr = (process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  if (!workspaceId) throw new Error('WORKSPACE_ID ausente')
  if (!accessToken) throw new Error('IG_ACCESS_TOKEN ausente')
  if (!connStr) throw new Error('SUPABASE_* DATABASE URL ausente')

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const start = new Date()
  start.setDate(start.getDate() - days)
  const startISO = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())).toISOString().split('T')[0]

  const res = await client.query(
    `select id, media_id from instagram_media where workspace_id = $1 and posted_at >= $2::date and (like_count is null or comments_count is null) order by posted_at desc limit 200`,
    [workspaceId, startISO]
  )

  let updated = 0
  for (const row of res.rows) {
    try {
      const counts = await fetchCounts(row.media_id, accessToken)
      await client.query(
        `update instagram_media set like_count = $3, comments_count = $4 where id = $1 and workspace_id = $2`,
        [row.id, workspaceId, counts.like_count, counts.comments_count]
      )
      updated++
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(JSON.stringify({ processed: res.rowCount, updated }, null, 2))
  await client.end()
}

main().catch(err => {
  console.error('ERROR', err?.message || String(err))
  process.exitCode = 1
})