import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * Get Virtual Try-On looks grouped by folder (model × clothing combination)
 */
export async function getTryOnLooks(req: Request, res: Response) {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    const pool = getPool();

    // Get all virtual try-on creatives grouped by folder
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        storage_url,
        thumbnail_url,
        aspect_ratio,
        metadata,
        created_at,
        (metadata->>'modelName')::text as model_name,
        (metadata->>'clothingName')::text as clothing_name,
        (metadata->>'folderName')::text as folder_name
      FROM creative_assets
      WHERE workspace_id = $1
        AND status = 'active'
        AND (metadata->>'source')::text = 'virtual-tryon'
      ORDER BY created_at DESC
      `,
      [workspaceId]
    );

    // Group by folder
    const folderMap = new Map<string, any>();

    result.rows.forEach((row) => {
      // Use custom folder name if provided, otherwise generate from model × clothing
      const folderName = row.folder_name ||
        `${row.model_name || 'Sem nome'} × ${row.clothing_name || 'Sem nome'}`;

      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, {
          name: folderName,
          modelName: row.model_name,
          clothingName: row.clothing_name,
          images: [],
          count: 0,
          lastGenerated: row.created_at,
        });
      }

      const folder = folderMap.get(folderName)!;
      folder.images.push({
        id: row.id,
        name: row.name,
        url: row.storage_url,
        thumbnailUrl: row.thumbnail_url,
        aspectRatio: row.aspect_ratio,
        metadata: row.metadata,
        createdAt: row.created_at,
      });
      folder.count = folder.images.length;

      // Update last generated date if this image is newer
      if (new Date(row.created_at) > new Date(folder.lastGenerated)) {
        folder.lastGenerated = row.created_at;
      }
    });

    const folders = Array.from(folderMap.values()).sort((a, b) =>
      new Date(b.lastGenerated).getTime() - new Date(a.lastGenerated).getTime()
    );

    return res.json({
      success: true,
      folders,
      totalFolders: folders.length,
      totalImages: result.rows.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching Virtual Try-On looks:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch looks',
    });
  }
}

/**
 * Delete a Virtual Try-On creative
 */
export async function deleteTryOnLook(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { workspaceId } = req.body;

    if (!id || !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Creative ID and Workspace ID are required',
      });
    }

    const pool = getPool();

    // Soft delete by setting status to 'deleted'
    const result = await pool.query(
      `
      UPDATE creative_assets
      SET status = 'deleted', updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND (metadata->>'source')::text = 'virtual-tryon'
      RETURNING id
      `,
      [id, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creative not found or not authorized',
      });
    }

    return res.json({
      success: true,
      message: 'Look deletado com sucesso',
    });
  } catch (error: any) {
    console.error('❌ Error deleting Virtual Try-On look:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete look',
    });
  }
}
