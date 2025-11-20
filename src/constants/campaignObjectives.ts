export type CampaignObjectiveValue =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'conversions';

export const CAMPAIGN_OBJECTIVES: ReadonlyArray<{ value: CampaignObjectiveValue; label: string }> = [
  { value: 'awareness', label: 'Reconhecimento' },
  { value: 'traffic', label: 'Tráfego' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'leads', label: 'Leads' },
  { value: 'conversions', label: 'Conversões' },
];

export function getCampaignObjectiveLabel(value?: string | null) {
  if (!value) return '';
  return CAMPAIGN_OBJECTIVES.find((opt) => opt.value === value)?.label ?? value;
}
