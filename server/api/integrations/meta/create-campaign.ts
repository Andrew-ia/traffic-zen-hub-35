import { Request, Response } from 'express';
import { getPool } from '../../../config/database.js';
import { decryptCredentials, encryptCredentials } from '../../../services/encryption.js';
import type { ApiResponse } from '../../../types/index.js';
import { MetaApiService } from '../../../services/meta/MetaApiService.js';
import { CreativeService } from '../../../services/meta/CreativeService.js';
import { CampaignBuilder } from '../../../services/meta/CampaignBuilder.js';

interface Ad {
  name: string;
  creative_id: string;
  status: string;
  creative_asset_id?: string;
  drive_url?: string;
  storage_url?: string;
  primary_text?: string;
}

interface AdSet {
  name: string;
  billing_event: string;
  optimization_goal: string;
  daily_budget: number; // in cents
  status: string;
  targeting: any;
  ads: Ad[];
  destination_type?: string;
  start_time?: string;
  end_time?: string;
  publisher_platforms?: string[];
  settings?: any;
}

interface CreateCampaignRequest {
  workspaceId: string;
  campaign: {
    name: string;
    objective: string;
    status: string;
    special_ad_categories: string[];
    daily_budget?: number;
  };
  adSets: AdSet[];
  pageId?: string;
}

export async function createMetaCampaign(req: Request, res: Response) {
  try {
    const { workspaceId, campaign, adSets, pageId: requestedPageId }: CreateCampaignRequest = req.body;

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
    const accessToken = credentials.accessToken || credentials.access_token;
    const adAccountId = credentials.adAccountId || credentials.ad_account_id;

    if (!accessToken || !adAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Incomplete Meta Ads credentials'
      } as ApiResponse);
    }

    const actAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Initialize Services
    const metaApi = new MetaApiService({ accessToken });
    const creativeService = new CreativeService();

    // 2. Resolve Page ID and Instagram Actor ID
    let pageId = requestedPageId || (credentials as any).pageId || (credentials as any).page_id || (String(process.env.META_PAGE_ID || '').trim() || undefined);
    let pageAccessToken: string | undefined;

    // Fetch Page ID if missing
    if (!pageId) {
      try {
        const pagesResponse = await metaApi.call('me/accounts', 'GET', { fields: 'id,name,access_token', limit: 100 });
        if (pagesResponse.data && pagesResponse.data.length > 0) {
          const firstPage = pagesResponse.data[0];
          pageId = firstPage.id;
          pageAccessToken = firstPage.access_token;

          // Update credentials
          try {
            const newCredentials = { ...credentials, pageId: pageId, page_id: pageId };
            const { encrypted_credentials: newEncrypted, encryption_iv: newIv } = encryptCredentials(newCredentials);
            await pool.query(
              `UPDATE integration_credentials SET encrypted_credentials = $1, encryption_iv = $2, updated_at = NOW() WHERE workspace_id = $3 AND platform_key = 'meta'`,
              [newEncrypted, newIv, workspaceId]
            );
          } catch (e) { console.warn('Failed to update credentials with Page ID', e); }
        }
      } catch (e) { console.warn('Failed to fetch pages', e); }
    } else if (!pageAccessToken) {
      // Fetch Page Access Token if we have ID but no token
      try {
        const pagesResponse = await metaApi.call('me/accounts', 'GET', { fields: 'id,name,access_token' });
        const match = pagesResponse.data?.find((p: any) => String(p.id) === String(pageId));
        if (match?.access_token) pageAccessToken = match.access_token;
      } catch (e) { console.warn('Failed to fetch page token', e); }
    }

    if (!pageId) {
      return res.status(400).json({ success: false, error: 'Page ID not configured and could not be fetched.' });
    }

    // Resolve Pixel ID
    const pixelId = (credentials as any).pixelId || (credentials as any).pixel_id || (String(process.env.META_PIXEL_ID || '').trim() || undefined);

    // 3. Create Campaign
    console.log('Creating Campaign:', campaign.name);
    const { payload: campaignPayload, dailyBudgetCents } = CampaignBuilder.buildCampaignPayload(campaign);

    const campaignResponse = await metaApi.call(`${actAccountId}/campaigns`, 'POST', campaignPayload);
    const campaignId = campaignResponse.id;

    // Save Campaign to DB
    const adAccountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const adAccountIdWithoutPrefix = adAccountId.replace('act_', '');
    const paRows = await pool.query(
      `SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta' AND (external_id = $2 OR external_id = $3 OR external_id = $4) LIMIT 1`,
      [workspaceId, adAccountId, adAccountIdWithPrefix, adAccountIdWithoutPrefix]
    );

    if (paRows.rows.length === 0) throw new Error('Platform account not found');
    const platformAccountId = paRows.rows[0].id;

    const upsertCampaignResult = await pool.query(
      `INSERT INTO campaigns (workspace_id, platform_account_id, external_id, name, objective, status, source, daily_budget, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, now())
       ON CONFLICT (platform_account_id, external_id) DO UPDATE SET name = EXCLUDED.name, objective = EXCLUDED.objective, status = EXCLUDED.status, updated_at = now()
       RETURNING id`,
      [workspaceId, platformAccountId, campaignId, campaign.name, campaign.objective, String(campaign.status).toLowerCase(), Math.round(dailyBudgetCents / 100)]
    );
    const localCampaignId = upsertCampaignResult.rows[0].id;

    const failedAdSets: { name: string; error: string }[] = [];
    const failedAds: { adSetName: string; name: string; error: string }[] = [];

    // 4. Create Ad Sets and Ads
    for (const adSet of adSets) {
      console.log('Creating Ad Set:', adSet.name);

      const adSetPayload = CampaignBuilder.buildAdSetPayload(adSet, campaignId, campaign.objective, pageId, pixelId);

      let adSetResponse;
      try {
        adSetResponse = await metaApi.call(`${actAccountId}/adsets`, 'POST', adSetPayload);
      } catch (e: any) {
        // Simple retry logic for common errors could go here, or fallback logic
        // For now, we just log and continue
        console.error(`Failed to create Ad Set ${adSet.name}:`, e.message);
        failedAdSets.push({ name: adSet.name, error: e.message });
        continue;
      }

      const adSetId = adSetResponse.id;

      // Save Ad Set to DB
      const upsertAdSetResult = await pool.query(
        `INSERT INTO ad_sets (campaign_id, platform_account_id, external_id, name, status, daily_budget, targeting, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
         ON CONFLICT (campaign_id, external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now()
         RETURNING id`,
        [localCampaignId, platformAccountId, adSetId, adSet.name, String(adSet.status).toLowerCase(), adSetPayload.daily_budget ? Math.round(Number(adSetPayload.daily_budget) / 100) : null, JSON.stringify(adSetPayload.targeting)]
      );
      const localAdSetId = upsertAdSetResult.rows[0].id;

      // 5. Create Ads
      const adsForSet = (adSet.ads && adSet.ads.length > 0) ? adSet.ads : [{ name: `${adSet.name} - Anúncio 1`, creative_id: '', status: 'paused' } as Ad];

      for (const ad of adsForSet) {
        console.log('Creating Ad:', ad.name);
        let creativeId = ad.creative_id;

        try {
          // Handle Engagement Dark Posts
          if ((!creativeId || !creativeId.trim()) && String(campaign.objective).toUpperCase() === 'OUTCOME_ENGAGEMENT' && pageId) {
            try {
              const objectStoryId = await metaApi.createDarkPost(pageId, ad.primary_text || ad.name, pageAccessToken);
              const creativeResp = await metaApi.call(`${actAccountId}/adcreatives`, 'POST', { name: ad.name, object_story_id: objectStoryId });
              creativeId = creativeResp.id;
            } catch (e: any) {
              console.warn('Failed to create dark post, trying promotable_posts fallback', e.message);
              // Fallback logic could be added here if needed
            }
          }

          // Handle Asset Upload (Drive/Supabase)
          if ((!creativeId || !creativeId.trim()) && (ad.creative_asset_id || ad.drive_url || ad.storage_url)) {
            let assetId = ad.creative_asset_id;
            let asset: any = null;

            // Create asset record if it doesn't exist but we have a URL
            if (!assetId && (ad.drive_url || ad.storage_url)) {
              const srcUrl = String(ad.drive_url || ad.storage_url);
              asset = await creativeService.createAssetFromUrl(workspaceId, ad.name, srcUrl);
              assetId = asset.id;
            } else if (assetId) {
              const assetRow = await pool.query(`SELECT id, name, type, storage_url FROM creative_assets WHERE id = $1`, [assetId]);
              asset = assetRow.rows[0];
            }

            if (asset) {
              const { url: publicUrl } = await creativeService.ensurePublicUrl(asset, workspaceId);

              if (String(asset.type).toLowerCase() === 'video') {
                // Upload Video
                const videoId = await metaApi.uploadPageVideo(pageId, publicUrl, ad.name, pageAccessToken);

                // Wait for processing (simple polling)
                let ready = false;
                for (let i = 0; i < 10; i++) {
                  try {
                    const vInfo = await metaApi.call(videoId, 'GET', { fields: 'status' });
                    if (vInfo?.status?.video_status === 'ready') { ready = true; break; }
                  } catch (error) {
                    // Erro na verificação do status do vídeo
                  }
                  await new Promise(r => setTimeout(r, 2000));
                }

                const creativeResp = await metaApi.call(`${actAccountId}/adcreatives`, 'POST', {
                  name: ad.name,
                  object_story_spec: { page_id: pageId, video_data: { video_id: videoId, call_to_action: { type: 'LEARN_MORE', value: { link: 'https://facebook.com' } } } } // Simplified CTA
                });
                creativeId = creativeResp.id;
              } else {
                // Upload Image
                const imageResp = await metaApi.call(`${actAccountId}/adimages`, 'POST', { url: publicUrl });
                const imageHash = Object.values(imageResp.images || {})[0] ? (Object.values(imageResp.images || {})[0] as any).hash : null;

                if (imageHash) {
                  const creativeResp = await metaApi.call(`${actAccountId}/adcreatives`, 'POST', {
                    name: ad.name,
                    object_story_spec: { page_id: pageId, link_data: { image_hash: imageHash, link: 'https://facebook.com', message: ad.primary_text || ad.name } }
                  });
                  creativeId = creativeResp.id;
                }
              }
            }
          }

          if (!creativeId) throw new Error('Could not resolve or create creative ID');

          // Create Ad
          const adPayload = {
            name: ad.name,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: ad.status || 'PAUSED'
          };

          const adResponse = await metaApi.call(`${actAccountId}/ads`, 'POST', adPayload);

          // Save Ad to DB
          await pool.query(
            `INSERT INTO ads (ad_set_id, platform_account_id, external_id, name, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())
             ON CONFLICT (ad_set_id, external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now()`,
            [localAdSetId, platformAccountId, adResponse.id, ad.name, String(ad.status).toLowerCase()]
          );

        } catch (e: any) {
          console.error(`Failed to create Ad ${ad.name}:`, e.message);
          failedAds.push({ adSetName: adSet.name, name: ad.name, error: e.message });
        }
      }
    }

    return res.json({
      success: true,
      data: {
        campaignId,
        failedAdSets,
        failedAds
      }
    });

  } catch (error: any) {
    console.error('Create Campaign Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

export async function mirrorCreativeAsset(req: Request, res: Response) {
  try {
    const { workspaceId, assetId } = req.body;
    if (!workspaceId || !assetId) return res.status(400).json({ success: false, error: 'Missing workspaceId or assetId' });

    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM creative_assets WHERE id = $1 AND workspace_id = $2`, [assetId, workspaceId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Asset not found' });

    const creativeService = new CreativeService();
    const result = await creativeService.ensurePublicUrl(rows[0], workspaceId);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Mirror Asset Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
