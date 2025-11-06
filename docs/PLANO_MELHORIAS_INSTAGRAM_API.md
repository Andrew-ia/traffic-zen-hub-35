# Plano Abrangente de Melhorias — Instagram Graph API e Projeto

Este documento apresenta um plano técnico completo, baseado na análise da Instagram Graph API (Facebook Login) e do estado atual do projeto `traffic-zen-hub-35`. O objetivo é orientar melhorias de código, arquitetura, integrações com a API e práticas operacionais, sem implementar mudanças neste momento.

Referência principal: `docs/INSTAGRAM_GRAPH_API.md` (guia consolidado de API).

---

## 1. Análise Diagnóstica

### Pontos fracos e gargalos do projeto
- Integração Meta/Instagram não padronizada: ausência de um client tipado e centralizado para chamadas ao Graph API.
- Possível uso de polling em vez de webhooks: maior latência e custo computacional para comentários/menções/Stories.
- Gestão de tokens e permissões: risco de expiração de `User Access Token` e escopos excessivos sem rotação/monitoramento.
- Ausência de filas/entregas confiáveis para publicação de mídia: containers expiram em 24h; sem mecanismo robusto de retry/backoff.
- Padronização de logs e observabilidade limitada: difícil rastrear erros de rate limit, 2FA faltante e falhas de App Review/permissões.
- Paginação e limites de hashtag: provável falta de controle sobre limite de 30 consultas únicas/7 dias e 50 resultados/página.
- Insufficient API error normalization: respostas de erro heterogêneas do Graph API tratadas ad hoc.
- Documentação e testes: cobertura dispersa; poucas suites automatizadas para integração com Graph API.

### Oportunidades de otimização na API
- Adotar webhooks para comentários/menções/Story insights reduzindo polling e atrasos.
- Consolidar campos (fields) e uso de `versioning` (`v24.0`) para consistência.
- Implementar “field expansion” e batch谨 para reduzir múltiplas requisições.
- Otimizar consultas de hashtags com caching e rotas de leitura com paginação robusta.
- Automatizar rotação de tokens (short → long-lived) e verificação de escopos antes das chamadas.
- Implementar proteção contra rate limiting (exponencial backoff, jitter) e registrar incidentes.

### Limitações técnicas que impactam desempenho
- Containers expiram em 24h: demanda orquestração e monitoramento de estado.
- Latência de insights até 48h: pipelines precisam considerar atrasos e reprocessamentos.
- Menções em Stories não suportadas: escopo claro para UX/relatórios.
- Restrições em comentários descobertos via Mentions: certas operações somente pelo dono.
- Limites por hashtag (30/7 dias): risco de bloqueio por excesso de queries únicas.
- 2FA exigida pela Página: chamadas falham se o usuário do Facebook não tiver 2FA.

---

## 2. Plano de Melhorias Técnicas

### Otimizações de código por módulo
- `server/services/` e `server/api/integrations/`:
  - Criar `instagramClient` (TypeScript) tipado com wrappers para endpoints principais (`media`, `media_publish`, `comments`, `hashtags`, `insights`, `mentioned_media`, `mentioned_comment`).
  - Padronizar tratamento de erros (normalizador Graph API) e códigos HTTP.
  - Implementar retries com backoff e circuit breaker para rate limit e falhas transitórias.
- `scripts/meta/` e `supabase/functions/meta-sync/`:
  - Separar lógicas Meta Ads de Instagram Graph API; criar scripts dedicados a sync de IG.
  - Adicionar verificação prévia de escopos/tokens e relatórios de conformidade (permissões/2FA).
- `server/config/`:
  - Centralizar variáveis de ambiente e chaves (Meta App ID/Secret, versão do Graph API, escopos).
  - Adicionar `tokenStore` (Redis/Postgres) com rotinas de refresh de long-lived tokens.
- `server/workers/`:
  - Criar workers para publicação de mídia (fila de containers → publish), moderação de comentários, coleta de insights e ingestão de webhooks.

### Melhorias de arquitetura e organização
- Introduzir camada de integração (`/server/integrations/instagram/`) com:
  - `client.ts` (HTTP Graph client + tipagens), `routes.ts` (handlers REST internos), `webhooks.ts` (assinatura e verificação), `jobs.ts` (fila/cron), `mappers.ts` (DTOs → modelos), `errors.ts` (normalização).
- Adotar fila (BullMQ/Redis) para publicação e moderação, garantindo retries e observabilidade.
- Padronizar logs: adicionar `request_id`, correlação com `ig-user-id`, `media_id`, `comment_id`, contadores de rate limit.
- Caching: armazenar resultados de hashtag search e detalhes estáticos (ex.: `ig-hashtag-id`) com TTL.
- Segurança e conformidade: abstrair tokens e permissões, validação sistemática de 2FA quando exigida.

### Refatorações para manutenibilidade
- Unificar chamadas do Graph API em um único serviço cliente, com funções coesas por domínio (Media, Comments, Hashtags, Insights, Mentions).
- Introduzir testes de integração com mock do Graph API (pact/contract ou stubs) e fixtures de erro.
- Criar documentação interna (`docs/integrations/instagram.md`) com versões, escopos, fluxos, exemplos e checklists.

---

## 3. Plano de Melhorias de API

### Melhorias na integração
- Webhooks IG: implementar assinatura/validação de endpoints, armazenar eventos e reagir com workers (comentários, menções, Story insights).
- Versionamento: padronizar todas as chamadas em `v24.0` e parametrizar versão via config.
- Campos e pagination: consolidar `fields` por caso de uso e padronizar paginação cursor‑based.
- Tokens: fluxo de obtenção e refresh de long-lived tokens; health checks de permissões/2FA.

### Novos endpoints/recursos úteis (internos à plataforma)
- `POST /integrations/instagram/media`: cria container e enfileira publish.
- `GET /integrations/instagram/media/:id`: estado de container/publicação.
- `POST /integrations/instagram/comments/:mediaId`: cria comentário.
- `POST /integrations/instagram/comments/:commentId/replies`: responde comentário.
- `POST /integrations/instagram/comments/:commentId/hide`: oculta/exibe.
- `GET /integrations/instagram/hashtags/search?q=`: busca `ig-hashtag-id` com caching.
- `GET /integrations/instagram/hashtags/:id/recent`: resultados paginados.
- `GET /integrations/instagram/insights/user`: métricas agregadas do perfil.
- `GET /integrations/instagram/insights/media/:id`: métricas por mídia.
- `GET /integrations/instagram/mentions/media/:mediaId`: wrapper para `mentioned_media`.
- `GET /integrations/instagram/mentions/comments/:commentId`: wrapper para `mentioned_comment`.

### Otimizações nas chamadas e tratamento de respostas
- Batch e field expansion: reduzir round-trips agregando campos relacionados.
- Normalização de erros: converter erros do Graph API em códigos internos, com granularidade (permissão, token, rate, 2FA, App Review).
- Retries com jitter e limites: respeitar `Retry-After` e backoff exponencial customizado.
- Observabilidade: capturar métricas por endpoint (latência, taxa de erro, rate limit hits) e logs estruturados.

---

## 4. Cronograma Prioritário

### Prioridade Alta (impacto imediato)
- Criar `instagramClient` tipado e centralizado — 2–3 dias
- Implementar webhooks (comentários/menções/Stories) — 3–4 dias
- Fila de publicação de mídia (containers → publish + retries) — 2–3 dias
- Token management (long-lived + health checks) — 2 dias

Dependências: client antes dos webhooks; token management antes de rotinas com chamadas em produção.

### Prioridade Média
- Endpoints internos de moderação e insights — 3–4 dias
- Caching de hashtags e paginação padronizada — 2–3 dias
- Normalização de erros e observabilidade — 2–3 dias

Dependências: client e camada de integração prontos.

### Prioridade Baixa
- Testes de integração/mocks de Graph API — 3–5 dias
- Documentação interna e playbooks de operação — 1–2 dias
- Refino de arquitetura (mappers/DTOs, separação de domínios) — 2–3 dias

Observação: estimativas são de esforço; podem variar com App Review/escopos.

---

## 5. Métricas de Sucesso

### KPIs por melhoria
- Publicação de mídia
  - `Publish Success Rate` (% de containers publicados ≤24h)
  - `Time-to-Publish` (p50/p95 do tempo entre criação e publish)
  - `Retry Incidents` (contagem de retries por causas)
- Webhooks
  - `Webhook Delivery Success` (% de eventos recebidos vs enviados)
  - `Processing Latency` (p50/p95 entre recebimento e processamento)
  - `Duplicate Handling Rate` (eventos idempotentes tratados corretamente)
- Hashtags
  - `Hashtag Query Efficiency` (taxa de cache hit, consultas únicas/7d)
  - `Rate Limit Incidents` (erros por excesso de consultas)
- Comentários
  - `Moderation SLA` (tempo médio para responder/ocultar)
  - `Error Rate` (falhas por permissão/ownership)
- Insights
  - `Insights Freshness` (atraso médio, reprocessamentos agendados)
  - `Data Completeness` (% de métricas esperadas disponíveis)
- Tokens/Permissões
  - `Token Expiry Incidents` (falhas por expiração)
  - `Permission Coverage` (% de chamadas com escopos corretos)

### Critérios de aceitação por item
- Client integrado: 100% das chamadas IG passam pelo `instagramClient`; cobertura de erros padronizada.
- Webhooks: assinatura verificada, armazenamento idempotente, workers funcionando com confirmação e reprocessamento.
- Fila de publicação: containers publicados com >98% de sucesso em ≤24h, retries configurados e observáveis.
- Token management: nenhum incidente de expiração em produção; rotina de refresh e alertas.
- Hashtags: cache ativo com ≥70% cache hit; limite de 30 consultas/7d respeitado.
- Comentários: endpoints internos expostos e protegidos; operações auditáveis.
- Insights: coleta periódica estável, relatórios gerados sem falhas por latência.

### Métodos de validação
- Testes automatizados de integração (mocks/stubs do Graph API).
- Dashboards (Prometheus/Grafana ou logs + métricas) para KPIs.
- Simulações de rate limit e erros de permissão em ambiente de staging.
- Auditoria de tokens e escopos com scripts de verificação.
- Playbooks de incidentes (rollback, backoff, reprocessamento).

---

## Observações Finais

- Todos os itens dependem do uso correto de permissões e da aprovação (se necessária) via App Review; ajuste o escopo ao mínimo necessário.
- O plano pressupõe migrações gradativas, com feature flags e validação em staging antes de produção.
- Consulte `docs/INSTAGRAM_GRAPH_API.md` para detalhes de endpoints, limitações e exemplos de requisição.

