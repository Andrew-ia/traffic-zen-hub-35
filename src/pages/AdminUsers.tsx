import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { mainNavigation } from '@/data/navigation';

export default function AdminUsers() {
  const { data: members, refetch } = useWorkspaceMembers();
  const { token, user } = useAuth();
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

  const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;
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
      const res = await fetch('/api/auth/users', {
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
              <div key={m.userId} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{m.name || m.email || m.userId}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">{m.role}</div>
                  {user?.role === 'adm' && (
                    <Button variant="outline" size="sm" onClick={() => openPermModal(m.userId)}>
                      Permissões
                    </Button>
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
    </div>
  );
}
