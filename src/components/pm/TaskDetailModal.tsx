import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Trash2, Save, Paperclip, Upload, FileText } from 'lucide-react';
import { useUpdatePMTask, useDeletePMTask, useUploadPMTaskAttachment, usePMTaskAttachments, useDeletePMTaskAttachment } from '@/hooks/useProjectManagement';
import { toast } from '@/hooks/use-toast';
import type { PMTaskFull, TaskStatus, TaskPriority } from '@/types/project-management';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDetailModalProps {
  task: PMTaskFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'pendente', label: 'Pendente', color: 'bg-gray-500' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'bg-blue-500' },
  { value: 'concluido', label: 'Concluído', color: 'bg-green-500' },
  { value: 'bloqueado', label: 'Bloqueado', color: 'bg-red-500' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-gray-400' },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'bg-blue-100 text-blue-800' },
  { value: 'media', label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800' },
];

export function TaskDetailModal({ task, open, onOpenChange, workspaceId }: TaskDetailModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pendente');
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: taskAttachments = [] } = usePMTaskAttachments(task?.id || undefined);
  const updateTask = useUpdatePMTask();
  const deleteTask = useDeletePMTask();
  const uploadAttachment = useUploadPMTaskAttachment();
  const deleteAttachment = useDeletePMTaskAttachment();

  // Extract campaign data if available
  const campaignData = task?.metadata?.campaign_data as any;

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority || 'media');
      setAttachmentFile(null);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    try {
      await updateTask.mutateAsync({
        workspaceId,
        taskId: task.id,
        data: {
          name,
          description,
          status,
          priority,
        },
      });
      toast({ title: 'Tarefa atualizada com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar tarefa', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar esta tarefa?')) return;
    try {
      await deleteTask.mutateAsync({ workspaceId, taskId: task.id });
      onOpenChange(false);
      toast({ title: 'Tarefa deletada com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao deletar tarefa', variant: 'destructive' });
    }
  };

  const handleAttachmentUpload = async () => {
    if (!attachmentFile) return;
    try {
      await uploadAttachment.mutateAsync({
        workspaceId,
        taskId: task.id,
        file: attachmentFile,
      });
      setAttachmentFile(null);
      toast({ title: 'Arquivo enviado com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao enviar arquivo', variant: 'destructive' });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await deleteAttachment.mutateAsync({
        workspaceId,
        taskId: task.id,
        attachmentId,
      });
      toast({ title: 'Arquivo removido' });
    } catch (error) {
      toast({ title: 'Erro ao remover arquivo', variant: 'destructive' });
    }
  };

  const statusOption = statusOptions.find(s => s.value === status);
  const priorityOption = priorityOptions.find(p => p.value === priority);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{task.name}</DialogTitle>
              <div className="flex gap-2 flex-wrap">
                {statusOption && (
                  <Badge className={`${statusOption.color} text-white`}>
                    {statusOption.label}
                  </Badge>
                )}
                {priorityOption && (
                  <Badge variant="outline" className={priorityOption.color}>
                    {priorityOption.label}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div>Criada: {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ptBR })}</div>
              {task.updated_at && (
                <div>Atualizada: {format(new Date(task.updated_at), 'dd MMM yyyy', { locale: ptBR })}</div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Informações Básicas</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="name">Nome da Tarefa</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                    <SelectTrigger id="status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                    <SelectTrigger id="priority" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Data */}
          {campaignData && Object.keys(campaignData).length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Campanha Meta Ads
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Campaign Info */}
                {(campaignData.campaignName || campaignData.objective) && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Informações</div>
                    {campaignData.campaignName && (
                      <div>
                        <span className="text-xs text-muted-foreground">Nome:</span>
                        <p className="font-medium text-sm">{campaignData.campaignName}</p>
                      </div>
                    )}
                    {campaignData.objective && (
                      <div>
                        <span className="text-xs text-muted-foreground">Objetivo:</span>
                        <p className="font-medium text-sm capitalize">{campaignData.objective}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audience */}
                {(campaignData.ageMin || campaignData.ageMax || campaignData.interests) && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Público-Alvo</div>
                    {(campaignData.ageMin || campaignData.ageMax) && (
                      <div>
                        <span className="text-xs text-muted-foreground">Faixa Etária:</span>
                        <p className="font-medium text-sm">{campaignData.ageMin} - {campaignData.ageMax} anos</p>
                      </div>
                    )}
                    {campaignData.interests && (
                      <div>
                        <span className="text-xs text-muted-foreground">Interesses:</span>
                        <p className="font-medium text-sm">{campaignData.interests}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Budget & Dates */}
                {(campaignData.budget || campaignData.startDate || campaignData.endDate) && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Orçamento & Datas</div>
                    {campaignData.budget && (
                      <div>
                        <span className="text-xs text-muted-foreground">Orçamento:</span>
                        <p className="font-medium text-sm text-green-600">R$ {Number(campaignData.budget).toFixed(2)}</p>
                      </div>
                    )}
                    {campaignData.startDate && (
                      <div>
                        <span className="text-xs text-muted-foreground">Início:</span>
                        <p className="font-medium text-sm">{new Date(campaignData.startDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                    {campaignData.endDate && (
                      <div>
                        <span className="text-xs text-muted-foreground">Término:</span>
                        <p className="font-medium text-sm">{new Date(campaignData.endDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Creatives */}
                {(campaignData.primaryText || campaignData.headline || campaignData.description || campaignData.cta || campaignData.creativeUrl) && (
                  <div className="space-y-3 col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Criativos</div>
                    <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                      {campaignData.headline && (
                        <div>
                          <span className="text-xs text-muted-foreground">Título:</span>
                          <p className="font-medium text-sm">{campaignData.headline}</p>
                        </div>
                      )}
                      {campaignData.primaryText && (
                        <div>
                          <span className="text-xs text-muted-foreground">Texto Principal:</span>
                          <p className="text-sm">{campaignData.primaryText}</p>
                        </div>
                      )}
                      {campaignData.description && (
                        <div>
                          <span className="text-xs text-muted-foreground">Descrição:</span>
                          <p className="text-sm">{campaignData.description}</p>
                        </div>
                      )}
                      {campaignData.cta && (
                        <div>
                          <span className="text-xs text-muted-foreground">CTA:</span>
                          <Badge variant="secondary" className="ml-2">{campaignData.cta}</Badge>
                        </div>
                      )}
                      {campaignData.creativeUrl && (
                        <div>
                          <span className="text-xs text-muted-foreground">URL do Criativo:</span>
                          <p className="text-sm text-blue-600 break-all font-mono text-xs">{campaignData.creativeUrl}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Anexos
            </h3>

            <div className="space-y-2">
              {taskAttachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {att.file_name}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Adicionar Anexo</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    setAttachmentFile(files[0]);
                  }
                }}
              >
                <input
                  id="attachment"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      setAttachmentFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="attachment" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">
                    {attachmentFile ? attachmentFile.name : 'Clique ou arraste um arquivo'}
                  </p>
                </label>
              </div>
              {attachmentFile && (
                <Button
                  onClick={handleAttachmentUpload}
                  disabled={uploadAttachment.isPending}
                  className="w-full"
                >
                  {uploadAttachment.isPending ? 'Enviando...' : 'Enviar Arquivo'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Deletar
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTask.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateTask.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
