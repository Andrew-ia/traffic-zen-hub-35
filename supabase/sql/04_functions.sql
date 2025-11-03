-- Prescriptive functions and helper views.
create or replace function fn_refresh_all()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently mv_baselines;
  refresh materialized view concurrently mv_health;
end;
$$;

create or replace function fn_generate_recommendations()
returns void
language plpgsql
as $$
declare
  target_day date := current_date - 1;
begin
  -- R1: scale budgets when CPR is materially below target and frequency is healthy.
  insert into recommendations (
    d,
    platform,
    account_id,
    campaign_id,
    adset_id,
    ad_id,
    objective,
    rule_id,
    severity,
    title,
    explanation,
    action_kind,
    action_params,
    expected_gain_pct
  )
  select
    m.d,
    m.platform,
    m.account_id,
    m.campaign_id,
    m.adset_id,
    m.ad_id,
    m.objective,
    'R1',
    'high',
    'Aumentar orçamento em 20%',
    concat(
      'CPR médio ',
      to_char(m.cpr_2d, 'FM999990.00'),
      ' < 90% do alvo ',
      to_char(oc.target_numeric, 'FM999990.00'),
      ' em 2 dias; frequência: ',
      to_char(coalesce(m.frequency, 0), 'FM999990.00')
    ),
    'budget_increase',
    jsonb_build_object('level', 'adset', 'delta_pct', 20),
    10
  from (
    select
      v.*,
      avg(cost_per_result) over (
        partition by platform, account_id, adset_id
        order by d rows between 1 preceding and current row
      ) as cpr_2d
    from v_metrics v
  ) m
  join objective_config oc
    on oc.platform = m.platform
   and oc.account_id = m.account_id
   and oc.objective = m.objective
   and (oc.campaign_id is null or oc.campaign_id = m.campaign_id)
  where m.d = target_day
    and m.cpr_2d is not null
    and oc.target_numeric > 0
    and m.cpr_2d <= oc.target_numeric * 0.9
    and coalesce(m.frequency, 0) < 2.5
    and coalesce(m.spend, 0) > 0
    and coalesce(m.conv_primary, 0) > 0
  on conflict (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  )
  do update
  set
    created_at = now(),
    severity = excluded.severity,
    title = excluded.title,
    explanation = excluded.explanation,
    action_kind = excluded.action_kind,
    action_params = excluded.action_params,
    expected_gain_pct = excluded.expected_gain_pct
  where recommendations.status = 'open';

  -- R2: pause ads overspending without conversions.
  insert into recommendations (
    d,
    platform,
    account_id,
    campaign_id,
    adset_id,
    ad_id,
    objective,
    rule_id,
    severity,
    title,
    explanation,
    action_kind,
    action_params,
    expected_gain_pct
  )
  select
    v.d,
    v.platform,
    v.account_id,
    v.campaign_id,
    v.adset_id,
    v.ad_id,
    v.objective,
    'R2',
    'high',
    'Pausar anúncio sem resultado',
    concat(
      'Gasto R$',
      to_char(v.spend, 'FM9999990.00'),
      ' >= 2x alvo (',
      to_char(oc.target_numeric, 'FM9999990.00'),
      ') sem conversão'
    ),
    'pause_ad',
    jsonb_build_object('level', 'ad', 'reason', 'no_result_spend_2x_target'),
    100
  from v_metrics v
  join objective_config oc
    on oc.platform = v.platform
   and oc.account_id = v.account_id
   and oc.objective = v.objective
   and (oc.campaign_id is null or oc.campaign_id = v.campaign_id)
  where v.d = target_day
    and oc.target_numeric > 0
    and coalesce(v.spend, 0) >= 2 * oc.target_numeric
    and coalesce(v.conv_primary, 0) = 0
  on conflict (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  )
  do update
  set
    created_at = now(),
    severity = excluded.severity,
    title = excluded.title,
    explanation = excluded.explanation,
    action_kind = excluded.action_kind,
    action_params = excluded.action_params,
    expected_gain_pct = excluded.expected_gain_pct
  where recommendations.status = 'open';

  -- R3: rotate creatives when CTR materially under-performs the 14-day account baseline.
  insert into recommendations (
    d,
    platform,
    account_id,
    campaign_id,
    adset_id,
    ad_id,
    objective,
    rule_id,
    severity,
    title,
    explanation,
    action_kind,
    action_params,
    expected_gain_pct
  )
  select
    v.d,
    v.platform,
    v.account_id,
    v.campaign_id,
    v.adset_id,
    v.ad_id,
    v.objective,
    'R3',
    'medium',
    'Rotacionar criativo',
    concat(
      'CTR ',
      to_char(coalesce(v.ctr, 0) * 100, 'FM999990.00'),
      '% < 70% da média 14d (',
      to_char(coalesce(b.avg_ctr_14d, 0) * 100, 'FM999990.00'),
      '%); CPM acima da média'
    ),
    'rotate_creative',
    jsonb_build_object('level', 'ad', 'next_step', 'substituir anúncio com CTR baixo'),
    8
  from v_metrics v
  join mv_baselines b
    on b.platform = v.platform
   and b.account_id = v.account_id
   and b.objective = v.objective
  where v.d = target_day
    and b.avg_ctr_14d is not null
    and b.avg_ctr_14d > 0
    and coalesce(v.ctr, 0) < 0.7 * b.avg_ctr_14d
    and b.avg_cpm_14d is not null
    and coalesce(v.cpm, 0) > b.avg_cpm_14d
  on conflict (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  )
  do update
  set
    created_at = now(),
    severity = excluded.severity,
    title = excluded.title,
    explanation = excluded.explanation,
    action_kind = excluded.action_kind,
    action_params = excluded.action_params,
    expected_gain_pct = excluded.expected_gain_pct
  where recommendations.status = 'open';

  -- R4: duplicate adsets or review funnel when CVR lags despite solid CTR.
  insert into recommendations (
    d,
    platform,
    account_id,
    campaign_id,
    adset_id,
    ad_id,
    objective,
    rule_id,
    severity,
    title,
    explanation,
    action_kind,
    action_params,
    expected_gain_pct
  )
  select
    v.d,
    v.platform,
    v.account_id,
    v.campaign_id,
    v.adset_id,
    v.ad_id,
    v.objective,
    'R4',
    'medium',
    'Duplicar criativo vencedor e revisar destino',
    'CTR na média mas CVR abaixo de 60% da média 14d',
    'duplicate_best',
    jsonb_build_object('level', 'adset', 'note', 'testar landing page/formulário'),
    6
  from v_metrics v
  join mv_baselines b
    on b.platform = v.platform
   and b.account_id = v.account_id
   and b.objective = v.objective
  where v.d = target_day
    and b.avg_ctr_14d is not null
    and b.avg_cvr_14d is not null
    and b.avg_cvr_14d > 0
    and coalesce(v.ctr, 0) >= b.avg_ctr_14d
    and coalesce(v.cvr_click_to_kpi, 0) < 0.6 * b.avg_cvr_14d
  on conflict (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  )
  do update
  set
    created_at = now(),
    severity = excluded.severity,
    title = excluded.title,
    explanation = excluded.explanation,
    action_kind = excluded.action_kind,
    action_params = excluded.action_params,
    expected_gain_pct = excluded.expected_gain_pct
  where recommendations.status = 'open';

  -- R5: manage fatigue when frequency rises and CTR trends down.
  with ctr_trend as (
    select
      v.*,
      lag(ctr) over (partition by platform, account_id, ad_id order by d) as ctr_lag1
    from v_metrics v
  )
  insert into recommendations (
    d,
    platform,
    account_id,
    campaign_id,
    adset_id,
    ad_id,
    objective,
    rule_id,
    severity,
    title,
    explanation,
    action_kind,
    action_params,
    expected_gain_pct
  )
  select
    t.d,
    t.platform,
    t.account_id,
    t.campaign_id,
    t.adset_id,
    t.ad_id,
    t.objective,
    'R5',
    'medium',
    'Expandir público / aplicar cap de frequência',
    'Frequência >= 3, CTR em queda versus dia anterior',
    'expand_audience',
    jsonb_build_object('level', 'adset', 'frequency_cap', '2/dia'),
    5
  from ctr_trend t
  where t.d = target_day
    and coalesce(t.frequency, 0) >= 3
    and t.ctr_lag1 is not null
    and coalesce(t.ctr, 0) < coalesce(t.ctr_lag1, 0)
  on conflict (
    d,
    platform,
    account_id,
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, ''),
    coalesce(rule_id, '')
  )
  do update
  set
    created_at = now(),
    severity = excluded.severity,
    title = excluded.title,
    explanation = excluded.explanation,
    action_kind = excluded.action_kind,
    action_params = excluded.action_params,
    expected_gain_pct = excluded.expected_gain_pct
  where recommendations.status = 'open';
end;
$$;

create or replace view v_actions_today as
select
  created_at::date as d,
  platform,
  account_id,
  objective,
  title,
  explanation,
  action_kind,
  action_params,
  expected_gain_pct,
  status
from recommendations
where created_at::date = current_date
order by expected_gain_pct desc, created_at desc;
