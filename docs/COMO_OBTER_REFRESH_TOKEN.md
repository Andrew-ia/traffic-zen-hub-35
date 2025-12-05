# 🔄 Como Obter o Refresh Token do Mercado Livre

## ⚠️ Importante: Token TG vs OAuth

- **Token TG (atual):** Não tem refresh token, expira em 6 horas
- **Token OAuth:** Vem com refresh token, pode ser renovado automaticamente

## 🚀 Passo a Passo para Obter Refresh Token

### 1️⃣ Configure a URL de Redirecionamento

**ANTES de iniciar o OAuth, você DEVE configurar isso:**

1. Acesse: https://developers.mercadolivre.com.br/apps
2. Clique na sua aplicação (ID: 5043496307995752)
3. Vá em **"Configurações"** ou **"Redirect URIs"**
4. Adicione esta URL:
   ```
   http://localhost:8080/integrations/mercadolivre/callback
   ```
5. Clique em **"Salvar"**

⚠️ **SEM ESTE PASSO, O OAUTH NÃO FUNCIONARÁ!**

---

### 2️⃣ Inicie o Servidor

```bash
npm run dev
```

Aguarde até ver:
```
✓ ready in XXXms
```

---

### 3️⃣ Opção A: Usar o Script Automático (Recomendado)

```bash
./scripts/ml-oauth.sh
```

Isso vai:
- Abrir o navegador na página de autorização
- Você faz login e autoriza
- É redirecionado para a página de callback
- Vê os tokens (incluindo refresh token)

---

### 3️⃣ Opção B: Manual pela Interface

1. Acesse: http://localhost:8080/integrations
2. Na seção "E-commerce", clique em **"Conectar Mercado Livre"**
3. Faça login no Mercado Livre
4. Autorize a aplicação
5. Copie os tokens exibidos

---

### 3️⃣ Opção C: URL Direta

Abra esta URL no navegador:

```
https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=5043496307995752&redirect_uri=http://localhost:8080/integrations/mercadolivre/callback&state=00000000-0000-0000-0000-000000000010
```

---

### 4️⃣ Copie os Tokens

Após autorizar, você verá uma página com 3 tokens:

1. **Access Token** - Token de acesso (expira em 6h)
2. **Refresh Token** - Token para renovar (não expira)
3. **User ID** - ID do usuário

**Copie todos e adicione ao `.env.local`:**

```bash
MERCADO_LIVRE_ACCESS_TOKEN=APP_USR-xxxxx-xxxxxx-xxxxx
MERCADO_LIVRE_REFRESH_TOKEN=TG-xxxxx-xxxxx-xxxxx
MERCADO_LIVRE_USER_ID=1438975559
```

---

### 5️⃣ Reinicie o Servidor

```bash
# Pressione Ctrl+C para parar
# Depois:
npm run dev
```

---

## 🎯 Por Que Você Precisa do Refresh Token?

| Característica | Token TG | Token OAuth |
|----------------|----------|-------------|
| **Validade** | 6 horas | Access: 6h, Refresh: ∞ |
| **Renovação** | Manual | Automática |
| **Produção** | ❌ Não | ✅ Sim |
| **Refresh Token** | ❌ Não | ✅ Sim |

Com o refresh token, quando o access token expirar (6h), o sistema renova automaticamente sem você precisar fazer nada!

---

## 🔧 Renovação Automática

O código já está preparado para renovar automaticamente:

```typescript
// Quando o access token expirar, o sistema chama:
POST /api/integrations/mercadolivre/auth/refresh
{
  "workspaceId": "00000000-0000-0000-0000-000000000010"
}

// Retorna novos tokens:
{
  "accessToken": "novo_access_token",
  "refreshToken": "novo_refresh_token"
}
```

---

## ❓ FAQ

### O token TG serve para produção?
**Não.** É apenas para testes. Use OAuth para produção.

### Preciso fazer OAuth toda vez?
**Não.** Com o refresh token, você só precisa fazer OAuth uma vez. O sistema renova automaticamente.

### O refresh token expira?
**Não**, a menos que:
- Você revogue manualmente
- Mude a senha da conta ML
- Desinstale a aplicação

### Posso usar o TG por enquanto?
**Sim**, mas lembre-se:
- Expira em 6 horas
- Precisa gerar novo manualmente
- Não recomendado para produção

---

## 🚨 Checklist Antes de Iniciar OAuth

- [ ] Servidor rodando (`npm run dev`)
- [ ] URL de redirecionamento configurada no painel ML
- [ ] Client ID e Secret corretos no `.env.local`
- [ ] Navegador pronto para fazer login no ML

**Tudo pronto?** Execute: `./scripts/ml-oauth.sh`

---

## 📞 Precisa de Ajuda?

Se encontrar algum erro:

1. **"Invalid redirect_uri"**
   - Configure a URL no painel do ML

2. **"Invalid client_id"**
   - Verifique o CLIENT_ID no `.env.local`

3. **Página não carrega**
   - Certifique-se que o servidor está rodando
   - Verifique se está em `http://localhost:8080`

4. **Não vejo os tokens**
   - Verifique o console do navegador (F12)
   - Veja os logs do servidor
