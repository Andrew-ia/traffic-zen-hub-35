import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { AICreativeGenerator } from './AICreativeGenerator';

interface AIGeneratorDialogProps {
  workspaceId: string;
  folderId?: string;
  onGenerated?: (assets: any[]) => void;
  trigger?: React.ReactNode;
}

export function AIGeneratorDialog({
  workspaceId,
  folderId,
  onGenerated,
  trigger,
}: AIGeneratorDialogProps) {
  const [open, setOpen] = useState(false);

  const handleGenerated = (assets: any[]) => {
    if (onGenerated) {
      onGenerated(assets);
    }
    // Close dialog after generation
    setTimeout(() => {
      setOpen(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar com IA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerador de Criativos com IA</DialogTitle>
          <DialogDescription>
            Use o Google Gemini AI para gerar criativos profissionais
            automaticamente
          </DialogDescription>
        </DialogHeader>
        <AICreativeGenerator
          workspaceId={workspaceId}
          folderId={folderId}
          onGenerated={handleGenerated}
        />
      </DialogContent>
    </Dialog>
  );
}
