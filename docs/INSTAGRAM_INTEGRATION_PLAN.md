# Plano de Integração Instagram - Análise e Correção

## 1. ANÁLISE DO ERRO ATUAL

### 1.1 Erros Identificados nos Logs

**Erro Principal (Mais Recente):**
```
❌ Error: Instagram API error 400: {
  "error": {
    "message": "(#10) Application does not have permission for this action",
    "type": "OAuthException",
    "code": 10,
    "fbtrace_id": "A-5xxABUVjOfho3E7B5PquZ"
  }
}
```

**Erros Anteriores:**
1. **Erro de Métricas Inválidas:**
   - `(#100) The value must be a valid insights metric`
   - Causa: Métricas solicitadas não são válidas para o tipo de conta

2. **Erro de Campo Inexistente:**
   - `(#100) Tried accessing nonexisting field (media) on node type (Page)`
   - Causa: Foi usado Page ID (211443329551349) ao invés de Instagram Business Account ID

3. **Conta Não Encontrada:**
   - `Instagram platform account not found`
   - Causa: Registro faltando na tabela `platform_accounts`

### 1.2 Parâmetros da Requisição

**Credenciais Atuais:**
- Instagram Business Account ID: `17841408314288323` ✅ (corrigido)
- Access Token: `EAAVH4PZBJl9IBP...` (mesmo do Meta Ads)
- Workspace ID: `00000000-0000-0000-0000-000000000010`

**Endpoint Acessado:**
- `https://graph.facebook.com/v21.0/{ig-user-id}/insights`
- `https://graph.facebook.com/v21.0/{ig-user-id}/media`

### 1.3 Root Cause Analysis

**PROBLEMA PRINCIPAL:** O aplicativo Meta não tem permissões suficientes para acessar Instagram Insights API.

**Permissões Necessárias:**
- ✅ `instagram_basic` - Informações básicas da conta
- ❌ `instagram_manage_insights` - **FALTANDO** - Acesso a métricas
- ❌ `pages_read_engagement` - **FALTANDO** - Engajamento da página conectada
- ❌ `pages_show_list` - Listar páginas do usuário

---

## 2. VERIFICAÇÃO DOS REQUISITOS DE INTEGRAÇÃO

### 2.1 Status das Credenciais

| Item | Status | Observação |
|------|--------|------------|
| Instagram Business Account ID | ✅ Válido | 17841408314288323 |
| Access Token | ⚠️ Válido mas com permissões limitadas | Precisa renovar com mais scopes |
| App ID | ✅ Válido | 1486406569007058 |
| App Secret | ✅ Válido | Armazenado |

### 2.2 Permissões do App Meta (CRÍTICO)

**Permissões Atuais (Inferidas):**
- `ads_management` - Para Meta Ads
- `ads_read` - Leitura de dados de anúncios
- Provavelmente NÃO tem: `instagram_manage_insights`

**Ação Necessária:**
1. Acessar [Meta App Dashboard](https://developers.facebook.com/apps/1486406569007058/dashboard/)
2. Ir em "App Review" > "Permissions and Features"
3. Solicitar as seguintes permissões:
   - `instagram_manage_insights` (ESSENCIAL)
   - `instagram_basic`
   - `pages_read_engagement`
   - `pages_show_list`

4. Depois de aprovado, gerar novo Access Token com os scopes corretos:
```bash
# URL para gerar novo token (após aprovação das permissões)
https://developers.facebook.com/tools/explorer/

# Scopes necessários:
instagram_basic,instagram_manage_insights,pages_read_engagement,pages_show_list,ads_management,ads_read
```

### 2.3 Endpoints da API

**Endpoints Testados:**
- ✅ `/me` - Funcionando
- ✅ `/{page-id}?fields=instagram_business_account` - Funcionando
- ❌ `/{ig-user-id}/insights` - **FALHA por falta de permissão**
- ❌ `/{ig-user-id}/media` - **FALHA por falta de permissão**

---

## 3. IMPLEMENTAÇÃO DE SOLUÇÕES

### 3.1 Solução Imediata - Validação de Permissões

**Arquivo:** `scripts/instagram/sync-insights.js`

```javascript
// Adicionar no início do script
async function validatePermissions(igUserId, accessToken) {
  console.log('🔍 Validando permissões do token...');

  try {
    // Tentar buscar uma métrica simples
    const testUrl = buildUrl(`${igUserId}/insights`, {
      metric: 'impressions',
      period: 'day',
      since: Math.floor(Date.now() / 1000) - 86400, // 1 dia atrás
      until: Math.floor(Date.now() / 1000),
      access_token: accessToken,
    });

    await fetchJson(testUrl);
    console.log('✅ Permissões OK');
    return true;
  } catch (error) {
    if (error.message.includes('does not have permission')) {
      console.error('❌ ERRO DE PERMISSÃO: O aplicativo não tem permissão para acessar Instagram Insights.');
      console.error('📋 Permissões necessárias:');
      console.error('   - instagram_manage_insights');
      console.error('   - instagram_basic');
      console.error('   - pages_read_engagement');
      console.error('');
      console.error('🔧 Passos para corrigir:');
      console.error('   1. Acesse https://developers.facebook.com/apps/1486406569007058/');
      console.error('   2. Vá em "App Review" > "Permissions and Features"');
      console.error('   3. Solicite as permissões acima');
      console.error('   4. Após aprovação, gere novo Access Token com os scopes corretos');
      console.error('');
      throw new Error('Missing required permissions for Instagram Insights API');
    }
    throw error;
  }
}

// Adicionar no início da função main()
await validatePermissions(igUserId, accessToken);
```

### 3.2 Tratamento de Erros Robusto

```javascript
// Implementar retry com backoff exponencial
async function fetchWithRetry(url, maxRetries = 3, initialDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchJson(url);
    } catch (error) {
      // Não fazer retry em erros de permissão (400, 403)
      if (error.message.includes('400') || error.message.includes('403')) {
        throw error;
      }

      // Não fazer retry em erros de rate limit (reduzir frequência)
      if (error.message.includes('rate limit')) {
        const waitTime = Math.pow(2, attempt) * initialDelay;
        console.log(`⏳ Rate limit atingido. Aguardando ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Último attempt - throw error
      if (attempt === maxRetries) {
        throw error;
      }

      // Retry com backoff exponencial
      const delay = Math.pow(2, attempt) * initialDelay;
      console.log(`⚠️  Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3.3 Logs Detalhados

```javascript
// Sistema de logging estruturado
class SyncLogger {
  constructor(jobId) {
    this.jobId = jobId;
    this.startTime = Date.now();
    this.metrics = {
      apiCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      recordsInserted: 0,
    };
  }

  logApiCall(endpoint, success = true) {
    this.metrics.apiCalls++;
    if (success) {
      this.metrics.successfulCalls++;
    } else {
      this.metrics.failedCalls++;
    }
    console.log(`📊 API Call: ${endpoint} - ${success ? '✅' : '❌'}`);
  }

  logInsert(count) {
    this.metrics.recordsInserted += count;
    console.log(`💾 Inserted ${count} records`);
  }

  summary() {
    const duration = Date.now() - this.startTime;
    console.log('\\n📈 Sync Summary:');
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   API Calls: ${this.metrics.apiCalls}`);
    console.log(`   Successful: ${this.metrics.successfulCalls}`);
    console.log(`   Failed: ${this.metrics.failedCalls}`);
    console.log(`   Records Inserted: ${this.metrics.recordsInserted}`);
  }
}
```

### 3.4 Métricas Corretas para Instagram

**Métricas Disponíveis (verificar documentação v21.0):**

**Account-level metrics:**
- `impressions` - Impressões totais
- `reach` - Alcance único
- `profile_views` - Visualizações do perfil

**Media-level metrics:**
- `engagement` - Engajamento total (likes + comments + saves + shares)
- `impressions` - Impressões da mídia
- `reach` - Alcance da mídia
- `saved` - Salvamentos

**⚠️ IMPORTANTE:** As métricas variam dependendo do tipo de conta e API version. Sempre consultar:
https://developers.facebook.com/docs/instagram-api/reference/ig-user/insights

---

## 4. TESTES DE VALIDAÇÃO

### 4.1 Checklist de Testes

- [ ] **Teste 1:** Validar permissões do token
  - Executar: `curl "https://graph.facebook.com/v21.0/me/permissions?access_token={TOKEN}"`
  - Verificar: `instagram_manage_insights` presente e com status `granted`

- [ ] **Teste 2:** Testar endpoint de insights básico
  - Executar: `curl "https://graph.facebook.com/v21.0/{IG_USER_ID}/insights?metric=impressions&period=day&access_token={TOKEN}"`
  - Esperar: Dados de impressões dos últimos dias

- [ ] **Teste 3:** Testar sincronização de 1 dia
  - Executar: `IG_USER_ID=17841408314288323 SYNC_DAYS=1 node scripts/instagram/sync-insights.js`
  - Verificar: Dados inseridos na tabela `performance_metrics`

- [ ] **Teste 4:** Testar sincronização de 7 dias
  - Executar: `IG_USER_ID=17841408314288323 SYNC_DAYS=7 node scripts/instagram/sync-insights.js`
  - Verificar: 7 registros diários inseridos

- [ ] **Teste 5:** Testar via API endpoint
  - Executar: `POST /api/integrations/simple-sync` com `{ "platformKey": "instagram", "days": 7 }`
  - Verificar: Job completa com sucesso

### 4.2 Cenários de Teste

| Cenário | Período | Volume Esperado | Status |
|---------|---------|-----------------|--------|
| Teste básico | 1 dia | ~1-5 registros | ⏳ Pendente |
| Teste semanal | 7 dias | ~7-35 registros | ⏳ Pendente |
| Teste mensal | 30 dias | ~30-150 registros | ⏳ Pendente |
| Teste com erro | Forçar rate limit | Retry automático | ⏳ Pendente |

---

## 5. DOCUMENTAÇÃO

### 5.1 Manual de Integração Atualizado

**Requisitos Pré-Integração:**
1. Instagram Business Account conectado a uma Facebook Page
2. Meta App com permissões aprovadas:
   - `instagram_manage_insights`
   - `instagram_basic`
   - `pages_read_engagement`
3. Access Token de longa duração (60 dias)

**Passo a Passo:**
1. Obter Instagram Business Account ID via Graph API Explorer
2. Configurar credenciais no `.env.local`
3. Executar `node scripts/setup-instagram-credentials.js`
4. Testar sincronização: `POST /api/integrations/simple-sync`

### 5.2 Guia de Troubleshooting

**Erro: "Application does not have permission"**
- **Causa:** Falta permissão `instagram_manage_insights`
- **Solução:** Solicitar permissão no App Review do Meta Developer
- **Tempo:** 1-3 dias úteis para aprovação

**Erro: "Invalid insights metric"**
- **Causa:** Métrica não disponível para o tipo de conta ou API version
- **Solução:** Consultar documentação da API v21.0 e ajustar métricas solicitadas

**Erro: "Rate limit exceeded"**
- **Causa:** Muitas requisições em pouco tempo
- **Solução:** Sistema implementa retry automático com backoff exponencial

---

## 6. MONITORAMENTO CONTÍNUO

### 6.1 Alertas Implementados

```sql
-- Query para detectar falhas na sincronização
SELECT
  id,
  platform_key,
  status,
  error_message,
  created_at,
  completed_at
FROM sync_jobs
WHERE platform_key = 'instagram'
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 6.2 Métricas de Desempenho

**KPIs:**
- Taxa de sucesso de sincronização: > 95%
- Tempo médio de sincronização: < 30 segundos
- Dados de latência: < 48 horas (limitação da API do Instagram)

**Dashboard de Monitoramento:**
- Gráfico de sync jobs por status (success/failed/processing)
- Timeline de última sincronização por conta
- Alertas de rate limiting

### 6.3 Revisões Periódicas

**Semanal:**
- Verificar taxa de erro das sincronizações
- Revisar logs de falhas
- Validar qualidade dos dados importados

**Mensal:**
- Atualizar Access Token (se necessário)
- Revisar permissões da API
- Verificar mudanças na documentação da API do Instagram

**Trimestral:**
- Avaliar necessidade de novas métricas
- Otimizar queries de banco de dados
- Revisar estratégia de rate limiting

---

## 7. PRÓXIMOS PASSOS IMEDIATOS

### Prioridade ALTA (Bloqueia funcionalidade)
1. ✅ **Corrigir Instagram Business Account ID** - CONCLUÍDO
   - Mudou de `211443329551349` (Page ID) para `17841408314288323` (IG Account ID)

2. ⏳ **Solicitar Permissões no Meta App** - PENDENTE
   - Acessar https://developers.facebook.com/apps/1486406569007058/
   - App Review > Request Advanced Access
   - Solicitar: `instagram_manage_insights`, `instagram_basic`, `pages_read_engagement`
   - **Tempo estimado:** 1-3 dias úteis para aprovação

3. ⏳ **Gerar Novo Access Token** - PENDENTE (após aprovação)
   - Usar Graph API Explorer
   - Incluir todos os scopes necessários
   - Substituir em `.env.local`

### Prioridade MÉDIA (Melhora experiência)
4. 📝 **Implementar Validação de Permissões** - A FAZER
   - Adicionar check no início do sync
   - Mostrar mensagem clara sobre permissões faltantes

5. 📝 **Melhorar Tratamento de Erros** - A FAZER
   - Retry com backoff exponencial
   - Logging estruturado
   - Mensagens de erro mais informativas

### Prioridade BAIXA (Nice to have)
6. 📝 **Dashboard de Monitoramento** - FUTURO
   - Visualizar status das sincronizações
   - Gráficos de métricas do Instagram
   - Alertas automáticos

---

## 8. CONCLUSÃO

**Status Atual:** 🟡 Parcialmente Funcional

A infraestrutura técnica está completa e funcionando. O bloqueador atual é **permissões da API do Meta**, que requer aprovação manual do Facebook.

**Ação Imediata Necessária:** Solicitar as permissões `instagram_manage_insights` no Meta App Dashboard.

**Tempo Estimado para Resolução:** 1-3 dias úteis (tempo de aprovação do Meta).

**Após Aprovação:** A integração funcionará 100% conforme planejado.
