import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { startFullAnalyticsScheduler } from './workers/fullAnalyticsScheduler.js';
import { startMLNotificationsReplayWorker } from './workers/mlNotificationsReplay.js';
import { getPool } from './config/database.js';
import { login, me, createUser, authMiddleware, adminOnly, getPagePermissions, setPagePermissions } from './api/auth.js';
import workspacesRouter from './api/workspaces.js';
import aiAnalysisHandler from './api/integrations/ai-analysis.js';
import { virtualTryOn } from './api/ai/virtual-tryon.js';
import { generateLookCaption, updateCreativeCaption } from './api/ai/generate-look-caption.js';
import { saveTryOnCreatives } from './api/creatives/save-tryon.js';
import { getTryOnLooks, deleteTryOnLook } from './api/creatives/get-tryon-looks.js';
import productsRouter from './api/products.js';
import mercadoLivreRouter, { bootstrapMercadoLivreEnvCredentials } from './api/integrations/mercadolivre.js';
import mercadoLivreFulfillmentRouter from './api/integrations/mercadolivre-fulfillment.js';
import mercadoLivreFullAnalyticsRouter from './api/integrations/mercadolivre-full-analytics.js';
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

// Auth endpoints
app.post('/api/auth/login', login);
app.get('/api/auth/me', authMiddleware, me);
app.post('/api/auth/users', ...adminOnly, createUser);
app.get('/api/auth/page-permissions/:userId', authMiddleware, getPagePermissions);
app.post('/api/auth/page-permissions/:userId', ...adminOnly, setPagePermissions);

// Mercado Livre + IA
app.post('/api/integrations/ai-analysis', aiAnalysisHandler);
app.post('/api/ai/virtual-tryon', virtualTryOn);
app.post('/api/ai/generate-look-caption', generateLookCaption);
app.put('/api/ai/caption/:creativeId', updateCreativeCaption);

// Creatives (Virtual Try-On)
app.post('/api/creatives/save-tryon', saveTryOnCreatives);
app.get('/api/creatives/tryon-looks', getTryOnLooks);
app.delete('/api/creatives/tryon-looks/:id', deleteTryOnLook);

// Products
app.use('/api/products', productsRouter);

// Mercado Livre endpoints
app.use('/api/integrations/mercadolivre', mercadoLivreRouter);
app.use('/api/integrations/mercadolivre-fulfillment', mercadoLivreFulfillmentRouter);
app.use('/api/integrations/mercadolivre-full-analytics', mercadoLivreFullAnalyticsRouter);

// Project Management endpoints
app.get('/api/pm/hierarchy/:workspaceId', getHierarchy);
app.get('/api/pm/hierarchy/:workspaceId/:folderId', getFolderHierarchy);

app.get('/api/pm/folders/:workspaceId', getFolders);
app.get('/api/pm/folders/:workspaceId/:folderId', getFolderById);
app.post('/api/pm/folders/:workspaceId', createFolder);
app.put('/api/pm/folders/:workspaceId/:folderId', updateFolder);
app.delete('/api/pm/folders/:workspaceId/:folderId', deleteFolder);

// Task attachments (place BEFORE generic tasks routes to avoid route conflicts)
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

app.get('/api/pm/documents/:workspaceId', getDocuments);
app.get('/api/pm/documents/:workspaceId/:listId', getDocuments);
app.post('/api/pm/documents/:workspaceId/:listId', createDocument);
app.post('/api/pm/documents/:documentId/attachments', uploadAttachment);
app.get('/api/pm/documents/:documentId/attachments', getAttachments);

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

let stopMLReplayWorker: (() => void) | null = null;

async function start() {
  try {
    const required = [
      'SUPABASE_DATABASE_URL',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    await ensureAdminUser();

    try {
      const mlWorkspaceId = process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
      const applied = await bootstrapMercadoLivreEnvCredentials(mlWorkspaceId);
      if (applied) {
        console.log(`🔑 Credenciais MercadoLivre salvas no banco para workspace ${mlWorkspaceId} (via env)`);
      }
    } catch (e) {
      console.warn('⚠️  Falha ao aplicar credenciais do MercadoLivre a partir das envs:', e);
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 TrafficPro API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

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

export default app;

if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  if (stopMLReplayWorker) {
    stopMLReplayWorker();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  if (stopMLReplayWorker) {
    stopMLReplayWorker();
  }

  process.exit(0);
});
