# Traffic Pro ML Assistant

Extensao Chrome assistida para apoiar a pesquisa manual no Mercado Livre sem fazer scraping agressivo nem consultas em massa.

## Como funciona
- Voce abre normalmente uma pagina do Mercado Livre.
- A extensao le apenas o que esta visivel na aba atual:
  - pagina de produto
  - listagem de busca/categoria
- O popup mostra um resumo do contexto atual.
- A extensao tambem injeta um painel lateral discreto na propria pagina do Mercado Livre.
- A partir dele, voce pode:
  - abrir a analise do anuncio no Traffic Pro
  - abrir a pagina `Pesquisa de Mercado`
  - salvar candidatos para revisar depois

## O que a extensao NAO faz
- nao varre paginas em massa
- nao abre navegacao automatica no Mercado Livre
- nao usa endpoints publicos do Mercado Livre pela extensao
- nao tenta burlar bloqueio, captcha ou limitacao de conta

## Estrutura
- `manifest.json` - definicao da extensao
- `content.js` - le o DOM da pagina ja aberta pelo usuario
- `popup.html`, `popup.css`, `popup.js` - painel da extensao

## Dados lidos da aba atual

### Pagina de produto
- `MLB`
- titulo
- preco
- vendedor
- frete
- vendidos
- flags como `full`, `frete gratis` e `loja oficial` quando aparecerem na pagina

### Busca/listagem
- itens visiveis
- `MLB`
- titulo
- preco
- vendedor
- frete
- vendidos no card, quando visivel
- badges do anuncio

## Como usar localmente
1. Abra `chrome://extensions`.
2. Ative o `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `extensions/mercado-livre-scraper`.
5. Abra uma pagina do Mercado Livre.
6. Clique no icone da extensao.
7. Se quiser, use `Abrir painel lateral` no popup ou o botao flutuante `TP` na pagina.

## Fluxo recomendado
1. Pesquise manualmente no Mercado Livre.
2. Abra a extensao na listagem.
3. Salve os itens visiveis que chamarem atencao.
4. Abra a analise do Traffic Pro para os `MLBs` mais promissores.
5. Use a `Pesquisa de Mercado` da plataforma para aprofundar.

## Observacoes
- O layout do Mercado Livre muda com frequencia. Se algum campo deixar de aparecer, ajuste os seletores em `content.js`.
- A extensao foi desenhada para ser assistiva e segura para a conta, nao para automacao pesada.
