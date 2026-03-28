import { Router } from 'express';
import { MercadoAdsAutomationService } from '../../services/mercadolivre/ads-automation.service.js';
import { authMiddleware } from '../auth.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

const router = Router();
const automation = new MercadoAdsAutomationService();

const getSuggestedCampaignErrorPayload = (message: string) => {
  if (message === 'ml_ads_campaign_create_not_supported') {
    return {
      status: 400,
      body: {
        error: 'Mercado Ads não permite criar campanhas via API nesta conta. Crie a campanha manualmente no painel e depois mova os produtos.',
      },
    };
  }

  if (message === 'ml_ads_permission_denied_write') {
    return {
      status: 403,
      body: {
        error: 'Permissão negada pelo Mercado Livre para gravar no Product Ads. A conta consegue ler dados, mas a API de escrita ainda não está liberada para esta operação.',
        code: 'ml_reauth_required',
      },
    };
  }

  if (message === 'ml_ads_invalid_suggested_campaign_products') {
    return {
      status: 400,
      body: {
        error: 'Selecione entre 1 e 3 produtos para continuar.',
      },
    };
  }

  if (message === 'ml_ads_suggested_campaign_products_not_found') {
    return {
      status: 404,
      body: {
        error: 'Um ou mais produtos sugeridos não foram encontrados na base publicada do Mercado Livre.',
      },
    };
  }

  if (message === 'ml_ads_suggested_campaign_out_of_stock') {
    return {
      status: 400,
      body: {
        error: 'Não é possível continuar porque um dos produtos está sem estoque.',
      },
    };
  }

  if (message === 'ml_ads_suggested_campaign_missing_target') {
    return {
      status: 404,
      body: {
        error: 'A campanha selecionada não foi encontrada ou ainda não está vinculada ao Mercado Ads.',
      },
    };
  }

  if (message === 'ml_ads_product_ad_create_failed') {
    return {
      status: 400,
      body: {
        error: 'A API não conseguiu criar ou atualizar os anúncios dos produtos na campanha escolhida.',
      },
    };
  }

  return null;
};

// Temporarily disable authMiddleware to resolve 401 errors until token sync is fixed
// router.use(authMiddleware);

router.get('/campaigns', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const range = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;

    const [{ campaigns, metrics }, curves] = await Promise.all([
      automation.listCampaigns(workspaceId, range),
      automation.listCurves(workspaceId),
    ]);

    return res.json({
      campaigns,
      curves,
      metrics,
    });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to list campaigns:', err);
    return res.status(500).json({ error: 'Failed to list campaigns', details: err?.message });
  }
});

router.get('/curves', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const curves = await automation.listCurves(workspaceId);
    return res.json({ curves });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to list curves:', err);
    return res.status(500).json({ error: 'Failed to list curves', details: err?.message });
  }
});

router.get('/automation/rules', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const rules = await automation.listActionRules(workspaceId);
    return res.json({ rules });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to list rules:', err);
    return res.status(500).json({ error: 'Failed to list rules', details: err?.message });
  }
});

router.post('/automation/rules', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const rules = await automation.updateActionRules(workspaceId, req.body?.rules || []);
    return res.json({ rules });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to update rules:', err);
    return res.status(500).json({ error: 'Failed to update rules', details: err?.message });
  }
});

router.get('/automation/actions/preview', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.planActions(workspaceId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to plan actions:', err);
    return res.status(500).json({ error: 'Failed to plan actions', details: err?.message });
  }
});

router.post('/automation/actions/apply', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
    const result = await automation.applyActions(workspaceId, actions);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to apply actions:', err);
    return res.status(500).json({ error: 'Failed to apply actions', details: err?.message });
  }
});

router.get('/report/weekly/settings', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const settings = await automation.getWeeklyReportSettings(workspaceId);
    return res.json({ settings });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to load weekly report settings:', err);
    return res.status(500).json({ error: 'Failed to load weekly settings', details: err?.message });
  }
});

router.post('/report/weekly/settings', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const settings = await automation.updateWeeklyReportSettings(workspaceId, req.body?.settings || {});
    return res.json({ settings });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to update weekly report settings:', err);
    return res.status(500).json({ error: 'Failed to update weekly settings', details: err?.message });
  }
});

router.get('/report/weekly', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const report = await automation.generateWeeklyReport(workspaceId);
    return res.json({ report });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to generate weekly report:', err);
    return res.status(500).json({ error: 'Failed to generate weekly report', details: err?.message });
  }
});

router.post('/report/weekly/send', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.sendWeeklyReport(workspaceId);
    return res.json({ success: result.sent, report: result.report });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to send weekly report:', err);
    return res.status(500).json({ error: 'Failed to send weekly report', details: err?.message });
  }
});

router.get('/automation/preview', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.classifyProducts(workspaceId, { refreshCampaignLinks: true });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[MercadoAds] Preview error:', err);
    return res.status(500).json({ error: 'Failed to preview automation', details: err?.message });
  }
});

router.post('/automation/plan', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.planAutomation(workspaceId, req.body || {});
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const message = err?.message || 'Failed to plan automation';
    console.error('[MercadoAds] Plan error:', err);
    return res.status(500).json({ error: 'Failed to plan automation', details: message });
  }
});

router.post('/automation/apply', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.applyAutomation(workspaceId, req.body || {});
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const message = err?.message || 'Failed to apply automation';
    console.error('[MercadoAds] Apply error:', err);
    if (message === 'ml_ads_campaign_create_not_supported') {
      return res.status(400).json({
        error: 'Mercado Ads não permite criar campanhas via API nesta conta. Verifique se o modo automático foi desativado e se o Product Ads está habilitado.',
      });
    }
    if (message === 'ml_ads_no_existing_campaigns') {
      return res.status(400).json({
        error: 'Nenhuma campanha existente encontrada para vincular anúncios. Crie manualmente no painel do Mercado Ads e atualize.',
      });
    }
    if (message === 'ml_ads_product_ad_create_failed') {
      return res.status(400).json({
        error: 'Falha ao criar anúncios na campanha pelo Product Ads API. Verifique permissões e estado da campanha.',
      });
    }

    if (message === 'ml_ads_permission_denied_write') {
      return res.status(403).json({
        error: 'Permissão negada pelo Mercado Livre. Por favor, desconecte e conecte novamente sua conta do Mercado Livre para atualizar as permissões de publicidade.',
        code: 'ml_reauth_required'
      });
    }

    if (message === 'ml_ads_manual_campaign_creation_required') {
      return res.status(400).json({
        error: 'Não foi possível criar as campanhas automaticamente. Por favor, crie manualmente 3 campanhas no Mercado Ads com os nomes "Curva A", "Curva B" e "Curva C" (ou mapeie as existentes) para que a automação possa funcionar.',
      });
    }

    const axiosData = (err as any).response?.data;
    const details = axiosData ? JSON.stringify(axiosData) : message;
    
    return res.status(500).json({ 
      error: 'Failed to apply automation', 
      details,
      fullError: axiosData
    });
  }
});

router.post('/suggested-campaigns', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.createSuggestedCampaign(workspaceId, req.body || {});
    if (!result.processedCount && result.errors?.length) {
      const firstError = result.errors[0]?.error || 'ml_ads_product_ad_create_failed';
      const mapped = getSuggestedCampaignErrorPayload(firstError);
      if (mapped) {
        return res.status(mapped.status).json({
          ...mapped.body,
          processedCount: result.processedCount,
          errors: result.errors,
        });
      }
    }
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const message = err?.message || 'Failed to create suggested campaign';
    console.error('[MercadoAds] Suggested campaign error:', err);
    const mapped = getSuggestedCampaignErrorPayload(message);
    if (mapped) return res.status(mapped.status).json(mapped.body);

    return res.status(500).json({ error: 'Failed to create suggested campaign', details: message });
  }
});

router.post('/suggested-campaigns/assign-existing', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const result = await automation.assignSuggestedCampaignToExisting(workspaceId, req.body || {});
    if (!result.processedCount && result.errors?.length) {
      const firstError = result.errors[0]?.error || 'ml_ads_product_ad_create_failed';
      const mapped = getSuggestedCampaignErrorPayload(firstError);
      if (mapped) {
        return res.status(mapped.status).json({
          ...mapped.body,
          processedCount: result.processedCount,
          errors: result.errors,
        });
      }
    }
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const message = err?.message || 'Failed to assign suggested campaign to existing target';
    console.error('[MercadoAds] Assign existing suggested campaign error:', err);
    const mapped = getSuggestedCampaignErrorPayload(message);
    if (mapped) return res.status(mapped.status).json(mapped.body);

    return res.status(500).json({ error: 'Failed to assign suggested campaign to existing target', details: message });
  }
});

router.post('/campaigns/:campaignId/toggle', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    const { campaignId } = req.params;
    const { status } = req.body;
    if (!status || !['active', 'paused'].includes(String(status))) {
      return res.status(400).json({ error: 'status must be active|paused' });
    }

    const campaigns = await automation.updateCampaignStatus(workspaceId, campaignId, status);
    return res.json({ success: true, campaigns });
  } catch (err: any) {
    console.error('[MercadoAds] Failed to toggle campaign:', err);
    return res.status(500).json({ error: 'Failed to toggle campaign', details: err?.message });
  }
});

router.put('/campaigns/:campaignId/budget', async (req, res) => {
  try {
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    const { campaignId } = req.params;
    const { dailyBudget } = req.body;

    if (typeof dailyBudget !== 'number' || dailyBudget <= 0) {
      return res.status(400).json({ error: 'dailyBudget must be a positive number' });
    }

    const campaigns = await automation.updateCampaignBudget(workspaceId, campaignId, dailyBudget);
    return res.json({ success: true, campaigns });
  } catch (err: any) {
    const axiosData = (err as any).response?.data;
    console.error('[MercadoAds] Failed to update budget:', err, axiosData ? JSON.stringify(axiosData) : '');
    return res.status(500).json({ 
      error: 'Failed to update budget', 
      details: axiosData ? JSON.stringify(axiosData) : err?.message 
    });
  }
});

export default router;
