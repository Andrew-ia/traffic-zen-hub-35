import { useState, FormEvent } from "react";
import { ChevronsUpDown, Loader2, PlusCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/components/ui/use-toast";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, isLoading, isCreating, switchWorkspace, createWorkspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const { toast } = useToast();

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    try {
      const workspace = await createWorkspace({ name: name.trim(), slug: slug.trim() || undefined });
      toast({ title: "Workspace criado", description: workspace.name });
      setCreateOpen(false);
      setName("");
      setSlug("");
    } catch (error: any) {
      toast({
        title: "Erro ao criar workspace",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 lg:px-3 gap-2 text-sm"
            aria-label="Selecionar workspace"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[180px] truncate">
              {currentWorkspace?.name || "Selecionar cliente"}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">Clientes</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isLoading && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando...
            </DropdownMenuItem>
          )}

          {!isLoading && workspaces.length === 0 && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              Nenhum workspace cadastrado
            </DropdownMenuItem>
          )}

          {!isLoading &&
            workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => switchWorkspace(workspace.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{workspace.name}</span>
                {workspace.slug && (
                  <span className="text-[11px] text-muted-foreground lowercase truncate max-w-[120px]">
                    {workspace.slug}
                  </span>
                )}
              </DropdownMenuItem>
            ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Criar novo cliente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente / workspace</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Nome</Label>
              <Input
                id="workspace-name"
                placeholder="Ex.: Miramar Shopping"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-slug">
                Slug (opcional)
              </Label>
              <Input
                id="workspace-slug"
                placeholder="miramar-shopping"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usamos o slug para URLs e integrações. Se deixar em branco, geramos automaticamente.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
