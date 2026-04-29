import { useState } from "react";
import { ShoppingCart, Plus, Minus, AlertCircle, Star } from "lucide-react";
import { Package } from "lucide-react";

export default function ProductCard({ producto, cantidad, onAdd, onQtyChange }) {
  const multiplo = producto.multiplo || 1;
  const [imgError, setImgError] = useState(false);
  const disponible = producto.disponible !== false;

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative bg-gray-50 flex items-center justify-center" style={{ height: "160px" }}>
        {(!imgError && producto.imagen_url) ? (
          <img src={producto.imagen_url} alt={producto.nombre}
            className={`w-full h-full object-contain p-2 ${!disponible ? "grayscale opacity-50" : ""}`}
            onError={() => setImgError(true)} />
        ) : (
          <Package size={48} className="text-gray-300" />
        )}
        {producto.favorito && (
          <div className="absolute top-2 right-2"><Star size={16} fill="#facc15" className="text-yellow-400" /></div>
        )}
        {!disponible && (
          <div className="absolute top-2 left-2"><span className="badge-agotado">No disponible</span></div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1">
        {producto.categoria && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full self-start bg-blue-50 text-blue-600">
            {producto.categoria}
          </span>
        )}
        <h3 className="font-bold text-sm leading-snug text-gray-900 mt-1 line-clamp-2">{producto.nombre}</h3>
        {producto.codigo && <p className="text-xs text-gray-400">SKU: {producto.codigo}</p>}
        <div className="mt-auto pt-3">
          {!disponible ? (
            <div className="flex items-center justify-center gap-1.5 text-red-400 text-xs py-2">
              <AlertCircle size={13} /><span>Sin stock</span>
            </div>
          ) : cantidad > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-600"
                onClick={() => onQtyChange(Math.max(0, cantidad - multiplo))}>
                <Minus size={14} />
              </button>
              <span className="font-bold text-base text-gray-800">{cantidad}</span>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-600"
                onClick={() => onQtyChange(cantidad + multiplo)}>
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-semibold bg-slate-800 hover:opacity-90"
              onClick={(e) => { e.stopPropagation(); onAdd(producto); }}>
              <ShoppingCart size={15} />Agregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}