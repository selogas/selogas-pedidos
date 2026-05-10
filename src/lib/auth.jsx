import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
const STORAGE_KEY  = 'sb-pasllyqgczegpvquaxvb-auth-token';
const SUPABASE_URL = 'https://pasllyqgczegpvquaxvb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2xseXFnY3plZ3B2cXVheHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzE3MzIsImV4cCI6MjA5MzAwNzczMn0.XEz01HOL7g0ziWtMullK1TU7tdFGWFiNDZA8H041p_w';

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

async function fetchPerfil(userId, accessToken) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/perfiles?select=*,tiendas(*)&id=eq.${userId}&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = { current: null };

  const registrarSesion = useCallback(async (p, accessToken) => {
    if (!p?.id) return;
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/sesiones_activas`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            perfil_id: p.id,
            tienda_id: p.tienda_id || null,
            tienda_nombre: p.tiendas?.nombre || p.email,
            usuario_nombre: p.nombre_completo || p.nombre || p.email,
            ultima_actividad: new Date().toISOString(),
          }),
        }
      );
    } catch {}
  }, []);

  const borrarSesion = useCallback(async (perfilId, accessToken) => {
    if (!perfilId) return;
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/sesiones_activas?perfil_id=eq.${perfilId}`,
        { method: 'DELETE', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } }
      );
    } catch {}
  }, []);

  const signOut = useCallback(async () => {
    const session = getSessionFromStorage();
    if (session && perfil?.id) await borrarSesion(perfil.id, session.access_token);
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, r) => setTimeout(() => r(), 2000))
      ]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setUser(null);
      setPerfil(null);
      window.location.href = '/login';
    }
  }, [perfil, borrarSesion]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const session = getSessionFromStorage();
        if (!mounted) return;
        if (session) {
          setUser(session.user);
          const p = await fetchPerfil(session.user.id, session.access_token);
          if (mounted) {
            setPerfil(p);
            if (p) registrarSesion(p, session.access_token);
          }
          lastUserId.current = session.user.id;
        }
      } catch {}
      finally { if (mounted) setLoading(false); }
    };

    init();

    // Actualizar actividad cada 2 minutos
    const intervalo = setInterval(() => {
      const session = getSessionFromStorage();
      if (session && lastUserId.current) {
        const p = perfil;
        if (p) registrarSesion(p, session.access_token);
      }
    }, 5 * 60 * 1000);

    // Verificar modo mantenimiento cada minuto (solo tiendas)
    const checkMant = setInterval(async () => {
      if (!mounted) return;
      const session = getSessionFromStorage();
      if (!session) return;
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/configuracion?clave=eq.modo_mantenimiento&select=valor`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` } }
        );
        const data = await res.json();
        if (data?.[0]?.valor === 'true') {
          const p = await fetchPerfil(session.user.id, session.access_token);
          const esAdmin = p?.tiendas?.nombre === 'PRINCIPAL' || p?.rol === 'admin';
          if (!esAdmin) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.href = '/login?mantenimiento=1';
          }
        }
      } catch {}
    }, 60 * 1000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        if (event === 'SIGNED_OUT') { lastUserId.current = null; setUser(null); setPerfil(null); return; }
        if (event === 'SIGNED_IN' && session?.user) {
          const u = session.user;
          setUser(u);
          if (lastUserId.current !== u.id) {
            lastUserId.current = u.id;
            const p = await fetchPerfil(u.id, session.access_token);
            if (mounted) { setPerfil(p); if (p) registrarSesion(p, session.access_token); }
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearInterval(intervalo);
      clearInterval(checkMant);
      subscription.unsubscribe();
    };
  }, []);

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
