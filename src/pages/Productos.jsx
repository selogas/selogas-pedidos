import { useState, useEffect, useMemo } from 'react';
import { productosApi, categoriasApi, uploadFile } from '../api';
import { Search, Package, Loader2, Pencil, ToggleLeft, ToggleRight, Plus, Trash2, Star, Tag, X, Save, ChevronUp, ChevronDown, ImageIcon, AlertCircle } from 'lucide-react';

const GRUPOS_PROD = [
  { value: 'ambos', label: 'Ambos', color: 'bg-blue-100 text-blue-700' },
  { value: 'estacion', label: 'Estación', color: 'bg-orange-100 text-orange-700' },
  { value: 'cafeteria', label: 'Cafetería', color: 'bg-purple-100 text-purple-700' },
];

function EditProductoModal({ producto, categorias, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: '', codigo: '', formato: '', categoria: '', imagen_url: '',
    multiplo: 1, minimo: 1, disponible: true, favorito: false, visibilidad_grupo: 'ambos',
    ...producto
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      setForm(f => ({ ...f, imagen_url: file_url }));
    } catch(err) { alert('Error al subir imagen: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    setSaving(true);
    const updated = await productosApi.update(producto.id, form);
    setSaving(false);
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">Editar producto</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { field: 'nombre', label: 'Nombre *' },
            { field: 'codigo', label: 'Código SKU' },
            { field: 'formato', label: 'Formato / Unidad' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
              <input className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={form[field] || ''} onChange={e => setForm(f => ({...f, [field]: e.target.value}))} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Imagen</label>
            <div className="flex gap-2">
              <input className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={form.imagen_url || ''} onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))} placeholder="URL de imagen..." />
              <label className="px-3 py-2.5 rounded-xl border border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 text-sm text-gray-500 flex items-center gap-1">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            {form.imagen_url && <img src={form.imagen_url} alt="" className="mt-2 h-20 object-contain rounded-xl border" />}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoría</label>
            <select className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.categoria || ''} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Visible en</label>
            <div className="flex gap-2">
              {GRUPOS_PROD.map(g => (
                <button key={g.value} type="button" onClick={() => setForm(f => ({...f, visibilidad_grupo: g.value}))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${form.visibilidad_grupo === g.value ? g.color + ' border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Múltiplo</label>
              <input type="number" min="1" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={form.multiplo || 1} onChange={e => setForm(f => ({...f, multiplo: Number(e.target.value)}))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mínimo</label>
              <input type="number" min="1" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={form.minimo || 1} onChange={e => setForm(f => ({...f, minimo: Number(e.target.value)}))} />
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-xl flex-1">
              <input type="checkbox" checked={form.disponible !== false}
                onChange={e => setForm(f => ({...f, disponible: e.target.checked}))} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">Disponible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-xl flex-1">
              <input type="checkbox" checked={!!form.favorito}
                onChange={e => setForm(f => ({...f, favorito: e.target.checked}))} className="w-4 h-4 accent-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Favorito ⭐</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriaModal({ cat, onClose, onSave }) {
  const [form, setForm] = useState(cat || { nombre: '', grupo: 'ambos', orden: 99 });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    setSaving(true);
    try {
      let result;
      if (form.id) result = await categoriasApi.update(form.id, form);
      else result = await categoriasApi.create(form);
      onSave(result);
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">{form.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre *</label>
            <input className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Nombre de la categoría" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Visible en</label>
            <select className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.grupo || 'ambos'} onChange={e => setForm(f => ({...f, grupo: e.target.value}))}>
              <option value="estacion">Estación de Servicio</option>
              <option value="cafeteria">Cafetería</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('__todas__');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [catModal, setCatModal] = useState(null);
  const [showCats, setShowCats] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    Promise.all([productosApi.list('orden_excel', 2000), categoriasApi.list()]).then(([p, c]) => {
      setProductos(p);
      setCategorias(c);
      setLoading(false);
    });
  }, []);

  const productosFiltrados = useMemo(() => {
    let list = categoriaActiva !== '__todas__' ? productos.filter(p => p.categoria === categoriaActiva) : productos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, categoriaActiva, busqueda]);

  const handleToggle = async (prod) => {
    const nuevo = prod.disponible === false;
    await productosApi.update(prod.id, { disponible: nuevo });
    setProductos(prev => prev.map(p => p.id === prod.id ? {...p, disponible: nuevo} : p));
  };

  const handleFavorito = async (prod) => {
    const nuevo = !prod.favorito;
    await productosApi.update(prod.id, { favorito: nuevo });
    setProductos(prev => prev.map(p => p.id === prod.id ? {...p, favorito: nuevo} : p));
  };

  const handleEliminar = async (prod) => {
    if (!confirm(`¿Eliminar "${prod.nombre}"?`)) return;
    await productosApi.delete(prod.id);
    setProductos(prev => prev.filter(p => p.id !== prod.id));
  };

  const handleEliminarSeleccionados = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} productos seleccionados?`)) return;
    await productosApi.bulkDelete([...selected]);
    setProductos(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  };

  const handleSaveCat = (saved) => {
    setCategorias(prev => {
      const exists = prev.find(c => c.id === saved.id);
      return exists ? prev.map(c => c.id === saved.id ? saved : c).sort((a,b) => (a.orden||0)-(b.orden||0))
        : [...prev, saved].sort((a,b) => (a.orden||0)-(b.orden||0));
    });
    setCatModal(null);
  };

  const handleDeleteCat = async (id) => {
    if (!confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return;
    await categoriasApi.delete(id);
    setCategorias(prev => prev.filter(c => c.id !== id));
  };

  const handleMoveCat = async (idx, dir) => {
    const arr = [...categorias];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    arr.forEach((c, i) => { c.orden = i; });
    setCategorias([...arr]);
    for (const c of arr) await categoriasApi.update(c.id, { orden: c.orden });
  };

  const GRUPO_COLOR = { estacion: 'bg-orange-100 text-orange-700', cafeteria: 'bg-purple-100 text-purple-700', ambos: 'bg-blue-100 text-blue-700' };
  const GRUPO_LABEL = { estacion: 'Estación', cafeteria: 'Cafetería', ambos: 'Ambos' };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={40} className="animate-spin text-blue-600" /></div>;

  return (
    <div>
      {editando && <EditProductoModal producto={editando} categorias={categorias} onClose={() => setEditando(null)}
        onSave={(updated) => { setProductos(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditando(null); }} />}
      {catModal !== null && <CategoriaModal cat={catModal === 'new' ? null : catModal} onClose={() => setCatModal(null)} onSave={handleSaveCat} />}

      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900 mr-2">Productos</h1>
        <button onClick={() => setCatModal('new')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
          <Tag size={14} />Categorías
        </button>
        <button onClick={() => setShowCats(s => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50">
          {showCats ? 'Ocultar cats' : 'Gestionar cats'}
        </button>
        {selected.size > 0 && (
          <button onClick={handleEliminarSeleccionados} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100">
            <Trash2 size={14} />Eliminar ({selected.size})
          </button>
        )}
        <div className="ml-auto text-sm text-gray-400">{productosFiltrados.length} productos</div>
      </div>

      {/* Gestión de categorías expandible */}
      {showCats && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-900">Gestión de categorías</h3>
            <button onClick={() => setCatModal('new')} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold">
              <Plus size={12} />Nueva
            </button>
          </div>
          <div className="space-y-1">
            {categorias.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl hover:bg-gray-100">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => handleMoveCat(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-white disabled:opacity-30"><ChevronUp size={12} /></button>
                  <button onClick={() => handleMoveCat(idx, 1)} disabled={idx === categorias.length-1} className="p-0.5 rounded hover:bg-white disabled:opacity-30"><ChevronDown size={12} /></button>
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{cat.nombre}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${GRUPO_COLOR[cat.grupo] || 'bg-gray-100 text-gray-500'}`}>
                  {GRUPO_LABEL[cat.grupo] || 'Ambos'}
                </span>
                <button onClick={() => setCatModal(cat)} className="p-1 rounded-lg hover:bg-white text-blue-500"><Pencil size={13} /></button>
                <button onClick={() => handleDeleteCat(cat.id)} className="p-1 rounded-lg hover:bg-white text-red-400"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar productos..." className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
      </div>

      {/* Filtros por categoría */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        <button key="__todas__" onClick={() => setCategoriaActiva('__todas__')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${categoriaActiva === '__todas__' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
          Todas
        </button>
        {categorias.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.nombre)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${categoriaActiva === cat.nombre ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta vista</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {productosFiltrados.map(prod => (
            <div key={prod.id} onClick={() => setSelected(s => { const n = new Set(s); n.has(prod.id) ? n.delete(prod.id) : n.add(prod.id); return n; })}
              className={`bg-white rounded-xl border-2 flex flex-col overflow-hidden hover:shadow-md transition-all cursor-pointer ${selected.has(prod.id) ? 'border-blue-500' : 'border-gray-200'} ${prod.disponible === false ? 'opacity-60' : ''}`}>
              <div className="h-28 bg-gray-50 flex items-center justify-center relative">
                {prod.favorito && <span className="absolute top-1 right-1 text-yellow-400"><Star size={14} fill="currentColor" /></span>}
                {prod.disponible === false && (
                  <span className="absolute bottom-1 left-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-lg font-semibold">Agotado</span>
                )}
                {prod.imagen_url ? (
                  <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-contain p-2"
                    onError={e => { e.target.style.display='none'; }} />
                ) : (
                  <Package size={32} className="text-gray-200" />
                )}
              </div>
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2">{prod.nombre}</h3>
                {prod.codigo && <p className="text-xs text-gray-400">SKU: {prod.codigo}</p>}
                <div className="flex items-center gap-1 flex-wrap mt-auto">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${GRUPO_COLOR[prod.visibilidad_grupo] || 'bg-gray-100 text-gray-500'}`}>
                    {GRUPO_LABEL[prod.visibilidad_grupo] || 'Ambos'}
                  </span>
                  <span className="text-xs text-blue-600 font-semibold">x{prod.multiplo || 1}</span>
                </div>
                <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditando(prod)} className="flex-1 flex items-center justify-center gap-0.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                    <Pencil size={11} />Editar
                  </button>
                  <button onClick={() => handleFavorito(prod)} className={`p-1.5 rounded-lg ${prod.favorito ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:bg-gray-50'}`}>
                    <Star size={14} fill={prod.favorito ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => handleToggle(prod)} className={`p-1.5 rounded-lg ${prod.disponible !== false ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                    {prod.disponible !== false ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => handleEliminar(prod)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
