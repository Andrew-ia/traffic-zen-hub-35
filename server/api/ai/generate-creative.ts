import type { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (e) {
  console.warn('Supabase não configurado, geração seguirá sem persistência.');
  supabase = null;
}
// Evita erros de tipo quando o schema do Supabase não está tipado
const sb = supabase as any;

interface GenerateCreativeRequest {
  prompt: string;
  workspaceId: string;
  folderId?: string;
  tags?: string[];
  aspectRatios?: string[]; // ['1:1', '9:16', '16:9', '4:5']
  numVariations?: number;
}

/**
 * Generate creative images using Gemini AI
 * POST /api/ai/generate-creative
 */
export async function generateCreative(req: Request, res: Response) {
  try {
    const {
      prompt,
      workspaceId,
      folderId,
      tags = [],
      aspectRatios = ['1:1'],
      numVariations = 1,
    }: GenerateCreativeRequest = req.body;

    if (!prompt || !workspaceId) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, workspaceId',
      });
    }

    console.log('🎨 Generating creatives with Gemini AI...');
    console.log('Prompt:', prompt);
    console.log('Aspect Ratios:', aspectRatios);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const generatedAssets: any[] = [];

    // Generate for each aspect ratio
    for (const ratio of aspectRatios) {
      const dimensions = getAspectRatioDimensions(ratio);

      // Enhanced prompt with aspect ratio specification
      const enhancedPrompt = `Generate a high-quality marketing creative image.
Aspect Ratio: ${ratio} (${dimensions.width}x${dimensions.height}px)
Prompt: ${prompt}

Requirements:
- Professional marketing quality
- High resolution
- Optimized for ${ratio} format
- Ready for ad campaigns`;

      try {
        // Generate content with Gemini
        const result = await model.generateContent(enhancedPrompt);
        const response = result.response;
        const text = response.text();

        // Note: Gemini 1.5 Flash primarily generates text
        // For actual image generation, you might want to use:
        // 1. Imagen API (Google's dedicated image gen)
        // 2. Or use Gemini to generate prompts for Imagen
        // 3. Or use a different image generation service

        console.log('✅ Generated content for', ratio);

        // For now, create a placeholder asset
        // TODO: Replace with actual image generation
        const assetId = uuidv4();
        const assetName = `AI Generated - ${prompt.substring(0, 50)}`;

        // Insert into creative_assets
        let asset: any = null;
        let assetError: any = null;
        if (sb) {
          const insertRes = await sb
            .from('creative_assets')
            .insert({
              id: assetId,
              workspace_id: workspaceId,
              folder_id: folderId || null,
              name: assetName,
              type: 'image',
              status: 'active',
              aspect_ratio: ratio,
              text_content: prompt,
            })
            .select()
            .single();
          asset = insertRes?.data ?? null;
          assetError = insertRes?.error ?? null;
        }

        if (assetError) {
          console.error('Error creating asset:', assetError);
          continue;
        }

        // Add tags if provided
        if (tags.length > 0 && asset && sb) {
          for (const tagName of tags) {
            // Get or create tag
            const { data: tag } = await sb
              .from('creative_tags')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('name', tagName)
              .single();

            const tagId = (tag as any)?.id;
            if (tagId) {
              await sb.from('creative_asset_tags').insert({
                creative_asset_id: asset.id,
                tag_id: tagId,
              });
            }
          }
        }

        generatedAssets.push({
          ...asset,
          aspect_ratio: ratio,
          dimensions,
          gemini_response: text.substring(0, 500), // Preview
        });

      } catch (error) {
        console.error(`Error generating ${ratio}:`, error);
      }
    }

    console.log(`✅ Generated ${generatedAssets.length} creative assets`);

    return res.json({
      success: true,
      assets: generatedAssets,
      message: `Generated ${generatedAssets.length} creative variations`,
    });

  } catch (error) {
    console.error('Error in generateCreative:', error);
    return res.status(500).json({
      error: 'Failed to generate creatives',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

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
