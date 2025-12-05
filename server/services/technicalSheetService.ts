import { MLBAnalysisData } from './mlbAnalyzer.service';

export interface TechnicalAttribute {
    id: string;
    name: string;
    value_id?: string;
    value_name?: string;
    values?: Array<{ id: string; name: string; }>;
    required: boolean;
    importance_level: 'critical' | 'high' | 'medium' | 'low';
    seo_impact: number; // 1-10
    conversion_impact: number; // 1-10
    category: 'basic' | 'physical' | 'technical' | 'marketing' | 'logistics';
    suggestions?: string[];
    validation?: {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    };
}

export interface TechnicalSheetAnalysis {
    completion_score: number; // 0-100
    total_attributes: number;
    filled_attributes: number;
    critical_missing: TechnicalAttribute[];
    high_priority_missing: TechnicalAttribute[];
    optimization_opportunities: Array<{
        attribute: TechnicalAttribute;
        potential_boost: number;
        implementation_difficulty: 'easy' | 'medium' | 'hard';
        steps: string[];
    }>;
    category_specific_insights: {
        required_attributes: string[];
        recommended_attributes: string[];
        competitive_advantages: string[];
    };
    seo_impact_analysis: {
        current_seo_score: number;
        max_possible_score: number;
        improvement_potential: number;
        priority_attributes: TechnicalAttribute[];
    };
    validation_results: Array<{
        attribute_id: string;
        valid: boolean;
        issues: string[];
        recommendations: string[];
    }>;
}

/**
 * Serviço especializado em análise e otimização de fichas técnicas
 */
export class TechnicalSheetService {
    
    /**
     * Analisa a ficha técnica completa do produto
     */
    async analyzeTechnicalSheet(productData: MLBAnalysisData): Promise<TechnicalSheetAnalysis> {
        const categoryRequirements = this.getCategoryRequirements(productData.category_id);
        const enrichedAttributes = this.enrichAttributes(productData.attributes, categoryRequirements);
        
        const completionScore = this.calculateCompletionScore(enrichedAttributes);
        const seoImpactAnalysis = this.analyzeSEOImpact(enrichedAttributes);
        const optimizationOpportunities = this.identifyOptimizationOpportunities(enrichedAttributes);
        
        return {
            completion_score: completionScore,
            total_attributes: enrichedAttributes.length,
            filled_attributes: enrichedAttributes.filter(attr => this.isAttributeFilled(attr)).length,
            critical_missing: enrichedAttributes.filter(attr => 
                !this.isAttributeFilled(attr) && attr.importance_level === 'critical'
            ),
            high_priority_missing: enrichedAttributes.filter(attr => 
                !this.isAttributeFilled(attr) && attr.importance_level === 'high'
            ),
            optimization_opportunities: optimizationOpportunities,
            category_specific_insights: this.getCategorySpecificInsights(productData.category_id),
            seo_impact_analysis: seoImpactAnalysis,
            validation_results: this.validateAttributes(enrichedAttributes)
        };
    }

    /**
     * Enriquece os atributos com metadados de importância e categoria
     */
    private enrichAttributes(
        attributes: Array<any>, 
        categoryRequirements: any
    ): TechnicalAttribute[] {
        const attributeMapping = this.getAttributeMapping();
        
        return attributes.map(attr => {
            const metadata = attributeMapping[attr.id] || {
                importance_level: 'medium',
                seo_impact: 5,
                conversion_impact: 5,
                category: 'technical',
                required: false
            };

            const categorySpecific = categoryRequirements.required_attributes.includes(attr.id);
            
            return {
                id: attr.id,
                name: attr.name,
                value_id: attr.value_id,
                value_name: attr.value_name,
                values: attr.values,
                required: categorySpecific || metadata.required,
                importance_level: categorySpecific ? 'critical' : metadata.importance_level,
                seo_impact: metadata.seo_impact,
                conversion_impact: metadata.conversion_impact,
                category: metadata.category,
                suggestions: this.generateAttributeSuggestions(attr),
                validation: this.validateAttribute(attr)
            };
        });
    }

    /**
     * Calcula score de completude da ficha técnica
     */
    private calculateCompletionScore(attributes: TechnicalAttribute[]): number {
        if (attributes.length === 0) return 0;
        
        let totalWeight = 0;
        let filledWeight = 0;

        attributes.forEach(attr => {
            const weight = this.getAttributeWeight(attr.importance_level);
            totalWeight += weight;
            
            if (this.isAttributeFilled(attr)) {
                filledWeight += weight;
            }
        });

        return totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;
    }

    /**
     * Analisa impacto SEO dos atributos
     */
    private analyzeSEOImpact(attributes: TechnicalAttribute[]): any {
        const currentScore = attributes
            .filter(attr => this.isAttributeFilled(attr))
            .reduce((sum, attr) => sum + attr.seo_impact, 0);
        
        const maxPossibleScore = attributes
            .reduce((sum, attr) => sum + attr.seo_impact, 0);
        
        const improvementPotential = maxPossibleScore - currentScore;
        
        const priorityAttributes = attributes
            .filter(attr => !this.isAttributeFilled(attr) && attr.seo_impact >= 7)
            .sort((a, b) => b.seo_impact - a.seo_impact);

        return {
            current_seo_score: currentScore,
            max_possible_score: maxPossibleScore,
            improvement_potential: improvementPotential,
            priority_attributes: priorityAttributes
        };
    }

    /**
     * Identifica oportunidades de otimização
     */
    private identifyOptimizationOpportunities(attributes: TechnicalAttribute[]): Array<any> {
        return attributes
            .filter(attr => !this.isAttributeFilled(attr))
            .map(attr => ({
                attribute: attr,
                potential_boost: this.calculatePotentialBoost(attr),
                implementation_difficulty: this.getImplementationDifficulty(attr),
                steps: this.generateImplementationSteps(attr)
            }))
            .sort((a, b) => b.potential_boost - a.potential_boost)
            .slice(0, 10);
    }

    /**
     * Requisitos específicos por categoria
     */
    private getCategoryRequirements(categoryId: string): any {
        const requirements: { [key: string]: any } = {
            'MLB1432': { // Joias e Bijuterias
                required_attributes: ['BRAND', 'MATERIAL', 'COLOR', 'GENDER'],
                recommended_attributes: ['SIZE', 'STONE_TYPE', 'CLOSURE_TYPE', 'OCCASION'],
                competitive_advantages: ['HYPOALLERGENIC', 'WATER_RESISTANT', 'WARRANTY_TIME']
            },
            'MLB1276': { // Fones e Headphones  
                required_attributes: ['BRAND', 'MODEL', 'CONNECTION_TYPE', 'HEADPHONE_TYPE'],
                recommended_attributes: ['FREQUENCY_RESPONSE', 'IMPEDANCE', 'MICROPHONE', 'NOISE_CANCELLATION'],
                competitive_advantages: ['BATTERY_LIFE', 'WATER_RESISTANCE', 'WIRELESS_RANGE']
            },
            'MLB1051': { // Celulares e Smartphones
                required_attributes: ['BRAND', 'MODEL', 'OPERATING_SYSTEM', 'INTERNAL_MEMORY'],
                recommended_attributes: ['SCREEN_SIZE', 'CAMERA_RESOLUTION', 'BATTERY_CAPACITY', 'RAM_MEMORY'],
                competitive_advantages: ['DUAL_SIM', '5G_COMPATIBLE', 'FAST_CHARGING', 'WATER_RESISTANCE']
            }
        };

        return requirements[categoryId] || {
            required_attributes: ['BRAND', 'MODEL'],
            recommended_attributes: ['COLOR', 'SIZE'],
            competitive_advantages: ['WARRANTY_TIME']
        };
    }

    /**
     * Mapeamento de metadados dos atributos
     */
    private getAttributeMapping(): { [key: string]: any } {
        return {
            'BRAND': {
                importance_level: 'critical',
                seo_impact: 9,
                conversion_impact: 8,
                category: 'basic',
                required: true
            },
            'MODEL': {
                importance_level: 'critical', 
                seo_impact: 9,
                conversion_impact: 9,
                category: 'basic',
                required: true
            },
            'COLOR': {
                importance_level: 'high',
                seo_impact: 7,
                conversion_impact: 8,
                category: 'physical',
                required: false
            },
            'SIZE': {
                importance_level: 'high',
                seo_impact: 6,
                conversion_impact: 9,
                category: 'physical', 
                required: false
            },
            'MATERIAL': {
                importance_level: 'high',
                seo_impact: 7,
                conversion_impact: 7,
                category: 'physical',
                required: false
            },
            'WEIGHT': {
                importance_level: 'medium',
                seo_impact: 5,
                conversion_impact: 6,
                category: 'physical',
                required: false
            },
            'DIMENSIONS': {
                importance_level: 'medium',
                seo_impact: 5,
                conversion_impact: 6,
                category: 'physical',
                required: false
            },
            'WARRANTY_TIME': {
                importance_level: 'medium',
                seo_impact: 6,
                conversion_impact: 8,
                category: 'marketing',
                required: false
            },
            'ORIGIN': {
                importance_level: 'low',
                seo_impact: 4,
                conversion_impact: 5,
                category: 'logistics',
                required: false
            }
        };
    }

    /**
     * Insights específicos da categoria
     */
    private getCategorySpecificInsights(categoryId: string): any {
        return this.getCategoryRequirements(categoryId);
    }

    /**
     * Valida todos os atributos
     */
    private validateAttributes(attributes: TechnicalAttribute[]): Array<any> {
        return attributes
            .map(attr => ({
                attribute_id: attr.id,
                valid: attr.validation?.valid || false,
                issues: attr.validation?.issues || [],
                recommendations: attr.validation?.recommendations || []
            }))
            .filter(result => !result.valid || result.issues.length > 0);
    }

    /**
     * Valida um atributo específico
     */
    private validateAttribute(attribute: any): any {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Validação básica: tem valor?
        if (!this.isAttributeFilled(attribute)) {
            issues.push('Atributo não preenchido');
            recommendations.push('Preencha este atributo para melhorar SEO e conversão');
        }

        // Validações específicas por tipo de atributo
        if (attribute.id === 'BRAND' && attribute.value_name) {
            if (attribute.value_name.length < 2) {
                issues.push('Nome da marca muito curto');
                recommendations.push('Use o nome completo da marca');
            }
        }

        if (attribute.id === 'COLOR' && attribute.value_name) {
            const genericColors = ['cor', 'colorido', 'variado'];
            if (genericColors.some(color => 
                attribute.value_name.toLowerCase().includes(color)
            )) {
                issues.push('Cor muito genérica');
                recommendations.push('Especifique a cor exata (ex: "Azul Marinho" ao invés de "Azul")');
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }

    /**
     * Gera sugestões para um atributo
     */
    private generateAttributeSuggestions(attribute: any): string[] {
        const suggestions: string[] = [];

        if (!this.isAttributeFilled(attribute)) {
            switch (attribute.id) {
                case 'BRAND':
                    suggestions.push('Adicione a marca do produto', 'Use marca original/fabricante');
                    break;
                case 'MODEL':
                    suggestions.push('Inclua modelo/referência', 'Use código do fabricante se disponível');
                    break;
                case 'COLOR':
                    suggestions.push('Especifique a cor principal', 'Use nomes específicos (ex: "Azul Marinho")');
                    break;
                case 'SIZE':
                    suggestions.push('Inclua tamanho/dimensões', 'Use medidas padrão da categoria');
                    break;
                case 'WARRANTY_TIME':
                    suggestions.push('Especifique tempo de garantia', 'Garantia aumenta confiança do comprador');
                    break;
                default:
                    suggestions.push(`Complete o atributo ${attribute.name}`, 'Melhora SEO e experiência do usuário');
            }
        }

        return suggestions;
    }

    /**
     * Verifica se um atributo está preenchido
     */
    private isAttributeFilled(attribute: any): boolean {
        return !!(attribute.value_name || 
                 (attribute.values && attribute.values.length > 0) ||
                 attribute.value_id);
    }

    /**
     * Calcula peso do atributo baseado na importância
     */
    private getAttributeWeight(importanceLevel: string): number {
        const weights = {
            'critical': 10,
            'high': 7,
            'medium': 4,
            'low': 1
        };
        return weights[importanceLevel as keyof typeof weights] || 1;
    }

    /**
     * Calcula potencial boost de um atributo
     */
    private calculatePotentialBoost(attribute: TechnicalAttribute): number {
        const seoWeight = 0.6;
        const conversionWeight = 0.4;
        
        return Math.round(
            (attribute.seo_impact * seoWeight + attribute.conversion_impact * conversionWeight) * 
            this.getAttributeWeight(attribute.importance_level)
        );
    }

    /**
     * Determina dificuldade de implementação
     */
    private getImplementationDifficulty(attribute: TechnicalAttribute): 'easy' | 'medium' | 'hard' {
        // Atributos básicos são fáceis de implementar
        if (['BRAND', 'MODEL', 'COLOR'].includes(attribute.id)) {
            return 'easy';
        }
        
        // Atributos técnicos podem ser médios
        if (['MATERIAL', 'SIZE', 'WEIGHT'].includes(attribute.id)) {
            return 'medium';
        }
        
        // Atributos específicos podem ser difíceis
        return 'hard';
    }

    /**
     * Gera passos para implementação
     */
    private generateImplementationSteps(attribute: TechnicalAttribute): string[] {
        const baseSteps = [
            `1. Acesse a edição do produto no Mercado Livre`,
            `2. Localize a seção "Características" ou "Ficha Técnica"`,
            `3. Encontre o campo "${attribute.name}"`
        ];

        switch (attribute.id) {
            case 'BRAND':
                return [
                    ...baseSteps,
                    '4. Selecione a marca correta da lista',
                    '5. Se não encontrar, digite o nome exato da marca',
                    '6. Salve as alterações'
                ];
            
            case 'COLOR':
                return [
                    ...baseSteps,
                    '4. Escolha a cor principal do produto',
                    '5. Use nomes específicos (evite "colorido" ou "variado")',
                    '6. Salve as alterações'
                ];
                
            default:
                return [
                    ...baseSteps,
                    '4. Preencha com informação precisa',
                    '5. Consulte manual/embalagem se necessário',
                    '6. Salve as alterações'
                ];
        }
    }
}

export const technicalSheetService = new TechnicalSheetService();