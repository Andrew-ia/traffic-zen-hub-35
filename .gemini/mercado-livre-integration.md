# Integração com Mercado Livre

## Visão Geral

Esta documentação descreve a implementação da integração com a **API do Mercado Livre** no projeto Traffic Zen Hub. A integração permite visualizar métricas de vendas, produtos, perguntas e analytics do seu marketplace.

## Arquitetura

A integração foi construída seguindo a arquitetura existente do projeto:

### Frontend (`/src`)

1. **Página Principal**: `src/pages/MercadoLivre.tsx`
   - Dashboard completo com métricas, gráficos e tabelas
   - Visualização em tempo real de vendas, receita e produtos
   - Sistema de perguntas e respostas

2. **Hooks Customizados**: `src/hooks/useMercadoLivre.ts`
   - `useMercadoLivreMetrics()` - Métricas agregadas
   - `useMercadoLivreProducts()` - Lista de produtos
   - `useMercadoLivreQuestions()` - Perguntas recebidas
   - `useSyncMercadoLivre()` - Sincronização de dados
   - `useAnswerMercadoLivreQuestion()` - Responder perguntas
   - `useUpdateMercadoLivreProductPrice()` - Atualizar preços
   - `useToggleMercadoLivreProduct()` - Pausar/ativar produtos

3. **Rotas**: Configurado em `src/App.tsx`
   - Rota: `/mercado-livre`
   - Protegido por autenticação (`RequireAuth`)

4. **Navegação**: Item adicionado em `src/data/navigation.ts`
   - Ícone: ShoppingBag (amarelo)
   - Keywords: mercado livre, ecommerce, vendas, marketplace

### Backend (`/server`)

1. **API Routes**: `server/api/integrations/mercadolivre.ts`
   - **GET** `/api/integrations/mercadolivre/metrics` - Métricas
   - **GET** `/api/integrations/mercadolivre/products` - Lista de produtos
   - **GET** `/api/integrations/mercadolivre/questions` - Perguntas
   - **POST** `/api/integrations/mercadolivre/sync` - Sincronização
   - **POST** `/api/integrations/mercadolivre/questions/:questionId/answer` - Responder pergunta
   - **PUT** `/api/integrations/mercadolivre/products/:productId/price` - Atualizar preço
   - **PUT** `/api/integrations/mercadolivre/products/:productId/status` - Atualizar status

2. **Integração nas Rotas**: `server/routes/integrations.routes.ts`
   - Registrado como: `router.use('/mercadolivre', mercadoLivreRouter)`

## Recursos da API do Mercado Livre Utilizados

### 1. Métricas de Visitas
```
GET https://api.mercadolibre.com/users/{userId}/items_visits
```
- Retorna visitas de itens por período
- Parâmetros: `date_from`, `date_to`

### 2. Perguntas Recebidas
```
GET https://api.mercadolibre.com/users/{userId}/questions_searches
GET https://api.mercadolibre.com/questions/search
```
- Busca perguntas por período
- Status: ANSWERED, UNANSWERED

### 3. Vendas (Ordens)
```
GET https://api.mercadolibre.com/orders/search
```
- Busca vendas por período
- Filtro por seller_id

### 4. Produtos/Itens
```
GET https://api.mercadolibre.com/users/{userId}/items/search
GET https://api.mercadolibre.com/items/{itemId}
GET https://api.mercadolibre.com/items/{itemId}/visits
```
- Lista e detalha produtos
- Informações de estoque, preço, vendas

### 5. Reputação do Vendedor
```
GET https://api.mercadolibre.com/users/{userId}
```
- Retorna informações do vendedor
- Power Seller Status

### 6. Responder Perguntas
```
POST https://api.mercadolibre.com/answers
```
- Responde perguntas de compradores
- Body: `{ question_id, text }`

### 7. Atualizar Produtos
```
PUT https://api.mercadolibre.com/items/{itemId}
```
- Atualiza preço, status, estoque

## Configuração

### Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env.local`:

```env
# Mercado Livre API Credentials
MERCADO_LIVRE_ACCESS_TOKEN=your_access_token_here
MERCADO_LIVRE_REFRESH_TOKEN=your_refresh_token_here
MERCADO_LIVRE_USER_ID=your_user_id_here
MERCADO_LIVRE_APP_ID=your_app_id_here
MERCADO_LIVRE_CLIENT_SECRET=your_client_secret_here
```

### Obter Credenciais

1. **Criar Aplicação**: 
   - Acesse https://developers.mercadolivre.com.br/
   - Crie uma nova aplicação
   - Obtenha `APP_ID` e `CLIENT_SECRET`

2. **Autorização OAuth**:
   ```
   https://auth.mercadolibre.com.br/authorization?response_type=code&client_id={APP_ID}&redirect_uri={REDIRECT_URI}
   ```
   - Após autorizar, você receberá um `code`

3. **Trocar Code por Access Token**:
   ```bash
   curl -X POST \
     'https://api.mercadolibre.com/oauth/token' \
     -H 'Content-Type: application/json' \
     -d '{
       "grant_type": "authorization_code",
       "client_id": "{APP_ID}",
       "client_secret": "{CLIENT_SECRET}",
       "code": "{CODE}",
       "redirect_uri": "{REDIRECT_URI}"
     }'
   ```

4. **Resposta**:
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",
     "user_id": "...",
     "expires_in": 21600
   }
   ```

### Refresh Token

Os tokens expiram em 6 horas. Para renovar:

```bash
curl -X POST \
  'https://api.mercadolibre.com/oauth/token' \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "refresh_token",
    "client_id": "{APP_ID}",
    "client_secret": "{CLIENT_SECRET}",
    "refresh_token": "{REFRESH_TOKEN}"
  }'
```

## Funcionalidades Implementadas

### 1. Dashboard de Métricas
- **Total de Vendas**: Quantidade de vendas no período
- **Receita Total**: Valor total de vendas
- **Total de Visitas**: Visitas aos produtos
- **Taxa de Conversão**: (Vendas / Visitas) × 100
- **Produtos Ativos**: Quantidade de produtos publicados
- **Reputação**: Status do vendedor (Power Seller)

### 2. Top Produtos
- Lista dos produtos mais vendidos
- Métricas por produto:
  - Vendas
  - Visitas
  - Taxa de conversão
  - Receita

### 3. Perguntas e Respostas
- Visualização de perguntas recentes
- Status: Respondida / Pendente
- Funcionalidade para responder (API implementada)

### 4. Gráfico de Evolução
- Série temporal de vendas e receita
- Visualização por período configurável (7, 30, 90 dias)

### 5. Ações Rápidas
- Link direto para Mercado Livre
- Acesso a relatórios
- Responder perguntas

## Estrutura de Dados

### MercadoLivreMetrics
```typescript
{
  totalSales: number;
  totalRevenue: number;
  totalVisits: number;
  conversionRate: number;
  responseRate: number;
  reputation: string;
  lastSync: string;
  sellerId: string;
  salesTimeSeries: Array<{
    date: string;
    sales: number;
    revenue: number;
    visits: number;
  }>;
  alerts: Array<{
    title: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
}
```

### MercadoLivreProduct
```typescript
{
  id: string;
  title: string;
  price: number;
  thumbnail: string;
  sales: number;
  visits: number;
  conversionRate: number;
  revenue: number;
  status: "active" | "paused" | "closed";
  category: string;
  stock: number;
}
```

### MercadoLivreQuestion
```typescript
{
  id: string;
  text: string;
  productId: string;
  productTitle: string;
  date: string;
  answered: boolean;
  answer?: string;
}
```

## Melhorias Futuras

### 1. Sincronização Automática
- [ ] Implementar cron job para sync diário
- [ ] Salvar dados no banco Supabase
- [ ] Cache de dados para melhor performance

### 2. Notificações
- [ ] Alertas de novas perguntas
- [ ] Notificações de vendas
- [ ] Avisos de estoque baixo

### 3. Analytics Avançado
- [ ] Comparação com período anterior
- [ ] Previsão de vendas
- [ ] Análise de categorias
- [ ] ROI por produto

### 4. Automações
- [ ] Resposta automática de perguntas frequentes
- [ ] Ajuste automático de preços
- [ ] Gestão de estoque integrada

### 5. Multi-conta
- [ ] Suporte para múltiplas contas do Mercado Livre
- [ ] Gestão centralizada de credenciais
- [ ] Permissões por workspace

## Troubleshooting

### Erro 403 - Forbidden
- Verifique se o Access Token está válido
- Renove usando o Refresh Token
- Verifique as permissões da aplicação

### Erro 401 - Unauthorized
- Access Token expirado (6 horas de validade)
- Use o endpoint de refresh para renovar

### Erro 404 - Not Found
- Verifique se o User ID está correto
- Confirme se o item/produto existe

### Rate Limiting
- A API do Mercado Livre tem limites de requisições
- Implemente retry com exponential backoff
- Use cache para dados frequentemente acessados

## Documentação Oficial

- [Mercado Livre Developers](https://developers.mercadolivre.com.br/)
- [API Reference](https://developers.mercadolivre.com.br/pt_br/api-docs)
- [OAuth Guide](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [Marketplace Metrics](https://developers.mercadolivre.com.br/pt_br/metricas-e-noticias)

## Contato e Suporte

Para dúvidas ou suporte sobre a integração:
- Documentação interna do projeto
- Issues no repositório
- Slack #integrations

---

**Última atualização**: Dezembro 2025
**Versão**: 1.0.0
**Status**: ✅ Implementado
