const MESSAGE_SCRAPE = 'SCRAPE_PAGE';
const MESSAGE_SCRAPE_FILTERED = 'SCRAPE_SEARCH_FILTER';
const DEFAULT_CURRENCY = 'BRL';

const textFrom = (element) => (element?.textContent || '').trim() || null;

const parseNumber = (raw) => {
  if (!raw) return null;
  const sanitized = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(sanitized);
  return Number.isFinite(value) ? value : null;
};

const parsePriceNode = (root) => {
  if (!root) return null;
  const fraction = textFrom(root.querySelector('.andes-money-amount__fraction'));
  const cents = textFrom(root.querySelector('.andes-money-amount__cents'));
  const symbol = textFrom(root.querySelector('.andes-money-amount__currency-symbol, .andes-money-amount__symbol'));

  const priceString = cents ? `${fraction || ''}.${(cents || '').padEnd(2, '0')}` : fraction;
  const price = parseNumber(priceString || textFrom(root));

  return {
    amount: price,
    currency: symbol?.toUpperCase().includes('U$') ? 'USD' : DEFAULT_CURRENCY
  };
};

const safeDecode = (value) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const parseSoldCount = (raw) => {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/([+]?[\d,]+)\s*(mil)?\s*vendid/);
  if (!match) return null;
  const number = parseNumber(match[1]);
  if (!Number.isFinite(number)) return null;
  if (match[2] || normalized.includes('mil')) {
    return Math.round(number * 1000);
  }
  return Math.round(number);
};

const getBreadcrumbs = () => {
  const crumbs = Array.from(
    document.querySelectorAll('.andes-breadcrumb__link, nav[aria-label="Breadcrumb"] a, nav[aria-label="breadcrumbs"] a')
  )
    .map((el) => {
      const label = textFrom(el);
      const href = el.getAttribute('href');
      return label ? { label, href: href ? new URL(href, location.href).toString() : null } : null;
    })
    .filter(Boolean);
  return crumbs.length ? crumbs : null;
};

const parseLdJsonProduct = () => {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || 'null');
      const entries = Array.isArray(data) ? data : [data];

      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const type = entry['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes('Product')) {
          return entry;
        }
      }
    } catch (error) {
      // Ignore malformed JSON-LD blocks
    }
  }
  return null;
};

const mapLdProduct = (entry) => {
  if (!entry) return null;
  const offers = Array.isArray(entry.offers) ? entry.offers[0] : entry.offers;
  const rating = entry.aggregateRating;

  return {
    source: 'ld+json',
    title: entry.name || null,
    sku: entry.sku || null,
    mpn: entry.mpn || null,
    gtin: entry.gtin13 || entry.gtin || null,
    brand: entry.brand?.name || entry.brand || null,
    seller:
      entry.seller?.name ||
      (typeof entry.seller === 'string' ? entry.seller : null) ||
      entry.offers?.seller?.name ||
      null,
    url: entry.url || location.href,
    images: Array.isArray(entry.image) ? entry.image : entry.image ? [entry.image] : null,
    price: offers?.price ? Number(offers.price) : null,
    currency: offers?.priceCurrency || DEFAULT_CURRENCY,
    availability: offers?.availability || null,
    condition: entry.itemCondition || null,
    rating: rating
      ? {
          score: rating.ratingValue ? Number(rating.ratingValue) : null,
          reviews: rating.reviewCount ? Number(rating.reviewCount) : null
        }
      : null
  };
};

const scrapeDomProduct = () => {
  const priceRoot =
    document.querySelector('.ui-pdp-price__second-line') ||
    document.querySelector('[itemprop="offers"]') ||
    document.querySelector('.ui-pdp-price');

  const price = parsePriceNode(priceRoot);
  const seller =
    textFrom(document.querySelector('[data-testid="seller-link"]')) ||
    textFrom(document.querySelector('.ui-pdp-seller__link')) ||
    textFrom(document.querySelector('.ui-pdp-header__subtitle'));

  const stock = textFrom(document.querySelector('.ui-pdp-buybox__quantity__available, .ui-pdp-buybox__quantity__available-quantity'));

  const sold = textFrom(document.querySelector('.ui-pdp-subtitle'));
  const soldCount = parseSoldCount(sold);
  const shipping =
    textFrom(document.querySelector('.ui-pdp-shipping, .ui-pdp-shipping__subtitle')) ||
    textFrom(document.querySelector('.ui-pdp-media__shipping'));

  const ratingValue = parseNumber(
    textFrom(document.querySelector('.ui-pdp-review__rating, .ui-pdp-review__rating__summary__average'))
  );
  const ratingCount = parseNumber(
    textFrom(document.querySelector('.ui-pdp-review__rating__summary__quantity__value, [data-testid="reviews-count"]'))
  );

  return {
    source: 'dom',
    title:
      textFrom(document.querySelector('h1.ui-pdp-title')) ||
      textFrom(document.querySelector('h1[itemprop="name"]')) ||
      textFrom(document.querySelector('h1')),
    price: price?.amount || null,
    currency: price?.currency || DEFAULT_CURRENCY,
    seller: seller || null,
    shipping: shipping || null,
    availability: stock || null,
    sold,
    rating: ratingValue ? { score: ratingValue, reviews: ratingCount } : null,
    breadcrumbs: getBreadcrumbs()
  };
};

const scrapeProductPage = () => {
  const ldProduct = mapLdProduct(parseLdJsonProduct());
  const domProduct = scrapeDomProduct();

  const title = ldProduct?.title || domProduct.title;
  if (!title) return null;

  return {
    mode: 'product',
    pageUrl: location.href,
    title,
    price: ldProduct?.price ?? domProduct.price ?? null,
    currency: ldProduct?.currency || domProduct.currency || DEFAULT_CURRENCY,
    availability: ldProduct?.availability || domProduct.availability || null,
    seller: ldProduct?.seller || domProduct.seller || null,
    brand: ldProduct?.brand || null,
    rating: ldProduct?.rating || domProduct.rating || null,
    sold: domProduct.sold || null,
    soldCount: domProduct.soldCount || null,
    shipping: domProduct.shipping || null,
    sku: ldProduct?.sku || null,
    mpn: ldProduct?.mpn || null,
    gtin: ldProduct?.gtin || null,
    breadcrumbs: domProduct.breadcrumbs || null,
    images: ldProduct?.images || null
  };
};

const parseCardRating = (card) => {
  const score = parseNumber(
    textFrom(
      card.querySelector('.ui-search-reviews__rating-number, .poly-reviews__rating-number, .ui-search-card-reviews__rating-number')
    )
  );
  const reviews = parseNumber(
    textFrom(
      card.querySelector(
        '.ui-search-reviews__amount, .poly-reviews__amount, .ui-search-card-reviews__amount, .ui-search-reviews__amount__label'
      )
    )
  );
  return score ? { score, reviews } : null;
};

const parseCardSold = (card) => {
  const text =
    textFrom(card.querySelector('.ui-search-item__group__element--subtitle')) ||
    textFrom(card.querySelector('.poly-card__subtitle')) ||
    textFrom(card.querySelector('[data-testid="item_subtitle"]')) ||
    textFrom(card.querySelector('.ui-search-card-attributes__subtitle'));
  const count = parseSoldCount(text || '');
  return { soldText: text || null, soldCount: count };
};

const scrapeSearchResults = () => {
  const cards = Array.from(
    document.querySelectorAll(
      'li.ui-search-layout__item, li.ui-search-layout__item div.ui-search-result__content-wrapper, li.poly-card, div.ui-search-result__wrapper'
    )
  );

  const items = [];
  const seen = new Set();

  for (const card of cards) {
    const linkEl =
      card.querySelector('a.ui-search-link') ||
      card.querySelector('a.poly-card__content, a.poly-card__content-link') ||
      card.querySelector('a.ui-search-result__content') ||
      card.querySelector('a.ui-search-item__group__element');

    const href = linkEl?.href ? new URL(linkEl.href, location.href).toString() : null;
    const title =
      textFrom(card.querySelector('h2.ui-search-item__title')) ||
      textFrom(card.querySelector('h2.poly-card__title')) ||
      textFrom(card.querySelector('.ui-search-item__group__element--title')) ||
      textFrom(linkEl);

    if (!title && !href) continue;
    const key = href || `${title}-${items.length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const priceInfo =
      parsePriceNode(
        card.querySelector('.ui-search-price, .poly-price, .ui-search-result__content-price, .andes-money-amount-combo-price')
      ) || parsePriceNode(card);

    const seller =
      textFrom(card.querySelector('.ui-search-official-store-label, .ui-search-official-store, .poly-card__seller')) ||
      textFrom(card.querySelector('.ui-search-official-store-label-ui-search-item'));

    const shipping =
      textFrom(card.querySelector('.ui-search-item__shipping, .poly-card__shipping')) ||
      textFrom(card.querySelector('.ui-search-item__fulfillment'));

    const badge = textFrom(card.querySelector('.ui-search-item__highlight-label__text, .ui-search-badge__content'));
    const locationInfo = textFrom(card.querySelector('.ui-search-item__group__element--location, .poly-card__location'));
    const condition = textFrom(card.querySelector('.ui-search-item__item-condition, .poly-card__condition'));
    const rating = parseCardRating(card);
    const sold = parseCardSold(card);

    items.push({
      title,
      url: href || location.href,
      price: priceInfo?.amount || null,
      currency: priceInfo?.currency || DEFAULT_CURRENCY,
      seller: seller || null,
      shipping: shipping || null,
      badge: badge || null,
      location: locationInfo || null,
      condition: condition || null,
      rating,
      soldCount: sold.soldCount,
      soldText: sold.soldText
    });
  }

  if (!items.length) return null;

  const url = new URL(location.href);
  const searchTerm =
    url.searchParams.get('as_word') ||
    url.searchParams.get('q') ||
    safeDecode(url.pathname.replace(/^\//, '').replace(/-/g, ' '));

  return {
    mode: 'search',
    pageUrl: location.href,
    query: searchTerm || null,
    total: items.length,
    items
  };
};

const scrapePage = () => {
  const product = scrapeProductPage();
  if (product) {
    return { ok: true, scrapedAt: new Date().toISOString(), data: product };
  }

  const search = scrapeSearchResults();
  if (search) {
    return { ok: true, scrapedAt: new Date().toISOString(), data: search };
  }

  return { ok: false, error: 'Nenhum dado encontrado nesta página.', pageUrl: location.href };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request?.type) return;

  if (request.type === MESSAGE_SCRAPE) {
    try {
      sendResponse(scrapePage());
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (request.type === MESSAGE_SCRAPE_FILTERED) {
    try {
      const minSold = Number.isFinite(request.minSold) ? Number(request.minSold) : 0;
      const limit = Number.isFinite(request.limit) ? Number(request.limit) : 20;
      const result = scrapeSearchResults();
      if (!result) {
        sendResponse({ ok: false, error: 'Nenhum resultado na página atual.' });
        return true;
      }
      const filtered = result.items
        .filter((item) => (item.soldCount || 0) >= minSold)
        .slice(0, limit);
      sendResponse({
        ok: true,
        scrapedAt: new Date().toISOString(),
        data: {
          ...result,
          items: filtered,
          total: filtered.length,
          filters: { minSold, limit }
        }
      });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }
});
