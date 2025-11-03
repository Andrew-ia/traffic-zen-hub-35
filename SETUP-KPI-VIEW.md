# Setup da View v_campaign_kpi - Guia Rápido ⚡

## 🎯 Por que preciso fazer isso?

A view `v_campaign_kpi` é necessária para que a tabela de campanhas mostre as métricas corretas (Leads, Cliques, Conversas, etc) baseadas no objetivo de cada campanha.

Sem ela, você verá "-" em todas as colunas de KPI.

---

## ✅ Solução Rápida (5 minutos)

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. **Abra o SQL Editor do Supabase:**
   ```
   https://supabase.com/dashboard/project/bichvnuepmgvdlrclmxb/sql/new
   ```

2. **Copie TODO o conteúdo do arquivo:**
   ```bash
   cat supabase/sql/02_views.sql
   ```

   Ou abra o arquivo `supabase/sql/02_views.sql` no seu editor.

3. **Cole no SQL Editor e clique em "Run"**

4. **Aguarde a mensagem de sucesso:**
   ```
   Success. No rows returned
   ```

5. **Recarregue a página do TrafficPro** (F5)

**Pronto!** 🎉 Agora você verá:
- ✅ Coluna "Resultado" com labels corretos (Leads, Cliques, etc)
- ✅ Coluna "Qtd" com números
- ✅ Coluna "Investimento" com valores
- ✅ Coluna "Custo/Resultado" calculado corretamente
- ✅ Coluna "ROAS" (apenas para campanhas de vendas)

---

### Opção 2: Via Supabase CLI

Se você tiver o Supabase CLI instalado:

```bash
npx supabase db push
```

---

## 🔍 Como verificar se funcionou?

Após aplicar a view, você pode testar com esta query SQL:

```sql
SELECT
  campaign_id,
  result_label,
  result_value,
  cost_per_result,
  spend,
  roas
FROM v_campaign_kpi
WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
  AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
LIMIT 10;
```

Se retornar dados, está funcionando! ✅

---

## 🐛 Troubleshooting

### Problema: "relation v_campaign_kpi does not exist"
**Solução:** Você ainda não executou o SQL. Volte para Opção 1 acima.

### Problema: View criada mas ainda mostra "-" na tabela
**Causas possíveis:**
1. **Sem dados nos últimos 30 dias** - As campanhas precisam ter métricas recentes
2. **Campanhas sem objective** - Google Ads usa fallback para "Cliques"
3. **Cache do navegador** - Faça um hard refresh (Cmd+Shift+R no Mac)

**Verificação:**
```sql
-- Contar quantas rows a view retorna
SELECT COUNT(*) as total_rows
FROM v_campaign_kpi
WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
  AND metric_date >= CURRENT_DATE - INTERVAL '30 days';
```

Se retornar 0, o problema é falta de dados. Execute a sincronização:
```bash
npm run server:sync-meta
npm run server:sync-google
```

### Problema: Erro ao executar o SQL
**Causa:** Permissões insuficientes

**Solução:** Use o serviço account do Supabase ou peça ao admin para executar.

---

## 📊 O que a View faz?

A `v_campaign_kpi` mapeia automaticamente:

| Objetivo | Mostra | Métrica | Custo |
|----------|--------|---------|-------|
| OUTCOME_LEADS | **Leads** | `leads` | R$ X / lead (CPL) |
| MESSAGES | **Conversas** | `conversations_started` | R$ X / conversa |
| LINK_CLICKS | **Cliques** | `clicks` | R$ X / clique (CPC) |
| VIDEO_VIEWS | **Views** | `video_views` | R$ X / view (CPV) |
| SALES | **Compras** | `purchases` | R$ X / compra (CPA) + ROAS |
| ENGAGEMENT | **Engajamentos** | `engagements` | R$ X / engajamento |

---

## 🚀 Próximos Passos

Após aplicar a view:

1. ✅ Recarregue o TrafficPro
2. ✅ Vá para `/campaigns`
3. ✅ Verifique se as colunas mostram dados
4. ✅ Clique em uma campanha para ver os detalhes
5. ✅ Confirme que o ROAS só aparece em campanhas de vendas

---

## 📞 Ajuda

Se ainda tiver problemas:
1. Verifique se a view foi criada: `SELECT * FROM pg_views WHERE viewname = 'v_campaign_kpi';`
2. Verifique se há dados: `SELECT COUNT(*) FROM v_campaign_kpi;`
3. Revise os logs do servidor: `npm run dev`
4. Consulte [RELATORIO-FINAL-KPI.md](./RELATORIO-FINAL-KPI.md)

---

**Criado**: 2025-11-02
**Tempo estimado**: 5 minutos
**Dificuldade**: ⭐ Fácil
