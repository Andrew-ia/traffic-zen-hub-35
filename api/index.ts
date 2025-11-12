import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { login, me, createUser, authMiddleware, adminOnly } from '../server/api/auth.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Auth endpoints (note: /api prefix is already handled by Vercel routing)
app.post('/auth/login', login);
app.get('/auth/me', authMiddleware, me);
app.post('/auth/users', ...adminOnly, createUser);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export the Express app as a Vercel serverless function
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
