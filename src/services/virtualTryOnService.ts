// Frontend service refatorado para chamar o backend com segurança
import { resolveApiBase } from '@/lib/apiBase';

const API_BASE = resolveApiBase();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';

export interface GenerateOptions {
  count?: number;
  aspectRatio?: AspectRatio;
  signal?: AbortSignal;
  brandName?: string;
}

export interface GenerateResult {
  images: string[];
}

async function generateBatchViaBackend(
  modelBase64: string,
  modelMimeType: string,
  clothingBase64: string,
  clothingMimeType: string,
  aspectRatio: AspectRatio = '9:16',
  count: number,
  brandName: string = 'Vermezzo',
  signal?: AbortSignal,
): Promise<{ images: string[] }> {
  const resp = await fetch(`${API_BASE}/api/ai/virtual-tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio,
      count,
      brandName,
    }),
    signal,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const msg = data?.error || `Falha na API (${resp.status})`;
    throw new Error(msg);
  }

  const data = await resp.json();
  const images: string[] = [];
  if (typeof data.image === 'string' && data.image.length > 0) {
    images.push(data.image);
  }

  if (Array.isArray(data.images)) {
    for (const img of data.images) {
      if (typeof img === 'string' && img.length > 0) {
        images.push(img);
      }
    }
  }

  const uniqueImages = Array.from(new Set(images));

  if (uniqueImages.length === 0) {
    throw new Error('Resposta da API não contém imagens válidas.');
  }

  return { images: uniqueImages };
}

export const generateVariations = async (
  modelFile: File,
  clothingFile: File,
  count: number = 3,
  onProgress?: (current: number, total: number) => void,
  options?: Omit<GenerateOptions, 'count'>,
): Promise<GenerateResult> => {
  const [modelBase64, clothingBase64] = await Promise.all([
    fileToBase64(modelFile),
    fileToBase64(clothingFile),
  ]);

  const aspectRatio: AspectRatio = options?.aspectRatio || '9:16';
  const brandName: string = options?.brandName || 'Vermezzo';
  const signal = options?.signal;
  const totalRequested = Math.min(Math.max(count, 1), 3);
  const results: string[] = [];
  try {
    onProgress?.(0, totalRequested);

    const batch = await generateBatchViaBackend(
      modelBase64,
      modelFile.type,
      clothingBase64,
      clothingFile.type,
      aspectRatio,
      totalRequested,
      brandName,
      signal,
    );

    results.push(...batch.images.slice(0, totalRequested));
    onProgress?.(results.length, totalRequested);

    if (results.length < totalRequested) {
      const missing = totalRequested - results.length;
      console.warn(`Recebidas ${results.length} imagens, faltam ${missing}. Tentando novamente...`);
      await delay(1000);

      const extraBatch = await generateBatchViaBackend(
        modelBase64,
        modelFile.type,
        clothingBase64,
        clothingFile.type,
        aspectRatio,
        missing,
        brandName,
        signal,
      );

      for (let i = 0; i < extraBatch.images.length; i++) {
        const image = extraBatch.images[i];
        if (!results.includes(image) && results.length < totalRequested) {
          results.push(image);
        }
      }

      onProgress?.(results.length, totalRequested);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { images: results };
    }
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      if (results.length > 0) {
        console.warn(`Limite de quota atingido após ${results.length} imagens`);
        return { images: results };
      }
    }
    throw error;
  }

  return { images: results };
};
