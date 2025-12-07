
import { getPool } from "../server/config/database";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.log(".env.local not found at", envPath);
}

async function main() {
    try {
        const pool = getPool();
        // Get all workspaces having ML credentials
        const res = await pool.query("SELECT workspace_id FROM integration_credentials WHERE platform_key = 'mercadolivre'");
        console.log("Workspaces with ML creds:", res.rows);

        // Also list all workspaces just in case
        const res2 = await pool.query("SELECT id, name FROM workspaces");
        console.log("All workspaces:", res2.rows);

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
