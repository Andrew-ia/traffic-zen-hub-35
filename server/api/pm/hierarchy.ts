import type { Request, Response } from 'express';
import { Client } from 'pg';
import { getDatabaseUrl } from '../../config/database.js';

/**
 * PM Hierarchy API endpoint
 * Returns the full hierarchy for a workspace: Folders → Lists → Tasks
 */

/**
 * Get full hierarchy for a workspace
 * GET /api/pm/hierarchy/:workspaceId
 */
export async function getHierarchy(req: Request, res: Response) {
  const client = new Client({ connectionString: getDatabaseUrl() });

  try {
    const { workspaceId } = req.params;
    const { includeArchived = 'false' } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    await client.connect();
    const statusFilter = includeArchived === 'true' ? '' : "AND status = 'active'";

    // Fetch folders
    const foldersQuery = `
      SELECT *
      FROM pm_folders
      WHERE workspace_id = $1 ${statusFilter}
      ORDER BY position ASC, created_at ASC
    `;
    const foldersResult = await client.query(foldersQuery, [workspaceId]);

    // Fetch lists
    const listsQuery = `
      SELECT *
      FROM pm_lists
      WHERE workspace_id = $1 ${statusFilter}
      ORDER BY folder_id, position ASC, created_at ASC
    `;
    const listsResult = await client.query(listsQuery, [workspaceId]);

    // Fetch tasks with full details
    const tasksQuery = `
      SELECT *
      FROM pm_tasks_full
      WHERE workspace_id = $1
      ORDER BY list_id, position ASC, created_at ASC
    `;
    const tasksResult = await client.query(tasksQuery, [workspaceId]);

    // Build hierarchy
    const folders = foldersResult.rows.map((folder) => {
      const folderLists = listsResult.rows
        .filter((list) => list.folder_id === folder.id)
        .map((list) => {
          const listTasks = tasksResult.rows.filter((task) => task.list_id === list.id);
          return {
            ...list,
            tasks: listTasks,
            task_count: listTasks.length,
          };
        });

      return {
        ...folder,
        lists: folderLists,
        list_count: folderLists.length,
        task_count: folderLists.reduce((sum, list) => sum + list.task_count, 0),
      };
    });

    await client.end();

    return res.json({
      success: true,
      data: {
        workspace_id: workspaceId,
        folders,
        stats: {
          folder_count: folders.length,
          list_count: listsResult.rows.length,
          task_count: tasksResult.rows.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignore connection close errors
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch hierarchy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get folder with its lists and tasks
 * GET /api/pm/hierarchy/:workspaceId/:folderId
 */
export async function getFolderHierarchy(req: Request, res: Response) {
  const client = new Client({ connectionString: getDatabaseUrl() });

  try {
    const { workspaceId, folderId } = req.params;

    if (!workspaceId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID and Folder ID are required',
      });
    }

    await client.connect();

    // Fetch folder
    const folderQuery = `
      SELECT *
      FROM pm_folders
      WHERE id = $1 AND workspace_id = $2
    `;
    const folderResult = await client.query(folderQuery, [folderId, workspaceId]);

    if (folderResult.rows.length === 0) {
      await client.end();
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
      });
    }

    // Fetch lists
    const listsQuery = `
      SELECT *
      FROM pm_lists
      WHERE folder_id = $1 AND workspace_id = $2
      ORDER BY position ASC, created_at ASC
    `;
    const listsResult = await client.query(listsQuery, [folderId, workspaceId]);

    // Fetch tasks
    const tasksQuery = `
      SELECT *
      FROM pm_tasks_full
      WHERE folder_id = $1 AND workspace_id = $2
      ORDER BY list_id, position ASC, created_at ASC
    `;
    const tasksResult = await client.query(tasksQuery, [folderId, workspaceId]);

    // Build hierarchy
    const lists = listsResult.rows.map((list) => {
      const listTasks = tasksResult.rows.filter((task) => task.list_id === list.id);
      return {
        ...list,
        tasks: listTasks,
        task_count: listTasks.length,
      };
    });

    const folder = {
      ...folderResult.rows[0],
      lists,
      list_count: lists.length,
      task_count: lists.reduce((sum, list) => sum + list.task_count, 0),
    };

    await client.end();

    return res.json({
      success: true,
      data: folder,
    });
  } catch (error) {
    console.error('Error fetching folder hierarchy:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignore connection close errors
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch folder hierarchy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
