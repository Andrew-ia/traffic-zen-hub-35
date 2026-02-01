import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import crypto from 'crypto';

/**
 * Save Virtual Try-On generated images to creative_assets table
 * Accepts base64 image data and saves it with virtual-tryon metadata
 */
export async function saveTryOnCreatives(req: Request, res: Response) {
  try {
    const { images, workspaceId, modelName, clothingName, aspectRatio, folderName } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Images array is required',
      });
    }

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    console.log(`💾 Saving ${images.length} Virtual Try-On images for workspace ${workspaceId}`);

    const pool = getPool();
    const savedCreatives = [];

    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];

      // Validate base64 image format
      if (!imageData.startsWith('data:image/')) {
        console.warn(`⚠️  Skipping invalid image format at index ${i}`);
        continue;
      }

      // Generate a unique name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `Virtual Try-On - ${modelName || 'Modelo'} × ${clothingName || 'Roupa'} - ${timestamp} (${i + 1})`;

      // Create metadata
      const metadata = {
        source: 'virtual-tryon',
        modelName: modelName || null,
        clothingName: clothingName || null,
        folderName: folderName || null,
        aspectRatio: aspectRatio || '9:16',
        generatedAt: new Date().toISOString(),
        variationIndex: i + 1,
      };

      // Generate hash from image data for deduplication
      const hash = crypto
        .createHash('md5')
        .update(imageData)
        .digest('hex');

      // Insert into database
      const result = await pool.query(
        `
        INSERT INTO creative_assets (
          workspace_id,
          name,
          type,
          storage_url,
          thumbnail_url,
          aspect_ratio,
          text_content,
          metadata,
          hash,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now(), now())
        RETURNING id, name, created_at
        `,
        [
          workspaceId,
          name,
          'image',
          imageData, // Store base64 directly as storage_url
          imageData, // Use same data for thumbnail
          aspectRatio || '9:16',
          `Gerado com IA - ${modelName || 'Modelo'} usando ${clothingName || 'roupa'}`,
          JSON.stringify(metadata),
          hash,
          'active',
        ]
      );

      const saved = result.rows[0];
      savedCreatives.push(saved);
      console.log(`✅ Saved creative ${saved.id}: ${saved.name}`);
    }

    console.log(`✨ Successfully saved ${savedCreatives.length} Virtual Try-On creatives`);

    return res.json({
      success: true,
      savedCount: savedCreatives.length,
      creatives: savedCreatives,
      message: `${savedCreatives.length} ${savedCreatives.length === 1 ? 'imagem salva' : 'imagens salvas'} com sucesso!`,
    });
  } catch (error: any) {
    console.error('❌ Error saving Virtual Try-On creatives:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to save creatives',
    });
  }
}
