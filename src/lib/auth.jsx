import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

const INACTIVITY_MS = 20 * 60 * 1000; // 20 minutos

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (u) => {
    if (!u) { setPerfil(null); return; }
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

  // ── Cierre de sesión robusto ──────────────────────────────────────
  // Limpia localStorage directamente para no depender del lock de Supabase
  const signOut = useCallback(async () => {
    try {
      // Intentar signOut normal con timeout de 2s
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000))
      ]);
    } catch {
      // Si falla o timeout, limpiar manualmente
      const sbKey = Object.keys(localStorage).find(k => k.includes('supabase') || k.startsWith('sb-'));
      if (sbKey) localStorage.removeItem(sbKey);
    } finally {
      setUser(null);
      setPerfil(null);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => { if (mounted) setLoading(false); }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') {
          const u = session?.user || null;
          setUser(u);
          await cargarPerfil(u);
          clearTimeout(timeout);
          if (mounted) setLoading(false);
          return;
        }
        const u = session?.user || null;
        setUser(u);
        await cargarPerfil(u);
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // ── Auto-logout por inactividad (20 min) ─────────────────────────
  useEffect(() => {
    if (!user) return;

    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut();
      }, INACTIVITY_MS);
    };

    // Eventos que resetean el temporizador
    const eventos = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    eventos.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // arrancar el timer al montar

    return () => {
      clearTimeout(timer);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, signOut]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const isAdmin  = perfil?.tiendas?.nombre === 'PRINCIPAL' || perfil?.rol === 'admin';
  const isTienda = !isAdmin;

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signOut, isAdmin, isTienda }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
