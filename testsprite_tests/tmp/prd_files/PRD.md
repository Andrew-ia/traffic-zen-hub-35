# PRD — Traffic Zen Hub 35

## 1. Visão Geral
Aplicação de inteligência e operação de tráfego pago que consolida integrações (Meta Ads, Google Ads, GA4), orquestra sincronizações, calcula KPIs, e oferece dashboards, relatórios e automações assistidas por IA. O produto é composto por um frontend React (Vite + Tailwind), um backend Node/TypeScript, serviços e funções no Supabase (Postgres, Edge Functions), além de jobs de cron e scripts de auditoria/checagem.

## 2. Objetivos
- Centralizar dados de campanhas, criativos, gastos, conversões e receitas em um único hub.
- Padronizar KPIs e criar visões úteis para diagnóstico, planejamento e otimização.
- Permitir relatórios e insights com agentes de IA e fluxos de automação.
- Reduzir o trabalho manual de sincronização e conferência por meio de scripts e cron jobs.

## 3. Escopo
- Módulos de campanhas, criativos, relatórios, integrações, orçamento, calendário, tráfego, UTMs e tracking.
- Integrações com Meta Ads, Google Ads e GA4.
- Cálculo e exibição de KPIs essenciais (CPA, ROAS, CTR, CPC, CVR, LTV etc.).
- Painéis e páginas operacionais para acompanhamento diário e tomada de decisão.
- Backoffice técnico com scripts e tarefas de sincronização/auditoria.

## 4. Personas e Casos de Uso
- Gestor de Tráfego: acompanha desempenho, decide otimizações, gera relatórios.
- Analista de Dados: valida qualidade, compara períodos, investiga anomalias, confere KPIs.
- Social/Creativo: consulta criativos, aprova variações, avalia impacto em métricas.
- Operador Técnico: monitora cron jobs, integrações e correções.

## 5. Requisitos Funcionais
- Dashboard consolidado com KPIs e alertas.
- Páginas de Campanhas: lista, detalhes, bibliotecas, filtros e ordenações.
- Páginas de Criativos: listagens, agrupamentos e múltiplas visões (V2/V3/Grouped).
- Relatórios: geração, exportação e insights por IA.
- Integrações: status, configuração, troubleshooting básico.
- Budget: overview, planos e acompanhamento por período.
- Calendar: eventos operacionais e marcos.
- Tracking e UTMs: utilitários, boas práticas e validações.
- GA4, Google Ads, Meta Ads: painéis direcionados para cada integração.
- Centro de Ações (Action Center): tarefas, pendências e recomendações.

## 6. Requisitos Não Funcionais
- Performance: carregamento rápido, consultas eficientes, uso de cache quando possível (Redis).
- Confiabilidade: scripts e cron jobs idempotentes, logs e reprocessamento seguro.
- Segurança: gerenciamento de segredos via Vault/Supabase, criptografia em serviços.
- Observabilidade: logs por serviço (API, Postgres, Edge Functions) e auditorias.
- Escalabilidade: modularidade de serviços e jobs; uso de Edge Functions e PM2.

## 7. Arquitetura
- Frontend: React + Vite + Tailwind com `src/pages`, `src/components` e hooks.
- Backend: Node/TypeScript com rotas em `server/api/*`, serviços em `server/services/*`, configs em `server/config/*`.
- Banco de Dados: Supabase Postgres com `supabase/sql` (schema, views, funções, cron e checks) e `db/migrations`.
- Integrações: scripts em `scripts/` para sincronização e auditoria, Edge Functions em `supabase/functions/*`.
- Infra de Jobs: Cron (`scripts/cron-*.sh`) e PM2 (`scripts/pm2-sync.config.js`).

## 8. Fluxos Principais
1) Sincronização de Campanhas (Meta): cron job dispara scripts; dados chegam ao Postgres; views e funções consolidam; frontend lê via Supabase client.
2) Cálculo de KPIs: dados brutos (custos, cliques, conversões) são transformados em métricas (via `src/lib/kpiCalculations.ts`, `conversionMetrics.ts`, `breakdownMetrics.ts`).
3) Relatórios e Insights: usuário filtra período/campanhas; IA gera observações; exportação opcional.
4) Gestão de Criativos: navegação, agrupamento e comparação por métricas de engajamento/eficiência.
5) Integrações: configuração e verificação de saúde; troubleshooting com scripts.

## 9. Modelo de Dados (alto nível)
- Entidades: contas, campanhas, grupos de anúncios, anúncios/creativos, métricas diárias, custos, conversões, eventos.
- Relacionamentos: campanhas ↔ criativos; métricas por período; integrações por conta/fonte.
- Vistas e Funções: camadas de transformação e agregação (Supabase `02_views.sql`, `04_functions.sql`).

## 10. Integrações
- Meta Ads: leitura de campanhas, custos, métricas; billing; sincronização diária.
- Google Ads: setup e consulta via scripts dedicados.
- GA4: coleta/consulta de eventos e conversões; utilitários de tracking (GTM/UTM).
- Vault/Supabase: segredos e rotinas de segurança.

## 11. KPIs e Métricas
- Principais KPIs: CPA, ROAS, CTR, CPC, CPM, CVR, LTV, Revenue, Spend, Impressions.
- Suporte a breakdowns por período, campanha, criativo, canal.
- Funções de cálculo em `src/lib/*` e views de agregação em `supabase/sql`.

## 12. Segurança e Compliance
- Segredos protegidos via Vault/Supabase; scripts `setup-vault.sql` e `vault-functions.sql`.
- Criptografia de dados sensíveis (`server/services/encryption.ts`).
- RLS/Policies no Postgres conforme necessidade (checar advisors e `99_checks.sql`).
- Logs e auditorias regulares com scripts de verificação.

## 13. Experiência do Usuário
- Interface consistente com Tailwind; componentes `src/components/ui` e `src/components/layout`.
- Navegação clara por módulos (Dashboard, Campanhas, Criativos, Relatórios, Integrações, etc.).
- Feedbacks visuais em carregamentos, toasts (`src/hooks/use-toast.ts`) e estados vazios.

## 14. Implantação e Operações
- Desenvolvimento local: `npm run dev` com Vite e servidor.
- Jobs: PM2 para processos contínuos; cron para execuções programadas.
- Banco: migrations (`db/migrations`), seeds (`db/seeds`), e SQLs do Supabase (`supabase/sql`).
- Monitoramento: logs por serviço, auditorias (`scripts/audit-*`), checagens (`scripts/check-*`).

## 15. Riscos e Mitigações
- Divergência de dados entre fontes: mitigar com auditorias e checks de integridade.
- Quebras em APIs de terceiros: fallback, tolerância a falhas e monitoramento de erro.
- Custos/uniformidade de métricas: normalizar KPIs, documentar fórmulas e validações.
- Segurança credenciais: revisão periódica de Vault, rotação de chaves, least privilege.

## 16. Entregáveis e Macro Cronograma
- Fase 1: Base de KPIs e painéis principais; integrações Meta/GA4 ativas.
- Fase 2: Relatórios avançados, IA insights e automações; Google Ads completo.
- Fase 3: Otimizações de performance, UX refinamentos, cobertura de testes.

## 17. Critérios de Aceite
- KPIs calculados e exibidos corretamente para recortes principais.
- Sincronizações estáveis (diária/semanal/horária) sem erros não tratados.
- Relatórios exportáveis e insights gerados com contexto útil.
- Integrações configuráveis e auditáveis com documentação clara.

## 18. Anexos e Referências
- Documentação: `docs/AMBIENTE-LOCAL.md`, `docs/AUTOMACAO-SYNC.md`, `docs/CAMPAIGN_LIBRARY.md`, `docs/PLANO_CORRECAO_KPIS.md`, `KPI-QUICKSTART.md`, `KPI_METRICS_ANALYSIS.md`, `SETUP-KPI-VIEW.md`, `GUIA-TESTES-KPI.md`, `RELATORIO-FINAL-KPI.md`.
- Scripts e Jobs: `scripts/*`, `supabase/sql/*`, `supabase/functions/*`, `server/*`.
- Páginas e Componentes: `src/pages/*`, `src/components/*`, `src/hooks/*`.

---

Última atualização: gerado automaticamente a partir do estado atual do repositório.
