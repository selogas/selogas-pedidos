import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FolderOpen, CheckCircle, XCircle, Loader2, Image, Package, AlertTriangle, Search, Globe, X } from "lucide-react";

// Busca imagenes via Edge Function proxy (evita CORS y errores de Open Food Facts)
async function buscarImagenesOnline(query) {
  const { data, error } = await supabase.functions.invoke("buscar-imagen", {
    body: { query },
  });
  if (error) throw error;
  return data.images || [];
}

function BuscarImagenPanel({ nombre, codigo, onSelect, onClose }) {
  const [query, setQuery] = useState(nombre || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const buscar = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const imgs = await buscarImagenesOnline(q);
      setResults(imgs);
      if (!imgs.length) setError("No se encontraron imagenes. Prueba con otro nombre o pega una URL.");
    } catch (err) {
      setError("Error al buscar: " + (err.message || String(err)));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (nombre) buscar(nombre);
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2"><Globe size={18} className="text-blue-600" /> Buscar imagen en internet</h3>
            {codigo && <p className="text-xs text-gray-400 mt-0.5">Codigo: {codigo}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscar(query)}
            placeholder="Nombre del producto..."
            className="flex-1 border rounded-xl px-4 py-2 text-sm"
            autoFocus
          />
          <button
            onClick={() => buscar(query)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">O pega una URL de imagen directamente:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 border rounded-xl px-4 py-2 text-sm"
            />
            <button
              onClick={() => { if (manualUrl.trim()) onSelect(manualUrl.trim()); }}
              disabled={!manualUrl.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50"
            >
              Usar URL
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-amber-600 mb-3 p-3 bg-amber-50 rounded-xl">{error}</p>}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        )}
        {!loading && results.length > 0 && (
          <div className="overflow-y-auto" style={{maxHeight:"420px",minHeight:"200px"}}>
            <p className="text-xs text-gray-400 mb-2">{results.length} resultados - haz clic para seleccionar</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {results.map((img, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(img.url)}
                  className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 bg-gray-50 aspect-square flex items-center justify-center transition-all"
                  title={img.name}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-contain p-1"
                    onError={e => { e.target.parentElement.style.display = "none"; }}
                  />
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors rounded-xl" />
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && !results.length && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
            <Package size={40} className="mb-2 opacity-30" />
            <p className="text-sm">Escribe el nombre y pulsa Buscar</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubirImagenes() {
  const [tab, setTab] = useState("archivo");

  // ===== TAB ARCHIVO =====
  const [archivos, setArchivos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [cargandoProds, setCargandoProds] = useState(false);
  const [fase, setFase] = useState("inicio");
  const inputRef = useRef();

  // ===== TAB INTERNET =====
  const [productos, setProductos] = useState([]);
  const [loadingProds, setLoadingProds] = useState(false);
  const [busquedaInternet, setBusquedaInternet] = useState("");
  const [filtroBuscar, setFiltroBuscar] = useState("sin_imagen");
  const [buscandoPanel, setBuscandoPanel] = useState(null);
  const [guardando, setGuardando] = useState(null);
  const [guardados, setGuardados] = useState({});

  const cargarProductos = async () => {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, codigo, imagen_url")
      .order("nombre");
    return data || [];
  };

  const handleSeleccionCarpeta = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setCargandoProds(true);
    const prods = await cargarProductos();
    setCargandoProds(false);

    const mapaProductos = {};
    prods.forEach(p => {
      if (p.codigo) mapaProductos[p.codigo.toLowerCase().trim()] = p;
    });

    const imagenesValidas = files.filter(f =>
      f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f.name)
    );

    const emparejamientos = imagenesValidas.map(file => {
      const nombreSinExt = file.name.replace(/\.[^.]+$/, "").trim();
      const codigoBuscado = nombreSinExt.toLowerCase();
      let productoEncontrado = mapaProductos[codigoBuscado];
      if (!productoEncontrado) {
        const claves = Object.keys(mapaProductos);
        const coincidencia = claves.find(k => k.includes(codigoBuscado) || codigoBuscado.includes(k));
        if (coincidencia) productoEncontrado = mapaProductos[coincidencia];
      }
      return {
        file,
        nombreArchivo: file.name,
        codigoBuscado: nombreSinExt,
        producto: productoEncontrado || null,
        previewUrl: URL.createObjectURL(file),
        estado: productoEncontrado ? "listo" : "sin_match",
      };
    });
    setArchivos(emparejamientos);
    setFase("preview");
  };

  const handleSubir = async () => {
    const listos = archivos.filter(a => a.estado === "listo" && a.producto);
    if (listos.length === 0) return;
    setSubiendo(true);
    setFase("subiendo");
    setProgreso(0);
    const res = [];
    for (let i = 0; i < listos.length; i++) {
      const item = listos[i];
      try {
        const ext = item.file.name.split(".").pop().toLowerCase();
        const safeCode = (item.producto.codigo || item.producto.id).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `productos/${safeCode}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("imagenes")
          .upload(fileName, item.file, { upsert: true, contentType: item.file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;
        const { error: updateError } = await supabase
          .from("productos")
          .update({ imagen_url: publicUrl })
          .eq("id", item.producto.id);
        if (updateError) throw updateError;
        res.push({ ...item, exito: true, url: publicUrl });
      } catch (err) {
        res.push({ ...item, exito: false, error: err.message });
      }
      setProgreso(Math.round(((i + 1) / listos.length) * 100));
    }
    archivos.filter(a => a.estado === "sin_match").forEach(a => {
      res.push({ ...a, exito: false, error: "Sin producto coincidente" });
    });
    setResultados(res);
    setSubiendo(false);
    setFase("hecho");
  };

  const resetear = () => {
    setArchivos([]);
    setResultados([]);
    setProgreso(0);
    setFase("inicio");
    if (inputRef.current) inputRef.current.value = "";
  };

  const cargarProductosInternet = async () => {
    setLoadingProds(true);
    const data = await cargarProductos();
    setProductos(data);
    setLoadingProds(false);
  };

  useEffect(() => {
    if (tab === "internet" && productos.length === 0) {
      cargarProductosInternet();
    }
  }, [tab]);

  const handleSeleccionarImagen = async (producto, url) => {
    setBuscandoPanel(null);
    setGuardando(producto.id);
    try {
      const { error } = await supabase
        .from("productos")
        .update({ imagen_url: url })
        .eq("id", producto.id);
      if (error) throw error;
      setGuardados(prev => ({ ...prev, [producto.id]: url }));
      setProductos(prev =>
        prev.map(p => p.id === producto.id ? { ...p, imagen_url: url } : p)
      );
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
    setGuardando(null);
  };

  const productosFiltrados = productos.filter(p => {
    const imagenActual = guardados[p.id] || p.imagen_url;
    const sinImg = filtroBuscar === "sin_imagen" ? !imagenActual : true;
    const q = busquedaInternet.toLowerCase();
    const matchBusq = !q || p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
    return sinImg && matchBusq;
  });

  const listos = archivos.filter(a => a.estado === "listo");
  const sinMatch = archivos.filter(a => a.estado === "sin_match");
  const exitosos = resultados.filter(r => r.exito);
  const fallidos = resultados.filter(r => !r.exito);

  return (
    <div className="max-w-5xl mx-auto">
      {buscandoPanel && (
        <BuscarImagenPanel
          nombre={buscandoPanel.nombre}
          codigo={buscandoPanel.codigo}
          onSelect={(url) => handleSeleccionarImagen(buscandoPanel, url)}
          onClose={() => setBuscandoPanel(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Imagenes de Productos</h1>
        <p className="text-gray-500 text-sm">Sube imagenes desde tu ordenador o busca automaticamente en internet.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("archivo")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "archivo" ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-700"}`}
        >
          <FolderOpen size={16} /> Subir desde carpeta
        </button>
        <button
          onClick={() => setTab("internet")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === "internet" ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Globe size={16} /> Buscar en internet
        </button>
      </div>

      {tab === "archivo" && (
        <div>
          {fase === "inicio" && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center hover:border-blue-400 transition-colors cursor-pointer bg-white"
              onClick={() => inputRef.current?.click()}
            >
              <FolderOpen size={56} className="mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-bold text-gray-700 mb-2">Seleccionar carpeta de imagenes</h2>
              <p className="text-gray-400 text-sm mb-4">El nombre de cada archivo debe ser el <strong>codigo del producto</strong> (ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">856607.jpg</code>)</p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                <FolderOpen size={18} /> Elegir carpeta
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif"
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleSeleccionCarpeta}
              />
              {cargandoProds && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Cargando productos...</span>
                </div>
              )}
            </div>
          )}

          {fase === "preview" && archivos.length > 0 && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900">{archivos.length}</div>
                  <div className="text-sm text-gray-500 mt-1">Imagenes detectadas</div>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                  <div className="text-3xl font-bold text-green-700">{listos.length}</div>
                  <div className="text-sm text-green-600 mt-1">Con producto coincidente</div>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
                  <div className="text-3xl font-bold text-amber-700">{sinMatch.length}</div>
                  <div className="text-sm text-amber-600 mt-1">Sin coincidencia</div>
                </div>
              </div>
              {sinMatch.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700"><strong>{sinMatch.length} imagenes</strong> no coinciden con ningun codigo de producto y seran ignoradas.</p>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-700 text-sm">Vista previa</span>
                  <span className="text-xs text-gray-400">{archivos.length} archivos</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto">
                  {archivos.map((item, i) => (
                    <div key={i} className={`rounded-xl border-2 overflow-hidden ${item.estado === "listo" ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
                      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img src={item.previewUrl} alt={item.nombreArchivo} className="w-full h-full object-contain p-1" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold truncate text-gray-700" title={item.nombreArchivo}>{item.codigoBuscado}</p>
                        {item.producto ? (
                          <p className="text-xs text-green-700 truncate" title={item.producto.nombre}>ok {item.producto.nombre}</p>
                        ) : (
                          <p className="text-xs text-amber-600">Sin coincidencia</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={resetear} className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSubir} disabled={listos.length === 0} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Upload size={18} /> Subir {listos.length} imagenes
                </button>
              </div>
            </div>
          )}

          {fase === "subiendo" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Loader2 size={48} className="animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">Subiendo imagenes...</h2>
              <p className="text-gray-500 text-sm mb-6">{progreso}% completado</p>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: progreso + "%" }} />
              </div>
            </div>
          )}

          {fase === "hecho" && (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl border border-green-200 p-5 text-center">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-600" />
                  <div className="text-3xl font-bold text-green-700">{exitosos.length}</div>
                  <div className="text-sm text-green-600 mt-1">Imagenes subidas correctamente</div>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-5 text-center">
                  <XCircle size={32} className="mx-auto mb-2 text-red-500" />
                  <div className="text-3xl font-bold text-red-600">{fallidos.length}</div>
                  <div className="text-sm text-red-500 mt-1">Con errores o sin coincidencia</div>
                </div>
              </div>
              {fallidos.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-gray-100"><span className="font-semibold text-gray-700 text-sm">Con errores ({fallidos.length})</span></div>
                  <div className="divide-y divide-gray-50">
                    {fallidos.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.previewUrl ? <img src={item.previewUrl} alt="" className="w-full h-full object-contain" /> : <Package size={16} className="text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{item.nombreArchivo}</p>
                          <p className="text-xs text-red-500">{item.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={resetear} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                <FolderOpen size={18} /> Subir mas imagenes
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "internet" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busquedaInternet}
                onChange={e => setBusquedaInternet(e.target.value)}
                placeholder="Buscar producto por nombre o codigo..."
                className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroBuscar("sin_imagen")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroBuscar === "sin_imagen" ? "bg-amber-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                Sin imagen
              </button>
              <button
                onClick={() => setFiltroBuscar("todos")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroBuscar === "todos" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                Todos
              </button>
              <button
                onClick={cargarProductosInternet}
                disabled={loadingProds}
                className="px-3 py-2 border rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                title="Recargar"
              >
                {loadingProds ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
          </div>

          {loadingProds ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={40} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div>
              <div className="mb-3 text-sm text-gray-500">
                {productosFiltrados.length} productos {filtroBuscar === "sin_imagen" ? "sin imagen" : "en total"}
                {Object.keys(guardados).length > 0 && <span className="ml-2 text-green-600 font-semibold">({Object.keys(guardados).length} actualizados esta sesion)</span>}
              </div>
              {productosFiltrados.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Image size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">
                    {filtroBuscar === "sin_imagen" ? "Todos los productos tienen imagen" : "No hay productos con ese nombre"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {productosFiltrados.map(prod => {
                    const imagenActual = guardados[prod.id] || prod.imagen_url;
                    const estaGuardando = guardando === prod.id;
                    const recienGuardado = !!guardados[prod.id];
                    return (
                      <div key={prod.id} className={`bg-white rounded-xl border-2 overflow-hidden flex flex-col transition-all ${recienGuardado ? "border-green-400" : "border-gray-100 hover:border-blue-200"}`}>
                        <div className="relative h-28 bg-gray-50 flex items-center justify-center">
                          {imagenActual ? (
                            <img src={imagenActual} alt={prod.nombre} className="w-full h-full object-contain p-2" onError={e => { e.target.style.display="none"; }} />
                          ) : (
                            <Package size={28} className="text-gray-200" />
                          )}
                          {recienGuardado && (
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                              <CheckCircle size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex flex-col flex-1 gap-1">
                          <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug min-h-[2rem]">{prod.nombre}</p>
                          {prod.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
                          <button
                            onClick={() => setBuscandoPanel(prod)}
                            disabled={estaGuardando}
                            className="mt-auto w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {estaGuardando ? (
                              <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                            ) : (
                              <><Globe size={12} /> {imagenActual ? "Cambiar imagen" : "Buscar imagen"}</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
