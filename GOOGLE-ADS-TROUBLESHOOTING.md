# 🔧 TROUBLESHOOTING - Google Ads API

## ⚠️ PROBLEMA ATUAL

A integração do Google Ads está **quase completa**, mas há um erro ao fazer queries na API:

```
❌ Erro: API Error: 404 - The requested URL /v16/customers/1988032294/googleAds:search was not found
```

## ✅ O QUE JÁ FUNCIONA

1. ✅ **OAuth** está funcionando perfeitamente
   - Refresh Token foi obtido com sucesso
   - Access Token é gerado corretamente

2. ✅ **Credenciais** estão corretas no `.env.local`
   - Customer ID: `1988032294`
   - Developer Token: `dmi75hKtklRuoAq6-8aPqA`
   - Client ID e Secret: Configurados
   - Refresh Token: Configurado

3. ✅ **Banco de dados** está pronto
   - Tabela `ads_spend_google` criada
   - Scripts de sincronização criados

## 🔍 DIAGNÓSTICO

### Possíveis Causas do Erro 404

#### 1. **Developer Token Não Aprovado** (MAIS PROVÁVEL)

O Developer Token do Google Ads tem 3 estados:

- **Pending**: Token criado mas não aprovado (não funciona)
- **Test**: Token em modo de teste (funciona apenas com contas específicas)
- **Production**: Token aprovado para uso geral

**Como verificar:**

1. Acesse: https://ads.google.com/aw/apicenter
2. Faça login com sua conta Google Ads
3. Vá em "API Center"
4. Verifique o status do Developer Token

**Soluções:**

- Se estiver "Pending": Aguardar aprovação do Google (pode levar alguns dias)
- Se estiver "Test": Funciona apenas com sua conta. Você pode usar, mas precisa solicitar produção para outras contas
- Se não existir: Você precisa criar um novo

---

#### 2. **Customer ID Incorreto**

O Customer ID **não é o mesmo que o Account ID** visível no Google Ads.

**Como encontrar o Customer ID correto:**

1. Acesse: https://ads.google.com
2. No canto superior direito, clique no ícone de ferramentas
3. Em "CONFIGURAÇÃO", clique em "Configurações"
4. O Customer ID aparece no topo: "ID do cliente: XXX-XXX-XXXX"
5. **Remova os traços**: Se aparecer `198-803-2294`, use `1988032294`

---

#### 3. **Conta Não Habilitada para API**

Algumas contas Google Ads têm restrições de API.

**Como verificar:**

1. Acesse: https://ads.google.com/aw/apicenter
2. Se você NÃO conseguir acessar, significa que sua conta não tem API habilitada
3. Entre em contato com o suporte do Google Ads para habilitar

---

#### 4. **Permissões Insuficientes**

A conta Google usada precisa ter permissões de **Admin** ou **Standard** na conta do Google Ads.

**Como verificar:**

1. Acesse: https://ads.google.com
2. Vá em "Ferramentas" > "Configuração" > "Acesso e segurança"
3. Verifique se seu email (andrew.antonangelo@gmail.com) tem acesso de Admin

---

## 🎯 PRÓXIMOS PASSOS

### 1. Verificar Status do Developer Token

```
1. Acesse: https://ads.google.com/aw/apicenter
2. Verifique se o token está "Approved" ou "Test"
3. Se não aparecer nada, você precisa solicitar acesso à API
```

### 2. Confirmar Customer ID

```
1. Acesse: https://ads.google.com
2. Clique no ícone de ferramentas (⚙️) no canto superior direito
3. Vá em "Configurações"
4. Copie o ID do cliente (sem traços)
5. Confirme se é: 1988032294
```

### 3. Solicitar Acesso à API (se necessário)

Se o Developer Token não aparecer no API Center:

```
1. Acesse: https://ads.google.com/aw/apicenter
2. Clique em "Apply for API access"
3. Preencha o formulário explicando que você precisa acessar dados da sua própria conta
4. Mencione que é para uso interno (relatórios/dashboard)
5. Aguarde aprovação (geralmente 1-3 dias úteis)
```

---

## 🧪 TESTES PARA FAZER

### Teste 1: Verificar se a conta está acessível

Execute no navegador enquanto logado no Google Ads:

```
https://ads.google.com/aw/apicenter
```

Se você conseguir acessar, sua conta tem API habilitada. ✅

---

### Teste 2: Confirmar que as credenciais OAuth estão funcionando

Já testamos isso e está **funcionando perfeitamente**:

```bash
node scripts/google-ads/get-refresh-token.js
```

✅ OAuth funcionando!

---

### Teste 3: Testar a API REST

```bash
node scripts/google-ads/test-rest-api.js
```

❌ Atualmente retornando 404

---

## 📊 ALTERNATIVA TEMPORÁRIA

Enquanto resolve o problema da API, você pode:

1. **Exportar dados manualmente do Google Ads**
   - Vá em "Relatórios" > "Relatórios predefinidos"
   - Exporte dados de campanhas em CSV
   - Importe no banco usando script

2. **Usar Google Ads Script**
   - Criar um script dentro do Google Ads
   - Enviar dados para uma planilha Google
   - Sincronizar a planilha com o banco

---

## 🆘 SUPORTE

Se você verificou todos os itens acima e ainda não funciona:

1. **Suporte Google Ads**: https://support.google.com/google-ads/
2. **Fórum de Desenvolvedores**: https://groups.google.com/g/adwords-api
3. **Documentação**: https://developers.google.com/google-ads/api/docs/start

---

## 📝 CHECKLIST

Marque conforme verificar:

- [ ] Developer Token está visível em https://ads.google.com/aw/apicenter
- [ ] Developer Token está com status "Approved" ou "Test"
- [ ] Customer ID está correto (sem traços): `1988032294`
- [ ] Sua conta tem permissão de Admin no Google Ads
- [ ] A conta Google Ads não é uma conta de teste/demo
- [ ] Você consegue ver campanhas ativas em https://ads.google.com

---

**Após verificar esses pontos, me avise o que você encontrou e eu ajudo com os próximos passos!** 🚀
