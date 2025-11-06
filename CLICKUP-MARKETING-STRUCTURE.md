# ClickUp – Estrutura de Marketing (Metas → Campanhas → Operacional)

Este guia implementa uma hierarquia clara no ClickUp para o time de marketing:

1) Área: `Marketing` (Space/Folder existente)
2) Lista: `Metas` (objetivos estratégicos do departamento)
3) Lista: `Campanhas` (iniciativas específicas associadas às metas)
4) Detalhes operacionais de cada campanha via subtarefas:
   - Quantidade de materiais criativos necessários
   - Cronograma com datas específicas de produção e publicação
   - Designação de responsáveis por cada tarefa
   - Conteúdo textual (copy) para cada material criativo

## Como aplicar automaticamente

Pré-requisitos:
- Obter o token de API do ClickUp (`CLICKUP_TOKEN`)
- Identificar o `MARKETING_FOLDER_ID` (pasta “Marketing”), ou `SPACE_ID` caso opte por criar listas no Space

Passos:

```bash
export CLICKUP_TOKEN="pk_xxx"              # seu token de API
export MARKETING_FOLDER_ID="12345678"      # id da pasta Marketing
# ou: export SPACE_ID="87654321"          # id do Space Marketing

bash scripts/clickup/setup-marketing-structure.sh
```

O script irá:
- Criar as listas `Metas` e `Campanhas`
- Adicionar views principais (Kanban, Table e Calendar)
- Criar uma tarefa de exemplo em `Metas`
- Criar uma tarefa mestre de campanha com subtarefas operacionais

## Custom Fields recomendados (criar via UI)

Como a API não cria custom fields, crie manualmente os campos abaixo e depois podemos preencher via API:

Lista `Metas`:
- `Período` (date range)
- `KPI principal` (dropdown: Leads, Conversas, Cliques, Engajamentos, Compras)
- `Responsável` (people)

Lista `Campanhas`:
- `Objetivo` (dropdown: Leads, Conversas, Tráfego, Engajamento, Compras)
- `Canal` (dropdown: Meta, Google, Instagram)
- `Budget` (currency)
- `KPI Alvo` (number)
- `Owner` (people)

## Views sugeridas

Lista `Metas`:
- `Kanban – Metas`: por status (To do, In progress, Done)
- `Tabela – Metas`: colunas de due date, responsável, KPI

Lista `Campanhas`:
- `Kanban – Campanhas`: pipeline (Planejamento → Produção → Aprovação → Publicação → Acompanhamento)
- `Calendário – Campanhas`: datas de produção/publicação
- `Tabela – Campanhas`: budget, objetivo, canal, KPI

## Template de campanha (subtarefas)

- `Materiais criativos – N peças`
  - Descrever formatos (imagem, vídeo, story) e anexar assets
- `Cronograma`
  - Produção, Aprovação, Publicação, Otimização (com due dates)
- `Responsáveis`
  - Atribuir designers, copywriters, mídia e social; adicionar checklists
- `Copy (versões)`
  - Versão feed, reels e story; CTAs e guidelines de branding

## Boas práticas

- Vincular campanhas de canais (Meta Ads/Google Ads/Instagram) à campanha mestre via links
- Padronizar UTMs e garantir mensuração em GA4/Supabase
- Revisar KPIs semanalmente e registrar decisões na tarefa da meta

---

Se quiser, posso preencher automaticamente valores de custom fields (após criá-los na UI) e criar campanhas mestre com links para tarefas já existentes em `Meta Ads`, `Google Ads` e `Content Calendar`.

