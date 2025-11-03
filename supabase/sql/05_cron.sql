-- Daily scheduling for refresh and recommendation generation.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('06_refresh');
exception
  when others then
    null;
end;
$$;

do $$
begin
  perform cron.unschedule('06_recos');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  '06_refresh',
  '0 6 * * *',
  $$ call fn_refresh_all(); $$
);

select cron.schedule(
  '06_recos',
  '10 6 * * *',
  $$ call fn_generate_recommendations(); $$
);
