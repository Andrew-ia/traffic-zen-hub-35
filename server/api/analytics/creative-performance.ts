
import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

export async function getCreativePerformance(req: Request, res: Response) {
    try {
        const { workspaceId } = req.query;
        const days = parseInt(req.query.days as string) || 30;

        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Missing workspaceId' });
        }

        const pool = getPool();

        // Calculate start date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const query = `
      WITH metrics AS (
        SELECT 
          a.creative_asset_id,
          SUM(pm.spend) as spend,
          SUM(pm.impressions) as impressions,
          SUM(pm.clicks) as clicks,
          SUM(pm.conversions) as conversions,
          SUM(pm.conversion_value) as conversion_value
        FROM performance_metrics pm
        JOIN ads a ON pm.ad_id = a.external_id -- Join by external_id as ad_id in metrics is external
        WHERE pm.workspace_id = $1
          AND pm.metric_date >= $2
          AND a.creative_asset_id IS NOT NULL
        GROUP BY a.creative_asset_id
      )
      SELECT 
        ca.id,
        ca.name,
        ca.thumbnail_url,
        ca.storage_url,
        ca.type,
        COALESCE(m.spend, 0) as spend,
        COALESCE(m.impressions, 0) as impressions,
        COALESCE(m.clicks, 0) as clicks,
        COALESCE(m.conversions, 0) as conversions,
        COALESCE(m.conversion_value, 0) as conversion_value,
        CASE WHEN COALESCE(m.impressions, 0) > 0 THEN (COALESCE(m.clicks, 0)::float / m.impressions) * 100 ELSE 0 END as ctr,
        CASE WHEN COALESCE(m.clicks, 0) > 0 THEN COALESCE(m.spend, 0)::float / m.clicks ELSE 0 END as cpc,
        CASE WHEN COALESCE(m.conversions, 0) > 0 THEN COALESCE(m.spend, 0)::float / m.conversions ELSE 0 END as cpa,
        CASE WHEN COALESCE(m.spend, 0) > 0 THEN COALESCE(m.conversion_value, 0)::float / m.spend ELSE 0 END as roas
      FROM creative_assets ca
      LEFT JOIN metrics m ON ca.id = m.creative_asset_id
      WHERE ca.workspace_id = $1
      ORDER BY m.spend DESC NULLS LAST
      LIMIT 100;
    `;

        // Note: The join condition `pm.ad_id = a.external_id` assumes `pm.ad_id` stores the external ID. 
        // Let's verify the schema if possible, but based on `metaSync.ts`, `pm.ad_id` seems to be the internal UUID if mapped, 
        // OR we might need to join `performance_metrics` -> `ads` via internal ID.
        // Looking at `metaSync.ts`:
        // INSERT INTO performance_metrics (... ad_id ...) VALUES (... internal_ad_id ...)
        // So `pm.ad_id` IS the internal UUID.

        // Corrected Query using internal IDs:
        const correctedQuery = `
      WITH metrics AS (
        SELECT 
          a.creative_asset_id,
          SUM(pm.spend) as spend,
          SUM(pm.impressions) as impressions,
          SUM(pm.clicks) as clicks,
          SUM(pm.conversions) as conversions,
          SUM(pm.conversion_value) as conversion_value
        FROM performance_metrics pm
        JOIN ads a ON pm.ad_id = a.id
        WHERE pm.workspace_id = $1
          AND pm.metric_date >= $2
          AND a.creative_asset_id IS NOT NULL
        GROUP BY a.creative_asset_id
      )
      SELECT 
        ca.id,
        ca.name,
        ca.thumbnail_url,
        ca.storage_url,
        ca.type,
        COALESCE(m.spend, 0) as spend,
        COALESCE(m.impressions, 0) as impressions,
        COALESCE(m.clicks, 0) as clicks,
        COALESCE(m.conversions, 0) as conversions,
        COALESCE(m.conversion_value, 0) as conversion_value,
        CASE WHEN COALESCE(m.impressions, 0) > 0 THEN (COALESCE(m.clicks, 0)::float / m.impressions) * 100 ELSE 0 END as ctr,
        CASE WHEN COALESCE(m.clicks, 0) > 0 THEN COALESCE(m.spend, 0)::float / m.clicks ELSE 0 END as cpc,
        CASE WHEN COALESCE(m.conversions, 0) > 0 THEN COALESCE(m.spend, 0)::float / m.conversions ELSE 0 END as cpa,
        CASE WHEN COALESCE(m.spend, 0) > 0 THEN COALESCE(m.conversion_value, 0)::float / m.spend ELSE 0 END as roas
      FROM creative_assets ca
      LEFT JOIN metrics m ON ca.id = m.creative_asset_id
      WHERE ca.workspace_id = $1
      ORDER BY m.spend DESC NULLS LAST
      LIMIT 100;
    `;

        const result = await pool.query(correctedQuery, [workspaceId, startDateStr]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching creative performance:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch creative performance' });
    }
}
