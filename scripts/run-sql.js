#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const [,, filePath] = process.argv;
  if (!filePath) {
    console.error("Usage: node scripts/run-sql.js <path-to-sql-file>");
    process.exit(1);
  }

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error("Missing SUPABASE_DATABASE_URL environment variable.");
    process.exit(1);
  }

  const sql = await readFile(filePath, "utf8");
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Executed SQL from ${filePath}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to execute SQL:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
