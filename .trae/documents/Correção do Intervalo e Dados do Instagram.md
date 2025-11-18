## Diagnóstico Atual
1. O seletor de dias foi adicionado na página de Integrações e funciona para o botão lá.
2. Na página Instagram, o botão "Sincronizar Instagram" ainda está instanciado sem `days`, mantendo 7 dias; por isso o loader mostra “(7 dias)”.
3. A galeria usa fallback para `like_count`/`comments_count` de `instagram_media`, mas posts antigos podem não ter esses campos (precisa backfill) e/ou consulta de mídia não inclui todos os IDs sincronizados.
4. `performance_metrics.extra_metrics.media_insights` está sendo populado; porém métricas detalhadas por mídia variam por tipo (reels vs image).

## Plano de Correção
### 1) Propagação do intervalo na página Instagram
- Passar `days={parseInt(dateRange)}` para `<InstagramSyncButton />` no header da página Instagram.
- Confirmar que o toast e o loader exibem o valor escolhido.

### 2) Backfill de curtidas e comentários por mídia
- Criar script `scripts/backfill-instagram-media-counts.ts`:
  - Ler `instagram_media` dentro da janela desejada.
  - Para cada `media_id`, chamar `/{media-id}?fields=like_count,comments_count` e atualizar tabela.
- Rodar em produção uma vez para preencher posts já existentes.

### 3) Verificação de consultas no frontend
- Garantir que a query de `instagram_media` seleciona `like_count, comments_count` (já ajustado).
- Na galeria, manter fallback: `metrics.likes || m.like_count` e `metrics.comments || m.comments_count`.

### 4) Validação do backend
- Confirmar que `startSync` repassa `days` do body e o worker usa `options.days` nas chamadas de `fetchMedia`.
- Garantir que `fetchMediaInsights` continua métrica-a-métrica com tolerância a erro.

### 5) Testes e Auditoria
- Testar fluxo completo em produção com 30 dias pela página Instagram (após correção no botão).
- Validar no DB:
  - `select count(*) from instagram_media where workspace_id = '<UUID>' and posted_at >= current_date - interval '30 days';`
  - `select media_id, like_count, comments_count from instagram_media where workspace_id = '<UUID>' order by posted_at desc limit 10;`
  - `select metric_date, extra_metrics->'media_insights' is not null from performance_metrics where workspace_id = '<UUID>' and metric_date >= current_date - interval '30 days';`
- Validar UI:
  - Loader mostra “(30 dias)”.
  - Galeria exibe curtidas/comentários não zerados.

## Entregáveis
- Atualização do botão na página Instagram para respeitar o seletor de intervalo.
- Script de backfill para popular `like_count`/`comments_count`.
- Passos de validação e queries para conferência.

## Riscos e Mitigações
- Rate limit da Graph API: incluir pausa e limite de requisições no backfill.
- Posts fora da janela: garantir filtro por `posted_at` e paginação.

## Próximos Passos
1. Aplicar a correção no `Instagram.tsx` passando `days` ao botão.
2. Criar e executar o script de backfill.
3. Rodar sincronização de 30 dias pela página Instagram e validar UI/DB.
