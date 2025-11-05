import { useState, useEffect } from "react";
import { type CampaignLibraryItem, useCampaignLibrary } from "@/hooks/useCampaignLibrary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: CampaignLibraryItem | null;
  workspaceId: string;
}

export function CampaignFormModal({
  isOpen,
  onClose,
  campaign,
  workspaceId,
}: CampaignFormModalProps) {
  const { toast } = useToast();
  const { createCampaign, updateCampaign, uploadCreative } = useCampaignLibrary(workspaceId);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    objective: "",
    schedule_days: "",
    audience: "",
    budget: "",
    budget_type: "total",
    copy_primary: "",
    copy_title: "",
    cta: "",
    creative_url: "",
    creative_type: "",
    status: "rascunho",
    notes: "",
    tags: "",
    platform: "Meta",
  });

  // Initialize form with campaign data if editing
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || "",
        objective: campaign.objective || "",
        schedule_days: campaign.schedule_days || "",
        audience: campaign.audience || "",
        budget: campaign.budget?.toString() || "",
        budget_type: campaign.budget_type || "total",
        copy_primary: campaign.copy_primary || "",
        copy_title: campaign.copy_title || "",
        cta: campaign.cta || "",
        creative_url: campaign.creative_url || "",
        creative_type: campaign.creative_type || "",
        status: campaign.status || "rascunho",
        notes: campaign.notes || "",
        tags: campaign.tags?.join(", ") || "",
        platform: campaign.platform || "Meta",
      });
    } else {
      // Reset form for new campaign
      setFormData({
        name: "",
        objective: "",
        schedule_days: "",
        audience: "",
        budget: "",
        budget_type: "total",
        copy_primary: "",
        copy_title: "",
        cta: "",
        creative_url: "",
        creative_type: "",
        status: "rascunho",
        notes: "",
        tags: "",
        platform: "Meta",
      });
    }
  }, [campaign, isOpen]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(true);

    try {
      console.log('🚀 Iniciando processo de upload...');
      const url = await uploadCreative(file, workspaceId);

      if (url) {
        // Detect file type
        const fileType = file.type.startsWith("video/") ? "video" : "image";

        setFormData((prev) => ({
          ...prev,
          creative_url: url,
          creative_type: fileType,
        }));

        toast({
          title: "Upload concluído",
          description: `Arquivo "${file.name}" enviado com sucesso.`,
        });
      } else {
        throw new Error("Falha ao obter URL do arquivo");
      }
    } catch (error: any) {
      console.error('🔴 Erro capturado no componente:', error);
      toast({
        title: "Erro no upload",
        description: error?.message || "Não foi possível fazer upload do arquivo. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveCreative = () => {
    setFormData((prev) => ({
      ...prev,
      creative_url: "",
      creative_type: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira um nome para a campanha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const data = {
        workspace_id: workspaceId,
        name: formData.name.trim(),
        objective: formData.objective || null,
        schedule_days: formData.schedule_days || null,
        audience: formData.audience || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        budget_type: formData.budget_type,
        copy_primary: formData.copy_primary || null,
        copy_title: formData.copy_title || null,
        cta: formData.cta || null,
        creative_url: formData.creative_url || null,
        creative_type: formData.creative_type || null,
        status: formData.status,
        notes: formData.notes || null,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
        platform: formData.platform,
      };

      let result;
      if (campaign) {
        // Update existing campaign
        result = await updateCampaign(campaign.id, data);
      } else {
        // Create new campaign
        result = await createCampaign(data);
      }

      if (result) {
        toast({
          title: campaign ? "Campanha atualizada" : "Campanha criada",
          description: campaign
            ? "As alterações foram salvas com sucesso."
            : "Nova campanha adicionada à biblioteca.",
        });
        onClose();
      } else {
        throw new Error("Failed to save campaign");
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a campanha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {campaign ? "Editar Campanha" : "Nova Campanha"}
          </DialogTitle>
          <DialogDescription>
            {campaign
              ? "Atualize as informações da campanha."
              : "Adicione uma nova campanha à biblioteca."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Live Vermezzo - 23/10"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="objective">Objetivo</Label>
                <Select
                  value={formData.objective}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, objective: value }))
                  }
                >
                  <SelectTrigger id="objective">
                    <SelectValue placeholder="Selecione o objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engajamento">Engajamento</SelectItem>
                    <SelectItem value="Mensagens">Mensagens</SelectItem>
                    <SelectItem value="Conversões">Conversões</SelectItem>
                    <SelectItem value="Tráfego">Tráfego</SelectItem>
                    <SelectItem value="Reconhecimento">Reconhecimento</SelectItem>
                    <SelectItem value="Vendas">Vendas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Plataforma</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, platform: value }))
                  }
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meta">Meta</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Multi-plataforma">Multi-plataforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Público-Alvo</Label>
              <Input
                id="audience"
                placeholder="Ex: Mulheres 25-55, Santos +10km"
                value={formData.audience}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, audience: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="budget">Orçamento (R$)</Label>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, budget: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_type">Tipo</Label>
                <Select
                  value={formData.budget_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, budget_type: value }))
                  }
                >
                  <SelectTrigger id="budget_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule_days">Programação</Label>
              <Input
                id="schedule_days"
                placeholder="Ex: Seg, Qua, Sex - 15h às 22h"
                value={formData.schedule_days}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, schedule_days: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                placeholder="Ex: Black Friday, Verão 2024"
                value={formData.tags}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Ad Copy */}
          <div className="space-y-4">
            <h3 className="font-semibold">Conteúdo do Anúncio</h3>

            <div className="space-y-2">
              <Label htmlFor="copy_title">Título</Label>
              <Input
                id="copy_title"
                placeholder="Título curto do anúncio"
                value={formData.copy_title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, copy_title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy_primary">Texto Principal</Label>
              <Textarea
                id="copy_primary"
                placeholder="Texto principal do anúncio..."
                rows={4}
                value={formData.copy_primary}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, copy_primary: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">Call to Action (CTA)</Label>
              <Input
                id="cta"
                placeholder="Ex: Saiba Mais, Comprar Agora"
                value={formData.cta}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cta: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Creative Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold">Criativo</h3>

            <div className="space-y-2">
              <Label htmlFor="creative_file">Arquivo (Imagem ou Vídeo)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="creative_file"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="flex-1"
                />
                {uploadingFile && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos: JPG, PNG, GIF, WebP, MP4, WebM (máx. 50MB)
              </p>
            </div>

            {formData.creative_url && (
              <div className="relative rounded-lg border p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={handleRemoveCreative}
                >
                  <X className="h-4 w-4" />
                </Button>
                {formData.creative_type === "video" ? (
                  <video
                    src={formData.creative_url}
                    controls
                    className="w-full max-h-[300px] rounded object-contain bg-black"
                  />
                ) : (
                  <img
                    src={formData.creative_url}
                    alt="Preview"
                    className="w-full max-h-[300px] rounded object-contain"
                  />
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Anotações gerais, resultados de testes A/B, insights de performance..."
              rows={3}
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingFile}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {campaign ? "Salvar Alterações" : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
