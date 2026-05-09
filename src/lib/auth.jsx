import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
const INACTIVITY_MS = 20 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [perfil, setPerfil]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const perfilCargado = useRef(false);

  const cargarPerfil = async (u) => {
    if (!u) {
      setPerfil(null);
      perfilCargado.current = true;
      return;
    }
    try {
      const { data } = await supabase
        .from('perfiles')
        .select('*, tiendas(*)')
        .eq('id', u.id)
        .single();
      setPerfil(data || null);
    } catch {
      setPerfil(null);
    } finally {
      perfilCargado.current = true;
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
      setUser(null);
      setPerfil(null);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Timeout de seguridad: 8s
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const u = session?.user || null;
        setUser(u);
        // Cargar perfil ANTES de quitar el loading
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

  // isAdmin solo es true cuando el perfil YA está cargado y es PRINCIPAL
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
