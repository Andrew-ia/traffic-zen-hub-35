#!/bin/bash
set -euo pipefail
cd /Users/andrew/Traffic/traffic-zen-hub-35
set -a && source .env.local && set +a

# Atualiza métricas do Meta das últimas horas
META_DAYS=${META_DAYS:-1}
npx tsx scripts/meta/sync-incremental.ts --days="$META_DAYS" --metrics-only
