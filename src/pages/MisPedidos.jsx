import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ClipboardList, ChevronDown, ChevronUp, Package, Loader2, Calendar, Hash } from "lucide-react";

const ESTADO_COLORS = {
  enviado:       "bg-blue-100 text-blue-700",
  recibido:      "bg-yellow-100 text-yellow-700",
  en_preparacion:"bg-orange-100 text-orange-700",
  enviado_tienda:"bg-green-100 text-green-700",
  cancelado:     "bg-red-100 text-red-700",
};
const ESTADO_LABELS = {
  enviado:        "Enviado",
  recibido:       "Recibido",
  en_preparacion: "En preparación",
  enviado_tienda: "Enviado a tienda",
  cancelado:      "Cancelado",
};

function PedidoCard({ pedido }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fecha = new Date(pedido.fecha_pedido).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const cargarItems = async () => {
    if (items.length > 0) { setOpen(!open); return; }
    setLoadingItems(true);
    const { data } = await supabase
      .from("pedido_items")
      .select("producto_nombre, producto_codigo, producto_categoria, cantidad")
      .eq("pedido_id", pedido.id)
      .order("producto_categoria");
    setItems(data || []);
    setLoadingItems(false);
    setOpen(true);
  };

  const estado = pedido.estado || "enviado";
  const colorClase = ESTADO_COLORS[estado] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={cargarItems}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{pedido.numero_pedido}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colorClase}`}>
              {ESTADO_LABELS[estado] || estado}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={13} /> <span className="capitalize">{fecha}</span></span>
            <span className="flex items-center gap-1"><Hash size={13} /> {pedido.total_lineas} artículos</span>
          </div>
          {pedido.observaciones && (
            <p className="text-xs text-gray-400 mt-1 truncate">📝 {pedido.observaciones}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {loadingItems ? <Loader2 size={18} className="animate-spin" /> : open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {open && items.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 font-mono w-20 flex-shrink-0">{item.producto_codigo || "—"}</span>
                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{item.producto_nombre}</span>
                <span className="text-xs text-gray-400 hidden sm:block w-24 flex-shrink-0">{item.producto_categoria}</span>
                <span className="font-bold text-green-700 text-sm flex-shrink-0">{item.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MisPedidos() {
  const { perfil, isAdmin } = useAuth();
  const [pedidos, setPedidos]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [pagina, setPagina]     = useState(1);
  const [hayMas, setHayMas]     = useState(false);
  const POR_PAGINA = 20;

  const cargar = async (pag = 1) => {
    setLoading(true);
    const from = (pag - 1) * POR_PAGINA;
    let query = supabase
      .from("pedidos")
      .select("id, numero_pedido, fecha_pedido, estado, total_lineas, observaciones, tienda_nombre, tienda_id")
      .order("fecha_pedido", { ascending: false })
      .range(from, from + POR_PAGINA);

    if (!isAdmin && perfil?.tienda_id) {
      query = query.eq("tienda_id", perfil.tienda_id);
    }

    const { data } = await query;
    if (pag === 1) setPedidos(data || []);
    else setPedidos(prev => [...prev, ...(data || [])]);
    setHayMas((data || []).length === POR_PAGINA + 1);
    setPagina(pag);
    setLoading(false);
  };

  useEffect(() => { if (perfil !== null) cargar(1); }, [perfil?.id]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-600" /> Mis Pedidos
          </h1>
          <p className="text-gray-500 text-sm mt-1">Historial completo · haz clic para ver el detalle</p>
        </div>
      </div>

      {loading && pedidos.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={36} className="animate-spin text-blue-500" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No hay pedidos todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => <PedidoCard key={p.id} pedido={p} />)}
          {hayMas && (
            <button onClick={() => cargar(pagina + 1)} disabled={loading}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-blue-300 hover:text-blue-600 font-semibold transition-all disabled:opacity-50">
              {loading ? "Cargando..." : "Ver más pedidos"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
