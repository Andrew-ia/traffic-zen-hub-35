import fetch from 'node-fetch';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface MetaApiOptions {
    accessToken: string;
}

export class MetaApiService {
    private accessToken: string;

    constructor(options: MetaApiOptions) {
        this.accessToken = options.accessToken;
    }

    /**
     * Generic method to call Meta Graph API
     */
    async call(path: string, method: 'POST' | 'GET', body: any = {}): Promise<any> {
        const url = `${GRAPH_URL}/${path}`;
        const queryParams = new URLSearchParams({ access_token: this.accessToken });

        if (method === 'GET' && body && typeof body === 'object') {
            for (const [key, value] of Object.entries(body)) {
                if (value === undefined || value === null) continue;
                if (typeof value === 'object') {
                    queryParams.append(key, JSON.stringify(value));
                } else {
                    queryParams.append(key, String(value));
                }
            }
        }

        const options: any = {
            method,
            headers: {},
        };

        if (method === 'POST') {
            const form = new URLSearchParams();
            for (const [key, value] of Object.entries(body)) {
                if (value === undefined || value === null) continue;
                if (typeof value === 'object') {
                    form.append(key, JSON.stringify(value));
                } else {
                    form.append(key, String(value));
                }
            }
            options.body = form.toString();
            options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
            // console.log(`[Meta API] POST ${url} Payload:`, options.body);
        }

        const response = await fetch(`${url}?${queryParams.toString()}`, options);
        const data = await response.json() as any;

        if (data.error) {
            console.error('[Meta API] Error Response:', JSON.stringify(data, null, 2));
            throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code}, Subcode: ${data.error.error_subcode})`);
        }

        return data;
    }

    /**
     * Upload a video to a Page's video library
     */
    async uploadPageVideo(pageId: string, videoUrl: string, description: string, accessToken?: string): Promise<string> {
        const token = accessToken || this.accessToken;
        const vUrl = `${GRAPH_URL}/${pageId}/videos?access_token=${token}`;
        const form = new URLSearchParams();
        form.append('file_url', videoUrl);
        form.append('published', 'false');
        form.append('description', description);

        const response = await fetch(vUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString()
        });

        const data = await response.json() as any;

        if (data.error) {
            throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code}, Subcode: ${data.error.error_subcode})`);
        }

        return data.id;
    }

    /**
     * Create an unpublished page post (dark post)
     */
    async createDarkPost(pageId: string, message: string, accessToken?: string): Promise<string> {
        const token = accessToken || this.accessToken;
        const postUrl = `${GRAPH_URL}/${pageId}/feed?access_token=${token}`;
        const postForm = new URLSearchParams();
        postForm.append('message', message);
        postForm.append('published', 'false');

        const response = await fetch(postUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postForm.toString()
        });

        const data = await response.json() as any;

        if (data.error) {
            throw new Error(`Meta API Error: ${data.error.message} (Code: ${data.error.code}, Subcode: ${data.error.error_subcode})`);
        }

        return data.id;
    }
}
