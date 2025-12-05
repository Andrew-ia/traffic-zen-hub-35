import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    getCampaignLibrary,
    getCampaignById,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    copyCampaign,
} from '../api/campaigns';

const router = Router();

router.use(authMiddleware);

router.get('/:workspaceId', getCampaignLibrary);
router.get('/:workspaceId/:campaignId', getCampaignById);
router.post('/:workspaceId', createCampaign);
router.put('/:workspaceId/:campaignId', updateCampaign);
router.delete('/:workspaceId/:campaignId', deleteCampaign);
router.post('/:workspaceId/:campaignId/copy', copyCampaign);

export default router;
