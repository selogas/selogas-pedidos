import { useState, useEffect } from "react";
import { pedidosApi, pedidoLineasApi } from "../api";
import { useAuth } from "../lib/auth";
import { ClipboardList, ChevronDown, Loader2, FileText, Package } from "lucide-react";

function PedidoDetalle({ pedido, onClose }) {
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pedidoLineasApi.filter({ pedido_id: pedido.id }, 'orden_excel', 500).then(l => {
      setLineas(l.sort((a, b) => (a.orden_excel || 0) - (b.orden_excel || 0)));
      setLoading(false);
    });
  }, [pedido.id]);

  const handleDescargar = () => {
    const lineasTexto = lineas.map((l, i) =>
      `${i + 1}. [${l.producto_codigo || "-"}] ${l.producto_nombre} - Cant: ${l.cantidad}`
    ).join("\n");
    const contenido = `PEDIDO: ${pedido.numero_pedido}\nTienda: ${pedido.tienda_nombre}\nFecha: ${new Date(pedido.fecha_pedido).toLocaleString("es-ES")}\n\nPRODUCTOS:\n${lineasTexto}`;
    const blob = new Blob([contenido], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${pedido.numero_pedido}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-lg">{pedido.numero_pedido}</h2>
            <div className="text-sm text-gray-500">{pedido.tienda_nombre} · {new Date(pedido.fecha_pedido).toLocaleDateString("es-ES")}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDescargar} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border hover:bg-gray-50">
              <FileText size={15} />Descargar
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
          ) : (
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs text-gray-400 w-6 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{l.producto_nombre}</div>
                    <div className="text-xs text-gray-400">{l.producto_codigo ? `Cód: ${l.producto_codigo}` : ""}</div>
                  </div>
                  <div className="flex-shrink-0 font-bold text-sm text-blue-600">x{l.cantidad}</div>
                </div>
              ))}
              {pedido.observaciones && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <span className="font-medium">Observaciones:</span> {pedido.observaciones}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MisPedidos() {
  const { user, isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    const init = async () => {
      let peds;
      if (isAdmin) {
        peds = await pedidosApi.list('-fecha_pedido', 200);
      } else {
        peds = await pedidosApi.filter(
          { usuario_email: user?.email || '__none__' }, '-fecha_pedido', 100
        ).catch(() => []);
      }
      setPedidos(peds);
      setLoading(false);
    };
    if (user) init();
  }, [user, isAdmin]);

  const estadoColor = (e) => ({
    borrador: "bg-gray-100 text-gray-600",
    enviado: "bg-blue-100 text-blue-700",
    confirmado: "bg-green-100 text-green-700",
    entregado: "bg-purple-100 text-purple-700",
  }[e] || "bg-gray-100 text-gray-500");

  if (loading) return <div className="flex items-center justify-center h-60"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div>
      {detalle && <PedidoDetalle pedido={detalle} onClose={() => setDetalle(null)} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Todos los Pedidos" : "Mis Pedidos"}</h1>
          <p className="text-gray-500 text-sm mt-1">{pedidos.length} pedidos encontrados</p>
        </div>
      </div>
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border shadow-sm">
          <ClipboardList size={56} className="mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">No hay pedidos todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(pedido => (
            <div key={pedido.id}
              className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5 flex items-center gap-4"
              onClick={() => setDetalle(pedido)}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                <Package size={22} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{pedido.numero_pedido}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${estadoColor(pedido.estado)}`}>{pedido.estado}</span>
                  {pedido.email_enviado && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">✉ Email enviado</span>}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {pedido.tienda_nombre} · {new Date(pedido.fecha_pedido).toLocaleString("es-ES")}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-lg text-blue-600">{pedido.total_lineas}</div>
                <div className="text-xs text-gray-400">líneas</div>
              </div>
              <ChevronDown size={18} className="text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}