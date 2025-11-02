#!/usr/bin/env node
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    const migrationPath = join(__dirname, '..', migrationFile);
    const sql = readFileSync(migrationPath, 'utf8');

    console.log(`📄 Executando: ${migrationFile}...`);
    await client.query(sql);

    console.log('✅ Migração executada com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
