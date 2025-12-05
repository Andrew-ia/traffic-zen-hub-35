import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createMetaCampaign, mirrorCreativeAsset } from '../api/integrations/meta/create-campaign';
import {
    optimizedMetaSync,
    simpleSync,
    syncMetaBilling,
    getMetaCustomAudiences,
    getMetaPageInfo,
    listMetaPages
} from '../api/integrations/meta';
import {
    initiateGoogleAdsAuth,
    handleGoogleAdsCallback,
    syncGoogleAdsData
} from '../api/integrations/google';
import {
    optimizedInstagramSync,
    simpleInstagramSync,
    directInstagramSync,
    getEngagementRate
} from '../api/integrations/instagram';
import mercadoLivreRouter from '../api/integrations/mercadolivre';

const router = Router();

// Mercado Livre routes (public OAuth callback)
router.use('/mercadolivre', mercadoLivreRouter);

// Apply auth middleware to other routes
router.use(authMiddleware);

// Meta Ads
router.post('/meta/campaigns', createMetaCampaign);
router.post('/meta/sync', optimizedMetaSync);
router.post('/meta/sync/simple', simpleSync);
router.post('/meta/sync/billing', syncMetaBilling);
router.get('/meta/custom-audiences', getMetaCustomAudiences);
router.get('/meta/page-info', getMetaPageInfo);
router.get('/meta/pages', listMetaPages);
router.post('/meta/assets/mirror', mirrorCreativeAsset);

// Google Ads
router.get('/google/auth', initiateGoogleAdsAuth);
router.get('/google/callback', handleGoogleAdsCallback);
router.post('/google/sync', syncGoogleAdsData);

// Instagram
router.post('/instagram/sync', optimizedInstagramSync);
router.post('/instagram/sync/simple', simpleInstagramSync);
router.post('/instagram/sync/direct', directInstagramSync);
router.get('/instagram/engagement', getEngagementRate);

// Mercado Livre routes already registered above

export default router;
