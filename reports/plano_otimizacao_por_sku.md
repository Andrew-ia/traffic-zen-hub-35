# Plano de Otimizacao por SKU (Full)

Base: relatorio `reports/ml_full_sem_venda.csv` (Full, 0 vendas nos ultimos 30 dias) com dados de 25/01/2026.

## Estrategia de teste de preco (sequencial)
- Mercado Livre nao permite A/B formal; usar teste sequencial por janela.
- Janela recomendada: 7 dias OU 100 visitas (o que vier primeiro).
- Se 0 vendas na janela, avancar para o proximo nivel.
- Se vender, manter o preco vencedor por 14 dias e revisar.

Niveis sugeridos (por padrao):
- T1: -7%
- T2: -12%
- T3: -15% (somente se ainda zerado e margem permitir)

## Prioridade e plano por SKU

### Prioridade A (alto trafego, 0 vendas)
Objetivo: melhorar conversao rapidamente (preco + foto/titulo + oferta).

SKU 153 | MLB6064788810 | Kit Colar E Brinco Nossa Sra De Aparecida Prateado Redondo
- Diagnostico: 76 visitas / 0 vendas, estoque 4.
- Teste de preco: 49.90 -> T1 46.41 -> T2 43.91 -> T3 42.42.
- Checklist foco: foto principal, promessa no titulo, prova social e detalhes do kit.
- Acao extra: criar variação/kit com 2 unidades e comparar conversao.

SKU 65 | MLB5534562594 | Bolsa Feminina Alca De Mao E Transversal
- Diagnostico: 61 visitas / 0 vendas, estoque 2.
- Teste de preco: 39.90 -> T1 37.11 -> T2 35.11 -> T3 33.92.
- Checklist foco: fotos com modelo + escala, medidas claras no titulo/descricao.
- Acao extra: destacar material/forro e compartimentos no titulo/primeira imagem.

### Prioridade B (trafego medio, 0 vendas)
Objetivo: melhorar conversao e elevar visitas com SEO simples.

SKU 109 | MLB4339378621 | Pulseira Bracelete Feminino Achatado Prateado
- Diagnostico: 27 visitas / 0 vendas, estoque 12, ultima venda 18/12/2025.
- Teste de preco: 28.40 -> T1 26.41 -> T2 24.99 -> T3 24.14.
- Checklist foco: close-ups do acabamento, destaque do material e tamanho.

SKU 43 | MLB4150853641 | Anel Escultural Organico Feminino Prateado Design Moderno
- Diagnostico: 34 visitas / 0 vendas, estoque 5.
- Teste de preco: 28.78 -> T1 26.77 -> T2 25.33 -> T3 24.46.
- Checklist foco: fotos macro + foto no dedo, descricao do tamanho/aro.

### Prioridade C (baixo trafego, 0 vendas)
Objetivo: aumentar visibilidade (SEO + atributos) antes de forcar preco.

SKU 131 | MLB6032808890 | Brinco Argola Tripla Prateada
- Diagnostico: 9 visitas / 0 vendas, estoque 11.
- Teste de preco: 28.78 -> T1 26.77 -> T2 25.33 -> T3 24.46.
- Checklist foco: titulo com "argola tripla" + material + tamanho, fotos laterais.
- Acao extra: 1 campanha leve de Mercado Ads por 7 dias.

SKU 31 | MLB4136248839 | Bolsa Feminina Alca Cetim Ombro Tranversal Lisa
- Diagnostico: 17 visitas / 0 vendas, estoque 5.
- Teste de preco: 58.90 -> T1 54.78 -> T2 51.83 -> T3 50.07.
- Checklist foco: fotos uso real + medidas (altura/largura) e tipo de fecho.
- Acao extra: reforcar beneficio de uso (casual/festa) no titulo.

## Checklist de anuncio (padrao)

1) Titulo
- 60-65 caracteres, com palavra-chave principal + material + beneficio.
- Evitar excesso de maiusculas e termos repetidos.

2) Fotos
- 8+ imagens, 1a com fundo branco e produto centralizado.
- 1 imagem de escala (uso real/modelo).
- 1 imagem de detalhe (acabamento/fecho/banho).
- Padronizar iluminacao e cor real do produto.

3) Atributos
- Preencher 100% dos atributos obrigatorios.
- Conferir categoria correta (impacta busca e filtros).

4) Variacoes
- Se houver tamanhos/cores, usar variacoes (reduz friccao).

5) Descricao
- 5-7 bullets com beneficios, materiais, medidas, garantia e prazo.
- Incluir instrucoes de cuidado/manutencao.

6) Prova e confianca
- Responder perguntas em < 1h quando possivel.
- Incentivar avaliacao no pos-venda.

7) Promocoes e kits
- Criar kit com 2 unidades ou combo com best-sellers.

8) Ads (Mercado Ads)
- Prioridade para SKUs com visitas > 50 e 0 vendas.
- Se 7 dias com clicks e 0 vendas, pausar e revisar anuncio.

## Medicao e decisao
- Indicador principal: conversao = vendas / visitas.
- Se conversao < 0.7% apos 100 visitas, revisar anuncio ou pausar.
- Se venda ocorrer, manter preco vencedor por 14 dias e escalar estoque.
