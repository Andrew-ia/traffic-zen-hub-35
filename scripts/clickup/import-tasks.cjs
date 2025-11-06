#!/usr/bin/env node
/**
 * Importa tarefas de um CSV ou JSON para uma lista do ClickUp.
 *
 * Uso:
 *   CLICKUP_TOKEN=pk_xxx node scripts/clickup/import-tasks.js --file tasks.csv --list-id 901322143696
 *   CLICKUP_TOKEN=pk_xxx node scripts/clickup/import-tasks.js --file tasks.json --list-name "Content Calendar" --space-id 901311689002
 *
 * CSV esperado (header obrigatório):
 *   name,description,status,due_date,start_date,tags
 * - data em formatos: YYYY-MM-DD, YYYY-MM-DD HH:mm, ou timestamp ms
 * - tags separadas por vírgula
 *
 * JSON esperado: array de objetos com os mesmos campos do CSV
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.findIndex(a => a === `--${name}`);
  if (i >= 0) return args[i + 1];
  const kv = args.find(a => a.startsWith(`--${name}=`));
  if (kv) return kv.split('=')[1];
  return def;
}

const FILE = getArg('file');
const LIST_ID = getArg('list-id');
const LIST_NAME = getArg('list-name');
const SPACE_ID = getArg('space-id');
const TOKEN = process.env.CLICKUP_TOKEN;

if (!TOKEN) {
  console.error('[ERRO] CLICKUP_TOKEN não definido.');
  process.exit(1);
}
if (!FILE) {
  console.error('[ERRO] Informe --file <caminho para CSV/JSON>.');
  process.exit(1);
}

const API = 'https://api.clickup.com/api/v2';

// fetch compat sem dependências externas
const fetchCompat = typeof fetch === 'function'
  ? fetch
  : (url, opts = {}) => new Promise((resolve, reject) => {
      const { URL } = require('url');
      const https = require('https');
      const u = new URL(url);
      const options = {
        method: opts.method || 'GET',
        headers: opts.headers || {},
      };
      const req = https.request(u, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const response = {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => data,
            json: async () => JSON.parse(data || '{}'),
          };
          resolve(response);
        });
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });

async function req(method, path, body) {
  const res = await fetchCompat(`${API}${path}`, {
    method,
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} – ${txt}`);
  }
  try { return JSON.parse(txt); } catch { return txt; }
}

async function resolveListId() {
  if (LIST_ID) return LIST_ID;
  if (!LIST_NAME || !SPACE_ID) {
    throw new Error('Informe --list-id OU (--list-name e --space-id).');
  }
  const lists = await req('GET', `/space/${SPACE_ID}/list`);
  const found = lists.lists.find(l => l.name === LIST_NAME);
  if (!found) throw new Error(`Lista não encontrada em space ${SPACE_ID}: ${LIST_NAME}`);
  return found.id;
}

function parseDateToMs(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{13}$/.test(s)) return Number(s); // timestamp ms
  // tenta YYYY-MM-DD[ HH:mm]
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseCSV(content) {
  // CSV simples com aspas opcionais; não cobre todos os casos complexos.
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // separa por vírgulas respeitando aspas
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const obj = {};
    header.forEach((h, idx) => obj[h] = (cols[idx] || '').trim());
    rows.push(obj);
  }
  return rows;
}

function normalizeRow(row) {
  const name = row.name || row.tarefa || row.title;
  if (!name) throw new Error('Linha sem "name"');
  const description = row.description || row.descricao || '';
  const status = row.status || row.etapa || null;
  const dueDate = parseDateToMs(row.due_date || row.data || row.data_limite);
  const startDate = parseDateToMs(row.start_date || row.inicio);
  const tags = (row.tags || row.etiquetas || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return { name, description, status, due_date: dueDate, start_date: startDate, tags };
}

async function createTask(listId, t) {
  const payload = {
    name: t.name,
    description: t.description,
    status: t.status || undefined,
    due_date: t.due_date || undefined,
    start_date: t.start_date || undefined,
    tags: t.tags && t.tags.length ? t.tags : undefined,
  };
  const res = await req('POST', `/list/${listId}/task`, payload);
  return { id: res.id, url: res.url, name: res.name, status: res.status?.status };
}

(async () => {
  const listId = await resolveListId();
  const abs = path.resolve(FILE);
  if (!fs.existsSync(abs)) throw new Error(`Arquivo não encontrado: ${abs}`);
  const content = fs.readFileSync(abs, 'utf8');

  let rows;
  if (/\.json$/i.test(FILE)) {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error('JSON deve ser um array de tarefas.');
    rows = data;
  } else {
    rows = parseCSV(content);
  }

  const tasks = rows.map(normalizeRow);
  console.log(`📦 Importando ${tasks.length} tarefas para a lista ${listId}...`);

  const results = [];
  for (const t of tasks) {
    try {
      const r = await createTask(listId, t);
      console.log(`✅ Criada: ${r.name} [${r.status || 'sem status'}] → ${r.url}`);
      results.push(r);
    } catch (err) {
      console.error(`❌ Erro ao criar "${t.name}": ${err.message}`);
    }
  }

  console.log(`\n🧾 Concluído. ${results.length}/${tasks.length} criadas.`);
})();

