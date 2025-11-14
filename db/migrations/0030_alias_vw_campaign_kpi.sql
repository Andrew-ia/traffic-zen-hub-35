-- 0030_alias_vw_campaign_kpi.sql
-- Provide backward compatibility view expected by legacy Supabase clients

drop view if exists vw_campaign_kpi;
create or replace view vw_campaign_kpi as
select * from v_campaign_kpi;

grant select on vw_campaign_kpi to anon, authenticated;
