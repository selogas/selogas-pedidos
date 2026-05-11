import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Loader2, Megaphone, Star } from 'lucide-react';

export default function Inicio() {
  const { isAdmin, perfil } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const ahora = new Date().toISOString();
      let query = supabase.from('comunicados')
        .select('*')
        .eq('activo', true)
        .or(`expires_at.is.null,expires_at.gt.${ahora}`)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        const grupo    = perfil?.tiendas?.grupo || 'estacion';
        const tiendaId = perfil?.tienda_id;
        query = query.or(
          `destinatario.eq.todas,destinatario.eq.${grupo}${tiendaId ? `,and(destinatario.eq.tienda,tienda_id.eq.${tiendaId})` : ''}`
        );
      }
      const { data } = await query;
      setComunicados(data || []);
      setLoading(false);
    };
    if (perfil !== null) cargar();
  }, [perfil?.id]);

  const TIPO_STYLE = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    aviso:   'bg-amber-50 border-amber-200 text-amber-800',
    urgente: 'bg-red-50 border-red-200 text-red-800',
  };
  const TIPO_ICON = { info: 'ℹ️', aviso: '⚠️', urgente: '🔴' };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star size={22} className="text-[#00913f]" /> Inicio
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Bienvenido{perfil?.nombre_completo ? `, ${perfil.nombre_completo.split(' ')[0]}` : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={28} className="animate-spin text-[#00913f]" />
        </div>
      ) : comunicados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay comunicados activos</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-3">
            <Megaphone size={16} /> Comunicados
          </h2>
          {comunicados.map(com => (
            <div key={com.id}
              className={`border-2 rounded-2xl p-4 ${TIPO_STYLE[com.tipo] || TIPO_STYLE.info}`}>
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                <span>{TIPO_ICON[com.tipo] || 'ℹ️'}</span>
                {com.titulo}
              </div>
              <p className="text-sm leading-relaxed">{com.mensaje}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
