# 📝 Exemplos de Uso - API do Mercado Livre

## 🔧 Configuração Inicial

### 1. Obter Credenciais

Execute o script de setup:
```bash
./scripts/setup-mercadolivre.sh
```

Ou configure manualmente no `.env.local`:
```env
MERCADO_LIVRE_ACCESS_TOKEN=APP_USR-123456...
MERCADO_LIVRE_REFRESH_TOKEN=TG-123456...
MERCADO_LIVRE_USER_ID=123456789
```

## 📊 Exemplos de Chamadas à API

### 1. Buscar Métricas Agregadas

**Request:**
```bash
curl -X GET \
  'http://localhost:3001/api/integrations/mercadolivre/metrics?workspaceId=00000000-0000-0000-0000-000000000010&days=30' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

**Response:**
```json
{
  "totalSales": 47,
  "totalRevenue": 15420.50,
  "totalVisits": 1204,
  "conversionRate": 3.9,
  "responseRate": 92.3,
  "reputation": "gold",
  "lastSync": "2025-12-04T17:30:00.000Z",
  "sellerId": "123456789",
  "salesTimeSeries": [
    {
      "date": "2025-11-04",
      "sales": 2,
      "revenue": 680.00,
      "visits": 45
    },
    {
      "date": "2025-11-05",
      "sales": 3,
      "revenue": 920.50,
      "visits": 52
    }
  ],
  "alerts": []
}
```

### 2. Listar Produtos

**Request:**
```bash
curl -X GET \
  'http://localhost:3001/api/integrations/mercadolivre/products?workspaceId=00000000-0000-0000-0000-000000000010' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

**Response:**
```json
{
  "items": [
    {
      "id": "MLB123456789",
      "title": "Tênis Nike Air Max 2024",
      "price": 499.90,
      "thumbnail": "https://http2.mlstatic.com/...",
      "sales": 12,
      "visits": 345,
      "conversionRate": 3.48,
      "revenue": 5998.80,
      "status": "active",
      "category": "MLB1276",
      "stock": 23
    },
    {
      "id": "MLB987654321",
      "title": "Camiseta Importada Premium",
      "price": 89.90,
      "thumbnail": "https://http2.mlstatic.com/...",
      "sales": 35,
      "visits": 892,
      "conversionRate": 3.92,
      "revenue": 3146.50,
      "status": "active",
      "category": "MLB1430",
      "stock": 156
    }
  ],
  "totalCount": 47,
  "activeCount": 42
}
```

### 3. Buscar Perguntas

**Request:**
```bash
curl -X GET \
  'http://localhost:3001/api/integrations/mercadolivre/questions?workspaceId=00000000-0000-0000-0000-000000000010&days=7' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN'
```

**Response:**
```json
{
  "items": [
    {
      "id": "12345678901",
      "text": "Você tem estoque da cor azul no tamanho 42?",
      "productId": "MLB123456789",
      "productTitle": "Tênis Nike Air Max 2024",
      "date": "04/12/2025",
      "answered": false
    },
    {
      "id": "12345678902",
      "text": "Faz entrega em quanto tempo?",
      "productId": "MLB987654321",
      "productTitle": "Camiseta Importada Premium",
      "date": "03/12/2025",
      "answered": true,
      "answer": "Olá! Entregamos em até 3 dias úteis para sua região."
    }
  ],
  "total": 15,
  "unanswered": 3
}
```

### 4. Responder uma Pergunta

**Request:**
```bash
curl -X POST \
  'http://localhost:3001/api/integrations/mercadolivre/questions/12345678901/answer' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "answer": "Olá! Sim, temos estoque azul no tamanho 42. Pode comprar!",
    "workspaceId": "00000000-0000-0000-0000-000000000010"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "87654321098",
    "question_id": "12345678901",
    "text": "Olá! Sim, temos estoque azul no tamanho 42. Pode comprar!",
    "status": "ACTIVE",
    "date_created": "2025-12-04T17:45:00.000Z"
  }
}
```

### 5. Atualizar Preço de um Produto

**Request:**
```bash
curl -X PUT \
  'http://localhost:3001/api/integrations/mercadolivre/products/MLB123456789/price' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "price": 449.90,
    "workspaceId": "00000000-0000-0000-0000-000000000010"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "MLB123456789",
    "price": 449.90,
    "currency_id": "BRL",
    "status": "active"
  }
}
```

### 6. Pausar um Produto

**Request:**
```bash
curl -X PUT \
  'http://localhost:3001/api/integrations/mercadolivre/products/MLB123456789/status' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "status": "paused",
    "workspaceId": "00000000-0000-0000-0000-000000000010"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "MLB123456789",
    "status": "paused"
  }
}
```

### 7. Sincronizar Dados

**Request:**
```bash
curl -X POST \
  'http://localhost:3001/api/integrations/mercadolivre/sync' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "workspaceId": "00000000-0000-0000-0000-000000000010"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "timestamp": "2025-12-04T17:50:00.000Z"
}
```

## 🔄 Renovar Access Token

Quando o token expirar (6 horas):

**Request:**
```bash
curl -X POST \
  'https://api.mercadolibre.com/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=refresh_token' \
  -d 'client_id=YOUR_APP_ID' \
  -d 'client_secret=YOUR_CLIENT_SECRET' \
  -d 'refresh_token=TG-...'
```

**Response:**
```json
{
  "access_token": "APP_USR-new-token...",
  "token_type": "Bearer",
  "expires_in": 21600,
  "scope": "offline_access read write",
  "user_id": 123456789,
  "refresh_token": "TG-new-refresh..."
}
```

Atualize o `.env.local` com o novo `access_token` e `refresh_token`.

## 🎨 Exemplos de Uso no Frontend

### 1. Buscar Métricas com Hook

```tsx
import { useMercadoLivreMetrics } from '@/hooks/useMercadoLivre';

function Dashboard() {
  const { data: metrics, isLoading } = useMercadoLivreMetrics(workspaceId, 30);

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <h1>Total de Vendas: {metrics.totalSales}</h1>
      <h2>Receita: R$ {metrics.totalRevenue.toFixed(2)}</h2>
      <p>Taxa de Conversão: {metrics.conversionRate}%</p>
    </div>
  );
}
```

### 2. Listar Produtos

```tsx
import { useMercadoLivreProducts } from '@/hooks/useMercadoLivre';

function ProductList() {
  const { data: products } = useMercadoLivreProducts(workspaceId, 'all');

  return (
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Vendas</th>
          <th>Receita</th>
        </tr>
      </thead>
      <tbody>
        {products?.items.map(product => (
          <tr key={product.id}>
            <td>{product.title}</td>
            <td>{product.sales}</td>
            <td>R$ {product.revenue.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 3. Responder Pergunta

```tsx
import { useAnswerMercadoLivreQuestion } from '@/hooks/useMercadoLivre';

function QuestionItem({ question }) {
  const answerMutation = useAnswerMercadoLivreQuestion();

  const handleAnswer = () => {
    answerMutation.mutate({
      questionId: question.id,
      answer: "Sua resposta aqui",
      workspaceId
    });
  };

  return (
    <div>
      <p>{question.text}</p>
      <button onClick={handleAnswer}>Responder</button>
    </div>
  );
}
```

### 4. Atualizar Preço

```tsx
import { useUpdateMercadoLivreProductPrice } from '@/hooks/useMercadoLivre';

function ProductPrice({ product }) {
  const updatePrice = useUpdateMercadoLivreProductPrice();

  const handleUpdate = (newPrice: number) => {
    updatePrice.mutate({
      productId: product.id,
      price: newPrice,
      workspaceId
    });
  };

  return (
    <div>
      <p>Preço atual: R$ {product.price}</p>
      <button onClick={() => handleUpdate(product.price * 0.9)}>
        Aplicar 10% de desconto
      </button>
    </div>
  );
}
```

## 🧪 Testes Integrados

### Teste Completo de Fluxo

```bash
#!/bin/bash

WORKSPACE_ID="00000000-0000-0000-0000-000000000010"
BASE_URL="http://localhost:3001/api/integrations/mercadolivre"

echo "1. Buscando métricas..."
curl -s "$BASE_URL/metrics?workspaceId=$WORKSPACE_ID&days=30" | jq '.totalSales'

echo "2. Listando produtos..."
curl -s "$BASE_URL/products?workspaceId=$WORKSPACE_ID" | jq '.totalCount'

echo "3. Buscando perguntas..."
curl -s "$BASE_URL/questions?workspaceId=$WORKSPACE_ID&days=7" | jq '.unanswered'

echo "4. Sincronizando dados..."
curl -s -X POST "$BASE_URL/sync" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\"}" | jq '.success'

echo "✅ Testes concluídos!"
```

## 🎯 Casos de Uso Comuns

### 1. Monitor de Vendas em Tempo Real
```typescript
// Atualizar a cada 5 minutos
useEffect(() => {
  const interval = setInterval(() => {
    refetchMetrics();
  }, 5 * 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 2. Alertas de Perguntas Não Respondidas
```typescript
const { data: questions } = useMercadoLivreQuestions(workspaceId, 1);

useEffect(() => {
  if (questions && questions.unanswered > 0) {
    toast.warning(`Você tem ${questions.unanswered} perguntas não respondidas`);
  }
}, [questions]);
```

### 3. Dashboard de Performance
```typescript
const metrics = useMercadoLivreMetrics(workspaceId, 30);

const performance = {
  conversionRate: metrics.data?.conversionRate,
  avgTicket: metrics.data?.totalRevenue / metrics.data?.totalSales,
  responseRate: metrics.data?.responseRate
};
```

## 📚 Referências

- [API do Mercado Livre](https://developers.mercadolivre.com.br/)
- [OAuth 2.0 Guide](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [Documentação Completa](.gemini/mercado-livre-integration.md)
- [Quick Start](MERCADO_LIVRE_README.md)

---

**Última atualização**: Dezembro 2025
