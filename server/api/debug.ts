
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
    try {
        const hasGeminiKey = !!process.env.GEMINI_API_KEY;
        const geminiKeyLength = process.env.GEMINI_API_KEY?.length || 0;

        return res.status(200).json({
            success: true,
            gemini_configured: hasGeminiKey,
            gemini_key_length: geminiKeyLength,
            env_keys: Object.keys(process.env).filter(k => k.includes('GEMINI'))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
