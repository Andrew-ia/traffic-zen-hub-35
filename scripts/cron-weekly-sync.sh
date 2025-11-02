#!/bin/bash
set -euo pipefail
cd /Users/andrew/Traffic/traffic-zen-hub-35
set -a && source .env.local && set +a

# Sincronização completa do Meta (campanhas/adsets/ads)
npm run sync:meta

# Backfill Meta (30 dias) para garantir histórico
META_BACKFILL_DAYS=${META_BACKFILL_DAYS:-30} npm run backfill:meta

# Sincronização Google (30 dias) para revisão
node scripts/google-ads/sync-google-ads.js --days=30

# Validação pós-sync
node scripts/check-data-sync.js
