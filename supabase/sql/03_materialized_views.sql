drop materialized view if exists mv_health;
drop materialized view if exists mv_baselines;
create materialized view mv_baselines as
select
  platform,
  account_id,
  objective,
  percentile_cont(0.5) within group (order by cost_per_result) as p50_cpr_14d,
  avg(cost_per_result) filter (where cost_per_result is not null) as avg_cpr_14d,
  avg(ctr) filter (where ctr is not null) as avg_ctr_14d,
  avg(cvr_click_to_kpi) filter (where cvr_click_to_kpi is not null) as avg_cvr_14d,
  avg(cpm) filter (where cpm is not null) as avg_cpm_14d
from v_metrics
where d >= current_date - 14
group by 1, 2, 3;

create unique index if not exists mv_baselines_unique_idx
  on mv_baselines (platform, account_id, objective);

create materialized view mv_health as
with metrics_window as (
  select
    v.*,
    b.p50_cpr_14d,
    b.avg_ctr_14d,
    b.avg_cvr_14d,
    b.avg_cpm_14d
  from v_metrics v
  join mv_baselines b using (platform, account_id, objective)
  where v.d >= current_date - 3
),
scored as (
  select
    metrics_window.*,
    case
      when cost_per_result is null then 0
      when cost_per_result <= p50_cpr_14d then 1
      when cost_per_result <= 1.2 * p50_cpr_14d then 0.7
      when cost_per_result <= 1.5 * p50_cpr_14d then 0.4
      else 0.1
    end as s_cpr,
    case
      when avg_ctr_14d is null or ctr is null then 0.5
      else greatest(0, least(1, ctr / nullif(avg_ctr_14d, 0)))
    end as s_ctr,
    case
      when avg_cvr_14d is null or cvr_click_to_kpi is null then 0.5
      else greatest(0, least(1, cvr_click_to_kpi / nullif(avg_cvr_14d, 0)))
    end as s_cvr,
    case
      when avg_cpm_14d is null or cpm is null then 0.5
      else greatest(0, least(1, nullif(avg_cpm_14d, 0) / nullif(cpm, 0)))
    end as s_cpm
  from metrics_window
)
select
  d,
  platform,
  account_id,
  campaign_id,
  adset_id,
  ad_id,
  objective,
  round(100 * (0.45 * s_cpr + 0.2 * s_ctr + 0.25 * s_cvr + 0.1 * s_cpm))::int as health_score,
  concat_ws(
    '::',
    to_char(d, 'YYYY-MM-DD'),
    coalesce(platform, ''),
    coalesce(account_id, ''),
    coalesce(campaign_id, ''),
    coalesce(adset_id, ''),
    coalesce(ad_id, '')
  ) as grain_key
from scored;

create unique index if not exists mv_health_unique_idx
  on mv_health (grain_key);

create index if not exists mv_health_lookup_idx
  on mv_health (platform, account_id, d desc);
