#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$ROOT_DIR/scripts/setup-vercel-env.sh" ]; then
  bash "$ROOT_DIR/scripts/setup-vercel-env.sh"
else
  echo "scripts/setup-vercel-env.sh não encontrado"
  exit 1
fi
