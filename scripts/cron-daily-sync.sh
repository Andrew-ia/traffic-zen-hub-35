#!/bin/bash
set -euo pipefail
cd /Users/andrew/Traffic/traffic-zen-hub-35
set -a && source .env.local && set +a

# Sincronização incremental Meta (últimos 7 dias)
META_DAYS=${META_DAYS:-7}
npx tsx scripts/meta/sync-incremental.ts --days="$META_DAYS"

# Sincronização Google Ads (últimos 7 dias)
GOOGLE_DAYS=${GOOGLE_DAYS:-7}
node scripts/google-ads/sync-google-ads.js --days="$GOOGLE_DAYS"

# Validação de consistência entre canais
node scripts/check-data-sync.js
