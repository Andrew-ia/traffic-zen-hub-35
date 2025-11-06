#!/usr/bin/env node
/**
 * Cria tarefas de exemplo em "Metas" e "Campanhas" no Space informado,
 * incluindo subtarefas operacionais da campanha.
 *
 * Uso:
 *   CLICKUP_TOKEN=pk_xxx node scripts/clickup/seed-marketing-examples.js 901311303738
 *   node scripts/clickup/seed-marketing-examples.js 901311303738 pk_xxx
 */

const API = 'https://api.clickup.com/api/v2';
const args = process.argv.slice(2);
const SPACE_ID = args.find(a => /^\d{6,}$/.test(a)) || args[0];
const TOKEN = process.env.CLICKUP_TOKEN || args.find(a => a.startsWith('pk_')) || args[1];

if (!SPACE_ID || !TOKEN) {
  console.error('[ERRO] Informe SPACE_ID e o token (via env CLICKUP_TOKEN ou argumento).');
  process.exit(1);
}

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

async function req(path, options = {}) {
  const res = await fetchCompat(`${API}${path}`, {
    ...options,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt}`);
  }
  return res.json();
}

function dateMs(iso) {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) throw new Error(`Data inválida: ${iso}`);
  return ms;
}

(async () => {
  const lists = await req(`/space/${SPACE_ID}/list`);
  const metas = lists.lists.find(l => l.name === 'Metas');
  const campanhas = lists.lists.find(l => l.name === 'Campanhas');
  if (!metas || !campanhas) throw new Error('Listas "Metas" e/ou "Campanhas" não encontradas no Space.');

  const metaTask = await req(`/list/${metas.id}/task`, {
    method: 'POST',
    body: JSON.stringify({
      name: '🎯 Meta Q4: +30% Leads até 31/12',
      description: 'KPI principal: Leads. Meta: +30% sobre baseline de outubro. CPL alvo <= R$ 12. Atualizar dashboard semanalmente.',
      due_date: dateMs('2025-12-31'),
    }),
  });
  const metaTaskId = metaTask.id;
  console.log(`Meta task ID: ${metaTaskId}`);

  const campMaster = await req(`/list/${campanhas.id}/task`, {
    method: 'POST',
    body: JSON.stringify({
      name: '📣 Campanha: Leads Vermezzo – Novembro (Master)',
      description: 'Campanha cross-canal para geração de leads. Vincule tarefas de Meta Ads, Google Ads e Instagram. Utilize UTMs padronizadas e mantenha cronograma atualizado.',
      due_date: dateMs('2025-11-30'),
    }),
  });
  const campTaskId = campMaster.id;
  console.log(`Campanha task ID: ${campTaskId}`);

  const subtasks = [
    {
      name: 'Materiais criativos – 3 peças',
      description: 'Definir formatos: Imagem (feed), Vídeo (reels), Story. Adicionar links para assets e aprovar com design.',
      due_date: dateMs('2025-11-12'),
    },
    {
      name: 'Cronograma',
      description: 'Produção: até 10/11; Aprovação: 11/11; Publicação: 12/11; Otimização: 13–20/11',
      due_date: dateMs('2025-11-12'),
    },
    {
      name: 'Responsáveis',
      description: 'Design: TBD; Copy: TBD; Mídia: TBD; Social: TBD. Atribuir responsáveis e adicionar checklists.',
      due_date: dateMs('2025-11-11'),
    },
    {
      name: 'Copy (versões)',
      description: 'Versão 1 (feed), Versão 2 (reels), Versão 3 (story). Colar textos e CTAs, revisar com branding.',
      due_date: dateMs('2025-11-10'),
    },
  ];

  for (const st of subtasks) {
    const r = await req(`/list/${campanhas.id}/task`, {
      method: 'POST',
      body: JSON.stringify({ ...st, parent: campTaskId }),
    });
    console.log(`Subtask criada: ${r.id} – ${st.name}`);
  }

  console.log('✅ Tarefas de exemplo criadas com sucesso.');
})().catch(err => {
  console.error('[ERRO]', err.message);
  process.exit(1);
});

