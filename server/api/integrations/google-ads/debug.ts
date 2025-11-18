import type { Request, Response } from 'express';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function debugGoogleAdsAuth(req: Request, res: Response) {
  const protocol = req.get('host')?.includes('vercel.app') ? 'https' : req.protocol;
  const redirectUri = `${protocol}://${req.get('host')}/api/integrations/google-ads/callback`;
  
  res.json({
    clientId: CLIENT_ID,
    clientSecretSet: !!CLIENT_SECRET,
    redirectUri: redirectUri,
    requestUrl: req.url,
    headers: {
      host: req.get('host'),
      protocol: req.protocol
    },
    env: process.env.NODE_ENV
  });
}