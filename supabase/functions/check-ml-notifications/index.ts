import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { decode as base64Decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const MERCADO_LIVRE_API = "https://api.mercadolibre.com";

// --- Encryption/Decryption Helpers (Matching Node.js logic) ---

async function getKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    // Node.js implementation uses simple SHA256 of the secret to derive the 32-byte key
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
    return await crypto.subtle.importKey(
        "raw",
        hash,
        "AES-GCM",
        false,
        ["decrypt"] // We only need to decrypt here
    );
}

async function decryptCredentials(encryptedBase64: string, ivBase64: string, secret: string) {
    try {
        const key = await getKey(secret);
        const iv = base64Decode(ivBase64);
        const data = base64Decode(encryptedBase64);

        // Node.js 'aes-256-gcm' stores tag at the end (last 16 bytes).
        // Web Crypto AES-GCM expects the tag to be appended to the ciphertext.
        // Since our input 'data' is exactly 'ciphertext + tag', we can pass it directly.

        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128, // 16 bytes * 8
            },
            key,
            data
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (e) {
        console.error("Decryption failed:", e);
        return null;
    }
}

// --- Main Logic ---

Deno.serve(async (req) => {
    try {
        console.log("Function started");

        // 1. Setup Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Must use Service Role to read credentials

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing SUPABASE env vars");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const credentialsSecret = Deno.env.get('CREDENTIALS_SECRET') || Deno.env.get('AUTH_SECRET');
        if (!credentialsSecret) {
            throw new Error("Missing CREDENTIALS_SECRET env var. Set it using 'supabase secrets set CREDENTIALS_SECRET=...'");
        }

        // 2. Fetch all workspaces with ML credentials
        const { data: credentials, error: credError } = await supabase
            .from('integration_credentials')
            .select('*')
            .eq('platform_key', 'mercadolivre');

        if (credError) throw credError;
        if (!credentials || credentials.length === 0) {
            return new Response(JSON.stringify({ message: "No credentials found" }), { headers: { "Content-Type": "application/json" } });
        }

        const results = [];

        for (const cred of credentials) {
            const workspaceId = cred.workspace_id;

            // 3. Decrypt tokens
            const params = await decryptCredentials(cred.encrypted_credentials, cred.encryption_iv, credentialsSecret);
            if (!params || !params.accessToken) {
                console.error(`Could not decrypt for workspace ${workspaceId}`);
                results.push({ workspaceId, error: "Decryption failed" });
                continue;
            }

            const accessToken = params.accessToken;

            // 4. Fetch recent orders (last 24 hours to be safe and catch missed ones)
            const now = new Date();
            const timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

            const ordersRes = await fetch(`${MERCADO_LIVRE_API}/orders/search?seller=${params.userId}&order.date_created.from=${timeWindow}&sort=date_desc&limit=50`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!ordersRes.ok) {
                console.error(`Failed to fetch orders for ${workspaceId}: ${ordersRes.status}`);
                // TODO: Implement refresh token logic if 401
                results.push({ workspaceId, error: `ML API Error: ${ordersRes.status}` });
                continue;
            }

            const ordersData = await ordersRes.json();
            const orders = ordersData.results || [];
            console.log(`Found ${orders.length} recent orders for workspace ${workspaceId}`);

            // 5. Check notification settings
            const { data: notifSettings } = await supabase
                .from('notification_settings')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('platform', 'telegram')
                .eq('enabled', true)
                .single();

            if (!notifSettings) {
                results.push({ workspaceId, message: "Notifications disabled" });
                continue;
            }

            const botToken = notifSettings.config.bot_token;
            const chatId = notifSettings.config.chat_id;

            let processedCount = 0;

            for (const order of orders) {
                const orderId = String(order.id);
                const status = order.status;

                // Skip cancelled orders and non-sale statuses
                const normalizedStatus = String(status || '').toLowerCase();
                if (normalizedStatus === 'cancelled') continue;
                if (!['paid', 'confirmed'].includes(normalizedStatus)) continue;

                // Check if already sent (tolerant to multiple existing rows)
                const { data: logs, error: logError } = await supabase
                    .from('notification_logs')
                    .select('id')
                    .eq('platform', 'telegram')
                    .eq('notification_type', 'order_created')
                    .eq('reference_id', orderId)
                    .limit(1);

                if (logError) {
                    console.error(`Failed to check notification logs for order ${orderId}:`, logError);
                    continue;
                }

                if (Array.isArray(logs) && logs.length > 0) continue; // Already processed

                // Format Message
                const total = order.total_amount || order.paid_amount || 0;
                const msgText = `🎉 <b>NOVA VENDA (Auto)!</b>\n\n` +
                    `📦 <b>Pedido:</b> #${orderId}\n` +
                    `💰 <b>Valor:</b> R$ ${total}\n` +
                    `📅 <b>Data:</b> ${new Date(order.date_created).toLocaleString('pt-BR')}\n\n` +
                    `🔗 <a href="https://www.mercadolivre.com.br/vendas/${orderId}/detalle">Ver Pedido</a>`;

                // Send to Telegram
                const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: msgText,
                        parse_mode: "HTML"
                    })
                });

                const tgData = await tgRes.json();

                // Log Log
                await supabase.from('notification_logs').insert({
                    workspace_id: workspaceId,
                    platform: 'telegram',
                    notification_type: 'order_created',
                    reference_id: orderId,
                    status: tgData.ok ? 'sent' : 'failed',
                    payload: order,
                    response: tgData
                });

                if (tgData.ok) processedCount++;
            }
            results.push({ workspaceId, processed: processedCount });
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Function error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
})
