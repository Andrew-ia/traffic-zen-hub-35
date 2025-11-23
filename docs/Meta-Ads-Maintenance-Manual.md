# Manual de Procedimentos – Manutenção

## Rotinas

- Verificar credenciais Meta em `integration_credentials` (token, `adAccountId`, `pageId`).
- Atualizar `pageId` automaticamente se ausente (já implementado).
- Revisar logs de criação de campanha e corrigir parâmetros inválidos.

## Scripts Úteis

- `npm run verify:meta:create` – verificação ponta-a-ponta dos fluxos.
- `npm run test:meta:flows` – validações rápidas de payloads.
- `npm run sync:meta` – sincronização de campanhas e métricas.

## Troubleshooting

- Erro 100 (Invalid parameter): revisar `destination_type` e `promoted_object.page_id`.
- Leads não direciona ao WhatsApp: confirmar `destination_type=MESSAGING_APP` e permissões do Business.
- Ausência de page: validar ligação da Página ao Ad Account.

## Atualizações

- Revisar notas de versão da Graph API (>= v21) semestralmente.
