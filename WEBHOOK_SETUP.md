# 🔔 Configuração de Webhooks do Mercado Livre

## ✅ Status Atual

- ✅ Código do webhook implementado e funcionando
- ✅ Integração com Telegram configurada
- ✅ Aplicação em produção na Vercel
- ⚠️ **FALTA**: Registrar webhook no painel do Mercado Livre

## 📋 Passo a Passo para Ativar Notificações

### 1️⃣ Acessar o Painel do Desenvolvedor

Acesse: **https://developers.mercadolivre.com.br/devcenter**

Faça login com a conta vinculada ao seu App ID: `5043496307995752`

### 2️⃣ Configurar Webhook na Aplicação

1. Clique em **"Minhas Aplicações"** no menu
2. Selecione sua aplicação (ID: `5043496307995752`)
3. Procure pela seção **"Notifications"** ou **"Webhooks"**
4. Encontre o campo **"Notifications Callback URL"** ou **"URL de retorno de notificações"**

### 3️⃣ Inserir a URL do Webhook

Cole a seguinte URL no campo de callback:

```
https://traffic-zen-hub-35.vercel.app/api/integrations/mercadolivre/notifications
```

✅ **Esta URL já está configurada no painel!**

### 4️⃣ Selecionar Tópicos de Notificação

Marque as seguintes opções (se disponível):

- ✅ **orders_v2** ou **orders** - Para receber notificações de vendas
- ✅ **questions** - Para receber notificações de perguntas
- ✅ **items** - Para receber notificações de alterações em produtos
- ✅ **messages** - Para receber notificações de mensagens

### 5️⃣ Salvar e Ativar

1. Clique em **"Salvar"** ou **"Save"**
2. Verifique se aparece uma confirmação de sucesso
3. Certifique-se de que o webhook está **ativado/enabled**

---

## 🧪 Como Testar

### Teste no Mercado Livre (Recomendado)

1. **Venda de Teste**: Faça uma compra de teste em um dos seus produtos
2. **Pergunta de Teste**: Faça uma pergunta em um anúncio
3. **Verifique o Telegram**: Você deve receber a notificação em tempo real!

### Verificar Logs de Notificação

No banco de dados, verifique a tabela `notification_logs`:

```sql
SELECT * FROM notification_logs
WHERE platform = 'telegram'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔍 Troubleshooting

### Não estou recebendo notificações

1. **Verifique se o webhook está ativo** no painel do ML
2. **Confirme a URL** está correta (sem espaços ou caracteres extras)
3. **Teste o Telegram** manualmente via API local:
   ```bash
   curl http://localhost:3001/api/integrations/mercadolivre/notifications/test?workspaceId=00000000-0000-0000-0000-000000000010&type=order
   ```

4. **Verifique os logs** do servidor Vercel:
   ```bash
   npx vercel logs
   ```

### Access Token Expirado

Se o access token expirar, você precisará renovar:

1. Use o endpoint de refresh token:
   ```bash
   curl -X POST http://localhost:3001/api/integrations/mercadolivre/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"workspaceId": "00000000-0000-0000-0000-000000000010"}'
   ```

2. Ou faça login novamente via OAuth

---

## 📚 Documentação Oficial

- [Notificações ML](https://developers.mercadolivre.com.br/en_us/products-receive-notifications)
- [Webhooks Guide](https://rollout.com/integration-guides/mercado-libre/quick-guide-to-implementing-webhooks-in-mercado-libre)

---

## ✨ O que vai acontecer

Quando configurado corretamente, você receberá no **Telegram**:

🎉 **Nova Venda**
- Número do pedido
- Valor total
- Dados do comprador
- Lista de produtos
- Link direto para o pedido no ML

❓ **Nova Pergunta**
- Texto da pergunta
- Nome do cliente
- Produto relacionado
- Link para responder

📦 **Atualização de Produto**
- ID do produto
- Status
- Alterações realizadas

💬 **Nova Mensagem**
- Texto da mensagem
- Remetente
- Data/hora

---

**Última atualização**: 2025-12-07
