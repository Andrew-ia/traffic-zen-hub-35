#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC2046
  export $(grep -vE '^(#|$)' "${ENV_FILE}" | sed 's/=.*//' | xargs)
fi

echo "[meta-sync] $(date '+%Y-%m-%d %H:%M:%S') — starting catalog sync"
(cd "${ROOT_DIR}" && npm run sync:meta)

echo "[meta-sync] $(date '+%Y-%m-%d %H:%M:%S') — starting rolling backfill (7d)"
(cd "${ROOT_DIR}" && META_BACKFILL_DAYS=${META_BACKFILL_DAYS:-7} npm run backfill:meta)

echo "[meta-sync] $(date '+%Y-%m-%d %H:%M:%S') — completed"
