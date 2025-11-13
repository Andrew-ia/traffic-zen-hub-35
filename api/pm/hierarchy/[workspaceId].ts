import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { getHierarchy } from '../../../server/api/pm/hierarchy.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/:workspaceId', getHierarchy);

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
