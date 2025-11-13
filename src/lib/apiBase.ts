const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;
const LS_KEY = 'API_URL_OVERRIDE';

function getBrowserOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

function getRuntimeOverride(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('api') || '').trim();
    if (q) {
      localStorage.setItem(LS_KEY, q);
      return q;
    }
    const ls = (localStorage.getItem(LS_KEY) || '').trim();
    return ls;
  } catch {
    return '';
  }
}

export function resolveApiBase(): string {
  const runtime = getRuntimeOverride();
  if (runtime) return runtime;
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (!envUrl) {
    return getBrowserOrigin();
  }

  const isLocalEnvUrl = LOCALHOST_REGEX.test(envUrl);
  if (import.meta.env.PROD) {
    if (!isLocalEnvUrl) return envUrl;
    return getBrowserOrigin() || envUrl;
  }

  return envUrl;
}
