import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmojiPickerProps {
  value?: string;
  onSelect: (emoji: string) => void;
  triggerLabel?: string;
  display?: 'icon' | 'button';
}

// Curated set of common emojis for folders
const EMOJIS: { emoji: string; keywords: string[] }[] = [
  { emoji: '📁', keywords: ['pasta', 'folder'] },
  { emoji: '📂', keywords: ['pasta', 'folder'] },
  { emoji: '📋', keywords: ['lista', 'list', 'clipboard'] },
  { emoji: '🗂️', keywords: ['arquivos', 'files'] },
  { emoji: '📝', keywords: ['nota', 'note', 'documento'] },
  { emoji: '📄', keywords: ['documento', 'doc', 'arquivo'] },
  { emoji: '📌', keywords: ['pin', 'fixar'] },
  { emoji: '📎', keywords: ['clip', 'anexo'] },
  { emoji: '📅', keywords: ['calendário', 'calendar'] },
  { emoji: '🗓️', keywords: ['calendário', 'calendar'] },
  { emoji: '🚀', keywords: ['projeto', 'launch'] },
  { emoji: '📈', keywords: ['gráfico', 'metricas', 'growth'] },
  { emoji: '💰', keywords: ['financeiro', 'money'] },
  { emoji: '📣', keywords: ['marketing', 'megafone'] },
  { emoji: '🛠️', keywords: ['ferramenta', 'tools'] },
  { emoji: '🎯', keywords: ['objetivo', 'goals', 'target'] },
  { emoji: '💡', keywords: ['ideia', 'idea'] },
  { emoji: '🔔', keywords: ['alerta', 'lembrete', 'bell'] },
  { emoji: '✅', keywords: ['done', 'concluído'] },
  { emoji: '🐞', keywords: ['bug', 'issue'] },
  { emoji: '⭐', keywords: ['star', 'favorito'] },
  { emoji: '❤️', keywords: ['love', 'importante'] },
  { emoji: '📚', keywords: ['documentação', 'docs'] },
  { emoji: '🧩', keywords: ['componente', 'component'] },
  { emoji: '🧠', keywords: ['insights', 'knowledge'] },
  { emoji: '🧪', keywords: ['experimentos', 'testes'] },
  { emoji: '⚙️', keywords: ['config', 'settings'] },
  { emoji: '🏷️', keywords: ['tags', 'etiqueta'] },
  { emoji: '📦', keywords: ['package', 'entregas'] },
  { emoji: '🗃️', keywords: ['arquivo', 'file'] },
];

export function EmojiPicker({ value, onSelect, triggerLabel, display = 'icon' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMOJIS;
    return EMOJIS.filter((e) =>
      [e.emoji, ...e.keywords].some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {display === 'icon' ? (
          <Button variant="outline" size="icon" aria-label={triggerLabel || 'Escolher emoji'}>
            <span className="text-lg leading-none">{value || '📁'}</span>
          </Button>
        ) : (
          <Button variant="outline" aria-label={triggerLabel || 'Escolher emoji'}>
            <span className="mr-2 text-lg leading-none">{value || '📁'}</span>
            {triggerLabel || 'Escolher emoji'}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-2">
          <Input
            placeholder="Buscar emoji..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ScrollArea className="h-48">
            <div className="grid grid-cols-8 gap-2">
              {filtered.map((item) => (
                <button
                  key={item.emoji}
                  className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted"
                  onClick={() => {
                    onSelect(item.emoji);
                    setOpen(false);
                  }}
                >
                  <span className="text-lg leading-none">{item.emoji}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;

