import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Calendar, User, Trash2, Save, Paperclip, Upload, FileText, ExternalLink } from 'lucide-react';
import { useUpdatePMTask, useDeletePMTask, useUploadPMTaskAttachment, usePMTaskAttachments, useDeletePMTaskAttachment } from '@/hooks/useProjectManagement';
import { supabase } from '@/lib/supabaseClient';
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

const statusColors: Record<TaskStatus, string> = {
  pendente: 'bg-gray-500',
  em_andamento: 'bg-blue-500',
  concluido: 'bg-green-500',
  bloqueado: 'bg-red-500',
  cancelado: 'bg-gray-400',
};

const statusLabels: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
  cancelado: 'Cancelado',
};

const priorityColors: Record<TaskPriority, string> = {
  baixa: 'bg-gray-400',
  media: 'bg-yellow-500',
  alta: 'bg-orange-500',
  urgente: 'bg-red-600',
};

const priorityLabels: Record<TaskPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export function TaskDetailModal({ task, open, onOpenChange, workspaceId }: TaskDetailModalProps) {
  const updateTask = useUpdatePMTask();
  const deleteTask = useDeletePMTask();
  const uploadTaskAttachment = useUploadPMTaskAttachment();
  const deleteTaskAttachment = useDeletePMTaskAttachment();

  const [name, setName] = useState(task?.name || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'pendente');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'media');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { data: taskAttachments = [] } = usePMTaskAttachments(task?.id || undefined);

  // Extract template metadata if available
  const templateBlob = task?.metadata?.template_blob as any;
  const templateValues = templateBlob?.values || {};
  const templateName = templateBlob?.template || '';
  const templateCategory = templateBlob?.category || '';

  // Update local state when task changes
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
      toast({
        title: 'Tarefa atualizada!',
        description: 'As alterações foram salvas com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar tarefa',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
      await deleteTask.mutateAsync({
        workspaceId,
        taskId: task.id,
      });
      toast({
        title: 'Tarefa excluída!',
        description: 'A tarefa foi removida com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: 'Não foi possível excluir a tarefa.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
          <DialogTitle>Detalhes da Tarefa</DialogTitle>
          <DialogDescription>
            {task.folder_icon} {task.folder_name} / {task.list_icon} {task.list_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6">
          {/* Coluna Esquerda: Nome, Descrição, Tags */}
          <div className="space-y-6">
          {/* Name */}
          <div>
            <Label htmlFor="task-name">Nome da Tarefa</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da tarefa"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição..."
              rows={10}
            />
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="font-semibold text-sm mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Template Data */}
          {templateName && (
            <div className="border-t pt-6">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Dados do Template
              </h4>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">Template</span>
                  <Badge variant="secondary">{templateName}</Badge>
                </div>
                {templateCategory && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">Categoria</span>
                    <Badge variant="outline">{templateCategory}</Badge>
                  </div>
                )}

                {/* Display creative URLs if available */}
                {Object.entries(templateValues).map(([key, value]) => {
                  // Extract creative URLs (conjunto_X.criativo_Y.url pattern)
                  if (key.includes('criativo') && key.includes('.url') && value) {
                    const urlValue = String(value);
                    if (urlValue.startsWith('http')) {
                      const match = key.match(/conjunto_(\d+)\.criativo_(\d+)/);
                      const conjunto = match ? Number(match[1]) : 'N/A';
                      const criativo = match ? Number(match[2]) : 'N/A';
                      return (
                        <div key={key} className="py-2 px-3 rounded-md border border-dashed">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              Criativo {criativo} (Conjunto {conjunto})
                            </span>
                          </div>
                          <a
                            href={urlValue}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            {urlValue}
                          </a>
                        </div>
                      );
                    }
                  }
                  return null;
                })}

                {/* Display other important template fields */}
                {Object.entries(templateValues)
                  .filter(([key]) => {
                    // Show important fields but skip URLs and technical keys
                    const lowerKey = key.toLowerCase();
                    return (
                      (lowerKey.includes('nome') ||
                        lowerKey.includes('objetivo') ||
                        lowerKey.includes('orçamento') ||
                        lowerKey.includes('orcamento') ||
                        lowerKey.includes('data_de')) &&
                      !key.includes('.') && // Skip nested fields for now
                      key !== 'nome_da_campanha' // Skip duplicates already shown
                    );
                  })
                  .map(([key, value]) => {
                    if (!value || value === '') return null;
                    const displayKey = key.replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
                    return (
                      <div key={key} className="py-2 px-3 rounded-md bg-muted/30 text-xs">
                        <div className="font-medium text-muted-foreground mb-1">{displayKey}</div>
                        <div className="text-foreground break-words">{String(value)}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          </div>

          {/* Coluna Direita: Status/Prioridade, Informações, Contadores, Anexos */}
          <div className="space-y-6">

          {/* Status and Priority (vertical stack) */}
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusColors[value as TaskStatus]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${priorityColors[value as TaskPriority]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Counters (Informações removidas conforme solicitado) */}
          <div className="border-t pt-6">
            <div className="flex flex-col gap-2">
              <Badge variant="secondary">
                {task.subtask_count} subtarefa(s)
              </Badge>
              <Badge variant="secondary">
                {task.comment_count} comentário(s)
              </Badge>
              <Badge variant="secondary">
                {task.attachment_count} anexo(s)
              </Badge>
            </div>
          </div>

          </div>

          {/* Attachments Section */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <Paperclip className="h-4 w-4" />
              Anexos ({task.attachment_count || 0})
            </h4>
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                className={`px-2 py-1 transition-colors cursor-pointer ${isDragging ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) setAttachmentFile(file);
                }}
                onClick={() => {
                  const inputEl = document.getElementById('task-attachment') as HTMLInputElement | null;
                  inputEl?.click();
                }}
                aria-label="Arraste e solte o arquivo aqui ou clique para escolher"
              >
                <div className="flex items-center justify-start gap-2 text-sm">
                  <Upload className="h-4 w-4" />
                  <span>{attachmentFile ? `Selecionado: ${attachmentFile.name}` : 'Arraste e solte o arquivo aqui, ou clique para escolher'}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-3">
                {/* Input oculto */}
                <Input
                  type="file"
                  id="task-attachment"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                {/* Botão custom para escolher arquivo */}
                <Button
                  onClick={() => {
                    const inputEl = document.getElementById('task-attachment') as HTMLInputElement | null;
                    inputEl?.click();
                  }}
                  className="whitespace-nowrap"
                >
                  Escolher arquivo
                </Button>
                {/* Nome do arquivo selecionado */}
                <div className="h-10 rounded-md border bg-muted flex items-center px-3 text-sm text-foreground/80">
                  {attachmentFile ? attachmentFile.name : 'Nenhum arquivo escolhido'}
                </div>
                <Button
                  size="default"
                  variant="outline"
                  disabled={!attachmentFile || uploadTaskAttachment.isPending || !task}
                  onClick={async () => {
                    if (!attachmentFile || !task) return;
                    try {
                      const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
                      const timestamp = Date.now();
                      const path = `pm/${workspaceId}/tasks/${task.id}/${timestamp}-${sanitize(attachmentFile.name)}`;

                      const { error: uploadError } = await supabase.storage
                        .from('creatives')
                        .upload(path, attachmentFile, { contentType: attachmentFile.type });
                      if (uploadError) throw uploadError;

                      const { data: publicUrlData } = supabase.storage
                        .from('creatives')
                        .getPublicUrl(path);
                      const publicUrl = publicUrlData.publicUrl;

                      await uploadTaskAttachment.mutateAsync({
                        taskId: task.id,
                        data: {
                          file_name: attachmentFile.name,
                          file_url: publicUrl,
                          file_type: attachmentFile.type,
                          file_size: attachmentFile.size,
                        },
                      });

                      toast({ title: 'Anexo enviado', description: 'Arquivo anexado à tarefa com sucesso.' });
                      setAttachmentFile(null);
                      const inputEl = document.getElementById('task-attachment') as HTMLInputElement | null;
                      if (inputEl) inputEl.value = '';
                    } catch (err) {
                      console.error('Erro ao enviar anexo da tarefa:', err);
                      toast({ title: 'Falha ao enviar anexo', variant: 'destructive' });
                    }
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                📎 Anexe documentos, imagens ou arquivos relacionados a esta tarefa
              </p>
              {taskAttachments && taskAttachments.length > 0 && (
                <div className="mt-3 max-h-[40vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {taskAttachments.map((att: any) => (
                    <div
                      key={att.id}
                      className="border rounded-md p-3 flex items-center gap-3 hover:bg-muted"
                    >
                      {att.file_type?.startsWith('image/') ? (
                        <img src={att.file_url} alt={att.file_name} className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm truncate flex-1"
                        title={att.file_name}
                      >
                        {att.file_name}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            await deleteTaskAttachment.mutateAsync({ taskId: task.id, attachmentId: att.id });
                            toast({ title: 'Anexo removido', description: 'O documento foi removido da tarefa.' });
                          } catch (err) {
                            console.error('Erro ao remover anexo:', err);
                            toast({ title: 'Falha ao remover anexo', variant: 'destructive' });
                          }
                        }}
                        disabled={deleteTaskAttachment.isPending}
                        aria-label="Remover anexo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateTask.isPending || !name}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
