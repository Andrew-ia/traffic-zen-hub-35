# 🔑 GUIA: SOLICITAR GOOGLE ADS BASIC ACCESS

**Data:** 02/11/2025
**Objetivo:** Desbloquear o Developer Token do Google Ads para sincronização em produção

---

## ❓ POR QUE VOCÊ PRECISA DISSO?

Atualmente, seu Developer Token do Google Ads está em **"Test Mode"**:
- ✅ Funciona em ambiente de desenvolvimento
- ❌ **BLOQUEIA** acesso à API em produção
- ❌ Limita a 15.000 operações por dia (muito baixo)

Com **Basic Access**, você terá:
- ✅ Acesso total à API em produção
- ✅ Limite de 15.000.000 operações por dia
- ✅ Sincronização funcionando para todos os clientes

---

## 📋 PRÉ-REQUISITOS

Antes de solicitar, certifique-se que:

1. **Conta Google Ads ativa** (sua conta: `1988032294`)
2. **API habilitada** no Google Cloud Project
3. **OAuth configurado** (✅ JÁ FEITO)
4. **Script de sincronização funcionando em test mode** (✅ JÁ FEITO)

---

## 🚀 PASSO A PASSO

### PASSO 1: Acessar API Center

1. Vá em: https://ads.google.com/aw/apicenter
2. Faça login com a conta Google Ads
3. Você verá um painel com:
   - Developer Token (atual: `tTAry7OSlovGRNQB7ufRgw`)
   - Access Level: **Test** (queremos mudar para **Basic**)

### PASSO 2: Clicar em "Request Basic Access"

1. No API Center, localize o botão **"Request Basic Access"** ou **"Apply for Basic Access"**
2. Clique para iniciar o formulário

### PASSO 3: Preencher Formulário

O Google vai perguntar:

#### 1. **Company Information**
- **Company Name:** [SEU NOME OU NOME DA EMPRESA]
- **Website:** [SEU WEBSITE ou do cliente]
- **Contact Email:** [SEU EMAIL PROFISSIONAL]

#### 2. **Use Case** (Caso de Uso)
**Template de resposta:**

```
We are building a marketing analytics platform (Traffic Zen Hub) that consolidates
data from multiple advertising platforms (Meta Ads, Google Ads, GA4) into a unified
dashboard for our clients.

Our platform helps advertisers:
- Monitor campaign performance across platforms
- Analyze ROI and ROAS in real-time
- Optimize ad spend based on data-driven insights

We need Basic Access to sync campaign metrics, ad groups, keywords, and conversion
data from Google Ads API to our Supabase database, enabling comprehensive
multi-channel marketing analytics.

API Usage:
- Daily synchronization of campaign metrics (impressions, clicks, conversions)
- Sync frequency: Every 4-6 hours
- Data storage: Supabase PostgreSQL (secure, encrypted)
- Compliance: We follow Google Ads API Terms of Service and data protection policies
```

#### 3. **Estimated API call volume**
**Resposta:** "10,000 - 100,000 requests per day"

#### 4. **Which API endpoints will you use?**
**Resposta:**
```
- GoogleAdsService.Search (campaign metrics)
- GoogleAdsService.SearchStream (ad groups, keywords)
- CustomerService.ListAccessibleCustomers
- CampaignService (campaign data)
- AdGroupService (ad group data)
- KeywordView (keyword performance)
```

#### 5. **Will you be using this for a third-party application?**
**Resposta:** Yes

**Explique:**
```
Our application (Traffic Zen Hub) serves multiple clients/advertisers who connect
their Google Ads accounts via OAuth 2.0. Each client authorizes our app to read
their campaign data for analytics purposes only. We do NOT modify campaigns or
create ads via API.
```

#### 6. **Do you have a Terms of Service and Privacy Policy?**
**Resposta:**
- ☑️ Yes (recomendado)
- **Links:** [Seu site]/terms e [Seu site]/privacy

*(Se não tiver ainda, você pode criar páginas simples)*

### PASSO 4: Submeter e Aguardar

1. Revise todas as respostas
2. Clique em **"Submit"**
3. Você receberá um email de confirmação
4. **Tempo de aprovação:** 1-3 dias úteis (geralmente 24h)

---

## 📧 EMAIL DE CONFIRMAÇÃO

Você receberá um email do Google similar a:

```
Subject: Your Google Ads API access request

Dear Developer,

Thank you for applying for Basic Access to the Google Ads API.

Your application is under review. We'll notify you once it's processed.

Application ID: [NÚMERO]
Developer Token: tTAry7OSlovGRNQB7ufRgw
```

---

## ✅ APÓS APROVAÇÃO

Quando aprovado, você receberá:

```
Subject: Your Google Ads API Basic Access has been granted

Dear Developer,

Congratulations! Your application for Basic Access has been approved.

You can now use your Developer Token in production.
```

**O que fazer:**

1. ✅ **Nenhuma mudança de código necessária** - o token é o mesmo
2. ✅ Executar `node scripts/google-ads/sync-google-ads.js` em produção
3. ✅ Configurar cron job para sync automático

---

## ⚠️ SE FOR REJEITADO

**Motivos comuns de rejeição:**

1. **Use case pouco claro** - Seja mais específico sobre o propósito
2. **Sem Terms of Service** - Crie páginas básicas
3. **Empresa não verificada** - Adicione mais informações da empresa
4. **Website suspeito** - Tenha um site profissional

**Como corrigir:**

1. Leia o email de rejeição cuidadosamente
2. Corrija os pontos mencionados
3. **Re-aplique** após 24 horas
4. Se rejeitado 2x, entre em contato com o suporte do Google Ads API

---

## 🔒 TERMOS DE SERVIÇO BÁSICOS (Se você não tiver)

Se você não tem Terms of Service e Privacy Policy, crie páginas simples:

### Terms of Service (Mínimo)

```markdown
# Terms of Service - Traffic Zen Hub

Last Updated: [DATA]

By using Traffic Zen Hub, you agree to:

1. **Authorization**: You authorize us to access your Google Ads data via OAuth 2.0
2. **Data Usage**: We use your data solely for analytics and reporting purposes
3. **No Modifications**: We do NOT create, modify, or delete ads/campaigns
4. **Data Security**: Your data is encrypted and stored securely in Supabase
5. **Revocation**: You can revoke access anytime via Google Account settings

For questions: [SEU EMAIL]
```

### Privacy Policy (Mínimo)

```markdown
# Privacy Policy - Traffic Zen Hub

Last Updated: [DATA]

## Data We Collect
- Google Ads campaign metrics (impressions, clicks, conversions)
- Ad groups, keywords, and performance data

## How We Use It
- Display analytics dashboards
- Calculate ROI, ROAS, and performance insights
- Provide marketing recommendations

## Data Storage
- Stored in Supabase (PostgreSQL)
- Encrypted at rest and in transit
- Retained for 2 years or until you delete your account

## Third-Party Sharing
- We do NOT sell or share your data
- Only visible to you and authorized team members

## Google Ads API Compliance
- We comply with Google Ads API Terms of Service
- Data handling follows Google's Limited Use requirements

Contact: [SEU EMAIL]
```

Hospede essas páginas em `yoursite.com/terms` e `yoursite.com/privacy`.

---

## 📞 SUPORTE

**Se tiver problemas:**

1. **Forum do Google Ads API:**
   https://groups.google.com/g/adwords-api

2. **Documentação Oficial:**
   https://developers.google.com/google-ads/api/docs/get-started

3. **Stack Overflow:**
   Tag: `google-ads-api`

---

## ✅ CHECKLIST FINAL

Antes de submeter a aplicação:

- [ ] Formulário preenchido completamente
- [ ] Use case claro e detalhado
- [ ] Website profissional funcionando
- [ ] Terms of Service publicado
- [ ] Privacy Policy publicado
- [ ] Email de contato profissional
- [ ] Script de sync testado em test mode
- [ ] Todos os campos obrigatórios preenchidos

---

## 🎯 PRÓXIMOS PASSOS (Após Aprovação)

1. **Testar em produção:**
   ```bash
   node scripts/google-ads/sync-google-ads.js
   ```

2. **Configurar Edge Function:**
   - Deploy da Edge Function `google-ads-sync`
   - Configurar cron job (a cada 4 horas)

3. **Monitorar limites:**
   - Basic Access = 15M operações/dia
   - Monitorar uso no API Center

4. **Documentar:**
   - Atualizar README com instruções
   - Treinar time

---

**BOA SORTE! 🚀**

A aprovação geralmente leva 24-48 horas. Enquanto isso, você pode continuar testando em test mode.

---

**Criado em:** 02/11/2025
**Versão:** 1.0
**Contato:** claude@anthropic.com (documentação)
