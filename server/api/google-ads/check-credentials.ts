import type { Request, Response } from 'express';

export async function checkGoogleAdsCredentials(req: Request, res: Response) {
  try {
    const credentials = {
      GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID || null,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null,
      GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '***' + process.env.GOOGLE_ADS_DEVELOPER_TOKEN.slice(-4) : null,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '***' + process.env.GOOGLE_CLIENT_ID.slice(-4) : null,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '***' + process.env.GOOGLE_CLIENT_SECRET.slice(-4) : null,
      GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN ? '***' + process.env.GOOGLE_ADS_REFRESH_TOKEN.slice(-4) : null,
    };

    const missing = Object.entries(credentials)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    const status = {
      hasAllCredentials: missing.length === 0,
      missing: missing,
      credentials: credentials,
      nextSteps: []
    };

    if (missing.includes('GOOGLE_CLIENT_ID') || missing.includes('GOOGLE_CLIENT_SECRET')) {
      status.nextSteps.push('1. Criar OAuth 2.0 Client ID no Google Cloud Console');
      status.nextSteps.push('2. Adicionar redirect URI: ' + (process.env.FRONTEND_URL || 'http://localhost:8080') + '/api/integrations/google-ads/callback');
      status.nextSteps.push('3. Copiar Client ID e Secret para .env.local');
    }

    if (missing.includes('GOOGLE_ADS_REFRESH_TOKEN')) {
      status.nextSteps.push('4. Acessar /api/integrations/google-ads/auth para fazer OAuth');
    }

    if (missing.length === 0) {
      status.nextSteps.push('✅ Todas credenciais disponíveis! A API está pronta para uso.');
    }

    return res.json(status);
    
  } catch (error) {
    console.error('Error checking credentials:', error);
    return res.status(500).json({
      error: 'Failed to check credentials',
      message: error.message
    });
  }
}