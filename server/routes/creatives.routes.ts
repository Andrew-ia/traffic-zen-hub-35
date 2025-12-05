import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    uploadCreative,
    getCreatives,
    updateCreative,
    deleteCreative,
} from '../api/creatives';
import { downloadProxy } from '../api/creatives/download-proxy';
import { saveTryOnCreatives } from '../api/creatives/save-tryon';
import { getTryOnLooks, deleteTryOnLook } from '../api/creatives/get-tryon-looks';

const router = Router();

router.use(authMiddleware);

router.post('/upload', uploadCreative);
router.get('/:workspaceId', getCreatives);
router.put('/:workspaceId/:creativeId', updateCreative);
router.delete('/:workspaceId/:creativeId', deleteCreative);
router.get('/download-proxy', downloadProxy);
router.post('/tryon/save', saveTryOnCreatives);
router.get('/tryon/looks/:workspaceId', getTryOnLooks);
router.delete('/tryon/looks/:lookId', deleteTryOnLook);

export default router;
