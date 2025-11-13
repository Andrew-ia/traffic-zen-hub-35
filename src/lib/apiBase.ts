const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

function getBrowserOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function resolveApiBase(): string {
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
