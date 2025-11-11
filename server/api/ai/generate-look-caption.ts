import type { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPool } from '../../config/database.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate a caption for a Virtual Try-On look using OpenAI GPT-4
 */
export async function generateLookCaption(req: Request, res: Response) {
  try {
    const { folderId, folderName, modelName, clothingName, imageUrl, brandName = 'Vermezzo' } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required to analyze the generated look',
      });
    }

    console.log(`🤖 Generating caption for look with vision analysis`);

    // Create prompt for OpenAI Vision
    const prompt = `Você é um especialista em copywriting para moda e redes sociais, especializado em vender roupas femininas.

Analise a ROUPA que está sendo vestida nesta imagem e crie uma legenda ATRAENTE e VENDEDORA para um post de Instagram da marca "${brandName}".

CONTEXTO IMPORTANTE:
- O FOCO PRINCIPAL deve ser na ROUPA/PEÇA que está sendo vendida
- A modelo é apenas para mostrar como a roupa fica vestida
- Descreva as características, caimento e estilo da ROUPA
- Crie desejo de comprar essa PEÇA específica

INSTRUÇÕES OBRIGATÓRIAS:
1. COMECE falando DIRETAMENTE sobre a ROUPA (não sobre a modelo)
2. Descreva o ESTILO, CAIMENTO e VERSATILIDADE da peça
3. Use um tom casual, elegante e moderno
4. Destaque conforto, elegância e ocasiões de uso da ROUPA
5. Use emojis estrategicamente (2-4 no máximo)
6. Foque em criar DESEJO de comprar essa PEÇA
7. Inclua call-to-action forte no final
8. Seja específico sobre a ROUPA, não genérico

FORMATO ESPERADO:
✨ [Nome da Peça/Roupa - Ex: "Blusa Azul Verão", "Conjunto Elegante"] ✨

[Parágrafo 1: Descreva a ROUPA - seu estilo, caimento, detalhes especiais]

[Parágrafo 2: Benefícios e versatilidade da PEÇA - como usar, com o que combinar]

👉 Perfeita para: [Ocasiões específicas onde essa ROUPA brilha]
✨ Dica de styling: [Como combinar essa PEÇA]

🛍️ Disponível na ${brandName}
📍 Loja física e online
💬 [Call-to-action forte focada na COMPRA da peça]

ERROS A EVITAR:
❌ NÃO fale sobre "a modelo está linda" ou "o look completo"
❌ NÃO invente cores, tecidos ou preços específicos
❌ NÃO use mais de 4 emojis no total
✅ FOQUE na ROUPA como produto a ser vendido
✅ Seja ESPECÍFICO sobre a peça, não genérico`;


    // Call OpenAI API with Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Modelo com visão para analisar a imagem
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em copywriting para moda e redes sociais, especializado em criar legendas que convertem visualizações em vendas.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high', // Alta qualidade para analisar detalhes da roupa
              },
            },
          ],
        },
      ],
      temperature: 0.8, // Criatividade moderada
      max_tokens: 500,
    });

    const caption = completion.choices[0]?.message?.content;

    if (!caption) {
      throw new Error('Failed to generate caption');
    }

    console.log(`✅ Caption generated successfully (${caption.length} chars)`);

    // If folderId is provided, update all images in that folder with the caption
    if (folderId) {
      const pool = getPool();

      // Find all images in this folder and update their metadata
      const updateResult = await pool.query(
        `
        UPDATE creative_assets
        SET metadata = jsonb_set(
          metadata,
          '{caption}',
          $1::jsonb,
          true
        ),
        updated_at = now()
        WHERE (metadata->>'folderName')::text = $2
          OR (
            (metadata->>'modelName')::text = $3
            AND (metadata->>'clothingName')::text = $4
          )
          AND (metadata->>'source')::text = 'virtual-tryon'
          AND status = 'active'
        RETURNING id
        `,
        [JSON.stringify(caption), folderName, modelName, clothingName]
      );

      console.log(`✅ Updated ${updateResult.rows.length} images with caption`);
    }

    return res.json({
      success: true,
      caption,
      metadata: {
        model: completion.model,
        tokens: completion.usage?.total_tokens,
      },
    });
  } catch (error: any) {
    console.error('❌ Error generating look caption:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate caption',
    });
  }
}

/**
 * Update caption for a specific creative
 */
export async function updateCreativeCaption(req: Request, res: Response) {
  try {
    const { creativeId } = req.params;
    const { caption, workspaceId } = req.body;

    if (!creativeId || !caption || !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Creative ID, caption, and workspace ID are required',
      });
    }

    const pool = getPool();

    const result = await pool.query(
      `
      UPDATE creative_assets
      SET metadata = jsonb_set(
        metadata,
        '{caption}',
        $1::jsonb,
        true
      ),
      updated_at = now()
      WHERE id = $2
        AND workspace_id = $3
        AND status = 'active'
      RETURNING id, name
      `,
      [JSON.stringify(caption), creativeId, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creative not found',
      });
    }

    return res.json({
      success: true,
      message: 'Caption updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Error updating caption:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update caption',
    });
  }
}
