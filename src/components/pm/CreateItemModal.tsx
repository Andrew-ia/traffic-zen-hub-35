import { useState, useMemo, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, FileText, Bell, LayoutGrid, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { TaskStatus, TaskPriority, ReminderNotifyVia } from '@/types/project-management';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CampaignFormWizard } from './CampaignFormWizard';
// removed duplicate react import

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (data: {
    name: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    attachments?: File[];
    metadata?: Record<string, any>;
  }) => void;
  onCreateDocument?: (data: { name: string; content: string; file?: File }) => void;
  onCreateReminder?: (data: {
    name: string;
    description: string;
    dueDate: string;
    notifyVia: ReminderNotifyVia;
    email?: string;
    phone?: string;
    telegram_chat_id?: string;
  }) => void;
  folderName?: string;
  listName?: string;
}

export function CreateItemModal({
  open,
  onOpenChange,
  onCreateTask,
  onCreateDocument,
  onCreateReminder,
  folderName,
  listName,
}: CreateItemModalProps) {
  const [activeTab, setActiveTab] = useState('task');
  const { data: members = [], isLoading: isMembersLoading } = useWorkspaceMembers();

  // Task fields
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('pendente');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('__none__');
  const [taskDueDate, setTaskDueDate] = useState<string>('');

  // Document fields
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Reminder fields
  const [reminderName, setReminderName] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [reminderNotifyVia, setReminderNotifyVia] = useState<ReminderNotifyVia>('email');
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderPhone, setReminderPhone] = useState('');
  const [reminderTelegram, setReminderTelegram] = useState('');
  const [reminderAssigneeId, setReminderAssigneeId] = useState<string>('__none__');

  // Campaign assignee/prazo
  const [campaignAssigneeId, setCampaignAssigneeId] = useState<string>('__none__');
  const [campaignDueDate, setCampaignDueDate] = useState<string>('');

  // Estado para template selecionado
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

  // Templates: tipos e estado
  type TemplateFieldType =
    | 'text'
    | 'number'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'toggle'
    | 'group'
    | 'range'
    | 'user_select'
    | 'file_upload'
    | 'checklist';

  interface TemplateField {
    label: string;
    type: TemplateFieldType;
    options?: string[];
    default?: any;
    placeholder?: string;
    required?: boolean;
    optional?: boolean;
    min?: number;
    max?: number;
    items?: string[];
    fields?: TemplateField[];
  }

  interface TemplateSection {
    title: string;
    fields: TemplateField[];
  }

  interface TaskTemplate {
    template_name: string;
    category?: string;
    sections: TemplateSection[];
  }

  const META_CAMPAIGN_TEMPLATE: TaskTemplate = {
    template_name: 'Campanha Meta Ads',
    category: 'Mídia Paga',
    sections: [
      {
        title: 'Informações Gerais',
        fields: [
          { label: 'Objetivo da Campanha', type: 'select', options: ['Reconhecimento', 'Tráfego', 'Engajamento', 'Leads', 'Vendas', 'Promoção de App'], required: true },
          { label: 'Nome da Campanha', type: 'text', placeholder: 'Ex: Black Friday Vermezzo 2025', required: true },
        ],
      },
      {
        title: 'Configurações de Campanha',
        fields: [
          { label: 'Data de Início', type: 'date' },
          { label: 'Data de Término', type: 'date', optional: true },
          { label: 'Valor do Orçamento (R$)', type: 'number', placeholder: 'Ex: 40,00' },
        ],
      },
      {
        title: 'Conjunto de Anúncios',
        fields: [
          { label: 'Nome do Conjunto de Anúncios', type: 'text', placeholder: 'Ex: Público Frio - Mulheres 25-44' },
          { label: 'Qtd. de Conjuntos de Anúncios', type: 'select', options: ['1', '2', '3'], default: '1' },
          {
            label: 'Programação',
            type: 'group',
            fields: [
              { label: 'Data de Início (Conjunto)', type: 'date' },
              { label: 'Data de Término (Conjunto)', type: 'date', optional: true },
            ],
          },
          // Removido: Regras de Valor
        ],
      },
      {
        title: 'Configuração do Anúncio',
        fields: [
          { label: 'Qtd. de Criativos por Conjunto', type: 'select', options: ['1', '2', '3', '4', '5'], default: '1' },
          { label: 'Formato', type: 'select', options: ['Imagem ou Vídeo Único', 'Carrossel', 'Coleção'], default: 'Imagem ou Vídeo Único' },
          // Removido: Criativo Dinâmico
          // Removido: Anúncio em Parceria
          {
            label: 'Criativo (Copy)',
            type: 'group',
            fields: [
              { label: 'Texto Principal', type: 'text', placeholder: 'Ex: A nova coleção chegou! Garanta já.' },
              { label: 'Título', type: 'text', placeholder: 'Ex: Novidades Vermezzo' },
              { label: 'Descrição', type: 'text', placeholder: 'Ex: Frete grátis acima de R$ 199' },
              { label: 'URL do Site', type: 'select', options: ['https://www.vermezzo.com.br/'], default: 'https://www.vermezzo.com.br/' },
              { label: 'CTA', type: 'select', options: ['Comprar Agora', 'Saiba Mais', 'Cadastrar-se', 'Enviar Mensagem', 'Entrar em Contato'], default: 'Comprar Agora' },
            ],
          },
        ],
      },
      // Removido: seção "Destino do Anúncio" (inclui Canal de Mensagens)
      {
        title: 'Gestão Interna',
        fields: [
          { label: 'Responsável', type: 'user_select' },
          { label: 'Status da Tarefa', type: 'select', options: ['Pendente', 'Em andamento', 'Concluída'], default: 'Pendente' },
          { label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta'], default: 'Média' },
          // Checklist de Ativação removido conforme solicitação
        ],
      },
    ],
  };

  const GOOGLE_SEARCH_TEMPLATE: TaskTemplate = {
    template_name: 'Campanha Google Ads (Pesquisa)',
    category: 'Mídia Paga',
    sections: [
      {
        title: 'Informações Gerais',
        fields: [
          { label: 'Objetivo da Campanha', type: 'select', options: ['Tráfego', 'Conversões'], required: true },
          { label: 'Nome da Campanha', type: 'text', placeholder: 'Ex: Pesquisa Brand 2025', required: true },
          { label: 'Nome do Grupo de Anúncios', type: 'text', placeholder: 'Ex: Termos Brand' },
        ],
      },
      {
        title: 'Configurações de Campanha',
        fields: [
          { label: 'Redes', type: 'select', options: ['Pesquisa', 'Pesquisa + Parceiros'], default: 'Pesquisa' },
          { label: 'Tipo de Orçamento', type: 'select', options: ['Diário', 'Mensal'], default: 'Diário' },
          { label: 'Valor do Orçamento (R$)', type: 'number', placeholder: 'Ex: 50,00' },
          { label: 'Data de Início', type: 'date' },
          { label: 'Data de Término', type: 'date', optional: true },
          {
            label: 'Segmentação Básica',
            type: 'group',
            fields: [
              { label: 'Localizações', type: 'text', default: 'Brasil' },
              { label: 'Idiomas', type: 'text', default: 'Português' },
            ],
          },
        ],
      },
      {
        title: 'Grupo de Anúncios',
        fields: [
          { label: 'Estratégia de Lance', type: 'select', options: ['CPC', 'CPA'], default: 'CPC' },
          {
            label: 'Palavras-Chave',
            type: 'group',
            fields: [
              { label: 'Palavras-chave (separadas por vírgula)', type: 'text', placeholder: 'Ex: vermezzo, moda feminina, loja vermezzo' },
              { label: 'Tipos de Correspondência', type: 'multiselect', options: ['Ampla', 'Expressão', 'Exata'], default: ['Ampla', 'Expressão', 'Exata'] },
            ],
          },
        ],
      },
      {
        title: 'Criativos e Extensões',
        fields: [
          {
            label: 'Anúncio de Texto',
            type: 'group',
            fields: [
              { label: 'Título 1', type: 'text' },
              { label: 'Título 2', type: 'text' },
              { label: 'Descrição', type: 'text' },
              { label: 'URL Final', type: 'text' },
            ],
          },
          {
            label: 'Extensões',
            type: 'group',
            fields: [
              { label: 'Sitelinks (separados por vírgula)', type: 'text', placeholder: 'Promoções; Novidades; Outlet' },
              { label: 'Extensões de Chamada', type: 'toggle', default: false },
            ],
          },
        ],
      },
      {
        title: 'Gestão Interna',
        fields: [
          { label: 'Responsável', type: 'user_select' },
          { label: 'Status da Tarefa', type: 'select', options: ['Pendente', 'Em andamento', 'Concluída'], default: 'Pendente' },
          { label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta'], default: 'Média' },
          // Checklist de Ativação removido conforme solicitação
        ],
      },
    ],
  };

  const INSTAGRAM_BOOST_TEMPLATE: TaskTemplate = {
    template_name: 'Impulsionamento Instagram',
    category: 'Social Ads',
    sections: [
      {
        title: 'Informações Gerais',
        fields: [
          { label: 'Nome da Campanha', type: 'text', placeholder: 'Ex: Boost Look 2025', required: true },
          { label: 'Objetivo', type: 'select', options: ['Mais visitas ao perfil', 'Mais mensagens', 'Mais alcance'], default: 'Mais mensagens' },
        ],
      },
      {
        title: 'Configuração do Anúncio',
        fields: [
          {
            label: 'Identidade',
            type: 'group',
            fields: [
              { label: 'Conta do Instagram', type: 'text', default: '@vermezzo_' },
            ],
          },
          { label: 'Posicionamento', type: 'select', options: ['Feed', 'Stories', 'Reels'], default: 'Reels' },
          { label: 'Orçamento Diário (R$)', type: 'number', placeholder: 'Ex: 30,00' },
          { label: 'Duração (dias)', type: 'number', placeholder: 'Ex: 7' },
        ],
      },
      {
        title: 'Destino do Anúncio',
        fields: [
          { label: 'Destino', type: 'select', options: ['Perfil', 'Mensagens', 'Site'], default: 'Mensagens' },
        ],
      },
      {
        title: 'Gestão Interna',
        fields: [
          { label: 'Responsável', type: 'user_select' },
          { label: 'Status da Tarefa', type: 'select', options: ['Pendente', 'Em andamento', 'Concluída'], default: 'Pendente' },
          { label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta'], default: 'Média' },
          // Checklist de Ativação removido conforme solicitação
        ],
      },
    ],
  };

  const TEMPLATES: TaskTemplate[] = [
    META_CAMPAIGN_TEMPLATE,
    GOOGLE_SEARCH_TEMPLATE,
    INSTAGRAM_BOOST_TEMPLATE,
  ];

  const [templateValues, setTemplateValues] = useState<Record<string, any>>({});
  const [adsetCount, setAdsetCount] = useState(1);
  const [creativeCounts, setCreativeCounts] = useState<number[]>([1]);

  // Sincroniza o contador de conjuntos com o campo do template
  useEffect(() => {
    const countKey = keyOf('Qtd. de Conjuntos de Anúncios');
    setTemplateValues((prev) => ({ ...prev, [countKey]: adsetCount }));
  }, [adsetCount]);

  const removeAdset = (removeIndex: number) => {
    // Não permitir remover o último conjunto
    if (adsetCount <= 1) return;
    setTemplateValues((prev) => {
      const next = { ...prev } as Record<string, any>;
      // Desloca valores dos conjuntos subsequentes para preencher o espaço removido
      for (let i = removeIndex + 1; i <= adsetCount; i++) {
        const fromPrefix = `conjunto_${i}`;
        const toPrefix = `conjunto_${i - 1}`;
        const prefixLen = fromPrefix.length + 1; // inclui o ponto
        Object.keys(next)
          .filter((k) => k.startsWith(fromPrefix + '.'))
          .forEach((k) => {
            const suffix = k.slice(prefixLen);
            next[`${toPrefix}.${suffix}`] = next[k];
            delete next[k];
          });
      }
      // Limpa valores do último prefixo após o deslocamento
      const lastPrefix = `conjunto_${adsetCount}`;
      Object.keys(next)
        .filter((k) => k.startsWith(lastPrefix + '.'))
        .forEach((k) => delete next[k]);
      return next;
    });
    setAdsetCount((c) => Math.max(1, c - 1));
    setCreativeCounts((counts) => {
      const next = counts.slice();
      next.splice(removeIndex, 1);
      return next.length ? next : [1];
    });
  };

  // Adiciona um criativo dentro de um conjunto específico
  const addCreative = (adsetIdx: number) => {
    setCreativeCounts((counts) => {
      const next = counts.slice();
      next[adsetIdx] = (next[adsetIdx] ?? 1) + 1;
      return next;
    });
  };

  // Remove um criativo do conjunto, fazendo shift dos valores para manter índices sequenciais
  const removeCreative = (adsetIdx: number, creativeIdx: number) => {
    setCreativeCounts((counts) => {
      const currentCount = counts[adsetIdx] ?? 1;
      if (currentCount <= 1) return counts; // não remove o último
      setTemplateValues((prev) => {
        const next = { ...prev } as Record<string, any>;
        const setPrefix = `conjunto_${adsetIdx + 1}`;
        for (let j = creativeIdx + 1; j <= currentCount; j++) {
          const fromPrefix = `${setPrefix}.criativo_${j}`;
          const toPrefix = `${setPrefix}.criativo_${j - 1}`;
          const prefixLen = fromPrefix.length + 1;
          Object.keys(next)
            .filter((k) => k.startsWith(fromPrefix + '.'))
            .forEach((k) => {
              const suffix = k.slice(prefixLen);
              next[`${toPrefix}.${suffix}`] = next[k];
              delete next[k];
            });
        }
        const lastPrefix = `${setPrefix}.criativo_${currentCount}`;
        Object.keys(next)
          .filter((k) => k.startsWith(lastPrefix + '.'))
          .forEach((k) => delete next[k]);
        return next;
      });
      const nextCounts = counts.slice();
      nextCounts[adsetIdx] = currentCount - 1;
      return nextCounts;
    });
  };

  // Initialize template defaults when switching to templates tab
  useEffect(() => {
    if (activeTab === 'templates' && Object.keys(templateValues).length === 0) {
      const currentTemplate = TEMPLATES[selectedTemplateIndex];
      const initialValues: Record<string, any> = {};
      const keyOfHelper = (label: string) => label.replace(/\s+/g, '_').toLowerCase();

      const collectDefaults = (fields: TemplateField[], parentKey?: string) => {
        fields.forEach((field) => {
          if (field.type === 'group' && field.fields) {
            const groupKey = parentKey ? `${parentKey}.${keyOfHelper(field.label)}` : keyOfHelper(field.label);
            collectDefaults(field.fields, groupKey);
          } else if (field.default !== undefined) {
            const fieldKey = keyOfHelper(field.label);
            const key = parentKey ? `${parentKey}.${fieldKey}` : fieldKey;
            initialValues[key] = field.default;
          }
        });
      };

      currentTemplate.sections.forEach((section) => {
        collectDefaults(section.fields);
      });

      if (Object.keys(initialValues).length > 0) {
        setTemplateValues(initialValues);
      }
    }
  }, [activeTab, selectedTemplateIndex]);

  const keyOf = (label: string) => label.replace(/\s+/g, '_').toLowerCase();

  // Converte os valores do template em um texto legível em vez de JSON
  const formatTemplateDescription = (template: TaskTemplate, values: Record<string, any>, composedName?: string) => {
    const lines: string[] = [];
    if (composedName && composedName.trim()) {
      lines.push(`Nome: ${composedName}`);
    }
    lines.push(`Template: ${template.template_name}${template.category ? ` (${template.category})` : ''}`);
    const formatValue = (val: any): string => {
      if (val === null || val === undefined || val === '') return '—';
      if (Array.isArray(val)) {
        if (!val.length) return '—';
        // Se for uma lista de arquivos, exibir apenas os nomes
        if (val[0] instanceof File) {
          return val.map((f: File) => f.name).join(', ');
        }
        return val.join(', ');
      }
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      if (typeof val === 'object') {
        // Checklist: objeto com { item: true/false }
        const keys = Object.keys(val);
        if (!keys.length) return '—';
        return keys
          .map((k) => `${val[k] ? '[x]' : '[ ]'} ${k}`)
          .join('\n');
      }
      return String(val);
    };

    const getVal = (label: string, parentKey?: string) => {
      const k = parentKey ? `${parentKey}.${keyOf(label)}` : keyOf(label);
      return values[k];
    };

    const adsetCountVal = Number(values[keyOf('Qtd. de Conjuntos de Anúncios')]) || 1;
    const creativesPerSet = Number(values[keyOf('Qtd. de Criativos por Conjunto')]) || 1;
    const adsetTitleMatch = (t?: string) => (t || '').toLowerCase().includes('conjunto');

    template.sections.forEach((section) => {
      const sectionTitle = section.title?.trim().toLowerCase() || '';
      // Oculta apenas o cabeçalho "Informações Gerais" para evitar ruído visual no texto,
      // mas mantém os campos e valores da seção.
      if (sectionTitle !== 'informações gerais') {
        lines.push('', `${section.title}`);
      } else {
        // ainda separa com uma linha em branco para manter a legibilidade
        lines.push('');
      }

      if (adsetTitleMatch(section.title)) {
        // Seção de conjuntos: listar por conjunto
        const countKey = keyOf('Qtd. de Conjuntos de Anúncios');
        const perSetFields = (section.fields || []).filter((f) => keyOf(f.label) !== countKey);
        for (let i = 1; i <= adsetCountVal; i++) {
          const prefix = `conjunto_${i}`;
          lines.push(`- Conjunto ${i}:`);
          perSetFields.forEach((field) => {
            if (field.type === 'group' && field.fields) {
              const parentKey = `${prefix}.${keyOf(field.label)}`;
              lines.push(`  - ${field.label}:`);
              field.fields.forEach((sub) => {
                const v = getVal(sub.label, parentKey);
                const formatted = formatValue(v);
                const pre = formatted.includes('\n') ? '\n    ' : '';
                lines.push(`    - ${sub.label}: ${pre}${formatted}`);
              });
            } else {
              const v = getVal(field.label, prefix);
              const formatted = formatValue(v);
              lines.push(`  - ${field.label}: ${formatted}`);
            }
          });
          // Criativos do conjunto
          for (let c = 1; c <= creativesPerSet; c++) {
            const urlKey = `${prefix}.criativo_${c}.url`;
            const urlVal = values[urlKey];
            if (urlVal) {
              lines.push(`  - Criativo ${c} URL: ${formatValue(urlVal)}`);
            }
          }
        }
      } else {
        // Seções regulares: listar campos diretamente
        (section.fields || []).forEach((field) => {
          if (field.type === 'group' && field.fields) {
            const parentKey = keyOf(field.label);
            lines.push(`- ${field.label}:`);
            field.fields.forEach((sub) => {
              const v = getVal(sub.label, parentKey);
              const formatted = formatValue(v);
              const prefix = formatted.includes('\n') ? '\n  ' : '';
              lines.push(`  - ${sub.label}: ${prefix}${formatted}`);
            });
          } else {
            const v = getVal(field.label);
            const formatted = formatValue(v);
            lines.push(`- ${field.label}: ${formatted}`);
          }
        });
      }
    });

    return lines.join('\n');
  };

  const renderField = (field: TemplateField, parentKey?: string) => {
    const fieldKey = parentKey ? `${parentKey}.${keyOf(field.label)}` : keyOf(field.label);
    const value = templateValues[fieldKey] ?? field.default ?? (field.type === 'multiselect' ? [] : field.type === 'checklist' ? {} : '');
    const setValue = (v: any) => setTemplateValues((prev) => ({ ...prev, [fieldKey]: v }));
    const wizardStep = ((templateValues as any)?.__wizardStep as number) ?? 0;

    switch (field.type) {
      case 'text':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}{field.required ? ' *' : ''}</Label>
            <Input className="h-9 text-sm" placeholder={field.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        );
      case 'number':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            {(() => {
              const lbl = (field.label || '').toLowerCase();
              const compactNumeric = (lbl.includes('idade mínima') || lbl.includes('idade maxima') || lbl.includes('idade máxima'));
              const widthClass = compactNumeric ? 'w-20' : '';
              return (
                <Input
                  className={`h-9 text-sm ${widthClass}`}
                  type="number"
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              );
            })()}
          </div>
        );
      case 'date':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            {(() => {
              const lbl = (field.label || '').toLowerCase();
              const compactDate = (lbl.includes('data de início') || lbl.includes('data de termino') || lbl.includes('data de término'));
              const widthClass = compactDate ? 'w-full' : '';
              return (
                <Input
                  className={`h-9 text-sm ${widthClass}`}
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              );
            })()}
          </div>
        );
      case 'select':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Select
              value={value}
              onValueChange={(v) => {
                setValue(v);
                const k = keyOf(field.label);
                const adsetCountKey = keyOf('Qtd. de Conjuntos de Anúncios');
                const creativeCountKey = keyOf('Qtd. de Criativos por Conjunto');
                if (k === adsetCountKey) {
                  const nextCount = Number(v) || 1;
                  // Ajusta estado de conjuntos
                  setAdsetCount(nextCount);
                  setCreativeCounts((counts) => {
                    const prev = counts.slice();
                    const resized = Array.from({ length: nextCount }).map((_, i) => prev[i] ?? 1);
                    return resized.length ? resized : [1];
                  });
                  // Remove valores dos conjuntos além do novo tamanho
                  setTemplateValues((prev) => {
                    const next = { ...prev } as Record<string, any>;
                    // Limpa chaves de conjuntos removidos
                    Object.keys(next).forEach((key) => {
                      const match = key.match(/^conjunto_(\d+)\./);
                      if (match) {
                        const idx = Number(match[1]);
                        if (idx > nextCount) delete next[key];
                      }
                    });
                    return next;
                  });
                } else if (k === creativeCountKey) {
                  const perAdsetCount = Number(v) || 1;
                  // Define a mesma quantidade de criativos para todos os conjuntos atuais
                  setCreativeCounts(Array.from({ length: adsetCount }).map(() => perAdsetCount));
                  // Remove valores de criativos além do novo tamanho em cada conjunto
                  setTemplateValues((prev) => {
                    const next = { ...prev } as Record<string, any>;
                    Object.keys(next).forEach((key) => {
                      const match = key.match(/^conjunto_(\d+)\.criativo_(\d+)\./);
                      if (match) {
                        const cIdx = Number(match[2]);
                        if (cIdx > perAdsetCount) delete next[key];
                      }
                    });
                    return next;
                  });
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'multiselect':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <div className={wizardStep === 1 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2'}>
              {(field.options || []).map((opt) => {
                const checked = Array.isArray(value) ? value.includes(opt) : false;
                return (
                  <label key={opt} className="flex items-center space-x-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const arr = Array.isArray(value) ? [...value] : [];
                        if (c) arr.push(opt); else {
                          const idx = arr.indexOf(opt);
                          if (idx !== -1) arr.splice(idx, 1);
                        }
                        setValue(arr);
                      }}
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      case 'toggle':
        return (
          <div className="flex items-center justify-between py-1">
            <Label className="mr-4 text-xs">{field.label}</Label>
            <Switch checked={!!value} onCheckedChange={(c) => setValue(c)} />
          </div>
        );
      case 'range':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <input type="range" min={field.min ?? 0} max={field.max ?? 100} value={value || field.min || 0} onChange={(e) => setValue(Number(e.target.value))} />
            <div className="text-xs text-muted-foreground">{value || field.min || 0}</div>
          </div>
        );
      case 'user_select':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Select value={value} onValueChange={(v) => setValue(v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={isMembersLoading ? 'Carregando...' : 'Selecione um responsável'} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name || m.email || m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'file_upload':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Input
              className="h-9 text-sm"
              type="file"
              multiple
              onChange={(e) => setValue(Array.from(e.target.files || []))}
            />
            {Array.isArray(value) && value.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Selecionados: {value.map((f: File) => f.name).join(', ')}
              </div>
            )}
          </div>
        );
      case 'checklist':
        return (
          <div className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <div className="space-y-1">
              {(field.items || []).map((item) => {
                const checked = (value || {})[item] === true;
                return (
                  <label key={item} className="flex items-center space-x-2">
                    <Checkbox checked={checked} onCheckedChange={(c) => setValue({ ...(value || {}), [item]: !!c })} />
                    <span className="text-xs">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      case 'group':
        {
          const labelLower = (field.label || '').toLowerCase();
          const isAdsetStep = wizardStep === 1;
          const isCompactGroup = isAdsetStep && (labelLower.includes('idade') || labelLower.includes('programação') || labelLower.includes('programacao'));
          const isProgramacaoGroup = isAdsetStep && (labelLower.includes('programação') || labelLower.includes('programacao'));
          const isAgeGroup = isAdsetStep && labelLower.includes('idade');
          const showGroupLabel = !isProgramacaoGroup; // oculta rótulo "Programação" para alinhar com "Nome do Conjunto"
          const groupSpacingClass = isProgramacaoGroup ? 'space-y-0' : (isCompactGroup ? 'space-y-1' : 'space-y-2');
          const innerGridClass = isAgeGroup
            ? 'flex flex-wrap gap-4'
            : (isCompactGroup ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-1 md:grid-cols-2 gap-2');
          return (
            <div className={groupSpacingClass}>
              {showGroupLabel && (
                <Label className="text-xs font-medium">{field.label}</Label>
              )}
              <div className={innerGridClass}>
                {(field.fields || []).map((sub) => (
                  <div
                    key={`${fieldKey}.${keyOf(sub.label)}`}
                    className={`${field.label.includes('Criativo') && sub.label === 'Texto Principal' ? 'md:col-span-2' : ''}`}
                  >
                    {renderField(sub, fieldKey)}
                  </div>
                ))}
              </div>
            </div>
          );
        }
      default:
        return null;
    }
  };

  const handleSubmit = () => {
    if (activeTab === 'task') {
      if (!taskName.trim()) return;
      onCreateTask({
        name: taskName,
        description: taskDescription,
        status: taskStatus,
        priority: taskPriority,
        metadata: taskAssigneeId && taskAssigneeId !== '__none__' ? { __assignee_prefill: taskAssigneeId } : undefined,
        assignee_id: taskAssigneeId !== '__none__' ? taskAssigneeId : undefined as any,
        due_date: taskDueDate || undefined as any,
      });
      // Reset task fields
      setTaskName('');
      setTaskDescription('');
      setTaskStatus('pendente');
      setTaskPriority('media');
      setTaskAssigneeId('__none__');
      setTaskDueDate('');
    } else if (activeTab === 'document' && onCreateDocument) {
      if (!docName.trim()) return;
      onCreateDocument({
        name: docName,
        content: docContent,
        file: docFile || undefined,
      });
      // Reset doc fields
      setDocName('');
      setDocContent('');
      setDocFile(null);
    } else if (activeTab === 'reminder' && onCreateReminder) {
      if (!reminderName.trim() || !reminderDueDate) return;
      onCreateReminder({
        name: reminderName,
        description: reminderDescription,
        dueDate: reminderDueDate,
        notifyVia: reminderNotifyVia,
        email: reminderEmail || undefined,
        phone: reminderPhone || undefined,
        telegram_chat_id: reminderTelegram || undefined,
        assignee_id: reminderAssigneeId || undefined,
      });
      // Reset reminder fields
      setReminderName('');
      setReminderDescription('');
      setReminderDueDate('');
      setReminderNotifyVia('email');
      setReminderEmail('');
      setReminderPhone('');
      setReminderTelegram('');
      setReminderAssigneeId('__none__');
    } else if (activeTab === 'templates') {
      // Monta os dados de tarefa a partir do template
      const nomeCampanha = templateValues['nome_da_campanha'] || 'Nova Campanha';
      const nomeConjunto = templateValues['nome_do_conjunto_de_anúncios'] || templateValues['nome_do_grupo_de_anúncios'] || '';
      const nomeAnuncio = templateValues['nome_do_anúncio'] || templateValues['nome_do_anuncio'] || '';
      const composedName = [nomeCampanha, nomeConjunto, nomeAnuncio].filter(Boolean).join(' • ');

      const descriptionBlob = {
        template: TEMPLATES[selectedTemplateIndex].template_name,
        category: TEMPLATES[selectedTemplateIndex].category,
        values: templateValues,
      };

      const currentTemplate = TEMPLATES[selectedTemplateIndex];
      const descriptionText = formatTemplateDescription(currentTemplate, templateValues, composedName);

      // Extrai arquivos anexados (campo "anexos" posicionado em Criativos)
      const attachedFiles = templateValues['configuração_do_anúncio.anexos'] || [];

      onCreateTask({
        name: composedName,
        description: descriptionText,
        status: 'pendente',
        priority: 'media',
        attachments: Array.isArray(attachedFiles) ? attachedFiles : [],
        metadata: {
          template_blob: descriptionBlob,
        },
      });

      setTemplateValues({});
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset all fields when closing
      setTaskName('');
      setTaskDescription('');
      setTaskStatus('pendente');
      setTaskPriority('media');
      setDocName('');
      setDocContent('');
      setReminderName('');
      setReminderDescription('');
      setReminderDueDate('');
      setTemplateValues({});
      setActiveTab('task');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] sm:max-h-[92vh] overflow-y-auto p-4">
        <DialogHeader className="border-b">
          <DialogTitle>Criar Novo Item</DialogTitle>
          {folderName && listName && (
            <p className="text-sm text-muted-foreground">
              📁 {folderName} / 📋 {listName}
            </p>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-2">
            <TabsTrigger value="task" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Tarefa
            </TabsTrigger>
            <TabsTrigger value="reminder" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Lembrete
            </TabsTrigger>
            <TabsTrigger value="campaign" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Campanha Meta
            </TabsTrigger>
          </TabsList>

          {/* TASK TAB */}
          <TabsContent value="task" className="space-y-6 mt-4">
            <div>
              <Label htmlFor="task-name">Nome da Tarefa *</Label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Nome da tarefa ou digite '/' para inserir comandos"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="task-description">Descrição</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Adicione uma descrição ou escreva com IA"
                rows={8}
              />
            </div>

          <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="task-status">Status</Label>
                <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        Pendente
                      </span>
                    </SelectItem>
                    <SelectItem value="em_andamento">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        Em Andamento
                      </span>
                    </SelectItem>
                    <SelectItem value="concluido">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Concluído
                      </span>
                    </SelectItem>
                    <SelectItem value="bloqueado">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Bloqueado
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="task-priority">Prioridade</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Responsável</Label>
                <Select value={taskAssigneeId} onValueChange={(v) => setTaskAssigneeId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={isMembersLoading ? 'Carregando...' : 'Selecione'} />
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
                <Label>Prazo</Label>
                <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Preencha responsável e prazo acima</Badge>
            </div>
          </TabsContent>

          {/* REMINDER TAB */}
          <TabsContent value="reminder" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="reminder-name">Nome do Lembrete *</Label>
              <Input
                id="reminder-name"
                value={reminderName}
                onChange={(e) => setReminderName(e.target.value)}
                placeholder="Nome do lembrete"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="reminder-description">Descrição</Label>
              <Textarea
                id="reminder-description"
                value={reminderDescription}
                onChange={(e) => setReminderDescription(e.target.value)}
                placeholder="Adicione detalhes do lembrete..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="reminder-due">Data de Vencimento *</Label>
              <Input
                id="reminder-due"
                type="datetime-local"
                value={reminderDueDate}
                onChange={(e) => setReminderDueDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Responsável</Label>
              <Select value={reminderAssigneeId} onValueChange={(v) => setReminderAssigneeId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={isMembersLoading ? 'Carregando...' : 'Selecione um responsável'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem responsável</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name || m.email || m.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notify-via">Enviar Notificação Por</Label>
              <Select value={reminderNotifyVia} onValueChange={(v) => setReminderNotifyVia(v as ReminderNotifyVia)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">📧 E-mail</SelectItem>
                  <SelectItem value="whatsapp">📱 WhatsApp</SelectItem>
                  <SelectItem value="telegram">✈️ Telegram</SelectItem>
                  <SelectItem value="all">📣 Todos os canais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(reminderNotifyVia === 'email' || reminderNotifyVia === 'all') && (
              <div>
                <Label htmlFor="reminder-email">E-mail {reminderNotifyVia === 'email' ? '*' : ''}</Label>
                <Input
                  id="reminder-email"
                  type="email"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
            )}

            {(reminderNotifyVia === 'whatsapp' || reminderNotifyVia === 'all') && (
              <div>
                <Label htmlFor="reminder-phone">WhatsApp {reminderNotifyVia === 'whatsapp' ? '*' : ''}</Label>
                <Input
                  id="reminder-phone"
                  type="tel"
                  value={reminderPhone}
                  onChange={(e) => setReminderPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            )}

            {(reminderNotifyVia === 'telegram' || reminderNotifyVia === 'all') && (
              <div>
                <Label htmlFor="reminder-telegram">Telegram Chat ID {reminderNotifyVia === 'telegram' ? '*' : ''}</Label>
                <Input
                  id="reminder-telegram"
                  type="text"
                  value={reminderTelegram}
                  onChange={(e) => setReminderTelegram(e.target.value)}
                  placeholder="123456789"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Inicie uma conversa com o bot e obtenha seu Chat ID
                </p>
              </div>
            )}

            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              🔔 Lembretes enviam notificações na data e hora especificadas
            </div>
          </TabsContent>

          {/* CAMPAIGN TAB */}
          <TabsContent value="campaign" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Responsável</Label>
                <Select value={campaignAssigneeId} onValueChange={(v) => setCampaignAssigneeId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={isMembersLoading ? 'Carregando...' : 'Selecione'} />
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
                <Label>Prazo</Label>
                <Input type="date" value={campaignDueDate} onChange={(e) => setCampaignDueDate(e.target.value)} />
              </div>
            </div>
            <CampaignFormWizard
              onSubmit={(data) => {
                onCreateTask({
                  name: data.campaignName,
                  description: `Meta Ads - ${data.objective}`,
                  status: 'pendente',
                  priority: 'media',
                  metadata: {
                    campaign_data: data,
                  },
                  assignee_id: campaignAssigneeId !== '__none__' ? campaignAssigneeId : undefined as any,
                  due_date: campaignDueDate || undefined as any,
                });
                handleOpenChange(false);
              }}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {activeTab !== 'campaign' && (
            <Button onClick={handleSubmit}>
              Criar {activeTab === 'task' ? 'Tarefa' : 'Lembrete'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
