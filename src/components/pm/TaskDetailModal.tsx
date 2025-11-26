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
import { CampaignFormWizard, type CampaignData } from './CampaignFormWizard';
import { getCampaignObjectiveLabel } from '@/constants/campaignObjectives';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';

interface TaskDetailModalProps {
  task: PMTaskFull | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

type TaskAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
};

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

function formatPlainDate(value?: string | null) {
  if (!value) return '-';
  const [datePart] = value.split('T');
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

export function TaskDetailModal({ task, open, onOpenChange, workspaceId }: TaskDetailModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pendente');
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [isEditingTaskDetails, setIsEditingTaskDetails] = useState(false);
  const [campaignDetails, setCampaignDetails] = useState<CampaignData | null>(null);

  const { data: taskAttachmentsRaw = [] } = usePMTaskAttachments(task?.id || undefined);
  const taskAttachments = taskAttachmentsRaw as TaskAttachment[];
  const { data: members = [] } = useWorkspaceMembers();
  const updateTask = useUpdatePMTask();
  const deleteTask = useDeletePMTask();
  const uploadAttachment = useUploadPMTaskAttachment();
  const deleteAttachment = useDeletePMTaskAttachment();

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority || 'media');
      setAttachmentFile(null);
      setCampaignDetails((task.metadata?.campaign_data as CampaignData) || null);
      setIsEditingCampaign(false);
      setIsEditingTaskDetails(false);
      setAssigneeId(task.assignee_id || undefined);
      setDueDate(
        task.due_date
          ? (() => {
              const val = String(task.due_date);
              const datePart = val.split('T')[0];
              const match = datePart.match(/^\d{4}-\d{2}-\d{2}$/);
              return match ? datePart : datePart || undefined;
            })()
          : undefined
      );
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
          assignee_id: assigneeId,
          due_date: dueDate,
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
    if (!attachmentFile || !task) return;
    try {
      // Convert file to Base64/data URL
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(attachmentFile);
      });

      await uploadAttachment.mutateAsync({
        taskId: task.id,
        data: {
          file_name: attachmentFile.name,
          file_url: fileData,
          file_type: attachmentFile.type,
          file_size: attachmentFile.size,
        },
      });
      setAttachmentFile(null);
      toast({ title: 'Arquivo enviado com sucesso' });
    } catch (error) {
      console.error('Upload error:', error);
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

  const handleCampaignUpdate = async (data: CampaignData) => {
    if (!task) return;
    try {
      await updateTask.mutateAsync({
        workspaceId,
        taskId: task.id,
        data: {
          metadata: {
            ...(task.metadata || {}),
            campaign_data: data,
          },
        },
      });
      setCampaignDetails(data);
      setIsEditingCampaign(false);
      toast({ title: 'Campanha atualizada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar campanha', variant: 'destructive' });
    }
  };

  const campaignData = campaignDetails;
  const formatCurrency = (value?: string | number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return value || '-';
    }
    return parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const statusOption = statusOptions.find(s => s.value === status);
  const priorityOption = priorityOptions.find(p => p.value === priority);
  const assigneeDisplay = assigneeId
    ? members.find((m) => m.userId === assigneeId)?.name || members.find((m) => m.userId === assigneeId)?.email || assigneeId
    : 'Sem responsável';

  const handleAttachmentClick = (attachment: TaskAttachment) => {
    if (!attachment?.file_url) return;

    const url = attachment.file_url;
    if (url.startsWith('data:')) {
      const commaIndex = url.indexOf(',');
      if (commaIndex === -1) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const header = url.substring(0, commaIndex);
      const base64 = url.substring(commaIndex + 1);
      const mimeMatch = header.match(/^data:(.*?)(;base64)?$/);
      const mimeType = mimeMatch?.[1] || attachment.file_type || 'application/octet-stream';

      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = attachment.file_name || 'anexo';
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      } catch (error) {
        console.error('Falha ao abrir anexo base64', error);
        toast({ title: 'Não foi possível abrir o anexo', variant: 'destructive' });
      }
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground">Informações Básicas</h3>
              <Button
                size="sm"
                variant={isEditingTaskDetails ? 'secondary' : 'outline'}
                onClick={() => setIsEditingTaskDetails((prev) => !prev)}
              >
                {isEditingTaskDetails ? 'Fechar edição' : 'Editar tarefa'}
              </Button>
            </div>

            {isEditingTaskDetails ? (
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
                    className="mt-1 min-h-[160px] resize-y"
                    placeholder="Descreva o que precisa ser feito"
                    rows={6}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignee">Responsável</Label>
                    <Select value={assigneeId ?? '__none__'} onValueChange={(v) => setAssigneeId(v === '__none__' ? undefined : v)}>
                      <SelectTrigger id="assignee" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem responsável</SelectItem>
                        {members.map(m => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.name || m.email || m.userId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">Prazo</Label>
                    <Input id="due_date" type="date" value={dueDate || ''} onChange={(e) => setDueDate(e.target.value || undefined)} className="mt-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
                <div>
                  <span className="text-xs text-muted-foreground">Nome</span>
                  <p className="font-semibold text-sm">{name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Descrição</span>
                  <p className="text-sm whitespace-pre-wrap mt-1">
                    {description || 'Sem descrição fornecida.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1">
                      {statusOption ? (
                        <Badge className={`${statusOption.color} text-white`}>{statusOption.label}</Badge>
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Prioridade</span>
                    <div className="mt-1">
                      {priorityOption ? (
                        <Badge variant="outline" className={priorityOption.color}>{priorityOption.label}</Badge>
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Responsável</span>
                    <p className="mt-1 font-medium">{assigneeDisplay}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Prazo</span>
                    <p className="mt-1 font-medium">{dueDate ? formatPlainDate(dueDate) : 'Sem prazo'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Campaign Data */}
          {campaignData && Object.keys(campaignData).length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Campanha Meta Ads
                </h3>
                <Button
                  size="sm"
                  variant={isEditingCampaign ? 'secondary' : 'outline'}
                  onClick={() => setIsEditingCampaign(!isEditingCampaign)}
                >
                  {isEditingCampaign ? 'Fechar edição' : 'Editar campanha'}
                </Button>
              </div>

              {isEditingCampaign ? (
                <div className="border rounded-lg p-3 bg-background">
                  <CampaignFormWizard
                    initialData={campaignData}
                    onSubmit={handleCampaignUpdate}
                    onCancel={() => setIsEditingCampaign(false)}
                    isLoading={updateTask.isPending}
                    submitLabel={updateTask.isPending ? 'Salvando...' : 'Atualizar Campanha'}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
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
                            <p className="font-medium text-sm">{getCampaignObjectiveLabel(campaignData.objective)}</p>
                          </div>
                        )}
                      </div>
                    )}

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

                    {(campaignData.budget || campaignData.startDate || campaignData.endDate) && (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Orçamento & Datas</div>
                        {campaignData.budget && (
                          <div>
                            <span className="text-xs text-muted-foreground">Orçamento:</span>
                            <p className="font-medium text-sm text-green-600">{formatCurrency(campaignData.budget)}</p>
                          </div>
                        )}
                        {campaignData.startDate && (
                          <div>
                            <span className="text-xs text-muted-foreground">Início:</span>
                            <p className="font-medium text-sm">{formatPlainDate(campaignData.startDate)}</p>
                          </div>
                        )}
                        {campaignData.endDate && (
                          <div>
                            <span className="text-xs text-muted-foreground">Término:</span>
                            <p className="font-medium text-sm">{formatPlainDate(campaignData.endDate)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {campaignData.adSets && campaignData.adSets.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Conjuntos de Anúncios ({campaignData.adSets.length})</div>
                      <div className="space-y-3">
                        {campaignData.adSets.map((adSet: any, adSetIdx: number) => (
                          <div key={adSet.id} className="border rounded-lg p-3 bg-muted/30 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Conjunto #{adSetIdx + 1}</p>
                              <p className="font-medium text-sm">{adSet.name}</p>
                            </div>

                            {adSet.creatives && adSet.creatives.length > 0 && (
                              <div className="space-y-2 border-t pt-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase">Criativos ({adSet.creatives.length})</div>
                                <div className="space-y-2">
                                  {adSet.creatives.map((creative: any, creativeIdx: number) => (
                                    <div key={creative.id} className="bg-white dark:bg-slate-950 p-2 rounded border text-sm space-y-1">
                                      <p className="text-xs font-semibold text-muted-foreground">Criativo #{creativeIdx + 1}</p>
                                      {creative.headline && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Título:</span>
                                          <p className="font-medium">{creative.headline}</p>
                                        </div>
                                      )}
                                      {creative.primaryText && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Texto Principal:</span>
                                          <p className="text-xs">{creative.primaryText}</p>
                                        </div>
                                      )}
                                      {creative.description && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Descrição:</span>
                                          <p className="text-xs">{creative.description}</p>
                                        </div>
                                      )}
                                      {creative.cta && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">CTA:</span>
                                          <Badge variant="secondary" className="ml-1 text-xs">{creative.cta}</Badge>
                                        </div>
                                      )}
                                      {creative.creativeUrl && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">URL:</span>
                                          <p className="text-xs text-blue-600 break-all font-mono">{creative.creativeUrl}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                    <button
                      type="button"
                      onClick={() => handleAttachmentClick(att)}
                      className="text-sm text-blue-600 hover:underline truncate text-left"
                    >
                      {att.file_name}
                    </button>
                  </div>
                  <button
                    type="button"
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
          {isEditingTaskDetails ? (
            <Button
              onClick={() => {
                handleSave();
                setIsEditingTaskDetails(false);
              }}
              disabled={updateTask.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateTask.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditingTaskDetails(true)}>
              Editar detalhes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
