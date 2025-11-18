import type { Request, Response } from 'express'
import { getPool } from '../../config/database.js'

type Denominator = 'followers' | 'reach' | 'views'

export async function getEngagementRate(req: Request, res: Response) {
  try {
    const workspaceId = String(req.query.workspaceId || '').trim()
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30))
    const denominatorParam = String(req.query.denominator || 'reach') as Denominator
    const denominator: Denominator = ['followers', 'reach', 'views'].includes(denominatorParam)
      ? denominatorParam
      : 'reach'

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'workspaceId required' })
    }

    const pool = getPool()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().slice(0, 10)

    const mediaInsightsRows = await pool.query(
      `
      SELECT pm.metric_date, pm.extra_metrics, im.media_id, im.media_type, im.caption,
             im.like_count, im.comments_count, im.permalink, im.posted_at
      FROM performance_metrics pm
      LEFT JOIN platform_accounts pa ON pa.id = pm.platform_account_id
      LEFT JOIN instagram_media im ON im.workspace_id = pm.workspace_id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND pa.platform_key = 'instagram'
      `,
      [workspaceId, startStr]
    )

    const followersRow = await pool.query(
      `
      SELECT pm.metric_date, (pm.extra_metrics->>'follower_count')::numeric AS follower_count
      FROM performance_metrics pm
      LEFT JOIN platform_accounts pa ON pa.id = pm.platform_account_id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND pa.platform_key = 'instagram'
        AND pm.extra_metrics ? 'follower_count'
      ORDER BY pm.metric_date DESC
      LIMIT 1
      `,
      [workspaceId, startStr]
    )

    const followers = Number(followersRow.rows[0]?.follower_count || 0)

    const perPost: Array<{
      id: string
      date: string
      type?: string
      likes: number
      comments: number
      reach?: number
      views?: number
      engagementRate: number
      permalink?: string
      caption?: string
    }> = []

    const seen: Record<string, { likes: number; comments: number; reach: number; views: number; date?: string; type?: string; permalink?: string; caption?: string }> = {}

    for (const row of mediaInsightsRows.rows as any[]) {
      const em = row.extra_metrics || {}
      const mi = em.media_insights || null
      if (!mi || typeof mi !== 'object') continue
      for (const [mid, payload] of Object.entries(mi)) {
        const m = (payload as any)?.metrics || {}
        const cur = seen[mid] || { likes: 0, comments: 0, reach: 0, views: 0 }
        cur.likes += Number(m.likes || row.like_count || 0)
        cur.comments += Number(m.comments || row.comments_count || 0)
        cur.reach += Number(m.reach || 0)
        cur.views += Number(m.video_views || m.plays || 0)
        cur.date = row.metric_date
        cur.type = row.media_type
        cur.permalink = row.permalink
        cur.caption = row.caption
        seen[mid] = cur
      }
    }

    for (const [mid, v] of Object.entries(seen)) {
      let denom = 0
      if (denominator === 'followers') denom = followers || 0
      else if (denominator === 'reach') denom = v.reach || 0
      else denom = v.views || 0
      const er = denom > 0 ? (((v.likes || 0) + (v.comments || 0)) / denom) * 100 : 0
      perPost.push({ id: mid, date: v.date || startStr, type: v.type, likes: v.likes || 0, comments: v.comments || 0, reach: v.reach || 0, views: v.views || 0, engagementRate: Number(er.toFixed(2)), permalink: v.permalink, caption: v.caption })
    }

    const avg = perPost.length > 0 ? Number((perPost.reduce((sum, p) => sum + p.engagementRate, 0) / perPost.length).toFixed(2)) : 0

    return res.json({ success: true, data: { denominator, followers, averageEngagementRate: avg, posts: perPost } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to compute engagement rate'
    return res.status(500).json({ success: false, error: msg })
  }
}