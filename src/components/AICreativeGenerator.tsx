import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { resolveApiBase } from '@/lib/apiBase';

const API_BASE = resolveApiBase();

interface AICreativeGeneratorProps {
  workspaceId: string;
  folderId?: string;
  onGenerated?: (assets: any[]) => void;
}

export function AICreativeGenerator({
  workspaceId,
  folderId,
  onGenerated,
}: AICreativeGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<any[]>([]);

  // Aspect ratio selection
  const [selectedRatios, setSelectedRatios] = useState<string[]>(['1:1']);

  const aspectRatios = [
    { value: '1:1', label: '1:1 - Feed/Stories Quadrado', icon: '⬜' },
    { value: '9:16', label: '9:16 - Stories Vertical', icon: '📱' },
    { value: '16:9', label: '16:9 - Feed Horizontal', icon: '🖼️' },
    { value: '4:5', label: '4:5 - Feed Social', icon: '📷' },
  ];

  const toggleRatio = (ratio: string) => {
    setSelectedRatios((prev) =>
      prev.includes(ratio)
        ? prev.filter((r) => r !== ratio)
        : [...prev, ratio]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Por favor, descreva o criativo que deseja gerar');
      return;
    }

    if (selectedRatios.length === 0) {
      setError('Selecione pelo menos um formato');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-creative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          workspaceId,
          folderId,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          aspectRatios: selectedRatios,
          numVariations: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar criativos');
      }

      setGeneratedAssets(data.assets || []);
      setSuccess(data.message || 'Criativos gerados com sucesso!');

      if (onGenerated) {
        onGenerated(data.assets || []);
      }

      // Reset form
      setPrompt('');
      setTags('');
    } catch (err) {
      console.error('Error generating:', err);
      setError(
        err instanceof Error ? err.message : 'Erro ao gerar criativos'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Gerador de Criativos com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prompt Input */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Descreva o criativo</Label>
          <Textarea
            id="prompt"
            placeholder="Ex: Uma imagem de produto moderno com fundo minimalista, cores vibrantes, estilo profissional para campanha de Black Friday..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Seja específico: produto, estilo, cores, mood, ocasião
          </p>
        </div>

        {/* Aspect Ratio Selection */}
        <div className="space-y-3">
          <Label>Formatos (selecione um ou mais)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aspectRatios.map((ratio) => (
              <div
                key={ratio.value}
                className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedRatios.includes(ratio.value)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleRatio(ratio.value)}
              >
                <Checkbox
                  id={ratio.value}
                  checked={selectedRatios.includes(ratio.value)}
                  onCheckedChange={() => toggleRatio(ratio.value)}
                />
                <label
                  htmlFor={ratio.value}
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <span className="text-2xl">{ratio.icon}</span>
                  <span className="text-sm font-medium">{ratio.label}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Tags Input */}
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (opcional)</Label>
          <Input
            id="tags"
            placeholder="Black Friday, Produto X, UGC (separados por vírgula)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim() || selectedRatios.length === 0}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando criativos...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar {selectedRatios.length} Criativo
              {selectedRatios.length > 1 ? 's' : ''}
            </>
          )}
        </Button>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Generated Assets Preview */}
        {generatedAssets.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Criativos Gerados ({generatedAssets.length})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {generatedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium truncate">
                      {asset.name}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {asset.aspect_ratio}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by Google Gemini AI
          </p>
          <p>
            Os criativos são salvos automaticamente na biblioteca e podem ser
            usados em campanhas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
