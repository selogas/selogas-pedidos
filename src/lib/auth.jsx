import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
const INACTIVITY_MS = 90 * 60 * 1000;
const STORAGE_KEY   = 'sb-pasllyqgczegpvquaxvb-auth-token';
const SUPABASE_URL  = 'https://pasllyqgczegpvquaxvb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2xseXFnY3plZ3B2cXVheHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzE3MzIsImV4cCI6MjA5MzAwNzczMn0.XEz01HOL7g0ziWtMullK1TU7tdFGWFiNDZA8H041p_w';

// Lee la sesión de localStorage sin usar ningún lock
function getSessionFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const token = data.access_token;
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Date.now() / 1000) return null;
    return { user: { id: payload.sub, email: payload.email }, access_token: token };
  } catch { return null; }
}

// Carga el perfil con fetch directo — sin Supabase client (que usa locks)
async function fetchPerfil(userId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/perfiles?select=*,tiendas(*)&id=eq.${userId}&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] || null;
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef(null);

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
        // Leer sesión SIN locks
        const session = getSessionFromStorage();
        if (!mounted) return;

        if (session) {
          setUser(session.user);
          // Cargar perfil con fetch directo SIN locks
          const p = await fetchPerfil(session.user.id, session.access_token);
          if (mounted) setPerfil(p);
          lastUserId.current = session.user.id;
        }
      } catch {
        // ignorar
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // onAuthStateChange solo para login/logout explícito del usuario
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // Ignorar eventos automáticos que usan el lock
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

        if (event === 'SIGNED_OUT') {
          lastUserId.current = null;
          setUser(null);
          setPerfil(null);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          const u = session.user;
          setUser(u);
          if (lastUserId.current !== u.id) {
            lastUserId.current = u.id;
            const p = await fetchPerfil(u.id, session.access_token);
            if (mounted) setPerfil(p);
          }
          setLoading(false);
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
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
