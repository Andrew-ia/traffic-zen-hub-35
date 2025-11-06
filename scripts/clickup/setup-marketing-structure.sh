#!/usr/bin/env bash
set -euo pipefail

# Configuração necessária:
#   - Exportar CLICKUP_TOKEN no ambiente
#   - Definir MARKETING_FOLDER_ID (ID da pasta "Marketing")
#   - Alternativamente, definir SPACE_ID para criar listas diretamente no Space
#
# Exemplo:
#   export CLICKUP_TOKEN="pk_xxx" 
#   export MARKETING_FOLDER_ID="12345678"
#   bash scripts/clickup/setup-marketing-structure.sh

API="https://api.clickup.com/api/v2"

if [[ -z "${CLICKUP_TOKEN:-}" ]]; then
  echo "[ERRO] CLICKUP_TOKEN não definido." >&2
  exit 1
fi

AUTH_HEADER=("-H" "Authorization: ${CLICKUP_TOKEN}")
JSON_HEADER=("-H" "Content-Type: application/json")

function create_list_in_folder() {
  local folder_id="$1"; shift
  local name="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" '{name: $name, content: "Auto-criado via script", uncategorized_tasks_enabled: true}')
  curl -sS -X POST "${API}/folder/${folder_id}/list" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "${payload}"
}

function create_view() {
  local list_id="$1"; shift
  local name="$1"; shift
  local type="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" --arg type "$type" '{name: $name, type: $type, visibility: {show_closed: false}, settings: {show_assignees: true}}')
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

function create_subtask() {
  local list_id="$1"; shift
  local parent_id="$1"; shift
  local name="$1"; shift
  local desc="$1"; shift
  local due_date="$1"; shift
  local payload
  payload=$(jq -nc --arg name "$name" --arg desc "$desc" --arg due "$due_date" --arg parent "$parent_id" '{name: $name, description: $desc, due_date: $due, parent: $parent}')
  curl -sS -X POST "${API}/list/${list_id}/task" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d "${payload}"
}

echo "==> Criando listas 'Metas' e 'Campanhas'"
if [[ -n "${MARKETING_FOLDER_ID:-}" ]]; then
  metas=$(create_list_in_folder "$MARKETING_FOLDER_ID" "Metas")
  campanhas=$(create_list_in_folder "$MARKETING_FOLDER_ID" "Campanhas")
else
  if [[ -z "${SPACE_ID:-}" ]]; then
    echo "[ERRO] Defina MARKETING_FOLDER_ID ou SPACE_ID." >&2
    exit 1
  fi
  metas=$(curl -sS -X POST "${API}/space/${SPACE_ID}/list" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d '{"name":"Metas"}')
  campanhas=$(curl -sS -X POST "${API}/space/${SPACE_ID}/list" "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" -d '{"name":"Campanhas"}')
fi

metas_id=$(echo "$metas" | jq -r '.id')
campanhas_id=$(echo "$campanhas" | jq -r '.id')

echo "Metas List ID: $metas_id"
echo "Campanhas List ID: $campanhas_id"

echo "==> Criando views principais"
create_view "$metas_id" "Kanban – Metas" "board" >/dev/null
create_view "$metas_id" "Tabela – Metas" "table" >/dev/null
create_view "$campanhas_id" "Kanban – Campanhas" "board" >/dev/null
create_view "$campanhas_id" "Calendário – Campanhas" "calendar" >/dev/null
create_view "$campanhas_id" "Tabela – Campanhas" "table" >/dev/null

echo "==> Criando tarefa de exemplo (Meta)"
meta_task=$(create_task "$metas_id" "🎯 Meta Q4: +30% Leads até 31/12" "KPI principal: Leads. Meta: +30% sobre baseline de outubro. CPL alvo <= R$ 12. Atualizar dashboard semanalmente." "2025-12-31")
meta_task_id=$(echo "$meta_task" | jq -r '.id')
echo "Meta task ID: $meta_task_id"

echo "==> Criando campanha mestre e subtarefas"
camp_task=$(create_task "$campanhas_id" "📣 Campanha: Leads Vermezzo – Novembro (Master)" "Campanha cross-canal para geração de leads. Vincule tarefas de Meta Ads, Google Ads e Instagram. Utilize UTMs padronizadas e mantenha cronograma atualizado." "2025-11-30")
camp_task_id=$(echo "$camp_task" | jq -r '.id')
echo "Campanha task ID: $camp_task_id"

create_subtask "$campanhas_id" "$camp_task_id" "Materiais criativos – 3 peças" "Definir formatos: Imagem (feed), Vídeo (reels), Story. Adicionar links para assets e aprovar com design." "2025-11-12" >/dev/null
create_subtask "$campanhas_id" "$camp_task_id" "Cronograma" "Produção: até 10/11; Aprovação: 11/11; Publicação: 12/11; Otimização: 13–20/11" "2025-11-12" >/dev/null
create_subtask "$campanhas_id" "$camp_task_id" "Responsáveis" "Design: TBD; Copy: TBD; Mídia: TBD; Social: TBD. Atribuir responsáveis e adicionar checklists." "2025-11-11" >/dev/null
create_subtask "$campanhas_id" "$camp_task_id" "Copy (versões)" "Versão 1 (feed), Versão 2 (reels), Versão 3 (story). Colar textos e CTAs, revisar com branding." "2025-11-10" >/dev/null

echo "✅ Estrutura criada com sucesso. Revise no ClickUp."

