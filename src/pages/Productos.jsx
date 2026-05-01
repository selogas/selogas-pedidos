import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, Loader2, Pencil, ToggleLeft, ToggleRight, Plus, Trash2, X, Upload, ChevronRight, FolderOpen, Tag, Images, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const GRUPOS = [
  { value: 'ambas', label: '\u{1F4E6} Ambas', desc: 'Todos lo ven', color: 'bg-purple-100 text-purple-700' },
  { value: 'estacion', label: '\u{1F3EA} Estaci\u00F3n', desc: 'Solo estaciones', color: 'bg-blue-100 text-blue-700' },
  { value: 'cafeteria', label: '\u2615 Cafeter\u00EDa', desc: 'Solo cafeter\u00EDas', color: 'bg-orange-100 text-orange-700' },
];

function SubirImagenesModal({ productos, onClose, onDone }) {
  const inputRef = useRef();
  const [archivos, setArchivos] = useState([]);
  const [fase, setFase] = useState("inicio");
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState([]);

  const handleSeleccion = (e) => {
    const files = Array.from(e.target.files || []);
    const imagenes = files.filter(f => f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name));
    if (imagenes.length === 0) return;

    const mapaProductos = {};
    productos.forEach(p => { if (p.codigo) mapaProductos[p.codigo.toLowerCase().trim()] = p; });

    const emp = imagenes.map(file => {
      const codigoBuscado = file.name.replace(/\.[^.]+$/, "").trim();
      const clave = codigoBuscado.toLowerCase();
      let prod = mapaProductos[clave];
      if (!prod) {
        const k = Object.keys(mapaProductos).find(k => k.includes(clave) || clave.includes(k));
        if (k) prod = mapaProductos[k];
      }
      return { file, codigoBuscado, producto: prod || null, previewUrl: URL.createObjectURL(file), estado: prod ? "listo" : "sin_match" };
    });
    setArchivos(emp);
    setFase("preview");
  };

  const handleSubir = async () => {
    const listos = archivos.filter(a => a.estado === "listo");
    if (listos.length === 0) return;
    setFase("subiendo");
    setProgreso(0);
    const res = [];
    for (let i = 0; i < listos.length; i++) {
      const item = listos[i];
      try {
        const ext = item.file.name.split(".").pop().toLowerCase();
        const safeCode = (item.producto.codigo || item.producto.id).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `productos/${safeCode}.${ext}`;
        const { error: upErr } = await supabase.storage.from("imagenes").upload(fileName, item.file, { upsert: true, contentType: item.file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(fileName);
        await supabase.from("productos").update({ imagen_url: urlData.publicUrl }).eq("id", item.producto.id);
        res.push({ ...item, exito: true });
      } catch (err) {
        res.push({ ...item, exito: false, error: err.message });
      }
      setProgreso(Math.round(((i + 1) / listos.length) * 100));
    }
    archivos.filter(a => a.estado === "sin_match").forEach(a => res.push({ ...a, exito: false, error: "Sin producto coincidente" }));
    setResultados(res);
    setFase("hecho");
  };

  const listos = archivos.filter(a => a.estado === "listo");
  const sinMatch = archivos.filter(a => a.estado === "sin_match");
  const exitosos = resultados.filter(r => r.exito);
  const fallidos = resultados.filter(r => !r.exito);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Images size={20} /> Subir im\u00E1genes por c\u00F3digo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {fase === "inicio" && (
            <div>
              <p className="text-sm text-gray-500 mb-5">
                Selecciona una carpeta con im\u00E1genes. El nombre de cada archivo debe ser el <strong>c\u00F3digo del producto</strong> (ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">PROD-001.jpg</code>). Se asociar\u00E1n autom\u00E1ticamente.
              </p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 cursor-pointer transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <FolderOpen size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-600 mb-1">Seleccionar carpeta de im\u00E1genes</p>
                <p className="text-sm text-gray-400">Haz clic o arrastra aqu\u00ED</p>
                <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">
                  <FolderOpen size={16} /> Elegir carpeta
                </div>
              </div>
              <input ref={inputRef} type="file" multiple accept="image/*" webkitdirectory="" directory="" className="hidden" onChange={handleSeleccion} />
            </div>
          )}

          {fase === "preview" && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white border rounded-xl p-3 text-center"><div className="text-2xl font-bold">{archivos.length}</div><div className="text-xs text-gray-500">Im\u00E1genes</div></div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-green-700">{listos.length}</div><div className="text-xs text-green-600">Con coincidencia</div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-amber-700">{sinMatch.length}</div><div className="text-xs text-amber-600">Sin coincidencia</div></div>
              </div>
              {sinMatch.length > 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 text-sm text-amber-700">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span><strong>{sinMatch.length} im\u00E1genes</strong> sin producto coincidente ser\u00E1n ignoradas.</span>
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto border rounded-xl p-3">
                {archivos.map((item, i) => (
                  <div key={i} className={`rounded-xl border-2 overflow-hidden ${item.estado === "listo" ? "border-green-300" : "border-amber-300"}`}>
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img src={item.previewUrl} alt="" className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="p-1.5">
                      <p className="text-xs font-bold truncate">{item.codigoBuscado}</p>
                      <p className={`text-xs truncate ${item.producto ? "text-green-700" : "text-amber-600"}`}>
                        {item.producto ? "\u2713 " + item.producto.nombre : "\u26A0 Sin coincidencia"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fase === "subiendo" && (
            <div className="text-center py-10">
              <Loader2 size={40} className="animate-spin mx-auto mb-3 text-blue-600" />
              <p className="font-bold text-gray-700 mb-4">Subiendo im\u00E1genes... {progreso}%</p>
              <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: progreso + "%" }} /></div>
            </div>
          )}

          {fase === "hecho" && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle size={24} className="mx-auto mb-1 text-green-600" />
                  <div className="text-2xl font-bold text-green-700">{exitosos.length}</div>
                  <div className="text-xs text-green-600">Subidas correctamente</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <XCircle size={24} className="mx-auto mb-1 text-red-500" />
                  <div className="text-2xl font-bold text-red-600">{fallidos.length}</div>
                  <div className="text-xs text-red-500">Con errores</div>
                </div>
              </div>
              {fallidos.length > 0 && (
                <div className="border rounded-xl divide-y max-h-40 overflow-y-auto">
                  {fallidos.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <XCircle size={14} className="text-red-400 flex-shrink-0" />
                      <span className="text-sm flex-1 truncate">{item.nombreArchivo || item.codigoBuscado}</span>
                      <span className="text-xs text-red-500">{item.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
            {fase === "hecho" ? "Cerrar" : "Cancelar"}
          </button>
          {fase === "preview" && (
            <button onClick={handleSubir} disabled={listos.length === 0} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Upload size={16} /> Subir {listos.length} im\u00E1genes
            </button>
          )}
          {fase === "hecho" && exitosos.length > 0 && (
            <button onClick={() => { onDone(); onClose(); }} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700">
              Actualizar lista
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BuscarImagenPanel({ nombre, onSelect, onClose }) {
  const [query, setQuery] = useState(nombre || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const buscar = async (q) => {
    if (!q.trim()) return;
    setLoading(true); setError(""); setResults([]);
    try {
      const url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(q) + "&json=1&page_size=20&fields=product_name,image_url,image_front_thumb_url&search_simple=1&action=process";
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      const imgs = (data.products || []).map(p => ({ name: p.product_name || q, url: p.image_url || p.image_front_thumb_url })).filter(p => p.url);
      setResults(imgs);
      if (imgs.length === 0) setError("No se encontraron im\u00E1genes. Prueba con otro t\u00E9rmino.");
    } catch(e) {
      setError("No se pudo conectar. Puedes pegar la URL de la imagen directamente abajo.");
    }
    setLoading(false);
  };

  useEffect(() => { if (nombre) buscar(nombre); }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">\u{1F50D} Buscar imagen en internet</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && buscar(query)} placeholder="Nombre del producto..." className="flex-1 border rounded-xl px-4 py-2 text-sm" />
          <button onClick={() => buscar(query)} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
          </button>
        </div>
        {error && (
          <div className="mb-3">
            <p className="text-sm text-amber-600 mb-2">{error}</p>
            <div className="flex gap-2">
              <input type="text" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="Pega aqu\u00ED la URL de la imagen..." className="flex-1 border rounded-xl px-4 py-2 text-sm" />
              <button onClick={() => { if (manualUrl.trim()) onSelect(manualUrl.trim()); }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700">Usar</button>
            </div>
          </div>
        )}
        {loading && <div className="flex items-center justify-center py-10"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}
        {!loading && results.length > 0 && (
          <div className="overflow-y-auto flex-1">
            <p className="text-xs text-gray-400 mb-3">Haz clic en una imagen para seleccionarla</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {results.map((img, i) => (
                <button key={i} onClick={() => onSelect(img.url)} className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all bg-gray-50 aspect-square flex items-center justify-center">
                  <img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" onError={e => { e.target.parentElement.style.display = "none"; }} />
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && results.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
            <Package size={40} className="mb-2 opacity-30" />
            <p className="text-sm">Escribe el nombre y pulsa Buscar</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GestionCategorias({ categorias, onClose, onUpdated }) {
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCrear = async () => {
    if (!nuevaNombre.trim()) return;
    setSaving(true); setError("");
    const { error } = await supabase.from('categorias').insert([{ nombre: nuevaNombre.trim() }]).select().single();
    setSaving(false);
    if (error) setError("Error: " + error.message);
    else { setNuevaNombre(""); onUpdated(); }
  };

  const handleEliminar = async (cat) => {
    if (!confirm(`\u00BFEliminar la categor\u00EDa "${cat.nombre}"? Los productos quedar\u00E1n sin categor\u00EDa.`)) return;
    await supabase.from("productos").update({ categoria_id: null }).eq("categoria_id", cat.id);
    await supabase.from("categorias").delete().eq("id", cat.id);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Tag size={18} /> Categor\u00EDas</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" value={nuevaNombre} onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCrear()} placeholder="Nueva categor\u00EDa..." className="flex-1 border rounded-xl px-4 py-2 text-sm" />
          <button onClick={handleCrear} disabled={saving || !nuevaNombre.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="overflow-y-auto flex-1 space-y-1">
          {categorias.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay categor\u00EDas a\u00FAn</p>}
          {categorias.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100">
              <span className="text-sm font-medium">{cat.nombre}</span>
              <button onClick={() => handleEliminar(cat)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 border rounded-xl text-sm font-medium hover:bg-gray-50">Cerrar</button>
      </div>
    </div>
  );
}

function MoverCategoriaModal({ productos, categorias, onClose, onMoved }) {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [seleccion, setSeleccion] = useState([]);
  const [moving, setMoving] = useState(false);

  const productosFiltrados = useMemo(() => {
    if (!origen) return productos;
    if (origen === "__sin__") return productos.filter(p => !p.categoria_id);
    return productos.filter(p => p.categoria_id === origen);
  }, [productos, origen]);

  const toggleSeleccion = (id) => setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleTodos = () => setSeleccion(seleccion.length === productosFiltrados.length ? [] : productosFiltrados.map(p => p.id));

  const handleMover = async () => {
    if (seleccion.length === 0 || !destino) return;
    setMoving(true);
    const val = destino === "__sin__" ? null : destino;
    await supabase.from("productos").update({ categoria_id: val }).in("id", seleccion);
    setMoving(false);
    onMoved();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><FolderOpen size={18} /> Mover productos</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por categor\u00EDa</label>
            <select value={origen} onChange={e => { setOrigen(e.target.value); setSeleccion([]); }} className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="__sin__">Sin categor\u00EDa</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mover a</label>
            <select value={destino} onChange={e => setDestino(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="">Selecciona destino...</option>
              <option value="__sin__">Sin categor\u00EDa</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{productosFiltrados.length} productos \u00B7 {seleccion.length} seleccionados</span>
          <button onClick={toggleTodos} className="text-xs text-blue-600 hover:underline">
            {seleccion.length === productosFiltrados.length ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-1 border rounded-xl p-2">
          {productosFiltrados.map(prod => (
            <label key={prod.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={seleccion.includes(prod.id)} onChange={() => toggleSeleccion(prod.id)} className="rounded" />
              {prod.imagen_url && <img src={prod.imagen_url} alt="" className="w-8 h-8 object-contain rounded" />}
              <span className="text-sm flex-1 truncate">{prod.nombre}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleMover} disabled={moving || seleccion.length === 0 || !destino} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {moving ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
            Mover {seleccion.length > 0 ? `(${seleccion.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductoModal({ producto, categorias, onClose, onSave, modo }) {
  const [form, setForm] = useState(producto ? {
    nombre: producto.nombre || '', codigo: producto.codigo || '', categoria_id: producto.categoria_id || '',
    formato: producto.formato || '', multiplo: producto.multiplo || 1, imagen_url: producto.imagen_url || '',
    descripcion: producto.descripcion || '', disponible: producto.disponible !== false, grupo_visualizacion: producto.grupo_visualizacion || 'ambas',
  } : { nombre: '', codigo: '', categoria_id: '', formato: '', multiplo: 1, imagen_url: '', descripcion: '', disponible: true, grupo_visualizacion: 'ambas' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [buscandoImagen, setBuscandoImagen] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `productos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('imagenes').upload(fileName, file, { upsert: true });
    if (!error) {
      const { data: url } = supabase.storage.from('imagenes').getPublicUrl(fileName);
      setForm(f => ({ ...f, imagen_url: url.publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { ...form, categoria_id: form.categoria_id || null };
    if (modo === 'crear') {
      const { data, error } = await supabase.from('productos').insert([payload]).select().single();
      setSaving(false);
      if (!error) onSave(data, 'crear'); else alert('Error: ' + error.message);
    } else {
      const { error } = await supabase.from('productos').update(payload).eq('id', producto.id);
      setSaving(false);
      if (!error) onSave({ ...producto, ...payload }, 'editar'); else alert('Error: ' + error.message);
    }
  };

  return (
    <>
      {buscandoImagen && (
        <BuscarImagenPanel nombre={form.nombre} onSelect={(url) => { setForm(f => ({...f, imagen_url: url})); setBuscandoImagen(false); }} onClose={() => setBuscandoImagen(false)} />
      )}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">{modo === 'crear' ? 'Nuevo producto' : 'Editar producto'}</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Nombre del producto" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">C\u00F3digo / Referencia</label>
              <input type="text" value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value}))} placeholder="ej: PROD-001" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Categor\u00EDa</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({...f, categoria_id: e.target.value}))} className="w-full border rounded-xl px-4 py-2.5 text-sm">
                <option value="">Sin categor\u00EDa</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descripci\u00F3n</label>
              <textarea value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} placeholder="Descripci\u00F3n del producto" rows={2} className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Formato</label>
                <input type="text" value={form.formato} onChange={e => setForm(f => ({...f, formato: e.target.value}))} placeholder="ej: X12, 70CL" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">M\u00FAltiplo</label>
                <input type="number" min="1" value={form.multiplo} onChange={e => setForm(f => ({...f, multiplo: Number(e.target.value)}))} className="w-full border rounded-xl px-4 py-2.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Visibilidad</label>
              <div className="grid grid-cols-3 gap-2">
                {GRUPOS.map(g => (
                  <button key={g.value} onClick={() => setForm(f => ({...f, grupo_visualizacion: g.value}))} className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${form.grupo_visualizacion === g.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-sm font-bold">{g.label}</span>
                    <span className="text-xs text-gray-500 mt-0.5">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen</label>
              <div className="flex gap-3 items-start">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.imagen_url ? <img src={form.imagen_url} alt="" className="w-full h-full object-contain p-1" /> : <Package size={32} className="text-gray-300" />}
                </div>
                <div className="flex-1 space-y-2">
                  <button onClick={() => setBuscandoImagen(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-semibold hover:bg-blue-100">
                    \u{1F50D} Buscar en internet
                  </button>
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? "Subiendo..." : "Subir imagen"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                  <input type="text" value={form.imagen_url} onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))} placeholder="O pega una URL..." className="w-full text-xs border rounded-lg px-3 py-1.5 text-gray-600" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <div className="text-sm font-semibold text-gray-700">Disponible</div>
                <div className="text-xs text-gray-400">Visible en el cat\u00E1logo</div>
              </div>
              <button onClick={() => setForm(f => ({...f, disponible: !f.disponible}))} className={`w-12 h-6 rounded-full transition-colors relative ${form.disponible ? "bg-blue-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.disponible ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70">
              {saving ? "Guardando..." : modo === 'crear' ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("__todas__");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("__todos__");
  const [gestionCat, setGestionCat] = useState(false);
  const [moverCat, setMoverCat] = useState(false);
  const [subirImagenes, setSubirImagenes] = useState(false);

  const cargar = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('productos').select('*').order('orden_excel'),
      supabase.from('categorias').select('*').order('nombre'),
    ]);
    setProductos(prods || []);
    setCategorias(cats || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const productosFiltrados = useMemo(() => {
    let list = productos;
    if (categoriaActiva === "__sin__") list = list.filter(p => !p.categoria_id);
    else if (categoriaActiva !== "__todas__") list = list.filter(p => p.categoria_id === categoriaActiva);
    if (filtroGrupo !== '__todos__') list = list.filter(p => (p.grupo_visualizacion || 'ambas') === filtroGrupo);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.referencia?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, categoriaActiva, busqueda, filtroGrupo]);

  const handleToggle = async (prod) => {
    const nuevo = !prod.disponible;
    await supabase.from('productos').update({ disponible: nuevo }).eq('id', prod.id);
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, disponible: nuevo } : p));
  };

  const handleSave = (updated, modo) => {
    if (modo === 'crear') { setProductos(prev => [...prev, updated]); setCreando(false); }
    else { setProductos(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditando(null); }
  };

  const handleDelete = async (prod) => {
    if (!confirm(`\u00BFEliminar "${prod.nombre}"?`)) return;
    await supabase.from('productos').delete().eq('id', prod.id);
    setProductos(prev => prev.filter(p => p.id !== prod.id));
  };

  const handleGrupoChange = async (prod, nuevoGrupo) => {
    await supabase.from('productos').update({ grupo_visualizacion: nuevoGrupo }).eq('id', prod.id);
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, grupo_visualizacion: nuevoGrupo } : p));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={40} className="animate-spin" style={{ color: "var(--color-primary)" }} /></div>
  );

  return (
    <div>
      {(editando || creando) && (
        <ProductoModal producto={editando} categorias={categorias} onClose={() => { setEditando(null); setCreando(false); }} onSave={handleSave} modo={creando ? 'crear' : 'editar'} />
      )}
      {gestionCat && <GestionCategorias categorias={categorias} onClose={() => setGestionCat(false)} onUpdated={() => { setGestionCat(false); cargar(); }} />}
      {moverCat && <MoverCategoriaModal productos={productos} categorias={categorias} onClose={() => setMoverCat(false)} onMoved={() => { setMoverCat(false); cargar(); }} />}
      {subirImagenes && <SubirImagenesModal productos={productos} onClose={() => setSubirImagenes(false)} onDone={cargar} />}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">Productos</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSubirImagenes(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
            <Images size={15} /> Im\u00E1genes
          </button>
          <button onClick={() => setMoverCat(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
            <FolderOpen size={15} /> Mover
          </button>
          <button onClick={() => setGestionCat(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
            <Tag size={15} /> Categor\u00EDas
          </button>
          <button onClick={() => setCreando(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow">
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[{ id: "__todas__", nombre: "Todos" }, { id: "__sin__", nombre: "Sin categor\u00EDa" }, ...categorias].map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${categoriaActiva === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{cat.nombre}</button>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" />
        </div>
        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
          <option value="__todos__">Todos los grupos</option>
          <option value="ambas">\u{1F4E6} Ambas</option>
          <option value="estacion">\u{1F3EA} Estaci\u00F3n</option>
          <option value="cafeteria">\u2615 Cafeter\u00EDa</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-gray-500">Mostrando {productosFiltrados.length} de {productos.length} productos</div>

      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos</p>
          <button onClick={() => setCreando(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">+ Crear primer producto</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => {
            const grupoInfo = GRUPOS.find(g => g.value === (prod.grupo_visualizacion || 'ambas')) || GRUPOS[0];
            const catNombre = categorias.find(c => c.id === prod.categoria_id)?.nombre || "";
            const disponible = prod.disponible !== false;
            return (
              <div key={prod.id} className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow ${!disponible ? "opacity-60" : ""}`}>
                <div className="relative bg-gray-50 flex items-center justify-center" style={{ height: "120px" }}>
                  {prod.imagen_url ? (
                    <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-contain p-2" />
                  ) : (
                    <Package size={36} className="text-gray-200" />
                  )}
                  <span className={`absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${grupoInfo.color}`}>
                    {grupoInfo.value === 'ambas' ? '\u{1F4E6}' : grupoInfo.value === 'estacion' ? '\u{1F3EA}' : '\u2615'}
                  </span>
                </div>
                <div className="p-2 flex flex-col flex-1 gap-1">
                  <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2">{prod.nombre}</h3>
                  {catNombre && <span className="text-xs text-blue-600 font-medium truncate">{catNombre}</span>}
                  {prod.codigo && <p className="text-xs text-gray-400">SKU: {prod.codigo}</p>}
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs mt-1">
                    {GRUPOS.map(g => (
                      <button key={g.value} onClick={() => handleGrupoChange(prod, g.value)}
                        className={`flex-1 py-0.5 transition-colors font-medium ${(prod.grupo_visualizacion || 'ambas') === g.value ? (g.value === 'ambas' ? 'bg-purple-600 text-white' : g.value === 'estacion' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white') : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                        title={g.desc}>
                        {g.value === 'ambas' ? '\u{1F4E6}' : g.value === 'estacion' ? '\u{1F3EA}' : '\u2615'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-auto pt-1 flex gap-1">
                    <button onClick={() => setEditando(prod)} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                      <Pencil size={11} /> Editar
                    </button>
                    <button onClick={() => handleDelete(prod)} className="p-1 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                    <button onClick={() => handleToggle(prod)} className={`p-1 rounded-lg ${disponible ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`} title={disponible ? "Desactivar" : "Activar"}>
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
