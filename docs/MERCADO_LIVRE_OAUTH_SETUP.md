# Guia de Autenticação OAuth - Mercado Livre

Este guia explica como completar a configuração da integração com o Mercado Livre usando OAuth 2.0.

## ✅ Configurações Já Realizadas

As seguintes credenciais já foram adicionadas ao arquivo `.env.local`:

```bash
MERCADO_LIVRE_CLIENT_ID=5043496307995752
MERCADO_LIVRE_CLIENT_SECRET=qIi2rEUIjQaJKWcxFLKbrCdepnHy9B32
```

## 📋 Próximos Passos

### 1. Configurar URL de Redirecionamento no Mercado Livre

Antes de iniciar o fluxo OAuth, você precisa configurar a URL de redirecionamento na sua aplicação do Mercado Livre:

1. Acesse: https://developers.mercadolivre.com.br/apps
2. Selecione sua aplicação (ID: 5043496307995752)
3. Vá em "Configurações" ou "Settings"
4. Adicione a seguinte URL de redirecionamento:
   ```
   http://localhost:8080/integrations/mercadolivre/callback
   ```
5. Salve as alterações

**Nota:** Para produção, você precisará adicionar também a URL de produção (ex: `https://seu-dominio.com/integrations/mercadolivre/callback`)

### 2. Iniciar o Servidor de Desenvolvimento

Certifique-se de que tanto o frontend quanto o backend estão rodando:

```bash
npm run dev
```

Este comando inicia:
- Frontend (Vite): http://localhost:8080
- Backend (Express): http://localhost:3001

### 3. Conectar o Mercado Livre

1. Acesse a aplicação: http://localhost:8080
2. Faça login (se necessário)
3. Navegue para: **Integrações** (menu lateral)
4. Na seção "E-commerce", encontre o card do **Mercado Livre**
5. Clique no botão **"Conectar Mercado Livre"**

### 4. Autorizar a Aplicação

Você será redirecionado para a página de autorização do Mercado Livre:

1. Faça login na sua conta do Mercado Livre (se solicitado)
2. Revise as permissões solicitadas
3. Clique em **"Autorizar"** ou **"Permitir"**

### 5. Copiar os Tokens

Após a autorização, você será redirecionado de volta para a aplicação, onde verá uma página com os tokens gerados:

1. **Access Token**: Token de acesso para fazer chamadas à API
2. **Refresh Token**: Token para renovar o access token quando expirar
3. **User ID**: ID do seu usuário no Mercado Livre

A página mostrará botões "Copiar" para cada token. Copie-os e adicione ao seu arquivo `.env.local`:

```bash
MERCADO_LIVRE_ACCESS_TOKEN=seu_access_token_aqui
MERCADO_LIVRE_REFRESH_TOKEN=seu_refresh_token_aqui
MERCADO_LIVRE_USER_ID=seu_user_id_aqui
```

### 6. Reiniciar o Servidor

Após adicionar os tokens ao `.env.local`, reinicie o servidor para aplicar as mudanças:

```bash
# Pressione Ctrl+C para parar o servidor
# Depois execute novamente:
npm run dev
```

## 🎉 Pronto!

Agora sua integração com o Mercado Livre está completa! Você pode:

- Visualizar produtos do Mercado Livre em: http://localhost:8080/mercado-livre
- Sincronizar produtos em: http://localhost:8080/products
- Gerenciar produtos em: http://localhost:8080/sync

## 🔄 Renovação de Tokens

Os access tokens do Mercado Livre expiram após 6 horas. Quando isso acontecer:

1. A aplicação tentará renovar automaticamente usando o refresh token
2. Se a renovação falhar, você precisará reconectar manualmente
3. Os novos tokens serão exibidos nos logs do servidor

Para renovar manualmente, você pode fazer uma requisição POST para:

```bash
POST /api/integrations/mercadolivre/auth/refresh
Content-Type: application/json

{
  "workspaceId": "00000000-0000-0000-0000-000000000010"
}
```

## 📚 Recursos Adicionais

- **Documentação da API**: https://developers.mercadolivre.com.br/pt_br/api-docs
- **OAuth 2.0**: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
- **Gerenciar Apps**: https://developers.mercadolivre.com.br/apps

## ⚠️ Notas Importantes

1. **Segurança**: Nunca compartilhe seus tokens ou commit eles no Git
2. **Ambiente**: Os tokens são diferentes para cada ambiente (dev/prod)
3. **Permissões**: Certifique-se de que sua aplicação tem as permissões necessárias
4. **Rate Limits**: A API do Mercado Livre tem limites de requisições

## 🐛 Troubleshooting

### Erro: "Invalid redirect_uri"
- Verifique se a URL de redirecionamento está corretamente configurada no painel do Mercado Livre
- A URL deve ser exatamente: `http://localhost:8080/integrations/mercadolivre/callback`

### Erro: "Invalid client_id or client_secret"
- Verifique se o CLIENT_ID e CLIENT_SECRET estão corretos no `.env.local`
- Certifique-se de que não há espaços extras

### Tokens não funcionam
- Verifique se você reiniciou o servidor após adicionar os tokens
- Confirme que os tokens foram copiados corretamente (sem espaços ou quebras de linha)

### Erro 401 nas requisições
- O access token pode ter expirado (válido por 6 horas)
- Tente renovar usando o refresh token
- Se necessário, reconecte a conta
