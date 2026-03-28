const MESSAGE_GET_CONTEXT = 'GET_MARKET_CONTEXT';
const MESSAGE_TOGGLE_PANEL = 'TOGGLE_MARKET_PANEL';
const MESSAGE_OPEN_PANEL = 'OPEN_MARKET_PANEL';
const DEFAULT_PLATFORM_URL = 'http://localhost:8080';
const STORAGE_KEY = 'trafficpro.ml.extension.settings';
const SAVED_CANDIDATES_KEY = 'trafficpro.ml.extension.saved';

const platformUrlInput = document.getElementById('platform-url');
const saveSettingsButton = document.getElementById('save-settings');
const openResearchButton = document.getElementById('open-research');
const openSidePanelButton = document.getElementById('open-side-panel');
const statusEl = document.getElementById('status');
const pageBadgeEl = document.getElementById('page-badge');
const contextSummaryEl = document.getElementById('context-summary');
const primaryActionsEl = document.getElementById('primary-actions');
const itemsListEl = document.getElementById('items-list');
const itemsCountEl = document.getElementById('items-count');
const savedListEl = document.getElementById('saved-list');
const clearSavedButton = document.getElementById('clear-saved');

let currentContext = null;
let currentSettings = { platformUrl: DEFAULT_PLATFORM_URL };

const setStatus = (message) => {
  statusEl.textContent = message;
};

const normalizePlatformUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_PLATFORM_URL;
  return raw.replace(/\/+$/, '');
};

const extractHostLabel = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const queryActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
};

const sendMessageToTab = (tabId, payload) => new Promise((resolve, reject) => {
  chrome.tabs.sendMessage(tabId, payload, (response) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }
    resolve(response);
  });
});

const openPlatformPage = async (path) => {
  const base = normalizePlatformUrl(currentSettings.platformUrl);
  await chrome.tabs.create({ url: `${base}${path}` });
};

const openSidePanelInActiveTab = async () => {
  const tab = await queryActiveTab();
  if (!tab?.id) {
    setStatus('Aba ativa não encontrada.');
    return;
  }

  try {
    const response = await sendMessageToTab(tab.id, { type: MESSAGE_OPEN_PANEL });
    if (!response?.ok) {
      throw new Error(response?.error || 'Não foi possível abrir o painel.');
    }
    setStatus('Painel lateral aberto na aba atual.');
    window.close();
  } catch (error) {
    setStatus(
      error.message.includes('Receiving end does not exist')
        ? 'Recarregue a aba do Mercado Livre e tente novamente.'
        : `Erro: ${error.message}`
    );
  }
};

const saveSettings = async () => {
  currentSettings = {
    platformUrl: normalizePlatformUrl(platformUrlInput.value),
  };
  await chrome.storage.sync.set({ [STORAGE_KEY]: currentSettings });
  platformUrlInput.value = currentSettings.platformUrl;
  setStatus(`Plataforma salva em ${extractHostLabel(currentSettings.platformUrl)}.`);
};

const loadSettings = async () => {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  currentSettings = {
    platformUrl: normalizePlatformUrl(stored?.[STORAGE_KEY]?.platformUrl || DEFAULT_PLATFORM_URL),
  };
  platformUrlInput.value = currentSettings.platformUrl;
};

const getSavedCandidates = async () => {
  const stored = await chrome.storage.local.get(SAVED_CANDIDATES_KEY);
  return Array.isArray(stored?.[SAVED_CANDIDATES_KEY]) ? stored[SAVED_CANDIDATES_KEY] : [];
};

const setSavedCandidates = async (items) => {
  await chrome.storage.local.set({ [SAVED_CANDIDATES_KEY]: items.slice(0, 50) });
};

const saveCandidate = async (item) => {
  if (!item?.mlbId) return;
  const saved = await getSavedCandidates();
  const next = [item, ...saved.filter((entry) => entry.mlbId !== item.mlbId)];
  await setSavedCandidates(next);
  await renderSavedCandidates();
  setStatus(`Candidato ${item.mlbId} salvo.`);
};

const clearSavedCandidates = async () => {
  await setSavedCandidates([]);
  await renderSavedCandidates();
  setStatus('Candidatos limpos.');
};

const buildMetaChip = (label) => `<span class="meta-chip">${label}</span>`;

const formatCurrency = (value, currency = 'BRL') => {
  if (!Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value));
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
};

const formatCompactInteger = (value) => {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value));
};

const formatDatePtBr = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR');
};

const renderPrimaryActions = (context) => {
  primaryActionsEl.innerHTML = '';

  if (context?.mode === 'product' && context.product?.mlbId) {
    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'btn btn-primary';
    analyzeButton.textContent = 'Abrir análise';
    analyzeButton.addEventListener('click', () => openPlatformPage(`/mercado-livre-analyzer?mlb=${context.product.mlbId}`));

    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-secondary';
    saveButton.textContent = 'Salvar candidato';
    saveButton.addEventListener('click', () => saveCandidate({
      mlbId: context.product.mlbId,
      title: context.product.title,
      price: context.product.price,
      permalink: context.product.url || context.pageUrl,
    }));

    primaryActionsEl.append(analyzeButton, saveButton);
    return;
  }

  if (context?.mode === 'search' && (context.items?.length || 0) > 0) {
    const saveAllButton = document.createElement('button');
    saveAllButton.className = 'btn btn-secondary';
    saveAllButton.textContent = 'Salvar visíveis';
    saveAllButton.addEventListener('click', async () => {
      for (const item of context.items.slice(0, 10)) {
        if (item.mlbId) {
          await saveCandidate({
            mlbId: item.mlbId,
            title: item.title,
            price: item.price,
            permalink: item.url,
          });
        }
      }
      setStatus('Itens visíveis salvos.');
    });

    const researchButton = document.createElement('button');
    researchButton.className = 'btn btn-primary';
    researchButton.textContent = 'Abrir pesquisa';
    researchButton.addEventListener('click', () => openPlatformPage('/mercado-livre/pesquisa-mercado'));

    primaryActionsEl.append(saveAllButton, researchButton);
  }
};

const renderContextSummary = (context) => {
  contextSummaryEl.innerHTML = '';

  if (!context) {
    contextSummaryEl.innerHTML = '<div class="empty-state">Abra uma página do Mercado Livre e recarregue a extensão.</div>';
    return;
  }

  if (context.mode === 'product' && context.product) {
    const { product } = context;
    const card = document.createElement('div');
    card.className = 'summary__card';
    card.innerHTML = `
      <p class="summary__title">${product.title || 'Produto atual'}</p>
      <div class="summary__meta">
        ${product.mlbId ? buildMetaChip(product.mlbId) : ''}
        ${Number.isFinite(product.price) ? buildMetaChip(formatCurrency(product.price, product.currency || 'BRL')) : ''}
        ${product.isCatalog ? buildMetaChip('Catálogo') : ''}
        ${product.seller ? buildMetaChip(product.seller) : ''}
        ${product.shipping ? buildMetaChip(product.shipping) : ''}
        ${product.soldText ? buildMetaChip(product.soldText) : ''}
        ${product.estimatedRevenue ? buildMetaChip(`Fat. ${formatCurrency(product.estimatedRevenue, product.currency || 'BRL')}`) : ''}
        ${product.dateCreated ? buildMetaChip(`Criado ${formatDatePtBr(product.dateCreated)}`) : ''}
        ${Number.isFinite(product.ageDays) ? buildMetaChip(`${product.ageDays} dias`) : ''}
      </div>
    `;
    contextSummaryEl.append(card);
    return;
  }

  if (context.mode === 'search') {
    const card = document.createElement('div');
    card.className = 'summary__card';
    card.innerHTML = `
      <p class="summary__title">${context.query || 'Resultados da busca'}</p>
      <div class="summary__meta">
        ${buildMetaChip(`${context.items.length} itens visíveis`)}
        ${context.pageUrl ? buildMetaChip('Busca aberta pelo usuário') : ''}
        ${context.items?.[0]?.position ? buildMetaChip('Com posição visível') : ''}
      </div>
    `;
    contextSummaryEl.append(card);
    return;
  }

  contextSummaryEl.innerHTML = '<div class="empty-state">Nenhum contexto útil detectado nesta página.</div>';
};

const createItemElement = (item, { saved = false } = {}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'item';
  wrapper.innerHTML = `
    <div class="item__top">
      <div>
        <p class="item__title">${item.title || 'Sem título'}</p>
      </div>
      <div class="item__price">${Number.isFinite(item.price) ? formatCurrency(item.price, item.currency || 'BRL') : '—'}</div>
    </div>
    <div class="item__meta">
      ${Number.isFinite(item.position) ? buildMetaChip(`#${item.position}`) : ''}
      ${item.mlbId ? buildMetaChip(item.mlbId) : ''}
      ${item.isCatalog ? buildMetaChip('Catálogo') : ''}
      ${item.seller ? buildMetaChip(item.seller) : ''}
      ${item.shipping ? buildMetaChip(item.shipping) : ''}
      ${item.soldText ? buildMetaChip(item.soldText) : ''}
      ${item.badge ? buildMetaChip(item.badge) : ''}
      ${item.estimatedRevenue ? buildMetaChip(`Fat. ${formatCurrency(item.estimatedRevenue, item.currency || 'BRL')}`) : ''}
      ${Number.isFinite(item.soldCount) ? buildMetaChip(`${formatCompactInteger(item.soldCount)} vendidos`) : ''}
    </div>
    <div class="item__actions"></div>
  `;

  const actions = wrapper.querySelector('.item__actions');

  if (item.mlbId) {
    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'btn btn-primary';
    analyzeButton.textContent = 'Analisar';
    analyzeButton.addEventListener('click', () => openPlatformPage(`/mercado-livre-analyzer?mlb=${item.mlbId}`));
    actions.append(analyzeButton);
  }

  const secondaryButton = document.createElement('button');
  secondaryButton.className = `btn ${saved ? 'btn-danger' : 'btn-secondary'}`;
  secondaryButton.textContent = saved ? 'Abrir anúncio' : 'Salvar';
  secondaryButton.addEventListener('click', async () => {
    if (saved) {
      if (item.permalink) {
        await chrome.tabs.create({ url: item.permalink });
      }
      return;
    }
    await saveCandidate({
      mlbId: item.mlbId,
      title: item.title,
      price: item.price,
      permalink: item.url || item.permalink,
      seller: item.seller,
      soldText: item.soldText,
      shipping: item.shipping,
    });
  });
  actions.append(secondaryButton);

  return wrapper;
};

const renderItems = (context) => {
  itemsListEl.innerHTML = '';
  const items = context?.mode === 'search'
    ? context.items || []
    : context?.mode === 'product' && context.product
      ? [context.product]
      : [];

  itemsCountEl.textContent = String(items.length);

  if (!items.length) {
    itemsListEl.innerHTML = '<div class="empty-state">Nenhum item visível para analisar.</div>';
    return;
  }

  items.slice(0, 8).forEach((item) => {
    itemsListEl.append(createItemElement(item));
  });
};

const renderSavedCandidates = async () => {
  const saved = await getSavedCandidates();
  savedListEl.innerHTML = '';

  if (!saved.length) {
    savedListEl.innerHTML = '<div class="empty-state">Nenhum candidato salvo.</div>';
    return;
  }

  saved.slice(0, 8).forEach((item) => {
    savedListEl.append(createItemElement(item, { saved: true }));
  });
};

const extractContext = async () => {
  const tab = await queryActiveTab();
  if (!tab?.id) {
    setStatus('Aba ativa não encontrada.');
    return;
  }

  try {
    const response = await sendMessageToTab(tab.id, { type: MESSAGE_GET_CONTEXT });
    if (!response?.ok) {
      throw new Error(response?.error || 'A página não respondeu.');
    }

    currentContext = response.data || null;
    pageBadgeEl.textContent =
      currentContext?.mode === 'product'
        ? 'Produto'
        : currentContext?.mode === 'search'
          ? 'Busca'
          : 'Sem contexto';
    setStatus(
      currentContext?.mode === 'product'
        ? 'Produto detectado. Abra a análise completa na plataforma.'
        : currentContext?.mode === 'search'
          ? 'Busca detectada. Você pode analisar os itens visíveis.'
          : 'Nenhum contexto útil detectado.'
    );
    renderContextSummary(currentContext);
    renderPrimaryActions(currentContext);
    renderItems(currentContext);
  } catch (error) {
    setStatus(
      error.message.includes('Receiving end does not exist')
        ? 'Recarregue a aba do Mercado Livre e abra a extensão novamente.'
        : `Erro: ${error.message}`
    );
    currentContext = null;
    renderContextSummary(null);
    renderPrimaryActions(null);
    renderItems(null);
  }
};

saveSettingsButton.addEventListener('click', saveSettings);
openResearchButton.addEventListener('click', () => openPlatformPage('/mercado-livre/pesquisa-mercado'));
openSidePanelButton.addEventListener('click', openSidePanelInActiveTab);
clearSavedButton.addEventListener('click', clearSavedCandidates);

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await renderSavedCandidates();
  await extractContext();
});
