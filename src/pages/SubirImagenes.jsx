import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FolderOpen, CheckCircle, XCircle, Loader2, Image, Package, AlertTriangle } from "lucide-react";

export default function SubirImagenes() {
  const [archivos, setArchivos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [emparejados, setEmparejados] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [cargandoProds, setCargandoProds] = useState(false);
  const [fase, setFase] = useState("inicio"); // inicio | preview | subiendo | hecho
  const inputRef = useRef();

  const cargarProductos = async () => {
    setCargandoProds(true);
    const { data } = await supabase.from("productos").select("id, nombre, codigo, imagen_url").order("nombre");
    setCargandoProds(false);
    return data || [];
  };

  const handleSeleccionCarpeta = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const prods = await cargarProductos();
    setProductos(prods);

    // Build a map: codigo.toLowerCase() -> product
    const mapaProductos = {};
    prods.forEach(p => {
      if (p.codigo) {
        mapaProductos[p.codigo.toLowerCase().trim()] = p;
      }
    });

    const imagenesValidas = files.filter(f =>
      f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f.name)
    );

    const emparejamientos = imagenesValidas.map(file => {
      // Extract code from filename (remove extension)
      const nombreSinExt = file.name.replace(/\.[^.]+$/, "").trim();
      const codigoBuscado = nombreSinExt.toLowerCase();

      // Try exact match first
      let productoEncontrado = mapaProductos[codigoBuscado];

      // Try partial match if no exact
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

    // Also add the ones without match to results
    archivos.filter(a => a.estado === "sin_match").forEach(a => {
      res.push({ ...a, exito: false, error: "Sin producto coincidente" });
    });

    setResultados(res);
    setSubiendo(false);
    setFase("hecho");
  };

  const resetear = () => {
    setArchivos([]);
    setEmparejados([]);
    setResultados([]);
    setProgreso(0);
    setFase("inicio");
    if (inputRef.current) inputRef.current.value = "";
  };

  const listos = archivos.filter(a => a.estado === "listo");
  const sinMatch = archivos.filter(a => a.estado === "sin_match");
  const exitosos = resultados.filter(r => r.exito);
  const fallidos = resultados.filter(r => !r.exito);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Subir Im\u00E1genes Masivamente</h1>
        <p className="text-gray-500 text-sm">
          Selecciona una carpeta con im\u00E1genes. El nombre de cada archivo debe ser el <strong>c\u00F3digo del producto</strong> (ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">PROD-001.jpg</code>).
          Las im\u00E1genes se asociar\u00E1n autom\u00E1ticamente al producto con ese c\u00F3digo.
        </p>
      </div>

      {fase === "inicio" && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center hover:border-blue-400 transition-colors cursor-pointer bg-white"
          onClick={() => inputRef.current?.click()}
        >
          <FolderOpen size={56} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-700 mb-2">Seleccionar carpeta de im\u00E1genes</h2>
          <p className="text-gray-400 text-sm mb-4">
            Haz clic aqu\u00ED o arrastra una carpeta
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            <FolderOpen size={18} />
            Elegir carpeta
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
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{archivos.length}</div>
              <div className="text-sm text-gray-500 mt-1">Im\u00E1genes detectadas</div>
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
              <p className="text-sm text-amber-700">
                <strong>{sinMatch.length} im\u00E1genes</strong> no coinciden con ning\u00FAn c\u00F3digo de producto y ser\u00E1n ignoradas.
                Aseg\u00FArate de que el nombre del archivo sea exactamente el c\u00F3digo del producto.
              </p>
            </div>
          )}

          {/* Image grid */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-sm">Vista previa</span>
              <span className="text-xs text-gray-400">{archivos.length} archivos</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto">
              {archivos.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-xl border-2 overflow-hidden ${item.estado === "listo" ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}
                >
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.previewUrl}
                      alt={item.nombreArchivo}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold truncate text-gray-700" title={item.nombreArchivo}>{item.codigoBuscado}</p>
                    {item.producto ? (
                      <p className="text-xs text-green-700 truncate" title={item.producto.nombre}>
                        \u2713 {item.producto.nombre}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600">\u26A0 Sin coincidencia</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetear}
              className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubir}
              disabled={listos.length === 0}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Subir {listos.length} im\u00E1genes
            </button>
          </div>
        </div>
      )}

      {fase === "subiendo" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Subiendo im\u00E1genes...</h2>
          <p className="text-gray-500 text-sm mb-6">{progreso}% completado</p>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: progreso + "%" }}
            />
          </div>
        </div>
      )}

      {fase === "hecho" && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl border border-green-200 p-5 text-center">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-600" />
              <div className="text-3xl font-bold text-green-700">{exitosos.length}</div>
              <div className="text-sm text-green-600 mt-1">Im\u00E1genes subidas correctamente</div>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-5 text-center">
              <XCircle size={32} className="mx-auto mb-2 text-red-500" />
              <div className="text-3xl font-bold text-red-600">{fallidos.length}</div>
              <div className="text-sm text-red-500 mt-1">Con errores o sin coincidencia</div>
            </div>
          </div>

          {exitosos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="font-semibold text-gray-700 text-sm">Subidas correctamente ({exitosos.length})</span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto">
                {exitosos.map((item, i) => (
                  <div key={i} className="rounded-xl border border-green-200 overflow-hidden">
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img src={item.previewUrl} alt="" className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold truncate text-gray-700">{item.codigoBuscado}</p>
                      <p className="text-xs text-green-700 truncate">{item.producto?.nombre}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fallidos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <XCircle size={16} className="text-red-500" />
                <span className="font-semibold text-gray-700 text-sm">Con errores ({fallidos.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {fallidos.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Package size={16} className="text-gray-300" />
                      )}
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

          <button
            onClick={resetear}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <FolderOpen size={18} />
            Subir m\u00E1s im\u00E1genes
          </button>
        </div>
      )}
    </div>
  );
}
