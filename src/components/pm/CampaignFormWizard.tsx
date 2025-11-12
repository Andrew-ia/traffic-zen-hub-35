import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CampaignData {
  // Step 1: Campaign Info
  campaignName: string;
  objective: string;

  // Step 2: Audience
  ageMin: string;
  ageMax: string;
  interests: string;

  // Step 3: Creatives
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeUrl: string;

  // Step 4: Budget & Schedule
  budget: string;
  startDate: string;
  endDate: string;

  // Step 5: Review & Submit
  // No new fields, just review
}

interface CampaignFormWizardProps {
  onSubmit: (data: CampaignData) => void;
  isLoading?: boolean;
}

const STEPS = [
  { id: 1, title: 'Informações da Campanha', description: 'Nome e objetivo' },
  { id: 2, title: 'Público-Alvo', description: 'Idade e interesses' },
  { id: 3, title: 'Criativos', description: 'Textos e CTA' },
  { id: 4, title: 'Orçamento e Datas', description: 'Budget e período' },
  { id: 5, title: 'Revisão', description: 'Confira tudo' },
];

export function CampaignFormWizard({ onSubmit, isLoading }: CampaignFormWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CampaignData>({
    campaignName: '',
    objective: '',
    ageMin: '',
    ageMax: '',
    interests: '',
    primaryText: '',
    headline: '',
    description: '',
    cta: 'Comprar Agora',
    creativeUrl: '',
    budget: '',
    startDate: '',
    endDate: '',
  });

  const handleChange = (field: keyof CampaignData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.campaignName.trim() && data.objective;
      case 2:
        return data.ageMin && data.ageMax;
      case 3:
        return data.primaryText.trim() && data.headline.trim() && data.description.trim();
      case 4:
        return data.budget && data.startDate && data.endDate;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    onSubmit(data);
  };

  return (
    <div className="w-full space-y-6">
      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          {STEPS.map((s) => (
            <div key={s.id} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  step >= s.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {s.id}
              </div>
              <p className="text-xs mt-1 text-center max-w-[80px]">{s.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <Card className="min-h-[300px]">
        <CardHeader>
          <CardTitle>{STEPS[step - 1]?.title}</CardTitle>
          <CardDescription>{STEPS[step - 1]?.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Campaign Info */}
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="campaign-name">Nome da Campanha *</Label>
                <Input
                  id="campaign-name"
                  placeholder="Ex: Black Friday 2025"
                  value={data.campaignName}
                  onChange={(e) => handleChange('campaignName', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="objective">Objetivo da Campanha *</Label>
                <Select value={data.objective} onValueChange={(v) => handleChange('objective', v)}>
                  <SelectTrigger id="objective">
                    <SelectValue placeholder="Selecione um objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traffic">Tráfego</SelectItem>
                    <SelectItem value="conversions">Conversões</SelectItem>
                    <SelectItem value="awareness">Reconhecimento</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="engagement">Engajamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age-min">Idade Mínima *</Label>
                  <Input
                    id="age-min"
                    type="number"
                    placeholder="18"
                    value={data.ageMin}
                    onChange={(e) => handleChange('ageMin', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="age-max">Idade Máxima *</Label>
                  <Input
                    id="age-max"
                    type="number"
                    placeholder="65"
                    value={data.ageMax}
                    onChange={(e) => handleChange('ageMax', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="interests">Interesses (opcional)</Label>
                <Textarea
                  id="interests"
                  placeholder="Ex: Moda, Design, Lifestyle"
                  value={data.interests}
                  onChange={(e) => handleChange('interests', e.target.value)}
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Step 3: Creatives */}
          {step === 3 && (
            <>
              <div>
                <Label htmlFor="primary-text">Texto Principal *</Label>
                <Textarea
                  id="primary-text"
                  placeholder="Ex: A nova coleção chegou! Garanta já."
                  value={data.primaryText}
                  onChange={(e) => handleChange('primaryText', e.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="headline">Título *</Label>
                <Input
                  id="headline"
                  placeholder="Ex: Novidades Vermezzo"
                  value={data.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  placeholder="Ex: Frete grátis acima de R$ 199"
                  value={data.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cta">CTA (Call To Action)</Label>
                <Select value={data.cta} onValueChange={(v) => handleChange('cta', v)}>
                  <SelectTrigger id="cta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Comprar Agora">Comprar Agora</SelectItem>
                    <SelectItem value="Saiba Mais">Saiba Mais</SelectItem>
                    <SelectItem value="Cadastrar-se">Cadastrar-se</SelectItem>
                    <SelectItem value="Enviar Mensagem">Enviar Mensagem</SelectItem>
                    <SelectItem value="Entrar em Contato">Entrar em Contato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="creative-url">URL do Criativo (Imagem/Vídeo)</Label>
                <Input
                  id="creative-url"
                  type="url"
                  placeholder="Ex: https://exemplo.com/imagem.jpg"
                  value={data.creativeUrl}
                  onChange={(e) => handleChange('creativeUrl', e.target.value)}
                  className="mt-1"
                />
              </div>
            </>
          )}

          {/* Step 4: Budget & Schedule */}
          {step === 4 && (
            <>
              <div>
                <Label htmlFor="budget">Orçamento (R$) *</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="100.00"
                  value={data.budget}
                  onChange={(e) => handleChange('budget', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Data de Início *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={data.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">Data de Término *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={data.endDate}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Campanha:</span>
                  <span className="text-sm font-semibold">{data.campaignName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Objetivo:</span>
                  <span className="text-sm font-semibold capitalize">{data.objective}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Público:</span>
                  <span className="text-sm font-semibold">{data.ageMin} - {data.ageMax} anos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Orçamento:</span>
                  <span className="text-sm font-semibold">R$ {data.budget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Período:</span>
                  <span className="text-sm font-semibold">{data.startDate} até {data.endDate}</span>
                </div>
                <div className="border-t pt-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Criativo:</span>
                  <div className="mt-2 text-sm space-y-1">
                    <p className="font-semibold">{data.headline}</p>
                    <p className="text-gray-700 dark:text-gray-300">{data.primaryText}</p>
                    <p className="text-gray-600 dark:text-gray-400">{data.description}</p>
                    <p className="text-blue-600 font-medium">CTA: {data.cta}</p>
                    {data.creativeUrl && (
                      <p className="text-green-600 font-medium break-all">URL: {data.creativeUrl}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Anterior
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Salvando...' : 'Salvar Campanha'}
          </Button>
        )}
      </div>
    </div>
  );
}
