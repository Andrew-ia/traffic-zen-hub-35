import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { startSimpleWorker } from './workers/simpleSyncWorker.js';
import { runInstagramSync } from '../supabase/functions/_shared/instagramSync.js';
import { decryptCredentials } from './services/encryption.js';
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
import { optimizedInstagramSync, getInstagramSyncStatus } from './api/integrations/optimizedInstagramSync.js';
import { simpleInstagramSync } from './api/integrations/simpleInstagramSync.js';
import { syncMetaBilling } from './api/integrations/billing.js';
import { generateCreative } from './api/ai/generate-creative.js';
import { virtualTryOn } from './api/ai/virtual-tryon.js';
import { generateLookCaption, updateCreativeCaption } from './api/ai/generate-look-caption.js';
import { downloadProxy } from './api/creatives/download-proxy.js';
import { saveTryOnCreatives } from './api/creatives/save-tryon.js';
import { getTryOnLooks, deleteTryOnLook } from './api/creatives/get-tryon-looks.js';
import { ga4Realtime, ga4Report, ga4GoogleAds } from './api/analytics/ga4.js';
import { getAggregateMetrics, getTimeSeriesMetrics, getAggregateMetricsByObjective } from './api/analytics/metrics.js';
import { getDemographics } from './api/analytics/demographics.js';
 
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
import { importCashflowXlsx } from './api/finance/cashflow.js';
import { getEngagementRate } from './api/instagram/engagement.js';
import { login, me, createUser, authMiddleware, adminOnly } from './api/auth.js';
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

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
]);

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

// API Routes

// Auth endpoints (simple internal use)
app.post('/api/auth/login', login);
app.get('/api/auth/me', authMiddleware, me);
app.post('/api/auth/users', ...adminOnly, createUser);

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
app.get('/api/integrations/meta/sync-status/:workspaceId', getMetaSyncStatus);

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
      reportProgress: () => {},
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
app.post('/api/ai/virtual-tryon', virtualTryOn);
app.post('/api/ai/generate-look-caption', generateLookCaption);
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

// Serve frontend build (SPA) from /dist when deployed online
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
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

    workerIntervalId = null;

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 TrafficPro API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      
      // Worker local apenas para desenvolvimento - não funciona no Vercel (serverless)
      if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
        try {
          const id = startSimpleWorker();
          // @ts-ignore
          workerIntervalId = id || null;
          console.log(`🔧 Worker local ativado: polling de jobs em background`);
          console.log(`   → Ambiente: desenvolvimento local`);
        } catch (error) {
          console.log(`🔧 Worker indisponível: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
          console.log(`   → Sincronização funcionará apenas sob demanda via API`);
        }
      } else {
        console.log(`🔧 Worker local desabilitado: ambiente serverless detectado`);
        console.log(`   → Plataforma: ${process.env.VERCEL ? 'Vercel' : process.env.NETLIFY ? 'Netlify' : 'AWS Lambda'}`);
        console.log(`   → Sincronização via API endpoints diretos`);
      }
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
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
    const email = process.env.ADMIN_EMAIL || 'founder@trafficpro.dev';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const fullName = process.env.ADMIN_NAME || 'Founder TrafficPro';
    const workspaceId = process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';

    if (!email || !password) {
      console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; using defaults for development.');
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
      [email, fullName, password]
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

    console.log(`✅ Admin bootstrap ensured for ${email} in workspace ${workspaceId}`);
  } catch (err) {
    console.error('Failed to ensure admin user', err);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }

  process.exit(0);
});

// Start the server
start();
