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
import { generateLookCaption, updateCreativeCaption } from './api/ai/generate-look-caption.js';
import { downloadProxy } from './api/creatives/download-proxy.js';
import { saveTryOnCreatives } from './api/creatives/save-tryon.js';
import { getTryOnLooks, deleteTryOnLook } from './api/creatives/get-tryon-looks.js';
import { ga4Realtime, ga4Report, ga4GoogleAds } from './api/analytics/ga4.ts';
import { getAggregateMetrics, getTimeSeriesMetrics, getAggregateMetricsByObjective } from './api/analytics/metrics.ts';
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

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083'
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
app.post('/api/integrations/simple-sync', startSync); // Alias for Instagram compatibility
app.get('/api/integrations/sync/:jobId', getSyncStatus);
app.get('/api/integrations/sync/workspace/:workspaceId', getWorkspaceSyncJobs);
app.post('/api/integrations/billing/sync', syncMetaBilling);

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
