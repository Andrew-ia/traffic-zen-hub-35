---
description: Deploy Serverless Notifications for Mercado Livre
---

# Deploy Serverless Notifications

This workflow sets up a Supabase Edge Function to check Mercado Livre orders and send Telegram notifications without needing a local server running.

## 1. Create the Edge Function

Create a new file at `supabase/functions/check-ml-notifications/index.ts`.

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { encode as base64Encode, decode as base64Decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const MERCADO_LIVRE_API = "https://api.mercadolibre.com";

// --- Encryption/Decryption Helpers (Matching Node.js logic) ---

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey", "deriveBits"]
  );
  // Note: Node.js implementation uses simple SHA256 of the secret.
  // We need to match that.
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

async function decryptCredentials(encryptedBase64: string, ivBase64: string, secret: string) {
  try {
    const key = await getKey(secret);
    const iv = base64Decode(ivBase64);
    const data = base64Decode(encryptedBase64);
    
    // Node.js implementation appends auth tag (16 bytes) to the end
    // Web Crypto AES-GCM expects the tag to be part of the ciphertext for decryption
    // So we can pass 'data' directly.
    
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
    // 1. Setup Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Must use Service Role to read credentials
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const credentialsSecret = Deno.env.get('CREDENTIALS_SECRET') || Deno.env.get('AUTH_SECRET');
    if (!credentialsSecret) {
      throw new Error("Missing CREDENTIALS_SECRET env var");
    }

    // 2. Fetch all workspaces with ML credentials
    const { data: credentials, error: credError } = await supabase
      .from('integration_credentials')
      .select('*')
      .eq('platform_key', 'mercadolivre');

    if (credError) throw credError;

    const results = [];

    for (const cred of credentials) {
      const workspaceId = cred.workspace_id;
      
      // 3. Decrypt tokens
      const params = await decryptCredentials(cred.encrypted_credentials, cred.encryption_iv, credentialsSecret);
      if (!params || !params.accessToken) {
        console.error(`Could not decrypt for workspace ${workspaceId}`);
        continue;
      }

      let accessToken = params.accessToken;
      
      // 4. Refresh Token logic (Simplified)
      // Ideally we should check expiration and refresh if needed, then update DB.
      // For now, assuming token is valid or we accept failure until next login.
      // Implementing refresh here effectively would require updating the DB with new encrypted tokens.
      
      // 5. Fetch recent orders
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      
      const ordersRes = await fetch(`${MERCADO_LIVRE_API}/orders/search?seller=${params.userId}&order.date_created.from=${tenMinutesAgo}&sort=date_desc`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!ordersRes.ok) {
        console.error(`Failed to fetch orders for ${workspaceId}: ${ordersRes.status}`);
        continue;
      }
      
      const ordersData = await ordersRes.json();
      const orders = ordersData.results || [];

      // 6. Check duplicates and Send Notification
      // Use existing notification_settings
      const { data: notifSettings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'telegram')
        .eq('enabled', true)
        .single();

      if (!notifSettings) continue;

      const botToken = notifSettings.config.bot_token;
      const chatId = notifSettings.config.chat_id;

      for (const order of orders) {
        const orderId = String(order.id);
        
        // Check if already sent
        const { data: logs } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('platform', 'telegram')
          .eq('notification_type', 'order_created')
          .eq('reference_id', orderId)
          .single();

        if (logs) continue; // Already processed

        // Format Message
        const message = `🎉 <b>NOVA VENDA (Via Serverless)!</b>\n\n` +
                        `📦 <b>Pedido:</b> #${orderId}\n` +
                        `💰 <b>Valor:</b> R$ ${order.total_amount}\n` + 
                        `🔗 <a href="https://www.mercadolivre.com.br/vendas/${orderId}/detalle">Ver Pedido</a>`;

        // Send to Telegram
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
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
        
        results.push({ workspaceId, orderId, status: tgData.ok ? 'sent' : 'failed' });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
})
```

## 2. Deploy

Run the following command to deploy the function:

```bash
npx supabase functions deploy check-ml-notifications
```

## 3. Set Environment Variables

You must set the `CREDENTIALS_SECRET` for the Edge Function to decrypt the tokens.

```bash
npx supabase secrets set --env-file .env.local
```

## 4. Schedule with Cron

Go to your Supabase Dashboard > SQL Editor and run:

```sql
select
  cron.schedule(
    'check-ml-orders-every-10m',
    '*/10 * * * *',
    $$
    select
      net.http_post(
          url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/check-ml-notifications',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb
      ) as request_id;
    $$
  );
```
