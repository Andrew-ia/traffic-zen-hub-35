import type { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_PRIMARY = 'gemini-2.5-flash-image';
const MODEL_FALLBACK = 'gemini-2.0-flash-preview-image-generation';

let cachedKey: string | null = null;
let cachedClient: GoogleGenerativeAI | null = null;

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

function getGeminiClient() {
  const key = getGeminiApiKey();
  if (!key) {
    cachedClient = null;
    cachedKey = null;
    return null;
  }

  if (!cachedClient || cachedKey !== key) {
    cachedClient = new GoogleGenerativeAI(key);
    cachedKey = key;
  }

  return cachedClient;
}

type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';
const MAX_VARIATIONS = 3;

interface TryOnRequestBody {
  modelBase64: string; // base64 without data URL prefix
  modelMimeType: string;
  clothingBase64: string; // base64 without data URL prefix
  clothingMimeType: string;
  aspectRatio?: AspectRatio;
  count?: number;
  brandName?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorStatus = (err: any) => {
  const raw = err?.status || err?.response?.status || err?.code;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
};

const isRetryableError = (err: any) => {
  const status = getErrorStatus(err);
  const msg = String(err?.message || '').toLowerCase();
  if (status === 429 || status === 503) return true;
  if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) return true;
  if (msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('temporar')) return true;
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  return false;
};

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isRetryableError(err)) {
        const retryMatch = String(err?.message || '').match(/retry in (\d+\.?\d*)s/i);
        const suggestedDelay = retryMatch
          ? parseFloat(retryMatch[1]) * 1000
          : baseDelay * Math.pow(2, i);
        await delay(suggestedDelay);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function buildPrompt(aspectRatio: AspectRatio = '9:16', brandName: string = 'Vermezzo') {
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
- Portrait photo in ${aspectRatio} aspect ratio (strictly match this framing)
- Target resolution ${w}x${h} pixels

DEPOIS de gerar a imagem, analise a ROUPA que você colocou na modelo e crie uma legenda ATRAENTE e VENDEDORA para um post de Instagram da marca "${brandName}".

INSTRUÇÕES PARA A LEGENDA:
1. COMECE falando DIRETAMENTE sobre a ROUPA (não sobre a modelo)
2. Descreva o ESTILO, CAIMENTO e VERSATILIDADE da peça
3. Use um tom casual, elegante e moderno
4. Destaque conforto, elegância e ocasiões de uso da ROUPA
5. Use emojis estrategicamente (2-4 no máximo)
6. Foque em criar DESEJO de comprar essa PEÇA
7. Inclua call-to-action forte no final
8. Seja específico sobre a ROUPA, não genérico

FORMATO DA LEGENDA:
✨ [Nome da Peça/Roupa] ✨

[Parágrafo 1: Descreva a ROUPA - seu estilo, caimento, detalhes especiais]

[Parágrafo 2: Benefícios e versatilidade da PEÇA - como usar, com o que combinar]

👉 Perfeita para: [Ocasiões específicas]
✨ Dica de styling: [Como combinar essa PEÇA]

🛍️ Disponível na ${brandName}
📍 Loja física e online
💬 [Call-to-action forte]

IMPORTANTE:
- NÃO fale sobre "a modelo está linda" ou "o look completo"
- NÃO invente preços específicos
- FOQUE na ROUPA como produto a ser vendido

Retorne a imagem gerada E a legenda como texto.`;
}

function extractImagesAndCaptionFromResponse(response: any): { images: string[]; caption: string | null } {
  const candidates = response?.candidates ?? [];
  const images: string[] = [];
  let caption: string | null = null;

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      // Extract images
      if (part && typeof part === 'object' && 'inlineData' in part && part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const data = part.inlineData.data;
        if (data) {
          images.push(`data:${mimeType};base64,${data}`);
        }
      }
      // Extract text (caption)
      if (part && typeof part === 'object' && 'text' in part && part.text) {
        caption = part.text;
      }
    }
  }

  return { images, caption };
}

async function generateSingleImage(
  modelBase64: string,
  modelMimeType: string,
  clothingBase64: string,
  clothingMimeType: string,
  aspectRatio: AspectRatio,
  brandName: string = 'Vermezzo',
): Promise<{ image: string; caption: string | null }> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('Servidor sem GEMINI_API_KEY configurada.');
  }

  const prompt = buildPrompt(aspectRatio, brandName);

  const imageParts = [
    { inlineData: { data: modelBase64, mimeType: modelMimeType } },
    { inlineData: { data: clothingBase64, mimeType: clothingMimeType } },
  ];

  const contents: any = [{ role: 'user', parts: [...imageParts, { text: prompt }] }];

  const attemptModel = async (modelName: string) =>
    retryWithBackoff(async () => {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents,
      });

      const { images, caption } = extractImagesAndCaptionFromResponse(result.response);
      console.log(`📝 Caption extracted:`, caption ? caption.substring(0, 100) + '...' : 'NULL');
      if (images.length === 0) {
        const textResponse = result.response?.text?.();
        throw new Error(
          textResponse
            ? `Resposta inesperada do modelo: ${textResponse}`
            : 'Resposta do modelo sem imagens.',
        );
      }
      return { image: images[0], caption };
    });

  try {
    return await attemptModel(MODEL_PRIMARY);
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const status = getErrorStatus(e);
    if (
      status === 503 ||
      msg.includes('overloaded') ||
      msg.includes('unavailable') ||
      msg.includes('not found')
    ) {
      console.warn(`Modelo ${MODEL_PRIMARY} indisponível, tentando ${MODEL_FALLBACK}...`);
      return await attemptModel(MODEL_FALLBACK);
    }
    throw e;
  }
}

async function generateImages(
  modelBase64: string,
  modelMimeType: string,
  clothingBase64: string,
  clothingMimeType: string,
  aspectRatio: AspectRatio,
  count: number,
  brandName: string = 'Vermezzo',
): Promise<{ images: string[]; captions: string[] }> {
  const variationsRequested = Math.min(Math.max(count, 1), MAX_VARIATIONS);
  const images: string[] = [];
  const captions: string[] = [];
  const maxAttempts = variationsRequested + 3;

  let attempts = 0;
  while (images.length < variationsRequested && attempts < maxAttempts) {
    const { image, caption } = await generateSingleImage(
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio,
      brandName,
    );

    if (!images.includes(image)) {
      images.push(image);
      captions.push(caption || '');
    }
    attempts += 1;

    if (images.length < variationsRequested) {
      await delay(1000);
    }
  }

  return {
    images: images.slice(0, variationsRequested),
    captions: captions.slice(0, variationsRequested),
  };
}

export async function virtualTryOn(req: Request, res: Response) {
  try {
    console.log('🎨 Virtual Try-On request received');

    if (!getGeminiApiKey()) {
      console.error('❌ GEMINI_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Servidor sem GEMINI_API_KEY configurada.',
      });
    }

    const {
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio = '9:16',
      count = 1,
      brandName = 'Vermezzo',
    } = req.body as TryOnRequestBody;

    console.log(`📸 Processing: aspectRatio=${aspectRatio}, count=${count}, brand=${brandName}`);

    if (!modelBase64 || !modelMimeType || !clothingBase64 || !clothingMimeType) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }

    // Basic validation for mime types
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(modelMimeType) || !allowed.includes(clothingMimeType)) {
      return res.status(400).json({ success: false, error: 'Formato de imagem inválido. Use PNG, JPG ou WEBP.' });
    }

    const requestedCount =
      typeof count === 'number'
        ? count
        : parseInt(String(count), 10) || 1;

    console.log(`🚀 Calling Gemini API to generate ${requestedCount} image(s) with captions...`);
    const { images, captions } = await generateImages(
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio as AspectRatio,
      requestedCount,
      brandName,
    );

    console.log(`✅ Generated ${images.length} image(s) successfully with captions`);
    return res.json({
      success: true,
      images,
      image: images[0],
      captions,
      caption: captions[0],
      count: images.length,
    });
  } catch (error: any) {
    const msg = error?.message || 'Erro desconhecido';
    if (/unregistered callers|api key/i.test(msg) || error?.status === 403) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao autenticar com a API do Gemini. Verifique se a GEMINI_API_KEY é válida e possui acesso ao modelo de imagem.',
      });
    }
    if (msg.toLowerCase().includes('quota') || msg.includes('429')) {
      return res.status(429).json({ success: false, error: 'Limite de quota atingido. Tente novamente em alguns minutos.' });
    }
    if (msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('unavailable')) {
      return res.status(503).json({ success: false, error: 'Modelo sobrecarregado no momento. Tente novamente em alguns minutos.' });
    }
    // Retornar mensagem completa para facilitar diagnóstico quando houver erro do modelo
    console.error('Erro no virtual try-on:', error);
    return res.status(500).json({ success: false, error: msg });
  }
}
