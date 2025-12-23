import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'Quais produtos venderam mais no Mercado Livre?',
  'Mostre itens com baixa conversão',
  'Analise meu funil de visitas → vendas',
  'Quais categorias tiveram melhor desempenho?',
  'Existe algum produto com estoque crítico?',
  'Quanto vendi nos últimos 7 dias?',
  'Qual item tem maior margem estimada?',
  'Sugira melhorias para minhas listagens',
];

export function SuggestedQuestions({ onSelect, disabled }: SuggestedQuestionsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4" />
        <span>Perguntas sugeridas:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(question)}
            disabled={disabled}
            className="text-xs"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
