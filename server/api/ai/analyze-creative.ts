
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function analyzeCreative(req: Request, res: Response) {
    try {
        const { imageUrl, metrics, creativeName } = req.body;

        if (!imageUrl || !metrics) {
            return res.status(400).json({ success: false, error: 'Missing imageUrl or metrics' });
        }

        console.log('🧠 Analyzing creative:', creativeName);

        // Fetch image
        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) {
            throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
        }
        const imageBuffer = await imageResp.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
      Analyze this ad creative based on its performance metrics:
      
      Creative Name: ${creativeName}
      Spend: ${metrics.spend}
      Impressions: ${metrics.impressions}
      Clicks: ${metrics.clicks}
      CTR: ${metrics.ctr}%
      CPC: ${metrics.cpc}
      ROAS: ${metrics.roas}x
      CPA: ${metrics.cpa}

      Please provide a concise analysis covering:
      1. Visual Appeal: What stands out in the image?
      2. Performance Context: Is the CTR/ROAS good? Why might that be based on the visual?
      3. Recommendations: What would you improve or test next?

      Keep the tone professional and actionable. Portuguese language.
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: imageResp.headers.get('content-type') || 'image/jpeg',
                },
            },
        ]);

        const response = result.response;
        const text = response.text();

        res.json({
            success: true,
            analysis: text,
        });

    } catch (error) {
        console.error('Error analyzing creative:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze creative' });
    }
}
