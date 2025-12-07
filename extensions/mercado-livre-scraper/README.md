# Mercado Livre Scraper (Chrome)

Extensão Chrome simples para coletar dados de páginas e resultados de busca do Mercado Livre diretamente do navegador, exportando em JSON.

## O que faz
- Detecta automaticamente se a aba aberta é página de produto ou de resultados de busca.
- Coleta campos principais (título, preço, moeda, vendedor, imagens, disponibilidade, rating, breadcrumbs).
- Na busca, coleta cada card (título, URL, preço, seller/loja oficial, frete, localização, badges e rating quando disponível) e tenta extrair `soldCount` dos cards.
- Novo: formulário “Top da categoria (API pública)” no popup para buscar top 10/20/30/50 por categoria/subcategoria, com filtro de vendas mínimas. Se a API pública falhar, faz fallback usando o scraping da página ativa.
- Exibe o JSON no popup e permite copiar para a área de transferência ou baixar em arquivo.

## Estrutura
- `manifest.json` — definição da extensão (Manifest V3).
- `content.js` — content script que faz o scraping e responde às mensagens.
- `popup.html`, `popup.css`, `popup.js` — UI do popup para disparar o scraping, coletar top de categoria e exportar dados.

## Como usar localmente
1) No Chrome, abra `chrome://extensions` e ative o **Modo do desenvolvedor**.  
2) Clique em **Carregar sem compactação** e selecione `extensions/mercado-livre-scraper` dentro do repositório.  
3) Abra uma página do Mercado Livre (produto ou resultados).  
4) Clique no ícone da extensão e em **Scrapear página**.  
5) Use **Copiar JSON** ou **Baixar JSON** para reutilizar os dados.

### Top da categoria (API pública)
- Use o formulário no popup: informe **Categoria** (ID ML, ex.: `MLB1051`), opcionalmente **Subcategoria**, escolha a quantidade (10/20/30/50) e **Mín. vendas/mês**.  
- A extensão tenta a API pública `sites/MLB/search?sort=best_seller`. Se falhar (403/erro), faz fallback via scraping da página ativa (ordenada por mais vendidos). Certifique-se de que a aba ativa é uma página do Mercado Livre para o fallback funcionar.

## Campos retornados
- Produto: `title`, `price`, `currency`, `availability`, `seller`, `brand`, `rating`, `shipping`, `sold`, `soldCount`, `sku`, `mpn`, `gtin`, `breadcrumbs`, `images`, `pageUrl`.
- Busca: `query`, `total`, `items[]` com `title`, `url`, `price`, `currency`, `seller`, `shipping`, `badge`, `location`, `condition`, `rating`, `soldCount`, `soldText`.
- Top categoria (API): `mode: category_api`, `categoryId`, `minSold`, `limit`, `items[]` com `id`, `title`, `price`, `currency`, `sellerId`, `permalink`, `thumbnail`, `condition`, `domainId`, `soldQuantity`.
- Sempre inclui `ok`, `scrapedAt` e `data.mode` (`product`, `search` ou `category_api`).

## Observações
- A coleta privilegia dados estruturados (`application/ld+json`) quando disponíveis e faz fallback para o DOM.
- O layout do Mercado Livre muda com frequência; se alguma captura falhar, ajuste os seletores em `content.js`.
- Nenhum dado é enviado para servidores externos; tudo roda localmente no navegador.
