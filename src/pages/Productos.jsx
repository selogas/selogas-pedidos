import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, Loader2, Pencil, ToggleLeft, ToggleRight, Plus, Trash2, X, Check, Upload, Globe } from "lucide-react";

const GRUPOS = [
  { value: 'ambas', label: '🌐 Ambas', desc: 'Todos lo ven', color: 'bg-purple-100 text-purple-700' },
  { value: 'estacion', label: '🏪 Estación', desc: 'Solo estaciones', color: 'bg-blue-100 text-blue-700' },
  { value: 'cafeteria', label: '☕ Cafetería', desc: 'Solo cafeterías', color: 'bg-orange-100 text-orange-700' },
];

function EditProductoModal({ producto, categorias, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: producto.nombre || '',
    codigo: producto.codigo || '',
    categoria: producto.categoria || '',
    formato: producto.formato || '',
    multiplo: producto.multiplo || 1,
    imagen_url: producto.imagen_url || '',
    disponible: producto.disponible !== false,
    grupo_visualizacion: producto.grupo_visualizacion || 'ambas',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `productos/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('imagenes').upload(fileName, file, { upsert: true });
    if (!error) {
      const { data: url } = supabase.storage.from('imagenes').getPublicUrl(fileName);
      setForm(f => ({ ...f, imagen_url: url.publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('productos').update(form).eq('id', producto.id);
    setSaving(false);
    if (!error) onSave({ ...producto, ...form });
    else alert('Error: ' + error.message);
  };

  const grupoActual = GRUPOS.find(g => g.value === form.grupo_visualizacion) || GRUPOS[0];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Editar producto</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Código SKU</label>
            <input type="text" value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value}))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Categoría</label>
            {categorias.length > 0 ? (
              <select value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm">
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input type="text" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Formato</label>
            <input type="text" value={form.formato} onChange={e => setForm(f => ({...f, formato: e.target.value}))}
              placeholder="ej: X12, 70CL" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Múltiplo de pedido</label>
            <input type="number" min="1" value={form.multiplo} onChange={e => setForm(f => ({...f, multiplo: Number(e.target.value)}))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>

          {/* GRUPO VISUALIZACION */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Visibilidad por tipo de tienda
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GRUPOS.map(g => (
                <button
                  key={g.value}
                  onClick={() => setForm(f => ({...f, grupo_visualizacion: g.value}))}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${
                    form.grupo_visualizacion === g.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm font-bold">{g.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{g.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Selecciona qué tipo de tiendas pueden ver este producto
            </p>
          </div>

          {/* IMAGEN */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen</label>
            <div className="flex gap-3 items-center">
              <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.imagen_url ? (
                  <img src={form.imagen_url} alt="" className="w-full h-full object-contain p-1" />
                ) : (
                  <Package size={32} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                <input
                  type="text"
                  value={form.imagen_url}
                  onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))}
                  placeholder="O pega una URL..."
                  className="w-full text-xs border rounded-lg px-3 py-1.5 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* DISPONIBLE */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-sm font-semibold text-gray-700">Disponible</div>
              <div className="text-xs text-gray-400">Visible en el catálogo</div>
            </div>
            <button
              onClick={() => setForm(f => ({...f, disponible: !f.disponible}))}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.disponible ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.disponible ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70">
            {saving ? "Guardando..." : "Guardar cambios"}
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
  const [filtroGrupo, setFiltroGrupo] = useState("__todos__");

  useEffect(() => {
    supabase.from('productos').select('*').order('orden_excel').then(({ data }) => {
      setProductos(data || []);
      setLoading(false);
    });
  }, []);

  const categorias = useMemo(() => {
    const seen = [];
    const s = new Set();
    for (const p of productos) {
      if (p.categoria && !s.has(p.categoria)) { s.add(p.categoria); seen.push(p.categoria); }
    }
    return seen;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let list = productos;
    if (categoriaActiva !== "__todas__") list = list.filter(p => p.categoria === categoriaActiva);
    if (filtroGrupo !== "__todos__") list = list.filter(p => (p.grupo_visualizacion || 'ambas') === filtroGrupo);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, categoriaActiva, busqueda, filtroGrupo]);

  const handleToggle = async (prod) => {
    const nuevo = prod.disponible === false ? true : false;
    await supabase.from('productos').update({ disponible: nuevo }).eq('id', prod.id);
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, disponible: nuevo } : p));
  };

  const handleSave = (updated) => {
    setProductos(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditando(null);
  };

  const handleDelete = async (prod) => {
    if (!confirm(`¿Eliminar "${prod.nombre}"?`)) return;
    await supabase.from('productos').delete().eq('id', prod.id);
    setProductos(prev => prev.filter(p => p.id !== prod.id));
  };

  const handleGrupoChange = async (prod, nuevoGrupo) => {
    await supabase.from('productos').update({ grupo_visualizacion: nuevoGrupo }).eq('id', prod.id);
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, grupo_visualizacion: nuevoGrupo } : p));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={40} className="animate-spin" style={{ color: "var(--color-primary)" }} />
    </div>
  );

  return (
    <div>
      {editando && (
        <EditProductoModal
          producto={editando}
          categorias={categorias}
          onClose={() => setEditando(null)}
          onSave={handleSave}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" />
        </div>

        <select value={categoriaActiva} onChange={e => setCategoriaActiva(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm">
          <option value="__todas__">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm">
          <option value="__todos__">Todos los grupos</option>
          <option value="ambas">🌐 Ambas</option>
          <option value="estacion">🏪 Estación</option>
          <option value="cafeteria">☕ Cafetería</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-gray-500">
        Mostrando {productosFiltrados.length} de {productos.length} productos
      </div>

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => {
            const grupoInfo = GRUPOS.find(g => g.value === (prod.grupo_visualizacion || 'ambas')) || GRUPOS[0];
            const disponible = prod.disponible !== false;
            return (
              <div key={prod.id} className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow ${!disponible ? "opacity-60" : ""}`}>
                <div className="relative bg-gray-50 flex items-center justify-center" style={{ height: "120px" }}>
                  {prod.imagen_url ? (
                    <img src={prod.imagen_url} alt={prod.nombre}
                      className="w-full h-full object-contain p-2" />
                  ) : (
                    <Package size={36} className="text-gray-200" />
                  )}
                  {/* Badge grupo */}
                  <span className={`absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${grupoInfo.color}`}>
                    {grupoInfo.value === 'ambas' ? '🌐' : grupoInfo.value === 'estacion' ? '🏪' : '☕'}
                  </span>
                </div>
                <div className="p-2 flex flex-col flex-1 gap-1">
                  <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2">{prod.nombre}</h3>
                  {prod.codigo && <p className="text-xs text-gray-400">SKU: {prod.codigo}</p>}
                  
                  {/* Selector rápido de grupo */}
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs mt-1">
                    {GRUPOS.map(g => (
                      <button key={g.value} onClick={() => handleGrupoChange(prod, g.value)}
                        className={`flex-1 py-0.5 transition-colors font-medium ${
                          (prod.grupo_visualizacion || 'ambas') === g.value
                            ? (g.value === 'ambas' ? 'bg-purple-600 text-white' : g.value === 'estacion' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white')
                            : 'bg-white text-gray-400 hover:bg-gray-50'
                        }`}
                        title={g.desc}
                      >
                        {g.value === 'ambas' ? '🌐' : g.value === 'estacion' ? '🏪' : '☕'}
                      </button>
                    ))}
                  </div>

                  <div className="mt-auto pt-1 flex gap-1">
                    <button onClick={() => setEditando(prod)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                      <Pencil size={11} /> Editar
                    </button>
                    <button onClick={() => handleDelete(prod)}
                      className="p-1 rounded-lg text-red-400 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                    <button onClick={() => handleToggle(prod)}
                      className={`p-1 rounded-lg ${disponible ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`}
                      title={disponible ? "Desactivar" : "Activar"}>
                      {disponible ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}