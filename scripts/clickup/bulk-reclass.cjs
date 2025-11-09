#!/usr/bin/env node
/**
 * Bulk reclassification and cleanup for ClickUp lists.
 * - Marks tasks as complete based on name keywords
 * - Optionally assigns custom statuses if present (IDEIA, AVALIAÇÃO, DESIGN, APROVAÇÃO)
 * - Moves technical items from Campanhas to Metas
 *
 * Usage:
 *   CLICKUP_TOKEN=xxx node scripts/clickup/bulk-reclass.cjs --dry-run
 *   CLICKUP_TOKEN=xxx node scripts/clickup/bulk-reclass.cjs --apply
 */

const metasListId = process.env.METAS_LIST_ID || '901322143163';
const campanhasListId = process.env.CAMPANHAS_LIST_ID || '901322143165';
const token = process.env.CLICKUP_TOKEN || process.env.CLICKUP_API_TOKEN || process.env.CUP_TOKEN;

if (!token) {
  console.error('ERROR: CLICKUP_TOKEN is required in env.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const API = 'https://api.clickup.com/api/v2';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}\n${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

async function getListInfo(listId) {
  return api(`/list/${listId}`);
}

async function listTasks(listId, page = 0) {
  // Fetch tasks for a list. Limit 100 per page.
  const data = await api(`/list/${listId}/task?subtasks=true&include_closed=true&page=${page}&order_by=created&reverse=true`);
  return data.tasks || [];
}

async function listAllTasks(listId) {
  let all = [];
  let page = 0;
  while (true) {
    const tasks = await listTasks(listId, page);
    all = all.concat(tasks);
    if (tasks.length < 100) break;
    page += 1;
  }
  return all;
}

async function updateTaskStatus(taskId, status) {
  return api(`/task/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

async function moveTaskToList(taskId, listId) {
  return api(`/task/${taskId}/move`, {
    method: 'POST',
    body: JSON.stringify({ list_id: listId }),
  });
}

function detectCompleted(name) {
  const n = (name || '').toLowerCase();
  return [
    'concluído', 'concluido', 'feito', 'finalizado', 'validado', 'ok', '✓', '✔', '[x]'
  ].some(k => n.includes(k));
}

function detectTechnical(name, tags = []) {
  const text = `${name || ''} ${(tags || []).map(t => t.name).join(' ')}`.toLowerCase();
  return [
    'ga4', 'gtm', 'pixel', 'analytics', 'tag', 'evento', 'event', 'utm', 'domínio', 'dominio', 'url', 'site', 'vermezzo', 'ids', 'conversion', 'conversão', 'conversao', 'tracker'
  ].some(k => text.includes(k));
}

function detectStatusByKeywords(name, listStatuses) {
  const text = (name || '').toLowerCase();
  const available = new Set((listStatuses || []).map(s => (s.status || s.name || '').toLowerCase()));
  if (available.has('ideia') && text.includes('ideia')) return 'IDEIA';
  if (available.has('avaliação') && (text.includes('avaliacao') || text.includes('avaliação') || text.includes('validar'))) return 'AVALIAÇÃO';
  if (available.has('design') && text.includes('design')) return 'DESIGN';
  if (available.has('aprovação') && (text.includes('aprovacao') || text.includes('aprovação') || text.includes('aprovar'))) return 'APROVAÇÃO';
  return null;
}

async function run() {
  const metasInfo = await getListInfo(metasListId);
  const campanhasInfo = await getListInfo(campanhasListId);
  const metasStatuses = metasInfo.statuses || metasInfo.status || [];
  const campanhasStatuses = campanhasInfo.statuses || campanhasInfo.status || [];

  console.log(`Loaded lists: Metas(${metasListId}), Campanhas(${campanhasListId})`);

  // 1) Reclassify Metas
  const metasTasks = await listAllTasks(metasListId);
  const metasPlan = [];
  for (const t of metasTasks) {
    const desiredCustom = detectStatusByKeywords(t.name, metasStatuses);
    const desiredCompleted = detectCompleted(t.name);
    if (desiredCompleted && t.status !== 'complete') {
      metasPlan.push({ type: 'status', task: t, to: 'complete' });
    } else if (desiredCustom && (t.status || '').toLowerCase() !== desiredCustom.toLowerCase()) {
      metasPlan.push({ type: 'status', task: t, to: desiredCustom });
    }
  }

  // 2) Cleanup Campanhas -> move technical to Metas
  const campanhasTasks = await listAllTasks(campanhasListId);
  const movePlan = [];
  for (const t of campanhasTasks) {
    const isTechnical = detectTechnical(t.name, t.tags);
    if (isTechnical) movePlan.push({ type: 'move', task: t, toList: metasListId });
  }

  console.log(`Plan (dry-run=${!APPLY}):`);
  console.log(`- Metas status updates: ${metasPlan.length}`);
  console.log(`- Move technical from Campanhas to Metas: ${movePlan.length}`);

  if (!APPLY) {
    for (const p of metasPlan.slice(0, 10)) {
      console.log(`  [preview] Metas: ${p.task.name} -> ${p.to}`);
    }
    for (const p of movePlan.slice(0, 10)) {
      console.log(`  [preview] Move: ${p.task.name} -> Metas`);
    }
    console.log('Run with --apply to execute changes.');
    return;
  }

  // Execute
  let updated = 0, moved = 0;
  for (const p of metasPlan) {
    try {
      await updateTaskStatus(p.task.id, p.to);
      updated++;
    } catch (e) {
      console.error(`Failed to update ${p.task.id} (${p.task.name}): ${e.message}`);
    }
  }
  for (const p of movePlan) {
    try {
      await moveTaskToList(p.task.id, p.toList);
      moved++;
    } catch (e) {
      console.error(`Failed to move ${p.task.id} (${p.task.name}): ${e.message}`);
    }
  }
  console.log(`Done. Updated statuses: ${updated}, moved: ${moved}.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

