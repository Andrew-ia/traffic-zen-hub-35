import { Express } from 'express';
import authRoutes from './auth.routes';
import integrationsRoutes from './integrations.routes';
import analyticsRoutes from './analytics.routes';
import campaignsRoutes from './campaigns.routes';
import creativesRoutes from './creatives.routes';
import aiRoutes from './ai.routes';
import pmRoutes from './pm.routes';
import productsRoutes from '../api/products';

export function registerRoutes(app: Express) {
    // Auth routes
    app.use('/api/auth', authRoutes);

    // Integration routes
    app.use('/api/integrations', integrationsRoutes);

    // Analytics routes
    app.use('/api/analytics', analyticsRoutes);

    // Campaign routes
    app.use('/api/campaigns', campaignsRoutes);

    // Creative routes
    app.use('/api/creatives', creativesRoutes);

    // AI routes
    app.use('/api/ai', aiRoutes);

    // Project Management routes
    app.use('/api/pm', pmRoutes);

    // Products routes
    app.use('/api/products', productsRoutes);
}
