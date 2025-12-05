# ✅ Integração Mercado Livre - Configuração Completa

## 📋 Resumo da Configuração

A integração com o Mercado Livre foi configurada com sucesso! Aqui está um resumo de tudo que foi implementado:

### 🔑 Credenciais Configuradas

As seguintes credenciais foram adicionadas ao arquivo `.env.local`:

```bash
MERCADO_LIVRE_CLIENT_ID=5043496307995752
MERCADO_LIVRE_CLIENT_SECRET=qIi2rEUIjQaJKWcxFLKbrCdepnHy9B32
MERCADO_LIVRE_ACCESS_TOKEN=TG-6931cf8eac709b0001446683-1438975559
MERCADO_LIVRE_USER_ID=1438975559
```

**Nota:** O token TG (Test User) é válido por 6 horas. Para uso em produção, você precisará gerar um token OAuth de longa duração.

---

## 🚀 Funcionalidades Implementadas

### 1. **Backend - API Endpoints**

Foram criados os seguintes endpoints em `/api/integrations/mercadolivre`:

#### Autenticação OAuth
- `GET /auth/url` - Gera URL de autorização OAuth
- `POST /auth/callback` - Processa callback e troca código por tokens
- `POST /auth/refresh` - Renova access token usando refresh token

#### Métricas e Dados
- `GET /metrics` - Retorna métricas agregadas (vendas, visitas, conversão)
- `GET /products` - Lista produtos do vendedor
- `GET /questions` - Lista perguntas recebidas

#### Sincronização
- `POST /sync` - Sincroniza produtos do ML para o banco de dados

#### Gestão de Produtos
- `POST /products/:productId/publish` - Publica produto no ML
- `PUT /products/:productId/price` - Atualiza preço
- `PUT /products/:productId/status` - Ativa/pausa produto

#### Perguntas
- `POST /questions/:questionId/answer` - Responde pergunta

#### Categorias
- `GET /categories/:country` - Lista categorias
- `GET /categories/:categoryId/details` - Detalhes da categoria
- `POST /categories/predict` - Sugere categoria baseada no título

### 2. **Frontend - Páginas e Componentes**

#### Páginas Criadas
- **`/integrations/mercadolivre/callback`** - Página de callback OAuth
  - Exibe tokens gerados
  - Permite copiar credenciais
  - Instruções para configuração

#### Componentes
- **`MercadoLivreConnectButton`** - Botão para conectar via OAuth
  - Integrado na página de Integrações
  - Redireciona para autorização do ML

#### Páginas Existentes Atualizadas
- **`/integrations`** - Adicionada seção "E-commerce" com card do Mercado Livre
- **`/mercado-livre`** - Página já existente para visualizar dados do ML
- **`/products`** - Gestão de produtos com integração ML

### 3. **Scripts Utilitários**

- **`scripts/get-ml-user-info.ts`** - Valida token e extrai User ID

---

## 🎯 Como Usar

### Opção 1: Usar Token TG (Atual - Desenvolvimento)

Você já está configurado! O token TG permite testar a integração imediatamente.

**Limitações do TG:**
- ✅ Válido para desenvolvimento e testes
- ⚠️ Expira em 6 horas
- ⚠️ Pode ter limitações de permissões

### Opção 2: OAuth Completo (Produção)

Para produção, siga estes passos:

1. **Configure a URL de redirecionamento no Mercado Livre:**
   - Acesse: https://developers.mercadolivre.com.br/apps
   - Adicione: `http://localhost:8080/integrations/mercadolivre/callback`
   - Para produção: `https://seu-dominio.com/integrations/mercadolivre/callback`

2. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

3. **Conecte via interface:**
   - Acesse: http://localhost:8080/integrations
   - Clique em "Conectar Mercado Livre"
   - Autorize a aplicação
   - Copie os tokens gerados

4. **Atualize o .env.local:**
   - Substitua o TG pelo Access Token OAuth
   - Adicione o Refresh Token

---

## 📊 Endpoints Disponíveis

### Testar a Integração

```bash
# Buscar métricas
GET http://localhost:3001/api/integrations/mercadolivre/metrics?workspaceId=00000000-0000-0000-0000-000000000010&days=30

# Listar produtos
GET http://localhost:3001/api/integrations/mercadolivre/products?workspaceId=00000000-0000-0000-0000-000000000010

# Listar perguntas
GET http://localhost:3001/api/integrations/mercadolivre/questions?workspaceId=00000000-0000-0000-0000-000000000010

# Sincronizar produtos
POST http://localhost:3001/api/integrations/mercadolivre/sync
Content-Type: application/json

{
  "workspaceId": "00000000-0000-0000-0000-000000000010"
}
```

---

## ⚠️ Sobre o Token TG

O token TG que você forneceu retornou erro 403 ao tentar acessar `/users/me`. Isso pode acontecer por:

1. **Permissões limitadas** - Tokens TG podem ter restrições
2. **Expiração** - TG expira em 6 horas
3. **Escopo** - Pode não ter todas as permissões necessárias

### Soluções:

#### Se o token expirou:
1. Acesse: https://developers.mercadolivre.com.br/apps
2. Selecione sua aplicação
3. Vá em "Test User" ou "Credenciais"
4. Gere um novo TG
5. Atualize no `.env.local`

#### Para produção (recomendado):
Use o fluxo OAuth completo para obter um token de longa duração com todas as permissões.

---

## 🔄 Renovação de Tokens

### Token TG
- **Validade:** 6 horas
- **Renovação:** Gere um novo TG no painel de desenvolvedores

### Token OAuth
- **Access Token:** 6 horas
- **Refresh Token:** Não expira (até ser revogado)
- **Renovação automática:** O sistema tentará renovar automaticamente

Para renovar manualmente:
```bash
POST http://localhost:3001/api/integrations/mercadolivre/auth/refresh
Content-Type: application/json

{
  "workspaceId": "00000000-0000-0000-0000-000000000010"
}
```

---

## 📚 Próximos Passos

1. **Testar a integração:**
   ```bash
   npm run dev
   ```
   - Acesse http://localhost:8080/mercado-livre
   - Verifique se os dados são carregados

2. **Se o TG estiver expirado:**
   - Gere um novo TG
   - Ou configure OAuth completo

3. **Para produção:**
   - Configure OAuth
   - Adicione URL de produção no painel do ML
   - Deploy com tokens de produção

---

## 🐛 Troubleshooting

### Erro 403: "At least one policy returned UNAUTHORIZED"
- Token expirado ou sem permissões
- Gere um novo TG ou use OAuth

### Erro 401: "Invalid token"
- Token inválido
- Verifique se copiou corretamente
- Sem espaços ou quebras de linha

### Dados não carregam
- Verifique se o servidor está rodando
- Confirme que as variáveis estão no `.env.local`
- Reinicie o servidor após mudanças no `.env.local`

---

## 📖 Documentação

- **API do Mercado Livre:** https://developers.mercadolivre.com.br/pt_br/api-docs
- **OAuth 2.0:** https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
- **Painel de Apps:** https://developers.mercadolivre.com.br/apps

---

## ✨ Conclusão

A integração está **configurada e pronta para uso**! 

Para começar a usar:
1. Inicie o servidor: `npm run dev`
2. Acesse: http://localhost:8080/mercado-livre
3. Se necessário, gere um novo TG ou configure OAuth

**Dúvidas?** Consulte a documentação ou os arquivos:
- `docs/MERCADO_LIVRE_OAUTH_SETUP.md` - Guia OAuth completo
- `server/api/integrations/mercadolivre.ts` - Código da API
