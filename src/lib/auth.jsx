import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
const INACTIVITY_MS = 20 * 60 * 1000;
const STORAGE_KEY = 'sb-pasllyqgczegpvquaxvb-auth-token';

// Leer sesión directamente de localStorage sin locks
function getSessionFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const token = data.access_token;
    if (!token) return null;
    // Verificar que no ha expirado
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Date.now() / 1000) return null;
    return { user: { id: payload.sub, email: payload.email }, access_token: token };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef(null);

  const cargarPerfil = async (u) => {
    if (!u) { setPerfil(null); return; }
    if (lastUserId.current === u.id) return;
    lastUserId.current = u.id;
    try {
      const { data } = await supabase
        .from('perfiles')
        .select('*, tiendas(*)')
        .eq('id', u.id)
        .single();
      setPerfil(data || null);
    } catch {
      setPerfil(null);
    }
  };

  const signOut = useCallback(async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, r) => setTimeout(() => r(), 2000))
      ]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      lastUserId.current = null;
      setUser(null);
      setPerfil(null);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Leer sesión de localStorage directamente — SIN locks, SIN API calls
        const session = getSessionFromStorage();
        if (!mounted) return;

        if (session) {
          setUser(session.user);
          await cargarPerfil(session.user);
        }
      } catch {
        // ignorar errores
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // onAuthStateChange solo para SIGNED_IN y SIGNED_OUT explícitos
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

        if (event === 'SIGNED_OUT') {
          lastUserId.current = null;
          setUser(null);
          setPerfil(null);
          return;
        }
        if (event === 'SIGNED_IN') {
          const u = session?.user || null;
          setUser(u);
          lastUserId.current = null;
          await cargarPerfil(u);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Auto-logout inactividad 20min
  useEffect(() => {
    if (!user) return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(signOut, INACTIVITY_MS); };
    const eventos = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    eventos.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); eventos.forEach(e => window.removeEventListener(e, reset)); };
  }, [user, signOut]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const isAdmin  = !loading && (perfil?.tiendas?.nombre === 'PRINCIPAL' || perfil?.rol === 'admin');
  const isTienda = !loading && !isAdmin;

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signOut, isAdmin, isTienda }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
