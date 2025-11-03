# 🎨 Gerador de Criativos com IA - Guia Completo

**Data:** 03 de Novembro de 2025
**Status:** ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Funciona](#como-funciona)
3. [Como Usar](#como-usar)
4. [Arquitetura Técnica](#arquitetura-técnica)
5. [Próximos Passos](#próximos-passos)

---

## 🎯 Visão Geral

O **Gerador de Criativos com IA** permite criar imagens profissionais para suas campanhas de tráfego pago usando inteligência artificial do **Google Gemini**.

### Recursos

- ✅ **Geração via prompt de texto**
- ✅ **Múltiplos formatos** (1:1, 9:16, 16:9, 4:5)
- ✅ **Integração com Creative Library**
- ✅ **Tags automáticas**
- ✅ **Salvamento no Supabase**
- ⏳ **Upload de imagens** (em desenvolvimento)

---

## 🚀 Como Funciona

### Fluxo de Trabalho

```
1. Usuário descreve o criativo
   ↓
2. Seleciona formatos desejados (1:1, 9:16, etc.)
   ↓
3. Adiciona tags (opcional)
   ↓
4. Clica em "Gerar"
   ↓
5. Gemini AI processa o prompt
   ↓
6. Criativos são salvos na biblioteca
   ↓
7. Prontos para usar em campanhas
```

### Tecnologias

- **Frontend:** React + TypeScript
- **Backend:** Express.js
- **IA:** Google Gemini 1.5 Flash
- **Storage:** Supabase
- **UI:** shadcn/ui + Tailwind CSS

---

## 📖 Como Usar

### 1. Acessar o Gerador

**Opção A - Via Página de Criativos:**
```
1. Navegue para: Criativos > Creative Library
2. Clique no botão "✨ Gerar com IA"
3. O diálogo será aberto
```

**Opção B - Usar Componente Diretamente:**
```tsx
import { AIGeneratorDialog } from '@/components/AIGeneratorDialog';

<AIGeneratorDialog
  workspaceId="seu-workspace-id"
  folderId="pasta-opcional"
  onGenerated={(assets) => console.log('Gerados:', assets)}
/>
```

### 2. Escrever um Bom Prompt

**Estrutura Recomendada:**
```
[Produto/Tema] + [Estilo] + [Cores] + [Mood] + [Ocasião]
```

**Exemplos Efetivos:**

✅ **Bom Prompt:**
> "Uma imagem de smartphone moderno com fundo minimalista azul gradient, estilo profissional e clean, cores vibrantes, para campanha de Black Friday de tecnologia"

✅ **Bom Prompt:**
> "Produto de skincare com fundo rosa pastel, iluminação suave, estilo premium e luxuoso, perfeito para feed do Instagram"

✅ **Bom Prompt:**
> "Banner promocional com desconto 50% OFF em destaque, fundo amarelo vibrante, texto em negrito, estilo urgente para stories"

❌ **Prompt Vago:**
> "Uma imagem bonita"

### 3. Selecionar Formatos

**Formatos Disponíveis:**

| Formato | Dimensões | Uso Ideal |
|---------|-----------|-----------|
| **1:1** | 1080x1080 | Feed Instagram/Facebook (quadrado) |
| **9:16** | 1080x1920 | Stories/Reels (vertical) |
| **16:9** | 1920x1080 | YouTube/Feed Horizontal |
| **4:5** | 1080x1350 | Feed Instagram (retrato) |

**Dica:** Selecione múltiplos formatos para gerar variações automaticamente!

### 4. Adicionar Tags (Opcional)

Organize seus criativos com tags:
```
Black Friday, Produto X, UGC, Testimonial
```

Separe por vírgula. As tags serão criadas automaticamente se não existirem.

### 5. Gerar e Aguardar

- Clique em "🎨 Gerar X Criativo(s)"
- Aguarde o processamento (5-15 segundos)
- Os criativos aparecerão na biblioteca automaticamente

---

## 🏗️ Arquitetura Técnica

### Estrutura de Arquivos

```
traffic-zen-hub-35/
├── server/
│   ├── api/
│   │   └── ai/
│   │       └── generate-creative.ts     # Endpoint da API
│   ├── services/
│   │   └── geminiService.ts             # Serviço Gemini
│   └── index.ts                         # Registro de rotas
├── src/
│   └── components/
│       ├── AICreativeGenerator.tsx      # Componente principal
│       └── AIGeneratorDialog.tsx        # Dialog wrapper
└── .env.local                           # API Keys
```

### Endpoint da API

**POST** `/api/ai/generate-creative`

**Request Body:**
```json
{
  "prompt": "Descrição do criativo",
  "workspaceId": "uuid",
  "folderId": "uuid (opcional)",
  "tags": ["tag1", "tag2"],
  "aspectRatios": ["1:1", "9:16", "16:9"],
  "numVariations": 1
}
```

**Response:**
```json
{
  "success": true,
  "assets": [
    {
      "id": "uuid",
      "name": "AI Generated - ...",
      "aspect_ratio": "1:1",
      "dimensions": { "width": 1080, "height": 1080 },
      "workspace_id": "uuid",
      "created_at": "2025-11-03T..."
    }
  ],
  "message": "Generated 3 creative variations"
}
```

### Banco de Dados

Os criativos são salvos em:
- **Tabela:** `creative_assets`
- **Campos:**
  - `id`, `workspace_id`, `folder_id`
  - `name`, `type`, `status`
  - `aspect_ratio`, `text_content`
  - `storage_url`, `thumbnail_url`
  - `created_at`, `updated_at`

### Variáveis de Ambiente

**Necessárias:**
```bash
# .env.local
GEMINI_API_KEY=AIzaSy...
VITE_GEMINI_API_KEY=AIzaSy...  # Para frontend
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 🔮 Próximos Passos

### Fase 1 - Geração de Imagem Real (Próxima)

Atualmente o Gemini 1.5 Flash gera **texto descritivo**. Para gerar imagens reais:

**Opção A - Usar Imagen API (Google)**
```typescript
import { ImagenClient } from '@google-cloud/imagen';

const client = new ImagenClient();
const [image] = await client.generateImages({
  prompt: enhancedPrompt,
  numberOfImages: 1,
  imageSize: '1024x1024'
});
```

**Opção B - Usar DALL-E 3 (OpenAI)**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.images.generate({
  model: "dall-e-3",
  prompt: prompt,
  n: 1,
  size: "1024x1024"
});
```

**Opção C - Usar Stable Diffusion (Stability AI)**
```typescript
import Replicate from 'replicate';

const replicate = new Replicate();
const output = await replicate.run(
  "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  { input: { prompt } }
);
```

### Fase 2 - Upload para Supabase Storage

```typescript
// Upload image to Supabase Storage
const { data, error } = await supabase.storage
  .from('creatives')
  .upload(`${workspaceId}/${assetId}.png`, imageBuffer, {
    contentType: 'image/png',
    cacheControl: '3600',
  });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('creatives')
  .getPublicUrl(`${workspaceId}/${assetId}.png`);
```

### Fase 3 - Geração de Variantes

```typescript
// Auto-generate size variants
for (const ratio of ['1:1', '9:16', '16:9']) {
  const resized = await sharp(imageBuffer)
    .resize(dimensions[ratio].width, dimensions[ratio].height)
    .toBuffer();

  await supabase.from('creative_variants').insert({
    creative_asset_id: assetId,
    variant_name: ratio,
    aspect_ratio: ratio,
    storage_url: uploadedUrl,
    ...dimensions[ratio]
  });
}
```

### Fase 4 - Melhorias Avançadas

1. **Histórico de Gerações**
   - Salvar prompts e resultados
   - Re-gerar com ajustes

2. **Templates de Prompt**
   - Prompts pré-configurados por objetivo
   - "Black Friday", "Lançamento", "Testimonial"

3. **Batch Generation**
   - Gerar múltiplos criativos de uma vez
   - Fila de processamento

4. **A/B Testing Automático**
   - Gerar variações do mesmo criativo
   - Testar automaticamente

5. **Performance Tracking**
   - Conectar criativos AI com métricas
   - Identificar quais prompts performam melhor

---

## 🎓 Dicas de Uso

### Para Melhores Resultados

1. **Seja Específico:** Quanto mais detalhes, melhor o resultado
2. **Use Referências:** Mencione estilos conhecidos ("estilo Apple", "minimalista")
3. **Descreva Cores:** Cores específicas geram resultados mais consistentes
4. **Indique Uso:** "para stories", "para feed" ajuda o AI a otimizar
5. **Teste Variações:** Gere múltiplos formatos e teste performance

### Palavras-Chave Efetivas

**Estilo:**
- Profissional, moderno, minimalista, clean, luxuoso, premium
- Vintage, retrô, futurista, corporativo, casual

**Mood:**
- Alegre, vibrante, calmo, sério, urgente, exclusivo
- Amigável, confiável, inovador, tradicional

**Cores:**
- Azul corporativo, rosa pastel, amarelo vibrante
- Gradient suave, monocromático, cores saturadas

**Composição:**
- Centralizado, assimétrico, com espaço negativo
- Fundo desfocado, iluminação natural, close-up

---

## 📚 Recursos Adicionais

**Documentação Gemini:**
- https://ai.google.dev/docs

**Melhores Práticas de Prompts:**
- https://ai.google.dev/docs/prompt_best_practices

**Exemplos de Criativos:**
- https://ads.google.com/home/resources/

---

## ✅ Status da Implementação

| Funcionalidade | Status | Notas |
|----------------|--------|-------|
| Configuração Gemini API | ✅ | API key configurada |
| Endpoint de geração | ✅ | `/api/ai/generate-creative` |
| Componente UI | ✅ | `AICreativeGenerator.tsx` |
| Dialog wrapper | ✅ | `AIGeneratorDialog.tsx` |
| Salvamento no DB | ✅ | Tabela `creative_assets` |
| Suporte múltiplos formatos | ✅ | 1:1, 9:16, 16:9, 4:5 |
| Sistema de tags | ✅ | Auto-criação de tags |
| Geração de imagem real | ⏳ | Próxima fase |
| Upload Supabase Storage | ⏳ | Próxima fase |
| Variantes automáticas | ⏳ | Próxima fase |

---

**Implementado em:** 03/11/2025
**Próxima atualização:** Integração com Imagen API para geração real de imagens
