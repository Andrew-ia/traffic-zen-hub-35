
import { getPool } from "../server/config/database";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const pool = getPool();
  const migrationFile = path.join(__dirname, "../db/migrations/0044_ml_product_details.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf-8");

  console.log("Applying migration 0044...");
  try {
    await pool.query(migrationSql);
    console.log("Migration 0044 applied successfully.");
  } catch (error) {
    console.error("Failed to apply migration:", error);
  } finally {
    process.exit();
  }
}

applyMigration();
