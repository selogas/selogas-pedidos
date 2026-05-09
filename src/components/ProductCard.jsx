import { Package, Star, Clock } from 'lucide-react';

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function formatearDiasPedido(fechas) {
  if (!fechas?.length) return null;
  const dias = fechas.map(f => {
    const d = new Date(f);
    return DIAS[d.getDay()];
  });
  // Únicos y ordenados
  const unicos = [...new Set(dias)];
  return unicos.join(', ');
}

export default function ProductCard({ producto, cantidad, onAdd, onQtyChange, fechasPedido = [] }) {
  const multiplo  = producto.multiplo || 1;
  const minimo    = producto.minimo || multiplo;
  const agotado   = producto.disponible === false;
  const yaPedido  = fechasPedido.length > 0;
  const diasStr   = formatearDiasPedido(fechasPedido);

  return (
    <div className={`bg-white rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-all
      ${agotado ? 'opacity-75' : ''}
      ${yaPedido ? 'border-orange-300' : 'border-gray-100'}`}>

      <div className="relative h-32 bg-gray-50 flex items-center justify-center">
        {producto.favorito && (
          <span className="absolute top-1.5 right-1.5 text-yellow-400"><Star size={14} fill="currentColor" /></span>
        )}
        {agotado && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            Agotado
          </div>
        )}
        {yaPedido && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
            <Clock size={9} /> {diasStr}
          </div>
        )}
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre}
            className="w-full h-full object-contain p-2"
            onError={e => { e.target.onerror=null; e.target.style.display='none'; }} />
        ) : (
          <Package size={32} className="text-gray-200" />
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2 min-h-[2rem]">{producto.nombre}</h3>
        {producto.formato && <p className="text-xs text-gray-400 truncate">{producto.formato}</p>}
        {producto.codigo && <p className="text-xs text-gray-400 font-mono">{producto.codigo}</p>}
        <p className="text-xs text-blue-600 font-semibold">x{multiplo}</p>
        <div className="mt-auto pt-1">
          {cantidad > 0 ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onQtyChange(Math.max(0, cantidad - multiplo))}
                className="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700">−</button>
              <span className="flex-1 text-center font-bold text-sm">{cantidad}</span>
              <button onClick={() => onQtyChange(cantidad + multiplo)}
                className="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700">+</button>
            </div>
          ) : (
            <button onClick={() => !agotado && onAdd(producto)} disabled={agotado}
              className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {agotado ? 'Agotado' : 'Añadir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
