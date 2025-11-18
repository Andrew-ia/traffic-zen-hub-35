import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const location = useLocation();
  const navigate = useNavigate();
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
const [pendingOverrides, setPendingOverrides] = useState<Record<string, boolean>>({});

  // Estados para remoção e edição de usuário
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<any>(null);
  

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();
  const storageKey = useMemo(() => {
    return selectedUserId && WORKSPACE_ID
      ? `trafficpro.page_access_overrides:${WORKSPACE_ID}:${selectedUserId}`
      : null;
  }, [selectedUserId, WORKSPACE_ID]);

  const openPermModal = async (userId: string) => {
    setSelectedUserId(userId);
    // Fetch overrides from backend
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/auth/page-permissions/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.success && Array.isArray(data?.data)) {
        const map: Record<string, boolean> = {};
        data.data.forEach((p: any) => {
          if (p?.prefix) map[p.prefix] = !!p.allowed;
        });
        setOverrides(map);
        setPendingOverrides(map);
      } else {
        setOverrides({});
        setPendingOverrides({});
      }
    } catch (err) {
      console.warn('Falha ao carregar permissões:', err);
      setOverrides({});
      setPendingOverrides({});
    }
    setPermModalOpen(true);
  };

  const saveOverrides = (next: Record<string, boolean>) => {
    setOverrides(next);
  };

  const togglePage = (href: string, on: boolean) => {
    const next = { ...pendingOverrides, [href]: on };
    setPendingOverrides(next);
  };

  const handleSaveOverrides = async () => {
    if (!selectedUserId || !token) return;
    const next = { ...pendingOverrides };
    try {
      const payload = Object.entries(next).map(([prefix, allowed]) => ({ prefix, allowed }));
      const resp = await fetch(`${API_BASE}/api/auth/page-permissions/${selectedUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: payload }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      saveOverrides(next);
      toast({ title: 'Permissões atualizadas', description: 'As permissões foram salvas.' });
      if (selectedUserId && user && selectedUserId === user.id) {
        const entries = Object.entries(next).sort((a, b) => b[0].length - a[0].length);
        for (const [prefix, allowed] of entries) {
          if (!allowed && (location.pathname === prefix || location.pathname.startsWith(prefix + '/'))) {
            navigate('/', { replace: true });
            break;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao salvar permissões', err);
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as permissões.', variant: 'destructive' });
    }
    setPermModalOpen(false);
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
            <DialogDescription className="text-sm text-muted-foreground">
              Alterações são salvas no servidor para este usuário.
            </DialogDescription>
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
                    checked={!!pendingOverrides[item.href]}
                    onCheckedChange={(c) => togglePage(item.href, !!c)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermModalOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveOverrides}>Salvar</Button>
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

      
    </div>
  );
}
