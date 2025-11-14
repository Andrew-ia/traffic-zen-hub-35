-- 0029_fix_kpi_view_messaging_started_only.sql
-- Ajusta a view v_campaign_kpi para contabilizar apenas conversas iniciadas (sem continuadas)

drop view if exists v_campaign_kpi;

create or replace view v_campaign_kpi as
with metrics as (
  select
    pm.metric_date,
    pm.workspace_id,
    pa.platform_key,
    pa.external_id as account_external_id,
    pm.platform_account_id,
    pm.campaign_id,
    pm.ad_set_id,
    pm.ad_id,
    upper(coalesce(c.objective, 'UNKNOWN')) as objective,
    pm.spend::numeric as spend,
    pm.clicks::numeric as clicks,
    pm.conversion_value::numeric as conversion_value,
    pm.conversions::numeric as conversions,
    pm.extra_metrics
  from performance_metrics pm
  join platform_accounts pa on pa.id = pm.platform_account_id
  left join campaigns c on c.id = pm.campaign_id
  where pm.granularity = 'day'
),
metrics_with_actions as (
  select
    m.*,
    (
      coalesce((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'conversations_started')::numeric, 0) +
      coalesce((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'onsite_conversion.messaging_conversation_started_7d')::numeric, 0) +
      coalesce((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'onsite_conversion.whatsapp_conversation_started_7d')::numeric, 0)
    ) as conversations_started_derived,
    coalesce((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'messaging_connections')::numeric, 0) as messaging_connections_derived,
    coalesce((m.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'messaging_first_replies')::numeric, 0) as messaging_first_replies_derived,
    (coalesce(jsonb_array_length(m.extra_metrics -> 'actions'), 0) > 0) as has_action_metrics,
    acts.leads,
    acts.video_views,
    acts.engagements,
    acts.conversations,
    acts.messaging_first_replies,
    acts.purchases
  from metrics m
  left join lateral (
    select
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'lead',
          'fb_pixel_lead',
          'omni_lead',
          'complete_registration',
          'omni_complete_registration',
          'onsite_conversion.lead',
          'lead_generation',
          'offsite_conversion.fb_pixel_lead'
        )
      ), 0) as leads,
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'video_view',
          'three_second_video_view',
          'throughplay',
          'thruplay',
          'omni_video_play',
          'omni_video_view'
        )
      ), 0) as video_views,
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'post_engagement',
          'page_engagement',
          'post_interaction_gross',
          'post_reaction',
          'comment',
          'like',
          'omni_engagement',
          'post'
        )
      ), 0) as engagements,
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'onsite_conversion.messaging_conversation_started_7d',
          'onsite_conversion.whatsapp_conversation_started_7d',
          'onsite_conversion.messenger_conversation_started_7d'
        )
      ), 0) as conversations,
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'onsite_conversion.messaging_first_reply',
          'messaging_first_reply'
        )
      ), 0) as messaging_first_replies,
      coalesce(sum((action ->> 'value')::numeric) filter (
        where action ->> 'action_type' in (
          'purchase',
          'omni_purchase',
          'onsite_conversion.purchase',
          'offsite_conversion.fb_pixel_purchase'
        )
      ), 0) as purchases
    from jsonb_array_elements(coalesce(m.extra_metrics -> 'actions', '[]'::jsonb)) as action
  ) acts on true
),
final as (
  select
    mwa.metric_date,
    mwa.workspace_id,
    mwa.platform_key,
    mwa.platform_account_id,
    mwa.account_external_id,
    mwa.campaign_id,
    mwa.ad_set_id,
    mwa.ad_id,
    mwa.objective,
    mwa.spend,
    mwa.clicks,
    mwa.conversion_value,
    mwa.conversions,
    case
      when mwa.objective in ('OUTCOME_LEADS', 'LEAD_GENERATION') then 'Leads'
      when mwa.objective in ('MESSAGES', 'OUTCOME_MESSAGES') then 'Conversas'
      when mwa.objective in ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') then 'Cliques'
      when mwa.objective in ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') then 'Engajamentos'
      when mwa.objective in ('VIDEO_VIEWS') then 'Views'
      when mwa.objective in ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') then 'Compras'
      when mwa.platform_key = 'google_ads' then 'Cliques'
      else 'Resultados'
    end as result_label,
    case
      when mwa.objective in ('OUTCOME_LEADS', 'LEAD_GENERATION') then coalesce(
        nullif(mwa.leads, 0),
        nullif(mwa.conversations_started_derived, 0),
        nullif(mwa.conversations, 0),
        case when not mwa.has_action_metrics then nullif(mwa.conversions, 0) end
      )
      when mwa.objective in ('MESSAGES', 'OUTCOME_MESSAGES') then nullif(greatest(mwa.conversations_started_derived, mwa.conversations), 0)
      when mwa.objective in ('LINK_CLICKS', 'OUTCOME_TRAFFIC', 'TRAFFIC') then nullif(mwa.clicks, 0)
      when mwa.objective in ('OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'ENGAGEMENT') then nullif(mwa.engagements, 0)
      when mwa.objective in ('VIDEO_VIEWS') then nullif(mwa.video_views, 0)
      when mwa.objective in ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') then nullif(mwa.purchases, 0)
      when mwa.platform_key = 'google_ads' then nullif(mwa.clicks, 0)
      else nullif(mwa.conversions, 0)
    end as result_value
  from metrics_with_actions mwa
)
select
  metric_date,
  workspace_id,
  platform_key,
  platform_account_id,
  account_external_id,
  campaign_id,
  ad_set_id,
  ad_id,
  objective,
  spend,
  clicks,
  conversion_value as revenue,
  result_label,
  result_value,
  case when result_value is not null and result_value > 0 then spend / result_value else null end as cost_per_result,
  case
    when objective in ('SALES', 'CONVERSIONS', 'OUTCOME_SALES', 'PURCHASE') and conversion_value > 0 and spend > 0
      then conversion_value / spend
    else null
  end as roas
from final;
