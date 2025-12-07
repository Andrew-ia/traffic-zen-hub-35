import type { Request, Response } from 'express';
import fetch from 'node-fetch';

/**
 * Proxy endpoint to download creative files
 * Bypasses CORS issues by downloading the file server-side
 */
export async function downloadProxy(req: Request, res: Response) {
  try {
    const { url } = req.query;

    console.log('📥 Download proxy request:', {
      method: req.method,
      url: url,
      headers: Object.keys(req.headers),
      query: req.query
    });

    if (!url || typeof url !== 'string') {
      console.error('❌ Invalid URL parameter:', url);
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required',
      });
    }

    // Validate that it's a valid URL
    try {
      new URL(url);
    } catch (error) {
      console.error('❌ Invalid URL format:', url);
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    console.log(`📥 Proxying download for: ${url}`);

    // Fetch the file from the external URL with additional headers
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000); // 30 segundos

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TrafficPro/1.0 (+https://trafficpro.dev)',
        'Accept': '*/*',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error(`❌ Failed to fetch file: ${response.status} ${response.statusText}`);
      console.error(`❌ Response body:`, await response.text().catch(() => 'Cannot read body'));
      return res.status(response.status === 403 ? 502 : response.status).json({
        success: false,
        error: `Failed to fetch file: ${response.statusText}`,
      });
    }

    // Get content type and content length from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // Download the entire file as a buffer first
    const buffer = await response.buffer();

    console.log(`📦 Downloaded ${buffer.length} bytes (Content-Type: ${contentType})`);

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Length', buffer.length.toString());

    // Send the complete buffer to the client
    res.send(buffer);

  } catch (error: any) {
    console.error('Error proxying download:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to download file',
    });
  }
}
