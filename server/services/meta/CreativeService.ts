import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import { getPool } from '../../config/database.js';

interface Asset {
    id: string;
    name?: string;
    type?: string;
    storage_url?: string;
}

export class CreativeService {
    private supabaseUrl: string;
    private supabaseKey: string;

    constructor() {
        this.supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
        this.supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error('Supabase not configured');
        }
    }

    /**
     * Ensures an asset has a public URL. If it's a Drive file or private, mirrors it to Supabase Storage.
     */
    async ensurePublicUrl(asset: Asset, workspaceId: string): Promise<{ url: string; mime?: string }> {
        const src = String(asset.storage_url || '').trim();
        const isSupabase = src && (src.includes(this.supabaseUrl) || /supabase\.co\//.test(src));

        if (isSupabase) {
            return { url: src };
        }

        const sb = createClient(this.supabaseUrl, this.supabaseKey);
        const bucket = 'creatives';
        const pathBase = `${workspaceId}/assets/${asset.id}`;

        const { buf, mime } = await this.fetchAssetContent(src, asset);

        const ext = (mime || '').includes('mp4') ? 'mp4' : (mime || '').includes('png') ? 'png' : (mime || '').includes('jpeg') ? 'jpg' : undefined;
        const key = ext ? `${pathBase}.${ext}` : pathBase;

        const { error: uploadError } = await sb.storage.from(bucket).upload(key, buf, {
            contentType: mime || 'application/octet-stream',
            upsert: true
        });

        if (uploadError) throw uploadError;

        const { data } = sb.storage.from(bucket).getPublicUrl(key);

        if (!data?.publicUrl) {
            throw new Error('Failed to get public URL from Supabase');
        }

        // Update the asset record with the new public URL
        try {
            const pool = getPool();
            await pool.query(
                `UPDATE creative_assets SET storage_url = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3`,
                [data.publicUrl, asset.id, workspaceId]
            );
        } catch (e) {
            console.warn('Failed to update asset storage_url in DB', e);
        }

        return { url: data.publicUrl, mime };
    }

    private async fetchAssetContent(src: string, asset: Asset): Promise<{ buf: Buffer; mime?: string; name?: string }> {
        // Check if it's a Google Drive link
        const m = src.match(/\/file\/d\/([^/]+)/) || src.match(/[?&]id=([^&]+)/);
        const fileId = m?.[1];

        if (fileId) {
            const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
            const drive = google.drive({ version: 'v3', auth });

            const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
            const name = meta.data.name || asset.name || asset.id;
            const mime = meta.data.mimeType || undefined;

            const resp: any = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' } as any);
            const buf = Buffer.from(resp.data as ArrayBuffer);

            return { buf, mime, name };
        } else {
            // Regular URL fetch
            const r = await fetch(src);
            if (!r.ok) throw new Error(`Failed to fetch asset from ${src}`);

            const mime = r.headers.get('content-type') || undefined;
            const ab = await r.arrayBuffer();
            const buf = Buffer.from(ab);
            const name = asset.name || asset.id;

            return { buf, mime, name };
        }
    }

    /**
     * Creates a new creative asset record from a Drive URL or other source
     */
    async createAssetFromUrl(workspaceId: string, name: string, url: string): Promise<Asset> {
        const isVideo = /\.mp4(\?|$)/i.test(url);
        const pool = getPool();

        const result = await pool.query(
            `INSERT INTO creative_assets (workspace_id, name, type, storage_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', now(), now())
       RETURNING id, name, type, storage_url`,
            [workspaceId, name, isVideo ? 'video' : 'image', url]
        );

        return result.rows[0];
    }
}
