# Relatório de Testes – Meta Ads (2025)

## Escopo

- Fluxos cobertos: Engajamento e Leads (WhatsApp).
- Objetivo: evidenciar funcionamento correto após correções.

## Ambiente

- API: `VITE_API_URL` (local `http://localhost:3001`).
- Workspace: `VITE_WORKSPACE_ID`.

## Testes Unitários

- Comando: `npm run test:meta:flows`.
- Resultado esperado:
  - ✅ Engajamento ON_POST + page_id
  - ✅ Leads WhatsApp MESSAGING_APP + page_id
  - ✅ Sales Website + pixel

## Testes de Integração

- Comando: `npm run verify:meta:create`.
- Passos:
  - POST campanha Engajamento com Ad Set `POST_ENGAGEMENT`.
  - POST campanha Leads com destino `MESSAGING_APP` e `MESSAGES`.
- Evidências:
  - Resposta JSON com `success: true` e IDs de campanha/ad sets.
  - Logs em console mostrando payloads e decisões.

## Observações

- Caso as credenciais não tenham `page_id`, o backend tenta recuperar via `me/accounts` e persiste no banco.
- Em ambientes sem acesso ao Graph API, os testes unitários continuam válidos para garantir integridade de payload.
