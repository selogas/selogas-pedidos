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

    // Timeout de seguridad: máximo 5s de espera
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // onAuthStateChange gestiona TODO: sesión inicial, login, logout, refresh
    // Es el método recomendado por Supabase — no necesitamos getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const u = session?.user || null;
        setUser(u);
        await cargarPerfil(u);

        // Liberar loading en cualquier evento
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

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  // Admin = usuario asignado a la tienda PRINCIPAL
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
