import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    getAggregateMetrics,
    getTimeSeriesMetrics,
    getDemographics,
    getCreativePerformance
} from '../api/analytics';
import { ga4Realtime, ga4Report, ga4GoogleAds } from '../api/analytics/ga4';

const router = Router();

router.use(authMiddleware);

// General Analytics
router.get('/metrics/aggregate', getAggregateMetrics);
router.get('/metrics/timeseries', getTimeSeriesMetrics);
router.get('/demographics', getDemographics);
router.get('/creative-performance', getCreativePerformance);

// GA4
router.get('/ga4/realtime', ga4Realtime);
router.get('/ga4/report', ga4Report);
router.get('/ga4/google-ads', ga4GoogleAds);

export default router;
