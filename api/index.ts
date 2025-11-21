import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { login, me, createUser, authMiddleware, adminOnly, getPagePermissions, setPagePermissions } from '../server/api/auth.js';
import { saveCredentials, getCredentials, deleteCredentials } from '../server/api/integrations/credentials.js';
import { startSync, getSyncStatus, getWorkspaceSyncJobs } from '../server/api/integrations/simpleSync.js';
import { directInstagramSync } from '../server/api/integrations/directSync.js';
import { optimizedMetaSync, getMetaSyncStatus } from '../server/api/integrations/optimizedMetaSync.js';
import { optimizedInstagramSync, getInstagramSyncStatus } from '../server/api/integrations/optimizedInstagramSync.js';
import { simpleInstagramSync } from '../server/api/integrations/simpleInstagramSync.js';
import { syncMetaBilling } from '../server/api/integrations/billing.js';
import { syncGoogleAdsData } from '../server/api/google-ads/sync.js';
import { googleAdsAuth, googleAdsCallback, googleAdsTest } from '../server/api/integrations/googleAdsAuth.js';
import { handleGoogleAdsCallback } from '../server/api/integrations/google-ads/callback.js';
import { initiateGoogleAdsAuth } from '../server/api/integrations/google-ads/auth.js';
import { debugGoogleAdsAuth } from '../server/api/integrations/google-ads/debug.js';
import { checkGoogleAdsCredentials } from '../server/api/google-ads/check-credentials.js';
import { ga4Realtime, ga4Report, ga4GoogleAds } from '../server/api/analytics/ga4.js';
import { getAggregateMetrics, getTimeSeriesMetrics, getAggregateMetricsByObjective } from '../server/api/analytics/metrics.js';
import { getDemographics } from '../server/api/analytics/demographics.js';
import { getCreativePerformance } from '../server/api/analytics/creative-performance.js';
import { generateCreative } from '../server/api/ai/generate-creative.js';
import { analyzeCreative } from '../server/api/ai/analyze-creative.js';
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
import { createNotificationHandler, getUnreadNotifications, markAsRead } from '../server/api/notifications.js';
import { getUserPreferences, updateUserPreferences } from '../server/api/user-preferences.js';

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

// Normalize Vercel /api prefix: Ensure all routes start with /api
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Auth endpoints
app.post('/api/auth/login', login);
app.get('/api/auth/me', authMiddleware, me);
app.post('/api/auth/users', ...adminOnly, createUser);
app.get('/api/auth/page-permissions/:userId', authMiddleware, getPagePermissions);
app.post('/api/auth/page-permissions/:userId', ...adminOnly, setPagePermissions);

// Credentials endpoints
app.post('/api/integrations/credentials', saveCredentials);
app.get('/api/integrations/credentials/:workspaceId/:platformKey', getCredentials);
app.delete('/api/integrations/credentials/:workspaceId/:platformKey', deleteCredentials);

// Sync endpoints
app.post('/api/integrations/sync', startSync);
app.post('/api/integrations/simple-sync', startSync);
app.post('/api/integrations/direct-sync', directInstagramSync);

// Optimized sync endpoints (new)
app.post('/api/integrations/meta/sync-optimized', optimizedMetaSync);
app.get('/api/integrations/meta/sync-status/:workspaceId', getMetaSyncStatus);

// Instagram sync endpoints
app.post('/api/integrations/instagram/sync-optimized', optimizedInstagramSync);
app.post('/api/integrations/instagram/sync-simple', simpleInstagramSync);
app.get('/api/integrations/instagram/sync-status/:workspaceId', getInstagramSyncStatus);

// Legacy sync status endpoints
app.get('/api/integrations/sync/:jobId', getSyncStatus);
app.get('/api/integrations/sync/workspace/:workspaceId', getWorkspaceSyncJobs);
app.post('/api/integrations/billing/sync', syncMetaBilling);

// AI endpoints
app.post('/api/ai/generate-creative', generateCreative);
app.post('/api/ai/analyze-creative', analyzeCreative);
app.post('/api/ai/virtual-tryon', virtualTryOn);
app.post('/api/ai/generate-look-caption', generateLookCaption);
app.put('/api/ai/caption/:creativeId', updateCreativeCaption);

// Creatives endpoints
app.get('/api/creatives/download-proxy', downloadProxy);
app.post('/api/creatives/save-tryon', saveTryOnCreatives);
app.get('/api/creatives/tryon-looks', getTryOnLooks);
app.delete('/api/creatives/tryon-looks/:id', deleteTryOnLook);

// GA4 Analytics endpoints
app.post('/api/ga4/realtime', ga4Realtime);
app.post('/api/ga4/report', ga4Report);
app.post('/api/ga4/google-ads', ga4GoogleAds);

// Google Ads API endpoints
app.post('/api/google-ads/sync', syncGoogleAdsData);

// Google Ads OAuth endpoints
app.get('/api/integrations/google-ads/auth', initiateGoogleAdsAuth);
app.get('/api/integrations/google-ads/callback', handleGoogleAdsCallback);
app.get('/api/integrations/google-ads/test', googleAdsTest);
app.get('/api/integrations/google-ads/debug', debugGoogleAdsAuth);
app.get('/api/google-ads/check-credentials', checkGoogleAdsCredentials);


// Finance: Cashflow import endpoint
app.post('/api/finance/cashflow/import', importCashflowXlsx);

// Instagram engagement endpoint
app.get('/api/instagram/engagement', getEngagementRate);

// Platform metrics endpoints
app.get('/api/metrics/aggregate', getAggregateMetrics);
app.get('/api/metrics/aggregate-by-objective', getAggregateMetricsByObjective);
app.get('/api/metrics/timeseries', getTimeSeriesMetrics);
app.get('/api/metrics/demographics', getDemographics);
app.get('/api/analytics/creative-performance', getCreativePerformance);

// Campaign Library endpoints
app.get('/api/campaigns/library/:workspaceId', getCampaignLibrary);
app.get('/api/campaigns/library/item/:id', getCampaignById);
app.post('/api/campaigns/library', createCampaign);
app.put('/api/campaigns/library/:id', updateCampaign);
app.delete('/api/campaigns/library/:id', deleteCampaign);
app.post('/api/campaigns/library/:id/copy', copyCampaign);
app.post('/api/campaigns/library/upload', uploadCreative);

// AI Agents endpoints
app.get('/api/ai/agents', getAgents);
app.get('/api/ai/agents/:id', getAgentById);
app.post('/api/ai/agents', createAgent);
app.put('/api/ai/agents/:id', updateAgent);
app.delete('/api/ai/agents/:id', deleteAgent);
app.post('/api/ai/agents/:id/run', runAgent);
app.post('/api/ai/agents/:id/pause', pauseAgent);
app.post('/api/ai/agents/:id/resume', resumeAgent);
app.get('/api/ai/agents/:id/executions', getAgentExecutions);
app.get('/api/ai/executions/:id', getExecutionById);

// AI Insights endpoints
app.get('/api/ai/insights', getInsights);
app.get('/api/ai/insights/stats', getInsightsStats);
app.get('/api/ai/insights/:id', getInsightById);
app.put('/api/ai/insights/:id/status', updateInsightStatus);
app.post('/api/ai/insights/:id/action', applyInsightAction);
app.get('/api/ai/dashboard', getAIDashboard);

// AI Chat endpoints
app.use('/api/ai/chat', chatRouter);
app.use('/api/ai/conversations', conversationsRouter);

// Project Management endpoints
app.get('/api/pm/hierarchy/:workspaceId', getHierarchy);
app.get('/api/pm/hierarchy/:workspaceId/:folderId', getFolderHierarchy);
app.get('/api/pm/folders/:workspaceId', getFolders);
app.get('/api/pm/folders/:workspaceId/:folderId', getFolderById);
app.post('/api/pm/folders/:workspaceId', createFolder);
app.put('/api/pm/folders/:workspaceId/:folderId', updateFolder);
app.delete('/api/pm/folders/:workspaceId/:folderId', deleteFolder);
app.post('/api/pm/tasks/:taskId/attachments', uploadTaskAttachment);
app.get('/api/pm/tasks/:taskId/attachments', getTaskAttachments);
app.delete('/api/pm/tasks/:taskId/attachments/:attachmentId', deleteTaskAttachment);
app.get('/api/pm/lists/:workspaceId', getAllListsForWorkspace);
app.get('/api/pm/lists/:workspaceId/:folderId', getLists);
app.get('/api/pm/lists/:workspaceId/list/:listId', getListById);
app.post('/api/pm/lists/:workspaceId/:folderId', createList);
app.put('/api/pm/lists/:workspaceId/:listId', updateList);
app.delete('/api/pm/lists/:workspaceId/:listId', deleteList);
app.get('/api/pm/tasks/:workspaceId', getAllTasksForWorkspace);
app.get('/api/pm/tasks/:workspaceId/:listId', getTasks);
app.get('/api/pm/tasks/:workspaceId/:taskId/details', getTaskById);
app.post('/api/pm/tasks/:workspaceId/:listId', createTask);
app.put('/api/pm/tasks/:workspaceId/:taskId', updateTask);
app.delete('/api/pm/tasks/:workspaceId/:taskId', deleteTask);
app.post('/api/pm/documents/:workspaceId/:listId', createDocument);
app.get('/api/pm/documents/:workspaceId', getDocuments);
app.get('/api/pm/documents/:workspaceId/:listId', getDocuments);
app.post('/api/pm/documents/:documentId/attachments', uploadAttachment);
app.get('/api/pm/documents/:documentId/attachments', getAttachments);
app.get('/api/pm/reminders/pending', getPendingReminders);
app.get('/api/pm/reminders/:workspaceId', getReminders);
app.get('/api/pm/reminders/:workspaceId/:listId', getReminders);
app.post('/api/pm/reminders/:workspaceId/:listId', createReminder);
app.post('/api/pm/reminders/:reminderId/mark-sent', markReminderAsSent);

// Health check
app.get('/api/health', (req, res) => {
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

// Notification routes
app.get('/api/notifications/:userId', getUnreadNotifications);
app.put('/api/notifications/:id/read', markAsRead);
app.post('/api/notifications', createNotificationHandler);

// User preferences routes
app.get('/api/user-preferences/:userId', getUserPreferences);
app.put('/api/user-preferences/:userId', updateUserPreferences);

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({
    success: false,
    error: 'Not found',
    debug: {
      url: req.url,
      path: req.path,
      method: req.method,
      headers: req.headers
    }
  });
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
