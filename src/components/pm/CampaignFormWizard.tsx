import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus, Trash2, FolderOpen, Clipboard } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CAMPAIGN_OBJECTIVES, getCampaignObjectiveLabel } from '@/constants/campaignObjectives';

export interface Creative {
  id: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeUrl: string;
}

export interface AdSet {
  id: string;
  name: string;
  creatives: Creative[];
  schedule?: {
    start?: string;
    end?: string;
  };
  placementNotes?: string;
}

export interface CampaignData {
  // Step 1: Campaign Info
  campaignName: string;
  objective: string;

  // Step 2: Audience
  ageMin: string;
  ageMax: string;
  interests: string;

  // Step 3: Budget & Schedule
  budget: string;
  startDate: string;
  endDate: string;

  // Step 4: Ad Sets & Creatives
  adSets: AdSet[];

  // Step 5: Review & Submit
  // No new fields, just review
}

interface CampaignFormWizardProps {
  onSubmit: (data: CampaignData) => void;
  isLoading?: boolean;
  initialData?: Partial<CampaignData>;
  submitLabel?: string;
  onCancel?: () => void;
}

const STEPS = [
  { id: 1, title: 'Informações da Campanha', description: 'Nome e objetivo' },
  { id: 2, title: 'Público-Alvo', description: 'Idade e interesses' },
  { id: 3, title: 'Orçamento e Datas', description: 'Budget e período' },
  { id: 4, title: 'Conjuntos e Criativos', description: 'Ad Sets e Criativos' },
  { id: 5, title: 'Revisão', description: 'Confira tudo' },
];

const DEFAULT_CREATIVE: Creative = {
  id: '1',
  primaryText: '',
  headline: '',
  description: '',
  cta: 'Comprar Agora',
  creativeUrl: '',
};

const DEFAULT_ADSET: AdSet = {
  id: '1',
  name: '',
  creatives: [{ ...DEFAULT_CREATIVE }],
};

const DEFAULT_CAMPAIGN: CampaignData = {
  campaignName: '',
  objective: '',
  ageMin: '',
  ageMax: '',
  interests: '',
  budget: '',
  startDate: '',
  endDate: '',
  adSets: [{ ...DEFAULT_ADSET }],
};

function normalizeCampaignData(initial?: Partial<CampaignData>): CampaignData {
  if (!initial) {
    return JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN));
  }

  const adSets =
    initial.adSets && initial.adSets.length
      ? initial.adSets.map((adSet, idx) => ({
          id: adSet.id || (idx + 1).toString(),
          name: adSet.name || '',
          schedule: adSet.schedule || {},
          placementNotes: adSet.placementNotes,
          creatives:
            adSet.creatives && adSet.creatives.length
              ? adSet.creatives.map((creative, cIdx) => ({
                  id: creative.id || (cIdx + 1).toString(),
                  primaryText: creative.primaryText || '',
                  headline: creative.headline || '',
                  description: creative.description || '',
                  cta: creative.cta || 'Comprar Agora',
                  creativeUrl: creative.creativeUrl || '',
                }))
              : [{ ...DEFAULT_CREATIVE }],
        }))
      : [{ ...DEFAULT_ADSET }];

  return {
    campaignName: initial.campaignName || '',
    objective: initial.objective || '',
    ageMin: initial.ageMin || '',
    ageMax: initial.ageMax || '',
    interests: initial.interests || '',
    budget: initial.budget || '',
    startDate: initial.startDate || '',
    endDate: initial.endDate || '',
    adSets,
  };
}

export function CampaignFormWizard({
  onSubmit,
  isLoading,
  initialData,
  submitLabel,
  onCancel,
}: CampaignFormWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CampaignData>(() => normalizeCampaignData(initialData));
  const [driveSelectorOpen, setDriveSelectorOpen] = useState(false);
  const [driveSelectorTarget, setDriveSelectorTarget] = useState<{ adSetId: string; creativeId: string } | null>(null);
  const [driveSelectedUrl, setDriveSelectedUrl] = useState('');

  const DRIVE_FOLDER_ID = '1CW4zimagBD1syVRfbhSuH1NC5drzVZPt';
  const DRIVE_EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#grid`;

  useEffect(() => {
    setData(normalizeCampaignData(initialData));
  }, [initialData]);

  const handleChange = (field: keyof Omit<CampaignData, 'adSets'>, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateAdSet = (adSetId: string, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      adSets: prev.adSets.map(ads =>
        ads.id === adSetId ? { ...ads, [field]: value } : ads
      ),
    }));
  };

  const updateCreative = (adSetId: string, creativeId: string, field: string, value: string) => {
    setData(prev => ({
      ...prev,
      adSets: prev.adSets.map(ads =>
        ads.id === adSetId
          ? {
              ...ads,
              creatives: ads.creatives.map(c =>
                c.id === creativeId ? { ...c, [field]: value } : c
              ),
            }
          : ads
      ),
    }));
  };

  const openDriveSelector = (adSetId: string, creativeId: string) => {
    setDriveSelectorTarget({ adSetId, creativeId });
    setDriveSelectedUrl('');
    setDriveSelectorOpen(true);
  };

  const applyDriveSelectedUrl = () => {
    if (driveSelectorTarget && driveSelectedUrl.trim()) {
      updateCreative(driveSelectorTarget.adSetId, driveSelectorTarget.creativeId, 'creativeUrl', driveSelectedUrl.trim());
      setDriveSelectorOpen(false);
      setDriveSelectorTarget(null);
      setDriveSelectedUrl('');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setDriveSelectedUrl(text);
    } catch {
      void 0;
    }
  };

  const addAdSet = () => {
    const newAdSetId = Math.max(...data.adSets.map(a => parseInt(a.id)), 0) + 1;
    setData(prev => ({
      ...prev,
      adSets: [
        ...prev.adSets,
        {
          id: newAdSetId.toString(),
          name: '',
          creatives: [
            {
              id: '1',
              primaryText: '',
              headline: '',
              description: '',
              cta: 'Comprar Agora',
              creativeUrl: '',
            },
          ],
        },
      ],
    }));
  };

  const removeAdSet = (adSetId: string) => {
    if (data.adSets.length > 1) {
      setData(prev => ({
        ...prev,
        adSets: prev.adSets.filter(ads => ads.id !== adSetId),
      }));
    }
  };

  const addCreative = (adSetId: string) => {
    setData(prev => ({
      ...prev,
      adSets: prev.adSets.map(ads =>
        ads.id === adSetId
          ? {
              ...ads,
              creatives: [
                ...ads.creatives,
                {
                  id: (Math.max(...ads.creatives.map(c => parseInt(c.id)), 0) + 1).toString(),
                  primaryText: '',
                  headline: '',
                  description: '',
                  cta: 'Comprar Agora',
                  creativeUrl: '',
                },
              ],
            }
          : ads
      ),
    }));
  };

  const removeCreative = (adSetId: string, creativeId: string) => {
    setData(prev => ({
      ...prev,
      adSets: prev.adSets.map(ads =>
        ads.id === adSetId
          ? {
              ...ads,
              creatives: ads.creatives.filter(c => c.id !== creativeId),
            }
          : ads
      ),
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.campaignName.trim() && data.objective;
      case 2:
        return data.ageMin && data.ageMax;
      case 3:
        return data.budget && data.startDate && data.endDate;
      case 4:
        return data.adSets.length > 0 &&
          data.adSets.every(ads =>
            ads.name.trim() &&
            ads.creatives.length > 0 &&
            ads.creatives.every(c =>
              c.primaryText.trim() &&
              c.headline.trim() &&
              c.description.trim()
            )
          );
      case 5:
        return true;
      default:
        return false;
    }
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
      <Card className="min-h-[350px] flex flex-col">
        <CardHeader>
          <CardTitle>{STEPS[step - 1]?.title}</CardTitle>
          <CardDescription>{STEPS[step - 1]?.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
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
                    {CAMPAIGN_OBJECTIVES.map((objective) => (
                      <SelectItem key={objective.value} value={objective.value}>
                        {objective.label}
                      </SelectItem>
                    ))}
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

          {/* Step 3: Budget & Schedule */}
          {step === 3 && (
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

          {/* Step 4: Ad Sets & Creatives */}
          {step === 4 && (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {data.adSets.map((adSet, adSetIndex) => (
                <div key={adSet.id} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  {/* Ad Set Header */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`adset-name-${adSet.id}`}>Nome do Conjunto de Anúncios *</Label>
                      <Input
                        id={`adset-name-${adSet.id}`}
                        placeholder="Ex: Público Frio - Mulheres 25-44"
                        value={adSet.name}
                        onChange={(e) => updateAdSet(adSet.id, 'name', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    {data.adSets.length > 1 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeAdSet(adSet.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Creatives */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold">Criativos</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCreative(adSet.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Criativo
                      </Button>
                    </div>

                    {adSet.creatives.map((creative, creativeIndex) => (
                      <div key={creative.id} className="border rounded p-3 space-y-3 bg-white dark:bg-slate-950">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Criativo #{creativeIndex + 1}
                          </span>
                          {adSet.creatives.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCreative(adSet.id, creative.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`headline-${adSet.id}-${creative.id}`} className="text-xs">
                            Título *
                          </Label>
                          <Input
                            id={`headline-${adSet.id}-${creative.id}`}
                            placeholder="Ex: Novidades Vermezzo"
                            value={creative.headline}
                            onChange={(e) => updateCreative(adSet.id, creative.id, 'headline', e.target.value)}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`primary-text-${adSet.id}-${creative.id}`} className="text-xs">
                            Texto Principal *
                          </Label>
                          <Textarea
                            id={`primary-text-${adSet.id}-${creative.id}`}
                            placeholder="Ex: A nova coleção chegou! Garanta já."
                            value={creative.primaryText}
                            onChange={(e) => updateCreative(adSet.id, creative.id, 'primaryText', e.target.value)}
                            className="mt-1 resize-none"
                            rows={2}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`description-${adSet.id}-${creative.id}`} className="text-xs">
                            Descrição *
                          </Label>
                          <Input
                            id={`description-${adSet.id}-${creative.id}`}
                            placeholder="Ex: Frete grátis acima de R$ 199"
                            value={creative.description}
                            onChange={(e) => updateCreative(adSet.id, creative.id, 'description', e.target.value)}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor={`cta-${adSet.id}-${creative.id}`} className="text-xs">
                              CTA
                            </Label>
                            <Select value={creative.cta} onValueChange={(v) => updateCreative(adSet.id, creative.id, 'cta', v)}>
                              <SelectTrigger id={`cta-${adSet.id}-${creative.id}`} className="h-8 text-sm">
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
                            <Label htmlFor={`url-${adSet.id}-${creative.id}`} className="text-xs">
                              URL do Criativo
                            </Label>
                            <div className="mt-1 flex items-center gap-2">
                              <Input
                                id={`url-${adSet.id}-${creative.id}`}
                                type="url"
                                placeholder="https://exemplo.com/img.jpg"
                                value={creative.creativeUrl}
                                onChange={(e) => updateCreative(adSet.id, creative.id, 'creativeUrl', e.target.value)}
                                className="h-8 text-sm flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openDriveSelector(adSet.id, creative.id)}
                                className="h-8"
                              >
                                <FolderOpen className="h-4 w-4 mr-1" />
                                Selecionar no Drive
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addAdSet}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conjunto de Anúncios
              </Button>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4">
                {/* Campaign Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Informações da Campanha</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-semibold">{data.campaignName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Objetivo:</span>
                    <span className="font-semibold">{getCampaignObjectiveLabel(data.objective)}</span>
                  </div>
                </div>

                {/* Audience */}
                <div className="space-y-2 border-t pt-2">
                  <h4 className="font-semibold text-sm">Público-Alvo</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Faixa Etária:</span>
                    <span className="font-semibold">{data.ageMin} - {data.ageMax} anos</span>
                  </div>
                  {data.interests && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Interesses:</span>
                      <span className="font-semibold">{data.interests}</span>
                    </div>
                  )}
                </div>

                {/* Budget & Dates */}
                <div className="space-y-2 border-t pt-2">
                  <h4 className="font-semibold text-sm">Orçamento & Datas</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orçamento:</span>
                    <span className="font-semibold">R$ {data.budget}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Período:</span>
                    <span className="font-semibold">{data.startDate} até {data.endDate}</span>
                  </div>
                </div>

                {/* Ad Sets Summary */}
                <div className="space-y-2 border-t pt-2">
                  <h4 className="font-semibold text-sm">Conjuntos de Anúncios ({data.adSets.length})</h4>
                  {data.adSets.map((adSet, idx) => (
                    <div key={adSet.id} className="bg-white dark:bg-slate-950 p-2 rounded text-sm space-y-1">
                      <p className="font-medium">{adSet.name || `Conjunto ${idx + 1}`}</p>
                      <p className="text-xs text-muted-foreground">{adSet.creatives.length} criativo(s)</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-between relative z-10">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Anterior
        </Button>

        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          )}
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
              onClick={() => onSubmit(data)}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Salvando...' : submitLabel || 'Salvar Campanha'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={driveSelectorOpen} onOpenChange={setDriveSelectorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Selecionar Criativo do Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border overflow-hidden">
              <iframe src={DRIVE_EMBED_URL} className="w-full h-[520px]" allow="fullscreen" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Input
                type="url"
                placeholder="Cole aqui a URL do arquivo do Drive"
                value={driveSelectedUrl}
                onChange={(e) => setDriveSelectedUrl(e.target.value)}
                className="h-9"
              />
              <Button type="button" variant="secondary" size="sm" onClick={pasteFromClipboard} className="h-9">
                <Clipboard className="h-4 w-4 mr-1" />
                Colar do Clipboard
              </Button>
              <Button type="button" size="sm" onClick={applyDriveSelectedUrl} className="h-9">
                Usar URL
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDriveSelectorOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
