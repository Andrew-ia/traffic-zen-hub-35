import type { Request, Response } from 'express';
import { GoogleAdsApi } from 'google-ads-api';
import { getPool } from '../../config/database.js';

interface GoogleAdsCredentials {
  refreshToken: string;
  customerId: string;
  developerToken: string;
  clientId: string;
  clientSecret: string;
  loginCustomerId?: string;
}

const cleanEnv = (value?: string) => (value || '').replace(/\\n/g, '').trim();

async function getGoogleAdsCredentials(workspaceId: string): Promise<GoogleAdsCredentials> {
  const pool = getPool();
  
  console.log('Getting Google Ads credentials for workspace:', workspaceId);
  
  // Try to get from database first
  const row = await pool.query(
    `SELECT encrypted_credentials, encryption_iv FROM integration_credentials 
     WHERE workspace_id = $1 AND platform_key = 'google_ads' LIMIT 1`,
    [workspaceId]
  );
  
  console.log('Database query returned:', row.rows.length, 'rows');
  
  if (row.rows.length > 0) {
    const { decryptCredentials } = await import('../../services/encryption.js');
    const creds = decryptCredentials(row.rows[0].encrypted_credentials, row.rows[0].encryption_iv);
    console.log('Using credentials from database:', {
      hasRefreshToken: !!creds.refreshToken,
      hasCustomerId: !!creds.customerId,
      hasDeveloperToken: !!creds.developerToken,
      hasClientId: !!creds.clientId,
      hasClientSecret: !!creds.clientSecret
    });
    return creds as GoogleAdsCredentials;
  }
  
  console.log('No credentials in database, falling back to environment variables');
  
  // Fallback to environment variables - trim all values to remove newlines
  const customerId = cleanEnv(process.env.GOOGLE_ADS_CUSTOMER_ID).replace(/-/g, '');
  const developerToken = cleanEnv(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
  const loginCustomerId = cleanEnv(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, '') || undefined;
  
  console.log('Environment variables:', {
    hasCustomerId: !!customerId,
    hasDeveloperToken: !!developerToken,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasLoginCustomerId: !!loginCustomerId,
    hasRefreshToken: !!cleanEnv(process.env.GOOGLE_ADS_REFRESH_TOKEN)
  });
  
  if (!customerId || !developerToken || !clientId || !clientSecret) {
    throw new Error('Missing Google Ads credentials');
  }
  
  return {
    refreshToken: cleanEnv(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    customerId,
    developerToken,
    clientId,
    clientSecret,
    loginCustomerId
  };
}

function createGoogleAdsClient(credentials: GoogleAdsCredentials) {
  const client = new GoogleAdsApi({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    developer_token: credentials.developerToken,
  });
  
  const customer = client.Customer({
    customer_id: credentials.customerId,
    login_customer_id: credentials.loginCustomerId,
    refresh_token: credentials.refreshToken,
  });
  
  return customer;
}

export async function syncGoogleAdsData(req: Request, res: Response) {
  try {
    const workspaceId = (req.body.workspaceId || process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '').trim();
    const days = parseInt(req.body.days || '7');
    
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Missing workspace ID' });
    }

    console.log(`Syncing Google Ads data for workspace: ${workspaceId}, days: ${days}`);
    
    const credentials = await getGoogleAdsCredentials(workspaceId);
    console.log('Credentials loaded:', {
      customerId: credentials.customerId,
      hasRefreshToken: !!credentials.refreshToken,
      hasDeveloperToken: !!credentials.developerToken,
      hasClientId: !!credentials.clientId,
      hasClientSecret: !!credentials.clientSecret,
      loginCustomerId: credentials.loginCustomerId
    });
    
    if (!credentials.refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing refresh token. Please complete Google Ads OAuth flow first.',
        needsAuth: true 
      });
    }
    
    const customer = createGoogleAdsClient(credentials);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
    
    console.log(`Fetching data from ${startDateStr} to ${endDateStr}`);
    
    // Query Google Ads API for campaign performance
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        segments.date
      FROM campaign 
      WHERE 
        segments.date BETWEEN '${startDateStr}' AND '${endDateStr}'
        AND campaign.status = 'ENABLED'
      ORDER BY segments.date DESC
    `;
    
    console.log('Executing query:', query);
    
    const results = await customer.query(query);
    
    console.log(`Query returned ${results.length} rows`);
    
    // Process and aggregate the results
    const aggregatedData = {
      totalClicks: 0,
      totalImpressions: 0,
      totalCost: 0,
      totalConversions: 0,
      totalConversionsValue: 0,
      campaigns: [] as any[],
      dailyData: {} as Record<string, any>
    };
    
    results.forEach((row: any) => {
      const clicks = parseInt(row.metrics.clicks || 0);
      const impressions = parseInt(row.metrics.impressions || 0);
      const costMicros = parseInt(row.metrics.cost_micros || 0);
      const cost = costMicros / 1000000; // Convert micros to currency
      const conversions = parseFloat(row.metrics.conversions || 0);
      const conversionsValue = parseFloat(row.metrics.conversions_value || 0);
      const date = row.segments.date;
      
      // Aggregate totals
      aggregatedData.totalClicks += clicks;
      aggregatedData.totalImpressions += impressions;
      aggregatedData.totalCost += cost;
      aggregatedData.totalConversions += conversions;
      aggregatedData.totalConversionsValue += conversionsValue;
      
      // Store campaign data
      aggregatedData.campaigns.push({
        id: row.campaign.id,
        name: row.campaign.name,
        status: row.campaign.status,
        date: date,
        clicks: clicks,
        impressions: impressions,
        cost: cost,
        conversions: conversions,
        conversionsValue: conversionsValue,
        ctr: parseFloat(row.metrics.ctr || 0)
      });
      
      // Aggregate by date
      if (!aggregatedData.dailyData[date]) {
        aggregatedData.dailyData[date] = {
          date: date,
          clicks: 0,
          impressions: 0,
          cost: 0,
          conversions: 0,
          conversionsValue: 0
        };
      }
      
      aggregatedData.dailyData[date].clicks += clicks;
      aggregatedData.dailyData[date].impressions += impressions;
      aggregatedData.dailyData[date].cost += cost;
      aggregatedData.dailyData[date].conversions += conversions;
      aggregatedData.dailyData[date].conversionsValue += conversionsValue;
    });
    
    // Calculate additional metrics
    const ctr = aggregatedData.totalImpressions > 0 ? 
      (aggregatedData.totalClicks / aggregatedData.totalImpressions) * 100 : 0;
    const cpc = aggregatedData.totalClicks > 0 ? 
      aggregatedData.totalCost / aggregatedData.totalClicks : 0;
    const roas = aggregatedData.totalCost > 0 ? 
      aggregatedData.totalConversionsValue / aggregatedData.totalCost : 0;
    
    const responseData = {
      success: true,
      data: {
        summary: {
          clicks: Math.round(aggregatedData.totalClicks),
          impressions: Math.round(aggregatedData.totalImpressions),
          cost: Math.round(aggregatedData.totalCost * 100) / 100, // Round to 2 decimals
          conversions: Math.round(aggregatedData.totalConversions * 100) / 100,
          conversionsValue: Math.round(aggregatedData.totalConversionsValue * 100) / 100,
          ctr: Math.round(ctr * 100) / 100,
          cpc: Math.round(cpc * 100) / 100,
          roas: Math.round(roas * 100) / 100
        },
        campaigns: aggregatedData.campaigns,
        dailyData: Object.values(aggregatedData.dailyData),
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
          days: days
        }
      }
    };
    
    console.log('Returning aggregated data:', JSON.stringify(responseData.data.summary, null, 2));
    
    return res.json(responseData);
    
  } catch (error: any) {
    console.error('Google Ads sync error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.message?.includes('DEVELOPER_TOKEN_NOT_ON_ALLOWLIST')) {
      return res.status(400).json({
        success: false,
        error: 'Developer token not approved. Request access in Google Ads API Center.',
        code: 'DEVELOPER_TOKEN_NOT_APPROVED'
      });
    }
    
    if (error.message?.includes('invalid_grant') || error.message?.includes('refresh_token')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please re-authenticate.',
        needsAuth: true
      });
    }
    
    if (error.message?.includes('Missing Google Ads credentials')) {
      return res.status(400).json({
        success: false,
        error: 'Google Ads credentials not configured. Please set up Google Ads integration.',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Return the actual error message for debugging
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync Google Ads data',
      errorDetails: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n')[0]
      }
    });
  }
}
