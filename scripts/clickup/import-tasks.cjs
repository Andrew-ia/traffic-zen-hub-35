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

function stripAccents(s) {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeKey(s) {
  return stripAccents(String(s || '').toLowerCase().trim());
}

// Conjunto de statuses conhecidos (normalizados)
const KNOWN_STATUS = new Set([
  'ideia', 'avaliacao', 'redacao', 'design', 'aprovacao', 'agendamento', 'concluido',
  'to do', 'complete', 'in progress', 'backlog', 'done'
].map(s => normalizeKey(s)));

// Heurística de tags comuns que não devem ser tratadas como status
const TAG_TOKENS = new Set([
  'vermezzo', 'gtm', 'ads', 'setup', 'pixel', 'analytics', 'tray', 'drive', 'whatsapp', 'ga4', 'meta', 'google ads'
].map(s => normalizeKey(s)));

function isTagToken(s) {
  const k = normalizeKey(s);
  if (!k) return false;
  return TAG_TOKENS.has(k);
}

function unique(arr) {
  const set = new Set(arr.map(x => x.trim()).filter(Boolean));
  return Array.from(set);
}

async function getListStatuses(listId) {
  try {
    const data = await req('GET', `/list/${listId}`);
    const statuses = (data.statuses || []).map((st) => st.status).filter(Boolean);
    const map = new Map();
    for (const st of statuses) {
      map.set(normalizeKey(st), st);
    }
    return map; // normalized -> exact
  } catch (e) {
    console.warn('⚠️ Não foi possível obter statuses da lista. Usando fallback.');
    return new Map();
  }
}

async function getExistingTasks(listId) {
  try {
    const data = await req('GET', `/list/${listId}/task`);
    const tasks = (data.tasks || []);
    const byName = new Map();
    for (const t of tasks) {
      const k = normalizeKey(t.name);
      if (!byName.has(k)) {
        byName.set(k, { id: t.id, name: t.name, url: t.url });
      }
    }
    return byName;
  } catch (e) {
    console.warn('⚠️ Não foi possível obter tarefas existentes da lista. Duplicatas podem ocorrer.');
    return new Map();
  }
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
        // Suporta aspas escapadas "" (CSV)
        if (inQuotes && line[c + 1] === '"') {
          cur += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
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
  const name = (row.name || row.tarefa || row.title || '').trim();
  if (!name) throw new Error('Linha sem "name"');
  const description = (row.description || row.descricao || '').trim();
  // Limpa vírgulas à direita e espaços
  let statusRaw = (row.status || row.etapa || '').trim().replace(/,+$/, '');
  const dueDate = parseDateToMs(row.due_date || row.data || row.data_limite);
  const startDate = parseDateToMs(row.start_date || row.inicio);
  let tags = (row.tags || row.etiquetas || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const parent = (row.parent || row.parent_name || '').trim();

  // Se status vier com múltiplos itens separados por vírgula, distribui o que for tag para tags
  if (statusRaw.includes(',')) {
    const parts = statusRaw.split(',').map(p => p.trim()).filter(Boolean);
    let chosenStatus = '';
    for (const p of parts) {
      const nk = normalizeKey(p);
      if (KNOWN_STATUS.has(nk)) {
        chosenStatus = p; // mantém valor original
      } else if (isTagToken(p)) {
        tags.push(p);
      } else if (!chosenStatus) {
        // se não reconhecido, assume primeiro como possível status
        chosenStatus = p;
      }
    }
    statusRaw = chosenStatus;
  } else if (isTagToken(statusRaw)) {
    // Se status parece tag, move para tags
    if (statusRaw) tags.push(statusRaw);
    statusRaw = '';
  }

  tags = unique(tags);
  const status = statusRaw || null;
  return { name, description, status, due_date: dueDate, start_date: startDate, tags, parent };
}

async function createTask(listId, t) {
  const payload = {
    name: t.name,
    description: t.description,
    status: t.status || undefined,
    due_date: t.due_date || undefined,
    start_date: t.start_date || undefined,
    tags: t.tags && t.tags.length ? t.tags : undefined,
    parent: t.parent_id || undefined,
  };
  const res = await req('POST', `/list/${listId}/task`, payload);
  return { id: res.id, url: res.url, name: res.name, status: res.status?.status };
}

async function updateTaskParent(taskId, parentId) {
  const payload = { parent: parentId };
  const res = await req('PUT', `/task/${taskId}`, payload);
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

  // Preparar status e tarefas existentes
  const statusMap = await getListStatuses(listId); // normalized -> exact
  const existingMap = await getExistingTasks(listId); // normalized(name) -> {id,name,url}
  const createdMap = new Map(); // normalized(name) -> {id,name,url}

  const results = [];
  for (const t of tasks) {
    try {
      const nameKey = normalizeKey(t.name);
      // Normaliza status; se não existir na lista, omite
      let statusKey = normalizeKey(t.status);
      // Mapeia "concluído" para "complete" caso a lista suporte
      if (statusKey === normalizeKey('concluído') || statusKey === 'concluido') {
        statusKey = normalizeKey('complete');
        t.status = 'complete';
      }
      if (statusKey && statusMap.has(statusKey)) {
        t.status = statusMap.get(statusKey);
      } else if (t.status) {
        console.warn(`⚠️ Status não encontrado para "${t.status}" em "${t.name}" – usando default.`);
        t.status = undefined;
      }

      // Resolve parent, se informado
      let parentId = null;
      if (t.parent) {
        const parentKey = normalizeKey(t.parent);
        if (createdMap.has(parentKey)) {
          parentId = createdMap.get(parentKey).id;
        } else if (existingMap.has(parentKey)) {
          parentId = existingMap.get(parentKey).id;
        } else {
          console.warn(`⚠️ Parent não encontrado: "${t.parent}" para "${t.name}". Criando sem hierarquia.`);
        }
      }
      t.parent_id = parentId || undefined;

      // Evita duplicados: se já existe uma tarefa com mesmo nome
      const existing = existingMap.get(nameKey);
      if (existing) {
        console.log(`⏭️ Já existe: ${t.name} → ${existing.url || `https://app.clickup.com/t/${existing.id}`}`);
        // Se temos parent e a tarefa atual existir sem parent, tenta atualizar parent
        if (parentId) {
          try {
            await updateTaskParent(existing.id, parentId);
            console.log(`🔗 Reorganizada: ${t.name} agora como subtarefa de "${t.parent}".`);
          } catch (e) {
            console.warn(`⚠️ Falha ao reparentear "${t.name}": ${e.message}`);
          }
        }
        continue;
      }

      const r = await createTask(listId, t);
      console.log(`✅ Criada: ${r.name} [${r.status || 'sem status'}] → ${r.url}`);
      results.push(r);
      createdMap.set(nameKey, { id: r.id, name: r.name, url: r.url });
    } catch (err) {
      // Tenta novamente sem status, caso erro seja de status
      const msg = String(err.message || '');
      const isStatusError = /Status not found|ECODE\":\"CRTSK_001/.test(msg);
      if (isStatusError) {
        try {
          const retryTask = { ...t, status: undefined };
          const r = await createTask(listId, retryTask);
          console.log(`✅ Criada (sem status): ${r.name} → ${r.url}`);
          results.push(r);
          const nameKey = normalizeKey(r.name);
          createdMap.set(nameKey, { id: r.id, name: r.name, url: r.url });
        } catch (e2) {
          console.error(`❌ Erro ao criar "${t.name}" mesmo sem status: ${e2.message}`);
        }
      } else {
        console.error(`❌ Erro ao criar "${t.name}": ${err.message}`);
      }
    }
  }

  console.log(`\n🧾 Concluído. ${results.length}/${tasks.length} criadas.`);
})();
