import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GenerateImageOptions {
  prompt: string;
  modelFile?: File | Blob;
  clothingFile?: File | Blob;
  numVariations?: number;
  aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
}

export interface GeneratedImage {
  imageData: string; // base64
  aspectRatio: string;
  width: number;
  height: number;
}

/**
 * Generate image variations using Gemini AI
 * Adapted from your Google AI Studio app
 */
export async function generateVariations(
  options: GenerateImageOptions
): Promise<GeneratedImage[]> {
  const {
    prompt,
    modelFile,
    clothingFile,
    numVariations = 3,
    aspectRatio = '1:1',
  } = options;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare file parts if provided
    const parts: any[] = [{ text: prompt }];

    if (modelFile) {
      const modelBase64 = await fileToBase64(modelFile);
      parts.push({
        inlineData: {
          mimeType: modelFile.type,
          data: modelBase64,
        },
      });
    }

    if (clothingFile) {
      const clothingBase64 = await fileToBase64(clothingFile);
      parts.push({
        inlineData: {
          mimeType: clothingFile.type,
          data: clothingBase64,
        },
      });
    }

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = result.response;
    const text = response.text();

    // Parse response and extract images
    // Note: Adjust this based on actual Gemini response format
    const images: GeneratedImage[] = [];

    // Calculate dimensions based on aspect ratio
    const dimensions = getAspectRatioDimensions(aspectRatio);

    // TODO: Extract actual image data from Gemini response
    // This is a placeholder - adjust based on your actual API response
    for (let i = 0; i < numVariations; i++) {
      images.push({
        imageData: text, // Replace with actual image data
        aspectRatio,
        ...dimensions,
      });
    }

    return images;
  } catch (error) {
    console.error('Error generating variations:', error);
    throw new Error('Failed to generate images with Gemini AI');
  }
}

/**
 * Generate multiple aspect ratio variants from a single prompt
 */
export async function generateMultiAspectVariants(
  prompt: string,
  modelFile?: File | Blob,
  clothingFile?: File | Blob
): Promise<Record<string, GeneratedImage[]>> {
  const aspectRatios: Array<'1:1' | '9:16' | '16:9' | '4:5'> = [
    '1:1',
    '9:16',
    '16:9',
    '4:5',
  ];

  const results: Record<string, GeneratedImage[]> = {};

  for (const ratio of aspectRatios) {
    try {
      const images = await generateVariations({
        prompt: `${prompt}. Generate in ${ratio} aspect ratio.`,
        modelFile,
        clothingFile,
        numVariations: 2,
        aspectRatio: ratio,
      });
      results[ratio] = images;
    } catch (error) {
      console.error(`Failed to generate ${ratio} variants:`, error);
      results[ratio] = [];
    }
  }

  return results;
}

// Helper functions
function getAspectRatioDimensions(ratio: string): {
  width: number;
  height: number;
} {
  const dimensions: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1080, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };

  return dimensions[ratio] || dimensions['1:1'];
}

async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
}
