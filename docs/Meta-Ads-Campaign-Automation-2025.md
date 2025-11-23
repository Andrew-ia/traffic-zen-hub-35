# Meta Ads – Automação de Criação de Campanhas (2025)

## Visão Geral

Automação completa de criação de campanhas para dois fluxos: Engajamento e Leads. Implementa configuração automática de destino de conversão, validações de parâmetros obrigatórios, integração com API do Meta Ads v21, logs detalhados e testes automatizados.

## Erros Identificados

1) Engajamento: Invalid parameter (code 100) ao criar Ad Set com `conversion_location` inadequado.
2) Leads: Parâmetros de destino incompatíveis com WhatsApp quando objetivo é `OUTCOME_LEADS`.

## Soluções

Engajamento
- Solução A: Remover `conversion_location` do Ad Set e usar `destination_type=ON_POST` com `promoted_object.page_id`.
- Solução B: Forçar `engagement_type=post_engagement` na campanha e validar presença de `page_id` antes do POST.

Leads (WhatsApp)
- Solução A: Definir `destination_type=MESSAGING_APP` e `optimization_goal=MESSAGES` com `promoted_object.page_id`.
- Solução B: Validações rígidas de `MESSAGING_APP` + `page_id` e fallback seguro para `WEBSITE` apenas quando necessário.

## Implementação

- Backend: `server/api/integrations/meta/create-campaign.ts`
  - Engajamento: payload sem `conversion_location`; `ON_POST` + `page_id`.
  - Leads: `MESSAGING_APP` + `MESSAGES` + `page_id`.
  - Export de `validateMetaPayload` para testes.

- Frontend: `src/pages/CreateMetaCampaign.tsx`
  - Destino automático: Engajamento → Instagram/Facebook via plataformas; Leads → WhatsApp.
  - Ajuste de `optimization_goal` para `MESSAGES` em Leads.

## Validações

- Engajamento: Proíbe `pixel_id/custom_event_type`; exige `promoted_object.page_id`.
- Messaging: Exige `promoted_object.page_id`.
- Leads (WhatsApp): Exige `MESSAGING_APP` + `page_id`.
- Sales (Website): recomenda `pixel_id`.

## Logs

- Logs de decisão e payload enviados em cada POST.
- Tratamento de erros com `code` e `error_subcode` do Graph API.

## Testes

- Unitário: `npm run test:meta:flows` valida combinações via `validateMetaPayload`.
- Integração: `npm run verify:meta:create` chama o endpoint e verifica respostas.

## Conformidade (2025)

- Uso da Graph API v21.
- Campos compatíveis com objetivos `OUTCOME_ENGAGEMENT` e `OUTCOME_LEADS` conforme exigências atuais.

## Arquivos Alterados/Adicionados

- `server/api/integrations/meta/create-campaign.ts`
- `src/pages/CreateMetaCampaign.tsx`
- `scripts/tests/validate-meta-flows.ts`
- `scripts/meta/verify-create-flows.ts`
- `package.json`

## Próximos Passos

- Configurar `page_id` nas credenciais do workspace (já automatizado quando ausente).
- Validar número do WhatsApp no Business Manager se exigido pelo caso de uso.
