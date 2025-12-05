# 🛒 Mercado Livre Integration - Quick Start

## 📋 Resumo

Integração completa com a API do Mercado Livre para visualização de métricas de vendas, produtos e analytics.

## 🚀 Acesso Rápido

### Frontend
- **URL**: http://localhost:8080/mercado-livre
- **Componente**: `src/pages/MercadoLivre.tsx`
- **Hooks**: `src/hooks/useMercadoLivre.ts`

### Backend  
- **API Base**: `/api/integrations/mercadolivre`
- **Router**: `server/api/integrations/mercadolivre.ts`

## 🔑 Configuração Rápida

1. **Adicione as credenciais no `.env.local`**:
```env
MERCADO_LIVRE_ACCESS_TOKEN=your_token_here
MERCADO_LIVRE_REFRESH_TOKEN=your_refresh_token
MERCADO_LIVRE_USER_ID=your_user_id
```

2. **Obtenha as credenciais em**:
   - https://developers.mercadolivre.com.br/

## 📊 Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/metrics` | Métricas agregadas (vendas, receita, visitas) |
| GET | `/products` | Lista de produtos |
| GET | `/questions` | Perguntas recebidas |
| POST | `/sync` | Sincronizar dados |
| POST | `/questions/:id/answer` | Responder pergunta |
| PUT | `/products/:id/price` | Atualizar preço |
| PUT | `/products/:id/status` | Pausar/ativar produto |

## 📈 Métricas Exibidas

- ✅ Total de Vendas
- ✅ Receita Total  
- ✅ Visitas aos Produtos
- ✅ Taxa de Conversão
- ✅ Produtos Ativos
- ✅ Reputação do Vendedor
- ✅ Perguntas Pendentes/Respondidas
- ✅ Gráfico de Evolução de Vendas

## 🎯 Recursos da API do Mercado Livre

### Principais Endpoints Utilizados:
- `GET /users/{userId}/items_visits` - Visitas
- `GET /orders/search` - Vendas/Ordens
- `GET /questions/search` - Perguntas
- `GET /items/{itemId}` - Detalhes de produtos
- `POST /answers` - Responder perguntas
- `PUT /items/{itemId}` - Atualizar produtos

## 🧪 Testando a Integração

```bash
# 1. Inicie o servidor de desenvolvimento
npm run dev

# 2. Acesse o dashboard
open http://localhost:8080/mercado-livre

# 3. Verifique os endpoints da API
curl http://localhost:3001/api/integrations/mercadolivre/metrics?workspaceId=YOUR_ID&days=30
```

## 📖 Documentação Completa

Para documentação detalhada, veja:
- `.gemini/mercado-livre-integration.md`

## ⚠️ Notas Importantes

1. **Token Expiration**: Access tokens expiram em 6 horas
2. **Rate Limits**: A API tem limites de requisições
3. **Permissions**: Certifique-se de ter as permissões corretas na aplicação ML

## 🔄 Próximos Passos

- [ ] Implementar renovação automática de token
- [ ] Adicionar sincronização com banco de dados
- [ ] Criar notificações para novas perguntas
- [ ] Implementar resposta automática de perguntas

## 🆘 Troubleshooting

| Erro | Solução |
|------|---------|
| 401 Unauthorized | Renove o access token |
| 403 Forbidden | Verifique permissões da app |
| 404 Not Found | Confirme User ID e Item ID |

---

**Status**: ✅ Implementado
**Última atualização**: Dez 2025
