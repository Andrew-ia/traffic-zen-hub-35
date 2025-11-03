// Frontend service refatorado para chamar o backend com segurança

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
}

async function generateOneViaBackend(
  modelBase64: string,
  modelMimeType: string,
  clothingBase64: string,
  clothingMimeType: string,
  aspectRatio: AspectRatio = '9:16',
  signal?: AbortSignal,
): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/ai/virtual-tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelBase64,
      modelMimeType,
      clothingBase64,
      clothingMimeType,
      aspectRatio,
    }),
    signal,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const msg = data?.error || `Falha na API (${resp.status})`;
    throw new Error(msg);
  }

  const data = await resp.json();
  return data.image as string;
}

export const generateVariations = async (
  modelFile: File,
  clothingFile: File,
  count: number = 3,
  onProgress?: (current: number, total: number) => void,
  options?: Omit<GenerateOptions, 'count'>,
): Promise<string[]> => {
  const [modelBase64, clothingBase64] = await Promise.all([
    fileToBase64(modelFile),
    fileToBase64(clothingFile),
  ]);

  const results: string[] = [];
  const aspectRatio: AspectRatio = options?.aspectRatio || '9:16';
  const signal = options?.signal;

  for (let i = 0; i < count; i++) {
    try {
      onProgress?.(i + 1, count);
      const image = await generateOneViaBackend(
        modelBase64,
        modelFile.type,
        clothingBase64,
        clothingFile.type,
        aspectRatio,
        signal,
      );
      results.push(image);
      if (i < count - 1) {
        await delay(1500);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Cancelado pelo usuário: retornar o que já foi gerado
        return results;
      }
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        if (results.length > 0) {
          console.warn(`Limite de quota atingido após ${results.length} imagens`);
          return results;
        }
      }
      throw error;
    }
  }

  return results;
};
