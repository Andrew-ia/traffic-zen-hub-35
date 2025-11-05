# Biblioteca de Campanhas - TrafficPro

## Visão Geral

A **Biblioteca de Campanhas** é um sistema completo para gerenciar templates e planejar campanhas de marketing. Este recurso permite que você:

- 📋 Crie e organize templates de campanhas
- 🎨 Armazene criativos (imagens e vídeos)
- 📊 Gerencie públicos-alvo e orçamentos
- 🔄 Copie campanhas facilmente para reutilizar configurações
- 🏷️ Categorize com tags para melhor organização
- 🔍 Filtre e pesquise campanhas rapidamente

## Acesso

Acesse a Biblioteca de Campanhas através do menu lateral:
- **Rota**: `/campaigns/library`
- **Menu**: Biblioteca de Campanhas

## Estrutura do Banco de Dados

### Tabela: `campaign_library`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `workspace_id` | UUID | ID do workspace |
| `name` | TEXT | Nome da campanha (ex: "Live Vermezzo - 23/10") |
| `objective` | TEXT | Objetivo (Engajamento, Mensagens, Conversões, etc.) |
| `schedule_days` | TEXT | Dias e horários (ex: "Seg, Qua, Sex - 15h às 22h") |
| `audience` | TEXT | Público-alvo (ex: "Mulheres 25-55, Santos +10km") |
| `budget` | NUMERIC | Valor do orçamento |
| `budget_type` | TEXT | Tipo: 'total' ou 'daily' |
| `copy_primary` | TEXT | Texto principal do anúncio |
| `copy_title` | TEXT | Título curto |
| `cta` | TEXT | Call to Action |
| `creative_url` | TEXT | URL do criativo no Supabase Storage |
| `creative_type` | TEXT | Tipo: 'image', 'video', 'carousel' |
| `status` | TEXT | Status: 'rascunho', 'ativo', 'pausado', 'arquivado' |
| `notes` | TEXT | Observações gerais |
| `tags` | TEXT[] | Array de tags para categorização |
| `platform` | TEXT | Plataforma: 'Meta', 'Google', 'TikTok', 'Multi-plataforma' |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Data da última atualização |
| `last_used_at` | TIMESTAMP | Última vez que foi copiada/usada |

### Bucket de Storage: `creatives`

- **Nome**: `creatives`
- **Acesso**: Público (leitura)
- **Limite de tamanho**: 50MB por arquivo
- **Tipos permitidos**:
  - Imagens: JPEG, PNG, GIF, WebP
  - Vídeos: MP4, QuickTime, WebM
  - Documentos: PDF

## Funcionalidades

### 1. Criar Nova Campanha

1. Clique no botão **"Nova Campanha"**
2. Preencha os campos do formulário:
   - **Nome** (obrigatório)
   - Objetivo, Plataforma, Público-alvo
   - Orçamento (total ou diário)
   - Programação (dias e horários)
   - Tags para categorização
3. Adicione o conteúdo do anúncio:
   - Título
   - Texto principal
   - Call to Action (CTA)
4. Faça upload do criativo (opcional):
   - Imagens até 50MB
   - Vídeos até 50MB
5. Adicione observações (opcional)
6. Clique em **"Criar Campanha"**

### 2. Visualizar Detalhes

1. Na tabela, clique no menu de ações (três pontos)
2. Selecione **"Ver Detalhes"**
3. Um modal será aberto com todas as informações:
   - Dados da campanha
   - Conteúdo do anúncio
   - Preview do criativo
   - Observações

### 3. Editar Campanha

1. No menu de ações, selecione **"Editar"**
2. Atualize os campos desejados
3. Clique em **"Salvar Alterações"**

### 4. Copiar Campanha

Há duas formas de copiar uma campanha:

**Opção 1 - Menu de Ações:**
1. Clique no menu de ações (três pontos)
2. Selecione **"Copiar"**
3. Uma cópia será criada automaticamente como rascunho

**Opção 2 - Modal de Detalhes:**
1. Abra os detalhes da campanha
2. Clique em **"Copiar para Nova Campanha"**
3. A cópia será criada como rascunho

> **Nota**: Campanhas copiadas sempre são criadas com status "rascunho" e o nome original + " (Cópia)".

### 5. Excluir Campanha

1. No menu de ações, selecione **"Excluir"**
2. Confirme a exclusão
3. A campanha será removida permanentemente

### 6. Filtrar e Pesquisar

Use os filtros disponíveis para encontrar campanhas:

- **Busca por texto**: Nome, copy, notas
- **Status**: Rascunho, Ativo, Pausado, Arquivado
- **Objetivo**: Engajamento, Mensagens, Conversões, etc.
- **Plataforma**: Meta, Google, TikTok

## API Endpoints

### GET `/api/campaigns/library/:workspaceId`
Busca todas as campanhas de um workspace.

**Query Parameters:**
- `status` - Filtrar por status
- `objective` - Filtrar por objetivo
- `platform` - Filtrar por plataforma
- `tags` - Filtrar por tags (separadas por vírgula)
- `search` - Busca por texto

**Resposta:**
```json
{
  "success": true,
  "campaigns": [...],
  "total": 10
}
```

### GET `/api/campaigns/library/item/:id`
Busca uma campanha específica por ID.

### POST `/api/campaigns/library`
Cria uma nova campanha.

**Body:**
```json
{
  "workspace_id": "uuid",
  "name": "Nome da Campanha",
  "objective": "Engajamento",
  "audience": "Mulheres 25-55",
  "budget": 1000,
  "budget_type": "daily",
  ...
}
```

### PUT `/api/campaigns/library/:id`
Atualiza uma campanha existente.

### DELETE `/api/campaigns/library/:id`
Exclui uma campanha.

### POST `/api/campaigns/library/:id/copy`
Copia uma campanha existente.

**Body:**
```json
{
  "workspace_id": "uuid"
}
```

## Componentes React

### Hook: `useCampaignLibrary`

```typescript
import { useCampaignLibrary } from '@/hooks/useCampaignLibrary';

const {
  campaigns,
  loading,
  error,
  fetchCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  copyCampaign,
  uploadCreative,
} = useCampaignLibrary(workspaceId, filters);
```

### Componentes

- **CampaignLibrary** (`/src/pages/CampaignLibrary.tsx`) - Página principal
- **CampaignDetailsModal** - Modal de visualização de detalhes
- **CampaignFormModal** - Modal de criação/edição

## Fluxo de Trabalho Recomendado

### 1. Planejamento
- Crie templates de campanhas bem-sucedidas
- Organize com tags por evento, período, produto
- Adicione observações sobre performance

### 2. Criação
- Use "Copiar" para iniciar nova campanha baseada em template
- Ajuste datas, orçamento e copy conforme necessário
- Faça upload de novos criativos se necessário

### 3. Organização
- Marque campanhas antigas como "Arquivado"
- Use tags para categorizar por:
  - Evento (Black Friday, Natal, etc.)
  - Período (Verão 2024, Q1 2025)
  - Produto/Serviço
  - Tipo de campanha (Awareness, Conversion)

## Boas Práticas

### Nomenclatura
- Use nomes descritivos: "Live Vermezzo - 23/10 - Instagram"
- Inclua data ou período no nome
- Adicione plataforma se relevante

### Tags
- Crie um sistema consistente de tags
- Exemplos:
  - Por evento: "black-friday", "natal-2024"
  - Por produto: "coleção-verão", "outlet"
  - Por objetivo: "awareness", "conversion"

### Criativos
- Sempre faça upload dos criativos
- Use nomes descritivos para os arquivos
- Mantenha backups dos arquivos originais

### Observações
- Documente resultados de testes A/B
- Anote métricas de performance importantes
- Registre insights e aprendizados

## Troubleshooting

### Erro ao fazer upload de criativo

**Problema**: "Erro no upload"

**Soluções**:
1. Verifique o tamanho do arquivo (máx. 50MB)
2. Confirme que o formato é suportado
3. Verifique conexão com internet
4. Tente novamente após alguns segundos

### Campanhas não aparecem

**Problema**: Lista vazia ou campanhas não carregam

**Soluções**:
1. Verifique os filtros aplicados
2. Limpe a busca por texto
3. Recarregue a página (F5)
4. Verifique se está no workspace correto

### Erro ao copiar campanha

**Problema**: "Falha ao copiar campanha"

**Soluções**:
1. Verifique permissões do workspace
2. Confirme que a campanha original existe
3. Tente novamente após alguns segundos

## Scripts de Manutenção

### Criar bucket de storage
```bash
node scripts/create-storage-bucket.js
```

### Executar migration da tabela
```bash
node scripts/run-sql.js scripts/create-campaign-library.sql
```

## Próximos Passos

Funcionalidades planejadas para versões futuras:

- [ ] Integração com Meta Ads API para publicar direto
- [ ] Versionamento de campanhas
- [ ] Templates pré-configurados por objetivo
- [ ] Analytics de performance dos templates
- [ ] Compartilhamento de templates entre workspaces
- [ ] Importação/exportação em massa
- [ ] Histórico de alterações

## Suporte

Para problemas ou dúvidas:
1. Verifique esta documentação
2. Consulte os logs do servidor
3. Abra uma issue no repositório

---

**Versão**: 1.0.0
**Última atualização**: Novembro 2025
