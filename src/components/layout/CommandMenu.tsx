import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign, FilePlus, HelpCircle, ListPlus, Clock, Command as CommandIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { mainNavigation, findNavigationLabel } from "@/data/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CommandMenuSection = "default" | "create";

interface CommandMenuContextValue {
  open: (section?: CommandMenuSection) => void;
  openHelp: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const context = useContext(CommandMenuContext);
  if (!context) {
    throw new Error("useCommandMenu must be used within a CommandMenuProvider");
  }
  return context;
}

interface RecentRoute {
  path: string;
  label: string;
  timestamp: number;
}

const RECENTS_STORAGE_KEY = "trafficpro.recents";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function isMacLike() {
  if (typeof window === "undefined") return false;
  return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [section, setSection] = useState<CommandMenuSection>("default");
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentRoute[];
      return Array.isArray(parsed) ? parsed.slice(0, 7) : [];
    } catch (error) {
      console.warn("Failed to parse recent routes", error);
      return [];
    }
  });

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const path = location.pathname;
    const label = findNavigationLabel(path) ?? path;

    setRecentRoutes((prev) => {
      const filtered = prev.filter((item) => item.path !== path);
      const next = [{ path, label, timestamp: Date.now() }, ...filtered].slice(0, 7);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, [location.pathname]);

  const openMenu = useCallback((nextSection: CommandMenuSection = "default") => {
    setSection(nextSection);
    setIsOpen(true);
  }, []);

  const openHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openMenu("default");
        return;
      }

      if (event.key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableElement(event.target)) {
        event.preventDefault();
        openMenu("create");
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        openHelp();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [openMenu, openHelp]);

  useEffect(() => {
    const handleRefresh = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "r" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableElement(event.target)) {
        event.preventDefault();
        void queryClient.invalidateQueries();
        toast({
          title: "Atualizando dados",
          description: "Dados recentes serão recarregados em segundo plano.",
        });
      }
    };

    window.addEventListener("keydown", handleRefresh);
    return () => window.removeEventListener("keydown", handleRefresh);
  }, [queryClient, toast]);

  const recentItems = useMemo(() => recentRoutes.sort((a, b) => b.timestamp - a.timestamp), [recentRoutes]);

  return (
    <CommandMenuContext.Provider value={{ open: openMenu, openHelp }}>
      {children}
      <CommandMenu
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        section={section}
        recentRoutes={recentItems}
        onSelectRoute={(path) => navigate(path)}
        onOpenHelp={openHelp}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </CommandMenuContext.Provider>
  );
}

interface CommandMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  section: CommandMenuSection;
  recentRoutes: RecentRoute[];
  onSelectRoute: (path: string) => void;
  onOpenHelp: () => void;
}

function CommandMenu({ isOpen, onOpenChange, section, recentRoutes, onSelectRoute, onOpenHelp }: CommandMenuProps) {
  const quickActions = useMemo(
    () => [
      {
        label: "Adicionar Orçamento",
        hint: "Abrir painel de orçamento com foco em novo",
        icon: DollarSign,
        shortcut: "B",
        action: () => onSelectRoute("/budget?intent=new"),
      },
      {
        label: "Criar Campanha",
        hint: "Ir para a página de campanhas",
        icon: ListPlus,
        shortcut: "C",
        action: () => onSelectRoute("/campaigns?intent=create"),
      },
      {
        label: "Novo Relatório",
        hint: "Abrir relatórios para construir um novo",
        icon: FilePlus,
        shortcut: "R",
        action: () => onSelectRoute("/reports?intent=new"),
      },
    ],
    [onSelectRoute],
  );

  const helperActions = useMemo(
    () => [
      {
        label: "Documentação",
        hint: "Abrir centro de ajuda",
        icon: HelpCircle,
        action: () => onSelectRoute("/integrations"),
      },
      {
        label: "Atalhos de teclado",
        hint: "Exibir lista completa",
        icon: CommandIcon,
        action: onOpenHelp,
      },
    ],
    [onOpenHelp, onSelectRoute],
  );

  const showAllGroups = section === "default";

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar campanhas, relatórios, páginas..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {showAllGroups && (
          <CommandGroup heading="Navegação">
            {mainNavigation.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.name} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => {
                  onSelectRoute(item.href);
                  onOpenChange(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => {
                item.action();
                onOpenChange(false);
              }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </div>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {showAllGroups && recentRoutes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recentes">
              {recentRoutes.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.path}`}
                  onSelect={() => {
                    onSelectRoute(item.path);
                    onOpenChange(false);
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {showAllGroups && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ajuda">
              {helperActions.map((item) => (
                <CommandItem
                  key={item.label}
                  onSelect={() => {
                    item.action();
                    onOpenChange(false);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const macLike = isMacLike();
  const modKey = macLike ? "⌘" : "Ctrl";

  const shortcuts = [
    { action: "Busca global", shortcut: `${modKey} + K` },
    { action: "Navegar / focar busca", shortcut: "/" },
    { action: "Novo item rápido", shortcut: "N" },
    { action: "Atualizar dados", shortcut: "R" },
    { action: "Abrir ajuda", shortcut: "Shift + ?" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Ganhe velocidade diária usando as combinações de teclas abaixo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {shortcuts.map((item) => (
            <div key={item.action} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm font-medium">{item.action}</span>
              <Kbd>{item.shortcut}</Kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
