#!/usr/bin/env node
/**
 * Listar IDs de Team, Space (Marketing) e Lists via ClickUp API.
 * Uso:
 *   CLICKUP_TOKEN=pk_xxx node scripts/clickup/list-ids.js
 *   node scripts/clickup/list-ids.js pk_xxx
 *   node scripts/clickup/list-ids.js --json pk_xxx    # saída JSON
 */

const args = process.argv.slice(2);
const wantsJson = args.includes('--json');
const TOKEN = process.env.CLICKUP_TOKEN || args.find(a => a.startsWith('pk_')) || args[0];

if (!TOKEN || TOKEN.startsWith('--')) {
  console.error('[ERRO] Defina CLICKUP_TOKEN no ambiente ou passe o token como argumento.');
  console.error('Exemplos:');
  console.error('  CLICKUP_TOKEN=pk_xxx node scripts/clickup/list-ids.js');
  console.error('  node scripts/clickup/list-ids.js pk_xxx');
  process.exit(1);
}

const API = 'https://api.clickup.com/api/v2';

// Compatibilidade com Node < 18 (sem dependências externas)
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
            json: async () => {
              try {
                return JSON.parse(data);
              } catch (e) {
                throw new Error(`Falha ao parsear JSON: ${e.message}`);
              }
            },
          };
          resolve(response);
        });
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });

async function req(path) {
  const res = await fetchCompat(`${API}${path}`, {
    headers: { Authorization: TOKEN },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt}`);
  }
  return res.json();
}

(async () => {
  const teams = await req('/team');
  const team = teams.teams?.[0];
  if (!team) throw new Error('Nenhum team encontrado');

  const spaces = await req(`/team/${team.id}/space?archived=false`);
  const marketingSpace = spaces.spaces.find(s => /marketing/i.test(s.name)) || spaces.spaces[0];
  if (!marketingSpace) throw new Error('Nenhum space encontrado');

  const lists = await req(`/space/${marketingSpace.id}/list`);

  if (wantsJson) {
    const targetNames = ['KPIs & Reports', 'Meta Ads', 'Google Ads', 'Content Calendar', 'Campanhas', 'Metas'];
    const targets = Object.fromEntries(targetNames.map(n => [n, lists.lists.find(l => l.name === n)?.id || null]));
    const output = {
      team: { id: team.id, name: team.name },
      space: { id: marketingSpace.id, name: marketingSpace.name },
      lists: lists.lists.map(l => ({ id: l.id, name: l.name })),
      targets,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`TEAM_ID=${team.id} NAME=${team.name}`);
  console.log(`SPACE_ID=${marketingSpace.id} NAME=${marketingSpace.name}`);
  for (const l of lists.lists) {
    console.log(`LIST: ${l.id}\t${l.name}`);
  }
  const targetNames = ['KPIs & Reports', 'Meta Ads', 'Google Ads', 'Content Calendar', 'Campanhas', 'Metas'];
  const targets = Object.fromEntries(targetNames.map(n => [n, lists.lists.find(l => l.name === n)?.id || null]));
  console.log('TARGETS:', targets);
})().catch(err => {
  console.error('[ERRO]', err.message);
  process.exit(1);
});
