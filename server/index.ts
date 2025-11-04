import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { startSimpleWorker } from './workers/simpleSyncWorker.js';
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
import { syncMetaBilling } from './api/integrations/billing.js';
import { generateCreative } from './api/ai/generate-creative.js';
import { virtualTryOn } from './api/ai/virtual-tryon.js';
import { downloadProxy } from './api/creatives/download-proxy.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:8081'
  ],
  credentials: true,
}));
// Increase JSON body limit to handle base64-encoded images from virtual try-on uploads
app.use(express.json({ limit: '15mb' }));

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

// Credentials endpoints
app.post('/api/integrations/credentials', saveCredentials);
app.get('/api/integrations/credentials/:workspaceId/:platformKey', getCredentials);
app.delete('/api/integrations/credentials/:workspaceId/:platformKey', deleteCredentials);

// Sync endpoints
app.post('/api/integrations/sync', startSync);
app.get('/api/integrations/sync/:jobId', getSyncStatus);
app.get('/api/integrations/sync/workspace/:workspaceId', getWorkspaceSyncJobs);
app.post('/api/integrations/billing/sync', syncMetaBilling);

// AI endpoints
app.post('/api/ai/generate-creative', generateCreative);
app.post('/api/ai/virtual-tryon', virtualTryOn);

// Creatives endpoints
app.get('/api/creatives/download-proxy', downloadProxy);

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

    // Start the simple worker (no Redis required!)
    workerIntervalId = startSimpleWorker();

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 TrafficPro API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🔧 Worker active: PostgreSQL Polling (no Redis needed!)`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
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
