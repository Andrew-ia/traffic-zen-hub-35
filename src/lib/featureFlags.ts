const toBoolean = (value: string | boolean | undefined) => {
  if (typeof value === "boolean") return value;
  return String(value ?? "").toLowerCase() === "true";
};

export const featureFlags = {
  metaAds: toBoolean(import.meta.env.VITE_FEATURE_META_ADS),
  googleAds: toBoolean(import.meta.env.VITE_FEATURE_GOOGLE_ADS),
  googleAnalytics: toBoolean(import.meta.env.VITE_FEATURE_GOOGLE_ANALYTICS),
};

export const adsFeaturesEnabled = featureFlags.metaAds || featureFlags.googleAds;
