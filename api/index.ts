import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { login, me, createUser, authMiddleware, adminOnly } from '../server/api/auth.js';
import { saveCredentials, getCredentials, deleteCredentials } from '../server/api/integrations/credentials.js';
import { startSync, getSyncStatus, getWorkspaceSyncJobs } from '../server/api/integrations/simpleSync.js';
import { directInstagramSync } from '../server/api/integrations/directSync.js';
import { optimizedMetaSync, getMetaSyncStatus } from '../server/api/integrations/optimizedMetaSync.js';
import { optimizedInstagramSync, getInstagramSyncStatus } from '../server/api/integrations/optimizedInstagramSync.js';
import { syncMetaBilling } from '../server/api/integrations/billing.js';
import { ga4Realtime, ga4Report, ga4GoogleAds } from '../server/api/analytics/ga4.js';
import { getAggregateMetrics, getTimeSeriesMetrics, getAggregateMetricsByObjective } from '../server/api/analytics/metrics.js';
import { getDemographics } from '../server/api/analytics/demographics.js';
import { generateCreative } from '../server/api/ai/generate-creative.js';
import { virtualTryOn } from '../server/api/ai/virtual-tryon.js';
import { generateLookCaption, updateCreativeCaption } from '../server/api/ai/generate-look-caption.js';
import chatRouter from '../server/api/ai/chat.js';
import conversationsRouter from '../server/api/ai/conversations.js';
import { importCashflowXlsx } from '../server/api/finance/cashflow.js';
import { downloadProxy } from '../server/api/creatives/download-proxy.js';
import { saveTryOnCreatives } from '../server/api/creatives/save-tryon.js';
import { getTryOnLooks, deleteTryOnLook } from '../server/api/creatives/get-tryon-looks.js';
import { getEngagementRate } from '../server/api/instagram/engagement.js';
import {
  getFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
} from '../server/api/pm/folders.js';
import {
  getLists,
  getAllListsForWorkspace,
  getListById,
  createList,
  updateList,
  deleteList,
} from '../server/api/pm/lists.js';
import {
  getTasks,
  getAllTasksForWorkspace,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  uploadTaskAttachment,
  getTaskAttachments,
  deleteTaskAttachment,
} from '../server/api/pm/tasks.js';
import { getHierarchy, getFolderHierarchy } from '../server/api/pm/hierarchy.js';
import { createDocument, getDocuments, uploadAttachment, getAttachments } from '../server/api/pm/documents.js';
import { createReminder, getReminders, getPendingReminders, markReminderAsSent } from '../server/api/pm/reminders.js';
import {
  getCampaignLibrary,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  copyCampaign,
  uploadCreative,
} from '../server/api/campaigns/library.js';
import {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  runAgent,
  pauseAgent,
  resumeAgent,
  getAgentExecutions,
  getExecutionById,
} from '../server/api/ai/agents.js';
import {
  getInsights,
  getInsightById,
  updateInsightStatus,
  applyInsightAction,
  getInsightsStats,
  getAIDashboard,
} from '../server/api/ai/insights.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();

// Middleware
// app.use(helmet({ contentSecurityPolicy: false })); // Temporariamente desabilitado
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Debug middleware
app.use((req, res, next) => {
  console.log('🔍 Request:', req.method, req.url, 'Headers:', req.headers);
  next();
});

// Normalize Vercel /api prefix so Express routes are defined without /api
app.use((req, _res, next) => {
  if (req.url === '/api') {
    req.url = '/';
  } else if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  }
  next();
});

// Auth endpoints
app.post('/auth/login', login);
app.get('/auth/me', authMiddleware, me);
app.post('/auth/users', ...adminOnly, createUser);

// Credentials endpoints
app.post('/integrations/credentials', saveCredentials);
app.get('/integrations/credentials/:workspaceId/:platformKey', getCredentials);
app.delete('/integrations/credentials/:workspaceId/:platformKey', deleteCredentials);

// Sync endpoints
app.post('/integrations/sync', startSync);
app.post('/integrations/simple-sync', startSync);
app.post('/integrations/direct-sync', directInstagramSync);

// Optimized sync endpoints (new)
app.post('/integrations/meta/sync-optimized', optimizedMetaSync);
app.get('/integrations/meta/sync-status/:workspaceId', getMetaSyncStatus);

// Optimized Instagram sync endpoints
app.post('/integrations/instagram/sync-optimized', optimizedInstagramSync);
app.get('/integrations/instagram/sync-status/:workspaceId', getInstagramSyncStatus);

// Legacy sync status endpoints
app.get('/integrations/sync/:jobId', getSyncStatus);
app.get('/integrations/sync/workspace/:workspaceId', getWorkspaceSyncJobs);
app.post('/integrations/billing/sync', syncMetaBilling);

// AI endpoints
app.post('/ai/generate-creative', generateCreative);
app.post('/ai/virtual-tryon', virtualTryOn);
app.post('/ai/generate-look-caption', generateLookCaption);
app.put('/ai/caption/:creativeId', updateCreativeCaption);

// Creatives endpoints
app.get('/creatives/download-proxy', downloadProxy);
app.post('/creatives/save-tryon', saveTryOnCreatives);
app.get('/creatives/tryon-looks', getTryOnLooks);
app.delete('/creatives/tryon-looks/:id', deleteTryOnLook);

// GA4 Analytics endpoints
app.post('/ga4/realtime', ga4Realtime);
app.post('/ga4/report', ga4Report);
app.post('/ga4/google-ads', ga4GoogleAds);

// Finance: Cashflow import endpoint
app.post('/finance/cashflow/import', importCashflowXlsx);

// Instagram engagement endpoint
app.get('/instagram/engagement', getEngagementRate);

// Platform metrics endpoints
app.get('/metrics/aggregate', getAggregateMetrics);
app.get('/metrics/aggregate-by-objective', getAggregateMetricsByObjective);
app.get('/metrics/timeseries', getTimeSeriesMetrics);
app.get('/metrics/demographics', getDemographics);

// Campaign Library endpoints
app.get('/campaigns/library/:workspaceId', getCampaignLibrary);
app.get('/campaigns/library/item/:id', getCampaignById);
app.post('/campaigns/library', createCampaign);
app.put('/campaigns/library/:id', updateCampaign);
app.delete('/campaigns/library/:id', deleteCampaign);
app.post('/campaigns/library/:id/copy', copyCampaign);
app.post('/campaigns/library/upload', uploadCreative);

// AI Agents endpoints
app.get('/ai/agents', getAgents);
app.get('/ai/agents/:id', getAgentById);
app.post('/ai/agents', createAgent);
app.put('/ai/agents/:id', updateAgent);
app.delete('/ai/agents/:id', deleteAgent);
app.post('/ai/agents/:id/run', runAgent);
app.post('/ai/agents/:id/pause', pauseAgent);
app.post('/ai/agents/:id/resume', resumeAgent);
app.get('/ai/agents/:id/executions', getAgentExecutions);
app.get('/ai/executions/:id', getExecutionById);

// AI Insights endpoints
app.get('/ai/insights', getInsights);
app.get('/ai/insights/stats', getInsightsStats);
app.get('/ai/insights/:id', getInsightById);
app.put('/ai/insights/:id/status', updateInsightStatus);
app.post('/ai/insights/:id/action', applyInsightAction);
app.get('/ai/dashboard', getAIDashboard);

// AI Chat endpoints
app.use('/ai/chat', chatRouter);
app.use('/ai/conversations', conversationsRouter);

// Project Management endpoints
app.get('/pm/hierarchy/:workspaceId', getHierarchy);
app.get('/pm/hierarchy/:workspaceId/:folderId', getFolderHierarchy);
app.get('/pm/folders/:workspaceId', getFolders);
app.get('/pm/folders/:workspaceId/:folderId', getFolderById);
app.post('/pm/folders/:workspaceId', createFolder);
app.put('/pm/folders/:workspaceId/:folderId', updateFolder);
app.delete('/pm/folders/:workspaceId/:folderId', deleteFolder);
app.post('/pm/tasks/:taskId/attachments', uploadTaskAttachment);
app.get('/pm/tasks/:taskId/attachments', getTaskAttachments);
app.delete('/pm/tasks/:taskId/attachments/:attachmentId', deleteTaskAttachment);
app.get('/pm/lists/:workspaceId', getAllListsForWorkspace);
app.get('/pm/lists/:workspaceId/:folderId', getLists);
app.get('/pm/lists/:workspaceId/list/:listId', getListById);
app.post('/pm/lists/:workspaceId/:folderId', createList);
app.put('/pm/lists/:workspaceId/:listId', updateList);
app.delete('/pm/lists/:workspaceId/:listId', deleteList);
app.get('/pm/tasks/:workspaceId', getAllTasksForWorkspace);
app.get('/pm/tasks/:workspaceId/:listId', getTasks);
app.get('/pm/tasks/:workspaceId/:taskId/details', getTaskById);
app.post('/pm/tasks/:workspaceId/:listId', createTask);
app.put('/pm/tasks/:workspaceId/:taskId', updateTask);
app.delete('/pm/tasks/:workspaceId/:taskId', deleteTask);
app.post('/pm/documents/:workspaceId/:listId', createDocument);
app.get('/pm/documents/:workspaceId', getDocuments);
app.get('/pm/documents/:workspaceId/:listId', getDocuments);
app.post('/pm/documents/:documentId/attachments', uploadAttachment);
app.get('/pm/documents/:documentId/attachments', getAttachments);
app.get('/pm/reminders/pending', getPendingReminders);
app.get('/pm/reminders/:workspaceId', getReminders);
app.get('/pm/reminders/:workspaceId/:listId', getReminders);
app.post('/pm/reminders/:workspaceId/:listId', createReminder);
app.post('/pm/reminders/:reminderId/mark-sent', markReminderAsSent);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Database health check
app.get('/db-health', async (req, res) => {
  try {
    const { getPool } = await import('../server/config/database.js');
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as timestamp, version() as version');
    res.json({ 
      success: true, 
      database: 'connected',
      timestamp: result.rows[0]?.timestamp,
      version: result.rows[0]?.version?.substring(0, 50) + '...'
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Database connection failed' 
    });
  }
});

// Test credentials endpoint
app.get('/integrations/test-credentials/:workspaceId/:platformKey', async (req, res) => {
  try {
    const { workspaceId, platformKey } = req.params;
    const { getPool } = await import('../server/config/database.js');
    
    const pool = getPool();
    
    // Test database connection
    const dbTest = await pool.query('SELECT NOW() as timestamp');
    
    const result = await pool.query(
      `SELECT id, created_at, updated_at FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2`,
      [workspaceId, platformKey]
    );
    
    res.json({
      success: true,
      data: {
        exists: result.rows.length > 0,
        credentials: result.rows[0] || null,
        db_connected: true,
        db_timestamp: dbTest.rows[0]?.timestamp
      }
    });
  } catch (error) {
    console.error('Test credentials error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Export the Express app as a Vercel serverless function
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
