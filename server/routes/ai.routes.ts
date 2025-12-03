import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { generateCreative } from '../api/ai/generate-creative';
import { analyzeCreative } from '../api/ai/analyze-creative';
import { virtualTryOn } from '../api/ai/virtual-tryon';
import { generateLookCaption, updateCreativeCaption } from '../api/ai/generate-look-caption';
import { chatWithAssistant } from '../api/ai/chat';

const router = Router();

router.use(authMiddleware);

router.post('/generate-creative', generateCreative);
router.post('/analyze-creative', analyzeCreative);
router.post('/virtual-tryon', virtualTryOn);
router.post('/generate-look-caption', generateLookCaption);
router.post('/update-creative-caption', updateCreativeCaption);
router.post('/chat', chatWithAssistant);

export default router;
