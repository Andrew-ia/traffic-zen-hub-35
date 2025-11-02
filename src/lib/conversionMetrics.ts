export type MetaExtraMetrics = {
  actions?: Array<{ action_type?: string; value?: string | number }>;
  action_values?: Array<{ action_type?: string; value?: string | number }>;
  reach?: number;
  [key: string]: unknown;
};

export interface ResolvedConversion {
  value: number;
  actionType: string | null;
}

export const CONVERSATION_STARTED_ACTION = "onsite_conversion.messaging_conversation_started_7d";
export const CONVERSATION_CONNECTION_ACTION = "onsite_conversion.total_messaging_connection";

const ACTION_LABELS: Record<string, string> = {
  [CONVERSATION_STARTED_ACTION]: "Conversas iniciadas",
  [CONVERSATION_CONNECTION_ACTION]: "Conexões de mensagem",
  "onsite_conversion.messaging_first_reply": "Primeira resposta em mensagem",
  "offsite_conversion.fb_pixel_lead": "Lead (pixel)",
  lead: "Lead",
  omni_purchase: "Compra",
  "action.conversion": "Conversões (padrão)",
  lead_generation: "Geração de leads",
  "onsite_conversion.lead": "Lead (onsite)",
};

export const CONVERSION_PRIMARY_ACTIONS = [
  CONVERSATION_STARTED_ACTION,
  CONVERSATION_CONNECTION_ACTION,
  "onsite_conversion.messaging_first_reply",
  "offsite_conversion.fb_pixel_lead",
  "lead",
  "omni_purchase",
];

export const CONVERSION_FALLBACK_ACTIONS = ["action.conversion", "lead_generation", "onsite_conversion.lead"];

export function getActionValueForType(
  extraMetrics: MetaExtraMetrics | null | undefined,
  actionType: string,
): number | null {
  const actions = Array.isArray(extraMetrics?.actions) ? extraMetrics.actions ?? [] : [];
  const match = actions.find((action) => action?.action_type === actionType);
  if (!match) {
    return null;
  }
  const asNumber = Number(match.value ?? 0);
  return Number.isNaN(asNumber) ? null : asNumber;
}

export function getActionValueAmount(
  extraMetrics: MetaExtraMetrics | null | undefined,
  actionType: string,
): number | null {
  const actionValues = Array.isArray(extraMetrics?.action_values) ? extraMetrics?.action_values ?? [] : [];
  const match = actionValues.find((action) => action?.action_type === actionType);
  if (!match) {
    return null;
  }
  const asNumber = Number(match.value ?? 0);
  return Number.isNaN(asNumber) ? null : asNumber;
}

export function extractConversationMetrics(extraMetrics: MetaExtraMetrics | null | undefined): {
  started: number;
  connections: number;
} {
  const started = getActionValueForType(extraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
  const connections = getActionValueForType(extraMetrics, CONVERSATION_CONNECTION_ACTION) ?? 0;
  return { started, connections };
}

function findActionMatch(
  extraMetrics: MetaExtraMetrics | null | undefined,
  types: string[],
): { value: number; actionType: string } | null {
  for (const type of types) {
    const match = getActionValueForType(extraMetrics, type);
    if (match !== null) {
      return { value: match, actionType: type };
    }
  }
  return null;
}

export function resolvePrimaryConversion(
  extraMetrics: MetaExtraMetrics | null | undefined,
  fallback: number,
): ResolvedConversion {
  const prioritized = findActionMatch(extraMetrics, CONVERSION_PRIMARY_ACTIONS);
  if (prioritized) {
    return prioritized;
  }

  const fallbackMatch = findActionMatch(extraMetrics, CONVERSION_FALLBACK_ACTIONS);
  if (fallbackMatch) {
    return fallbackMatch;
  }

  return { value: fallback, actionType: null };
}

export function extractPrimaryConversions(extraMetrics: MetaExtraMetrics | null | undefined, fallback: number): number {
  return resolvePrimaryConversion(extraMetrics, fallback).value;
}

export function getConversionActionLabel(actionType: string | null | undefined): string {
  if (!actionType) {
    return "Conversões registradas";
  }
  return ACTION_LABELS[actionType] ?? actionType;
}
