import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPerfil(authUser) {
    if (!authUser) { setPerfil(null); setUser(null); return; }
    const { data } = await supabase
      .from('perfiles')
      .select('*, tiendas(nombre, grupo, activa)')
      .eq('id', authUser.id)
      .single();
    if (data) {
      const enriched = {
        ...authUser,
        nombre: data.nombre,
        rol: data.rol,
        tienda_id: data.tienda_id,
        tienda_nombre: data.tiendas?.nombre || '',
        tienda_grupo: data.tiendas?.grupo || 'ambos',
        tienda_activa: data.tiendas?.activa !== false,
        activo: data.activo,
        perfil_id: data.id,
      };
      setUser(enriched);
      setPerfil(data);
    } else {
      setUser(authUser);
      setPerfil(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadPerfil(session?.user || null).finally(() => setLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadPerfil(session?.user || null);
    });
    return () => subscription.unsubscribe();
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

  const isAdmin = user?.rol === 'admin';
  const isTienda = user?.rol === 'tienda';

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signIn, signOut, isAdmin, isTienda }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );
  if (!user) {
    window.location.href = '/login';
    return null;
  }
  return children;
}

export function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    window.location.href = '/catalogo';
    return null;
  }
  return children;
}
