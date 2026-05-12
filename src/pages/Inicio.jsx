import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Loader2, Megaphone, Star, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Slider de Novedades ───────────────────────────────────────────────────
function NovedadesSlider() {
  const [novedades, setNovedades] = useState([]);
  const [actual, setActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const pausadoRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    supabase
      .from('novedades')
      .select('*')
      .eq('activa', true)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        setNovedades(data || []);
        setLoading(false);
      });
  }, []);

  const total = novedades.length;

  const irA = useCallback((index) => {
    setActual((index + total) % total);
  }, [total]);

  const siguiente = useCallback(() => irA(actual + 1), [irA, actual]);
  const anterior = useCallback(() => irA(actual - 1), [irA, actual]);

  useEffect(() => {
    if (total <= 1) return;
    timerRef.current = setInterval(() => {
      if (!pausadoRef.current) setActual(a => (a + 1) % total);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [total]);

  // Swipe táctil
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? siguiente() : anterior();
    touchStartX.current = null;
  };

  if (loading || total === 0) return null;

  const nov = novedades[actual];

  return (
    <div className="mb-6">
      <h2 className="font-bold text-gray-700 flex items-center gap-2 mb-3 text-base">
        🆕 Novedades
      </h2>
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-gray-100"
        style={{ aspectRatio: '16/6' }}
        onMouseEnter={() => { pausadoRef.current = true; }}
        onMouseLeave={() => { pausadoRef.current = false; }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Imagen */}
        {nov.enlace ? (
          <a href={nov.enlace} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img src={nov.imagen_url} alt={nov.titulo || 'Novedad'} className="w-full h-full object-cover" />
          </a>
        ) : (
          <img src={nov.imagen_url} alt={nov.titulo || 'Novedad'} className="w-full h-full object-cover" />
        )}

        {/* Overlay texto */}
        {(nov.titulo || nov.descripcion) && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
            {nov.titulo && <p className="text-white font-bold text-sm leading-snug">{nov.titulo}</p>}
            {nov.descripcion && <p className="text-white/80 text-xs mt-0.5">{nov.descripcion}</p>}
          </div>
        )}

        {/* Flechas */}
        {total > 1 && (
          <>
            <button
              onClick={anterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition-colors z-10"
              aria-label="Anterior"
            >
              <ChevronLeft size={18} className="text-gray-700" />
            </button>
            <button
              onClick={siguiente}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition-colors z-10"
              aria-label="Siguiente"
            >
              <ChevronRight size={18} className="text-gray-700" />
            </button>
          </>
        )}

        {/* Dots */}
        {total > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {novedades.map((_, i) => (
              <button
                key={i}
                onClick={() => irA(i)}
                className="w-2 h-2 rounded-full transition-colors border-0 p-0"
                style={{ background: i === actual ? '#00913f' : 'rgba(255,255,255,0.6)' }}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página Inicio ─────────────────────────────────────────────────────────
export default function Inicio() {
  const { isAdmin, perfil } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const ahora = new Date().toISOString();
      let query = supabase.from('comunicados')
        .select('*')
        .eq('activo', true)
        .or(`expires_at.is.null,expires_at.gt.${ahora}`)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        const grupo = perfil?.tiendas?.grupo || 'estacion';
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
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    aviso: 'bg-amber-50 border-amber-200 text-amber-800',
    urgente: 'bg-red-50 border-red-200 text-red-800',
  };
  const TIPO_ICON = { info: 'ℹ️', aviso: '⚠️', urgente: '🔴' };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabecera — sin cambios */}
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

      {/* ── SLIDER NOVEDADES (nuevo) ── */}
      <NovedadesSlider />

      {/* Comunicados — sin cambios */}
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

