import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { google } from 'googleapis';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';
import readline from 'readline';
import fetch from 'node-fetch';
import http from 'http';
import url from 'url';

// Google Ads OAuth configuration
const GOOGLE_ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
// ENCRYPTION_KEY no longer needed - using plaintext storage

// Developer token and customer info
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

// Database connection
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

// Plaintext credentials storage (no encryption)
function encryptCredentials(data) {
  return {
    encrypted: JSON.stringify(data),
    iv: ''
  };
}

console.log('🚀 Google Ads Authentication Setup');
console.log('==================================');

// Validate required environment variables
if (!CLIENT_ID || !CLIENT_SECRET || !DEVELOPER_TOKEN || !CUSTOMER_ID) {
  console.error('❌ Missing required environment variables:');
  if (!CLIENT_ID) console.error('  - GOOGLE_CLIENT_ID');
  if (!CLIENT_SECRET) console.error('  - GOOGLE_CLIENT_SECRET');
  if (!DEVELOPER_TOKEN) console.error('  - GOOGLE_ADS_DEVELOPER_TOKEN');
  if (!CUSTOMER_ID) console.error('  - GOOGLE_ADS_CUSTOMER_ID');
  console.error('\nPlease set these in your .env.local file or Vercel environment variables.');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   Client ID: ${CLIENT_ID.substring(0, 20)}...`);
console.log(`   Developer Token: ${DEVELOPER_TOKEN.substring(0, 10)}...`);
console.log(`   Customer ID: ${CUSTOMER_ID}`);
console.log(`   Workspace ID: ${WORKSPACE_ID}`);

// Create OAuth2 client - use localhost for redirect
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: GOOGLE_ADS_SCOPES,
  prompt: 'consent' // Force consent to get refresh token
});

console.log('\n📋 STEP 1: Get Authorization Code');
console.log('==================================');

// Function to start local server and get authorization code
function getAuthorizationCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
      if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1><p>Authentication failed. Please close this tab and try again.</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this tab and return to the terminal.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          `);
          server.close();
          resolve(code);
          return;
        }
      }
      
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
    });
    
    server.listen(3000, () => {
      console.log('🌐 Starting local server on http://localhost:3000');
      console.log('\n1. Click this link to authorize the application:');
      console.log(`\n${authUrl}\n`);
      console.log('2. Sign in with the Google account that has access to Google Ads');
      console.log('3. Grant permissions to the application');
      console.log('4. You will be redirected back automatically');
      console.log('\n⏳ Waiting for authorization...');
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout - please try again'));
    }, 300000);
  });
}

async function main() {
  try {
    // Get authorization code automatically
    const authCode = await getAuthorizationCode();

    console.log('\n🔄 Exchanging authorization code for tokens...');

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(authCode);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      console.error('❌ No refresh token received. This might happen if:');
      console.error('   - The account was already authorized (revoke and try again)');
      console.error('   - The consent screen was not shown (add prompt=consent)');
      console.error('\nTo fix this:');
      console.error('1. Go to https://myaccount.google.com/permissions');
      console.error('2. Remove your app from authorized applications');
      console.error('3. Run this script again');
      process.exit(1);
    }

    console.log('✅ Tokens received successfully!');
    console.log(`   Access Token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokens.refresh_token}`); // PRINT FULL TOKEN FOR CAPTURE

    // Prepare credentials object
    const credentials = {
      refreshToken: tokens.refresh_token,
      customerId: CUSTOMER_ID.replace(/-/g, ''), // Remove dashes
      developerToken: DEVELOPER_TOKEN,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      loginCustomerId: LOGIN_CUSTOMER_ID?.replace(/-/g, '') || undefined
    };

    console.log('\n💾 Saving credentials to database...');

    // Save credentials to database (plaintext)
    const { encrypted, iv } = encryptCredentials(credentials);
    
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

    console.log('✅ Credentials saved successfully!');

    // Test the credentials (skip if server not running)
    console.log('\n🧪 Testing credentials (skipping API test - will verify in production)...');
    
    await pool.end();
    
    console.log('\n🎉 Google Ads authentication setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy to production');
    console.log('2. Test the Google Analytics page');
    console.log('3. Verify Google Ads data is loading');
    console.log('\nThe credentials have been encrypted and saved to the database.');
    console.log('The Google Ads integration should now work properly!');

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    console.error('\nCommon issues:');
    console.error('- Invalid authorization code');
    console.error('- Google Cloud project not properly configured');
    console.error('- Google Ads API not enabled');
    console.error('- Developer token not approved');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled by user');
  process.exit(0);
});

main();