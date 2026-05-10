import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { TrendingUp, Package, Loader2, Megaphone, Star, Trash2 } from 'lucide-react';

const MEDALLAS = ['🥇','🥈','🥉'];

function TopProductos({ isAdmin }) {
  const [top, setTop]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [reseteando, setReseteando] = useState(false);

  const resetearTopProductos = async () => {
    if (!confirm("¿Borrar todos los pedidos de prueba?\nEsto eliminará pedidos, líneas y sesiones activas.\nEsta acción NO se puede deshacer.")) return;
    const confirma = prompt("Escribe BORRAR para confirmar:");
    if (confirma !== "BORRAR") { alert("Cancelado."); return; }
    setReseteando(true);
    await supabase.from("pedido_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pedidos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sesiones_activas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setTop([]);
    setReseteando(false);
  };

  useEffect(() => {
    const cargar = async () => {
      // Pedidos últimos 90 días
      const desde = new Date();
      desde.setDate(desde.getDate() - 90);

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id')
        .gte('fecha_pedido', desde.toISOString());

      if (!pedidos?.length) { setLoading(false); return; }

      const { data: items } = await supabase
        .from('pedido_items')
        .select('producto_id, producto_nombre, producto_codigo, cantidad, imagen_url:productos(imagen_url)')
        .in('pedido_id', pedidos.map(p => p.id));

      if (!items?.length) { setLoading(false); return; }

      // Agrupar por producto
      const mapa = {};
      for (const item of items) {
        const key = item.producto_id || item.producto_nombre;
        if (!mapa[key]) mapa[key] = {
          id: item.producto_id,
          nombre: item.producto_nombre,
          codigo: item.producto_codigo,
          imagen: item.imagen_url?.imagen_url || null,
          total: 0, pedidos: 0,
        };
        mapa[key].total   += item.cantidad || 0;
        mapa[key].pedidos += 1;
      }

      const lista = Object.values(mapa)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      setTop(lista);
      setLoading(false);
    };
    cargar();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 size={28} className="animate-spin text-[#00913f]" />
    </div>
  );

  if (!top.length) return null;

  const maxTotal = top[0]?.total || 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <TrendingUp size={18} className="text-[#00913f]" />
        <h2 className="font-bold text-gray-900">Productos más vendidos</h2>
        <span className="text-xs text-gray-400 ml-1">últimos 90 días · todas las tiendas</span>
        {isAdmin && (
          <button onClick={resetearTopProductos} disabled={reseteando}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
            title="Borrar todos los pedidos de prueba">
            {reseteando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Reset datos prueba
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {top.map((prod, i) => {
          const pct = Math.round((prod.total / maxTotal) * 100);
          return (
            <div key={prod.id || i} className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${i < 3 ? 'bg-gradient-to-r from-amber-50/60 to-transparent' : ''}`}>
              {/* Posición */}
              <div className="w-8 text-center flex-shrink-0">
                {i < 3
                  ? <span className="text-lg">{MEDALLAS[i]}</span>
                  : <span className="text-sm font-bold text-gray-400">{i + 1}</span>
                }
              </div>

              {/* Imagen */}
              <div className="w-10 h-10 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {prod.imagen
                  ? <img src={prod.imagen} alt="" className="w-full h-full object-contain p-0.5" onError={e => { e.target.style.display='none'; }} />
                  : <Package size={18} className="text-gray-300" />
                }
              </div>

              {/* Nombre + barra */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{prod.nombre}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-[#00913f] h-1.5 rounded-full transition-all" style={{ width: pct + '%' }} />
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-right">{pct}%</span>
                </div>
              </div>

              {/* Cantidad */}
              <div className="text-right flex-shrink-0">
                <div className="text-base font-black text-gray-900">{prod.total.toLocaleString()}</div>
                <div className="text-xs text-gray-400">uds</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

      {/* Top productos — visible para todos */}
      <TopProductos isAdmin={isAdmin} />

      {/* Comunicados */}
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
