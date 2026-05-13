import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, Loader2, Pencil, ToggleLeft, ToggleRight, Plus, Trash2, X, Upload, ChevronRight, FolderOpen, Tag, Check, Layers } from "lucide-react";

function CardImagen({ prod, gi, onEliminar }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative bg-gray-50 flex items-center justify-center"
      style={{ height: "120px" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {prod.imagen_url
        ? <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-contain p-2" />
        : <Package size={36} className="text-gray-200" />}
      <span className={`absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${gi.color}`}>
        {gi.label.split(' ')[0]}
      </span>
      {prod.imagen_url && hover && (
        <button
          onClick={e => { e.stopPropagation(); onEliminar(); }}
          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md transition-colors"
          title="Eliminar imagen"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

const GRUPOS = [
  { value: 'ambos',      label: '📦 Ambos',      desc: 'Todos lo ven',         color: 'bg-purple-100 text-purple-700' },
  { value: 'estacion',   label: '🏪 Estación',   desc: 'Solo estaciones',      color: 'bg-[#d9f0e4] text-[#007a34]' },
  { value: 'cafeteria',  label: '☕ Cafetería',  desc: 'Solo cafeterías',      color: 'bg-orange-100 text-orange-700' },
  { value: 'especifico', label: '🎯 Específicas', desc: 'Tiendas concretas',   color: 'bg-amber-100 text-amber-700' },
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
    const mapa = {};
    productos.forEach(p => { if (p.codigo) mapa[p.codigo.toLowerCase().trim()] = p; });
    const emp = imagenes.map(file => {
      const cod = file.name.replace(/\.[^.]+$/, "").trim();
      const clave = cod.toLowerCase();
      let prod = mapa[clave];
      if (!prod) { const k = Object.keys(mapa).find(k => k.includes(clave) || clave.includes(k)); if (k) prod = mapa[k]; }
      return { file, cod, producto: prod || null, preview: URL.createObjectURL(file), ok: !!prod };
    });
    setArchivos(emp); setFase("preview");
  };

  const handleSubir = async () => {
    const listos = archivos.filter(a => a.ok);
    if (!listos.length) return;
    setFase("subiendo"); setProgreso(0);
    const res = [];
    for (let i = 0; i < listos.length; i++) {
      const item = listos[i];
      try {
        const ext = item.file.name.split(".").pop().toLowerCase();
        const safe = (item.producto.codigo || item.producto.id).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
        const path = `productos/${safe}.${ext}`;
        const { error: upErr } = await supabase.storage.from("imagenes").upload(path, item.file, { upsert: true, contentType: item.file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(path);
        await supabase.from("productos").update({ imagen_url: urlData.publicUrl }).eq("id", item.producto.id);
        res.push({ ...item, exito: true });
      } catch (err) { res.push({ ...item, exito: false, error: err.message }); }
      setProgreso(Math.round(((i + 1) / listos.length) * 100));
    }
    archivos.filter(a => !a.ok).forEach(a => res.push({ ...a, exito: false, error: "Sin producto coincidente" }));
    setResultados(res); setFase("hecho");
  };

  const listos = archivos.filter(a => a.ok);
  const sinMatch = archivos.filter(a => !a.ok);
  const exitosos = resultados.filter(r => r.exito);
  const fallidos = resultados.filter(r => !r.exito);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">Subir im&aacute;genes por c&oacute;digo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {fase === "inicio" && (
            <div>
              <p className="text-sm text-gray-500 mb-5">Selecciona una carpeta. El <strong>nombre de cada archivo</strong> debe ser el <strong>c&oacute;digo del producto</strong> (ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">856607.jpg</code>). Se asociar&aacute;n autom&aacute;ticamente.</p>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-[#00c254] cursor-pointer transition-colors" onClick={() => inputRef.current?.click()}>
                <FolderOpen size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-600 mb-1">Seleccionar carpeta de im&aacute;genes</p>
                <p className="text-sm text-gray-400 mb-4">Haz clic o arrastra aqu&iacute;</p>
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm"><FolderOpen size={16} /> Elegir carpeta</div>
              </div>
              <input ref={inputRef} type="file" multiple accept="image/*" webkitdirectory="" directory="" className="hidden" onChange={handleSeleccion} />
            </div>
          )}
          {fase === "preview" && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white border rounded-xl p-3 text-center"><div className="text-2xl font-bold">{archivos.length}</div><div className="text-xs text-gray-500">Im&aacute;genes</div></div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-green-700">{listos.length}</div><div className="text-xs text-green-600">Con coincidencia</div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-amber-700">{sinMatch.length}</div><div className="text-xs text-amber-600">Sin coincidencia</div></div>
              </div>
              {sinMatch.length > 0 && <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700"><strong>{sinMatch.length} im&aacute;genes</strong> sin producto coincidente ser&aacute;n ignoradas.</div>}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-xl p-3">
                {archivos.map((item, i) => (
                  <div key={i} className={`rounded-xl border-2 overflow-hidden ${item.ok ? "border-green-300" : "border-amber-300"}`}>
                    <div className="aspect-square bg-gray-50 overflow-hidden"><img src={item.preview} alt="" className="w-full h-full object-contain p-1" /></div>
                    <div className="p-1.5">
                      <p className="text-xs font-bold truncate">{item.cod}</p>
                      <p className={`text-xs truncate ${item.producto ? "text-green-700" : "text-amber-600"}`}>{item.producto ? "\u2713 " + item.producto.nombre : "\u26A0 Sin coincidencia"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {fase === "subiendo" && (
            <div className="text-center py-10">
              <Loader2 size={40} className="animate-spin mx-auto mb-3 text-[#00913f]" />
              <p className="font-bold text-gray-700 mb-4">Subiendo im&aacute;genes... {progreso}%</p>
              <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-[#00913f] h-3 rounded-full transition-all" style={{ width: progreso + "%" }} /></div>
            </div>
          )}
          {fase === "hecho" && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-700">{exitosos.length}</div><div className="text-xs text-green-600">Subidas correctamente</div></div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-600">{fallidos.length}</div><div className="text-xs text-red-500">Con errores</div></div>
              </div>
              {fallidos.length > 0 && <div className="border rounded-xl divide-y max-h-40 overflow-y-auto">{fallidos.map((item, i) => <div key={i} className="flex items-center gap-2 px-3 py-2"><span className="text-sm flex-1 truncate">{item.cod}</span><span className="text-xs text-red-500">{item.error}</span></div>)}</div>}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">{fase === "hecho" ? "Cerrar" : "Cancelar"}</button>
          {fase === "preview" && <button onClick={handleSubir} disabled={listos.length === 0} className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2"><Upload size={16} /> Subir {listos.length} im&aacute;genes</button>}
          {fase === "hecho" && exitosos.length > 0 && <button onClick={() => { onDone(); onClose(); }} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700">Actualizar lista</button>}
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
      const resp = await fetch("https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(q) + "&json=1&page_size=20&fields=product_name,image_url,image_front_thumb_url&search_simple=1&action=process", { mode: "cors" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      const imgs = (data.products || []).map(p => ({ name: p.product_name || q, url: p.image_url || p.image_front_thumb_url })).filter(p => p.url);
      setResults(imgs);
      if (!imgs.length) setError("No se encontraron im&aacute;genes.");
    } catch(err) { setError("No se pudo conectar. Pega la URL directamente abajo."); }
    setLoading(false);
  };

  useEffect(() => { if (nombre) buscar(nombre); }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">Buscar imagen en internet</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && buscar(query)} placeholder="Nombre del producto..." className="flex-1 border rounded-xl px-4 py-2 text-sm" />
          <button onClick={() => buscar(query)} disabled={loading} className="px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-60 flex items-center gap-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
          </button>
        </div>
        {error && <div className="mb-3"><p className="text-sm text-amber-600 mb-2">{error}</p><div className="flex gap-2"><input type="text" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="Pega aqu&iacute; la URL..." className="flex-1 border rounded-xl px-4 py-2 text-sm" /><button onClick={() => { if (manualUrl.trim()) onSelect(manualUrl.trim()); }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold">Usar</button></div></div>}
        {loading && <div className="flex items-center justify-center py-10"><Loader2 size={32} className="animate-spin text-[#00a847]" /></div>}
        {!loading && results.length > 0 && (
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {results.map((img, i) => (
                <button key={i} onClick={() => onSelect(img.url)} className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-[#00a847] bg-gray-50 aspect-square flex items-center justify-center">
                  <img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" onError={e => { e.target.parentElement.style.display = "none"; }} />
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && !results.length && !error && <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10"><Package size={40} className="mb-2 opacity-30" /><p className="text-sm">Escribe el nombre y pulsa Buscar</p></div>}
      </div>
    </div>
  );
}

function GestionCategorias({ categorias, onClose, onUpdated }) {
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [editandoId, setEditandoId]   = useState(null);  // id de la categoría en edición
  const [editNombre, setEditNombre]   = useState("");     // nombre temporal mientras edita
  const [saving, setSaving]           = useState(false);

  const handleCrear = async () => {
    if (!nuevaNombre.trim()) return;
    setSaving(true);
    await supabase.from("categorias").insert([{ nombre: nuevaNombre.trim(), activa: true }]);
    setSaving(false); setNuevaNombre(""); onUpdated();
  };

  const handleEliminar = async (cat) => {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los productos quedarán sin categoría.`)) return;
    await supabase.from("productos").update({ categoria_id: null }).eq("categoria_id", cat.id);
    await supabase.from("categorias").delete().eq("id", cat.id);
    onUpdated();
  };

  const iniciarEdicion = (cat) => {
    setEditandoId(cat.id);
    setEditNombre(cat.nombre);
  };

  const cancelarEdicion = () => { setEditandoId(null); setEditNombre(""); };

  const guardarEdicion = async (id) => {
    if (!editNombre.trim()) return;
    await supabase.from("categorias").update({ nombre: editNombre.trim() }).eq("id", id);
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("selogas_cat_"))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    setEditandoId(null);
    setEditNombre("");
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 max-h-[80vh] flex flex-col">

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Tag size={18} /> Categorías</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Nueva categoría */}
        <div className="flex gap-2 mb-4">
          <input
            type="text" value={nuevaNombre}
            onChange={e => setNuevaNombre(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCrear()}
            placeholder="Nueva categoría..."
            className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#00c254]"
          />
          <button onClick={handleCrear} disabled={saving || !nuevaNombre.trim()}
            className="px-3 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          </button>
        </div>

        {/* Lista de categorías */}
        <div className="overflow-y-auto flex-1 space-y-1">
          {!categorias.length && (
            <p className="text-sm text-gray-400 text-center py-4">No hay categorías aún</p>
          )}
          {categorias.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 border border-gray-100 group">
              {editandoId === cat.id ? (
                // Modo edición inline
                <>
                  <input
                    autoFocus
                    type="text" value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") guardarEdicion(cat.id);
                      if (e.key === "Escape") cancelarEdicion();
                    }}
                    className="flex-1 border border-[#00c254] rounded-lg px-2.5 py-1 text-sm focus:outline-none bg-[#edf7f2]"
                  />
                  <button onClick={() => guardarEdicion(cat.id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0" title="Guardar">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelarEdicion}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0" title="Cancelar">
                    <X size={14} />
                  </button>
                </>
              ) : (
                // Modo lectura
                <>
                  <span className="flex-1 text-sm font-medium truncate">{cat.nombre}</span>
                  <button onClick={() => iniciarEdicion(cat)}
                    className="p-1.5 text-gray-400 hover:text-[#00913f] hover:bg-[#edf7f2] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Editar nombre">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleEliminar(cat)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-4 w-full py-2 border rounded-xl text-sm font-medium hover:bg-gray-50">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function CambiarGrupoModal({ productos, onClose, onChanged }) {
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [busqueda, setBusqueda]               = useState("");
  const [seleccion, setSeleccion]             = useState(new Set());
  const [grupoDestino, setGrupoDestino]       = useState("");
  const [saving, setSaving]                   = useState(false);

  const GRUPOS = [
    { value: "estacion",   label: "🏪 Estación" },
    { value: "cafeteria",  label: "☕ Cafetería" },
    { value: "ambos",      label: "📦 Ambos" },
    { value: "especifico", label: "🎯 Tiendas específicas" },
  ];

  const [tiendas, setTiendas]               = useState([]);
  const [tiendasSeleccionadas, setTiendaSel] = useState(new Set());

  useEffect(() => {
    supabase.from("tiendas").select("id, nombre").eq("activa", true)
      .neq("nombre", "PRINCIPAL").order("nombre")
      .then(({ data }) => setTiendas(data || []));
  }, []);

  const categorias = [...new Map(
    productos.filter(p => p.categoria_id && p.categorias?.nombre)
      .map(p => [p.categoria_id, { id: p.categoria_id, nombre: p.categorias.nombre }])
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const productosFiltrados = useMemo(() => {
    let lista = productos;
    if (filtroCategoria) lista = lista.filter(p => p.categoria_id === filtroCategoria);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [productos, filtroCategoria, busqueda]);

  const toggleSeleccion = (id) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleVisibles = () => {
    const ids = productosFiltrados.map(p => p.id);
    const todosSeleccionados = ids.every(id => seleccion.has(id));
    setSeleccion(prev => {
      const next = new Set(prev);
      if (todosSeleccionados) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!seleccion.size || !grupoDestino) return;
    if (grupoDestino === "especifico" && tiendasSeleccionadas.size === 0) {
      alert("Selecciona al menos una tienda específica."); return;
    }
    setSaving(true);
    const ids = [...seleccion];
    await supabase.from("productos").update({ grupo_visualizacion: grupoDestino }).in("id", ids);

    if (grupoDestino === "especifico") {
      // Borrar asignaciones anteriores y crear las nuevas
      await supabase.from("producto_tiendas").delete().in("producto_id", ids);
      const filas = ids.flatMap(pid =>
        [...tiendasSeleccionadas].map(tid => ({ producto_id: pid, tienda_id: tid }))
      );
      if (filas.length) await supabase.from("producto_tiendas").insert(filas);
    } else {
      // Si pasan a otro grupo, limpiar asignaciones específicas
      await supabase.from("producto_tiendas").delete().in("producto_id", ids);
    }

    try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}
    setSaving(false);
    onChanged();
  };

  const todosVisiblesSeleccionados = productosFiltrados.length > 0 &&
    productosFiltrados.every(p => seleccion.has(p.id));

  const GRUPO_BADGE = { estacion: "bg-blue-100 text-blue-700", cafeteria: "bg-orange-100 text-orange-700", ambos: "bg-purple-100 text-purple-700", especifico: "bg-amber-100 text-amber-700" };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col gap-3">

        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2"><Layers size={18} /> Cambiar grupo masivo</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Destino */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Asignar grupo a los seleccionados</label>
          <div className="flex gap-2">
            {GRUPOS.map(g => (
              <button key={g.value} onClick={() => setGrupoDestino(g.value)}
                className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                  grupoDestino === g.value
                    ? "border-[#00913f] bg-[#edf7f2] text-[#00913f]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2">
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar..." className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#00913f]" />
          </div>
        </div>

        {/* Contador */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {productosFiltrados.length} visibles ·{" "}
            <span className="font-semibold text-[#00913f]">{seleccion.size} seleccionados</span>
            {seleccion.size > 0 && (
              <button onClick={() => setSeleccion(new Set())} className="ml-2 text-red-400 hover:text-red-600 underline">
                limpiar
              </button>
            )}
          </span>
          <button onClick={toggleVisibles} className="text-xs text-[#00913f] hover:underline">
            {todosVisiblesSeleccionados ? "Deseleccionar visibles" : "Seleccionar visibles"}
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 border rounded-xl divide-y min-h-[200px]">
          {productosFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">No hay productos</div>
          ) : productosFiltrados.map(prod => (
            <label key={prod.id}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                seleccion.has(prod.id) ? "bg-[#edf7f2]" : "hover:bg-gray-50"
              }`}>
              <input type="checkbox" checked={seleccion.has(prod.id)}
                onChange={() => toggleSeleccion(prod.id)} className="rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium">{prod.nombre}</p>
                {prod.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
              </div>
              {prod.grupo_visualizacion && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${GRUPO_BADGE[prod.grupo_visualizacion] || "bg-gray-100 text-gray-500"}`}>
                  {prod.grupo_visualizacion}
                </span>
              )}
              {seleccion.has(prod.id) && <span className="text-[#00913f] flex-shrink-0">✓</span>}
            </label>
          ))}
        </div>

        {/* Selector de tiendas — solo si grupo = especifico */}
        {grupoDestino === "especifico" && (
          <div className="border rounded-xl p-3 bg-amber-50 border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              🎯 Selecciona las tiendas que verán estos productos:
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {tiendas.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-amber-100 rounded-lg p-1.5">
                  <input type="checkbox"
                    checked={tiendasSeleccionadas.has(t.id)}
                    onChange={() => {
                      setTiendaSel(prev => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                        return next;
                      });
                    }}
                    className="rounded flex-shrink-0"
                  />
                  <span className="truncate font-medium">{t.nombre}</span>
                </label>
              ))}
            </div>
            {tiendasSeleccionadas.size > 0 && (
              <p className="text-xs text-amber-700 mt-1.5 font-semibold">
                {tiendasSeleccionadas.size} tienda{tiendasSeleccionadas.size > 1 ? "s" : ""} seleccionada{tiendasSeleccionadas.size > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving || !seleccion.size || !grupoDestino || (grupoDestino === "especifico" && tiendasSeleccionadas.size === 0)}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Asignar grupo {seleccion.size > 0 ? `(${seleccion.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoverCategoriaModal({ productos, categorias, onClose, onMoved }) {
  const [origen, setOrigen]     = useState("");
  const [destino, setDestino]   = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState(new Set()); // Set para O(1) lookup
  const [moving, setMoving]     = useState(false);

  // Productos visibles según filtro de categoría Y búsqueda
  // La selección es INDEPENDIENTE — no se borra al cambiar filtros
  const productosFiltrados = useMemo(() => {
    let lista = productos;
    if (origen === "__sin__") lista = lista.filter(p => !p.categoria_id);
    else if (origen) lista = lista.filter(p => p.categoria_id === origen);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [productos, origen, busqueda]);

  const toggleSeleccion = (id) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Seleccionar/deseleccionar solo los visibles actualmente
  const toggleVisibles = () => {
    const idsVisibles = productosFiltrados.map(p => p.id);
    const todosVisiblesSeleccionados = idsVisibles.every(id => seleccion.has(id));
    setSeleccion(prev => {
      const next = new Set(prev);
      if (todosVisiblesSeleccionados) idsVisibles.forEach(id => next.delete(id));
      else idsVisibles.forEach(id => next.add(id));
      return next;
    });
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const handleMover = async () => {
    if (!seleccion.size || !destino) return;
    setMoving(true);
    await supabase.from("productos")
      .update({ categoria_id: destino === "__sin__" ? null : destino })
      .in("id", [...seleccion]);
    // Invalidar caché del catálogo para todas las tiendas
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("selogas_cat_"))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    setMoving(false);
    onMoved();
  };

  const todosVisiblesSeleccionados = productosFiltrados.length > 0 &&
    productosFiltrados.every(p => seleccion.has(p.id));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col gap-3">

        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FolderOpen size={18} /> Mover productos
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Filtro categoría + destino */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por categoría</label>
            <select value={origen} onChange={e => setOrigen(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="__sin__">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mover a</label>
            <select value={destino} onChange={e => setDestino(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm">
              <option value="">Selecciona destino...</option>
              <option value="__sin__">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full border rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Controles selección */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {productosFiltrados.length} visibles ·{" "}
            <span className="font-semibold text-[#00913f]">{seleccion.size} seleccionados</span>
            {seleccion.size > 0 && (
              <button onClick={limpiarSeleccion} className="ml-2 text-red-400 hover:text-red-600 underline">
                limpiar
              </button>
            )}
          </span>
          <button onClick={toggleVisibles} className="text-xs text-[#00913f] hover:underline">
            {todosVisiblesSeleccionados ? "Deseleccionar visibles" : "Seleccionar visibles"}
          </button>
        </div>

        {/* Lista de productos */}
        <div className="overflow-y-auto flex-1 border rounded-xl divide-y min-h-[200px]">
          {productosFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
              No hay productos con ese criterio
            </div>
          ) : (
            productosFiltrados.map(prod => (
              <label key={prod.id}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  seleccion.has(prod.id) ? "bg-[#edf7f2]" : "hover:bg-gray-50"
                }`}>
                <input type="checkbox" checked={seleccion.has(prod.id)}
                  onChange={() => toggleSeleccion(prod.id)} className="rounded flex-shrink-0" />
                {prod.imagen_url && (
                  <img src={prod.imagen_url} alt="" className="w-8 h-8 object-contain rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{prod.nombre}</p>
                  {prod.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
                </div>
                {seleccion.has(prod.id) && (
                  <span className="text-[#00a847] flex-shrink-0">✓</span>
                )}
              </label>
            ))
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleMover}
            disabled={moving || !seleccion.size || !destino}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2">
            {moving ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
            Mover {seleccion.size > 0 ? `(${seleccion.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductoModal({ producto, categorias, onClose, onSave, modo }) {
  const [form, setForm] = useState(producto ? {
    nombre: producto.nombre||'', codigo: producto.codigo||'', categoria_id: producto.categoria_id||'',
    formato: producto.formato||'', multiplo: producto.multiplo||1, imagen_url: producto.imagen_url||'',
    descripcion: producto.descripcion||'', disponible: producto.disponible!==false, grupo_visualizacion: producto.grupo_visualizacion||'ambos',
  } : { nombre:'', codigo:'', categoria_id:'', formato:'', multiplo:1, imagen_url:'', descripcion:'', disponible:true, grupo_visualizacion:'ambos' });
  const [saving, setSaving]               = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [buscandoImagen, setBuscandoImagen] = useState(false);
  const [tiendas, setTiendas]             = useState([]);
  const [tiendasSelec, setTiendasSelec]   = useState(new Set());

  // Cargar tiendas y asignaciones actuales al montar
  useEffect(() => {
    supabase.from("tiendas").select("id, nombre").eq("activa", true)
      .neq("nombre", "PRINCIPAL").order("nombre")
      .then(({ data }) => setTiendas(data || []));

    if (producto?.id && producto?.grupo_visualizacion === "especifico") {
      supabase.from("producto_tiendas").select("tienda_id").eq("producto_id", producto.id)
        .then(({ data }) => {
          if (data?.length) setTiendasSelec(new Set(data.map(r => r.tienda_id)));
        });
    }
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `productos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true });
    if (!error) {
      const { data: url } = supabase.storage.from('imagenes').getPublicUrl(path);
      setForm(f => ({ ...f, imagen_url: url.publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    if (form.grupo_visualizacion === 'especifico' && tiendasSelec.size === 0) {
      alert('Selecciona al menos una tienda específica.'); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      activo: true,
      categoria_id: form.categoria_id || null,
      grupo_visualizacion: form.grupo_visualizacion === 'ambos' ? 'ambas' : form.grupo_visualizacion,
    };
    let prodId = producto?.id;
    if (modo === 'crear') {
      const { data, error } = await supabase.from('productos').insert([payload]).select().single();
      if (error) { setSaving(false); alert('Error al crear: ' + error.message + ' (código: ' + error.code + ')'); console.error(error); return; }
      prodId = data.id;
      await guardarTiendasEspecificas(prodId);
      setSaving(false);
      onSave(data, 'crear');
    } else {
      const { error } = await supabase.from('productos').update(payload).eq('id', prodId);
      if (error) { setSaving(false); alert('Error al guardar: ' + error.message + ' (código: ' + error.code + ')'); console.error(error); return; }
      await guardarTiendasEspecificas(prodId);
      setSaving(false);
      onSave({ ...producto, ...payload }, 'editar');
    }
    try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}
  };

  const guardarTiendasEspecificas = async (prodId) => {
    // Siempre limpiar asignaciones anteriores
    await supabase.from("producto_tiendas").delete().eq("producto_id", prodId);
    if (form.grupo_visualizacion === "especifico" && tiendasSelec.size > 0) {
      const filas = [...tiendasSelec].map(tid => ({ producto_id: prodId, tienda_id: tid }));
      await supabase.from("producto_tiendas").insert(filas);
    }
  };

  const toggleTienda = (id) => setTiendasSelec(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      {buscandoImagen && <BuscarImagenPanel nombre={form.nombre} onSelect={(url) => { setForm(f => ({...f, imagen_url: url})); setBuscandoImagen(false); }} onClose={() => setBuscandoImagen(false)} />}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{modo === 'crear' ? 'Nuevo producto' : 'Editar producto'}</h2><button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button></div>
          <div className="space-y-4">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label><input type="text" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Nombre del producto" className="w-full border rounded-xl px-4 py-2.5 text-sm" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">C&oacute;digo / Referencia</label><input type="text" value={form.codigo} onChange={e => setForm(f => ({...f, codigo: e.target.value}))} placeholder="ej: PROD-001" className="w-full border rounded-xl px-4 py-2.5 text-sm" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Categor&iacute;a</label><select value={form.categoria_id} onChange={e => setForm(f => ({...f, categoria_id: e.target.value}))} className="w-full border rounded-xl px-4 py-2.5 text-sm"><option value="">Sin categor&iacute;a</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Descripci&oacute;n</label><textarea value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} placeholder="Descripci\u00F3n del producto" rows={2} className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">Formato</label><input type="text" value={form.formato} onChange={e => setForm(f => ({...f, formato: e.target.value}))} placeholder="ej: X12" className="w-full border rounded-xl px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">M&uacute;ltiplo</label><input type="number" min="1" value={form.multiplo} onChange={e => setForm(f => ({...f, multiplo: Number(e.target.value)}))} className="w-full border rounded-xl px-4 py-2.5 text-sm" /></div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Visibilidad</label>
              <div className="grid grid-cols-2 gap-2">
                {GRUPOS.map(g => <button key={g.value} onClick={() => setForm(f => ({...f, grupo_visualizacion: g.value}))} className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${form.grupo_visualizacion === g.value ? 'border-[#00913f] bg-[#edf7f2]' : 'border-gray-200 hover:border-gray-300'}`}><span className="text-sm font-bold">{g.label}</span><span className="text-xs text-gray-500 mt-0.5">{g.desc}</span></button>)}
              </div>
            </div>

            {/* Panel tiendas específicas */}
            {form.grupo_visualizacion === 'especifico' && (
              <div className="border-2 border-amber-200 bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-800 mb-2">
                  🎯 Tiendas que pueden ver este producto
                  {tiendasSelec.size > 0 && <span className="ml-2 bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">{tiendasSelec.size} seleccionadas</span>}
                </p>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                  {tiendas.map(t => (
                    <label key={t.id} className={`flex items-center gap-2 text-xs cursor-pointer rounded-lg p-1.5 transition-colors ${tiendasSelec.has(t.id) ? "bg-amber-100 font-semibold text-amber-900" : "hover:bg-amber-100 text-gray-700"}`}>
                      <input type="checkbox" checked={tiendasSelec.has(t.id)} onChange={() => toggleTienda(t.id)} className="rounded flex-shrink-0" />
                      <span className="truncate">{t.nombre}</span>
                    </label>
                  ))}
                </div>
                {tiendasSelec.size === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">⚠️ Ninguna seleccionada — el producto no será visible para nadie</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen</label>
              <div className="flex gap-3 items-start">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">{form.imagen_url ? <img src={form.imagen_url} alt="" className="w-full h-full object-contain p-1" /> : <Package size={32} className="text-gray-300" />}</div>
                <div className="flex-1 space-y-2">
                  <button onClick={() => setBuscandoImagen(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#edf7f2] border border-[#b3dfc4] rounded-xl text-sm text-[#007a34] font-semibold hover:bg-[#d9f0e4]">Buscar en internet</button>
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-[#00c254]">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{uploading ? "Subiendo..." : "Subir imagen"}<input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} /></label>
                  <input type="text" value={form.imagen_url} onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))} placeholder="O pega una URL..." className="w-full text-xs border rounded-lg px-3 py-1.5 text-gray-600" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div><div className="text-sm font-semibold text-gray-700">Disponible</div><div className="text-xs text-gray-400">Visible en el cat&aacute;logo</div></div>
              <button onClick={() => setForm(f => ({...f, disponible: !f.disponible}))} className={`w-12 h-6 rounded-full transition-colors relative ${form.disponible ? "bg-[#00913f]" : "bg-gray-300"}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.disponible ? "translate-x-6" : "translate-x-0.5"}`} /></button>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#00913f] hover:bg-[#007a34] disabled:opacity-70">{saving ? "Guardando..." : modo === 'crear' ? "Crear producto" : "Guardar cambios"}</button>
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
  const [moverCat, setMoverCat]       = useState(false);
  const [cambiarGrupo, setCambiarGrupo] = useState(false);
  const [subirImagenes, setSubirImagenes] = useState(false);

  const cargar = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([supabase.from('productos').select('*').order('orden_excel'), supabase.from('categorias').select('*').order('nombre')]);
    setProductos(prods || []); setCategorias(cats || []); setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const productosFiltrados = useMemo(() => {
    let list = productos;
    if (categoriaActiva === "__sin__") list = list.filter(p => !p.categoria_id);
    else if (categoriaActiva !== "__todas__") list = list.filter(p => p.categoria_id === categoriaActiva);
    if (filtroGrupo !== '__todos__') list = list.filter(p => (p.grupo_visualizacion || 'ambos') === filtroGrupo);
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)); }
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

  const handleEliminarImagen = async (prod) => {
    if (!window.confirm(`¿Eliminar la imagen de "${prod.nombre}"?`)) return;
    await supabase.from('productos').update({ imagen_url: null }).eq('id', prod.id);
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, imagen_url: null } : p));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={40} className="animate-spin" style={{ color: "var(--color-primary)" }} /></div>;

  return (
    <div>
      {(editando || creando) && <ProductoModal producto={editando} categorias={categorias} onClose={() => { setEditando(null); setCreando(false); }} onSave={handleSave} modo={creando ? 'crear' : 'editar'} />}
      {gestionCat && <GestionCategorias categorias={categorias} onClose={() => setGestionCat(false)} onUpdated={() => { setGestionCat(false); cargar(); }} />}
      {cambiarGrupo && <CambiarGrupoModal productos={productos} onClose={() => setCambiarGrupo(false)} onChanged={() => { setCambiarGrupo(false); cargar(); }} />}
      {moverCat && <MoverCategoriaModal productos={productos} categorias={categorias} onClose={() => setMoverCat(false)} onMoved={() => { setMoverCat(false); cargar(); }} />}
      {subirImagenes && <SubirImagenesModal productos={productos} onClose={() => setSubirImagenes(false)} onDone={cargar} />}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">Productos</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSubirImagenes(true)} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 shadow">
            <Upload size={15} /> Subir Im&aacute;genes
          </button>
          <button onClick={() => setMoverCat(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"><FolderOpen size={15} /> Mover</button>
          <button onClick={() => setCambiarGrupo(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"><Layers size={15} /> Grupo</button>
          <button onClick={() => setGestionCat(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"><Tag size={15} /> Categor&iacute;as</button>
          <button onClick={() => setCreando(true)} className="flex items-center gap-2 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] shadow"><Plus size={16} /> Nuevo producto</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[{ id: "__todas__", nombre: "Todos" }, { id: "__sin__", nombre: "Sin categor\u00EDa" }, ...categorias].map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${categoriaActiva === cat.id ? "bg-[#00913f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{cat.nombre}</button>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm" /></div>
        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
          <option value="__todos__">Todos los grupos</option>
          <option value="ambas">{String.fromCodePoint(0x1F4E6)} Ambas</option>
          <option value="estacion">{String.fromCodePoint(0x1F3EA)} Estaci&oacute;n</option>
          <option value="cafeteria">&#9749; Cafeter&iacute;a</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-gray-500">Mostrando {productosFiltrados.length} de {productos.length} productos</div>

      {!productosFiltrados.length ? (
        <div className="text-center py-16 text-gray-400"><Package size={48} className="mx-auto mb-3 opacity-30" /><p>No hay productos</p><button onClick={() => setCreando(true)} className="mt-4 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34]">+ Crear primer producto</button></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => {
            const gi = GRUPOS.find(g => g.value === (prod.grupo_visualizacion || 'ambas')) || GRUPOS[0];
            const catNombre = categorias.find(c => c.id === prod.categoria_id)?.nombre || "";
            const disponible = prod.disponible !== false;
            return (
              <div key={prod.id} className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow ${!disponible ? "opacity-60" : ""}`}>
                <CardImagen
                  prod={prod}
                  gi={gi}
                  onEliminar={() => handleEliminarImagen(prod)}
                />
                <div className="p-2 flex flex-col flex-1 gap-1">
                  <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2">{prod.nombre}</h3>
                  {catNombre && <span className="text-xs text-[#00913f] font-medium truncate">{catNombre}</span>}
                  {prod.codigo && <p className="text-xs text-gray-400">SKU: {prod.codigo}</p>}
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs mt-1">
                    {GRUPOS.map(g => <button key={g.value} onClick={() => handleGrupoChange(prod, g.value)} className={`flex-1 py-0.5 transition-colors font-medium ${(prod.grupo_visualizacion||'ambas') === g.value ? (g.value==='ambas' ? 'bg-purple-600 text-white' : g.value==='estacion' ? 'bg-[#00913f] text-white' : 'bg-orange-500 text-white') : 'bg-white text-gray-400 hover:bg-gray-50'}`} title={g.desc}>{g.label.split(' ')[0]}</button>)}
                  </div>
                  <div className="mt-auto pt-1 flex gap-1">
                    <button onClick={() => setEditando(prod)} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"><Pencil size={11} /> Editar</button>
                    <button onClick={() => handleDelete(prod)} className="p-1 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                    <button onClick={() => handleToggle(prod)} className={`p-1 rounded-lg ${disponible ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`} title={disponible ? "Desactivar" : "Activar"}>{disponible ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button>
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
