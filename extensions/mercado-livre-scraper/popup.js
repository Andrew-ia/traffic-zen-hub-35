const statusEl = document.getElementById('status');
const topStatusEl = document.getElementById('top-status');
const outputEl = document.getElementById('output');
const scrapeBtn = document.getElementById('scrape');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');
const topForm = document.getElementById('top-form');
const categoryInput = document.getElementById('category');
const subcategoryInput = document.getElementById('subcategory');
const limitInput = document.getElementById('limit');
const minSoldInput = document.getElementById('minSold');
const topSubmitBtn = document.getElementById('top-submit');

const MESSAGE_SCRAPE = 'SCRAPE_PAGE';
const MESSAGE_SCRAPE_FILTERED = 'SCRAPE_SEARCH_FILTER';

let lastResult = null;

const setStatus = (text, variant = 'neutral') => {
  statusEl.textContent = text;
  statusEl.dataset.variant = variant;
};

const setTopStatus = (text, variant = 'neutral') => {
  topStatusEl.textContent = text;
  topStatusEl.dataset.variant = variant;
};

const setButtonsEnabled = (enabled) => {
  copyBtn.disabled = !enabled;
  downloadBtn.disabled = !enabled;
};

const setTopFormDisabled = (disabled) => {
  [categoryInput, subcategoryInput, limitInput, minSoldInput, topSubmitBtn].forEach((el) => {
    el.disabled = disabled;
  });
};

const sendMessageToTab = (tabId, payload) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });

const formatStatus = (data) => {
  if (!data?.data) return 'Nenhum dado retornado.';
  if (data.data.mode === 'search') {
    const count = data.data.items?.length || 0;
    return `Resultados: ${count} itens${data.data.query ? ` | Termo: ${data.data.query}` : ''}`;
  }
  if (data.data.mode === 'product') {
    return `Produto capturado${data.data.price ? ` | Preço: ${data.data.price} ${data.data.currency || ''}` : ''}`;
  }
  if (data.data.mode === 'category_api') {
    const count = data.data.items?.length || 0;
    return `Top ${count} via API pública (categoria ${data.data.categoryId})`;
  }
  return 'Coleta concluída.';
};

const renderResult = (result) => {
  lastResult = result;
  outputEl.textContent = JSON.stringify(result, null, 2);
  setButtonsEnabled(true);
  setStatus(formatStatus(result), 'success');
};

const onScrape = async () => {
  setStatus('Coletando dados...', 'pending');
  setButtonsEnabled(false);
  outputEl.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('Aba ativa não encontrada.');
    }

    const response = await sendMessageToTab(tab.id, { type: MESSAGE_SCRAPE });
    if (!response?.ok) {
      throw new Error(response?.error || 'A página não respondeu.');
    }
    renderResult(response);
  } catch (error) {
    setStatus(
      error.message.includes('Receiving end does not exist')
        ? 'Abra uma página do Mercado Livre e tente novamente.'
        : `Erro: ${error.message}`,
      'error'
    );
    outputEl.textContent = '';
    lastResult = null;
  }
};

const onCopy = async () => {
  if (!lastResult) return;
  await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
  setStatus('JSON copiado para a área de transferência.', 'success');
};

const onDownload = () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `mercadolivre-scrape-${suffix}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Arquivo JSON baixado.', 'success');
};

const fetchCategoryTopFromApi = async ({ categoryId, limit, minSold }) => {
  const items = [];
  let offset = 0;
  const pageSize = 50;

  while (items.length < limit && offset < 1000) {
    const url = `https://api.mercadolibre.com/sites/MLB/search?category=${encodeURIComponent(
      categoryId
    )}&sort=best_seller&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API pública falhou (${res.status}): ${err || 'sem detalhe'}`);
    }
    const data = await res.json();
    const mapped =
      Array.isArray(data.results) && data.results.length
        ? data.results.map((r) => ({
            id: r.id,
            title: r.title,
            price: r.price,
            currency: r.currency_id,
            sellerId: r.seller?.id || null,
            permalink: r.permalink,
            thumbnail: r.thumbnail,
            condition: r.condition,
            domainId: r.domain_id,
            soldQuantity: r.sold_quantity ?? r.available_quantity ?? 0
          }))
        : [];
    const filtered = mapped.filter((item) => (item.soldQuantity || 0) >= minSold);
    items.push(...filtered);

    const total = data.paging?.total ?? 0;
    offset += pageSize;
    if (offset >= total) break;
  }

  return items.slice(0, limit);
};

const attemptFallbackScrape = async ({ minSold, limit }) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Aba ativa não encontrada para fallback.');
  if (!tab.url || !/mercadolivre\.com/.test(tab.url)) {
    throw new Error('Abra a categoria no Mercado Livre (ordenada por Mais vendidos) e tente de novo.');
  }
  try {
    const response = await sendMessageToTab(tab.id, {
      type: MESSAGE_SCRAPE_FILTERED,
      minSold,
      limit
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Fallback via página falhou.');
    }
    return response;
  } catch (err) {
    throw new Error(
      err?.message?.includes('Receiving end does not exist')
        ? 'Content script não respondeu. Recarregue a aba do Mercado Livre e tente novamente.'
        : err.message || 'Fallback via página falhou.'
    );
  }
};

const onTopSubmit = async (event) => {
  event.preventDefault();
  setTopFormDisabled(true);
  setTopStatus('Consultando API pública...', 'pending');
  setButtonsEnabled(false);
  outputEl.textContent = '';

  const categoryId = (subcategoryInput.value || categoryInput.value || '').trim();
  const limit = Number(limitInput.value || 30);
  const minSold = Number(minSoldInput.value || 0);

  if (!categoryId) {
    setTopStatus('Informe uma categoria ou subcategoria.', 'error');
    setTopFormDisabled(false);
    return;
  }

  try {
    const items = await fetchCategoryTopFromApi({ categoryId, limit, minSold });
    if (!items.length) {
      throw new Error('API não retornou itens suficientes ou filtrou tudo.');
    }
    const result = {
      ok: true,
      scrapedAt: new Date().toISOString(),
      data: {
        mode: 'category_api',
        categoryId,
        minSold,
        limit,
        items
      }
    };
    setTopStatus(`API pública: ${items.length} itens coletados.`, 'success');
    renderResult(result);
  } catch (error) {
    setTopStatus('API pública falhou; tentando scraping da página ativa...', 'pending');
    try {
      const fallback = await attemptFallbackScrape({ minSold, limit });
      setTopStatus('Scraping da página concluído.', 'success');
      renderResult(fallback);
    } catch (fallbackError) {
      setTopStatus(fallbackError.message, 'error');
    }
  } finally {
    setTopFormDisabled(false);
  }
};

scrapeBtn.addEventListener('click', onScrape);
copyBtn.addEventListener('click', onCopy);
downloadBtn.addEventListener('click', onDownload);
topForm.addEventListener('submit', onTopSubmit);
