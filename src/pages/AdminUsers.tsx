import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Edit3, Settings } from 'lucide-react';
import { mainNavigation } from '@/data/navigation';
import { resolveApiBase } from '@/lib/apiBase';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const API_BASE = resolveApiBase();

export default function AdminUsers() {
  const { data: members, refetch } = useWorkspaceMembers();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'adm' | 'basico' | 'simples'>('basico');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Estado para modal de permissões por usuário
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Estados para remoção e edição de usuário
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<any>(null);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [newRole, setNewRole] = useState<'adm' | 'basico' | 'simples'>('basico');

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();
  const storageKey = useMemo(() => {
    return selectedUserId && WORKSPACE_ID
      ? `trafficpro.page_access_overrides:${WORKSPACE_ID}:${selectedUserId}`
      : null;
  }, [selectedUserId, WORKSPACE_ID]);

  const openPermModal = (userId: string) => {
    setSelectedUserId(userId);
    // Carregar overrides do localStorage
    const key = WORKSPACE_ID ? `trafficpro.page_access_overrides:${WORKSPACE_ID}:${userId}` : null;
    if (key) {
      try {
        const raw = window.localStorage.getItem(key);
        setOverrides(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
      } catch {
        setOverrides({});
      }
    } else {
      setOverrides({});
    }
    setPermModalOpen(true);
  };

  const saveOverrides = (next: Record<string, boolean>) => {
    setOverrides(next);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  const togglePage = (href: string, on: boolean) => {
    const next = { ...overrides, [href]: on };
    saveOverrides(next);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, fullName: name, password, role }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setMessage('Falha ao criar usuário.');
      } else {
        setMessage('Usuário criado com sucesso.');
        setEmail('');
        setName('');
        setPassword('');
        setRole('basico');
        refetch();
      }
    } catch {
      setMessage('Erro de rede ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  // Função para confirmar remoção de usuário
  const handleRemoveUser = (member: any) => {
    setUserToRemove(member);
    setRemoveDialogOpen(true);
  };

  // Função para executar remoção de usuário
  const confirmRemoveUser = async () => {
    if (!userToRemove) return;
    
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', WORKSPACE_ID)
        .eq('user_id', userToRemove.userId);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Usuário removido",
        description: `${userToRemove.name || userToRemove.email} foi removido do workspace.`,
      });
      refetch();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast({
        title: "Erro ao remover usuário",
        description: error instanceof Error ? error.message : "Não foi possível remover o usuário.",
        variant: "destructive",
      });
    } finally {
      setRemoveDialogOpen(false);
      setUserToRemove(null);
    }
  };

  // Função para editar nível de acesso
  const handleEditRole = (member: any) => {
    setUserToEdit(member);
    setNewRole(member.role);
    setEditRoleDialogOpen(true);
  };

  // Função para confirmar edição de nível de acesso
  const confirmEditRole = async () => {
    if (!userToEdit) return;
    
    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('workspace_id', WORKSPACE_ID)
        .eq('user_id', userToEdit.userId);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Nível de acesso atualizado",
        description: `${userToEdit.name || userToEdit.email} agora tem nível: ${newRole}.`,
      });
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar nível:', error);
      toast({
        title: "Erro ao atualizar nível",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o nível de acesso.",
        variant: "destructive",
      });
    } finally {
      setEditRoleDialogOpen(false);
      setUserToEdit(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {user?.role === 'adm' ? (
        <Card>
          <CardHeader>
            <CardTitle>Criar Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">E-mail</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Senha</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Nível de Acesso</label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adm">Adm</SelectItem>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="simples">Simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem criar novos usuários. Caso precise de acesso, solicite ao administrador do workspace.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membros do Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(members || []).map((m) => (
              <div key={m.userId} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {(m.name || m.email || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{m.name || m.email || m.userId}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm px-2 py-1 bg-secondary/50 rounded-md font-medium">
                      {m.role}
                    </span>
                  </div>
                  {user?.role === 'adm' && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => openPermModal(m.userId)}>
                        <Settings className="h-4 w-4 mr-1" />
                        Permissões
                      </Button>
                      {/* Não permitir ações no próprio usuário */}
                      {m.userId !== user.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRole(m)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Editar nível de acesso
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRemoveUser(m)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!members?.length && <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Modal de permissões por página */}
      <Dialog open={permModalOpen} onOpenChange={setPermModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Permissões de Páginas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ative ou desative o acesso deste usuário a cada página da plataforma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mainNavigation.map((item) => (
                <div key={item.href} className="flex items-center justify-between border rounded px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.href}</div>
                  </div>
                  <Switch
                    id={`perm-${item.href}`}
                    checked={!!overrides[item.href]}
                    onCheckedChange={(c) => togglePage(item.href, !!c)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para remoção de usuário */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{userToRemove?.name || userToRemove?.email}</strong> do workspace?
              <br />
              <span className="text-destructive text-sm mt-2 block">
                Esta ação não pode ser desfeita. O usuário perderá acesso a todos os recursos do workspace.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para editar nível de acesso */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nível de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Altere o nível de acesso de <strong>{userToEdit?.name || userToEdit?.email}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Novo nível de acesso</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adm">Administrador</SelectItem>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="simples">Simples</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                <strong>Administrador:</strong> Acesso completo a todas as funcionalidades<br />
                <strong>Básico:</strong> Acesso às principais funcionalidades<br />
                <strong>Simples:</strong> Acesso limitado a visualização
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmEditRole} disabled={newRole === userToEdit?.role}>
              <Edit3 className="h-4 w-4 mr-2" />
              Atualizar nível
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
