import type { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with server-side API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const MODEL_PRIMARY = 'gemini-2.5-flash-image';
const MODEL_FALLBACK = 'gemini-1.5-flash';

// Use a forma compatível com a versão instalada do SDK (string)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';

interface TryOnRequestBody {
  modelBase64: string; // base64 without data URL prefix
  modelMimeType: string;
  clothingBase64: string; // base64 without data URL prefix
  clothingMimeType: string;
  aspectRatio?: AspectRatio;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('429') || msg.includes('rate')) {
        const retryMatch = (err?.message || '').match(/retry in (\d+\.?\d*)s/i);
        const suggestedDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : baseDelay * Math.pow(2, i);
        await delay(suggestedDelay);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function buildPrompt(aspectRatio: AspectRatio = '9:16') {
  const dims: Record<AspectRatio, { w: number; h: number }> = {
    '1:1': { w: 1080, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '16:9': { w: 1920, h: 1080 },
    '4:5': { w: 1080, h: 1350 },
  };
  const { w, h } = dims[aspectRatio];
  return `Create a realistic fashion photo.

Use the person from the first image and dress them with the clothing from the second image.

Requirements:
- Maintain the model's face, hair, skin tone, and original pose exactly
- The clothing should fit naturally on the body
- Match lighting and shadows consistently
- Photo-realistic and high quality

Output:
- Portrait photo in ${aspectRatio} aspect ratio
- Target resolution ${w}x${h} pixels`;
}

async function generateSingleImage(
  modelBase64: string,
  modelMimeType: string,
  clothingBase64: string,
  clothingMimeType: string,
  aspectRatio: AspectRatio,
  retryCount = 0,
): Promise<string> {
  const prompt = buildPrompt(aspectRatio);

  const imageParts = [
    { inlineData: { data: modelBase64, mimeType: modelMimeType } },
    { inlineData: { data: clothingBase64, mimeType: clothingMimeType } },
  ];

  const contents: any = [{ role: 'user', parts: [...imageParts, { text: prompt }] }];

  let modelName = MODEL_PRIMARY;
  let result: any;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    result = await model.generateContent({
      contents,
      generationConfig: { responseMimeType: 'image/png' },
    });
  } catch (e: any) {
    if (e.message?.includes('unavailable') || e.message?.includes('not found')) {
      console.warn(`Modelo ${modelName} indisponível, tentando ${MODEL_FALLBACK}...`);
      modelName = MODEL_FALLBACK;
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent({
          contents,
          generationConfig: { responseMimeType: 'image/png' },
        });
      } catch (fallbackError: any) {
        console.error(`Falha no modelo fallback ${MODEL_FALLBACK}:`, fallbackError);
        throw new Error(
          `Modelos ${MODEL_PRIMARY} e ${MODEL_FALLBACK} indisponíveis para esta conta/região.`,
        );
      }
    } else {
      throw e;
    }
  }

  const response = result.response;
  const firstPart = response?.candidates?.[0]?.content?.parts?.[0];

  if (firstPart && 'inlineData' in firstPart) {
    return `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
  }

  const textResponse = response?.text?.();
  if (retryCount < 2 && (!firstPart || !('inlineData' in firstPart))) {
    console.warn('Resposta inesperada, tentando novamente. Resposta:', textResponse);
    await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
    return generateSingleImage(
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio,
      retryCount + 1,
    );
  }

  throw new Error(
    `Não foi possível gerar uma imagem válida. Resposta da IA: ${
      textResponse || '(vazio)'
    }`,
  );
}

export async function virtualTryOn(req: Request, res: Response) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Servidor sem GEMINI_API_KEY configurada.' });
    }

    const {
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio = '9:16',
    } = req.body as TryOnRequestBody;

    if (!modelBase64 || !modelMimeType || !clothingBase64 || !clothingMimeType) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }

    // Basic validation for mime types
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(modelMimeType) || !allowed.includes(clothingMimeType)) {
      return res.status(400).json({ success: false, error: 'Formato de imagem inválido. Use PNG, JPG ou WEBP.' });
    }

    const image = await generateSingleImage(
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio as AspectRatio
    );

    return res.json({ success: true, image });
  } catch (error: any) {
    const msg = error?.message || 'Erro desconhecido';
    if (msg.toLowerCase().includes('quota') || msg.includes('429')) {
      return res.status(429).json({ success: false, error: 'Limite de quota atingido. Tente novamente em alguns minutos.' });
    }
    // Retornar mensagem completa para facilitar diagnóstico quando houver erro do modelo
    console.error('Erro no virtual try-on:', error);
    return res.status(500).json({ success: false, error: msg });
  }
}
