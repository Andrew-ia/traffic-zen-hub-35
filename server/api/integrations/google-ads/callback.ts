import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { getPool } from '../../../config/database.js';
import { encryptCredentials } from '../../../services/encryption.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID || process.env.WORKSPACE_ID;

// Developer token and customer info
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

export async function handleGoogleAdsCallback(req: Request, res: Response) {
  try {
    const { code, error, state } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.status(400).send(`
        <html>
          <body>
            <h1>❌ Authentication Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try again or contact support.</p>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>❌ Missing Authorization Code</h1>
            <p>No authorization code received from Google.</p>
          </body>
        </html>
      `);
    }

    console.log('Processing Google Ads OAuth callback with code:', typeof code === 'string' ? code.substring(0, 20) + '...' : code);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      `${req.protocol}://${req.get('host')}/api/integrations/google-ads/callback`
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.refresh_token) {
      console.error('No refresh token received');
      return res.status(400).send(`
        <html>
          <body>
            <h1>⚠️ No Refresh Token</h1>
            <p>No refresh token was received. This might happen if the account was already authorized.</p>
            <p>To fix this:</p>
            <ol>
              <li>Go to <a href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
              <li>Remove the TrafficPro app</li>
              <li>Try the authorization again</li>
            </ol>
          </body>
        </html>
      `);
    }

    console.log('Tokens received successfully');

    // Prepare credentials object
    const credentials = {
      refreshToken: tokens.refresh_token,
      customerId: (CUSTOMER_ID || '').replace(/-/g, ''),
      developerToken: DEVELOPER_TOKEN || '',
      clientId: CLIENT_ID || '',
      clientSecret: CLIENT_SECRET || '',
      loginCustomerId: (LOGIN_CUSTOMER_ID || '').replace(/-/g, '') || undefined
    };

    // Encrypt and save to database
    const { encrypted, iv } = encryptCredentials(credentials);
    
    const pool = getPool();
    
    // Delete existing credentials
    await pool.query(
      'DELETE FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2',
      [WORKSPACE_ID, 'google_ads']
    );

    // Insert new credentials
    await pool.query(
      `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
       VALUES ($1, $2, $3, $4)`,
      [WORKSPACE_ID, 'google_ads', encrypted, iv]
    );

    console.log('Google Ads credentials saved successfully');

    // Return success page
    res.send(`
      <html>
        <head>
          <title>Google Ads Authentication Success</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #4CAF50; }
            .info { background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Google Ads Integration Successful!</h1>
          <p>Your Google Ads account has been successfully connected to TrafficPro.</p>
          
          <div class="info">
            <h3>What's Next:</h3>
            <ul>
              <li>Google Ads data will now appear in your Google Analytics dashboard</li>
              <li>Data may take a few minutes to load for the first time</li>
              <li>You can view metrics like clicks, impressions, cost, and ROAS</li>
            </ul>
          </div>

          <p><a href="/google-analytics" class="button">Go to Google Analytics Dashboard</a></p>
          
          <script>
            // Auto-redirect after 10 seconds
            setTimeout(() => {
              window.location.href = '/google-analytics';
            }, 10000);
          </script>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('Error in Google Ads callback:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>❌ Internal Server Error</h1>
          <p>An error occurred while processing the authentication:</p>
          <p><code>${error.message}</code></p>
          <p>Please try again or contact support.</p>
        </body>
      </html>
    `);
  }
}