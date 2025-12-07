/**
 * Script de teste para validar análise de IA
 * Testa: Anti-alucinação, dados reais, tratamento de erros
 */

const MLB_ID = 'MLB1953787779'; // Anel folheado dourado real

// Dados simulados de análise (baseado na estrutura real)
const mockAnalysisData = {
  mlb_id: MLB_ID,
  product_data: {
    title: 'Anel Folheado Ouro 18k Delicado Feminino Garantia Revenda',
    description: 'Anel folheado a ouro 18k com garantia de qualidade',
    plain_text: 'Anel folheado a ouro 18k com garantia de qualidade',
    price: 12.90,
    category_id: 'MLB1430',
    status: 'active',
    sold_quantity: 156,
    available_quantity: 50,
    condition: 'new',
    listing_type_id: 'gold_pro',
    attributes: [
      { id: 'BRAND', name: 'Marca', value_name: 'Sem marca', value_id: null },
      { id: 'COLOR', name: 'Cor', value_name: 'Dourado', value_id: null },
      { id: 'ITEM_CONDITION', name: 'Condição', value_name: 'Novo', value_id: null },
      { id: 'MATERIAL', name: 'Material', value_name: 'Folheado a ouro', value_id: null },
      // NÃO tem atributos de pedras ou brilhantes
    ],
    pictures: [
      { secure_url: 'https://example.com/img1.jpg', url: 'https://example.com/img1.jpg' },
      { secure_url: 'https://example.com/img2.jpg', url: 'https://example.com/img2.jpg' },
      { secure_url: 'https://example.com/img3.jpg', url: 'https://example.com/img3.jpg' },
    ],
    shipping: {
      free_shipping: true,
      mode: 'me2'
    }
  },
  quality_score: {
    overall_score: 65,
    breakdown: {
      title_seo: 60,
      description_quality: 50,
      technical_sheet: 70,
      images_quality: 80,
      keywords_density: 55,
      model_optimization: 40
    },
    alerts: [],
    suggestions: []
  },
  title_optimization: {
    current_title: 'Anel Folheado Ouro 18k Delicado Feminino Garantia Revenda',
    current_score: 60,
    suggested_titles: [
      {
        title: 'Anel Folheado Ouro 18k Feminino Delicado Garantia Revenda',
        score: 85,
        reasoning: 'Otimizado para SEO com palavras-chave principais no início',
        keywords_added: ['feminino', 'garantia']
      }
    ],
    weaknesses: ['Título poderia ser mais específico sobre o design']
  },
  keyword_analysis: {
    primary_keywords: ['anel', 'folheado', 'ouro'],
    secondary_keywords: ['feminino', 'delicado'],
    long_tail_keywords: ['anel folheado ouro 18k'],
    missing_keywords: ['zircônia', 'solitário'],
    trending_keywords: ['minimalista'],
    keyword_density: 4.5
  },
  technical_analysis: {
    total_attributes: 6,
    filled_attributes: 4,
    completion_percentage: 67,
    missing_important: ['TAMANHO', 'PESO']
  },
  image_analysis: {
    total_images: 3,
    high_quality_images: 3,
    has_video: false,
    has_variations_images: false
  },
  model_optimization: {
    current_model: 'Delicado',
    current_score: 40,
    optimized_models: [
      {
        model: 'Anel Delicado Minimalista',
        score: 75,
        reasoning: 'Modelo mais descritivo e com keyword trending'
      }
    ],
    strategic_keywords: ['minimalista', 'delicado'],
    category_insights: {
      category_name: 'Anéis',
      trending_terms: ['minimalista', 'solitário'],
      high_conversion_words: ['garantia', 'revenda'],
      seasonal_keywords: []
    }
  },
  seo_description: {
    optimized_description: 'Anel folheado a ouro 18k. Modelo delicado e minimalista...',
    readability_score: 75,
    seo_keywords: ['anel', 'folheado', 'ouro'],
    call_to_action: 'Compre agora com garantia de qualidade!'
  },
  competitive_analysis: {
    top_competitors: [],
    price_analysis: {
      price_position: 'competitive',
      market_average: 15.00
    }
  }
};

console.log('🧪 Iniciando teste de análise IA...\n');
console.log(`📦 Produto: ${mockAnalysisData.product_data.title}`);
console.log(`🏷️  MLB ID: ${MLB_ID}`);
console.log(`💰 Preço: R$ ${mockAnalysisData.product_data.price}`);
console.log(`📊 Atributos: ${mockAnalysisData.product_data.attributes.map(a => `${a.id}=${a.value_name}`).join(', ')}`);
console.log('\n⚠️  IMPORTANTE: Este produto NÃO tem pedras, brilhantes ou zircônias nos atributos!');
console.log('🎯 Objetivo: Verificar se a IA vai INVENTAR características que não existem\n');

// Fazer requisição para a API
fetch('http://localhost:3001/api/integrations/ai-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mlbId: MLB_ID,
    analysisData: mockAnalysisData,
    workspaceId: '00000000-0000-0000-0000-000000000010'
  })
})
.then(response => response.json())
.then(data => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTADO DA ANÁLISE IA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!data.success) {
    console.log('❌ ERRO NA ANÁLISE:');
    console.log(`   Mensagem: ${data.error}`);
    console.log(`   Detalhes: ${data.details}`);
    console.log(`   Código: ${data.error_code}`);
    console.log('\n📋 Ações Sugeridas:');
    data.actions?.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action}`);
    });
    console.log('\n✅ TESTE DE TRATAMENTO DE ERROS: PASSOU');
    return;
  }

  console.log(`✅ Sucesso: ${data.success}`);
  console.log(`📈 Score de Oportunidade: ${data.overall_opportunity_score}/100`);
  console.log(`💡 Total de Sugestões: ${data.total_suggestions}`);
  console.log(`🔥 Alto Impacto: ${data.high_impact_count}`);
  console.log(`⚡ Quick Wins: ${data.quick_wins_available}`);
  console.log(`⏱️  Tempo: ${data.processing_time_ms}ms`);
  console.log(`\n💭 Insights IA:\n${data.ai_insights}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 ANÁLISE ANTI-ALUCINAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let hasHallucination = false;
  const hallucinationTerms = [
    'pedra', 'pedras',
    'brilhante', 'brilhantes',
    'zircônia', 'zirconia',
    'diamante', 'cristal',
    'prata', 'prata 925'
  ];

  data.suggestions?.forEach((suggestion, index) => {
    console.log(`\n${index + 1}. [${suggestion.category}] ${suggestion.title}`);
    console.log(`   Tipo: ${suggestion.type} | Impacto: ${suggestion.impact} | ROI: ${suggestion.roi_score}`);
    console.log(`   📝 ${suggestion.description}`);

    if (suggestion.action_data?.suggested_value) {
      console.log(`   💡 Sugestão: "${suggestion.action_data.suggested_value}"`);

      // Verificar alucinações
      const suggestedText = suggestion.action_data.suggested_value.toLowerCase();
      hallucinationTerms.forEach(term => {
        if (suggestedText.includes(term)) {
          console.log(`   ⚠️  ALERTA: Mencionou "${term}" que NÃO existe nos atributos!`);
          hasHallucination = true;
        }
      });
    }

    if (suggestion.reasoning) {
      console.log(`   🤔 Raciocínio: ${suggestion.reasoning}`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 RESULTADO DO TESTE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (hasHallucination) {
    console.log('❌ TESTE FALHOU: IA ainda está alucinando características!');
    console.log('   A IA mencionou pedras/brilhantes que não existem nos atributos.\n');
  } else {
    console.log('✅ TESTE PASSOU: IA não alucinouna características!');
    console.log('   A IA respeitou os atributos reais do produto.\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})
.catch(error => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('❌ ERRO DE CONEXÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Erro: ${error.message}`);
  console.log('\nPossíveis causas:');
  console.log('1. Servidor não está rodando');
  console.log('2. Porta incorreta (verifique se é 3001)');
  console.log('3. Problema de rede\n');
});
