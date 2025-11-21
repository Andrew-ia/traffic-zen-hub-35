#!/usr/bin/env node
import fetch from "node-fetch";
import process from "node:process";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const {
    SUPABASE_DATABASE_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    META_WORKSPACE_ID,
} = process.env;

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Download creative image from URL and upload to Supabase storage
 */
async function downloadAndStoreCreative(imageUrl, creativeId) {
    if (!imageUrl) {
        return null;
    }

    try {
        // Download image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.warn(`  ✗ Failed to download image: ${response.statusText}`);
            return null;
        }

        // Get content type and determine file extension
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = contentType.split("/")[1]?.split(";")[0] || "jpg";

        // Generate filename
        const filename = `${creativeId}.${extension}`;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
            .from("creatives")
            .upload(filename, buffer, {
                contentType,
                upsert: true, // Overwrite if exists
            });

        if (error) {
            console.warn(`  ✗ Failed to upload to storage: ${error.message}`);
            return null;
        }

        // Get public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from("creatives")
            .getPublicUrl(filename);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.warn(`  ✗ Error: ${error.message ?? error}`);
        return null;
    }
}

async function main() {
    console.log("🔄 Starting creative images backfill...\n");

    if (!SUPABASE_DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing required Supabase environment variables");
    }

    if (!META_WORKSPACE_ID) {
        throw new Error("Missing META_WORKSPACE_ID environment variable");
    }

    const client = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await client.connect();

    try {
        // Get all creatives without storage_url
        const result = await client.query(
            `
      SELECT id, metadata->>'metaCreativeId' as meta_creative_id, thumbnail_url
      FROM creative_assets
      WHERE workspace_id = $1
        AND (storage_url IS NULL OR storage_url = '')
        AND thumbnail_url IS NOT NULL
      ORDER BY created_at DESC
    `,
            [META_WORKSPACE_ID]
        );

        const creatives = result.rows;
        console.log(`Found ${creatives.length} creatives to backfill\n`);

        if (creatives.length === 0) {
            console.log("✓ No creatives need backfilling!");
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < creatives.length; i++) {
            const creative = creatives[i];
            const progress = `[${i + 1}/${creatives.length}]`;

            console.log(`${progress} Processing creative ${creative.meta_creative_id}...`);

            const storageUrl = await downloadAndStoreCreative(
                creative.thumbnail_url,
                creative.meta_creative_id
            );

            if (storageUrl) {
                // Update database with storage URL
                await client.query(
                    `
          UPDATE creative_assets
          SET storage_url = $1, updated_at = now()
          WHERE id = $2
        `,
                    [storageUrl, creative.id]
                );

                console.log(`  ✓ Stored and updated: ${storageUrl}`);
                successCount++;
            } else {
                console.log(`  ✗ Failed to store creative`);
                failCount++;
            }

            console.log(""); // Empty line for readability
        }

        console.log("\n" + "=".repeat(60));
        console.log("📊 Backfill Summary:");
        console.log(`  ✓ Success: ${successCount}`);
        console.log(`  ✗ Failed: ${failCount}`);
        console.log(`  📈 Total: ${creatives.length}`);
        console.log("=".repeat(60));
    } catch (error) {
        console.error("Error during backfill:", error);
        throw error;
    } finally {
        await client.end();
    }
}

main()
    .then(() => {
        console.log("\n✅ Backfill completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Backfill failed:", error);
        process.exit(1);
    });
