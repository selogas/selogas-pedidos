import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
const INACTIVITY_MS = 20 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef(null);

  const cargarPerfil = async (u) => {
    if (!u) { setPerfil(null); return; }
    if (lastUserId.current === u.id) return; // ya cargado
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
      const k = Object.keys(localStorage).find(k => k.startsWith('sb-'));
      if (k) localStorage.removeItem(k);
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
        // getSession() NO usa el lock — es lectura directa de localStorage
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        const u = session?.user || null;
        setUser(u);
        await cargarPerfil(u);
      } catch {
        // sin conexión
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // onAuthStateChange solo para LOGIN y LOGOUT — ignorar INITIAL_SESSION y TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

        // Solo procesar SIGNED_IN y SIGNED_OUT
        const u = session?.user || null;
        if (event === 'SIGNED_OUT') {
          lastUserId.current = null;
          setUser(null);
          setPerfil(null);
          return;
        }
        if (event === 'SIGNED_IN') {
          setUser(u);
          lastUserId.current = null; // forzar recarga del perfil al hacer login
          await cargarPerfil(u);
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
