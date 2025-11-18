import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

function parseDaysArg(): number {
  const arg = process.argv[2]
  const n = Number(arg)
  return !isNaN(n) && n > 0 ? Math.min(n, 90) : 30
}

function isValidDateStr(s?: string | null): boolean {
  if (!s) return false
  const d = new Date(s)
  return !isNaN(d.getTime())
}

function normalizeDateISO(s: string): string {
  const d = new Date(s)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0]
}

async function main() {
  const days = parseDaysArg()
  const workspaceId = (process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim()
  const connStr = (process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  if (!workspaceId) throw new Error('WORKSPACE_ID ausente')
  if (!connStr) throw new Error('SUPABASE_* DATABASE URL ausente')

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const start = new Date()
  start.setDate(start.getDate() - days)
  const startISO = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())).toISOString().split('T')[0]
  const endISO = new Date().toISOString().split('T')[0]

  const paRes = await client.query(
    `select id from platform_accounts where workspace_id = $1 and platform_key = 'instagram' limit 1`,
    [workspaceId]
  )
  const platformAccountId = paRes.rows[0]?.id
  if (!platformAccountId) throw new Error('platform_account instagram não encontrado')

  const assetsRes = await client.query(
    `select id, name, type, metadata\n     from creative_assets\n     where workspace_id = $1\n       and (metadata->>'platform') = 'instagram'`,
    [workspaceId]
  )

  const pmRes = await client.query(
    `select metric_date, extra_metrics\n     from performance_metrics\n     where workspace_id = $1\n       and platform_account_id = $2\n       and granularity = 'day'\n       and metric_date >= $3::date\n       and metric_date <= $4::date`,
    [workspaceId, platformAccountId, startISO, endISO]
  )

  const mediaEngagement = new Map<string, { totalInteractions: number; likes: number; comments: number; shares: number; saved: number; days: Set<string> }>()
  for (const row of pmRes.rows) {
    const dateISO = String(row.metric_date)
    const mi = row.extra_metrics?.media_insights || null
    if (mi && typeof mi === 'object') {
      for (const mediaId of Object.keys(mi)) {
        const metrics = mi[mediaId]?.metrics || {}
        const cur = mediaEngagement.get(mediaId) || { totalInteractions: 0, likes: 0, comments: 0, shares: 0, saved: 0, days: new Set<string>() }
        const ti = Number(metrics.total_interactions || 0)
        cur.totalInteractions += ti
        cur.likes += Number(metrics.likes || 0)
        cur.comments += Number(metrics.comments || 0)
        cur.shares += Number(metrics.shares || 0)
        cur.saved += Number(metrics.saved || 0)
        cur.days.add(dateISO)
        mediaEngagement.set(mediaId, cur)
      }
    }
  }

  const allPosts = [] as Array<{
    assetId: string
    mediaId: string | null
    name: string | null
    type: string | null
    postedAt: string | null
    postedDateISO: string | null
    validTimestamp: boolean
    engagement: { totalInteractions: number; likes: number; comments: number; shares: number; saved: number; daysCount: number }
  }>

  for (const a of assetsRes.rows) {
    const md = a.metadata || {}
    const mediaId = md.external_id || null
    const ts = md.timestamp || md.posted_at || null
    const validTs = isValidDateStr(ts)
    const postedDateISO = validTs ? normalizeDateISO(String(ts)) : null
    const eng = mediaId ? mediaEngagement.get(String(mediaId)) : undefined
    allPosts.push({
      assetId: a.id,
      mediaId: mediaId,
      name: a.name || null,
      type: a.type || null,
      postedAt: ts,
      postedDateISO,
      validTimestamp: validTs,
      engagement: {
        totalInteractions: eng?.totalInteractions || 0,
        likes: eng?.likes || 0,
        comments: eng?.comments || 0,
        shares: eng?.shares || 0,
        saved: eng?.saved || 0,
        daysCount: eng?.days.size || 0,
      },
    })
  }

  const withinRange = allPosts.filter(p => !p.postedDateISO || (p.postedDateISO >= startISO && p.postedDateISO <= endISO))
  const invalidDatePosts = withinRange.filter(p => !p.validTimestamp)
  const noEngagementPosts = withinRange.filter(p => (p.engagement.totalInteractions + p.engagement.likes + p.engagement.comments + p.engagement.shares + p.engagement.saved) === 0)

  const total = withinRange.length
  const invalidCount = invalidDatePosts.length
  const noEngCount = noEngagementPosts.length

  const byDay = new Map<string, { total: number; invalid: number; noEng: number }>()
  for (const p of withinRange) {
    const day = p.postedDateISO || 'invalid'
    const cur = byDay.get(day) || { total: 0, invalid: 0, noEng: 0 }
    cur.total += 1
    if (!p.validTimestamp) cur.invalid += 1
    if ((p.engagement.totalInteractions + p.engagement.likes + p.engagement.comments + p.engagement.shares + p.engagement.saved) === 0) cur.noEng += 1
    byDay.set(day, cur)
  }

  const report = {
    windowDays: days,
    workspaceId,
    totals: {
      postsAnalyzed: total,
      invalidDateCount: invalidCount,
      invalidDatePct: total ? Math.round((invalidCount / total) * 10000) / 100 : 0,
      noEngagementCount: noEngCount,
      noEngagementPct: total ? Math.round((noEngCount / total) * 10000) / 100 : 0,
    },
    dayIncidence: Array.from(byDay.entries()).map(([day, v]) => ({ day, ...v })).sort((a, b) => (a.day > b.day ? 1 : -1)),
    invalidDatePosts: invalidDatePosts.map(p => ({ assetId: p.assetId, mediaId: p.mediaId, name: p.name, type: p.type, postedAt: p.postedAt })),
    zeroEngagementPosts: noEngagementPosts.map(p => ({ assetId: p.assetId, mediaId: p.mediaId, name: p.name, type: p.type, postedDate: p.postedDateISO })),
    samples: withinRange.slice(0, 5),
  }

  console.log(JSON.stringify(report, null, 2))
  await client.end()
}

main().catch(err => {
  console.error('ERROR', err?.message || String(err))
  process.exitCode = 1
})