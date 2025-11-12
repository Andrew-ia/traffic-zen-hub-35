import { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

/**
 * Create a new document
 * POST /api/pm/documents/:workspaceId/:listId
 */
export async function createDocument(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;
    const {
      folder_id,
      name,
      content,
      position,
    } = req.body;

    console.log('📄 Creating document with body:', { folder_id, name, content: content?.substring(0, 50) });

    if (!workspaceId || !listId || !folder_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID, Folder ID, List ID, and name are required',
      });
    }

    const pool = getPool();

    // Get the next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const posResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM pm_documents WHERE list_id = $1',
        [listId]
      );
      finalPosition = posResult.rows[0].next_position;
    }

    const query = `
      INSERT INTO pm_documents (
        workspace_id, folder_id, list_id,
        name, content, position
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      workspaceId,
      folder_id,
      listId,
      name,
      content || null,
      finalPosition,
    ]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create document',
    });
  }
}

/**
 * Get all documents for a workspace or list
 * GET /api/pm/documents/:workspaceId/:listId?
 */
export async function getDocuments(req: Request, res: Response) {
  try {
    const { workspaceId, listId } = req.params;

    const pool = getPool();

    let query;
    let params;

    if (listId) {
      query = `
        SELECT d.*,
               f.name as folder_name,
               f.icon as folder_icon,
               l.name as list_name,
               l.icon as list_icon,
               (SELECT COUNT(*) FROM pm_document_attachments WHERE document_id = d.id) as attachment_count
        FROM pm_documents d
        JOIN pm_folders f ON d.folder_id = f.id
        JOIN pm_lists l ON d.list_id = l.id
        WHERE d.workspace_id = $1 AND d.list_id = $2 AND d.status = 'active'
        ORDER BY d.position ASC, d.created_at DESC
      `;
      params = [workspaceId, listId];
    } else {
      query = `
        SELECT d.*,
               f.name as folder_name,
               f.icon as folder_icon,
               l.name as list_name,
               l.icon as list_icon,
               (SELECT COUNT(*) FROM pm_document_attachments WHERE document_id = d.id) as attachment_count
        FROM pm_documents d
        JOIN pm_folders f ON d.folder_id = f.id
        JOIN pm_lists l ON d.list_id = l.id
        WHERE d.workspace_id = $1 AND d.status = 'active'
        ORDER BY d.position ASC, d.created_at DESC
      `;
      params = [workspaceId];
    }

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
    });
  }
}

/**
 * Upload attachment to document
 * POST /api/pm/documents/:documentId/attachments
 */
export async function uploadAttachment(req: Request, res: Response) {
  try {
    const { documentId } = req.params;
    const { file_name, file_url, file_type, file_size } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({
        success: false,
        error: 'file_name and file_url are required',
      });
    }

    const pool = getPool();

    const query = `
      INSERT INTO pm_document_attachments (
        document_id, file_name, file_url, file_type, file_size
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      documentId,
      file_name,
      file_url,
      file_type || null,
      file_size || null,
    ]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload attachment',
    });
  }
}

/**
 * Get attachments for a document
 * GET /api/pm/documents/:documentId/attachments
 */
export async function getAttachments(req: Request, res: Response) {
  try {
    const { documentId } = req.params;

    const pool = getPool();

    const query = `
      SELECT * FROM pm_document_attachments
      WHERE document_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [documentId]);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch attachments',
    });
  }
}
