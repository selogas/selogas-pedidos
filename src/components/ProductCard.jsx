import { Package, Star, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import TopVentasBadge from './TopVentasBadge';

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function formatearDiasPedido(fechas) {
  if (!fechas?.length) return null;
  const unicos = [...new Set(fechas.map(f => DIAS[new Date(f).getDay()]))];
  return unicos.join(', ');
}

// Lógica inteligente de aviso de cantidad
function calcularAvisoMedia(cantidad, mediaHistorica) {
  if (!mediaHistorica || !cantidad) return null;
  const { media, numPedidos } = mediaHistorica;
  if (!media || numPedidos < 3) return null;

  const ratio = cantidad / media;

  if (ratio < 0.6) {
    return {
      tipo: 'bajo',
      texto: `Sueles pedir ${media} uds`,
      icon: TrendingDown,
      color: 'text-orange-600 bg-orange-50',
    };
  }
  if (ratio > 1.4) {
    return {
      tipo: 'alto',
      texto: `Sueles pedir ${media} uds`,
      icon: TrendingUp,
      color: 'text-[#00913f] bg-[#edf7f2]',
    };
  }
  return null;
}

export default function ProductCard({
  producto,
  cantidad,
  onAdd,
  onQtyChange,
  fechasPedido = [],
  mediaHistorica = null,
  esFavorito = false,
  esTop = false,
  onToggleFavorito,
}) {
  const multiplo = producto.multiplo || 1;
  const agotado  = producto.disponible === false;
  const yaPedido = fechasPedido.length > 0;
  const diasStr  = formatearDiasPedido(fechasPedido);
  const aviso    = calcularAvisoMedia(cantidad, mediaHistorica);

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-all
        ${agotado   ? 'opacity-75'        : ''}
        ${yaPedido  ? 'border-orange-300' : 'border-gray-100'}
        ${esTop     ? 'ring-1 ring-amber-300/60' : ''}`}
    >
      {/* ── Imagen ─────────────────────────────────────────────── */}
      <div className="relative h-32 bg-gray-50 flex items-center justify-center">

        {/* Halo dorado sutil detrás de imagen (variante "glow") */}
        {esTop && <TopVentasBadge variant="glow" />}

        {/* Badge "Top Ventas" en esquina superior izquierda */}
        {esTop ? (
          <TopVentasBadge variant="badge" />
        ) : (
          /* Estrella de favorito solo si NO es top ventas */
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorito?.(); }}
            className={`absolute top-1.5 right-1.5 transition-colors
              ${esFavorito ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
            title={esFavorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <Star size={14} fill={esFavorito ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Badge "Agotado" */}
        {agotado && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            Agotado
          </div>
        )}

        {/* Indicador de días pedido previo */}
        {yaPedido && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
            <Clock size={9} /> {diasStr}
          </div>
        )}

        {/* Imagen del producto */}
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="w-full h-full object-contain p-2"
            onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
          />
        ) : (
          <Package size={32} className="text-gray-200" />
        )}
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2 min-h-[2rem]">
          {producto.nombre}
        </h3>
        {producto.codigo && (
          <p className="text-xs text-gray-400 font-mono">{producto.codigo}</p>
        )}
        <p className="text-xs text-[#00913f] font-semibold">x{multiplo}</p>

        {/* Aviso inteligente de cantidad */}
        {aviso && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-lg ${aviso.color}`}>
            <aviso.icon size={11} />
            {aviso.texto}
          </div>
        )}

        {/* ── Controles de cantidad ─────────────────────────────── */}
        <div className="mt-auto pt-1">
          {cantidad > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onQtyChange(Math.max(0, cantidad - multiplo))}
                className="w-7 h-7 rounded-xl bg-[#00913f] text-white font-bold flex items-center justify-center hover:bg-[#007a34]"
              >
                −
              </button>
              <span className="flex-1 text-center font-bold text-sm">{cantidad}</span>
              <button
                onClick={() => onQtyChange(cantidad + multiplo)}
                className="w-7 h-7 rounded-xl bg-[#00913f] text-white font-bold flex items-center justify-center hover:bg-[#007a34]"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => !agotado && onAdd(producto)}
              disabled={agotado}
              className="w-full py-2 rounded-xl bg-[#00913f] text-white text-xs font-bold hover:bg-[#007a34] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agotado ? 'Agotado' : 'Añadir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
