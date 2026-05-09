import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingDone = useRef(false);

  const cargarPerfil = async (u) => {
    if (!u) { setPerfil(null); return; }
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*, tiendas(*)')
        .eq('id', u.id)
        .single();
      if (error) throw error;
      setPerfil(data || null);
    } catch {
      setPerfil(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        const u = session?.user || null;
        setUser(u);
        await cargarPerfil(u);
      } catch {
        // sin conexión — la app redirigirá a login
      } finally {
        if (mounted && !loadingDone.current) {
          loadingDone.current = true;
          setLoading(false);
        }
      }
    };

    // Timeout de seguridad: 6s máximo
    const timeout = setTimeout(() => {
      if (mounted && !loadingDone.current) {
        loadingDone.current = true;
        setLoading(false);
      }
    }, 6000);

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      const u = session?.user || null;
      setUser(u);
      await cargarPerfil(u);
      // Si ya terminó el init y llega un evento, asegurar que loading está en false
      if (!loadingDone.current) {
        loadingDone.current = true;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  const isAdmin  = perfil?.rol === 'admin';
  const isTienda = perfil?.rol === 'tienda';

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signOut, isAdmin, isTienda }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
