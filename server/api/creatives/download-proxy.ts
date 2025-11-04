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

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Stream the file to the client
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // If it's a known file type, suggest a download
    if (contentType.includes('image') || contentType.includes('video')) {
      const extension = contentType.split('/')[1] || 'bin';
      res.setHeader('Content-Disposition', `attachment; filename="creative.${extension}"`);
    }

    // Pipe the response body to the client
    if (response.body) {
      response.body.pipe(res as any);
    } else {
      const buffer = await response.buffer();
      res.send(buffer);
    }

  } catch (error: any) {
    console.error('Error proxying download:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to download file',
    });
  }
}
