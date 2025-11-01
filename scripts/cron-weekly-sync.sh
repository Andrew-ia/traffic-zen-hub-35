#!/bin/bash
set -euo pipefail
cd /Users/andrew/Traffic/traffic-zen-hub-35
set -a && source .env.local && set +a
npm run sync:meta
META_BACKFILL_DAYS=7 npm run backfill:meta
