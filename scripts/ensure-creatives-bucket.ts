import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

async function ensureCreativesBucket() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("🪣 Checking creatives bucket...");

    // Try to get bucket info
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error("Error listing buckets:", listError);
        throw listError;
    }

    const creativesBucket = buckets.find((b) => b.id === "creatives");

    if (creativesBucket) {
        console.log("✓ Creatives bucket already exists");
        console.log(`  - Public: ${creativesBucket.public}`);
        console.log(`  - File size limit: ${creativesBucket.file_size_limit} bytes`);
    } else {
        console.log("Creating creatives bucket...");

        const { data, error } = await supabase.storage.createBucket("creatives", {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/quicktime",
                "video/webm",
            ],
        });

        if (error) {
            console.error("Error creating bucket:", error);
            throw error;
        }

        console.log("✓ Created creatives bucket successfully");
    }
}

ensureCreativesBucket()
    .then(() => {
        console.log("\n✅ Bucket setup complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Bucket setup failed:", error);
        process.exit(1);
    });
