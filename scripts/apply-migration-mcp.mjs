#!/usr/bin/env node

import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

config({ path: ".env.local" });

const [,, sqlFilePath, providedVersion] = process.argv;

if (!sqlFilePath) {
  console.error("Usage: node scripts/apply-migration-mcp.mjs <path-to-sql> [version]");
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_DATABASE_URL) {
  console.error("Missing Supabase credentials in .env.local (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DATABASE_URL).");
  process.exit(1);
}

const sqlAbsolutePath = path.resolve(sqlFilePath);
if (!fs.existsSync(sqlAbsolutePath)) {
  console.error(`SQL file not found: ${sqlAbsolutePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlAbsolutePath, "utf8");
const filename = path.basename(sqlAbsolutePath);
const migrationVersion =
  providedVersion ??
  new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const rawDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
const decodedPassword = (() => {
  try {
    const url = new URL(rawDatabaseUrl);
    return decodeURIComponent(url.password);
  } catch {
    return undefined;
  }
})();
const databaseUrlWithoutPassword = (() => {
  const url = new URL(rawDatabaseUrl);
  url.password = "";
  return url.toString();
})();
const databaseUrlWithSsl =
  databaseUrlWithoutPassword.includes("?")
    ? `${databaseUrlWithoutPassword}&sslmode=require&ssl=true`
    : `${databaseUrlWithoutPassword}?sslmode=require&ssl=true`;

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "@aliyun-rds/supabase-mcp-server",
      "--url",
      process.env.SUPABASE_URL,
      "--anon-key",
      process.env.SUPABASE_ANON_KEY,
      "--service-key",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "--db-url",
      databaseUrlWithSsl,
    ],
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: databaseUrlWithSsl,
      SUPABASE_AUTH_JWT_SECRET: process.env.SUPABASE_LEGACY_JWT_SECRET ?? "",
      PGSSLMODE: "no-verify",
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      PGUSER: "postgres",
      ...(decodedPassword ? { PGPASSWORD: decodedPassword } : {}),
    },
  });

  const client = new Client(
    { name: "migration-runner", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    if (!toolNames.includes("apply_migration")) {
      throw new Error(`apply_migration tool is not available (exposed tools: ${toolNames.join(", ")})`);
    }

    console.log(`Applying migration ${migrationVersion} (${filename}) via MCP...`);
    const result = await client.callTool({
      name: "apply_migration",
      arguments: {
        version: migrationVersion,
        name: filename,
        sql,
      },
    });

    if (result.isError) {
      throw new Error(`MCP returned an error: ${result.message ?? JSON.stringify(result)}`);
    }

    const output = result.structuredContent ?? result.content;
    console.log("Migration applied successfully via MCP.", output ? `\nResponse: ${JSON.stringify(output)}` : "");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to apply migration via MCP:", error);
  process.exit(1);
});
