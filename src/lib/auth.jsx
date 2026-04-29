import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tiendaInfo, setTiendaInfo] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        cargarPerfil(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        cargarPerfil(session.user.id);
      } else {
        setUser(null);
        setTiendaInfo(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cargarPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*, tiendas(*)')
      .eq('user_id', userId)
      .single();
    if (data) {
      setTiendaInfo(data);
    }
  };

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = tiendaInfo?.rol === 'admin';
  const tiendaNombre = tiendaInfo?.tiendas?.nombre || tiendaInfo?.nombre_tienda || '';
  const tiendaId = tiendaInfo?.tienda_id || '';
  const tiendaEmail = tiendaInfo?.tiendas?.email || '';
  const tiendaGrupo = tiendaInfo?.tiendas?.grupo || 'estacion';

  return (
    <AuthContext.Provider value={{
      user: user ? {
        ...user,
        role: tiendaInfo?.rol || 'tienda',
        full_name: tiendaInfo?.nombre_completo || user.email,
        tienda_nombre: tiendaNombre,
        tienda_id: tiendaId,
        tienda_email: tiendaEmail,
        tienda_grupo: tiendaGrupo,
      } : null,
      loading,
      login,
      logout,
      isAdmin,
      tiendaInfo,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);