import { Request, Response } from 'express';
import { getPool } from '../../../config/database.js';
import { decryptCredentials } from '../../../services/encryption.js';
import type { ApiResponse } from '../../../types/index.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

export async function listMetaPages(req: Request, res: Response) {
    try {
        const workspaceId = req.params.workspaceId;

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                error: 'Missing workspaceId'
            } as ApiResponse);
        }

        const pool = getPool();
        const { rows } = await pool.query(
            `SELECT encrypted_credentials, encryption_iv 
             FROM integration_credentials 
             WHERE workspace_id = $1 AND platform_key = 'meta'`,
            [workspaceId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Meta Ads credentials not found'
            } as ApiResponse);
        }

        const credentials = await decryptCredentials(rows[0].encrypted_credentials, rows[0].encryption_iv);
        const accessToken = credentials.accessToken || credentials.access_token;

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Incomplete Meta Ads credentials'
            } as ApiResponse);
        }

        // Helper to fetch pages
        const fetchPages = async (url: string) => {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        };

        // 1. Try /me/accounts (Standard)
        let url = `${GRAPH_URL}/me/accounts?access_token=${accessToken}&fields=id,name,access_token,perms,picture&limit=100`;
        let data = await fetchPages(url);

        // 2. If empty or error, and we have a business ID, try business client pages
        // (This is a guess, but sometimes helpful for agencies)
        if ((!data.data || data.data.length === 0) && !data.error) {
            // We could check for business_management permission here, but let's just return what we have
            // or try to inspect the token to see if it's a system user without assets.
        }

        if (data.error) {
            console.error('Meta API Error (list-pages):', data.error);
            return res.status(400).json({
                success: false,
                error: `Meta API Error: ${data.error.message}`,
                details: data.error
            } as ApiResponse);
        }

        const pages = (data.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            picture: p.picture?.data?.url,
            can_advertise: p.perms?.includes('ADVERTISE') || p.perms?.includes('CREATE_ADS') || p.perms?.includes('BASIC_ADMIN')
        }));

        return res.json({
            success: true,
            data: pages,
            debug: {
                count: pages.length,
                source: '/me/accounts'
            }
        } as ApiResponse);

    } catch (error) {
        console.error('Error listing Meta pages:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        } as ApiResponse);
    }
}
