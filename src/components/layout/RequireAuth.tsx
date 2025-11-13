import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, hasAccess, isLoading } = useAuth();
  const location = useLocation();

  console.log('🛡️ RequireAuth check:', { 
    path: location.pathname, 
    user: !!user, 
    isLoading,
    hasAccess: user ? hasAccess(location.pathname) : 'N/A' 
  });

  // Show loading state while checking authentication
  if (isLoading) {
    console.log('⏳ RequireAuth: Still loading auth state...');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    console.log('🚫 RequireAuth: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (user && !hasAccess(location.pathname)) {
    console.log('🚫 RequireAuth: User has no access to', location.pathname);
    return <Navigate to="/" replace />;
  }

  console.log('✅ RequireAuth: Access granted');
  return <>{children}</>;
}

