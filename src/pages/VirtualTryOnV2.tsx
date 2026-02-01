import { useState, useCallback, useRef } from 'react';
import { resolveApiBase } from '@/lib/apiBase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Camera, Loader2, Download, Upload, X, Trash2, Folder } from 'lucide-react';
import { generateVariations, type AspectRatio } from '@/services/virtualTryOnService';
import { useTryOnLooks, useDeleteTryOnLook } from '@/hooks/useTryOnLooks';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function VirtualTryOn() {
  const [activeTab, setActiveTab] = useState('generate');
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [clothingFile, setClothingFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [clothingPreview, setClothingPreview] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [imageCount, setImageCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [folderName, setFolderName] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const API_BASE = resolveApiBase();
  const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

  const { data: looksData, isLoading: isLoadingLooks, refetch: refetchLooks } = useTryOnLooks();
  const deleteLookMutation = useDeleteTryOnLook();

  const handleModelFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setError(null);
    setModelPreview(null);
    setModelFile(null);
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 8) {
      setError(`Arquivo muito grande (${sizeMB.toFixed(1)}MB). Máximo 8MB.`);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 512 || img.naturalHeight < 512) {
        setError('Resolução muito baixa. Mínimo 512x512.');
        URL.revokeObjectURL(url);
        return;
      }
      setModelPreview(url);
      setModelFile(file);
    };
    img.onerror = () => {
      setError('Não foi possível ler a imagem da modelo.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleClothingFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setError(null);
    setClothingPreview(null);
    setClothingFile(null);
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 8) {
      setError(`Arquivo muito grande (${sizeMB.toFixed(1)}MB). Máximo 8MB.`);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 512 || img.naturalHeight < 512) {
        setError('Resolução muito baixa. Mínimo 512x512.');
        URL.revokeObjectURL(url);
        return;
      }
      setClothingPreview(url);
      setClothingFile(file);
    };
    img.onerror = () => {
      setError('Não foi possível ler a imagem da roupa.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleClearModel = useCallback(() => {
    setModelPreview(null);
    setModelFile(null);
  }, []);

  const handleClearClothing = useCallback(() => {
    setClothingPreview(null);
    setClothingFile(null);
  }, []);

  const handleGenerateClick = useCallback(async () => {
    if (!modelFile || !clothingFile) {
      setError('Por favor, carregue a imagem da modelo e da roupa.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setProgress({ current: 0, total: imageCount });

    try {
      abortControllerRef.current = new AbortController();
      const result = await generateVariations(
        modelFile,
        clothingFile,
        imageCount,
        (current, total) => {
          setProgress({ current, total });
        },
        { aspectRatio, brandName: 'Vermezzo', signal: abortControllerRef.current.signal }
      );
      setGeneratedImages(result.images);

      // Show warning if we got fewer images than requested
      if (result.images.length < imageCount) {
        setError(
          `Limite de quota atingido. Foram geradas ${result.images.length} de ${imageCount} imagens solicitadas. Aguarde alguns minutos antes de gerar mais.`
        );
      }

      // Auto-save generated images to database
      if (result.images.length > 0) {
        try {
          const response = await fetch(`${API_BASE}/api/creatives/save-tryon`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: result.images,
              workspaceId: WORKSPACE_ID,
              modelName: modelFile.name.replace(/\.[^/.]+$/, ''), // Remove extension
              clothingName: clothingFile.name.replace(/\.[^/.]+$/, ''), // Remove extension
              folderName: folderName.trim() || null,
              aspectRatio,
            }),
          });

          const saveResult = await response.json();
          if (saveResult.success) {
            console.log(`✅ ${saveResult.savedCount} imagens salvas automaticamente`);
            // Refetch looks after saving
            refetchLooks();
          } else {
            console.error('⚠️ Erro ao salvar imagens:', saveResult.error);
          }
        } catch (saveError) {
          console.error('⚠️ Erro ao salvar imagens:', saveError);
          // Don't show error to user, just log it
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 'Falha ao gerar imagens. A API pode estar indisponível ou as imagens podem ser inválidas. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
      abortControllerRef.current = null;
    }
  }, [modelFile, clothingFile, imageCount, aspectRatio, folderName, refetchLooks, API_BASE, WORKSPACE_ID]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setError('Geração cancelada pelo usuário.');
    }
  }, []);

  const handleDeleteLook = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este look?')) return;

    try {
      await deleteLookMutation.mutateAsync(id);
    } catch (error) {
      console.error('Erro ao deletar look:', error);
    }
  }, [deleteLookMutation]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Gerador de Looks com IA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Vista qualquer modelo com qualquer roupa. Faça o upload das imagens e
            deixe a IA criar variações realistas em segundos.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="generate">Gerar Looks</TabsTrigger>
            <TabsTrigger value="library">
              Looks Gerados
              {looksData?.totalImages ? ` (${looksData.totalImages})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-8">
            {/* Upload Section */}
            <Card className="mb-8">
              <CardContent className="p-6 md:p-10">
                {/* Folder Name */}
                <div className="mb-6">
                  <Label htmlFor="folder-name" className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Nome da Pasta (opcional)
                  </Label>
                  <Input
                    id="folder-name"
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Ex: Coleção Verão 2024"
                    className="max-w-md"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se não informar, será criado automaticamente: Modelo × Roupa
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Model Upload */}
                  <ImageUploader
                    label="1. Foto da Modelo"
                    preview={modelPreview}
                    onFileChange={handleModelFileChange}
                    onClear={handleClearModel}
                    accept="image/png, image/jpeg, image/webp"
                  />

                  {/* Clothing Upload */}
                  <ImageUploader
                    label="2. Foto da Roupa"
                    preview={clothingPreview}
                    onFileChange={handleClothingFileChange}
                    onClear={handleClearClothing}
                    accept="image/png, image/jpeg, image/webp"
                  />
                </div>

                {/* Image Count & Aspect Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Quantas variações gerar?
                  </label>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3].map((count) => (
                      <button
                        key={count}
                        onClick={() => setImageCount(count)}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-md transition-colors ${
                          imageCount === count
                            ? 'bg-purple-500 text-white'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Menos imagens = menos uso da quota da API
                  </p>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <label className="text-sm text-muted-foreground">Aspecto</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                      className="border rounded px-2 py-1 text-sm"
                      disabled={isLoading}
                    >
                      <option value="9:16">9:16 (Stories)</option>
                      <option value="4:5">4:5 (Feed)</option>
                      <option value="1:1">1:1 (Quadrado)</option>
                      <option value="16:9">16:9 (Paisagem)</option>
                    </select>
                  </div>
                </div>

                {/* Generate / Cancel Buttons */}
                <div className="text-center">
                  <Button
                    onClick={handleGenerateClick}
                    disabled={!modelFile || !clothingFile || isLoading}
                    size="lg"
                    className="w-full md:w-auto px-8 py-6 text-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Gerando Variações...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-5 w-5" />
                        Gerar {imageCount} {imageCount === 1 ? 'Variação' : 'Variações'}
                      </>
                    )}
                  </Button>
                  {isLoading && (
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      className="mt-3 w-full md:w-auto"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-8">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading Message */}
            {isLoading && (
              <div className="text-center text-purple-500 mb-8">
                <p className="mb-2">A IA está criando suas imagens. Isso pode levar alguns instantes...</p>
                {progress.total > 0 && (
                  <p className="text-sm">
                    Gerando imagem {progress.current} de {progress.total}
                  </p>
                )}
              </div>
            )}

            {/* Generated Images */}
            {generatedImages.length > 0 && (
              <div className="mt-16">
                <h2 className="text-3xl font-bold text-center mb-2">
                  Resultados Gerados
                </h2>
                <p className="text-center text-muted-foreground mb-8">
                  Imagens geradas no aspecto {aspectRatio}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {generatedImages.map((src, index) => (
                    <Card
                      key={index}
                      className="overflow-hidden transition-transform duration-300 hover:scale-105"
                    >
                      <div className="relative group">
                        <img
                          src={src}
                          alt={`Variação Gerada ${index + 1}`}
                          className="w-full h-auto object-cover aspect-[9/16]"
                        />
                        <a
                          href={src}
                          download={`variacao-story-${index + 1}.png`}
                          className="absolute bottom-3 right-3 bg-purple-500/80 text-white rounded-full p-2 backdrop-blur-sm transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-purple-600"
                          aria-label="Baixar imagem"
                          title="Baixar imagem"
                        >
                          <Download className="w-6 h-6" />
                        </a>
                      </div>
                      <div className="p-4 bg-muted/50">
                        <p className="text-center font-semibold">Variação {index + 1}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="mt-8">
            {isLoadingLooks ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
                <p className="text-muted-foreground">Carregando looks...</p>
              </div>
            ) : looksData?.folders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum look gerado ainda</h3>
                  <p className="text-muted-foreground mb-6">
                    Comece gerando seus primeiros looks na aba "Gerar Looks"
                  </p>
                  <Button onClick={() => setActiveTab('generate')}>
                    Gerar Primeiro Look
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {looksData?.folders.map((folder, folderIdx) => (
                  <Card key={folderIdx}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-purple-500" />
                          <div>
                            <h3 className="font-semibold text-lg">{folder.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {folder.count} {folder.count === 1 ? 'imagem' : 'imagens'} •{' '}
                              {formatDistanceToNow(new Date(folder.lastGenerated), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {folder.images.map((image) => (
                          <div key={image.id} className="relative group">
                            <img
                              src={image.url}
                              alt={image.name}
                              className="w-full h-auto object-cover rounded-lg aspect-[9/16]"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <a
                                href={image.url}
                                download={`${folder.name}-${image.id}.png`}
                                className="bg-white/90 text-black rounded-full p-2 hover:bg-white transition-colors"
                                aria-label="Baixar"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteLook(image.id)}
                                className="bg-red-500/90 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                                aria-label="Deletar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="text-center py-6 text-muted-foreground/50 mt-12">
          <p>Desenvolvido com a API Google Gemini</p>
        </footer>
      </div>
    </div>
  );
}

// Image Uploader Component
interface ImageUploaderProps {
  label: string;
  preview: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  accept: string;
}

function ImageUploader({
  label,
  preview,
  onFileChange,
  onClear,
  accept,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col items-center">
      <h3 className="text-xl font-semibold mb-4 text-muted-foreground">{label}</h3>
      <div
        className="relative w-full aspect-square bg-muted/50 rounded-lg border-2 border-dashed border-muted flex items-center justify-center cursor-pointer transition-all duration-300 hover:border-purple-500 hover:bg-muted overflow-hidden"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileChange}
        />
        {preview ? (
          <>
            <img
              src={preview}
              alt="Pré-visualização"
              className="w-full h-full object-cover rounded-lg"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-2 right-2 bg-black/50 rounded-full text-white hover:bg-black/80 transition-colors p-1"
              aria-label="Remover imagem"
            >
              <X className="w-6 h-6" />
            </button>
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="w-12 h-12 mx-auto mb-2" />
            <p>Clique para carregar</p>
            <p className="text-xs">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
    </div>
  );
}
