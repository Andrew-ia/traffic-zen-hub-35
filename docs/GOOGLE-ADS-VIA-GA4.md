# 📊 Integrando Google Ads via GTM + GA4

Este guia explica como **remover a dependência da API do Google Ads** e usar **Google Tag Manager (GTM) + Google Analytics 4 (GA4)** para capturar dados de conversão.

## 🎯 Por que usar GTM + GA4?

### ❌ Problemas com a API do Google Ads:
- Autenticação complexa (OAuth, contas de teste, etc.)
- Permissões complicadas
- Limite de requisições
- Difícil de configurar

### ✅ Vantagens do GTM + GA4:
- **Mais simples**: Uma única integração
- **Mais flexível**: Capture qualquer evento
- **Mais rápido**: Dados em tempo real
- **Sem limites**: API do GA4 é muito mais generosa
- **Já está configurado** neste projeto!

---

## 📋 Como Funciona

```
Google Ads → GTM → GA4 → Seu Sistema (via API GA4)
```

1. **Google Ads** envia conversões para o GTM (via tags de conversão)
2. **GTM** envia eventos para o GA4
3. **Você** puxa dados do GA4 via API (já implementado!)

---

## ⚙️ Configuração no GTM

### 1. Configurar Tag de Conversão do Google Ads

No GTM, crie uma tag:

**Tipo**: Google Ads Conversion Tracking
- **Conversion ID**: `AW-709816156` (já configurado no `.env.local`)
- **Conversion Label**: `jiNYCLfZgPcCENzeu9IC` (label de purchase)
- **Disparador**: Evento de conversão (ex: purchase, submit_form, etc.)

### 2. Enviar Conversões para o GA4

Crie uma tag **Google Analytics: GA4 Event**:

```javascript
// Nome do evento
Event Name: ads_conversion

// Parâmetros do evento
{
  "conversion_id": "AW-709816156",
  "conversion_label": "{{Conversion Label}}",
  "value": "{{Transaction Value}}",
  "currency": "BRL",
  "campaign_id": "{{Google Ads Campaign ID}}",
  "ad_group_id": "{{Google Ads Ad Group ID}}"
}
```

**Disparador**: Mesmo do passo 1 (evento de conversão)

### 3. Criar Eventos Personalizados

Para cada tipo de conversão do Google Ads:

| Conversão | Nome do Evento GA4 | Parâmetros |
|-----------|-------------------|------------|
| Purchase | `ads_purchase` | `value`, `currency`, `campaign_id` |
| Lead | `ads_lead` | `campaign_id`, `ad_group_id` |
| Sign Up | `ads_signup` | `campaign_id` |
| Add to Cart | `ads_add_to_cart` | `value`, `currency` |

---

## 🔧 Usando a API do GA4

### Endpoint Atual

Você já tem endpoints configurados:

```typescript
// Tempo real (últimos 30 minutos)
POST /api/analytics/ga4/realtime
Body: { propertyId: "497704603" }

// Relatório histórico
POST /api/analytics/ga4/report
Body: {
  propertyId: "497704603",
  days: 30
}
```

### Buscar Conversões do Google Ads

Modifique o endpoint `ga4Report` para buscar eventos específicos:

```typescript
const body = {
  dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
  dimensions: [
    { name: 'date' },
    { name: 'eventName' },
    { name: 'campaignName' }, // Campanha do Google Ads
    { name: 'sourceMedium' }
  ],
  metrics: [
    { name: 'eventCount' },
    { name: 'eventValue' }, // Valor da conversão
    { name: 'totalRevenue' }
  ],
  dimensionFilter: {
    filter: {
      fieldName: 'eventName',
      stringFilter: {
        matchType: 'BEGINS_WITH',
        value: 'ads_' // Filtra eventos do Google Ads
      }
    }
  },
  limit: 1000
};
```

### Métricas Disponíveis no GA4

| Métrica GA4 | Descrição |
|-------------|-----------|
| `eventCount` | Número de conversões |
| `eventValue` | Valor total das conversões |
| `totalRevenue` | Receita total |
| `totalUsers` | Usuários únicos |
| `sessions` | Sessões |
| `conversions` | Conversões (eventos marcados como conversão) |

---

## 📊 Exemplo: Buscar Dados do Google Ads

### 1. Criar Hook React

```typescript
// src/hooks/useGoogleAdsFromGA4.ts
import { useQuery } from '@tanstack/react-query';

export function useGoogleAdsFromGA4(days: number = 30) {
  return useQuery({
    queryKey: ['google-ads-ga4', days],
    queryFn: async () => {
      const response = await fetch('/api/analytics/ga4/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: '497704603',
          days,
          dimensions: ['date', 'campaignName', 'sourceMedium'],
          metrics: ['eventCount', 'eventValue', 'totalRevenue'],
          eventFilter: 'ads_' // Prefixo dos eventos do Google Ads
        })
      });

      if (!response.ok) throw new Error('Falha ao buscar dados');

      const { data } = await response.json();
      return data;
    }
  });
}
```

### 2. Usar no Componente

```typescript
// src/pages/GoogleAds.tsx
import { useGoogleAdsFromGA4 } from '@/hooks/useGoogleAdsFromGA4';

export default function GoogleAds() {
  const { data, isLoading } = useGoogleAdsFromGA4(30);

  // Processar dados
  const totalConversions = data?.rows.reduce((sum, row) =>
    sum + row.eventCount, 0) ?? 0;

  const totalRevenue = data?.rows.reduce((sum, row) =>
    sum + row.eventValue, 0) ?? 0;

  return (
    <div>
      <h1>Total de Conversões: {totalConversions}</h1>
      <h2>Receita Total: R$ {totalRevenue.toFixed(2)}</h2>
      {/* Renderizar tabela com dados */}
    </div>
  );
}
```

---

## 🎯 Eventos Recomendados

Configure estes eventos no GTM para capturar dados do Google Ads:

### Evento: ads_conversion (Conversão Genérica)
```javascript
{
  event: 'ads_conversion',
  conversion_id: 'AW-709816156',
  conversion_label: 'xxx',
  value: 100.00,
  currency: 'BRL',
  campaign_id: '12345',
  ad_group_id: '67890'
}
```

### Evento: ads_purchase (Compra)
```javascript
{
  event: 'ads_purchase',
  transaction_id: 'T12345',
  value: 299.90,
  currency: 'BRL',
  items: [
    { item_id: 'SKU123', item_name: 'Produto X', price: 299.90 }
  ]
}
```

### Evento: ads_lead (Lead)
```javascript
{
  event: 'ads_lead',
  campaign_id: '12345',
  form_id: 'contact_form',
  lead_source: 'google_ads'
}
```

---

## 🔍 Verificar se Está Funcionando

### 1. No GTM
- Abra o **Preview Mode**
- Teste as tags e veja se disparam corretamente

### 2. No GA4
- Acesse **Tempo Real** → Veja eventos `ads_*`
- Acesse **Relatórios** → **Eventos** → Filtre por `ads_`

### 3. No Seu Sistema
- Chame a API: `POST /api/analytics/ga4/report`
- Verifique se os dados aparecem

---

## 📦 Variáveis de Ambiente

Já configuradas no `.env.local`:

```bash
# GA4
GA4_PROPERTY_ID=497704603
GOOGLE_APPLICATION_CREDENTIALS=/path/to/ga4-service-account.json

# Google Ads (para tags de conversão)
VITE_AW_CONVERSION_ID=AW-709816156
VITE_AW_LABEL_PURCHASE=jiNYCLfZgPcCENzeu9IC
```

---

## ✅ Próximos Passos

1. ✅ **Remover integração com API do Google Ads** (scripts e edge functions)
2. ✅ **Configurar tags no GTM** (conversões → GA4)
3. ✅ **Usar API do GA4** para puxar dados (já implementado!)
4. ⬜ **Criar dashboard** com dados do GA4
5. ⬜ **Sincronizar periodicamente** (cron job ou webhook)

---

## 📚 Recursos

- [GA4 Data API Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Google Tag Manager - Guia Completo](https://support.google.com/tagmanager)
- [Google Ads Conversion Tracking](https://support.google.com/google-ads/answer/1722022)

---

## 💡 Dica Final

**Não precisa mais da API do Google Ads!** 🎉

Com GTM + GA4, você tem:
- ✅ Dados de conversão do Google Ads
- ✅ Dados de tráfego do site
- ✅ Eventos personalizados
- ✅ Tudo em um só lugar (GA4)
- ✅ API simples e fácil de usar

Basta configurar as tags no GTM e usar a API do GA4 que já está funcionando! 🚀
