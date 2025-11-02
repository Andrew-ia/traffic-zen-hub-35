# PLANO DE IMPLEMENTAÇÃO - GOOGLE ADS + GA4

**Status:** Pronto para começar
**Prioridade:** Alta (você já usa Google Ads e tem GA4)

---

## 🎯 FASE 1: GOOGLE ADS INTEGRATION (2-3 semanas)

### Por que começar com Google Ads?
1. ✅ Você já está gastando dinheiro lá
2. ✅ API é simples (não depende do site)
3. ✅ Comparativo Meta vs Google é crítico para alocar budget
4. ✅ Google Ads tem dados históricos (pode buscar 90 dias atrás)

---

## 📝 PASSO A PASSO - GOOGLE ADS

### Passo 1: Configurar Google Cloud (30 min)

**O que você precisa fazer:**

1. **Criar projeto no Google Cloud Console**
   - Acesse: https://console.cloud.google.com
   - Clique em "Novo Projeto"
   - Nome: "TrafficPro Dashboard" (ou o nome que quiser)
   - Anote o Project ID

2. **Habilitar Google Ads API**
   - No console: APIs & Services > Library
   - Buscar "Google Ads API"
   - Clicar em "Enable"

3. **Configurar OAuth 2.0**
   - Ir em: APIs & Services > Credentials
   - Criar "OAuth 2.0 Client ID"
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8080/api/integrations/google-ads/callback`
   - Copiar Client ID e Client Secret

4. **Obter Developer Token do Google Ads**
   - Acesse sua conta Google Ads: https://ads.google.com
   - Ferramentas > Configuração > Detalhes da API
   - Anotar o Developer Token (pode estar em "test mode" - tudo bem)

**Credenciais necessárias:**
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxx
GOOGLE_ADS_CUSTOMER_ID=123-456-7890 (sem os traços)
```

---

### Passo 2: Implementar OAuth Flow (3-4 horas de dev)

**Arquivos a criar:**

#### `server/api/integrations/google-ads/auth.ts`
```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:8080/api/integrations/google-ads/callback'
);

// Gerar URL de autorização
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/adwords'],
    prompt: 'consent'
  });
}

// Trocar code por tokens
export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}
```

**Fluxo:**
1. Usuário clica "Conectar Google Ads" no dashboard
2. Redirecionado para Google (autorizar)
3. Google retorna para `/callback` com code
4. Backend troca code por access_token + refresh_token
5. Salvar tokens criptografados no banco (`integration_credentials`)

---

### Passo 3: Sincronizar Campanhas (6-8 horas de dev)

**Script:** `scripts/google-ads/sync-campaigns.js`

#### O que buscar da API:

**1. Campanhas:**
```javascript
// GAQL (Google Ads Query Language)
const query = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.start_date,
    campaign.end_date,
    campaign_budget.amount_micros,
    campaign.target_cpa.target_cpa_micros
  FROM campaign
  WHERE campaign.status != 'REMOVED'
  ORDER BY campaign.name
`;
```

**2. Grupos de Anúncios:**
```javascript
const query = `
  SELECT
    ad_group.id,
    ad_group.name,
    ad_group.status,
    ad_group.campaign,
    ad_group.cpc_bid_micros
  FROM ad_group
  WHERE ad_group.status != 'REMOVED'
`;
```

**3. Anúncios:**
```javascript
const query = `
  SELECT
    ad_group_ad.ad.id,
    ad_group_ad.ad.name,
    ad_group_ad.status,
    ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.ad.responsive_search_ad.descriptions,
    ad_group_ad.ad.final_urls
  FROM ad_group_ad
  WHERE ad_group_ad.status != 'REMOVED'
`;
```

**Salvar em:**
- `campaigns` (com `external_id` = campaign.id Google)
- `ad_sets` (equivalente a ad_group)
- `ads` (anúncios)

---

### Passo 4: Sincronizar Métricas (6-8 horas de dev)

**Script:** `scripts/google-ads/sync-metrics.js`

#### Query de Métricas:
```javascript
const query = `
  SELECT
    campaign.id,
    campaign.name,
    segments.date,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr,
    metrics.average_cpc
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY segments.date DESC
`;
```

**Importante:**
- `cost_micros` = custo em micros (dividir por 1.000.000)
- `cpc_micros` = CPC em micros
- Converter para BRL (verificar currency da conta)

**Salvar em:**
- `ads_spend_google` (nova tabela) OU
- `performance_metrics` (reutilizar, adicionar campo `platform`)

---

### Passo 5: Dashboard - Comparativo (4-5 horas de dev)

#### Nova página: `/reports/channels`

**Componentes a criar:**

1. **ChannelComparisonTable.tsx**
```tsx
// Tabela comparativa
| Métrica          | Meta Ads    | Google Ads  | Total       |
|------------------|-------------|-------------|-------------|
| Gasto            | R$ 5.000    | R$ 3.000    | R$ 8.000    |
| Impressões       | 500K        | 300K        | 800K        |
| Cliques          | 10K         | 8K          | 18K         |
| CTR              | 2.0%        | 2.67%       | 2.25%       |
| CPC              | R$ 0.50     | R$ 0.38     | R$ 0.44     |
| Conversões       | 250         | 180         | 430         |
| CPA              | R$ 20       | R$ 16.67    | R$ 18.60    |
| ROAS (Ads)       | 3.2         | 2.8         | 3.0         |
```

2. **ChannelPerformanceChart.tsx**
```tsx
// Gráfico de linha comparando gasto ao longo do tempo
- Linha azul: Meta Ads
- Linha vermelha: Google Ads
- Últimos 30 dias
```

3. **BudgetAllocationCard.tsx**
```tsx
// Donut chart mostrando % do budget
- Meta: 62.5% (R$ 5.000)
- Google: 37.5% (R$ 3.000)
```

**Hook:** `useChannelComparison.ts`
```typescript
export function useChannelComparison(dateRange) {
  // Buscar métricas Meta de performance_metrics
  // Buscar métricas Google de ads_spend_google
  // Unificar e retornar
}
```

---

## 🎯 FASE 2: GA4 + GTM (3-4 semanas)

### Por que depois?
- GA4 depende de configuração no site (mais complexo)
- Google Ads já traz valor imediato (dados históricos)
- GTM precisa de testes no checkout (pode dar bug)

---

## 📝 PASSO A PASSO - GA4

### Passo 1: Configurar GA4 Corretamente (1-2 horas)

**No GA4 Web Interface:**

1. **Verificar instalação básica**
   - Admin > Data Streams > Web
   - Verificar se o Measurement ID está correto (G-XXXXXXXXXX)
   - Copiar Measurement ID

2. **Habilitar Enhanced Measurement (auto)**
   - Page views ✅ (automático)
   - Scrolls ✅ (automático)
   - Outbound clicks ✅ (automático)
   - Site search ✅ (automático)
   - Form interactions ✅ (automático)
   - File downloads ✅ (automático)

3. **Configurar Conversões**
   - Admin > Events
   - Marcar como conversão:
     - `purchase` ✅
     - `begin_checkout` ✅
     - `add_to_cart` ✅

---

### Passo 2: Configurar Eventos no GTM (2-3 horas)

**No Google Tag Manager:**

#### Tag 1: GA4 Configuration (base)
- Type: Google Analytics: GA4 Configuration
- Measurement ID: G-XXXXXXXXXX
- Trigger: All Pages

#### Tag 2: Begin Checkout Event
```javascript
// Trigger: Custom Event = checkout_initiated

Tag Configuration:
- Type: Google Analytics: GA4 Event
- Configuration Tag: GA4 Configuration
- Event Name: begin_checkout
- Event Parameters:
  - currency: BRL
  - value: {{cartValue}}
  - items: {{cartItems}}
```

**No código do checkout (onde "Finalizar Compra" é clicado):**
```javascript
// Disparar evento GTM
dataLayer.push({
  event: 'checkout_initiated',
  cartValue: 299.90,
  cartItems: [
    { item_id: 'PROD123', item_name: 'Produto X', price: 299.90 }
  ]
});
```

#### Tag 3: Purchase Event
```javascript
// Trigger: Custom Event = purchase_completed

Tag Configuration:
- Type: Google Analytics: GA4 Event
- Configuration Tag: GA4 Configuration
- Event Name: purchase
- Event Parameters:
  - transaction_id: {{orderId}}
  - currency: BRL
  - value: {{orderTotal}}
  - items: {{orderItems}}
```

**No código da página de confirmação (após pagamento):**
```javascript
// Disparar evento GTM
dataLayer.push({
  event: 'purchase_completed',
  orderId: 'ORD-12345',
  orderTotal: 299.90,
  orderItems: [
    { item_id: 'PROD123', item_name: 'Produto X', price: 299.90, quantity: 1 }
  ]
});
```

---

### Passo 3: Testar Eventos (1 hora)

**No GA4:**
1. Admin > DebugView
2. Abrir o site em outra aba
3. Navegar até o checkout
4. Clicar em "Finalizar Compra"
5. **Verificar:** Evento `begin_checkout` aparece no DebugView
6. Simular compra completa
7. **Verificar:** Evento `purchase` aparece

**Importante:** Eventos podem levar 24-48h para aparecer nos relatórios (DebugView é em tempo real).

---

### Passo 4: Habilitar GA4 Data API no Google Cloud (15 min)

1. Mesmo projeto do Google Ads
2. APIs & Services > Library
3. Buscar "Google Analytics Data API"
4. Enable
5. OAuth já está configurado (reutilizar)

**Novo scope necessário:**
```
https://www.googleapis.com/auth/analytics.readonly
```

---

### Passo 5: Sincronizar Eventos GA4 (8-10 horas de dev)

**Script:** `scripts/ga4/sync-events.js`

#### Buscar eventos do GA4:
```javascript
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const client = new BetaAnalyticsDataClient({ credentials });

const [response] = await client.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
  dimensions: [
    { name: 'eventName' },
    { name: 'date' },
    { name: 'sessionSource' },
    { name: 'sessionMedium' },
    { name: 'sessionCampaignName' }
  ],
  metrics: [
    { name: 'eventCount' },
    { name: 'totalRevenue' }
  ],
  dimensionFilter: {
    filter: {
      fieldName: 'eventName',
      inListFilter: {
        values: ['page_view', 'begin_checkout', 'purchase']
      }
    }
  }
});
```

**Salvar em:**
- `ga4_events` (tabela já definida na auditoria)

---

### Passo 6: Dashboard - Funil de Conversão (4-5 horas de dev)

#### Nova página: `/reports/funnel`

**Componentes a criar:**

1. **FunnelVisualization.tsx**
```tsx
// Funil visual
┌─────────────────────────┐
│  10.000 Page Views      │ 100%
└─────────────────────────┘
           ↓ 15%
┌─────────────────────────┐
│  1.500 Begin Checkout   │ 15%
└─────────────────────────┘
           ↓ 60%
┌─────────────────────────┐
│  900 Purchases          │ 9%
└─────────────────────────┘
```

2. **ConversionRatesCards.tsx**
```tsx
// 3 cards lado a lado
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Pageview → Chk  │ │ Checkout → Buy  │ │ Pageview → Buy  │
│     15%         │ │     60%         │ │     9%          │
│  ↑ 2.3% vs 30d  │ │  ↓ 5.1% vs 30d  │ │  ↑ 0.8% vs 30d  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

3. **AbandonmentAnalysis.tsx**
```tsx
// Tabela de abandono
| Etapa           | Usuários | Taxa Abandono |
|-----------------|----------|---------------|
| Visualizou      | 10.000   | -             |
| Iniciou Checkout| 1.500    | 85%           | ⚠️ Muito alto
| Finalizou       | 900      | 40%           | ⚠️ Otimizar
```

---

## 📊 RESULTADO FINAL (APÓS 5-7 SEMANAS)

Você terá um dashboard completo com:

### ✅ Comparativo de Canais
- Meta Ads vs Google Ads lado a lado
- Decisão baseada em dados: onde investir mais?
- ROI por canal

### ✅ Funil de Conversão
- Pageview → Checkout → Compra
- Identificar gargalos (onde o cliente desiste)
- Taxa de abandono de carrinho

### ✅ Métricas Unificadas
- Tudo em um lugar (Meta + Google + GA4)
- Não precisa abrir 3 plataformas diferentes
- Relatórios automáticos

---

## 💰 ESTIMATIVAS

| Fase | Tempo Dev | Complexidade |
|------|-----------|--------------|
| Google Ads OAuth | 4h | Média |
| Google Ads Sync Campaigns | 8h | Média |
| Google Ads Sync Metrics | 8h | Média |
| Dashboard Comparativo | 5h | Baixa |
| **Total Google Ads** | **25h (3-4 dias)** | |
| | | |
| GA4 Configuração | 2h | Baixa |
| GTM Eventos | 3h | Média |
| GA4 Data API Sync | 10h | Alta |
| Dashboard Funil | 5h | Baixa |
| **Total GA4** | **20h (2-3 dias)** | |
| | | |
| **TOTAL GERAL** | **45h (5-7 dias úteis)** | |

---

## 🚦 ORDEM DE EXECUÇÃO RECOMENDADA

### Semana 1-2: Google Ads
1. ✅ Configurar Google Cloud (você faz)
2. ✅ Implementar OAuth
3. ✅ Sincronizar campanhas
4. ✅ Sincronizar métricas
5. ✅ Dashboard comparativo

**Critério de aceite:**
- [ ] Ver campanhas Google Ads no dashboard
- [ ] Ver métricas Google Ads (últimos 30 dias)
- [ ] Tabela comparativa Meta vs Google funciona

---

### Semana 3-4: GA4 + GTM
1. ✅ Configurar GA4 corretamente (você faz)
2. ✅ Implementar eventos GTM (você + dev)
3. ✅ Testar eventos em DebugView
4. ✅ Sincronizar eventos GA4
5. ✅ Dashboard de funil

**Critério de aceite:**
- [ ] Eventos `begin_checkout` e `purchase` aparecendo no GA4
- [ ] Dashboard mostra funil de conversão
- [ ] Taxa de abandono calculada

---

## 📞 PRÓXIMOS PASSOS IMEDIATOS

### O que VOCÊ precisa fazer (não-dev):

1. **Google Cloud** (30 min)
   - Criar projeto
   - Habilitar Google Ads API
   - Habilitar GA4 Data API
   - Criar OAuth 2.0
   - Me enviar: Client ID, Client Secret

2. **Google Ads** (5 min)
   - Pegar Developer Token
   - Pegar Customer ID
   - Me enviar

3. **GA4** (15 min)
   - Verificar se eventos enhanced measurement estão on
   - Marcar `purchase` e `begin_checkout` como conversões
   - Me enviar Property ID (G-XXXXXXXXXX)

4. **Checkout do site** (pode ser depois)
   - Identificar onde está o botão "Finalizar Compra"
   - Identificar onde está a página de confirmação (após pagamento)
   - Precisaremos adicionar código `dataLayer.push()` nesses lugares

---

### O que EU (dev) vou fazer:

1. Criar migrations para `ads_spend_google` e `ga4_events`
2. Implementar OAuth Google
3. Criar scripts de sincronização
4. Criar páginas de dashboard
5. Testar tudo

---

## ❓ DÚVIDAS COMUNS

**1. Precisa de cartão de crédito no Google Cloud?**
- Sim, mas é grátis. Google Cloud tem free tier.
- Google Ads API é grátis (unlimited após approval)
- GA4 Data API é grátis (50k requests/dia)

**2. Vai parar de funcionar se não pagar?**
- Não. As APIs são gratuitas.
- Só cobraria se você usar outros serviços (Compute, Storage, etc).

**3. É seguro dar acesso ao Google Ads?**
- Sim. OAuth só dá permissão de **leitura**.
- Não conseguimos criar/pausar/editar campanhas (apenas ver dados).

**4. E se o GA4 não estiver funcionando?**
- Podemos começar só com Google Ads (já traz muito valor).
- Configuramos GA4 depois.

---

## 🎯 DECISÃO

Me confirme:
1. ✅ Você quer integrar Google Ads? (comparativo Meta vs Google)
2. ✅ Você quer configurar GA4? (funil de conversão)
3. ⏰ Quando podemos começar? (preciso das credenciais Google Cloud)

Se confirmar, eu crio uma **branch nova** e começo pela integração do Google Ads! 🚀
