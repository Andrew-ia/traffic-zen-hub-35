#!/bin/bash
set -euo pipefail
cd /Users/andrew/Traffic/traffic-zen-hub-35
set -a && source .env.local && set +a

# Atualiza métricas do Meta das últimas horas
META_DAYS=${META_DAYS:-1}
node scripts/meta/sync-incremental.js --days="$META_DAYS" --metrics-only
