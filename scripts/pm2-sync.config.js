module.exports = {
  apps: [
    {
      name: "trafficpro-sync-hourly",
      script: "./scripts/cron-hourly-sync.sh",
      interpreter: "/bin/bash",
      cron_restart: "15 * * * *",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "trafficpro-sync-daily",
      script: "./scripts/cron-daily-sync.sh",
      interpreter: "/bin/bash",
      cron_restart: "30 6 * * *",
      watch: false,
      env: {
        NODE_ENV: "production",
        META_DAYS: "7",
        GOOGLE_DAYS: "7",
      },
    },
    {
      name: "trafficpro-sync-weekly",
      script: "./scripts/cron-weekly-sync.sh",
      interpreter: "/bin/bash",
      cron_restart: "0 6 * * MON",
      watch: false,
      env: {
        NODE_ENV: "production",
        META_BACKFILL_DAYS: "30",
      },
    },
  ],
};
