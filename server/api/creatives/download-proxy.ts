import type { Request, Response } from 'express';
import fetch from 'node-fetch';

/**
 * Proxy endpoint to download creative files
 * Bypasses CORS issues by downloading the file server-side
 */
export async function downloadProxy(req: Request, res: Response) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required',
      });
    }

    console.log(`📥 Proxying download for: ${url}`);

    // Fetch the file from the external URL
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
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
