import { getPool } from './database.js';

type ColumnRequirements = Record<string, string[]>;

type RuntimeSchemaRequirements = {
  tables?: string[];
  columns?: ColumnRequirements;
};

const normalizeFlag = (value?: string) => String(value || '').trim().toLowerCase();

export function allowRuntimeSchemaChanges(): boolean {
  const override = normalizeFlag(process.env.ALLOW_RUNTIME_SCHEMA_CHANGES);
  if (override === 'true') return true;
  if (override === 'false') return false;

  const nodeEnv = normalizeFlag(process.env.NODE_ENV);
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && nodeEnv !== 'production';
}

export async function assertSchemaRequirements(
  feature: string,
  requirements: RuntimeSchemaRequirements,
): Promise<void> {
  const pool = getPool();
  const missingTables: string[] = [];
  const missingColumns: string[] = [];

  if (requirements.tables?.length) {
    const { rows } = await pool.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [requirements.tables],
    );

    const existingTables = new Set(rows.map((row) => row.table_name));
    for (const table of requirements.tables) {
      if (!existingTables.has(table)) {
        missingTables.push(table);
      }
    }
  }

  const columnTables = Object.keys(requirements.columns || {});
  if (columnTables.length) {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [columnTables],
    );

    const existingColumns = new Map<string, Set<string>>();
    for (const row of rows) {
      const tableColumns = existingColumns.get(row.table_name) || new Set<string>();
      tableColumns.add(row.column_name);
      existingColumns.set(row.table_name, tableColumns);
    }

    for (const [table, columns] of Object.entries(requirements.columns || {})) {
      const tableColumns = existingColumns.get(table) || new Set<string>();
      for (const column of columns) {
        if (!tableColumns.has(column)) {
          missingColumns.push(`${table}.${column}`);
        }
      }
    }
  }

  if (!missingTables.length && !missingColumns.length) {
    return;
  }

  const parts: string[] = [];
  if (missingTables.length) {
    parts.push(`missing tables: ${missingTables.join(', ')}`);
  }
  if (missingColumns.length) {
    parts.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  throw new Error(
    `${feature} schema is not up to date in this environment (${parts.join('; ')}). Apply the pending Supabase migrations before using this feature.`,
  );
}

export async function ensureRuntimeSchema(
  feature: string,
  requirements: RuntimeSchemaRequirements,
  bootstrap: () => Promise<void>,
): Promise<void> {
  if (allowRuntimeSchemaChanges()) {
    await bootstrap();
    return;
  }

  await assertSchemaRequirements(feature, requirements);
}
