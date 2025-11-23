export type CampaignObjectiveValue =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'sales';

export const CAMPAIGN_OBJECTIVES: ReadonlyArray<{ value: CampaignObjectiveValue; label: string }> = [
  { value: 'awareness', label: 'Reconhecimento' },
  { value: 'traffic', label: 'Tráfego' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'leads', label: 'Leads' },
  { value: 'sales', label: 'Vendas' },
];

export function getCampaignObjectiveLabel(value?: string | null) {
  if (!value) return '';
  const v = value.toLowerCase();
  switch (v) {
    case 'awareness':
      return 'Reconhecimento';
    case 'traffic':
      return 'Tráfego';
    case 'engagement':
      return 'Engajamento';
    case 'leads':
      return 'Leads';
    case 'conversions':
    case 'sales':
      return 'Vendas';
    default:
      return CAMPAIGN_OBJECTIVES.find((opt) => opt.value === value)?.label ?? value;
  }
}
