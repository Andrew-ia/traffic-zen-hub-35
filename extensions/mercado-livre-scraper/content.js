const MESSAGE_GET_CONTEXT = 'GET_MARKET_CONTEXT';
const MESSAGE_TOGGLE_PANEL = 'TOGGLE_MARKET_PANEL';
const MESSAGE_OPEN_PANEL = 'OPEN_MARKET_PANEL';
const DEFAULT_CURRENCY = 'BRL';
const DEFAULT_PLATFORM_URL = 'http://localhost:8080';
const STORAGE_KEY = 'trafficpro.ml.extension.settings';
const SAVED_CANDIDATES_KEY = 'trafficpro.ml.extension.saved';
const CALCULATOR_STATE_KEY = 'trafficpro.ml.extension.calculator';
const SEARCH_CONTEXT_CACHE_KEY = 'trafficpro.ml.extension.search-context';

const PANEL_ROOT_ID = 'trafficpro-ml-assistant-root';
const PANEL_LAUNCHER_ID = 'trafficpro-ml-assistant-launcher';
const SEARCH_CARD_SELECTOR = 'li.ui-search-layout__item, div.ui-search-result__wrapper, div.poly-card, li.poly-card';
const INLINE_PRODUCT_WIDGET_ID = 'trafficpro-ml-inline-widget';
const INLINE_SEARCH_BADGE_CLASS = 'trafficpro-ml-search-badge';

let panelOpen = false;
let panelInjected = false;
let savedCandidates = [];
let currentContextCache = null;
let passiveSearchTrackingInitialized = false;
let inlineEnhancementsInitialized = false;
let inlineEnhancementTimer = null;
let inlineEnhancementsRendering = false;
let panelRefreshTimer = null;
let panelRendering = false;

const DEFAULT_CALCULATOR_STATE = {
  productCost: '0',
  extraCosts: '0',
  taxPct: '10',
  feePct: '20',
  targetMarginPct: '15',
};

const readSearchContextCache = () => {
  try {
    const raw = window.localStorage.getItem(SEARCH_CONTEXT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeSearchContextCache = (value) => {
  try {
    window.localStorage.setItem(SEARCH_CONTEXT_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const textFrom = (element) => (element?.textContent || '').trim() || null;

const parseNumber = (raw) => {
  if (!raw) return null;
  const normalized = String(raw)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const parsePriceNode = (root) => {
  if (!root) return null;

  const fraction = textFrom(root.querySelector('.andes-money-amount__fraction'));
  const cents = textFrom(root.querySelector('.andes-money-amount__cents'));
  const currencyText =
    textFrom(root.querySelector('.andes-money-amount__currency-symbol, .andes-money-amount__symbol')) ||
    textFrom(root.querySelector('.andes-money-amount__currency-code'));

  const amount =
    fraction || cents
      ? parseNumber(cents ? `${fraction || '0'}.${String(cents).padEnd(2, '0')}` : fraction)
      : parseNumber(textFrom(root));

  return {
    amount,
    currency: currencyText?.toUpperCase().includes('U$') ? 'USD' : DEFAULT_CURRENCY,
  };
};

const extractMlbId = (value) => {
  if (!value) return null;
  const match = String(value).match(/MLB[-]?(\d+)/i);
  return match ? `MLB${match[1]}` : null;
};

const absoluteUrl = (value) => {
  if (!value) return null;
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return null;
  }
};

const isProductUrl = () => Boolean(extractMlbId(window.location.href));

const parseSoldCount = (raw) => {
  if (!raw) return null;

  const normalized = String(raw).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/([+]?\d+(?:,\d+)?)\s*(mil)?\s*vendid/);
  if (!match) return null;

  const amount = parseNumber(match[1]);
  if (!Number.isFinite(amount)) return null;

  return match[2] ? Math.round(amount * 1000) : Math.round(amount);
};

const safeDecode = (value) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseSearchQuery = () => {
  const url = new URL(window.location.href);
  return (
    url.searchParams.get('as_word') ||
    url.searchParams.get('q') ||
    safeDecode(url.pathname.replace(/^\/+/, '').replace(/-/g, ' ')) ||
    null
  );
};

const parseItemCondition = (text) => {
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized.includes('novo')) return 'Novo';
  if (normalized.includes('usado')) return 'Usado';
  return text;
};

const normalizeKeyword = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatCurrency = (value, currency = 'BRL') => {
  if (!Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
};

const formatCompactInteger = (value) => {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value));
};

const parseFloatSafe = (value, fallback = 0) => {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const estimateRevenue = (price, soldCount) => {
  if (!Number.isFinite(Number(price)) || !Number.isFinite(Number(soldCount))) return null;
  return Number(price) * Number(soldCount);
};

const parseEmbeddedDateCreated = () => {
  const scripts = Array.from(document.querySelectorAll('script'))
    .map((script) => script.textContent || '')
    .join('\n');

  const patterns = [
    /"date_created"\s*:\s*"([^"]+)"/i,
    /"dateCreated"\s*:\s*"([^"]+)"/i,
    /"start_time"\s*:\s*"([^"]+)"/i,
    /"startTime"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = scripts.match(pattern);
    if (!match?.[1]) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
};

const parseEmbeddedNumericField = (patterns) => {
  const scripts = Array.from(document.querySelectorAll('script'))
    .map((script) => script.textContent || '')
    .join('\n');

  for (const pattern of patterns) {
    const match = scripts.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const computeAgeDays = (isoString) => {
  if (!isoString) return null;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const formatDatePtBr = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR');
};

const formatCompactDecimal = (value, digits = 1) => {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
};

const inferCatalogStatus = ({ url, badgeText, cardText, title }) => {
  const combined = `${url || ''} ${badgeText || ''} ${cardText || ''} ${title || ''}`.toLowerCase();
  return combined.includes('/p/') || combined.includes('catálogo') || combined.includes('catalogo');
};

const cacheVisibleSearchItems = (items, query, pageUrl) => {
  const now = new Date().toISOString();
  const cache = readSearchContextCache();
  const nextEntries = {};
  items.slice(0, 50).forEach((item) => {
    if (!item?.mlbId) return;
    nextEntries[item.mlbId] = {
      position: item.position ?? null,
      query: query || null,
      pageUrl: pageUrl || null,
      seenAt: now,
    };
  });
  writeSearchContextCache({
    ...cache,
    ...nextEntries,
  });
};

const cacheClickedSearchItem = (item, query, pageUrl) => {
  if (!item?.mlbId) return;
  const now = new Date().toISOString();
  const cache = readSearchContextCache();
  writeSearchContextCache({
    ...cache,
    [item.mlbId]: {
      ...(cache[item.mlbId] || {}),
      position: item.position ?? cache[item.mlbId]?.position ?? null,
      query: query || cache[item.mlbId]?.query || null,
      pageUrl: pageUrl || cache[item.mlbId]?.pageUrl || null,
      seenAt: now,
      clickedAt: now,
    },
  });
};

const getCachedSearchItem = (mlbId) => {
  if (!mlbId) return null;
  const cache = readSearchContextCache();
  return cache[mlbId] || null;
};

const getCalculatorState = async () => {
  const stored = await chrome.storage.local.get(CALCULATOR_STATE_KEY);
  return {
    ...DEFAULT_CALCULATOR_STATE,
    ...(stored?.[CALCULATOR_STATE_KEY] || {}),
  };
};

const saveCalculatorState = async (nextState) => {
  await chrome.storage.local.set({ [CALCULATOR_STATE_KEY]: nextState });
};

const calculateContribution = (price, state) => {
  const salePrice = Number(price) || 0;
  const productCost = parseFloatSafe(state.productCost);
  const extraCosts = parseFloatSafe(state.extraCosts);
  const taxPct = parseFloatSafe(state.taxPct);
  const feePct = parseFloatSafe(state.feePct);
  const targetMarginPct = parseFloatSafe(state.targetMarginPct);
  const feeAmount = salePrice * (feePct / 100);
  const taxAmount = salePrice * (taxPct / 100);
  const totalBaseCost = productCost + extraCosts;
  const receiveAmount = salePrice - feeAmount - taxAmount;
  const profit = receiveAmount - totalBaseCost;
  const marginPct = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  const markupPct = totalBaseCost > 0 ? (profit / totalBaseCost) * 100 : null;
  const requiredPrice =
    1 - (taxPct + feePct + targetMarginPct) / 100 > 0
      ? totalBaseCost / (1 - (taxPct + feePct + targetMarginPct) / 100)
      : null;

  return {
    salePrice,
    receiveAmount,
    profit,
    marginPct,
    markupPct,
    feeAmount,
    taxAmount,
    productCost,
    extraCosts,
    totalBaseCost,
    requiredPrice,
  };
};

const getInlinePriceRange = (price) => {
  const basePrice = Number(price) || 0;
  if (basePrice <= 0) {
    return {
      min: 1,
      max: 500,
      step: 1,
    };
  }

  const min = Math.max(1, Math.floor(basePrice * 0.55));
  const max = Math.max(min + 10, Math.ceil(basePrice * 1.45));
  const roughStep = basePrice / 120;
  const step = roughStep >= 5 ? 5 : roughStep >= 1 ? 1 : 0.5;

  return { min, max, step };
};

const computeSalesVelocity = (soldCount, ageDays) => {
  if (!Number.isFinite(Number(soldCount)) || !Number.isFinite(Number(ageDays)) || Number(ageDays) <= 0) {
    return {
      perDay: null,
      perMonth: null,
    };
  }

  const perDay = Number(soldCount) / Math.max(1, Number(ageDays));
  return {
    perDay,
    perMonth: perDay * 30,
  };
};

const buildSearchInsights = (items) => {
  const totalSold = items.reduce((sum, item) => sum + (Number(item.soldCount) || 0), 0);
  const totalRevenue = items.reduce((sum, item) => sum + (Number(item.estimatedRevenue) || 0), 0);
  const prices = items.map((item) => Number(item.price)).filter((value) => Number.isFinite(value));
  const officialCount = items.filter((item) => item.isOfficialStore).length;
  const fullCount = items.filter((item) => item.isFull).length;
  const catalogCount = items.filter((item) => item.isCatalog).length;
  const freeShippingCount = items.filter((item) => item.hasFreeShipping).length;
  const topItem = [...items].sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0))[0] || null;

  const stopWords = new Set([
    'de', 'da', 'do', 'dos', 'das', 'para', 'com', 'sem', 'por', 'uma', 'um', 'kit', 'em',
    'e', 'o', 'a', 'os', 'as', 'mlb', 'novo', 'nova',
  ]);

  const keywordMap = new Map();
  items.forEach((item) => {
    normalizeKeyword(item.title)
      .split(' ')
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .forEach((word) => {
        keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
      });
  });

  const topKeywords = [...keywordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return {
    visibleCount: items.length,
    totalSold,
    totalRevenue,
    officialCount,
    fullCount,
    catalogCount,
    freeShippingCount,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    averagePrice: prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null,
    topItem,
    topKeywords,
  };
};

const getPlatformUrl = async () => {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const raw = stored?.[STORAGE_KEY]?.platformUrl || DEFAULT_PLATFORM_URL;
  return String(raw).trim().replace(/\/+$/, '') || DEFAULT_PLATFORM_URL;
};

const getSavedCandidates = async () => {
  const stored = await chrome.storage.local.get(SAVED_CANDIDATES_KEY);
  return Array.isArray(stored?.[SAVED_CANDIDATES_KEY]) ? stored[SAVED_CANDIDATES_KEY] : [];
};

const persistSavedCandidates = async (items) => {
  savedCandidates = items.slice(0, 50);
  await chrome.storage.local.set({ [SAVED_CANDIDATES_KEY]: savedCandidates });
};

const saveCandidate = async (item) => {
  if (!item?.mlbId) return;
  const saved = await getSavedCandidates();
  const next = [item, ...saved.filter((entry) => entry.mlbId !== item.mlbId)];
  await persistSavedCandidates(next);
  renderPanel();
};

const clearSavedCandidates = async () => {
  await persistSavedCandidates([]);
  renderPanel();
};

const openPlatformPage = async (path) => {
  const base = await getPlatformUrl();
  window.open(`${base}${path}`, '_blank', 'noopener,noreferrer');
};

const buildContextFromCache = () => {
  currentContextCache = extractContext();
  return currentContextCache;
};

const parseCard = (card, position = null) => {
  const linkEl =
    card.querySelector('a.ui-search-link') ||
    card.querySelector('a.poly-component__title') ||
    card.querySelector('a.poly-component__title-link') ||
    card.querySelector('a.poly-card__portada') ||
    card.querySelector('a.ui-search-result__content') ||
    card.querySelector('a[href*="MLB"]');

  const url = absoluteUrl(linkEl?.getAttribute('href'));
  const mlbId = extractMlbId(url);
  if (!url && !mlbId) return null;

  const title =
    textFrom(card.querySelector('h2.ui-search-item__title')) ||
    textFrom(card.querySelector('a.poly-component__title')) ||
    textFrom(card.querySelector('h2.poly-box.poly-component__title')) ||
    textFrom(linkEl);

  if (!title) return null;

  const price =
    parsePriceNode(
      card.querySelector(
        '.ui-search-price, .poly-price, .poly-component__price, .ui-search-result__content-price, .andes-money-amount'
      )
    ) || { amount: null, currency: DEFAULT_CURRENCY };

  const shippingText =
    textFrom(card.querySelector('.ui-search-item__shipping, .poly-component__shipping')) ||
    textFrom(card.querySelector('.ui-search-item__group__element--shipping')) ||
    textFrom(card.querySelector('[data-testid="shipping-item"]'));

  const sellerText =
    textFrom(card.querySelector('.ui-search-official-store-label')) ||
    textFrom(card.querySelector('.ui-search-official-store-label-ui-search-item')) ||
    textFrom(card.querySelector('.poly-component__seller')) ||
    textFrom(card.querySelector('.poly-component__brand'));

  const badgeText =
    textFrom(card.querySelector('.ui-search-item__highlight-label__text')) ||
    textFrom(card.querySelector('.poly-component__highlight')) ||
    textFrom(card.querySelector('.poly-component__pill'));

  const subtitleText =
    textFrom(card.querySelector('.ui-search-item__group__element--subtitle')) ||
    textFrom(card.querySelector('.poly-component__subtitle')) ||
    textFrom(card.querySelector('[data-testid="item_subtitle"]'));

  const soldText = subtitleText?.toLowerCase().includes('vendid') ? subtitleText : null;

  const locationText =
    textFrom(card.querySelector('.ui-search-item__group__element--location')) ||
    textFrom(card.querySelector('.poly-component__location'));

  const thumbnail =
    absoluteUrl(card.querySelector('img')?.getAttribute('src')) ||
    absoluteUrl(card.querySelector('img')?.getAttribute('data-src'));

  const officialText = `${sellerText || ''} ${badgeText || ''}`.toLowerCase();
  const shippingNormalized = (shippingText || '').toLowerCase();
  const cardText = textFrom(card);
  const soldCount = parseSoldCount(soldText);
  const isCatalog = inferCatalogStatus({
    url,
    badgeText,
    cardText,
    title,
  });

  return {
    mlbId,
    position,
    title,
    url: url || window.location.href,
    price: price.amount,
    currency: price.currency,
    seller: sellerText,
    shipping: shippingText,
    soldText,
    soldCount,
    estimatedRevenue: estimateRevenue(price.amount, soldCount),
    badge: badgeText,
    thumbnail,
    location: locationText,
    condition: parseItemCondition(subtitleText),
    isCatalog,
    isOfficialStore: officialText.includes('loja oficial') || officialText.includes('official store'),
    isFull: shippingNormalized.includes('full'),
    hasFreeShipping: shippingNormalized.includes('grátis') || shippingNormalized.includes('gratis'),
  };
};

const scrapeVisibleSearchItems = () => {
  const cards = Array.from(document.querySelectorAll(SEARCH_CARD_SELECTOR));

  const items = [];
  const seen = new Set();

  for (const [index, card] of cards.entries()) {
    const item = parseCard(card, index + 1);
    if (!item?.mlbId) continue;
    if (seen.has(item.mlbId)) continue;
    seen.add(item.mlbId);
    items.push(item);
  }

  if (!items.length) return null;

  cacheVisibleSearchItems(items, parseSearchQuery(), window.location.href);

  return {
    mode: 'search',
    pageUrl: window.location.href,
    query: parseSearchQuery(),
    items,
  };
};

const initializePassiveSearchTracking = () => {
  if (passiveSearchTrackingInitialized || isProductUrl()) return;
  passiveSearchTrackingInitialized = true;

  const seedVisibleItems = () => {
    try {
      scrapeVisibleSearchItems();
    } catch {
      // ignore
    }
  };

  seedVisibleItems();
  window.addEventListener('load', seedVisibleItems, { once: true });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const card = target.closest(SEARCH_CARD_SELECTOR);
      if (!card) return;

      const cards = Array.from(document.querySelectorAll(SEARCH_CARD_SELECTOR));
      const item = parseCard(card, Math.max(cards.indexOf(card) + 1, 1));
      if (!item?.mlbId) return;

      cacheClickedSearchItem(item, parseSearchQuery(), window.location.href);
    },
    true
  );
};

const scrapeProductPage = () => {
  if (!isProductUrl()) return null;

  const title =
    textFrom(document.querySelector('h1.ui-pdp-title')) ||
    textFrom(document.querySelector('h1[data-testid="headline"]')) ||
    textFrom(document.querySelector('h1'));

  if (!title) return null;

  const priceRoot =
    document.querySelector('.ui-pdp-price__second-line') ||
    document.querySelector('.ui-pdp-price') ||
    document.querySelector('.andes-money-amount');

  const price = parsePriceNode(priceRoot) || { amount: null, currency: DEFAULT_CURRENCY };

  const seller =
    textFrom(document.querySelector('[data-testid="seller-link"]')) ||
    textFrom(document.querySelector('.ui-pdp-seller__link')) ||
    textFrom(document.querySelector('.ui-pdp-seller__header__title'));

  const shipping =
    textFrom(document.querySelector('.ui-pdp-shipping__title')) ||
    textFrom(document.querySelector('.ui-pdp-shipping__subtitle')) ||
    textFrom(document.querySelector('.ui-pdp-media__shipping'));

  const soldText =
    textFrom(document.querySelector('.ui-pdp-subtitle')) ||
    textFrom(document.querySelector('.ui-pdp-header__subtitle'));

  const subtitle = soldText || '';
  const sellerNormalized = (seller || '').toLowerCase();
  const shippingNormalized = (shipping || '').toLowerCase();
  const badge =
    textFrom(document.querySelector('.ui-pdp-highlight__container')) ||
    textFrom(document.querySelector('.ui-pdp-promotions-pill')) ||
    null;
  const soldCount = parseSoldCount(soldText);
  const isCatalog = inferCatalogStatus({
    url: window.location.href,
    badgeText: badge,
    cardText: textFrom(document.body),
    title,
  });
  const dateCreated = parseEmbeddedDateCreated();
  const ageDays = computeAgeDays(dateCreated);
  const recentSearch = getCachedSearchItem(extractMlbId(window.location.href));
  const availableQuantity = parseEmbeddedNumericField([
    /"available_quantity"\s*:\s*(\d+)/i,
    /"availableQuantity"\s*:\s*(\d+)/i,
  ]);
  const salesVelocity = computeSalesVelocity(soldCount, ageDays);

  const thumbnail =
    absoluteUrl(document.querySelector('.ui-pdp-gallery__figure img')?.getAttribute('src')) ||
    absoluteUrl(document.querySelector('.ui-pdp-image img')?.getAttribute('src')) ||
    absoluteUrl(document.querySelector('img')?.getAttribute('src'));

  return {
    mode: 'product',
    pageUrl: window.location.href,
    product: {
      mlbId: extractMlbId(window.location.href),
      title,
      url: window.location.href,
      price: price.amount,
      currency: price.currency,
      seller,
      shipping,
      soldText,
      soldCount,
      estimatedRevenue: estimateRevenue(price.amount, soldCount),
      dateCreated,
      ageDays,
      availableQuantity,
      salesPerDay: salesVelocity.perDay,
      salesPerMonth: salesVelocity.perMonth,
      recentSearchPosition: recentSearch?.position ?? null,
      recentSearchQuery: recentSearch?.query ?? null,
      badge,
      thumbnail,
      condition: parseItemCondition(subtitle),
      isCatalog,
      isOfficialStore: sellerNormalized.includes('loja oficial') || sellerNormalized.includes('official store'),
      isFull: shippingNormalized.includes('full'),
      hasFreeShipping: shippingNormalized.includes('grátis') || shippingNormalized.includes('gratis'),
    },
  };
};

const extractContext = () => {
  const productContext = scrapeProductPage();
  if (productContext?.product?.mlbId) {
    return productContext;
  }

  const searchContext = scrapeVisibleSearchItems();
  if (searchContext?.items?.length) {
    return searchContext;
  }

  return {
    mode: 'unsupported',
    pageUrl: window.location.href,
    items: [],
  };
};

const injectStyles = () => {
  if (document.getElementById('trafficpro-ml-assistant-styles')) return;

  const style = document.createElement('style');
  style.id = 'trafficpro-ml-assistant-styles';
  style.textContent = `
    #${PANEL_LAUNCHER_ID} {
      position: fixed;
      top: 50%;
      right: 18px;
      transform: translateY(-50%);
      z-index: 2147483646;
      width: 52px;
      height: 52px;
      border-radius: 999px;
      border: 1px solid rgba(52, 99, 235, 0.18);
      background: linear-gradient(180deg, #fff5ae, #ffe600);
      color: #0f172a;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font: 800 14px/1 "SF Pro Display", "Inter", sans-serif;
    }

    #${PANEL_ROOT_ID} {
      position: fixed;
      top: 92px;
      right: 12px;
      width: min(336px, calc(100vw - 24px));
      height: min(calc(100vh - 104px), 780px);
      z-index: 2147483647;
      display: none;
      font-family: "SF Pro Display", "Inter", sans-serif;
    }

    #${PANEL_ROOT_ID}.is-open {
      display: block;
    }

    #${PANEL_ROOT_ID} .tp-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
      pointer-events: none;
    }

    #${PANEL_ROOT_ID} .tp-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      background:
        radial-gradient(circle at top left, rgba(255, 230, 0, 0.14), transparent 26%),
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 18%),
        #f5f7fb;
      border: 1px solid #dbe3f0;
      border-radius: 24px;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    #${PANEL_ROOT_ID} .tp-header {
      padding: 16px 16px 14px;
      border-bottom: 1px solid #dbe3f0;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(14px);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    #${PANEL_ROOT_ID} .tp-kicker {
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 800;
      color: #64748b;
    }

    #${PANEL_ROOT_ID} .tp-title {
      margin-top: 4px;
      font-size: 24px;
      line-height: 1.02;
      font-weight: 800;
      color: #0f172a;
    }

    #${PANEL_ROOT_ID} .tp-subtitle {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.35;
      color: #64748b;
    }

    #${PANEL_ROOT_ID} .tp-close {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      border: 1px solid #dbe3f0;
      background: #fff;
      color: #334155;
      font-size: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }

    #${PANEL_ROOT_ID} .tp-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding: 10px 10px 14px;
      display: grid;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }

    #${PANEL_ROOT_ID} .tp-body::-webkit-scrollbar {
      width: 8px;
    }

    #${PANEL_ROOT_ID} .tp-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }

    #${PANEL_ROOT_ID} .tp-body::-webkit-scrollbar-track {
      background: transparent;
    }

    #${PANEL_ROOT_ID} .tp-card {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #dbe3f0;
      border-radius: 18px;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }

    #${PANEL_ROOT_ID} .tp-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    #${PANEL_ROOT_ID} .tp-card__header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }

    #${PANEL_ROOT_ID} .tp-card__body {
      padding: 10px 12px 12px;
      display: grid;
      gap: 8px;
    }

    #${PANEL_ROOT_ID} .tp-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(37, 99, 235, 0.16);
      background: rgba(37, 99, 235, 0.08);
      color: #2563eb;
      font-size: 12px;
      font-weight: 700;
    }

    #${PANEL_ROOT_ID} .tp-summary-title {
      margin: 0;
      font-size: 17px;
      line-height: 1.25;
      font-weight: 800;
      color: #0f172a;
    }

    #${PANEL_ROOT_ID} .tp-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    #${PANEL_ROOT_ID} .tp-chip {
      border: 1px solid #dbe3f0;
      background: #fff;
      color: #64748b;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
    }

    #${PANEL_ROOT_ID} .tp-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    #${PANEL_ROOT_ID} .tp-button {
      appearance: none;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid #c7d4e8;
      background: #fff;
      color: #0f172a;
      font: 700 13px/1 "SF Pro Display", "Inter", sans-serif;
      cursor: pointer;
      padding: 0 12px;
    }

    #${PANEL_ROOT_ID} .tp-button--primary {
      background: linear-gradient(180deg, #ffe600, #ffe88d);
      border-color: rgba(242, 196, 0, 0.8);
    }

    #${PANEL_ROOT_ID} .tp-button--secondary {
      background: #f7faff;
      color: #2563eb;
      border-color: rgba(37, 99, 235, 0.18);
    }

    #${PANEL_ROOT_ID} .tp-list {
      display: grid;
      gap: 8px;
    }

    #${PANEL_ROOT_ID} .tp-item {
      border: 1px solid #dbe3f0;
      border-radius: 16px;
      padding: 10px;
      background: #fff;
      display: grid;
      gap: 8px;
    }

    #${PANEL_ROOT_ID} .tp-item__row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    #${PANEL_ROOT_ID} .tp-item__image {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      object-fit: cover;
      flex-shrink: 0;
      background: #f8fafc;
    }

    #${PANEL_ROOT_ID} .tp-item__title {
      margin: 0;
      font-size: 13px;
      line-height: 1.3;
      font-weight: 800;
      color: #0f172a;
    }

    #${PANEL_ROOT_ID} .tp-item__price {
      font-size: 14px;
      font-weight: 800;
      color: #2563eb;
      white-space: nowrap;
      flex-shrink: 0;
    }

    #${PANEL_ROOT_ID} .tp-item__stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }

    #${PANEL_ROOT_ID} .tp-stat {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 8px;
    }

    #${PANEL_ROOT_ID} .tp-stat__label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    #${PANEL_ROOT_ID} .tp-stat__value {
      margin-top: 4px;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }

    #${PANEL_ROOT_ID} .tp-empty {
      border: 1px dashed #c7d4e8;
      background: #f8fbff;
      color: #64748b;
      border-radius: 14px;
      padding: 12px;
      font-size: 13px;
      line-height: 1.35;
    }

    #${PANEL_ROOT_ID} .tp-footer-note {
      font-size: 12px;
      line-height: 1.45;
      color: #64748b;
    }

    #${PANEL_ROOT_ID} .tp-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    #${PANEL_ROOT_ID} .tp-field {
      display: grid;
      gap: 4px;
    }

    #${PANEL_ROOT_ID} .tp-field label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
    }

	    #${PANEL_ROOT_ID} .tp-field input {
	      min-height: 38px;
	      border-radius: 12px;
	      border: 1px solid #dbe3f0;
	      background: #fff;
	      padding: 0 10px;
	      font: 700 13px/1 "SF Pro Display", "Inter", sans-serif;
	      color: #0f172a;
	    }

      #${INLINE_PRODUCT_WIDGET_ID} {
        margin: 12px 0 18px;
        border: 1px solid rgba(37, 99, 235, 0.16);
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 24%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
        border-radius: 20px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.09);
        padding: 14px;
        font-family: "SF Pro Display", "Inter", sans-serif;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.08);
        border: 1px solid rgba(37, 99, 235, 0.12);
        color: #2563eb;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__hero {
        margin-top: 10px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__price {
        font-size: 31px;
        line-height: 0.95;
        font-weight: 900;
        color: #0f172a;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__sub {
        margin-top: 6px;
        color: #64748b;
        font-size: 13px;
        line-height: 1.35;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        border: 0;
        background: linear-gradient(180deg, #3b82f6, #2563eb);
        color: #fff;
        font: 800 13px/1 "SF Pro Display", "Inter", sans-serif;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__grid {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__stat {
        border-radius: 16px;
        padding: 10px 12px;
        background: #fff;
        border: 1px solid #e2e8f0;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__stat-label {
        color: #94a3b8;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__stat-value {
        margin-top: 4px;
        color: #0f172a;
        font-size: 15px;
        font-weight: 900;
        line-height: 1.15;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__meta {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__chip {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid #dbe3f0;
        background: #fff;
        color: #475569;
        font-size: 12px;
        font-weight: 700;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__chip--accent {
        border-color: rgba(37, 99, 235, 0.16);
        background: rgba(37, 99, 235, 0.08);
        color: #2563eb;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc {
        margin-top: 14px;
        border-radius: 18px;
        border: 1px solid rgba(124, 58, 237, 0.12);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 245, 255, 0.98)),
          radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 34%);
        padding: 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-kicker {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7c3aed;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-title {
        margin-top: 4px;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
        color: #1e1b4b;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-tag {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(124, 58, 237, 0.12);
        color: #7c3aed;
        font-size: 11px;
        font-weight: 800;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-slider {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__slider-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #475569;
        font-size: 12px;
        font-weight: 700;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__slider-value {
        color: #1e1b4b;
        font-size: 27px;
        line-height: 1;
        font-weight: 900;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__slider {
        width: 100%;
        accent-color: #7c3aed;
        cursor: pointer;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__slider-scale {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__price-input {
        min-height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(124, 58, 237, 0.18);
        background: rgba(255, 255, 255, 0.94);
        padding: 0 12px;
        color: #0f172a;
        font: 800 14px/1 "SF Pro Display", "Inter", sans-serif;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__results {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__result-row,
      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__cost-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.92);
        padding: 11px 12px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__result-row span:first-child,
      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__cost-row span:first-child {
        color: #334155;
        font-size: 13px;
        font-weight: 700;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__result-row strong,
      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__cost-row strong {
        color: #0f172a;
        font-size: 15px;
        font-weight: 900;
        text-align: right;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__costs {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__costs-title {
        color: #7c3aed;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__config {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__field {
        display: grid;
        gap: 4px;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__field label {
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__field input {
        min-height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(255, 255, 255, 0.94);
        padding: 0 10px;
        color: #0f172a;
        font: 700 13px/1 "SF Pro Display", "Inter", sans-serif;
      }

      #${INLINE_PRODUCT_WIDGET_ID} .tp-inline__calc-note {
        margin-top: 10px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.4;
      }

      .${INLINE_SEARCH_BADGE_CLASS} {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0 0 10px;
        padding: 0;
      }

      .${INLINE_SEARCH_BADGE_CLASS}__pill {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 0 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(148, 163, 184, 0.28);
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
        color: #334155;
        font: 800 11px/1 "SF Pro Display", "Inter", sans-serif;
      }

      .${INLINE_SEARCH_BADGE_CLASS}__pill--blue {
        border-color: rgba(37, 99, 235, 0.14);
        color: #2563eb;
      }

      .${INLINE_SEARCH_BADGE_CLASS}__pill--green {
        border-color: rgba(15, 159, 110, 0.18);
        color: #0f9f6e;
      }
	  `;

  document.documentElement.appendChild(style);
};

const ensurePanelShell = () => {
  if (panelInjected) return;

  injectStyles();

  const launcher = document.createElement('button');
  launcher.id = PANEL_LAUNCHER_ID;
  launcher.type = 'button';
  launcher.title = 'Abrir painel do Traffic Pro';
  launcher.textContent = 'TP';
  launcher.addEventListener('click', () => {
    panelOpen = !panelOpen;
    renderPanel();
  });

  const root = document.createElement('div');
  root.id = PANEL_ROOT_ID;
  root.innerHTML = `
    <div class="tp-backdrop"></div>
    <aside class="tp-panel" aria-label="Painel lateral Traffic Pro">
      <div class="tp-header">
        <div>
          <div class="tp-kicker">Traffic Pro</div>
          <div class="tp-title">Painel ML</div>
          <div class="tp-subtitle">Leia apenas a página que você já abriu e envie os melhores candidatos para análise.</div>
        </div>
        <button class="tp-close" type="button" aria-label="Fechar painel">×</button>
      </div>
      <div class="tp-body"></div>
    </aside>
  `;

  root.querySelector('.tp-backdrop').addEventListener('click', () => {
    panelOpen = false;
    renderPanel();
  });

  root.querySelector('.tp-close').addEventListener('click', () => {
    panelOpen = false;
    renderPanel();
  });

  document.documentElement.append(launcher, root);
  panelInjected = true;
};

const chip = (label) => `<span class="tp-chip">${label}</span>`;

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
	    .replace(/'/g, '&#039;');

const findProductWidgetAnchor = () =>
  document.querySelector('.ui-pdp-header') ||
  document.querySelector('.ui-pdp-container__top-wrapper') ||
  document.querySelector('.ui-pdp-container--pdp') ||
  document.querySelector('.ui-pdp');

const buildInlineChip = (label, accent = false) =>
  `<span class="tp-inline__chip${accent ? ' tp-inline__chip--accent' : ''}">${escapeHtml(label)}</span>`;

const renderInlineProductWidget = async (product) => {
  const anchor = findProductWidgetAnchor();
  const existing = document.getElementById(INLINE_PRODUCT_WIDGET_ID);

  if (!anchor || !product) {
    existing?.remove();
    return;
  }

  const widget = existing || document.createElement('section');
  widget.id = INLINE_PRODUCT_WIDGET_ID;

  const revenueLabel = product.estimatedRevenue
    ? formatCurrency(product.estimatedRevenue, product.currency || 'BRL')
    : '—';
  const createdLabel = product.dateCreated ? formatDatePtBr(product.dateCreated) : '—';
  const ageLabel = Number.isFinite(product.ageDays) ? `${formatCompactInteger(product.ageDays)} dias` : '—';
  const salesPerMonthLabel = Number.isFinite(product.salesPerMonth)
    ? `${formatCompactInteger(product.salesPerMonth)}/mês`
    : '—';
  const salesPerDayLabel = Number.isFinite(product.salesPerDay)
    ? `${formatCompactDecimal(product.salesPerDay, 1)}/dia`
    : '—';
  const searchPositionLabel = Number.isFinite(product.recentSearchPosition) ? `#${product.recentSearchPosition}` : 'Sem posição';
  const calculatorState = await getCalculatorState();
  const priceRange = getInlinePriceRange(product.price);
  let targetPrice = clampNumber(Number(product.price) || priceRange.min, priceRange.min, priceRange.max);

  widget.innerHTML = `
    <div class="tp-inline__eyebrow">Traffic Pro ML</div>
    <div class="tp-inline__hero">
      <div>
        <div class="tp-inline__price">${Number.isFinite(product.price) ? formatCurrency(product.price, product.currency || 'BRL') : '—'}</div>
        <div class="tp-inline__sub">
          ${product.soldText ? `${escapeHtml(product.soldText)} · ` : ''}Fat. estimado ${revenueLabel}
        </div>
      </div>
      <button type="button" class="tp-inline__cta">Abrir análise</button>
    </div>
    <div class="tp-inline__grid">
      <div class="tp-inline__stat">
        <div class="tp-inline__stat-label">Posição na busca</div>
        <div class="tp-inline__stat-value">${searchPositionLabel}</div>
      </div>
      <div class="tp-inline__stat">
        <div class="tp-inline__stat-label">Média de vendas</div>
        <div class="tp-inline__stat-value">${salesPerMonthLabel}</div>
      </div>
      <div class="tp-inline__stat">
        <div class="tp-inline__stat-label">Velocidade atual</div>
        <div class="tp-inline__stat-value">${salesPerDayLabel}</div>
      </div>
      <div class="tp-inline__stat">
        <div class="tp-inline__stat-label">Criado em</div>
        <div class="tp-inline__stat-value">${createdLabel} · ${ageLabel}</div>
      </div>
    </div>
    <div class="tp-inline__meta">
      ${product.isCatalog ? buildInlineChip('Catálogo', true) : ''}
      ${product.isFull ? buildInlineChip('Full') : ''}
      ${product.isOfficialStore ? buildInlineChip('Loja oficial') : ''}
      ${product.hasFreeShipping ? buildInlineChip('Frete grátis') : ''}
      ${Number.isFinite(product.availableQuantity) ? buildInlineChip(`Estoque ${formatCompactInteger(product.availableQuantity)}`) : ''}
      ${product.recentSearchQuery ? buildInlineChip(`Busca: ${product.recentSearchQuery}`) : ''}
    </div>
    <div class="tp-inline__calc"></div>
  `;

  widget.querySelector('.tp-inline__cta')?.addEventListener('click', () => {
    if (product.mlbId) {
      openPlatformPage(`/mercado-livre-analyzer?mlb=${product.mlbId}`);
    }
  });

  const calculatorRoot = widget.querySelector('.tp-inline__calc');
  const renderCalculator = async () => {
    const result = calculateContribution(targetPrice, calculatorState);
    calculatorRoot.innerHTML = `
      <div class="tp-inline__calc-head">
        <div>
          <div class="tp-inline__calc-kicker">Precificador</div>
          <div class="tp-inline__calc-title">Calculadora de margem</div>
        </div>
        <div class="tp-inline__calc-tag">Produto</div>
      </div>
      <div class="tp-inline__calc-slider">
        <div class="tp-inline__slider-label">
          <span>Preço alvo de venda</span>
          <strong>${formatCurrency(targetPrice, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__slider-value">${formatCurrency(targetPrice, product.currency || 'BRL')}</div>
        <input
          class="tp-inline__slider"
          type="range"
          min="${priceRange.min}"
          max="${priceRange.max}"
          step="${priceRange.step}"
          value="${targetPrice}"
          data-inline-field="targetPriceRange"
        />
        <div class="tp-inline__slider-scale">
          <span>${formatCurrency(priceRange.min, product.currency || 'BRL')}</span>
          <span>${formatCurrency(priceRange.max, product.currency || 'BRL')}</span>
        </div>
        <input
          class="tp-inline__price-input"
          type="number"
          min="${priceRange.min}"
          max="${priceRange.max}"
          step="${priceRange.step}"
          value="${targetPrice.toFixed(2)}"
          data-inline-field="targetPriceInput"
        />
      </div>
      <div class="tp-inline__results">
        <div class="tp-inline__result-row">
          <span>Voce recebe</span>
          <strong>${formatCurrency(result.receiveAmount, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__result-row">
          <span>Lucro</span>
          <strong>${formatCurrency(result.profit, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__result-row">
          <span>Margem/venda</span>
          <strong>${Number.isFinite(result.marginPct) ? `${result.marginPct.toFixed(2)}%` : '—'}</strong>
        </div>
        <div class="tp-inline__result-row">
          <span>Markup</span>
          <strong>${Number.isFinite(result.markupPct) ? `${result.markupPct.toFixed(2)}%` : '—'}</strong>
        </div>
      </div>
      <div class="tp-inline__costs">
        <div class="tp-inline__costs-title">Custos de venda</div>
        <div class="tp-inline__cost-row">
          <span>Tarifa ML (${parseFloatSafe(calculatorState.feePct).toFixed(1)}%)</span>
          <strong>${formatCurrency(result.feeAmount, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__cost-row">
          <span>Impostos (${parseFloatSafe(calculatorState.taxPct).toFixed(1)}%)</span>
          <strong>${formatCurrency(result.taxAmount, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__cost-row">
          <span>Custo produto</span>
          <strong>${formatCurrency(result.productCost, product.currency || 'BRL')}</strong>
        </div>
        <div class="tp-inline__cost-row">
          <span>Custos extras</span>
          <strong>${formatCurrency(result.extraCosts, product.currency || 'BRL')}</strong>
        </div>
      </div>
      <div class="tp-inline__config">
        <div class="tp-inline__field">
          <label>Custo produto</label>
          <input data-state-field="productCost" value="${escapeHtml(calculatorState.productCost)}" />
        </div>
        <div class="tp-inline__field">
          <label>Custos extras</label>
          <input data-state-field="extraCosts" value="${escapeHtml(calculatorState.extraCosts)}" />
        </div>
        <div class="tp-inline__field">
          <label>Impostos %</label>
          <input data-state-field="taxPct" value="${escapeHtml(calculatorState.taxPct)}" />
        </div>
        <div class="tp-inline__field">
          <label>Taxas ML %</label>
          <input data-state-field="feePct" value="${escapeHtml(calculatorState.feePct)}" />
        </div>
        <div class="tp-inline__field">
          <label>Margem alvo %</label>
          <input data-state-field="targetMarginPct" value="${escapeHtml(calculatorState.targetMarginPct)}" />
        </div>
      </div>
      <div class="tp-inline__calc-note">
        Preco minimo para bater a margem alvo: <strong>${result.requiredPrice ? formatCurrency(result.requiredPrice, product.currency || 'BRL') : '—'}</strong>
      </div>
    `;

    calculatorRoot.querySelector('[data-inline-field="targetPriceRange"]')?.addEventListener('input', (event) => {
      targetPrice = clampNumber(Number(event.currentTarget.value) || targetPrice, priceRange.min, priceRange.max);
      void renderCalculator();
    });

    calculatorRoot.querySelector('[data-inline-field="targetPriceInput"]')?.addEventListener('change', (event) => {
      targetPrice = clampNumber(Number(event.currentTarget.value) || targetPrice, priceRange.min, priceRange.max);
      void renderCalculator();
    });

    calculatorRoot.querySelectorAll('input[data-state-field]').forEach((input) => {
      input.addEventListener('change', async (event) => {
        const field = event.currentTarget.getAttribute('data-state-field');
        calculatorState[field] = event.currentTarget.value;
        await saveCalculatorState(calculatorState);
        await renderCalculator();
        schedulePanelRefresh();
      });
    });
  };

  await renderCalculator();

  if (!existing) {
    anchor.insertAdjacentElement('afterend', widget);
  }
};

const buildSearchBadgePill = (label, tone = 'default') =>
  `<span class="${INLINE_SEARCH_BADGE_CLASS}__pill${tone === 'blue' ? ` ${INLINE_SEARCH_BADGE_CLASS}__pill--blue` : tone === 'green' ? ` ${INLINE_SEARCH_BADGE_CLASS}__pill--green` : ''}">${escapeHtml(label)}</span>`;

const renderSearchCardBadges = () => {
  if (isProductUrl()) {
    document.querySelectorAll(`.${INLINE_SEARCH_BADGE_CLASS}`).forEach((node) => node.remove());
    return;
  }

  const cards = Array.from(document.querySelectorAll(SEARCH_CARD_SELECTOR));
  cards.forEach((card, index) => {
    const item = parseCard(card, index + 1);
    const existing = card.querySelector(`.${INLINE_SEARCH_BADGE_CLASS}`);

    if (!item?.mlbId) {
      existing?.remove();
      return;
    }

    const badgeRoot = existing || document.createElement('div');
    badgeRoot.className = INLINE_SEARCH_BADGE_CLASS;
    badgeRoot.innerHTML = `
      ${Number.isFinite(item.position) ? buildSearchBadgePill(`#${item.position}`, 'blue') : ''}
      ${item.estimatedRevenue ? buildSearchBadgePill(`Fat. ${formatCurrency(item.estimatedRevenue, item.currency || 'BRL')}`, 'green') : ''}
      ${Number.isFinite(item.soldCount) ? buildSearchBadgePill(`${formatCompactInteger(item.soldCount)} vendidos`) : ''}
      ${item.isCatalog ? buildSearchBadgePill('Catálogo') : ''}
      ${item.isFull ? buildSearchBadgePill('Full') : ''}
    `;

    if (!existing) {
      const target =
        card.querySelector('.ui-search-result__content, .poly-card__content, .poly-component__content, .poly-card') ||
        card.firstElementChild ||
        card;
      target.insertAdjacentElement('afterbegin', badgeRoot);
    }
  });
};

const renderInlineEnhancements = async () => {
  inlineEnhancementsRendering = true;
  try {
  const context = buildContextFromCache();
  if (context.mode === 'product' && context.product) {
    await renderInlineProductWidget(context.product);
  } else {
    document.getElementById(INLINE_PRODUCT_WIDGET_ID)?.remove();
  }
  renderSearchCardBadges();
  } finally {
    inlineEnhancementsRendering = false;
  }
};

const scheduleInlineEnhancements = () => {
  if (inlineEnhancementTimer) {
    window.clearTimeout(inlineEnhancementTimer);
  }
  inlineEnhancementTimer = window.setTimeout(() => {
    void renderInlineEnhancements();
  }, 220);
};

const schedulePanelRefresh = () => {
  if (!panelOpen) return;
  if (panelRefreshTimer) {
    window.clearTimeout(panelRefreshTimer);
  }
  panelRefreshTimer = window.setTimeout(() => {
    renderPanel();
  }, 260);
};

const initializeInlineEnhancements = () => {
  if (inlineEnhancementsInitialized) return;
  inlineEnhancementsInitialized = true;

  scheduleInlineEnhancements();
  window.addEventListener('load', scheduleInlineEnhancements, { once: true });
  window.addEventListener('popstate', scheduleInlineEnhancements);
  window.addEventListener('hashchange', scheduleInlineEnhancements);

  const observer = new MutationObserver(() => {
    if (inlineEnhancementsRendering) return;
    scheduleInlineEnhancements();
    if (panelRendering) return;
    schedulePanelRefresh();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

const createItemElement = (item, { saved = false } = {}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'tp-item';

  const image = item.thumbnail
    ? `<img class="tp-item__image" src="${escapeHtml(item.thumbnail)}" alt="">`
    : '<div class="tp-item__image"></div>';

  wrapper.innerHTML = `
    <div class="tp-item__row">
      ${image}
      <div style="min-width:0; flex:1; display:grid; gap:8px;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <p class="tp-item__title">${escapeHtml(item.title || 'Sem título')}</p>
          <div class="tp-item__price">${Number.isFinite(item.price) ? formatCurrency(item.price, item.currency || 'BRL') : '—'}</div>
        </div>
        <div class="tp-meta">
          ${Number.isFinite(item.position) ? chip(`#${item.position}`) : ''}
          ${item.mlbId ? chip(item.mlbId) : ''}
          ${item.isCatalog ? chip('Catálogo') : ''}
          ${item.seller ? chip(escapeHtml(item.seller)) : ''}
          ${item.shipping ? chip(escapeHtml(item.shipping)) : ''}
          ${item.soldText ? chip(escapeHtml(item.soldText)) : ''}
          ${item.badge ? chip(escapeHtml(item.badge)) : ''}
          ${item.isFull ? chip('Full') : ''}
          ${item.isOfficialStore ? chip('Loja oficial') : ''}
          ${item.hasFreeShipping ? chip('Frete grátis') : ''}
        </div>
        <div class="tp-item__stats">
          <div class="tp-stat">
            <div class="tp-stat__label">Vendidos</div>
            <div class="tp-stat__value">${Number.isFinite(item.soldCount) ? formatCompactInteger(item.soldCount) : '—'}</div>
          </div>
          <div class="tp-stat">
            <div class="tp-stat__label">Fat. estimado</div>
            <div class="tp-stat__value">${item.estimatedRevenue ? formatCurrency(item.estimatedRevenue, item.currency || 'BRL') : '—'}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="tp-actions"></div>
  `;

  const actions = wrapper.querySelector('.tp-actions');

  if (item.mlbId) {
    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'tp-button tp-button--primary';
    analyzeButton.type = 'button';
    analyzeButton.textContent = 'Abrir análise';
    analyzeButton.addEventListener('click', () => openPlatformPage(`/mercado-livre-analyzer?mlb=${item.mlbId}`));
    actions.append(analyzeButton);
  }

  const secondaryButton = document.createElement('button');
  secondaryButton.className = 'tp-button tp-button--secondary';
  secondaryButton.type = 'button';
  secondaryButton.textContent = saved ? 'Abrir anúncio' : 'Salvar candidato';
  secondaryButton.addEventListener('click', async () => {
    if (saved) {
      if (item.permalink || item.url) {
        window.open(item.permalink || item.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    await saveCandidate({
      mlbId: item.mlbId,
      title: item.title,
      price: item.price,
      currency: item.currency,
      permalink: item.url || item.permalink,
      seller: item.seller,
      soldText: item.soldText,
      shipping: item.shipping,
      thumbnail: item.thumbnail,
    });
  });
  actions.append(secondaryButton);

  return wrapper;
};

const createSection = (title, rightLabel) => {
  const section = document.createElement('section');
  section.className = 'tp-card';
  section.innerHTML = `
    <div class="tp-card__header">
      <h3>${escapeHtml(title)}</h3>
      ${rightLabel ? `<span class="tp-pill">${escapeHtml(rightLabel)}</span>` : ''}
    </div>
    <div class="tp-card__body"></div>
  `;
  return section;
};

const appendSearchInsightsSection = (body, context) => {
  const insights = buildSearchInsights(context.items || []);
  const section = createSection('Dados da página', 'Busca');
  const sectionBody = section.querySelector('.tp-card__body');

  sectionBody.innerHTML = `
    <div class="tp-item__stats">
      <div class="tp-stat">
        <div class="tp-stat__label">Vendidos visíveis</div>
        <div class="tp-stat__value">${formatCompactInteger(insights.totalSold)}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Fat. estimado</div>
        <div class="tp-stat__value">${formatCurrency(insights.totalRevenue)}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Faixa de preço</div>
        <div class="tp-stat__value">${insights.minPrice != null && insights.maxPrice != null ? `${formatCurrency(insights.minPrice)} - ${formatCurrency(insights.maxPrice)}` : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Preço médio</div>
        <div class="tp-stat__value">${insights.averagePrice != null ? formatCurrency(insights.averagePrice) : '—'}</div>
      </div>
    </div>
    <div class="tp-meta">
      ${chip(`${insights.catalogCount} catálogo`)}
      ${chip(`${insights.officialCount} oficial`)}
      ${chip(`${insights.fullCount} full`)}
      ${chip(`${insights.freeShippingCount} frete grátis`)}
    </div>
    ${
      insights.topKeywords.length
        ? `<div class="tp-meta">${insights.topKeywords.map(([word, count]) => chip(`${escapeHtml(word)} · ${count}`)).join('')}</div>`
        : ''
    }
  `;

  body.append(section);

  if (insights.topItem) {
    const topSection = createSection('Mais forte da página', 'Ranking');
    const topBody = topSection.querySelector('.tp-card__body');
    topBody.append(createItemElement(insights.topItem));
    body.append(topSection);
  }
};

const appendProductMetricsSection = (body, product) => {
  const section = createSection('Métricas do anúncio', product.isCatalog ? 'Catálogo' : 'Anúncio');
  const sectionBody = section.querySelector('.tp-card__body');
  sectionBody.innerHTML = `
    <div class="tp-item__stats">
      <div class="tp-stat">
        <div class="tp-stat__label">Vendidos</div>
        <div class="tp-stat__value">${Number.isFinite(product.soldCount) ? formatCompactInteger(product.soldCount) : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Estoque</div>
        <div class="tp-stat__value">${Number.isFinite(product.availableQuantity) ? formatCompactInteger(product.availableQuantity) : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Vendas / dia</div>
        <div class="tp-stat__value">${Number.isFinite(product.salesPerDay) ? product.salesPerDay.toFixed(2) : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Vendas / mês</div>
        <div class="tp-stat__value">${Number.isFinite(product.salesPerMonth) ? formatCompactInteger(product.salesPerMonth) : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Criado em</div>
        <div class="tp-stat__value">${formatDatePtBr(product.dateCreated)}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Idade</div>
        <div class="tp-stat__value">${Number.isFinite(product.ageDays) ? `${product.ageDays} dias` : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Posição vista</div>
        <div class="tp-stat__value">${Number.isFinite(product.recentSearchPosition) ? `#${product.recentSearchPosition}` : '—'}</div>
      </div>
      <div class="tp-stat">
        <div class="tp-stat__label">Busca origem</div>
        <div class="tp-stat__value">${product.recentSearchQuery ? escapeHtml(product.recentSearchQuery) : '—'}</div>
      </div>
    </div>
    <div class="tp-meta">
      ${product.isCatalog ? chip('Tag catálogo') : ''}
      ${product.isFull ? chip('Full') : ''}
      ${product.isOfficialStore ? chip('Loja oficial') : ''}
      ${product.hasFreeShipping ? chip('Frete grátis') : ''}
      ${product.condition ? chip(product.condition) : ''}
    </div>
  `;
  body.append(section);
};

const appendContributionCalculatorSection = async (body, product) => {
  const calculatorState = await getCalculatorState();
  const section = createSection('Calculadora de contribuição', 'Produto');
  const sectionBody = section.querySelector('.tp-card__body');

  const render = async () => {
    const result = calculateContribution(product.price, calculatorState);
    sectionBody.innerHTML = `
      <div class="tp-form-grid">
        <div class="tp-field">
          <label>Custo produto</label>
          <input data-field="productCost" value="${escapeHtml(calculatorState.productCost)}" />
        </div>
        <div class="tp-field">
          <label>Custos extras</label>
          <input data-field="extraCosts" value="${escapeHtml(calculatorState.extraCosts)}" />
        </div>
        <div class="tp-field">
          <label>Impostos %</label>
          <input data-field="taxPct" value="${escapeHtml(calculatorState.taxPct)}" />
        </div>
        <div class="tp-field">
          <label>Taxas ML %</label>
          <input data-field="feePct" value="${escapeHtml(calculatorState.feePct)}" />
        </div>
        <div class="tp-field">
          <label>Margem alvo %</label>
          <input data-field="targetMarginPct" value="${escapeHtml(calculatorState.targetMarginPct)}" />
        </div>
      </div>
      <div class="tp-item__stats">
        <div class="tp-stat">
          <div class="tp-stat__label">Preço atual</div>
          <div class="tp-stat__value">${formatCurrency(result.salePrice, product.currency || 'BRL')}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Lucro estimado</div>
          <div class="tp-stat__value">${formatCurrency(result.profit, product.currency || 'BRL')}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Margem</div>
          <div class="tp-stat__value">${Number.isFinite(result.marginPct) ? `${result.marginPct.toFixed(1)}%` : '—'}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Preço mínimo alvo</div>
          <div class="tp-stat__value">${result.requiredPrice ? formatCurrency(result.requiredPrice, product.currency || 'BRL') : '—'}</div>
        </div>
      </div>
    `;

    sectionBody.querySelectorAll('input[data-field]').forEach((input) => {
      input.addEventListener('change', async (event) => {
        const field = event.currentTarget.getAttribute('data-field');
        calculatorState[field] = event.currentTarget.value;
        await saveCalculatorState(calculatorState);
        await render();
      });
    });
  };

  await render();
  body.append(section);
};

const renderPanel = async () => {
  panelRendering = true;
  try {
  ensurePanelShell();

  const root = document.getElementById(PANEL_ROOT_ID);
  const body = root.querySelector('.tp-body');
  root.classList.toggle('is-open', panelOpen);

  if (!panelOpen) return;

  savedCandidates = await getSavedCandidates();
  const context = buildContextFromCache();

  body.innerHTML = '';

  const overview = createSection(
    context.mode === 'product' ? 'Produto atual' : context.mode === 'search' ? 'Busca atual' : 'Sem contexto',
    context.mode === 'product' ? 'Produto' : context.mode === 'search' ? 'Busca' : null
  );
  const overviewBody = overview.querySelector('.tp-card__body');

  if (context.mode === 'product' && context.product) {
    overviewBody.innerHTML = `
      <p class="tp-summary-title">${escapeHtml(context.product.title)}</p>
      <div class="tp-meta">
        ${context.product.mlbId ? chip(context.product.mlbId) : ''}
        ${Number.isFinite(context.product.price) ? chip(formatCurrency(context.product.price, context.product.currency || 'BRL')) : ''}
        ${context.product.isCatalog ? chip('Catálogo') : ''}
        ${context.product.seller ? chip(escapeHtml(context.product.seller)) : ''}
        ${context.product.shipping ? chip(escapeHtml(context.product.shipping)) : ''}
        ${context.product.soldText ? chip(escapeHtml(context.product.soldText)) : ''}
        ${context.product.isFull ? chip('Full') : ''}
        ${context.product.isOfficialStore ? chip('Loja oficial') : ''}
        ${context.product.hasFreeShipping ? chip('Frete grátis') : ''}
      </div>
    `;

    if (Number.isFinite(context.product.soldCount) || context.product.estimatedRevenue) {
      const stats = document.createElement('div');
      stats.className = 'tp-item__stats';
      stats.innerHTML = `
        <div class="tp-stat">
          <div class="tp-stat__label">Vendidos</div>
          <div class="tp-stat__value">${Number.isFinite(context.product.soldCount) ? formatCompactInteger(context.product.soldCount) : '—'}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Fat. estimado</div>
          <div class="tp-stat__value">${context.product.estimatedRevenue ? formatCurrency(context.product.estimatedRevenue, context.product.currency || 'BRL') : '—'}</div>
        </div>
      `;
      overviewBody.append(stats);
    }

    if (context.product.dateCreated || Number.isFinite(context.product.ageDays)) {
      const metaStats = document.createElement('div');
      metaStats.className = 'tp-item__stats';
      metaStats.innerHTML = `
        <div class="tp-stat">
          <div class="tp-stat__label">Criado em</div>
          <div class="tp-stat__value">${formatDatePtBr(context.product.dateCreated)}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Idade</div>
          <div class="tp-stat__value">${Number.isFinite(context.product.ageDays) ? `${context.product.ageDays} dias` : '—'}</div>
        </div>
      `;
      overviewBody.append(metaStats);
    }

    if (Number.isFinite(context.product.recentSearchPosition) || context.product.recentSearchQuery) {
      const searchStats = document.createElement('div');
      searchStats.className = 'tp-item__stats';
      searchStats.innerHTML = `
        <div class="tp-stat">
          <div class="tp-stat__label">Posição vista</div>
          <div class="tp-stat__value">${Number.isFinite(context.product.recentSearchPosition) ? `#${context.product.recentSearchPosition}` : '—'}</div>
        </div>
        <div class="tp-stat">
          <div class="tp-stat__label">Busca origem</div>
          <div class="tp-stat__value">${context.product.recentSearchQuery ? escapeHtml(context.product.recentSearchQuery) : 'Abra pela busca'}</div>
        </div>
      `;
      overviewBody.append(searchStats);
    }

    const actions = document.createElement('div');
    actions.className = 'tp-actions';

    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'tp-button tp-button--primary';
    analyzeButton.type = 'button';
    analyzeButton.textContent = 'Abrir análise';
    analyzeButton.addEventListener('click', () => openPlatformPage(`/mercado-livre-analyzer?mlb=${context.product.mlbId}`));

    const saveButton = document.createElement('button');
    saveButton.className = 'tp-button tp-button--secondary';
    saveButton.type = 'button';
    saveButton.textContent = 'Salvar candidato';
    saveButton.addEventListener('click', async () => {
      await saveCandidate({
        mlbId: context.product.mlbId,
        title: context.product.title,
        price: context.product.price,
        currency: context.product.currency,
        permalink: context.product.url,
        seller: context.product.seller,
        soldText: context.product.soldText,
        shipping: context.product.shipping,
        thumbnail: context.product.thumbnail,
      });
    });

    actions.append(analyzeButton, saveButton);
    overviewBody.append(actions);
  } else if (context.mode === 'search') {
    overviewBody.innerHTML = `
      <p class="tp-summary-title">${escapeHtml(context.query || 'Resultados da busca')}</p>
      <div class="tp-meta">
        ${chip(`${context.items.length} itens visíveis`)}
        ${chip('Busca aberta por você')}
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'tp-actions';

    const researchButton = document.createElement('button');
    researchButton.className = 'tp-button tp-button--primary';
    researchButton.type = 'button';
    researchButton.textContent = 'Abrir pesquisa';
    researchButton.addEventListener('click', () => openPlatformPage('/mercado-livre/pesquisa-mercado'));

    const saveVisibleButton = document.createElement('button');
    saveVisibleButton.className = 'tp-button tp-button--secondary';
    saveVisibleButton.type = 'button';
    saveVisibleButton.textContent = 'Salvar visíveis';
    saveVisibleButton.addEventListener('click', async () => {
      for (const item of context.items.slice(0, 10)) {
        await saveCandidate({
          mlbId: item.mlbId,
          title: item.title,
          price: item.price,
          currency: item.currency,
          permalink: item.url,
          seller: item.seller,
          soldText: item.soldText,
          shipping: item.shipping,
          thumbnail: item.thumbnail,
        });
      }
      renderPanel();
    });

    actions.append(researchButton, saveVisibleButton);
    overviewBody.append(actions);
  } else {
    overviewBody.innerHTML = `
      <div class="tp-empty">
        Abra uma página de produto ou uma listagem do Mercado Livre. O painel só lê o que você já abriu manualmente.
      </div>
    `;
  }

  body.append(overview);

  if (context.mode === 'search' && context.items.length) {
    appendSearchInsightsSection(body, context);
  }

  if (context.mode === 'product' && context.product) {
    appendProductMetricsSection(body, context.product);
    await appendContributionCalculatorSection(body, context.product);
  }

  const visibleSection = createSection(
    context.mode === 'search' ? 'Itens visíveis' : 'Ações sugeridas',
    context.mode === 'search' ? String(Math.min(context.items.length, 8)) : null
  );
  const visibleBody = visibleSection.querySelector('.tp-card__body');

  if (context.mode === 'search' && context.items.length) {
    const list = document.createElement('div');
    list.className = 'tp-list';
    context.items.slice(0, 8).forEach((item) => {
      list.append(createItemElement(item));
    });
    visibleBody.append(list);
  } else if (context.mode === 'product' && context.product) {
    const actions = document.createElement('div');
    actions.className = 'tp-actions';

    const researchButton = document.createElement('button');
    researchButton.className = 'tp-button tp-button--primary';
    researchButton.type = 'button';
    researchButton.textContent = 'Abrir pesquisa';
    researchButton.addEventListener('click', () => openPlatformPage('/mercado-livre/pesquisa-mercado'));

    const adButton = document.createElement('button');
    adButton.className = 'tp-button tp-button--secondary';
    adButton.type = 'button';
    adButton.textContent = 'Abrir anúncio';
    adButton.addEventListener('click', () => window.open(context.product.url, '_blank', 'noopener,noreferrer'));

    actions.append(researchButton, adButton);
    visibleBody.append(actions);
  } else {
    visibleBody.innerHTML = '<div class="tp-empty">Nenhum item visível para mostrar agora.</div>';
  }

  body.append(visibleSection);

  if (context.mode !== 'product') {
    const savedSection = createSection('Candidatos salvos', savedCandidates.length ? String(Math.min(savedCandidates.length, 6)) : null);
    const savedBody = savedSection.querySelector('.tp-card__body');

    if (savedCandidates.length) {
      const topActions = document.createElement('div');
      topActions.className = 'tp-actions';

      const clearButton = document.createElement('button');
      clearButton.className = 'tp-button tp-button--secondary';
      clearButton.type = 'button';
      clearButton.textContent = 'Limpar salvos';
      clearButton.addEventListener('click', clearSavedCandidates);

      const researchButton = document.createElement('button');
      researchButton.className = 'tp-button tp-button--primary';
      researchButton.type = 'button';
      researchButton.textContent = 'Abrir pesquisa';
      researchButton.addEventListener('click', () => openPlatformPage('/mercado-livre/pesquisa-mercado'));

      topActions.append(clearButton, researchButton);
      savedBody.append(topActions);

      const list = document.createElement('div');
      list.className = 'tp-list';
      savedCandidates.slice(0, 6).forEach((item) => {
        list.append(createItemElement(item, { saved: true }));
      });
      savedBody.append(list);
    } else {
      savedBody.innerHTML = '<div class="tp-empty">Nenhum candidato salvo ainda.</div>';
    }

    body.append(savedSection);

    const noteSection = createSection('Modo seguro');
    noteSection.querySelector('.tp-card__body').innerHTML = `
      <div class="tp-footer-note">
        Este painel apenas lê a página aberta por você no Mercado Livre e envia os melhores candidatos para a plataforma. Sem scraping em massa, sem automação de navegação e sem chamadas agressivas.
      </div>
    `;
    body.append(noteSection);
  }
  } finally {
    panelRendering = false;
  }
};

const syncPanelOnStorage = async (changes, areaName) => {
  if (areaName !== 'local' || !changes[SAVED_CANDIDATES_KEY]) return;
  savedCandidates = await getSavedCandidates();
  if (panelOpen) {
    renderPanel();
  }
};

chrome.storage.onChanged.addListener(syncPanelOnStorage);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request?.type) return;

  try {
    if (request.type === MESSAGE_GET_CONTEXT) {
      sendResponse({
        ok: true,
        data: buildContextFromCache(),
        extractedAt: new Date().toISOString(),
      });
      return true;
    }

    if (request.type === MESSAGE_TOGGLE_PANEL || request.type === MESSAGE_OPEN_PANEL) {
      panelOpen = request.type === MESSAGE_OPEN_PANEL ? true : !panelOpen;
      renderPanel();
      sendResponse({ ok: true, isOpen: panelOpen });
      return true;
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
});

ensurePanelShell();
initializePassiveSearchTracking();
initializeInlineEnhancements();
