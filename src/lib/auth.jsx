import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPerfil(authUser) {
    if (!authUser) {
      setPerfil(null);
      setUser(null);
      return;
    }

    let data = null;

    // ALWAYS query by email - most reliable, avoids id mismatch issues
    const res = await supabase
      .from('perfiles')
      .select('*')
      .eq('email', authUser.email)
      .maybeSingle();

    if (res.data) {
      data = res.data;
      // Sync the id in perfiles to match auth.users id (fire-and-forget)
      if (data.id !== authUser.id) {
        supabase.from('perfiles').update({ id: authUser.id }).eq('email', authUser.email).then(() => {});
      }
    } else if (res.error) {
      console.error('[Auth] Error loading perfil:', res.error.message);
    }

    if (data) {
      let tienda_nombre = '';
      let tienda_grupo = 'ambos';
      let tienda_activa = true;

      if (data.tienda_id) {
        const { data: tiendaData } = await supabase
          .from('tiendas')
          .select('nombre, grupo, activa')
          .eq('id', data.tienda_id)
          .maybeSingle();
        if (tiendaData) {
          tienda_nombre = tiendaData.nombre || '';
          tienda_grupo = tiendaData.grupo || 'ambos';
          tienda_activa = tiendaData.activa !== false;
        }
      }

      const enriched = {
        ...authUser,
        nombre: data.nombre,
        rol: data.rol,
        tienda_id: data.tienda_id,
        tienda_nombre,
        tienda_grupo,
        tienda_activa,
        activo: data.activo,
        perfil_id: data.id,
      };
      setUser(enriched);
      setPerfil(data);
    } else {
      // No profile found - user exists in auth but not in perfiles
      // Set minimal user without rol (admin must create their profile manually)
      console.warn('[Auth] No perfil found for', authUser.email);
      setUser({ ...authUser, rol: null });
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
