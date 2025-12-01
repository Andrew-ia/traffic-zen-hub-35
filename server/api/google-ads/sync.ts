import type { Request, Response } from 'express';
import { GoogleAdsApi } from 'google-ads-api';
import { getPool } from '../../config/database.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

interface GoogleAdsCredentials {
  refreshToken: string;
  customerId: string;
  developerToken: string;
  clientId: string;
  clientSecret: string;
  loginCustomerId?: string;
}

const cleanEnv = (value?: string) => (value || '').replace(/\\n/g, '').trim();

async function getGoogleAdsCredentials(workspaceId: string): Promise<GoogleAdsCredentials> {
  const pool = getPool();

  console.log('Getting Google Ads credentials for workspace:', workspaceId);

  // Try to get from database first
  const row = await pool.query(
    `SELECT encrypted_credentials, encryption_iv FROM integration_credentials 
     WHERE workspace_id = $1 AND platform_key = 'google_ads' LIMIT 1`,
    [workspaceId]
  );

  console.log('Database query returned:', row.rows.length, 'rows');

  if (row.rows.length > 0) {
    const { decryptCredentials } = await import('../../services/encryption.js');
    const creds = decryptCredentials(row.rows[0].encrypted_credentials, row.rows[0].encryption_iv);
    console.log('Using credentials from database:', {
      hasRefreshToken: !!creds.refreshToken,
      hasCustomerId: !!creds.customerId,
      hasDeveloperToken: !!creds.developerToken,
      hasClientId: !!creds.clientId,
      hasClientSecret: !!creds.clientSecret
    });
    return creds as GoogleAdsCredentials;
  }

  console.log('No credentials in database, falling back to environment variables');

  // Fallback to environment variables - trim all values to remove newlines
  const customerId = cleanEnv(process.env.GOOGLE_ADS_CUSTOMER_ID).replace(/-/g, '');
  const developerToken = cleanEnv(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
  const loginCustomerId = cleanEnv(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, '') || undefined;

  console.log('Environment variables:', {
    hasCustomerId: !!customerId,
    hasDeveloperToken: !!developerToken,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasLoginCustomerId: !!loginCustomerId,
    hasRefreshToken: !!cleanEnv(process.env.GOOGLE_ADS_REFRESH_TOKEN)
  });

  if (!customerId || !developerToken || !clientId || !clientSecret) {
    throw new Error('Missing Google Ads credentials');
  }

  return {
    refreshToken: cleanEnv(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    customerId,
    developerToken,
    clientId,
    clientSecret,
    loginCustomerId
  };
}

function createGoogleAdsClient(credentials: GoogleAdsCredentials) {
  const client = new GoogleAdsApi({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    developer_token: credentials.developerToken,
  });

  const customer = client.Customer({
    customer_id: credentials.customerId,
    login_customer_id: credentials.loginCustomerId,
    refresh_token: credentials.refreshToken,
  });

  return customer;
}

type GoogleCampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

type GoogleAccountInfo = {
  descriptiveName: string;
  currencyCode: string;
  timeZone: string | null;
};

type CampaignMetricRow = {
  id: string;
  name: string;
  status: GoogleCampaignStatus;
  normalizedStatus: string;
  archived: boolean;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpcMicros: number;
  cpa: number;
  cpaMicros: number;
  roas: number;
  campaignUuid?: string | null;
};

function normalizeGoogleStatus(status?: string | null) {
  const fallback: GoogleCampaignStatus = 'active';
  if (!status) {
    return { normalizedStatus: fallback, archived: false };
  }

  const upper = String(status).toUpperCase();
  const map: Record<string, GoogleCampaignStatus> = {
    ENABLED: 'active',
    ACTIVE: 'active',
    PAUSED: 'paused',
    STOPPED: 'paused',
    SUSPENDED: 'paused',
    REMOVED: 'archived',
    ARCHIVED: 'archived',
    COMPLETED: 'completed',
    ENDED: 'completed',
    FINISHED: 'completed',
    DRAFT: 'draft',
    PENDING: 'draft',
    UNKNOWN: 'draft',
    UNSPECIFIED: 'draft',
  };

  const normalized = map[upper] ?? fallback;
  return { normalizedStatus: normalized, archived: normalized === 'archived' };
}

function formatMetricDate(dateStr: string | undefined) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (dateStr.includes('-')) {
    return dateStr.slice(0, 10);
  }
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function toInt(value: any) {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumber(value: any) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureGooglePlatformAccount(
  pool: ReturnType<typeof getPool>,
  workspaceId: string,
  customerId: string,
  accountInfo: GoogleAccountInfo,
  loginCustomerId?: string
) {
  await pool.query(
    `INSERT INTO platforms (key, display_name, category)
     VALUES ('google_ads', 'Google Ads', 'ads')
     ON CONFLICT (key) DO NOTHING`
  );

  const integrationResult = await pool.query(
    `INSERT INTO workspace_integrations (workspace_id, platform_key, status)
     VALUES ($1, 'google_ads', 'active')
     ON CONFLICT (workspace_id, platform_key)
     DO UPDATE SET status = 'active', updated_at = now()
     RETURNING id`,
    [workspaceId]
  );

  const integrationId: string | null = integrationResult.rows[0]?.id ?? null;
  if (!integrationId) {
    throw new Error('Failed to resolve workspace integration for Google Ads');
  }

  const metadata = {
    customerId,
    loginCustomerId,
    descriptiveName: accountInfo.descriptiveName,
    currencyCode: accountInfo.currencyCode,
    timeZone: accountInfo.timeZone,
  };

  const platformAccountResult = await pool.query(
    `INSERT INTO platform_accounts (
       workspace_id, integration_id, platform_key, external_id,
       name, account_type, currency, timezone, status, metadata, last_synced_at
     ) VALUES ($1, $2, 'google_ads', $3, $4, 'business', $5, $6, 'active', $7::jsonb, now())
     ON CONFLICT (integration_id, external_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       status = 'active',
       currency = EXCLUDED.currency,
       timezone = EXCLUDED.timezone,
       metadata = COALESCE(platform_accounts.metadata, '{}'::jsonb) || EXCLUDED.metadata,
       last_synced_at = now(),
       updated_at = now()
     RETURNING id`,
    [
      workspaceId,
      integrationId,
      customerId,
      accountInfo.descriptiveName,
      accountInfo.currencyCode,
      accountInfo.timeZone,
      JSON.stringify(metadata),
    ]
  );

  const platformAccountId = platformAccountResult.rows[0]?.id ?? null;
  if (!platformAccountId) {
    throw new Error('Failed to upsert Google Ads platform account');
  }

  return { integrationId, platformAccountId };
}

async function upsertGoogleCampaigns(
  pool: ReturnType<typeof getPool>,
  workspaceId: string,
  platformAccountId: string,
  campaigns: CampaignMetricRow[]
) {
  const uniqueCampaigns = new Map<string, CampaignMetricRow>();
  campaigns.forEach((campaign) => {
    if (!uniqueCampaigns.has(campaign.id)) {
      uniqueCampaigns.set(campaign.id, campaign);
    }
  });

  const campaignIdMap = new Map<string, string>();

  for (const [campaignId, campaign] of uniqueCampaigns.entries()) {
    const { normalizedStatus, archived } = normalizeGoogleStatus(campaign.status);
    const insertResult = await pool.query(
      `INSERT INTO campaigns (
         workspace_id, platform_account_id, external_id, name, status, source, archived, last_synced_at
       ) VALUES ($1, $2, $3, $4, $5, 'synced', $6, now())
       ON CONFLICT (platform_account_id, external_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         archived = EXCLUDED.archived,
         last_synced_at = now(),
         updated_at = now()
       RETURNING id`,
      [workspaceId, platformAccountId, campaignId, campaign.name || `Campaign ${campaignId}`, normalizedStatus, archived]
    );

    const campaignUuid = insertResult.rows[0]?.id ?? null;
    if (campaignUuid) {
      campaignIdMap.set(campaignId, campaignUuid);
    }
  }

  return campaignIdMap;
}


export async function syncGoogleAdsData(req: Request, res: Response) {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    const days = parseInt(req.body.days || '7', 10);

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Missing workspace ID. Send workspaceId in body/query/header.' });
    }

    console.log(`Syncing Google Ads data for workspace: ${workspaceId}, days: ${days}`);

    const credentials = await getGoogleAdsCredentials(workspaceId);
    console.log('Credentials loaded:', {
      customerId: credentials.customerId,
      hasRefreshToken: !!credentials.refreshToken,
      hasDeveloperToken: !!credentials.developerToken,
      hasClientId: !!credentials.clientId,
      hasClientSecret: !!credentials.clientSecret,
      loginCustomerId: credentials.loginCustomerId,
    });

    if (!credentials.refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing refresh token. Please complete Google Ads OAuth flow first.',
        needsAuth: true,
      });
    }

    const pool = getPool();
    const customer = createGoogleAdsClient(credentials);

    const defaultCurrency = process.env.DEFAULT_CURRENCY || 'BRL';
    const defaultTimezone = process.env.DEFAULT_TIMEZONE || 'America/Sao_Paulo';
    let accountInfo: GoogleAccountInfo = {
      descriptiveName: `Google Ads ${credentials.customerId}`,
      currencyCode: defaultCurrency,
      timeZone: defaultTimezone,
    };

    try {
      const accountMetadata = await customer.query(`
        SELECT 
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone
        FROM customer
        LIMIT 1`
      );
      const infoRow = accountMetadata?.[0]?.customer;
      if (infoRow) {
        accountInfo = {
          descriptiveName: infoRow.descriptive_name || accountInfo.descriptiveName,
          currencyCode: infoRow.currency_code || accountInfo.currencyCode,
          timeZone: infoRow.time_zone || accountInfo.timeZone,
        };
      }
    } catch (metadataError) {
      console.warn('Unable to fetch Google Ads account metadata, using defaults', metadataError);
    }

    const { integrationId, platformAccountId } = await ensureGooglePlatformAccount(
      pool,
      workspaceId,
      credentials.customerId,
      accountInfo,
      credentials.loginCustomerId
    );

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

    console.log(`Fetching data from ${startDateStr} to ${endDateStr}`);

    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        segments.date
      FROM campaign 
      WHERE 
        segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC
    `;

    console.log('Executing query:', query);

    const results = await customer.query(query);
    console.log(`Query returned ${results.length} rows`);

    const aggregatedData = {
      totalClicks: 0,
      totalImpressions: 0,
      totalCost: 0,
      totalConversions: 0,
      totalConversionsValue: 0,
      campaigns: [] as CampaignMetricRow[],
      dailyData: {} as Record<string, {
        date: string;
        clicks: number;
        impressions: number;
        cost: number;
        conversions: number;
        conversionsValue: number;
      }>,
    };

    results.forEach((row: any) => {
      const campaignId = row?.campaign?.id;
      if (!campaignId) return;

      const impressions = toInt(row.metrics?.impressions);
      const clicks = toInt(row.metrics?.clicks);
      const costMicros = toInt(row.metrics?.cost_micros);
      const cost = costMicros / 1_000_000;
      const conversions = toNumber(row.metrics?.conversions);
      const conversionsValue = toNumber(row.metrics?.conversions_value);
      const date = formatMetricDate(row.segments?.date);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? cost / clicks : 0;
      const cpcMicros = clicks > 0 ? Math.round(costMicros / Math.max(clicks, 1)) : 0;
      const cpa = conversions > 0 ? cost / conversions : 0;
      const cpaMicros = conversions > 0 ? Math.round(costMicros / Math.max(conversions, 1)) : 0;
      const cpm = impressions > 0 ? (cost / impressions) * 1000 : 0;
      const roas = cost > 0 ? conversionsValue / cost : 0;
      const { normalizedStatus, archived } = normalizeGoogleStatus(row.campaign?.status);

      aggregatedData.totalClicks += clicks;
      aggregatedData.totalImpressions += impressions;
      aggregatedData.totalCost += cost;
      aggregatedData.totalConversions += conversions;
      aggregatedData.totalConversionsValue += conversionsValue;

      aggregatedData.campaigns.push({
        id: campaignId,
        name: row.campaign?.name || `Campaign ${campaignId}`,
        status: normalizedStatus,
        normalizedStatus,
        archived,
        date,
        impressions,
        clicks,
        cost,
        costMicros,
        conversions,
        conversionsValue,
        ctr,
        cpm,
        cpc,
        cpcMicros,
        cpa,
        cpaMicros,
        roas,
      });

      if (!aggregatedData.dailyData[date]) {
        aggregatedData.dailyData[date] = {
          date,
          clicks: 0,
          impressions: 0,
          cost: 0,
          conversions: 0,
          conversionsValue: 0,
        };
      }

      aggregatedData.dailyData[date].clicks += clicks;
      aggregatedData.dailyData[date].impressions += impressions;
      aggregatedData.dailyData[date].cost += cost;
      aggregatedData.dailyData[date].conversions += conversions;
      aggregatedData.dailyData[date].conversionsValue += conversionsValue;
    });

    const ctr = aggregatedData.totalImpressions > 0
      ? (aggregatedData.totalClicks / aggregatedData.totalImpressions) * 100
      : 0;
    const cpc = aggregatedData.totalClicks > 0
      ? aggregatedData.totalCost / aggregatedData.totalClicks
      : 0;
    const roas = aggregatedData.totalCost > 0
      ? aggregatedData.totalConversionsValue / aggregatedData.totalCost
      : 0;

    const campaignIdMap = aggregatedData.campaigns.length
      ? await upsertGoogleCampaigns(pool, workspaceId, platformAccountId, aggregatedData.campaigns)
      : new Map<string, string>();

    aggregatedData.campaigns.forEach((camp) => {
      camp.campaignUuid = campaignIdMap.get(camp.id) ?? null;
    });

    let adsRowsSaved = 0;
    if (aggregatedData.campaigns.length) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      aggregatedData.campaigns.forEach((camp) => {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, ` +
          `$${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, ` +
          `$${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15}, $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18})`
        );

        values.push(
          workspaceId,
          platformAccountId,
          credentials.customerId,
          camp.id,
          camp.campaignUuid,
          camp.name,
          camp.status,
          camp.date,
          camp.impressions,
          camp.clicks,
          camp.costMicros,
          camp.conversions,
          camp.conversionsValue,
          camp.ctr,
          camp.cpcMicros || null,
          camp.cpc || null,
          camp.cpaMicros || null,
          accountInfo.currencyCode,
          JSON.stringify({ cpm: camp.cpm, roas: camp.roas })
        );
        paramIndex += 19;
      });

      const insertQuery = `
        INSERT INTO ads_spend_google (
          workspace_id,
          platform_account_id,
          customer_id,
          campaign_id_google,
          campaign_id,
          campaign_name,
          campaign_status,
          metric_date,
          impressions,
          clicks,
          cost_micros,
          conversions,
          conversions_value,
          ctr,
          cpc_micros,
          average_cpc,
          cpa_micros,
          currency,
          extra_metrics
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (workspace_id, campaign_id_google, metric_date)
        DO UPDATE SET
          platform_account_id = EXCLUDED.platform_account_id,
          customer_id = EXCLUDED.customer_id,
          campaign_id = COALESCE(EXCLUDED.campaign_id, ads_spend_google.campaign_id),
          campaign_name = EXCLUDED.campaign_name,
          campaign_status = EXCLUDED.campaign_status,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          cost_micros = EXCLUDED.cost_micros,
          conversions = EXCLUDED.conversions,
          conversions_value = EXCLUDED.conversions_value,
          ctr = EXCLUDED.ctr,
          cpc_micros = EXCLUDED.cpc_micros,
          average_cpc = EXCLUDED.average_cpc,
          cpa_micros = EXCLUDED.cpa_micros,
          currency = EXCLUDED.currency,
          extra_metrics = EXCLUDED.extra_metrics,
          synced_at = now();
      `;

      const insertResult = await pool.query(insertQuery, values);
      adsRowsSaved = insertResult.rowCount ?? aggregatedData.campaigns.length;
      console.log(`Saved ${adsRowsSaved} daily rows to ads_spend_google`);
    }

    const performanceRows = aggregatedData.campaigns.filter((camp) => camp.campaignUuid);
    let performanceRowsSaved = 0;
    if (performanceRows.length) {
      const perfValues: any[] = [];
      const perfPlaceholders: string[] = [];
      let perfIndex = 1;

      performanceRows.forEach((camp) => {
        perfPlaceholders.push(
          `($${perfIndex}, $${perfIndex + 1}, $${perfIndex + 2}, $${perfIndex + 3}, $${perfIndex + 4}, $${perfIndex + 5}, ` +
          `$${perfIndex + 6}, $${perfIndex + 7}, $${perfIndex + 8}, $${perfIndex + 9}, $${perfIndex + 10}, $${perfIndex + 11}, ` +
          `$${perfIndex + 12}, $${perfIndex + 13}, $${perfIndex + 14}, $${perfIndex + 15}, $${perfIndex + 16})`
        );

        perfValues.push(
          workspaceId,
          platformAccountId,
          camp.campaignUuid,
          'day',
          camp.date,
          accountInfo.currencyCode,
          camp.impressions,
          camp.clicks,
          camp.cost,
          camp.cpm || null,
          camp.cpc || null,
          camp.ctr || null,
          camp.cpa || null,
          camp.roas || null,
          camp.conversions,
          camp.conversionsValue,
          JSON.stringify({ google_campaign_id: camp.id, google_customer_id: credentials.customerId })
        );
        perfIndex += 17;
      });

      const performanceQuery = `
        INSERT INTO performance_metrics (
          workspace_id,
          platform_account_id,
          campaign_id,
          granularity,
          metric_date,
          currency,
          impressions,
          clicks,
          spend,
          cpm,
          cpc,
          ctr,
          cpa,
          roas,
          conversions,
          conversion_value,
          extra_metrics
        ) VALUES ${perfPlaceholders.join(', ')}
        ON CONFLICT (
          workspace_id,
          platform_account_id,
          COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(ad_set_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(ad_id, '00000000-0000-0000-0000-000000000000'::uuid),
          granularity,
          metric_date
        )
        DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend,
          cpm = EXCLUDED.cpm,
          cpc = EXCLUDED.cpc,
          ctr = EXCLUDED.ctr,
          cpa = EXCLUDED.cpa,
          roas = EXCLUDED.roas,
          conversions = EXCLUDED.conversions,
          conversion_value = EXCLUDED.conversion_value,
          currency = EXCLUDED.currency,
          extra_metrics = EXCLUDED.extra_metrics,
          synced_at = now();
      `;

      const performanceResult = await pool.query(performanceQuery, perfValues);
      performanceRowsSaved = performanceResult.rowCount ?? performanceRows.length;
      console.log(`Upserted ${performanceRowsSaved} rows into performance_metrics`);
    }

    await pool.query(
      `UPDATE workspace_integrations SET last_synced_at = now(), updated_at = now()
       WHERE id = $1`,
      [integrationId]
    );

    const responseData = {
      success: true,
      data: {
        summary: {
          clicks: Math.round(aggregatedData.totalClicks),
          impressions: Math.round(aggregatedData.totalImpressions),
          cost: Math.round(aggregatedData.totalCost * 100) / 100,
          conversions: Math.round(aggregatedData.totalConversions * 100) / 100,
          conversionsValue: Math.round(aggregatedData.totalConversionsValue * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          currency: accountInfo.currencyCode,
        },
        campaigns: aggregatedData.campaigns,
        dailyData: Object.values(aggregatedData.dailyData),
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
          days,
        },
        persisted: {
          campaigns: campaignIdMap.size,
          adsSpendRows: adsRowsSaved,
          performanceRows: performanceRowsSaved,
        },
        account: {
          platformAccountId,
          customerId: credentials.customerId,
          name: accountInfo.descriptiveName,
        },
      },
    };

    console.log('Returning aggregated data:', JSON.stringify(responseData.data.summary, null, 2));

    return res.json(responseData);
  } catch (error: any) {
    console.error('Google Ads sync error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.message?.includes('DEVELOPER_TOKEN_NOT_ON_ALLOWLIST')) {
      return res.status(400).json({
        success: false,
        error: 'Developer token not approved. Request access in Google Ads API Center.',
        code: 'DEVELOPER_TOKEN_NOT_APPROVED'
      });
    }

    if (error.message?.includes('invalid_grant') || error.message?.includes('refresh_token')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please re-authenticate.',
        needsAuth: true
      });
    }

    if (error.message?.includes('Missing Google Ads credentials')) {
      return res.status(400).json({
        success: false,
        error: 'Google Ads credentials not configured. Please set up Google Ads integration.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync Google Ads data',
      errorDetails: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n')[0]
      }
    });
  }
}
