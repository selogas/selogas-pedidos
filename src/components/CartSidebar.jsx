import { useState, useMemo } from 'react';
import { X, Trash2, ShoppingCart, Send, ChevronDown, AlertCircle, Plus, Lightbulb } from 'lucide-react';

export default function CartSidebar({ carrito, productos, sugerencias = [], onClose, onQtyChange, onRemove, onEnviar, onAddSugerencia, tiendaNombre }) {
  const [observaciones, setObservaciones] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(true);

  const lineas = useMemo(() => {
    return Object.entries(carrito)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = productos.find(p => p.id === id);
        return prod ? { prod, qty } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.prod.orden_excel || 0) - (b.prod.orden_excel || 0));
  }, [carrito, productos]);

  const totalLineas = lineas.length;

  const handleEnviar = () => {
    if (totalLineas === 0) return;
    onEnviar(observaciones, lineas);
    setConfirmOpen(false);
  };

  return (
    <div className="w-full max-w-sm bg-white h-full flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} />
          <div>
            <div className="font-bold text-base">Mi pedido</div>
            {tiendaNombre && <div className="text-xs text-blue-100">{tiendaNombre}</div>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-700 transition-colors"><X size={18} /></button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {lineas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <ShoppingCart size={48} className="text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">El carrito est&aacute; vac&iacute;o</p>
            <p className="text-gray-400 text-sm mt-1">A&ntilde;ade productos desde el cat&aacute;logo</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lineas.map(({ prod, qty }) => {
              const multiplo = prod.multiplo || 1;
              const minimo = prod.minimo || multiplo;
              return (
                <div key={prod.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-contain p-1"
                        onError={e => { e.target.onerror=null; e.target.style.display='none'; }} />
                    ) : (
                      <ShoppingCart size={20} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-gray-900 leading-snug line-clamp-2">{prod.nombre}</div>
                    {prod.codigo && <div className="text-xs text-gray-400 font-mono">{prod.codigo}</div>}
                    <div className="text-xs text-blue-600 font-semibold">x{multiplo}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => onQtyChange(prod.id, Math.max(0, qty - multiplo))}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-base">&minus;</button>
                    <span className="w-8 text-center font-bold text-sm text-gray-900">{qty}</span>
                    <button onClick={() => onQtyChange(prod.id, qty + multiplo)}
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center text-base">+</button>
                    <button onClick={() => onRemove(prod.id)} className="w-7 h-7 ml-1 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sugerencias */}
        {sugerencias.length > 0 && (
          <div className="border-t border-dashed border-amber-300 bg-amber-50">
            <button onClick={() => setShowSugerencias(s => !s)}
              className="w-full flex items-center justify-between p-3 text-amber-800">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Lightbulb size={16} className="text-amber-500" />
                &iquest;No se te olvida esto?
                <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{sugerencias.length}</span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${showSugerencias ? 'rotate-180' : ''}`} />
            </button>
            {showSugerencias && (
              <div className="px-3 pb-3 space-y-1.5">
                <p className="text-xs text-amber-600 mb-2">Productos que no has pedido recientemente:</p>
                {sugerencias.map(prod => (
                  <div key={prod.id} className="flex items-center gap-2 bg-white rounded-xl p-2 border border-amber-200">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {prod.imagen_url ? (
                        <img src={prod.imagen_url} alt="" className="w-full h-full object-contain p-0.5"
                          onError={e => { e.target.style.display='none'; }} />
                      ) : <ShoppingCart size={12} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 line-clamp-1">{prod.nombre}</div>
                      <div className="text-xs text-blue-600">x{prod.multiplo || 1}</div>
                    </div>
                    <button onClick={() => onAddSugerencia(prod)}
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 flex-shrink-0">
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {lineas.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          <div className="text-sm text-gray-500">
            <span className="font-bold text-gray-900">{totalLineas}</span> {totalLineas === 1 ? 'producto' : 'productos'} en el pedido
          </div>
          <textarea
            className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400"
            rows={2} placeholder="Observaciones (opcional)..."
            value={observaciones} onChange={e => setObservaciones(e.target.value)}
          />
          {!confirmOpen ? (
            <button onClick={() => setConfirmOpen(true)}
              className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md transition-colors">
              <Send size={18} />
              Enviar pedido
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-amber-800 text-xs">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>&iquest;Confirmas el pedido de <strong>{totalLineas} producto{totalLineas !== 1 ? 's' : ''}</strong>?</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-100">Cancelar</button>
                <button onClick={handleEnviar} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-700">
                  <Send size={16} />Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
