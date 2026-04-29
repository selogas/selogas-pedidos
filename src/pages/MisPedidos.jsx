import { useState, useEffect } from 'react';
import { pedidosApi, pedidoItemsApi } from '../api';
import { useAuth } from '../lib/auth';
import { ClipboardList, Loader2, ChevronDown, ChevronUp, Package } from 'lucide-react';

export default function MisPedidos() {
  const { user, isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const [lineas, setLineas] = useState({});
  const [loadingLineas, setLoadingLineas] = useState({});

  useEffect(() => {
    const load = async () => {
      let data;
      if (isAdmin) {
        data = await pedidosApi.list(200);
      } else {
        data = user?.tienda_id
          ? await pedidosApi.filter({ tienda_id: user.tienda_id }, 100)
          : await pedidosApi.filter({ usuario_email: user?.email }, 100);
      }
      setPedidos(data);
      setLoading(false);
    };
    load();
  }, [user, isAdmin]);

  const toggleExpand = async (pedidoId) => {
    if (expandido === pedidoId) { setExpandido(null); return; }
    setExpandido(pedidoId);
    if (!lineas[pedidoId]) {
      setLoadingLineas(l => ({...l, [pedidoId]: true}));
      const items = await pedidoItemsApi.filter({ pedido_id: pedidoId }, 500);
      setLineas(l => ({...l, [pedidoId]: items}));
      setLoadingLineas(l => ({...l, [pedidoId]: false}));
    }
  };

  const ESTADO_COLOR = {
    enviado: 'bg-blue-100 text-blue-700',
    confirmado: 'bg-green-100 text-green-700',
    pendiente: 'bg-yellow-100 text-yellow-700',
    cancelado: 'bg-red-100 text-red-600',
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis pedidos</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {isAdmin ? 'Todos los pedidos del sistema' : `Pedidos de ${user?.tienda_nombre || 'tu tienda'}`}
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">No hay pedidos todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(p.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{p.numero_pedido}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLOR[p.estado] || 'bg-gray-100 text-gray-500'}`}>
                      {p.estado}
                    </span>
                    {p.email_enviado && <span className="text-xs text-green-600 font-medium">✓ Email enviado</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {isAdmin && <span className="text-sm font-medium text-blue-600">{p.tienda_nombre}</span>}
                    <span className="text-xs text-gray-400">
                      {new Date(p.fecha_pedido).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </span>
                    <span className="text-xs text-gray-400">{p.total_lineas || 0} productos</span>
                  </div>
                  {p.observaciones && <p className="text-xs text-gray-500 mt-1 italic">"{p.observaciones}"</p>}
                </div>
                {expandido === p.id ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
              </div>

              {expandido === p.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  {loadingLineas[p.id] ? (
                    <div className="flex items-center justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
                  ) : lineas[p.id]?.length > 0 ? (
                    <div className="space-y-1.5">
                      {(lineas[p.id] || []).map(item => (
                        <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-gray-100">
                          <Package size={14} className="text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-800">
                              {item.producto_codigo ? `[${item.producto_codigo}] ` : ''}{item.producto_nombre}
                            </span>
                            {item.producto_formato && <span className="text-xs text-gray-400 ml-1">{item.producto_formato}</span>}
                          </div>
                          <span className="text-sm font-bold text-blue-600 flex-shrink-0">{item.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No hay líneas de pedido</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
