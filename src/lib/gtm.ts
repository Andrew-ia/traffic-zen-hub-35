declare global {
  interface Window {
    dataLayer: any[];
  }
}

/**
 * Initialize Google Tag Manager by injecting the GTM script tag
 * and creating the `window.dataLayer` array.
 */
export function initGtm(containerId?: string) {
  if (!containerId) return;

  // Create dataLayer if not present
  window.dataLayer = window.dataLayer || [];

  const newSrc = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  const existing = document.getElementById('gtm-script') as HTMLScriptElement | null;

  if (existing) {
    // Update source if container changes
    if (existing.src !== newSrc) {
      existing.src = newSrc;
      window.dataLayer.push({ event: 'gtm.container_updated', container_id: containerId });
    }
    return;
  }

  // First-time injection
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.id = 'gtm-script';
  script.async = true;
  script.src = newSrc;
  document.head.appendChild(script);
}

/**
 * Push a custom event to the GTM dataLayer.
 */
export function gtmPush(eventName: string, payload?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  const event = { event: eventName, ...(payload || {}) };
  window.dataLayer.push(event);
}

/**
 * Validate GTM container ID format, e.g., "GTM-XXXXXXX".
 */
export function isValidGtmId(id: string): boolean {
  return /^GTM-[A-Z0-9]+$/i.test(id.trim());
}
