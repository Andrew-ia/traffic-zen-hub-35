import { type CampaignLibraryItem } from "@/hooks/useCampaignLibrary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Calendar,
  Target,
  Users,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Video,
  Tag,
  MessageSquare,
  ExternalLink,
} from "lucide-react";

interface CampaignDetailsModalProps {
  campaign: CampaignLibraryItem;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function CampaignDetailsModal({
  campaign,
  isOpen,
  onClose,
  onCopy,
}: CampaignDetailsModalProps) {
  const formatBudget = (budget: number | null, budgetType: string) => {
    if (!budget) return "Não definido";
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(budget);
    return budgetType === "daily" ? `${formatted} por dia` : formatted;
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getCreativePreview = () => {
    if (!campaign.creative_url) return null;

    const isVideo = campaign.creative_type === "video" ||
                    campaign.creative_url.match(/\.(mp4|mov|webm|avi)$/i);

    if (isVideo) {
      return (
        <video
          src={campaign.creative_url}
          controls
          className="w-full max-h-[400px] rounded-lg object-contain bg-black"
        >
          Seu navegador não suporta o elemento de vídeo.
        </video>
      );
    }

    // Check if it's a base64 image or regular URL
    const isBase64 = campaign.creative_url.startsWith('data:image/');
    const isImageUrl = isBase64 || campaign.creative_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);

    if (isImageUrl) {
      return (
        <img
          src={campaign.creative_url}
          alt={campaign.name}
          className="w-full max-h-[400px] rounded-lg object-contain"
        />
      );
    }

    // Fallback for other types
    return (
      <a
        href={campaign.creative_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-600 hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Ver arquivo criativo
      </a>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{campaign.name}</DialogTitle>
          <DialogDescription>
            Criado em {formatDate(campaign.created_at)}
            {campaign.last_used_at && (
              <> • Último uso em {formatDate(campaign.last_used_at)}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={campaign.status === "ativo" ? "default" : "outline"}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
            {campaign.tags && campaign.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>

          {/* Objective and Platform */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Objetivo
              </div>
              <p className="font-medium">{campaign.objective || "Não definido"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Plataforma
              </div>
              <p className="font-medium">{campaign.platform}</p>
            </div>
          </div>

          <Separator />

          {/* Audience */}
          {campaign.audience && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Público-Alvo
              </div>
              <p className="font-medium">{campaign.audience}</p>
            </div>
          )}

          {/* Budget */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Orçamento
            </div>
            <p className="font-medium">
              {formatBudget(campaign.budget, campaign.budget_type)}
            </p>
          </div>

          {/* Schedule */}
          {campaign.schedule_days && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Programação
              </div>
              <p className="font-medium">{campaign.schedule_days}</p>
            </div>
          )}

          <Separator />

          {/* Ad Copy */}
          {campaign.copy_title && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Título do Anúncio
              </div>
              <p className="font-medium">{campaign.copy_title}</p>
            </div>
          )}

          {campaign.copy_primary && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Texto Principal
              </div>
              <p className="font-medium whitespace-pre-wrap">{campaign.copy_primary}</p>
            </div>
          )}

          {campaign.cta && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Call to Action
              </div>
              <p className="font-medium">{campaign.cta}</p>
            </div>
          )}

          {/* Creative Preview */}
          {campaign.creative_url && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {campaign.creative_type === "video" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  Criativo
                </div>
                {getCreativePreview()}
              </div>
            </>
          )}

          {/* Notes */}
          {campaign.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Observações
                </div>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                  {campaign.notes}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar para Nova Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
