# Database Foundation

This repository now contains the initial PostgreSQL schema for TrafficPro in `db/migrations/0001_initial.sql`. It establishes the core entities required to support campaign management, assets, audiences, automations, reporting, and integrations.

## Migration Overview

- Multi-tenant structure with `workspaces`, `workspace_members`, and `platform_accounts`.
- Versioned entities for campaigns and audiences, plus storage for creative assets, UTMs, automation rules, bidding strategies, attribution models, and experiments.
- Operational tables for metrics (`performance_metrics`), alerts, leads, reports, budget pacing, webhooks, and data sync orchestration.
- Baseline lookup table `platforms` seeded with the main ad, analytics, CRM, and messaging providers.

## Immediate Next Steps

1. **Migration Tooling**  
   Decide on the runner (e.g. Prisma, Drizzle, Atlas, or a custom Node script) and wire it to apply files in `db/migrations`.

2. **`updated_at` Management**  
   Add triggers or ORM hooks to keep `updated_at` columns in sync on every update.

3. **Secrets Handling**  
   Store integration tokens encrypted (KMS, Vault, or libsodium) before inserting into `workspace_integrations`.

4. **Seeds & Fixtures**  
   Use `db/seeds/0001_sample_data.sql` for a sandbox workspace with campanhas, criativos e métricas fictícias (`node scripts/run-sql.js db/seeds/0001_sample_data.sql`). Expand com datasets adicionais conforme surgirem novas features.

5. **Indexes & Partitioning**  
   Monitor `performance_metrics` growth; plan for partitioning by date/platform and add additional indexes once query patterns are known.

6. **Data Access Layer**  
   Choose an ORM/query builder and generate typed repositories/services for the main entities (campaigns, creatives, automations, metrics).

7. **Sync Pipelines**  
   Implement workers that populate `data_sync_jobs`, update `data_sync_cursors`, and hydrate campaigns/ad sets/metrics from each platform API.

8. **Audit & Compliance**  
   Enhance `activity_logs` with structured metadata and consider retention/archival policies per workspace.

9. **Testing Strategy**  
   Define unit/integration tests around the data layer and set up disposable Postgres instances for CI (Docker or Testcontainers).

10. **Monitoring**  
    Plan health checks and dashboards for budget pacing, automation executions, and sync job status to surface issues early.
