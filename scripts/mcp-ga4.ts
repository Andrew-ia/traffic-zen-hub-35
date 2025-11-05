#!/usr/bin/env tsx
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const ANALYTICS_SCOPE = ['https://www.googleapis.com/auth/analytics.readonly'];

function normalizePrivateKey(key: string): string {
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
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credsPath) {
    const { client_email, private_key } = readCredentialsFromFile(credsPath);
    return { clientEmail: client_email, privateKey: private_key };
  }
  const clientEmail = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GA4 service account credentials. Set GOOGLE_APPLICATION_CREDENTIALS or GA4_SERVICE_ACCOUNT_EMAIL/GA4_SERVICE_ACCOUNT_KEY.');
  }
  return { clientEmail, privateKey: normalizePrivateKey(privateKey) };
}

async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ANALYTICS_SCOPE });
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

const server = new McpServer({ name: 'ga4-mcp', version: '1.0.0' });

server.registerTool(
  'ga4_realtime',
  {
    title: 'GA4 Realtime Report',
    description: 'Fetch realtime events from GA4',
    inputSchema: {
      propertyId: z.string().optional(),
    },
    outputSchema: z.any(),
  },
  async ({ propertyId }) => {
    const pid = propertyId || process.env.GA4_PROPERTY_ID;
    if (!pid) throw new Error('propertyId is required');
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runRealtimeReport`;
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
    const data = await runGa4Api<any>(url, body);
    const text = JSON.stringify(data);
    return { content: [{ type: 'text', text }], structuredContent: data };
  }
);

server.registerTool(
  'ga4_report',
  {
    title: 'GA4 Historical Report',
    description: 'Fetch report for last N days',
    inputSchema: {
      propertyId: z.string().optional(),
      days: z.number().optional(),
    },
    outputSchema: z.any(),
  },
  async ({ propertyId, days }) => {
    const pid = propertyId || process.env.GA4_PROPERTY_ID;
    const nDays = days ?? 7;
    if (!pid) throw new Error('propertyId is required');
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`;
    const body = {
      dateRanges: [{ startDate: `${nDays}daysAgo`, endDate: 'today' }],
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
    const data = await runGa4Api<any>(url, body);
    const text = JSON.stringify(data);
    return { content: [{ type: 'text', text }], structuredContent: data };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
transport.start();
