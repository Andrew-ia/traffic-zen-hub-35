export class CampaignBuilder {
    static buildCampaignPayload(campaign: any) {
        const payload: any = {
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            special_ad_categories: campaign.special_ad_categories || [],
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
        };

        let campaignDailyBudgetCents = campaign.daily_budget ? Number(campaign.daily_budget) : 0;
        if (!campaignDailyBudgetCents || campaignDailyBudgetCents <= 0) {
            campaignDailyBudgetCents = 2000; // fallback R$ 20,00
        }
        payload.daily_budget = String(Math.max(100, Math.floor(campaignDailyBudgetCents))); // cents

        // ENGAGEMENT: apenas engagement_type na campanha (sem promoted_object)
        if (String(campaign.objective).toUpperCase() === 'OUTCOME_ENGAGEMENT') {
            payload.engagement_type = 'post_engagement';
        }

        return { payload, dailyBudgetCents: campaignDailyBudgetCents };
    }

    static buildAdSetPayload(adSet: any, campaignId: string, campaignObjective: string, pageId?: string, pixelId?: string) {
        const objUpper = String(campaignObjective || '').toUpperCase();
        const destUpper = String(adSet.destination_type || '').toUpperCase();

        // Base payload
        const adSetPayload: any = {
            name: adSet.name,
            campaign_id: campaignId,
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting: this.normalizeTargeting(adSet.targeting),
            status: adSet.status,
            optimization_goal: adSet.optimization_goal,
            billing_event: 'IMPRESSIONS' // Default
        };

        // Handle Budget
        const rawDailyBudget = adSet.daily_budget;
        // Only include ad set budget if provided and valid (and not using CBO, handled by caller logic usually, but here we just check value)
        if (rawDailyBudget !== undefined && rawDailyBudget !== null && String(rawDailyBudget).trim() !== '' && String(rawDailyBudget).toLowerCase() !== 'undefined') {
            adSetPayload.daily_budget = typeof rawDailyBudget === 'string' ? rawDailyBudget : String(rawDailyBudget);
        }

        // Handle Dates
        if (adSet.start_time) {
            // Assuming caller handles timezone conversion or passes UTC
            adSetPayload.start_time = adSet.start_time;
        }
        if (adSet.end_time) {
            adSetPayload.end_time = adSet.end_time;
        }

        // --- STRICT RULES LOGIC ---

        // A) Campanhas de Engajamento (OUTCOME_ENGAGEMENT)
        if (objUpper === 'OUTCOME_ENGAGEMENT') {
            adSetPayload.billing_event = 'IMPRESSIONS';
            adSetPayload.optimization_goal = 'POST_ENGAGEMENT';

            const pubs = this.getPublisherPlatforms(adSet);
            const pubsUpper = pubs.map((p: string) => String(p).toUpperCase());

            if (destUpper === 'INSTAGRAM_OR_FACEBOOK' || pubsUpper.includes('INSTAGRAM') || pubsUpper.includes('FACEBOOK')) {
                adSetPayload.destination_type = 'ON_POST';
            } else {
                adSetPayload.destination_type = 'ON_AD';
            }

            if (pageId) {
                adSetPayload.promoted_object = { page_id: pageId };
            }
        }

        // B) Campanhas de Conversão/Leads/Tráfego
        else if (['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'CONVERSIONS', 'MESSAGES'].includes(objUpper)) {
            adSetPayload.billing_event = 'IMPRESSIONS';

            if (objUpper === 'OUTCOME_LEADS') {
                if (destUpper === 'WHATSAPP' || destUpper === 'MESSENGER') {
                    adSetPayload.destination_type = destUpper;
                    adSetPayload.optimization_goal = 'LEAD_GENERATION';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'INSTAGRAM_OR_FACEBOOK') {
                    adSetPayload.destination_type = 'ON_POST';
                    adSetPayload.optimization_goal = 'LEAD_GENERATION';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'WEBSITE') {
                    adSetPayload.destination_type = 'WEBSITE';
                    adSetPayload.optimization_goal = 'LEAD_GENERATION';
                } else {
                    adSetPayload.destination_type = 'ON_AD';
                    adSetPayload.optimization_goal = 'LEAD_GENERATION';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                }
            } else if (objUpper === 'OUTCOME_TRAFFIC') {
                if (destUpper === 'WEBSITE') {
                    adSetPayload.destination_type = 'WEBSITE';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                } else if (destUpper === 'APP') {
                    adSetPayload.destination_type = 'APP';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                } else if (destUpper === 'WHATSAPP') {
                    adSetPayload.destination_type = 'WHATSAPP';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'MESSAGES_DESTINATIONS') {
                    adSetPayload.destination_type = 'ON_AD';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'INSTAGRAM_OR_FACEBOOK') {
                    adSetPayload.destination_type = 'ON_POST';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else {
                    adSetPayload.destination_type = 'WEBSITE';
                    adSetPayload.optimization_goal = 'LINK_CLICKS';
                }
            } else if (objUpper === 'OUTCOME_SALES') {
                adSetPayload.destination_type = 'WEBSITE';
                adSetPayload.optimization_goal = 'OFFSITE_CONVERSIONS';
                if (pixelId) {
                    adSetPayload.promoted_object = { pixel_id: pixelId, custom_event_type: 'PURCHASE' };
                }
            } else if (objUpper === 'OUTCOME_AWARENESS') {
                adSetPayload.destination_type = 'ON_POST';
                adSetPayload.optimization_goal = 'REACH';
                if (pageId) adSetPayload.promoted_object = { page_id: pageId };
            } else if (objUpper === 'MESSAGES') {
                adSetPayload.optimization_goal = 'CONVERSATIONS';
                if (destUpper === 'WHATSAPP') {
                    adSetPayload.destination_type = 'WHATSAPP';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId, messaging_app_ids: ['whatsapp'] };
                } else if (destUpper === 'MESSENGER') {
                    adSetPayload.destination_type = 'MESSENGER';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'INSTAGRAM_OR_FACEBOOK') {
                    adSetPayload.destination_type = 'ON_POST';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                } else if (destUpper === 'MESSAGES_DESTINATIONS') {
                    adSetPayload.destination_type = 'WHATSAPP';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId, messaging_app_ids: ['whatsapp'] };
                } else {
                    adSetPayload.destination_type = 'ON_AD';
                    if (pageId) adSetPayload.promoted_object = { page_id: pageId };
                }
            } else {
                adSetPayload.destination_type = 'WEBSITE';
            }
        } else {
            // Fallback
            if (destUpper === 'WEBSITE') {
                adSetPayload.destination_type = 'WEBSITE';
            }
        }

        return adSetPayload;
    }

    private static normalizeTargeting(targeting: any) {
        const t = { ...targeting };

        // Normalize custom audiences
        if (t.custom_audiences !== undefined) {
            const ca = t.custom_audiences;
            try {
                let ids: string[] = [];
                if (typeof ca === 'string') {
                    ids = ca.split(',').map((s: string) => s.trim()).filter((s: string) => /^\d+$/.test(s));
                } else if (Array.isArray(ca)) {
                    ids = ca
                        .map((v: any) => typeof v === 'object' && v && v.id ? String(v.id) : String(v))
                        .filter((s: string) => /^\d+$/.test(s));
                }
                if (ids.length > 0) {
                    t.custom_audiences = ids.map((id: string) => ({ id }));
                } else {
                    delete t.custom_audiences;
                }
            } catch {
                delete t.custom_audiences;
            }
        }

        // Handle interests
        if (t.interests) {
            if (typeof t.interests === 'string') {
                const interestIds = t.interests.split(',').map((s: string) => s.trim()).filter((s: string) => /^\d+$/.test(s));
                if (interestIds.length > 0) {
                    t.flexible_spec = [{ interests: interestIds.map((id: string) => ({ id })) }];
                    delete t.interests;
                } else {
                    delete t.interests;
                }
            } else if (!Array.isArray(t.interests)) {
                delete t.interests;
            }
        }

        return t;
    }

    private static getPublisherPlatforms(adSet: any): string[] {
        return Array.isArray(adSet.publisher_platforms)
            ? adSet.publisher_platforms
            : Array.isArray(adSet?.targeting?.publisher_platforms)
                ? adSet.targeting.publisher_platforms
                : [];
    }
}
