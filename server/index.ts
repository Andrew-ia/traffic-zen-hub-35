import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { startSimpleWorker } from './workers/simpleSyncWorker.js';
import { startFullAnalyticsScheduler } from './workers/fullAnalyticsScheduler.js';
import { startMLNotificationsReplayWorker } from './workers/mlNotificationsReplay.js';
import { runInstagramSync } from '../supabase/functions/_shared/instagramSync.js';
import { decryptCredentials, encryptCredentials } from './services/encryption.js';
import { getPool } from './config/database.js';
import {
  saveCredentials,
  getCredentials,
  deleteCredentials,
} from './api/integrations/credentials.js';
import {
  startSync,
  getSyncStatus,
  getWorkspaceSyncJobs,
} from './api/integrations/simpleSync.js';
import { directInstagramSync } from './api/integrations/directSync.js';
import { optimizedMetaSync, getMetaSyncStatus } from './api/integrations/optimizedMetaSync.js';
import { createMetaCampaign, mirrorCreativeAsset } from './api/integrations/meta/create-campaign.js';
import { getMetaCustomAudiences, getMetaPageInfo } from './api/integrations/meta/stubs.js';
import { optimizedInstagramSync, getInstagramSyncStatus } from './api/integrations/optimizedInstagramSync.js';
import { simpleInstagramSync } from './api/integrations/simpleInstagramSync.js';
import { syncMetaBilling } from './api/integrations/billing.js';
import { initiateGoogleAdsAuth } from './api/integrations/google-ads/auth.js';
import { handleGoogleAdsCallback } from './api/integrations/google-ads/callback.js';
import { generateCreative } from './api/ai/generate-creative.js';
import { analyzeCreative } from './api/ai/analyze-creative.js';
import { virtualTryOn } from './api/ai/virtual-tryon.js';
import { generateLookCaption, updateCreativeCaption } from './api/ai/generate-look-caption.js';
import { generateMLDescription } from './api/ai/ml-description.js';
import { downloadProxy } from './api/creatives/download-proxy.js';
import aiAnalysisHandler from './api/integrations/ai-analysis.js';
import { google } from 'googleapis';
import { saveTryOnCreatives } from './api/creatives/save-tryon.js';
import { getTryOnLooks, deleteTryOnLook } from './api/creatives/get-tryon-looks.js';
import { ga4Realtime, ga4Report, ga4GoogleAds } from './api/analytics/ga4.js';
import { getAggregateMetrics, getTimeSeriesMetrics, getAggregateMetricsByObjective } from './api/analytics/metrics.js';
import { getDemographics } from './api/analytics/demographics.js';
import { getCreativePerformance } from './api/analytics/creative-performance.js';
import { syncGoogleAdsData } from './api/google-ads/sync.js';
import { listMetaPages } from './api/integrations/meta/list-pages.js';

import {
  getCampaignLibrary,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  copyCampaign,
  uploadCreative,
} from './api/campaigns/library.js';
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
} from './api/ai/agents.js';
import {
  getInsights,
  getInsightById,
  updateInsightStatus,
  applyInsightAction,
  getInsightsStats,
  getAIDashboard,
} from './api/ai/insights.js';
import chatRouter from './api/ai/chat.js';
import conversationsRouter from './api/ai/conversations.js';
import debugRouter from './api/debug.js';
import { importCashflowXlsx } from './api/finance/cashflow.js';
import { getEngagementRate } from './api/instagram/engagement.js';
import { login, me, createUser, authMiddleware, adminOnly, getPagePermissions, setPagePermissions } from './api/auth.js';
import {
  getFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
} from './api/pm/folders.js';
import {
  getLists,
  getAllListsForWorkspace,
  getListById,
  createList,
  updateList,
  deleteList,
} from './api/pm/lists.js';
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
} from './api/pm/tasks.js';
import {
  getHierarchy,
  getFolderHierarchy,
} from './api/pm/hierarchy.js';
import {
  createDocument,
  getDocuments,
  uploadAttachment,
  getAttachments,
} from './api/pm/documents.js';
import {
  createReminder,
  getReminders,
  getPendingReminders,
  markReminderAsSent,
} from './api/pm/reminders.js';
import {
  getUnreadNotifications,
  markAsRead,
  createNotificationHandler,
} from './api/notifications.js';
import {
  getUserPreferences,
  updateUserPreferences,
} from './api/user-preferences.js';
import workspacesRouter from './api/workspaces.js';

// Load environment variables
dotenv.config({ path: '.env.local' });
process.env.TZ = process.env.SERVER_TIMEZONE || process.env.TZ || 'America/Sao_Paulo';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowedOrigins = new Set<string>();
const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
if (frontendUrl) allowedOrigins.add(frontendUrl);
const extraOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
for (const o of extraOrigins) allowedOrigins.add(o);
if (!isProd) {
  allowedOrigins.add('http://localhost:8080');
  allowedOrigins.add('http://localhost:8081');
  allowedOrigins.add('http://localhost:8082');
  allowedOrigins.add('http://localhost:8083');
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.vercel.app')) return true;
  } catch { return false; }
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin || undefined)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// Increase JSON body limit to handle base64-encoded uploads
app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/workspaces', workspacesRouter);

// API Routes

// Auth endpoints (simple internal use)
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
app.post('/api/integrations/simple-sync', startSync); // Alias for Instagram compatibility
app.post('/api/integrations/direct-sync', directInstagramSync); // Direct sync for serverless

// Optimized sync endpoints (new)
app.post('/api/integrations/meta/sync-optimized', optimizedMetaSync);
app.post('/api/integrations/meta/create-campaign', createMetaCampaign);
app.post('/api/integrations/ai-analysis', aiAnalysisHandler);
app.get('/api/integrations/meta/sync-status/:workspaceId', getMetaSyncStatus);
app.get('/api/integrations/meta/custom-audiences/:workspaceId', getMetaCustomAudiences);
app.get('/api/integrations/meta/page-info/:workspaceId', getMetaPageInfo);
app.get('/api/integrations/meta/pages/:workspaceId', listMetaPages);
app.post('/api/creatives/mirror/:workspaceId/:assetId', mirrorCreativeAsset);
app.get('/api/integrations/google-ads/auth', initiateGoogleAdsAuth);
app.get('/api/integrations/google-ads/callback', handleGoogleAdsCallback);

app.get('/api/drive/list/:folderId', async (req, res) => {
  try {
    const folderId = String(req.params.folderId || '').trim();
    if (!folderId) return res.status(400).json({ success: false, error: 'folderId required' });
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    const drive = google.drive({ version: 'v3', auth });
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,thumbnailLink,webViewLink)',
      pageSize: 200,
    });
    const files = (resp.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      thumbnailLink: f.thumbnailLink,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    }));
    return res.json({ success: true, files });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to list drive folder' });
  }
});

// Instagram sync endpoints
app.post('/api/integrations/instagram/sync-optimized', optimizedInstagramSync);
app.post('/api/integrations/instagram/sync-simple', simpleInstagramSync);
app.get('/api/integrations/instagram/sync-status/:workspaceId', getInstagramSyncStatus);

// Legacy sync status endpoints
app.get('/api/integrations/sync/:jobId', getSyncStatus);
app.get('/api/integrations/sync/workspace/:workspaceId', getWorkspaceSyncJobs);
app.post('/api/integrations/billing/sync', syncMetaBilling);


// Immediate Instagram media+user sync (bypasses queue)
app.post('/api/integrations/instagram/run-direct', async (req, res) => {
  try {
    const { workspaceId, days = 7 } = req.body || {};
    const normalizedWorkspaceId = String(workspaceId || process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    if (!normalizedWorkspaceId) return res.status(400).json({ success: false, error: 'Missing workspaceId' });

    const pool = getPool();
    const credRow = await pool.query(
      `SELECT encrypted_credentials, encryption_iv FROM integration_credentials WHERE workspace_id = $1 AND platform_key = 'instagram' LIMIT 1`,
      [normalizedWorkspaceId]
    );
    if (credRow.rows.length === 0) return res.status(404).json({ success: false, error: 'Instagram credentials not found' });
    const creds = decryptCredentials(credRow.rows[0].encrypted_credentials, credRow.rows[0].encryption_iv);
    const igUserId = creds.igUserId || creds.ig_user_id;
    const accessToken = creds.accessToken || creds.access_token;
    if (!igUserId || !accessToken) return res.status(400).json({ success: false, error: 'Invalid Instagram credentials' });

    const ctx = {
      db: { query: (text: string, params?: any[]) => pool.query(text, params) },
      reportProgress: () => { },
    };
    const result = await runInstagramSync({ igUserId, accessToken, workspaceId: normalizedWorkspaceId, days }, ctx as any);
    return res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(/403/.test(String(msg)) ? 403 : 500).json({ success: false, error: msg });
  }
});

// AI endpoints
app.post('/api/ai/generate-creative', generateCreative);
app.post('/api/ai/analyze-creative', analyzeCreative);
app.post('/api/ai/virtual-tryon', virtualTryOn);
app.post('/api/ai/generate-look-caption', generateLookCaption);
app.post('/api/ai/ml-description-suggest', generateMLDescription);
app.put('/api/ai/caption/:creativeId', updateCreativeCaption);

// Creatives endpoints
app.get('/api/creatives/download-proxy', downloadProxy);
app.post('/api/creatives/save-tryon', saveTryOnCreatives);
app.get('/api/creatives/tryon-looks', getTryOnLooks);
app.delete('/api/creatives/tryon-looks/:id', deleteTryOnLook);

// GA4 Analytics endpoints (read-only via service account)
app.post('/api/ga4/realtime', ga4Realtime);
app.post('/api/ga4/report', ga4Report);
app.post('/api/ga4/google-ads', ga4GoogleAds);

// Google Ads API endpoints (direct sync)
app.post('/api/google-ads/sync', syncGoogleAdsData);

app.get('/api/cron/daily-sync', async (req, res) => {
  try {
    const workspaceId = String(req.query.workspaceId || process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    const days = Number(req.query.days ?? 2);
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Missing workspaceId' });

    const pool = getPool();
    let haveMetaCreds = false;
    try {
      const current = await pool.query(
        `SELECT encrypted_credentials, encryption_iv FROM integration_credentials WHERE workspace_id = $1 AND platform_key = 'meta' LIMIT 1`,
        [workspaceId]
      );
      if (current.rows.length > 0) {
        const c = decryptCredentials(current.rows[0].encrypted_credentials, current.rows[0].encryption_iv) as any;
        haveMetaCreds = !!(c?.access_token && (c?.ad_account_id || c?.adAccountId));
      }
    } catch (e) { void e; }

    if (!haveMetaCreds) {
      const envToken = String(process.env.META_ACCESS_TOKEN || '').trim();
      const envAdAccount = String(process.env.META_AD_ACCOUNT_ID || '').trim();
      if (envToken && envAdAccount) {
        const enc = encryptCredentials({ access_token: envToken, ad_account_id: envAdAccount, accessToken: envToken, adAccountId: envAdAccount });
        await pool.query(
          `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
           VALUES ($1, 'meta', $2, $3)
           ON CONFLICT (workspace_id, platform_key)
           DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials, encryption_iv = EXCLUDED.encryption_iv, updated_at = now()`,
          [workspaceId, enc.encrypted_credentials, enc.encryption_iv]
        );
      }
    }

    const invoke = (handler: any, body: any) => new Promise((resolve) => {
      const reqLike = { body, query: {}, headers: {}, get: () => '', protocol: req.protocol, method: 'POST' } as any;
      const resLike = {
        status: (code: number) => ({ json: (payload: any) => resolve({ ok: code < 400, code, payload }) }),
        json: (payload: any) => resolve({ ok: true, code: 200, payload })
      } as any;
      handler(reqLike, resLike);
    });

    const meta = await invoke(optimizedMetaSync, { workspaceId, days, type: 'all' });
    const google = await invoke(syncGoogleAdsData, { workspaceId, days });

    return res.json({ success: true, data: { meta, google } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to run daily sync' });
  }
});

// Debug route to verify GA4 namespace is reachable
app.post('/api/ga4/test', (req, res) => {
  res.json({ success: true, message: 'GA4 test endpoint' });
});

// Finance: Cashflow import endpoint
app.post('/api/finance/cashflow/import', importCashflowXlsx);

// Instagram engagement rate
app.get('/api/instagram/engagement', getEngagementRate);

// Platform metrics endpoints used by dashboards
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
app.use('/api/debug', debugRouter);

// Products endpoints
import productsRouter from './api/products.js';
app.use('/api/products', productsRouter);

// Mercado Livre endpoints
import mercadoLivreRouter, { bootstrapMercadoLivreEnvCredentials } from './api/integrations/mercadolivre.js';
app.use('/api/integrations/mercadolivre', mercadoLivreRouter);

// Mercado Livre Fulfillment endpoints
import mercadoLivreFulfillmentRouter from './api/integrations/mercadolivre-fulfillment.js';
app.use('/api/integrations/mercadolivre-fulfillment', mercadoLivreFulfillmentRouter);

// Mercado Livre Full Analytics endpoints
import mercadoLivreFullAnalyticsRouter from './api/integrations/mercadolivre-full-analytics.js';
app.use('/api/integrations/mercadolivre-full-analytics', mercadoLivreFullAnalyticsRouter);

// Tray endpoints
import trayRouter from './api/integrations/tray.js';
app.use('/api/integrations/tray', trayRouter);

// Notification Settings endpoints
import notificationSettingsRouter from './api/notification-settings.js';
app.use('/api/notification-settings', notificationSettingsRouter);

// Upload endpoints
import uploadRouter from './api/upload.js';
app.use('/api/upload', uploadRouter);

// Sync endpoints
import syncRouter from './api/sync.js';
app.use('/api/sync', syncRouter);

// Project Management endpoints
// Hierarchy
app.get('/api/pm/hierarchy/:workspaceId', getHierarchy);
app.get('/api/pm/hierarchy/:workspaceId/:folderId', getFolderHierarchy);

// Folders
app.get('/api/pm/folders/:workspaceId', getFolders);
app.get('/api/pm/folders/:workspaceId/:folderId', getFolderById);
app.post('/api/pm/folders/:workspaceId', createFolder);
app.put('/api/pm/folders/:workspaceId/:folderId', updateFolder);
app.delete('/api/pm/folders/:workspaceId/:folderId', deleteFolder);

// Task attachments (place BEFORE generic tasks routes to avoid route conflicts)
app.post('/api/pm/tasks/:taskId/attachments', uploadTaskAttachment);
app.get('/api/pm/tasks/:taskId/attachments', getTaskAttachments);
app.delete('/api/pm/tasks/:taskId/attachments/:attachmentId', deleteTaskAttachment);

// Lists
app.get('/api/pm/lists/:workspaceId', getAllListsForWorkspace);
app.get('/api/pm/lists/:workspaceId/:folderId', getLists);
app.get('/api/pm/lists/:workspaceId/list/:listId', getListById);
app.post('/api/pm/lists/:workspaceId/:folderId', createList);
app.put('/api/pm/lists/:workspaceId/:listId', updateList);
app.delete('/api/pm/lists/:workspaceId/:listId', deleteList);

// Tasks
app.get('/api/pm/tasks/:workspaceId', getAllTasksForWorkspace);
app.get('/api/pm/tasks/:workspaceId/:listId', getTasks);
app.get('/api/pm/tasks/:workspaceId/:taskId/details', getTaskById);
app.post('/api/pm/tasks/:workspaceId/:listId', createTask);
app.put('/api/pm/tasks/:workspaceId/:taskId', updateTask);
app.delete('/api/pm/tasks/:workspaceId/:taskId', deleteTask);
app.post('/api/pm/tasks/:taskId/attachments', uploadTaskAttachment);
app.get('/api/pm/tasks/:taskId/attachments', getTaskAttachments);

// Documents
app.get('/api/pm/documents/:workspaceId', getDocuments);
app.get('/api/pm/documents/:workspaceId/:listId', getDocuments);
app.post('/api/pm/documents/:workspaceId/:listId', createDocument);
app.post('/api/pm/documents/:documentId/attachments', uploadAttachment);
app.get('/api/pm/documents/:documentId/attachments', getAttachments);

// Reminders
app.get('/api/pm/reminders/pending', getPendingReminders);
app.get('/api/pm/reminders/:workspaceId', getReminders);
app.get('/api/pm/reminders/:workspaceId/:listId', getReminders);
app.post('/api/pm/reminders/:workspaceId/:listId', createReminder);
app.post('/api/pm/reminders/:reminderId/mark-sent', markReminderAsSent);

// Notifications
app.get('/api/notifications/:userId', getUnreadNotifications);
app.put('/api/notifications/:id/read', markAsRead);
app.post('/api/notifications', createNotificationHandler);

// User preferences routes
app.get('/api/user-preferences/:userId', getUserPreferences);
app.put('/api/user-preferences/:userId', updateUserPreferences);

// Serve frontend build (SPA) from /dist when deployed online
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
// Serve landing page explicitly
app.get('/landing', (req, res) => {
  res.sendFile(path.join(distPath, 'landing.html'));
});

app.get('/obrigado', (req, res) => {
  res.sendFile(path.join(distPath, 'obrigado.html'));
});

// SPA fallback: send index.html for non-API routes
app.get(/^\/(?!api\/).*$/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Start server and worker
let workerIntervalId: NodeJS.Timeout | null = null;
let stopMLReplayWorker: (() => void) | null = null;

async function start() {
  try {
    // Validate required environment variables
    const required = [
      'SUPABASE_DATABASE_URL',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Ensure at least one admin user exists
    await ensureAdminUser();

    // Bootstrap credenciais do Mercado Livre a partir das envs (caso ainda não estejam no banco)
    try {
      const mlWorkspaceId = process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
      const applied = await bootstrapMercadoLivreEnvCredentials(mlWorkspaceId);
      if (applied) {
        console.log(`🔑 Credenciais MercadoLivre salvas no banco para workspace ${mlWorkspaceId} (via env)`);
      }
    } catch (e) {
      console.warn('⚠️  Falha ao aplicar credenciais do MercadoLivre a partir das envs:', e);
    }

    workerIntervalId = null;

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 TrafficPro API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on: http://localhost:${PORT}`);

      // Worker local desabilitado - usa Supabase Edge Functions para sincronização
      console.log(`🔧 Worker local desabilitado: usando Supabase Edge Functions`);
      console.log(`   → Sincronização via Edge Functions e API endpoints diretos`);
      console.log(`   → Evita problemas de conexão desnecessários`);
      workerIntervalId = null;
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // Worker de replay de notificações ML (opcional)
      if (String(process.env.ML_NOTIFICATIONS_REPLAY_ENABLED || '').toLowerCase() === 'true') {
        const apiBase =
          process.env.API_INTERNAL_URL ||
          process.env.API_URL ||
          `http://localhost:${PORT}`;
        const workspaceId =
          process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID ||
          process.env.WORKSPACE_ID ||
          process.env.VITE_WORKSPACE_ID ||
          '00000000-0000-0000-0000-000000000010';

        stopMLReplayWorker = startMLNotificationsReplayWorker({
          workspaceId,
          apiBaseUrl: apiBase,
          intervalMinutes: Number(process.env.ML_NOTIFICATIONS_REPLAY_INTERVAL_MINUTES || 60),
          days: Number(process.env.ML_NOTIFICATIONS_REPLAY_DAYS || 2),
          maxOrders: Number(process.env.ML_NOTIFICATIONS_REPLAY_MAX_ORDERS || 200),
          dryRun: String(process.env.ML_NOTIFICATIONS_REPLAY_DRY_RUN || '').toLowerCase() === 'true',
        });
      } else {
        console.log('ℹ️  ML replay worker desabilitado (ML_NOTIFICATIONS_REPLAY_ENABLED != true)');
      }

      // Start Full Analytics Scheduler
      startFullAnalyticsScheduler();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Ensure an admin user exists with membership in the configured workspace.
 * Uses ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME env vars when provided,
 * otherwise falls back to a development-safe default.
 */
async function ensureAdminUser() {
  try {
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const emailEnv = process.env.ADMIN_EMAIL || '';
    const passwordEnv = process.env.ADMIN_PASSWORD || '';
    const fullName = process.env.ADMIN_NAME || 'Founder TrafficPro';
    const workspaceId = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';

    if (!emailEnv || !passwordEnv) {
      if (isProd) {
        console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin bootstrap in production');
        return;
      }
    }

    const pool = getPool();

    // Upsert user with bcrypt hash via pgcrypto's crypt()
    const userRes = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, auth_provider, status)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), 'password', 'active')
       ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             password_hash = crypt($3, gen_salt('bf')),
             status = 'active'
       RETURNING id`,
      [emailEnv || 'founder@trafficpro.dev', fullName, passwordEnv || 'admin123']
    );

    const userId = userRes.rows[0]?.id;
    if (!userId) return;

    // Ensure workspace membership exists
    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, invitation_status)
       VALUES ($1, $2, 'owner', 'accepted')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', invitation_status = 'accepted', updated_at = now()`,
      [workspaceId, userId]
    );

    console.log(`✅ Admin bootstrap ensured for ${emailEnv || 'founder@trafficpro.dev'} in workspace ${workspaceId}`);
  } catch (err) {
    console.error('Failed to ensure admin user', err);
  }
}

// Export express app for serverless platforms (e.g., Vercel)
export default app;

// Auto-start only in non-serverless environments
if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }
  if (stopMLReplayWorker) {
    stopMLReplayWorker();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }
  if (stopMLReplayWorker) {
    stopMLReplayWorker();
  }

  process.exit(0);
});

// In ambientes serverless (Vercel/Netlify/AWS Lambda), não iniciar servidor aqui.
// O app é exportado e a plataforma cuida de iniciar o handler.
