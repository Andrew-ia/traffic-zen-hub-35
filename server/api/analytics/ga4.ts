import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const ANALYTICS_SCOPE = ['https://www.googleapis.com/auth/analytics.readonly'];

function cleanEnv(value?: string): string {
  // Remove escaped newlines and trim accidental whitespace/newline suffixes
  return (value || '').replace(/\\n/g, '\n').trim();
}

function normalizePrivateKey(key: string): string {
  // Handle keys with literal \n characters
  return key.replace(/\\n/g, '\n');
}

function readCredentialsFromFile(filePath: string): { client_email: string; private_key: string } {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf-8');
  const json = JSON.parse(raw);
  if (!json.client_email || !json.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }
  return { client_email: json.client_email, private_key: json.private_key };
}

function getServiceAccountCredentials(): { clientEmail: string; privateKey: string } {
  // Prefer explicit env vars to avoid filesystem dependency in serverless
  const clientEmail = cleanEnv(process.env.GA4_SERVICE_ACCOUNT_EMAIL);
  const privateKey = cleanEnv(process.env.GA4_SERVICE_ACCOUNT_KEY);
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey: normalizePrivateKey(privateKey) };
  }

  // Fallback to GOOGLE_APPLICATION_CREDENTIALS path if provided
  const credsPath = cleanEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (credsPath) {
    const { client_email, private_key } = readCredentialsFromFile(credsPath);
    return { clientEmail: client_email, privateKey: private_key };
  }

  throw new Error('Missing GA4 service account credentials. Set GA4_SERVICE_ACCOUNT_EMAIL/GA4_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.');
}

async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ANALYTICS_SCOPE,
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error('Failed to obtain access token for GA4');
  return token;
}

async function runGa4Api<T>(url: string, body: any): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GA4 API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

function formatGa4Response(raw: any) {
  const dimensionHeaders = (raw?.dimensionHeaders || []).map((h: any) => h.name);
  const metricHeaders = (raw?.metricHeaders || []).map((h: any) => h.name);
  const rows = (raw?.rows || []).map((row: any) => {
    const obj: Record<string, any> = {};
    dimensionHeaders.forEach((name: string, i: number) => {
      obj[name] = row?.dimensionValues?.[i]?.value ?? null;
    });
    metricHeaders.forEach((name: string, i: number) => {
      const v = row?.metricValues?.[i]?.value ?? null;
      const num = typeof v === 'string' ? Number(v) : v;
      obj[name] = Number.isFinite(num) ? num : v;
    });
    return obj;
  });

  return {
    headers: { dimensions: dimensionHeaders, metrics: metricHeaders },
    rows,
    summary: { rowCount: rows.length },
    raw,
  };
}

export async function ga4Realtime(req: Request, res: Response) {
  try {
    const propertyId = cleanEnv(req.body?.propertyId || process.env.GA4_PROPERTY_ID);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'propertyId é obrigatório (env GA4_PROPERTY_ID ou body.propertyId)' });
    }

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
    const body = {
      dimensions: [
        { name: 'eventName' },
        { name: 'country' },
        { name: 'platform' },
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'screenPageViews' },
      ],
      limit: 50,
    };

    const raw = await runGa4Api<any>(url, body);
    const data = formatGa4Response(raw);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('GA4 realtime error:', error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
}

export async function ga4Report(req: Request, res: Response) {
  try {
    const propertyId = cleanEnv(req.body?.propertyId || process.env.GA4_PROPERTY_ID);
    const days = Number(req.body?.days ?? 7);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'propertyId é obrigatório (env GA4_PROPERTY_ID ou body.propertyId)' });
    }

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const body = {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'eventName' },
        { name: 'country' },
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
      ],
      limit: 250,
      orderBys: [
        { desc: true, metric: { metricName: 'eventCount' } },
      ],
    };

    const raw = await runGa4Api<any>(url, body);
    const data = formatGa4Response(raw);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('GA4 report error:', error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
}

export async function ga4GoogleAds(req: Request, res: Response) {
  try {
    const propertyId = cleanEnv(req.body?.propertyId || process.env.GA4_PROPERTY_ID);
    const days = Number(req.body?.days ?? 30);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'propertyId é obrigatório (env GA4_PROPERTY_ID ou body.propertyId)' });
    }

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const body = {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionCampaignName' },
        { name: 'sessionSourceMedium' },
        { name: 'eventName' },
      ],
      metrics: [
        { name: 'conversions' },
        { name: 'eventCount' },
        { name: 'eventValue' },
        { name: 'totalRevenue' },
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'sessionSourceMedium',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: 'google / cpc',
                  caseSensitive: false,
                },
              },
            },
          ],
        },
      },
      limit: 1000,
      orderBys: [
        { desc: true, metric: { metricName: 'conversions' } },
      ],
    };

    const raw = await runGa4Api<any>(url, body);
    const data = formatGa4Response(raw);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('GA4 Google Ads error:', error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
}
