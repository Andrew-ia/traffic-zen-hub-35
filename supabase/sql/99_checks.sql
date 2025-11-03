-- Top opportunities still open ordered by expected lift.
select
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
where status = 'open'
order by d desc, expected_gain_pct desc
limit 10;

-- Latest health scores for quick dashboarding.
select
  d,
  platform,
  account_id,
  campaign_id,
  adset_id,
  ad_id,
  objective,
  health_score
from mv_health
order by d desc, health_score desc
limit 100;

-- Baseline sanity snapshot.
select *
from mv_baselines
order by platform, account_id, objective
limit 50;

-- Cron jobs registered for this prescriptive layer.
select jobid, jobname, schedule, command, active
from cron.job
where jobname in ('06_refresh', '06_recos');
