import { useState, useEffect, useMemo } from "react";
import { productosApi, configuracionApi } from "../api";
import { Search, Package, Loader2, Pencil, ToggleLeft, ToggleRight, Plus, Trash2, Star } from "lucide-react";

function EditProductoModal({ producto, onClose, onSave, categorias }) {
  const [form, setForm] = useState({ ...producto });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated = await productosApi.update(producto.id, form);
    setSaving(false);
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Editar producto</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
        </div>
        <div className="space-y-4">
          {[
            { field: "nombre", label: "Nombre *" },
            { field: "codigo", label: "Código SKU" },
            { field: "formato", label: "Formato" },
            { field: "imagen_url", label: "URL Imagen" },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
              <input type="text" value={form[field] || ""} onChange={e => setForm(f => ({...f, [field]: e.target.value}))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
            <select value={form.categoria || ""} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm">
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Múltiplo de pedido</label>
            <input type="number" min="1" value={form.multiplo || 1} onChange={e => setForm(f => ({...f, multiplo: Number(e.target.value)}))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-xl">
            <input type="checkbox" checked={form.disponible !== false} onChange={e => setForm(f => ({...f, disponible: e.target.checked}))} />
            <span className="text-sm font-medium">Disponible</span>
          </label>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("__todas__");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    productosApi.list("orden_excel", 1000).then(p => { setProductos(p); setLoading(false); });
  }, []);

  const categorias = useMemo(() => {
    const seen = new Set(); const result = [];
    for (const p of productos) { if (p.categoria && !seen.has(p.categoria)) { seen.add(p.categoria); result.push(p.categoria); } }
    return result;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let list = categoriaActiva !== "__todas__" ? productos.filter(p => p.categoria === categoriaActiva) : productos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, categoriaActiva, busqueda]);

  const handleToggle = async (prod) => {
    const nuevo = prod.disponible === false ? true : false;
    await productosApi.update(prod.id, { disponible: nuevo });
    setProductos(prev => prev.map(p => p.id === prod.id ? {...p, disponible: nuevo} : p));
  };

  const handleEliminar = async (prod) => {
    if (!confirm(`¿Eliminar "${prod.nombre}"?`)) return;
    await productosApi.delete(prod.id);
    setProductos(prev => prev.filter(p => p.id !== prod.id));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={40} className="animate-spin text-blue-600" /></div>;

  return (
    <div>
      {editando && <EditProductoModal producto={editando} onClose={() => setEditando(null)}
        onSave={(updated) => { setProductos(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditando(null); }}
        categorias={categorias} />}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar productos..." className="search-bar pl-12 w-full" />
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {["__todas__", ...categorias].map(cat => (
          <button key={cat} onClick={() => setCategoriaActiva(cat)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${categoriaActiva === cat ? "bg-blue-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>
            {cat === "__todas__" ? "Todas" : cat}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-4">{productosFiltrados.length} productos</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {productosFiltrados.map(prod => (
          <div key={prod.id} className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow ${prod.disponible === false ? "opacity-60" : ""}`}>
            <div className="h-32 bg-gray-50 flex items-center justify-center">
              {prod.imagen_url ? (
                <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-contain p-2" onError={e => e.target.style.display='none'} />
              ) : (
                <Package size={36} className="text-gray-300" />
              )}
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1">
              <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2">{prod.nombre}</h3>
              {prod.codigo && <p className="text-xs text-gray-400">SKU: {prod.codigo}</p>}
              <p className="text-xs text-gray-500">Múltiplo: <span className="font-semibold text-blue-600">{prod.multiplo || 1}</span></p>
              <div className="mt-auto pt-2 flex gap-1.5">
                <button onClick={() => setEditando(prod)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                  <Pencil size={12} />Editar
                </button>
                <button onClick={() => handleEliminar(prod)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
                <button onClick={() => handleToggle(prod)} className={`p-1.5 rounded-lg ${prod.disponible !== false ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`}>
                  {prod.disponible !== false ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}