import { Request, Response } from 'express';
import { catalogIntelligenceService } from '../../services/catalogIntelligence.service.js';
import { z } from 'zod';

// Schema de validação
const getCatalogIntelligenceSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID é obrigatório')
});

/**
 * GET /api/catalog-intelligence
 * Busca análise de inteligência de catálogo para um workspace
 */
export async function getCatalogIntelligence(req: Request, res: Response) {
  try {
    const { workspaceId } = getCatalogIntelligenceSchema.parse(req.query);
    
    // Buscar token de acesso do MercadoLivre para o workspace
    // Na implementação real, isso viria do banco de dados
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'Token de acesso do MercadoLivre não encontrado',
        details: 'É necessário conectar sua conta do MercadoLivre primeiro',
        suggestions: [
          'Vá para Integrações > MercadoLivre',
          'Clique em "Conectar Conta"',
          'Autorize o acesso à sua conta'
        ]
      });
    }
    
    // Executar análise de catálogo
    const catalogAnalysis = await catalogIntelligenceService.analyzeCatalog(
      workspaceId,
      accessToken
    );
    
    return res.json({
      success: true,
      data: catalogAnalysis,
      message: 'Análise de catálogo realizada com sucesso',
      analyzed_at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Erro na análise de catálogo:', error);
    
    // Tratamento de erros específicos
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Token de acesso inválido ou expirado',
        details: 'Seu token do MercadoLivre pode ter expirado',
        suggestions: [
          'Reconecte sua conta do MercadoLivre',
          'Verifique se as permissões estão corretas',
          'Tente novamente em alguns minutos'
        ]
      });
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        error: 'Permissões insuficientes',
        details: 'Sua conta não tem permissão para acessar os dados necessários',
        suggestions: [
          'Verifique se sua conta do MercadoLivre tem produtos cadastrados',
          'Confirme que você é o proprietário dos produtos',
          'Reconecte com permissões completas'
        ]
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Limite de requisições excedido',
        details: 'Muitas requisições para a API do MercadoLivre',
        suggestions: [
          'Aguarde alguns minutos antes de tentar novamente',
          'Reduza a frequência de análises',
          'Tente em um horário de menor movimento'
        ]
      });
    }
    
    // Erro genérico
    return res.status(500).json({
      error: 'Falha na análise de catálogo',
      details: error.message || 'Erro interno do servidor',
      suggestions: [
        'Verifique sua conexão com o MercadoLivre',
        'Tente novamente em alguns minutos',
        'Contate o suporte se o erro persistir'
      ]
    });
  }
}

/**
 * POST /api/catalog-intelligence/refresh
 * Força atualização dos dados de catálogo
 */
export async function refreshCatalogIntelligence(req: Request, res: Response) {
  try {
    const { workspaceId } = getCatalogIntelligenceSchema.parse(req.body);
    
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'Token de acesso não encontrado'
      });
    }
    
    // Forçar nova análise (sem cache)
    const catalogAnalysis = await catalogIntelligenceService.analyzeCatalog(
      workspaceId,
      accessToken
    );
    
    return res.json({
      success: true,
      data: catalogAnalysis,
      message: 'Dados de catálogo atualizados com sucesso',
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Erro na atualização de catálogo:', error);
    
    return res.status(500).json({
      error: 'Falha na atualização',
      details: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * GET /api/catalog-intelligence/product/:mlbId
 * Busca análise detalhada de um produto específico
 */
export async function getProductCatalogAnalysis(req: Request, res: Response) {
  try {
    const { mlbId } = req.params;
    const { workspaceId } = req.query;
    
    if (!mlbId || !workspaceId) {
      return res.status(400).json({
        error: 'MLB ID e Workspace ID são obrigatórios'
      });
    }
    
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'Token de acesso não encontrado'
      });
    }
    
    // Analisar produto específico
    const catalogAnalysis = await catalogIntelligenceService.analyzeCatalog(
      workspaceId as string,
      accessToken
    );
    
    const productAnalysis = catalogAnalysis.products.find(p => p.mlb_id === mlbId);
    
    if (!productAnalysis) {
      return res.status(404).json({
        error: 'Produto não encontrado',
        details: `Produto ${mlbId} não encontrado na análise de catálogo`
      });
    }
    
    return res.json({
      success: true,
      data: productAnalysis,
      message: 'Análise do produto realizada com sucesso'
    });
    
  } catch (error: any) {
    console.error('Erro na análise do produto:', error);
    
    return res.status(500).json({
      error: 'Falha na análise do produto',
      details: error.message || 'Erro interno do servidor'
    });
  }
}
