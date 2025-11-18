import type { Request, Response } from 'express';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Google Ads OAuth scopes
const GOOGLE_ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];

export async function initiateGoogleAdsAuth(req: Request, res: Response) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Google OAuth credentials not configured'
      });
    }

    // Create OAuth2 client with the correct redirect URI
    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/google-ads/callback`;
    
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
      state: 'google-ads-auth' // Optional state parameter for security
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