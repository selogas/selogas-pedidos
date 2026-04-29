import { X, Trash2, ShoppingBag, Send, AlertCircle, Plus } from "lucide-react";
import { useState } from "react";

export default function CartSidebar({ carrito, productos, onClose, onQtyChange, onRemove, onEnviar, tiendaNombre }) {
  const [obs, setObs] = useState("");

  const lineas = Object.entries(carrito)
    .filter(([_, qty]) => qty > 0)
    .map(([prodId, qty]) => {
      const prod = productos.find(p => p.id === prodId);
      return prod ? { prod, qty } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.prod.orden_excel || 0) - (b.prod.orden_excel || 0));

  const totalLineas = lineas.length;

  return (
    <div className="flex flex-col bg-white h-full w-[380px] max-w-full shadow-xl overflow-y-auto">
      <div className="flex items-center justify-between p-5 border-b">
        <div>
          <h2 className="font-bold text-lg">Mi Pedido</h2>
          {tiendaNombre && <div className="text-sm text-gray-500">{tiendaNombre}</div>}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {lineas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Tu pedido está vacío</p>
          </div>
        ) : (
          lineas.map(({ prod, qty }) => (
            <div key={prod.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight truncate">{prod.nombre}</div>
                {prod.codigo && <div className="text-xs text-gray-400 mt-0.5">Cód: {prod.codigo}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center font-bold text-blue-600"
                  onClick={() => onQtyChange(prod.id, qty - (prod.multiplo || 1))}>−</button>
                <span className="font-bold w-8 text-center text-sm">{qty}</span>
                <button className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold"
                  onClick={() => onQtyChange(prod.id, qty + (prod.multiplo || 1))}>+</button>
                <button onClick={() => onRemove(prod.id)} className="ml-1 text-gray-300 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {lineas.length > 0 && (
        <div className="px-4 pb-2">
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Observaciones (opcional)..." className="w-full text-sm p-3 border rounded-xl resize-none" rows={2} />
        </div>
      )}
      <div className="p-4 border-t">
        <div className="flex justify-between text-sm mb-3 text-gray-500">
          <span>Total líneas:</span>
          <span className="font-bold text-gray-900">{totalLineas} productos</span>
        </div>
        <button className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          disabled={lineas.length === 0}
          style={{ opacity: lineas.length === 0 ? 0.5 : 1 }}
          onClick={() => onEnviar(obs, lineas)}>
          <Send size={18} />
          Enviar Pedido ({totalLineas} líneas)
        </button>
      </div>
    </div>
  );
}