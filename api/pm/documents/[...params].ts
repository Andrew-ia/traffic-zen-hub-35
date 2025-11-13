import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { getDocuments } from '../../../server/api/pm/documents.js';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.get('/:workspaceId', getDocuments);
app.get('/:workspaceId/:listId', getDocuments);

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
