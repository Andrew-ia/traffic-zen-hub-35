import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveApiBase } from '@/lib/apiBase';

type Role = 'adm' | 'basico' | 'simples';

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
};

type PagePerm = { prefix: string; allowed: boolean };
type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (path: string) => boolean;
  pagePermissions: PagePerm[];
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'trafficpro.auth.token';
const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();
const OVERRIDES_PREFIX = 'trafficpro.page_access_overrides';
const API_BASE = resolveApiBase();
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === 'true';
const DEFAULT_USER: User = {
  id: 'dev-user',
  email: (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) || 'founder@trafficpro.dev',
  role: 'adm',
};

 

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize with localStorage data immediately 
  const [token, setToken] = useState<string | null>(() => {
    if (DISABLE_AUTH) return 'dev-token';
    return typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  });
  const [user, setUser] = useState<User | null>(DISABLE_AUTH ? DEFAULT_USER : null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [pagePermissions, setPagePermissions] = useState<PagePerm[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (DISABLE_AUTH) {
      setIsLoading(false);
      setAuthChecked(true);
      return;
    }

    if (authChecked) return; // Prevent multiple checks
    
    console.log('🔄 Initial auth check. Token:', !!token, 'User:', !!user);
    
    if (token && !user) {
      console.log('🔑 Token exists, validating...');
      
      fetch(`${API_BASE}/api/auth/me`, { 
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000)
      })
        .then(async (r) => {
          console.log('🔍 Auth validation response:', r.status, r.ok);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          console.log('✅ Auth validation successful:', data);
          if (data?.success && data?.user) {
            setUser(data.user);
            console.log('👤 User set:', data.user);
          } else {
            console.log('⚠️ Invalid response from auth endpoint');
            throw new Error('Invalid auth response');
          }
          setIsLoading(false);
          setAuthChecked(true);
        })
        .catch((error) => {
          console.log('❌ Auth validation failed, clearing session:', error.message);
          window.localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
          setIsLoading(false);
          setAuthChecked(true);
        });
    } else if (!token) {
      console.log('🚫 No token found');
      setIsLoading(false);
      setAuthChecked(true);
    } else {
      console.log('✅ Already authenticated');
      setIsLoading(false);
      setAuthChecked(true);
    }
  }, [token, user, authChecked]);

  const login = useCallback(async (username: string, password: string) => {
    if (DISABLE_AUTH) {
      console.log('🔧 Auth disabled, using default user');
      setUser(DEFAULT_USER);
      setToken('dev-token');
      navigate('/');
      return true;
    }
    
    try {
      console.log('🔑 Attempting login for:', username);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      console.log('📡 Login response status:', res.status);
      
      if (!res.ok) {
        console.log('❌ Login failed - HTTP error:', res.status);
        return false;
      }
      
      const data = await res.json();
      console.log('📝 Login response data:', { 
        success: data?.success, 
        hasToken: !!data?.token, 
        hasUser: !!data?.user,
        userRole: data?.user?.role
      });
      
      if (!data?.success || !data?.token || !data?.user) {
        console.log('❌ Login failed - Invalid response data');
        return false;
      }
      
      console.log('💾 Storing token and user data');
      window.localStorage.setItem(STORAGE_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      
      console.log('✅ Login successful, redirecting to dashboard');
      navigate('/', { replace: true });
      return true;
    } catch (error) {
      console.log('❌ Login failed - Network error:', error);
      return false;
    }
  }, [navigate]);

  // Load page permissions for current user (server-side)
  useEffect(() => {
    if (DISABLE_AUTH) {
      setPagePermissions([]);
      return;
    }
    if (!user?.id || !token) {
      setPagePermissions([]);
      return;
    }

    fetch(`${API_BASE}/api/auth/page-permissions/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (data?.success && Array.isArray(data?.data)) {
          setPagePermissions(data.data as PagePerm[]);
        } else {
          setPagePermissions([]);
        }
      })
      .catch((err) => {
        console.warn('⚠️ Failed to load page permissions:', err?.message || err);
        setPagePermissions([]);
      });
  }, [user?.id, token]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const getAllowedRoutes = useCallback(() => {
    if (user?.id && WORKSPACE_ID) {
      const key = `${OVERRIDES_PREFIX}:${WORKSPACE_ID}:${user.id}`;
      const raw = window.localStorage.getItem(key);
      let map: Record<string, boolean> = {};
      try {
        map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        map = {};
      }
      return Object.entries(map)
        .filter(([, allowed]) => !!allowed)
        .map(([prefix]) => prefix)
        .sort((a, b) => a.length - b.length);
    }
    return [] as string[];
  }, [user]);

  const hasAccess = useCallback((path: string) => {
    if (DISABLE_AUTH) return true;
    if (!user?.id) return false;

    // Admins sempre têm acesso irrestrito, independentemente de overrides locais
    if (user.role === 'adm') return true;

    // Server-managed overrides
    if (pagePermissions.length > 0) {
      const entries = [...pagePermissions].sort((a, b) => b.prefix.length - a.prefix.length);
      for (const perm of entries) {
        if (path === perm.prefix || path.startsWith(perm.prefix + '/')) {
          return !!perm.allowed;
        }
      }
      // If we have page permissions but no match, deny access by default
      return false;
    }

    if (WORKSPACE_ID) {
      const key = `${OVERRIDES_PREFIX}:${WORKSPACE_ID}:${user.id}`;
      const raw = window.localStorage.getItem(key);
      let map: Record<string, boolean> = {};
      try {
        map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        map = {};
      }
      if (Object.keys(map).length > 0) {
        const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
        for (const [prefix, allowed] of entries) {
          if (path === prefix || path.startsWith(prefix + '/')) return !!allowed;
        }
        // If we have local overrides but no match, deny access
        return false;
      }
    }
    
    // Default: if no permissions are set, allow access (for backwards compatibility)
    return true;
  }, [user, pagePermissions]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, logout, hasAccess, pagePermissions }),
    [user, token, isLoading, login, logout, hasAccess, pagePermissions]
  );

  // If user navigates to a blocked route, redirect to home or login
  useEffect(() => {
    if (isLoading) return; // Wait for auth to load
    if (location.pathname === '/login') return; // login is public
    
    if (!user) {
      console.log('🔄 No user found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }
    
    // Check if current path is accessible
    if (!hasAccess(location.pathname)) {
      console.log('🚫 No access to', location.pathname, 'for role:', user.role);
      
      // Try to get allowed routes from overrides first
      const allowed = getAllowedRoutes();
      
      if (allowed.length > 0) {
        console.log('➡️ Redirecting to first allowed route:', allowed[0]);
        navigate(allowed[0], { replace: true });
      } else {
        // Fallback to dashboard if no specific overrides
        console.log('➡️ Redirecting to dashboard (fallback)');
        navigate('/', { replace: true });
      }
    } else {
      console.log('✅ Access granted to', location.pathname);
    }
  }, [location.pathname, user, navigate, hasAccess, getAllowedRoutes, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
