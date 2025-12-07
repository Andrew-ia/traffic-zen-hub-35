import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { resolveApiBase } from '@/lib/apiBase';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const API_BASE = resolveApiBase();

  useEffect(() => {
    const abort = AbortSignal.timeout(5000);
    fetch(`${API_BASE}/api/health`, { signal: abort })
      .then((r) => setApiStatus(r.ok ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'));
  }, [API_BASE]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const ok = await login(username.trim(), password);
    if (!ok) setError('Login inválido. Verifique e tente novamente.');
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md p-4 z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-2">
            Traffic Pro
          </h1>
          <p className="text-muted-foreground">Gestão de Tráfego Baseada em Dados</p>
          {apiStatus !== 'unknown' && (
            <div className={`mt-3 text-xs inline-block px-2 py-1 rounded border ${apiStatus === 'ok' ? 'text-green-700 border-green-300 bg-green-50' : 'text-red-700 border-red-300 bg-red-50'}`}>
              {apiStatus === 'ok' ? 'Servidor conectado' : 'Servidor indisponível'}
            </div>
          )}
        </div>

        <Card className="w-full border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Bem-vindo de volta</CardTitle>
            <p className="text-sm text-center text-muted-foreground">
              Entre com suas credenciais para acessar o dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Nome de usuário ou E-mail
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: joao@trafficpro.com"
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Senha
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium text-center">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                {loading ? 'Entrando...' : 'Acessar Plataforma'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Traffic Pro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
