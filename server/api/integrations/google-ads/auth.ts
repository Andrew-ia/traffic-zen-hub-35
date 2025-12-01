import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { resolveWorkspaceId } from '../../../utils/workspace.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Google Ads OAuth scopes
const GOOGLE_ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];

export async function initiateGoogleAdsAuth(req: Request, res: Response) {
  try {
    const { id: workspaceIdFromResolver } = resolveWorkspaceId(req);
    const workspaceIdFromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId.trim() : '';
    const workspaceId = workspaceIdFromQuery || workspaceIdFromResolver || '';

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Google OAuth credentials not configured'
      });
    }

    // Create OAuth2 client with the correct redirect URI - use main domain
    const isVercel = req.get('host')?.includes('vercel.app');
    const host = isVercel ? 'traffic-zen-hub-35.vercel.app' : req.get('host');
    const protocol = isVercel ? 'https' : req.protocol;
    const redirectUri = `${protocol}://${host}/api/integrations/google-ads/callback`;
    
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      redirectUri
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_ADS_SCOPES,
      prompt: 'consent', // Force consent to get refresh token
      state: workspaceId || 'google-ads-auth' // carry workspace when available
    });

    console.log('Generated Google Ads auth URL:', authUrl);

    // Redirect to Google authorization page
    res.redirect(authUrl);

  } catch (error: any) {
    console.error('Error initiating Google Ads auth:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate Google Ads authentication'
    });
  }
}
