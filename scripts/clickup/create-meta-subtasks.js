/**
 * Create operational subtasks under the Meta Ads campaign task in the Marketing space.
 *
 * Requirements (env vars):
 * - CLICKUP_API_KEY: your ClickUp API token
 * - CLICKUP_TEAM_ID: your ClickUp team ID (e.g., 90132631786)
 *
 * What it does:
 * - Finds the Space named "Marketing" in the given Team
 * - Finds the List named "Meta Ads" in that Space
 * - Locates the master task named "Campanha Meta Ads: Leads Vermezzo" for the current month
 * - Creates a set of operational subtasks under the master task
 */

const API = 'https://api.clickup.com/api/v2';

// Compatible fetch for Node < 18
const fetchCompat = typeof fetch === 'function'
  ? fetch
  : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function main() {
  const token = process.env.CLICKUP_API_KEY || process.env.CLICKUP_TOKEN;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const overrideSpaceId = process.env.MARKETING_SPACE_ID;
  const overrideListId = process.env.META_LIST_ID;
  const parentTaskName = process.env.PARENT_TASK_NAME || 'Campanha Meta Ads: Leads Vermezzo';
  const overrideParentTaskId = process.env.PARENT_TASK_ID;

  if (!token || !teamId) {
    console.error('ERROR: Missing env. Please set CLICKUP_API_KEY and CLICKUP_TEAM_ID.');
    process.exit(1);
  }

  const headers = {
    Authorization: token,
    'Content-Type': 'application/json',
  };

  // 1) Find Marketing space
  let marketingSpaceId = overrideSpaceId;
  if (!marketingSpaceId) {
    const spacesRes = await fetchCompat(`${API}/team/${teamId}/space?archived=false`, { headers });
    if (!spacesRes.ok) {
      const txt = await spacesRes.text();
      throw new Error(`Failed to fetch spaces: ${spacesRes.status} ${txt}`);
    }
    const spacesData = await spacesRes.json();
    const marketingSpace = (spacesData.spaces || []).find((s) => s.name.toLowerCase() === 'marketing');
    if (!marketingSpace) {
      throw new Error('Space "Marketing" not found in this team. Set MARKETING_SPACE_ID to override.');
    }
    marketingSpaceId = marketingSpace.id;
  }

  // 2) Find Meta Ads list
  let metaListId = overrideListId;
  if (!metaListId) {
    const listsRes = await fetchCompat(`${API}/space/${marketingSpaceId}/list`, { headers });
    if (!listsRes.ok) {
      const txt = await listsRes.text();
      throw new Error(`Failed to fetch lists: ${listsRes.status} ${txt}`);
    }
    const listsData = await listsRes.json();
    const metaList = (listsData.lists || []).find((l) => l.name.toLowerCase() === 'meta ads');
    if (!metaList) {
      throw new Error('List "Meta Ads" not found inside Space "Marketing". Set META_LIST_ID to override.');
    }
    metaListId = metaList.id;
  }

  // 3) Find the master campaign task (name contains "Campanha Meta Ads: Leads Vermezzo")
  let masterTaskId = overrideParentTaskId;
  let masterTaskName = parentTaskName;
  if (!masterTaskId) {
    const tasksRes = await fetchCompat(`${API}/list/${metaListId}/task?archived=false&order_by=created&reverse=true`, { headers });
    if (!tasksRes.ok) {
      const txt = await tasksRes.text();
      throw new Error(`Failed to fetch tasks: ${tasksRes.status} ${txt}`);
    }
    const tasksData = await tasksRes.json();
    const tasks = tasksData.tasks || [];
    const masterTask = tasks.find((t) => (t.name || '').toLowerCase().includes(parentTaskName.toLowerCase())) || tasks[0];
    if (!masterTask) {
      throw new Error('No tasks found in "Meta Ads" list to attach subtasks. Set PARENT_TASK_ID to override.');
    }
    masterTaskId = masterTask.id;
    masterTaskName = masterTask.name;
  }

  const subtaskNames = [
    'Definir objetivo e público da campanha',
    'Construir estrutura: campanha, conjuntos e anúncios',
    'Configurar rastreamento: pixel, eventos e UTMs',
    'Produzir e subir criativos aprovados',
    'Configurar orçamento, programação e regras',
    'Publicar e validar tracking (QA)',
    'Monitorar e otimizar diariamente',
    'Relatório semanal de KPIs',
  ];

  console.log(`Parent task: ${masterTaskId} | ${masterTaskName}`);
  const created = [];
  for (const name of subtaskNames) {
    const body = {
      name,
      parent: masterTaskId,
      tags: ['ops', 'meta'],
    };
    const createRes = await fetchCompat(`${API}/list/${metaListId}/task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(`Failed to create subtask "${name}": ${createRes.status} ${txt}`);
    }
    const createdTask = await createRes.json();
    created.push({ id: createdTask.id, name: createdTask.name });
    console.log(`Created subtask: ${createdTask.id} | ${createdTask.name}`);
  }

  console.log('\nSummary:');
  for (const s of created) {
    console.log(`- ${s.id} | ${s.name}`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
