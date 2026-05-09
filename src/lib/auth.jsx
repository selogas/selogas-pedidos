import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

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

  useEffect(() => {
    let mounted = true;

    // Carga inicial con getSession — no usa locks
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user || null;
      setUser(u);
      await cargarPerfil(u);
      if (mounted) setLoading(false);
    });

    // Escuchar cambios posteriores (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // Ignorar INITIAL_SESSION — ya lo manejamos con getSession
        if (event === 'INITIAL_SESSION') return;
        const u = session?.user || null;
        setUser(u);
        await cargarPerfil(u);
      }
    );

    return () => {
      mounted = false;
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
