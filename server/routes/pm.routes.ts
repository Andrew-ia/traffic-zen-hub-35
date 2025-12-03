import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
    getAllFoldersForWorkspace,
    getFolders,
    getFolderById,
    createFolder,
    updateFolder,
    deleteFolder,
} from '../api/pm/folders';
import {
    getAllListsForWorkspace,
    getLists,
    getListById,
    createList,
    updateList,
    deleteList,
} from '../api/pm/lists';
import {
    getAllTasksForWorkspace,
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    uploadTaskAttachment,
    getTaskAttachments,
} from '../api/pm/tasks';
import {
    getDocuments,
    createDocument,
    uploadAttachment,
    getAttachments,
} from '../api/pm/documents';
import {
    getPendingReminders,
    getReminders,
    createReminder,
    markReminderAsSent,
} from '../api/pm/reminders';

const router = Router();

router.use(authMiddleware);

// Folders
router.get('/folders/:workspaceId', getAllFoldersForWorkspace);
router.get('/folders/:workspaceId/:folderId', getFolderById);
router.post('/folders/:workspaceId', createFolder);
router.put('/folders/:workspaceId/:folderId', updateFolder);
router.delete('/folders/:workspaceId/:folderId', deleteFolder);

// Lists
router.get('/lists/:workspaceId', getAllListsForWorkspace);
router.get('/lists/:workspaceId/:folderId', getLists);
router.get('/lists/:workspaceId/list/:listId', getListById);
router.post('/lists/:workspaceId/:folderId', createList);
router.put('/lists/:workspaceId/:listId', updateList);
router.delete('/lists/:workspaceId/:listId', deleteList);

// Tasks
router.get('/tasks/:workspaceId', getAllTasksForWorkspace);
router.get('/tasks/:workspaceId/:listId', getTasks);
router.get('/tasks/:workspaceId/:taskId/details', getTaskById);
router.post('/tasks/:workspaceId/:listId', createTask);
router.put('/tasks/:workspaceId/:taskId', updateTask);
router.delete('/tasks/:workspaceId/:taskId', deleteTask);
router.post('/tasks/:taskId/attachments', uploadTaskAttachment);
router.get('/tasks/:taskId/attachments', getTaskAttachments);

// Documents
router.get('/documents/:workspaceId', getDocuments);
router.get('/documents/:workspaceId/:listId', getDocuments);
router.post('/documents/:workspaceId/:listId', createDocument);
router.post('/documents/:documentId/attachments', uploadAttachment);
router.get('/documents/:documentId/attachments', getAttachments);

// Reminders
router.get('/reminders/pending', getPendingReminders);
router.get('/reminders/:workspaceId', getReminders);
router.get('/reminders/:workspaceId/:listId', getReminders);
router.post('/reminders/:workspaceId/:listId', createReminder);
router.post('/reminders/:reminderId/mark-sent', markReminderAsSent);

export default router;
