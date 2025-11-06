#!/usr/bin/env bash
set -euo pipefail

# Cria listas de canais (Meta Ads, Google Ads, Content Calendar, KPIs & Reports)
# e adiciona tarefas exemplo com prazos e descrições.
#
# Pré-requisitos:
#   export CLICKUP_TOKEN="pk_xxx"
#   export SPACE_ID="<id do Space>"

API="https://api.clickup.com/api/v2"

if [[ -z "${CLICKUP_TOKEN:-}" ]]; then
  echo "[ERRO] CLICKUP_TOKEN não definido." >&2
  exit 1
fi
if [[ -z "${SPACE_ID:-}" ]]; then
  echo "[ERRO] SPACE_ID não definido." >&2
  exit 1
fi

AUTH_HEADER=("-H" "Authorization: ${CLICKUP_TOKEN}")
JSON_HEADER=("-H" "Content-Type: application/json")

function create_list_in_space() {
  local space_id="$1"; shift
  local name="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" '{name: $name, content: "Lista criada via script"}')
  curl -sS -X POST "${API}/space/${space_id}/list" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "${payload}"
}

function create_view() {
  local list_id="$1"; shift
  local name="$1"; shift
  local type="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" --arg type "$type" '{name: $name, type: $type, visibility: {show_closed: false}}')
  curl -sS -X POST "${API}/list/${list_id}/view" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "${payload}"
}

function create_task() {
  local list_id="$1"; shift
  local name="$1"; shift
  local desc="$1"; shift
  local due_date="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" --arg desc "$desc" --arg due "$due_date" '{name: $name, description: $desc, due_date: $due}')
  curl -sS -X POST "${API}/list/${list_id}/task" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "${payload}"
}

echo "==> Criando listas de canais no Space ${SPACE_ID}"
kpirs=$(create_list_in_space "$SPACE_ID" "KPIs & Reports")
metaads=$(create_list_in_space "$SPACE_ID" "Meta Ads")
googleads=$(create_list_in_space "$SPACE_ID" "Google Ads")
contentcal=$(create_list_in_space "$SPACE_ID" "Content Calendar")

kpirs_id=$(echo "$kpirs" | jq -r '.id')
metaads_id=$(echo "$metaads" | jq -r '.id')
googleads_id=$(echo "$googleads" | jq -r '.id')
contentcal_id=$(echo "$contentcal" | jq -r '.id')

echo "KPIs & Reports: $kpirs_id"
echo "Meta Ads: $metaads_id"
echo "Google Ads: $googleads_id"
echo "Content Calendar: $contentcal_id"

echo "==> Adicionando views"
create_view "$kpirs_id" "Tabela – KPIs" "table" >/dev/null
create_view "$kpirs_id" "Kanban – KPIs" "board" >/dev/null
create_view "$metaads_id" "Kanban – Meta Ads" "board" >/dev/null
create_view "$metaads_id" "Tabela – Meta Ads" "table" >/dev/null
create_view "$googleads_id" "Kanban – Google Ads" "board" >/dev/null
create_view "$googleads_id" "Tabela – Google Ads" "table" >/dev/null
create_view "$contentcal_id" "Calendário – Conteúdo" "calendar" >/dev/null
create_view "$contentcal_id" "Tabela – Conteúdo" "table" >/dev/null

echo "==> Criando tarefas exemplo"
create_task "$kpirs_id" "🎯 Meta Q4: Aumentar Leads em 30% até 31/12" "KPI principal: Leads. Meta: +30% sobre baseline de outubro. CPL alvo ≤ R$ 12. Rotina: atualizar dashboard semanalmente; revisar criativos; garantir sincronização diária no Supabase." "2025-12-31" >/dev/null
create_task "$metaads_id" "Campanha Meta Ads: Leads Vermezzo – Novembro" "Objetivo: Leads. Público: interessados no Vermezzo. Materiais: imagem, vídeo, story. Padronizar UTMs e eventos. Due: 13/11/25." "2025-11-13" >/dev/null
create_task "$googleads_id" "Campanha Google Ads: Search Leads Vermezzo – Novembro" "Objetivo: Leads via pesquisa. Palavras-chave: vermezzo, comprar, preço, loft. Landing com formulário. Due: 13/11/25." "2025-11-13" >/dev/null
create_task "$contentcal_id" "Content Calendar: Vermezzo – Novembro" "Planejamento de posts (feed, reels, stories). Vincular com campanhas ativas e cronograma. Due: 20/11/25." "2025-11-20" >/dev/null

echo "✅ Listas e tarefas criadas. Revise no ClickUp."

