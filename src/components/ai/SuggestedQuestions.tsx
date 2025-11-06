import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'Quais campanhas estão com melhor ROI?',
  'Mostre as campanhas com CTR abaixo de 1%',
  'Analise meu funil de conversão',
  'Compare Meta Ads vs Google Ads',
  'Que criativo performou melhor esta semana?',
  'Devo pausar alguma campanha?',
  'Qual objetivo está com melhor desempenho?',
  'Quanto gastei nos últimos 7 dias?',
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
