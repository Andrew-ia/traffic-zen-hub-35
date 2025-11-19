# Repository Guidelines

## Project Structure & Module Organization
- Frontend lives in `src` (React + TypeScript). Use `components/` for shared UI, `pages/` for routes, `hooks/` and `services/` for data/logic, and `lib/` for utilities. Global styles: `src/index.css`, `src/App.css`.
- Backend agents and API handlers are in `server/`: `index.ts` boots the server; `agents/`, `api/`, `services/`, `workers/` hold business logic; `config/` centralizes env settings.
- Static assets live in `public/`; builds land in `dist/`.
- Automation sits in `scripts/` (Meta/Google Ads sync, financial imports). Extra guides are in `docs/` and root markdowns.

## Build, Test, and Development Commands
- `npm run dev` — run Vite frontend + API watcher together (needs env loaded).
- `npm run dev:vite` / `npm run dev:api` — run one side only.
- `npm run build` (or `npm run build:dev`) — produce frontend bundle in `dist/`.
- `npm run lint` — ESLint across repo.
- Health: `npm run test:env` for vars; `npm run test:api` for API.
- Sync/data jobs: `npm run sync:meta`, `npm run backfill:meta`, `npm run sync:google`, `npm run sync:meta:incremental`, etc. Before running: `set -a && source .env.local && set +a`.

## Coding Style & Naming Conventions
- TypeScript-first; functional React components with hooks. Prefer 2-space indentation and single quotes.
- Components in `PascalCase`, hooks in `useCamelCase`, helpers in `camelCase`, constants in `SCREAMING_SNAKE_CASE`.
- Keep UI aligned with shadcn-ui + Tailwind utility patterns. Run `npm run lint` before push; follow `eslint.config.js`.

## Testing Guidelines
- Current harness is light: rely on `test:env`, `test:api`, and targeted `scripts/` or `test-*.sh` checks.
- When adding tests, colocate as `*.test.ts` near the code (Jest/Vitest style).
- For data jobs, prefer dry-run/logging first; validate against Supabase staging before production.

## Commit & Pull Request Guidelines
- Match history: short, imperative subjects (`Add detailed logging to Google Ads OAuth callback`), < ~72 chars, scope included when useful.
- Pre-PR: `npm run lint`, `npm run test:env`, `npm run test:api`, and safely exercise touched scripts.
- PRs should explain intent, list key changes, link issues, and note test/log evidence. Add screenshots for UI work; sample payloads/logs for API or job updates.

## Security & Configuration Tips
- Secrets live in `.env.local` (untracked). Key vars: Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), partner APIs (`META_*`, `GOOGLE_*`), and server-only equivalents without `VITE_`.
- Avoid hardcoded workspace/account IDs; pull from env or `server/config`.
- Generated keys (e.g., `npm run generate:encryption-key`) must be stored in the secret manager and rotated if exposed.
