# 🚀 CONFIGURAÇÃO GOOGLE ADS - ÚLTIMOS PASSOS

**Status:** 80% completo ✅
**Falta:** Obter Refresh Token OAuth

---

## ✅ O QUE JÁ FOI FEITO

1. ✅ Credenciais adicionadas no `.env.local`
   - Customer ID: `1988032294`
   - Developer Token: `dmi75hKtklRuoAq6-8aPqA`
   - Client ID: `552077961450-...`
   - Client Secret: `GOCSPX-...`

2. ✅ Tabela `ads_spend_google` criada no banco
   - Campos para campanhas, métricas, conversões
   - Índices otimizados

3. ✅ Script de sincronização criado
   - `scripts/google-ads/sync-google-ads.js`
   - Busca campanhas e métricas dos últimos 30 dias

4. ✅ Script OAuth criado
   - `scripts/google-ads/get-refresh-token.js`
   - Abre navegador e obtém refresh token

---

## 🎯 PRÓXIMO PASSO (VOCÊ PRECISA FAZER)

### Obter o Refresh Token OAuth

**O que é?**
Um token que permite o script acessar sua conta Google Ads sem você precisar fazer login toda vez.

**Como obter (3 minutos):**

#### Passo 1: Executar o script

```bash
node scripts/google-ads/get-refresh-token.js
```

#### Passo 2: O que vai acontecer

1. Um navegador vai abrir automaticamente
2. Vai pedir para você fazer login no Google
3. Vai pedir para autorizar o acesso ao Google Ads
4. Depois de autorizar, vai mostrar uma página de sucesso com o **Refresh Token**

#### Passo 3: Copiar o token

Na página de sucesso, você verá algo como:

```
Refresh Token:
1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Copie esse token!**

#### Passo 4: Adicionar no .env.local

Abra o arquivo `.env.local` e adicione esta linha:

```bash
GOOGLE_ADS_REFRESH_TOKEN=1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

(Cole o token que você copiou)

---

## 🧪 TESTAR A SINCRONIZAÇÃO

Depois de adicionar o refresh token, teste a sincronização:

```bash
node scripts/google-ads/sync-google-ads.js --days=7
```

**O que deve acontecer:**

```
🚀 Iniciando sincronização do Google Ads
📅 Período: últimos 7 dias
🏢 Customer ID: 1988032294
🆔 Workspace: 00000000-0000-0000-0000-000000000010

✅ Conectado ao banco de dados

📥 Sincronizando campanhas do Google Ads...
✅ 5 campanhas encontradas
   ➕ Criada: Campanha Produto X
   ➕ Criada: Campanha Produto Y
   ...
💾 Campanhas sincronizadas

📊 Sincronizando métricas dos últimos 7 dias...
✅ 35 registros de métricas encontrados
💾 Métricas sincronizadas: 35 novas, 0 atualizadas

✅ Sincronização concluída com sucesso!
```

---

## ❌ SE DER ERRO

### Erro: "Missing required environment variable: GOOGLE_ADS_REFRESH_TOKEN"

**Solução:** Você ainda não adicionou o refresh token no `.env.local`. Execute o script `get-refresh-token.js` primeiro.

---

### Erro: "Invalid grant"

**Solução:** O refresh token expirou ou está inválido. Execute `get-refresh-token.js` novamente para obter um novo.

---

### Erro: "Authentication failed"

**Solução:** Verifique se o Developer Token está correto no `.env.local`.

---

### Erro: "Customer not found"

**Solução:** Verifique se o Customer ID está correto (sem traços): `1988032294`

---

## 📊 DEPOIS QUE FUNCIONAR

Quando a sincronização funcionar, você vai poder:

1. **Ver suas campanhas do Google Ads no dashboard**
   - Junto com as do Meta Ads
   - Tudo em um lugar

2. **Comparar Meta vs Google**
   - Tabela lado a lado
   - Ver qual canal performa melhor
   - Decidir onde investir mais

3. **Sincronização automática**
   - Podemos configurar para sincronizar todo dia
   - Você sempre terá dados atualizados

---

## 🎯 RESUMO DOS COMANDOS

```bash
# 1. Obter refresh token (FAZER AGORA)
node scripts/google-ads/get-refresh-token.js

# 2. Adicionar token no .env.local
# (copiar e colar manualmente)

# 3. Testar sincronização
node scripts/google-ads/sync-google-ads.js --days=7

# 4. (Futuro) Sincronizar diariamente
node scripts/google-ads/sync-google-ads.js --days=1
```

---

## ❓ DÚVIDAS?

**P: O refresh token expira?**
R: Não, a menos que você revogue o acesso. Ele é permanente.

**P: É seguro?**
R: Sim. O token só permite **leitura** dos dados. Não consegue criar, pausar ou editar campanhas.

**P: Preciso fazer isso toda vez?**
R: Não! Só uma vez. Depois o script usa o refresh token automaticamente.

---

**Quando você concluir e testar, me avise que eu crio a página de comparativo no dashboard!** 🚀
