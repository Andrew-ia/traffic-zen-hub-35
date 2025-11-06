# Guia Completo: Instagram Graph API (Facebook Login)

Este guia consolida tudo o que você precisa para usar a Instagram Graph API com Facebook Login para contas profissionais (Business e Creator). Cobre pré‑requisitos, autenticação, permissões, App Review, principais endpoints (publicação, comentários, hashtags, menções, insights), limitações, boas práticas, exemplos de requisição e checklists de implementação.

> Importante: A API é destinada apenas a contas profissionais (business/creator) e não oferece acesso a contas de consumidores. Você acessa recursos do Instagram por meio de um usuário do Facebook com papel na Página conectada ao Instagram.

---

## Visão Geral

- Escopo: Gerenciamento de presença para contas profissionais — mídia (leitura/ publicação), comentários, hashtags, menções, e insights.
- Login: Fluxo via Facebook Login (OAuth) com permissões específicas do Instagram e Pages.
- Tokens: A maioria das operações usa `User Access Token` de um usuário do Facebook com papel na `Page` conectada ao `IG User`.
- Acesso: Níveis de acesso (Standard/Advanced) e permissões requerendo Meta App Review e Business Verification para produção.
- Mensagens (DM): Disponível via Instagram Messaging API (requer permissões adicionais e webhooks). Fora do escopo principal deste guia, mas citado nas considerações.

Referências oficiais úteis:
- Instagram Platform overview (Meta Developers)
- Instagram Graph API — Reference e Guides (Meta Developers)

---

## Pré‑requisitos e Configuração

- Conta Instagram profissional (Business ou Creator).
- Página do Facebook conectada ao perfil Instagram.
- App no Meta for Developers com Facebook Login habilitado.
- Usuário do Facebook com papel na Página (Admin, Editor, ou papel com tarefas MANAGE/CREATE_CONTENT/MODERATE).
- Se aplicável, verificação de negócios (Business Verification) e App Review para permissões que exigem Advanced Access.
- 2FA: Se a Página conectada tiver 2FA, o usuário do Facebook que faz a chamada também deve ter 2FA ativada.

---

## Autenticação e Tokens

- Fluxo: Facebook Login (OAuth 2.0) para obter `User Access Token`.
- Tipos de token usados:
  - `User Access Token` do Facebook User com papel adequado na Página conectada ao IG User.
  - Em alguns cenários você também usará `Long-Lived User Access Token` para maior duração.
- Escopo/Permissões comuns:
  - Instagram: `instagram_basic`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_content_publish` (publicação), `instagram_manage_messages` (mensagens)
  - Pages: `pages_read_engagement`, `pages_show_list` (listar páginas), `pages_manage_metadata` (alguns fluxos), `pages_messaging` (mensagens)
  - Business Manager (se papel via BM): `ads_management` ou `ads_read`, e às vezes `business_management` conforme doc específica para algumas chamadas.

Observações importantes:
- Você deve solicitar apenas as permissões realmente necessárias para seu caso de uso.
- Muitas permissões requerem App Review para uso em produção.

---

## App Review e Níveis de Acesso

- Standard Access: leitura básica e operações com menos fricção.
- Advanced Access: insights, publicações e algumas operações sensíveis exigem App Review e, por vezes, Business Verification.
- Dicas:
  - Prepare um screencast claro demonstrando seu caso de uso.
  - Documente como sua app usa cada permissão solicitada.
  - Garanta que as contas de teste (Instagram Professional + Página) estejam prontas e acessíveis.

---

## Limitações e Políticas

- Apenas contas profissionais; sem acesso a contas pessoais.
- Taxas e limites variam por endpoint (consulte rate limits do Graph API).
- Containers de mídia expiram em 24 horas se não forem publicados.
- Hashtags: limite de 30 consultas de hashtags únicas em 7 dias por usuário; até 50 resultados por página; ordenação não garantida.
- Story insights disponíveis por 24 horas.
- Comentários em vídeo ao vivo não são suportados por alguns recursos.
- Menções em Stories não são suportadas nos endpoints de menção.
- Comentários descobertos via Mentions API têm restrições operacionais (ex.: algumas ações só pelo dono do comentário).
- Likes ocultos podem afetar retornos de contagem de likes.

---

## Estrutura de Objetos e Endpoints Principais

### IG User
- `GET /{ig-user-id}` com `fields` para recuperar dados do usuário e expansões.
- Campos típicos: `id`, `username`, contagens e edges como `media`.

### IG Media
- `GET /{ig-media-id}` para um post específico; campos comuns: `id`, `caption`, `media_type` (`IMAGE`, `VIDEO`, `CAROUSEL_ALBUM`, `STORY`), `media_url`, `permalink`, `timestamp`, `username`, `owner`.
- Edge `children` para itens de carrossel.

### Publicação de Conteúdo (Containers e Publish)
- Criar container (imagem):
  - `POST /{ig-user-id}/media?image_url={url}&caption={texto}`
- Criar container (vídeo):
  - `POST /{ig-user-id}/media?media_type=VIDEO&video_url={url}&caption={texto}`
  - Vídeo publishing historicamente requer participação em programa/beta de Content Publishing, consulte doc atual.
- Publicar container:
  - `POST /{ig-user-id}/media_publish?creation_id={ig-container-id}`
- Regras:
  - Container expira em 24h se não publicado.
  - Requer permissões de publicação e tarefas adequadas (MANAGE/CREATE_CONTENT).
  - Se a Página conectada tiver 2FA, o usuário chamador também precisa de 2FA ou a chamada falha.

### Comentários (Moderation)
- Listar comentários de uma mídia:
  - `GET /{ig-media-id}/comments`
  - Retorna comentários de nível superior por padrão; até 50 por página.
- Criar comentário:
  - `POST /{ig-media-id}/comments?message={texto}`
- Responder a comentário:
  - `POST /{ig-comment-id}/replies?message={texto}`
- Ocultar/mostrar comentário:
  - `POST /{ig-comment-id}?hide=true|false`
- Observações:
  - Algumas operações exigem que o solicitante seja dono do objeto onde o comentário foi feito.
  - Comentários em conteúdos ao vivo podem ser limitados.

### Hashtags
- Buscar ID de hashtag:
  - Root edge `ig_hashtag_search?user_id={ig-user-id}&q={hashtag}`
- Mídias recentes por hashtag (últimas 24h):
  - `GET /{ig-hashtag-id}/recent_media?user_id={ig-user-id}&fields=...`
- Mídias populares por hashtag:
  - `GET /{ig-hashtag-id}/top_media?user_id={ig-user-id}&fields=...`
- Campos úteis: `caption`, `media_type`, `comments_count`, `like_count`, `permalink`, `timestamp`.
- Limites: até 50 resultados por página; 30 hashtags únicas em 7 dias; ordenação não garantida.

### Menções
- Mídia em que o IG User foi mencionado (legenda):
  - `GET /{ig-user-id}?fields=mentioned_media.media_id({media-id}){fields}`
  - Retorna dados da mídia onde o usuário foi @mencionado na legenda por outro usuário.
  - Limitações: menções em Stories não são suportadas; texto pode retornar sem o símbolo `@` quando o app user não criou a mídia.
- Comentários onde IG User foi mencionado:
  - `GET /{ig-user-id}?fields=mentioned_comment.comment_id({comment-id}){fields}`
  - Observe restrições: operações sobre comentários descobertos via Mentions podem ser limitadas; apenas o dono do comentário pode executar certas ações.

### Insights
- Insights do usuário:
  - `GET /{ig-user-id}/insights?metric={...}&period={...}`
  - Métricas variam por versão; exemplos: alcance, impressões (podem ser deprecadas), views, engajamento, cliques em site, contatos.
  - Parâmetros de janela (`since`, `until`), e períodos como `day`, `week`, `days_28`.
  - Limitações: latência de até 48h nos dados; métricas orgânicas vs pagas; algumas métricas exigem alto número de seguidores; dados demográficos retornam top performers.
- Insights de mídia:
  - `GET /{ig-media-id}/insights?metric={...}`
  - Story insights apenas por 24h; album child media não tem insights agregados.
  - Métricas com valores muito baixos (ex.: <5 para Stories) podem retornar erro por privacidade.

### Webhooks (Instagram)
- Eventos: comentários, menções, mídia publicada, e updates de insights de Stories.
- Setup: assinar tópicos relevantes, validar endpoint (challenge) e processar payloads.
- Inclui IDs necessários para correlacionar `mentioned_media`/`mentioned_comment`.

---

## Permissões por Funcionalidade (Checklist)

- Perfil e mídia básica: `instagram_basic`, `pages_read_engagement`
- Comentários (listar/criar/ocultar/responder): `instagram_manage_comments`, `pages_read_engagement`
- Publicação de conteúdo: `instagram_content_publish`, `pages_read_engagement` (+ tarefas MANAGE/CREATE_CONTENT)
- Hashtags: `instagram_basic` e, se papel via Business Manager, um de `ads_management` ou `ads_read` (conforme doc)
- Menções: `instagram_basic`, `instagram_manage_comments`, `pages_read_engagement` (+ possivelmente `ads_*` se papel via BM)
- Insights: `instagram_manage_insights`, `pages_read_engagement` (+ outros associados)
- Mensagens (DM): `instagram_manage_messages`, `pages_messaging`, Webhooks de mensagens

Observação: Permissões podem variar por versão. Consulte sempre a documentação atual da Meta para sua versão do Graph API.

---

## Boas Práticas

- Solicite apenas permissões necessárias, com descrições detalhadas para App Review.
- Use tokens de longa duração em produção e rotacione periodicamente.
- Implemente backoff e retries para rate limiting.
- Valide 2FA quando a Página conectada exigir.
- Use Webhooks para reações em tempo real (comentários, menções, story insights) e reduza polling.
- Respeite políticas de privacidade; não armazene dados além do necessário.

---

## Exemplos de Requisições

Use `v{versão}` atual do Graph API, por exemplo `v24.0`.

### Buscar mídia mencionada

```bash
curl -X GET \
  'https://graph.facebook.com/v24.0/17841405309211844?fields=mentioned_media.media_id(17873440459141021){caption,media_type}&access_token=IGQVJ...'
```

Resposta simplificada:

```json
{
  "mentioned_media": {
    "caption": "metricsaurus headquarters!",
    "media_type": "IMAGE",
    "id": "17873440459141021"
  },
  "id": "17841405309211844"
}
```

### Criar container de imagem

```bash
curl -X POST \
  'https://graph.facebook.com/v24.0/{ig-user-id}/media' \
  -d 'image_url=https://www.example.com/image.jpg' \
  -d 'caption=Legenda de exemplo' \
  -d 'access_token={user-access-token}'
```

### Publicar container

```bash
curl -X POST \
  'https://graph.facebook.com/v24.0/{ig-user-id}/media_publish' \
  -d 'creation_id={ig-container-id}' \
  -d 'access_token={user-access-token}'
```

### Listar comentários de uma mídia

```bash
curl -X GET \
  'https://graph.facebook.com/v24.0/{ig-media-id}/comments?access_token={user-access-token}'
```

### Responder a um comentário

```bash
curl -X POST \
  'https://graph.facebook.com/v24.0/{ig-comment-id}/replies' \
  -d 'message=Obrigado!' \
  -d 'access_token={user-access-token}'
```

### Buscar hashtag ID

```bash
curl -X GET \
  'https://graph.facebook.com/v24.0/ig_hashtag_search?user_id={ig-user-id}&q=maratona&access_token={user-access-token}'
```

### Mídias recentes por hashtag

```bash
curl -X GET \
  'https://graph.facebook.com/v24.0/{ig-hashtag-id}/recent_media?user_id={ig-user-id}&fields=caption,media_type,permalink,timestamp&access_token={user-access-token}'
```

### Insights de usuário

```bash
curl -X GET \
  'https://graph.facebook.com/v24.0/{ig-user-id}/insights?metric=reach,profile_views&period=week&access_token={user-access-token}'
```

---

## Fluxos Comuns (Passo a Passo)

### 1) Login e Descoberta
- Oriente o usuário a fazer Facebook Login e aceite os escopos solicitados.
- Liste páginas com `pages_show_list`.
- Identifique a Página conectada ao IG e obtenha o `ig-user-id` via edges apropriados (ex.: através do Page/Instagram connection edge na doc atual).

### 2) Publicação de Mídia
- Criar container com URL público da imagem/vídeo.
- Aguardar processamento de container (opcionalmente consultar status).
- Publicar com `media_publish` dentro de 24h.

### 3) Moderação de Comentários
- Consuma Webhooks de comentários.
- Liste comentários, responda, e modere (hide/unhide) conforme políticas.

### 4) Hashtag Ops
- Obtenha `ig-hashtag-id` via `ig_hashtag_search`.
- Consulte `recent_media` / `top_media` com paginação.

### 5) Insights e Relatórios
- Agende coletas de `user` e `media` insights.
- Respeite janelas temporais e latências; use webhooks para Stories.

---

## Erros Comuns e Diagnóstico

- 2FA ausente quando a Página conectada exige: chamadas falham até o usuário ativar 2FA.
- Permissões insuficientes: erros de permission; valide escopos e App Review.
- Token curto expira: use Long-Lived tokens em produção.
- Hashtag limits: excesso de consultas únicas bloqueia por 7 dias.
- Insighs com latência: aguarde até 48h; não confundir com dados "faltando".

---

## Referências

Algumas páginas da documentação podem estar em transição de versão; use sempre a versão atual do Graph API nas URLs (`vXX.X`) e consulte a navegação oficial. Exemplos úteis:

- Menções — Mídia mencionada:
  - `GET /{ig-user-id}?fields=mentioned_media.media_id({media-id}){fields}`
  - Observações de campos e limitações (menções em Stories não suportadas; remoção de `@` em legendas dependendo do criador da mídia). Fonte: Meta Developers (Instagram API Reference: Mídia mencionada).

- Publicação de conteúdo (containers e publish) e requisitos de 2FA/tarefas: Meta Developers (Instagram Graph API Guides/Reference).

- Hashtags (`ig_hashtag_search`, `recent_media`, `top_media`) — limites e campos: Meta Developers (Instagram Graph API Reference).

- Insights de usuário e mídia — métricas, períodos, limitações: Meta Developers (Instagram Graph API Reference).

---

## Checklist Final de Implementação

- Criar app no Meta Developers e habilitar Facebook Login.
- Converter conta Instagram para profissional e conectar à Página.
- Implementar OAuth e guardar `User Access Token`.
- Solicitar apenas permissões necessárias; preparar App Review.
- Implementar publicações via containers + publish; tratar expiração.
- Implementar moderação de comentários e respostas.
- Implementar buscas de hashtags e paginação.
- Assinar Webhooks de IG para comentários/menções/insights de Stories.
- Implementar coleta de insights e relatórios periódicos.
- Adotar práticas de segurança (rotação de tokens, 2FA quando exigida, rate limiting, privacidade).

---

## Observação de Versões

A Meta atualiza periodicamente o Graph API (ex.: v24.0). Ajuste suas chamadas para a versão mais recente e valide campos/permissões, pois métricas e nomes de permissões podem ser introduzidos/deprecados.

