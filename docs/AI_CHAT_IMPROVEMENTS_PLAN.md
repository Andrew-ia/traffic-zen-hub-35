# Plano de Melhorias do AI Chat
**Data:** 2025-11-06
**Objetivo:** Implementar histórico persistente de conversas e sistema de agentes personalizados

---

## 📋 Problemas Atuais Identificados

1. **Histórico de conversas não persiste** - Ao mudar de página, o chat perde todo o histórico
2. **Falta gestão de conversas** - Não há como ver conversas anteriores ou retornar a elas
3. **Falta sistema de agentes** - Não é possível criar agentes especializados com prompts customizados
4. **UX limitada** - Falta botões para "Nova Conversa" visível e gerenciamento de agentes

---

## 🏗️ Arquitetura Proposta

### **1. Histórico Persistente de Conversas**

#### Backend (Já existe parcialmente):
```
✅ Tabela: chat_conversations
  - id (uuid)
  - workspace_id (uuid)
  - user_id (text)
  - title (text) ← Gerar automaticamente do primeiro prompt
  - created_at, updated_at

✅ Tabela: chat_messages
  - id (uuid)
  - conversation_id (uuid)
  - role (user/assistant)
  - content (text)
  - metadata (jsonb)
  - created_at
```

#### Funcionalidades Necessárias:

**A. Persistência Automática:**
- ✅ Já salva conversas no banco (via `/api/ai/chat`)
- 🔄 Precisa: Carregar conversas ao iniciar página
- 🔄 Precisa: Auto-save em tempo real

**B. Sidebar de Conversas:**
```
+---------------------------+
|  [+ Nova Conversa]        |
|---------------------------|
| 📅 Hoje                   |
|  💬 Analise campanha...   |
|  💬 Como otimizar...      |
|---------------------------|
| 📅 Ontem                  |
|  💬 Métricas do Meta...   |
|---------------------------|
| 📅 Esta Semana            |
|  💬 Campanha WhatsApp     |
+---------------------------+
```

---

### **2. Sistema de Agentes Personalizados**

#### Nova Tabela: `ai_agents`
```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT, -- emoji ou nome do ícone
  color TEXT, -- cor do avatar
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ai_agents_workspace ON ai_agents(workspace_id);
CREATE INDEX idx_ai_agents_active ON ai_agents(workspace_id, is_active);
```

#### Relacionar Agente com Conversa:
```sql
ALTER TABLE chat_conversations
ADD COLUMN agent_id UUID REFERENCES ai_agents(id);

CREATE INDEX idx_conversations_agent ON chat_conversations(agent_id);
```

#### Agentes Padrão Pré-configurados:

1. **🎯 Analista de Campanhas** (atual)
   - Prompt: O que já temos hoje (Andromeda + análise de dados)
   - Função: Análise geral de performance

2. **📝 Especialista em Copy**
   - Prompt: Focado em análise de textos, títulos, CTAs
   - Função: Melhorar copies e criativos

3. **💰 Otimizador de ROI**
   - Prompt: Focado em custo, conversões, ROAS
   - Função: Reduzir custos e maximizar retorno

4. **🎨 Estrategista de Criativos**
   - Prompt: Focado em formatos, layouts, imagens/vídeos
   - Função: Sugerir novos criativos

5. **📊 Auditor de Dados**
   - Prompt: Focado em discrepâncias, erros, validação
   - Função: Encontrar problemas nos dados

---

### **3. UI/UX - Componentes Necessários**

#### **A. Layout Principal**
```
+----------+----------------------------------+
| SIDEBAR  |         CHAT AREA               |
|          |  [Agente Selecionado] [Config]  |
| Agentes  |  +--------------------------+   |
| -------  |  | Mensagens                |   |
| 🎯 Geral |  |                          |   |
| 📝 Copy  |  |                          |   |
| 💰 ROI   |  |                          |   |
|          |  +--------------------------+   |
| Conversas|  [Nova Conversa] [Input...]    |
| --------  +----------------------------------+
| 💬 Hoje  |
| 💬 Ontem |
+----------+
```

#### **B. Novos Componentes**

1. **`<AgentSelector />`**
   - Dropdown ou tabs para escolher agente
   - Mostra nome, ícone e descrição
   - Botão "+ Novo Agente"

2. **`<ConversationSidebar />`**
   - Lista de conversas agrupadas por data
   - Botão "Nova Conversa" destacado
   - Busca de conversas
   - Delete/Archive conversa

3. **`<AgentConfigModal />`**
   - Abrir ao clicar em [Config] ou "+ Novo Agente"
   - Campos:
     - Nome do agente
     - Descrição curta
     - Ícone (picker de emoji)
     - Cor do avatar
     - **System Prompt** (textarea grande)
   - Botões: "Duplicar Agente Atual", "Salvar", "Cancelar"

4. **`<ConversationHeader />`**
   - Mostra agente atual
   - Botão de configuração do agente
   - Título da conversa (editável)
   - Botão "Nova Conversa"

---

## 🎨 Fluxo de Usuário

### **Fluxo 1: Usar Chat Normalmente**
1. Usuário entra na página AI Chat
2. Sistema carrega última conversa ativa (ou cria nova)
3. Usuário digita mensagem
4. ✅ Mensagem salva automaticamente no banco
5. ✅ Conversa permanece mesmo ao navegar para outra página

### **Fluxo 2: Ver Histórico**
1. Usuário clica na sidebar de conversas
2. Vê lista de conversas anteriores
3. Clica em uma conversa
4. Chat carrega histórico completo daquela conversa

### **Fluxo 3: Nova Conversa**
1. Usuário clica em "Nova Conversa"
2. Sistema cria nova conversa com agente atual
3. Chat limpa mensagens e começa do zero

### **Fluxo 4: Criar Agente Personalizado**
1. Usuário clica em "+ Novo Agente"
2. Modal abre com campos vazios
3. Opção: "Duplicar do Agente Atual" → preenche com prompt do agente em uso
4. Usuário edita nome, prompt, etc.
5. Salva → Agente aparece na lista de agentes

### **Fluxo 5: Editar Agente Existente**
1. Usuário seleciona agente
2. Clica no botão de configuração [⚙️]
3. Modal abre com dados do agente
4. Usuário edita prompt
5. Salva → Conversas NOVAS usarão o prompt atualizado

---

## 📐 Estrutura de Arquivos

### **Novos Arquivos Backend:**
```
server/
├── api/
│   └── ai/
│       ├── agents.ts          # CRUD de agentes
│       └── conversations.ts    # GET conversas (já existe parcialmente)
├── services/
│   └── agentService.ts        # Lógica de agentes
└── types/
    └── agent.ts               # Tipos TypeScript

db/
└── migrations/
    └── 0022_ai_agents.sql     # Criar tabela ai_agents
```

### **Novos Arquivos Frontend:**
```
src/
├── components/
│   └── ai/
│       ├── AgentSelector.tsx
│       ├── AgentConfigModal.tsx
│       ├── ConversationSidebar.tsx
│       ├── ConversationHeader.tsx
│       └── ConversationList.tsx
├── hooks/
│   ├── useAgents.ts
│   └── useConversations.ts
├── types/
│   └── agent.ts
└── pages/
    └── AIChat.tsx             # Atualizar layout
```

---

## 🚀 Roadmap de Implementação

### **FASE 1: Histórico Persistente** ⏱️ 2-3 horas

#### Tarefa 1.1: Backend - API de Conversas
- [ ] Criar endpoint `GET /api/ai/conversations` (já existe?)
- [ ] Criar endpoint `GET /api/ai/conversations/:id` com mensagens
- [ ] Criar endpoint `DELETE /api/ai/conversations/:id`
- [ ] Criar endpoint `PATCH /api/ai/conversations/:id` (editar título)

#### Tarefa 1.2: Frontend - Carregar Histórico
- [ ] Criar hook `useConversations(workspaceId)`
- [ ] Atualizar `AIChat.tsx` para carregar conversa ao montar
- [ ] Salvar `conversationId` no localStorage (fallback)

#### Tarefa 1.3: Frontend - Sidebar de Conversas
- [ ] Criar componente `<ConversationSidebar />`
- [ ] Listar conversas agrupadas por data
- [ ] Implementar click para trocar conversa
- [ ] Adicionar botão "Nova Conversa" proeminente

#### Tarefa 1.4: UX - Títulos Automáticos
- [ ] Gerar título da conversa a partir do primeiro prompt
- [ ] Permitir edição de título (inline edit)

---

### **FASE 2: Sistema de Agentes** ⏱️ 4-5 horas

#### Tarefa 2.1: Database
- [ ] Criar migration `0022_ai_agents.sql`
- [ ] Adicionar coluna `agent_id` em `chat_conversations`
- [ ] Seed com agentes padrão (5 agentes pré-configurados)

#### Tarefa 2.2: Backend - API de Agentes
- [ ] Criar endpoint `GET /api/ai/agents` (listar ativos)
- [ ] Criar endpoint `POST /api/ai/agents` (criar novo)
- [ ] Criar endpoint `PATCH /api/ai/agents/:id` (editar)
- [ ] Criar endpoint `DELETE /api/ai/agents/:id` (soft delete)
- [ ] Atualizar `aiService.ts` para usar `agent.system_prompt`

#### Tarefa 2.3: Frontend - Gestão de Agentes
- [ ] Criar hook `useAgents(workspaceId)`
- [ ] Criar componente `<AgentSelector />`
- [ ] Criar componente `<AgentConfigModal />`
- [ ] Implementar lógica de duplicar agente

#### Tarefa 2.4: Frontend - Integrar com Chat
- [ ] Atualizar `AIChat.tsx` para usar agente selecionado
- [ ] Passar `agentId` ao criar nova conversa
- [ ] Mostrar agente atual no header do chat
- [ ] Permitir trocar de agente (cria nova conversa)

---

### **FASE 3: Polimento e UX** ⏱️ 2-3 horas

#### Tarefa 3.1: Design e Responsividade
- [ ] Sidebar colapsável em mobile
- [ ] Animações de transição
- [ ] Loading states
- [ ] Empty states (sem conversas, sem agentes)

#### Tarefa 3.2: Features Extras
- [ ] Busca em conversas (por conteúdo)
- [ ] Filtrar conversas por agente
- [ ] Exportar conversa (markdown/PDF)
- [ ] Favoritar conversas importantes
- [ ] Arquivar conversas antigas

#### Tarefa 3.3: Feedback Visual
- [ ] Toast ao salvar agente
- [ ] Confirmação ao deletar conversa
- [ ] Indicador de "salvando..."
- [ ] Badge com contagem de mensagens por conversa

---

## 🎯 Prioridades

### **P0 - CRÍTICO** (Fazer Primeiro):
1. ✅ Carregar histórico ao abrir página
2. ✅ Botão "Nova Conversa" funcional
3. ✅ Sidebar com lista de conversas
4. ✅ Trocar entre conversas

### **P1 - IMPORTANTE**:
1. ✅ Sistema de agentes básico (criar, editar, deletar)
2. ✅ Agentes padrão pré-configurados
3. ✅ Modal de configuração de agente
4. ✅ Duplicar agente atual

### **P2 - NICE TO HAVE**:
1. ⭐ Busca em conversas
2. ⭐ Exportar conversa
3. ⭐ Favoritar/Arquivar
4. ⭐ Analytics de uso de agentes

---

## 💾 Migrations SQL

### **Migration: 0022_ai_agents.sql**
```sql
-- Criar tabela de agentes
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT DEFAULT '🤖',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_workspace ON ai_agents(workspace_id);
CREATE INDEX idx_ai_agents_active ON ai_agents(workspace_id, is_active);

-- Adicionar agent_id nas conversas
ALTER TABLE chat_conversations
ADD COLUMN agent_id UUID REFERENCES ai_agents(id);

CREATE INDEX idx_conversations_agent ON chat_conversations(agent_id);

-- Seed: Agentes padrão
INSERT INTO ai_agents (workspace_id, name, description, system_prompt, icon, color, is_default)
SELECT
  id as workspace_id,
  'Analista de Campanhas',
  'Especialista em análise geral de performance de campanhas Meta Ads e Google Ads',
  '<PROMPT_ATUAL_DO_SISTEMA>',
  '🎯',
  '#6366f1',
  true
FROM workspaces;

-- Mais 4 agentes padrão...
```

---

## 📊 Estimativa de Tempo

| Fase | Descrição | Tempo Estimado |
|------|-----------|----------------|
| Fase 1 | Histórico Persistente | 2-3 horas |
| Fase 2 | Sistema de Agentes | 4-5 horas |
| Fase 3 | Polimento e UX | 2-3 horas |
| **TOTAL** | **Implementação Completa** | **8-11 horas** |

---

## ✅ Critérios de Sucesso

### **Histórico Persistente:**
- [ ] Conversa permanece ao navegar para outras páginas
- [ ] Usuário pode ver lista de conversas anteriores
- [ ] Usuário pode retornar a uma conversa antiga
- [ ] Botão "Nova Conversa" claramente visível

### **Sistema de Agentes:**
- [ ] Usuário pode criar agente personalizado
- [ ] Usuário pode editar prompt de um agente
- [ ] Usuário pode duplicar agente existente
- [ ] Conversas usam o prompt do agente selecionado
- [ ] 5 agentes padrão disponíveis

### **UX Geral:**
- [ ] Interface intuitiva e responsiva
- [ ] Feedback visual claro em todas ações
- [ ] Performance rápida (< 500ms para trocar conversa)
- [ ] Sem perda de dados ao navegar

---

## 🚨 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Performance lenta com muitas conversas | Média | Médio | Paginação + lazy loading |
| Conflito de prompts entre agentes | Baixa | Alto | Validação e testes |
| Usuário confuso com múltiplos agentes | Média | Médio | Tooltips e onboarding |
| Perda de mensagens ao trocar página | Alta | Alto | Auto-save agressivo |

---

## 📝 Notas Importantes

1. **Retrocompatibilidade:** Conversas existentes devem funcionar sem agent_id (usar default)
2. **Segurança:** Validar que usuário só acessa conversas do seu workspace
3. **Performance:** Implementar cache de conversas recentes
4. **Mobile:** Sidebar deve ser colapsável/modal em telas pequenas

---

## 🎨 Mockups Conceituais

### **Desktop View:**
```
+----------------+----------------------------------------+
|   AGENTES      |  🎯 Analista de Campanhas     [⚙️]    |
|   =========    |  ------------------------------------ |
|                |                                        |
| 🎯 Geral       |  💬 User: Analise campanha whatsapp   |
| 📝 Copy        |  🤖 AI: Aqui está a análise...         |
| 💰 ROI         |                                        |
| 🎨 Criativos   |  💬 User: E os criativos?              |
| 📊 Auditor     |  🤖 AI: Os criativos mostram...        |
|                |                                        |
| [+ Novo Agente]|  ------------------------------------ |
|                |                                        |
|   CONVERSAS    |  [Nova Conversa]  [Digite mensagem...] |
|   =========    +----------------------------------------+
|                |
| 📅 Hoje        |
| 💬 Análise...  |
| 💬 Como oti... |
|                |
| 📅 Ontem       |
| 💬 Métricas... |
+----------------+
```

### **Agent Config Modal:**
```
+---------------------------------------+
|  ⚙️  Configurar Agente                |
|---------------------------------------|
|                                       |
|  Nome: [Meu Agente Personalizado]    |
|                                       |
|  Descrição:                           |
|  [Especialista em...]                 |
|                                       |
|  Ícone: [🎯] [Escolher emoji]         |
|  Cor: [#6366f1] [Color picker]       |
|                                       |
|  System Prompt:                       |
|  +----------------------------------+ |
|  | Você é um assistente...          | |
|  | especializado em...              | |
|  |                                  | |
|  | (textarea grande)                | |
|  +----------------------------------+ |
|                                       |
|  [Duplicar Agente Atual]              |
|  [Cancelar]  [Salvar Agente]          |
+---------------------------------------+
```

---

## 🔄 Próximos Passos

1. **Revisar e aprovar** este plano
2. **Decidir prioridades**: Fazer tudo ou apenas Fase 1?
3. **Criar branch**: `feature/ai-chat-improvements`
4. **Começar implementação** pela Fase 1
5. **Testar incrementalmente** cada fase
6. **Deploy gradual** (feature flags?)

---

**Documento criado por:** Claude Code
**Aprovado por:** ________
**Data de início:** ________
**Data prevista de conclusão:** ________
