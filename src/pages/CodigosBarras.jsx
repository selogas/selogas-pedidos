import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Upload, Barcode, X, Check, AlertCircle, Loader2, Trash2, Plus } from "lucide-react";
import * as XLSX from "xlsx";

// ─── Utilidades ───────────────────────────────────────────────────────────────
const cls = (...c) => c.filter(Boolean).join(" ");

// ─── Fila de barcode editable ─────────────────────────────────────────────────
function FilaBarcode({ barcode, onEliminar }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1 text-sm font-mono text-gray-700">
      {barcode}
      <button onClick={() => onEliminar(barcode)} className="text-gray-400 hover:text-red-500 transition-colors">
        <X size={12} />
      </button>
    </span>
  );
}

// ─── Modal añadir barcode manual ─────────────────────────────────────────────
function ModalAddBarcode({ producto, onClose, onGuardado }) {
  const [val, setVal]       = useState("");
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleGuardar = async () => {
    const bc = val.trim();
    if (!bc) { setError("Escribe un código de barras"); return; }
    setSaving(true); setError("");
    const { error: e } = await supabase
      .from("producto_barcodes")
      .insert({ producto_id: producto.id, barcode: bc });
    setSaving(false);
    if (e) { setError(e.message.includes("unique") ? "Ese barcode ya existe en otro producto" : e.message); return; }
    onGuardado(bc);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Añadir barcode</h3>
        <p className="text-sm text-gray-500 mb-4">{producto.nombre} <span className="font-mono text-gray-400">({producto.codigo})</span></p>
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleGuardar()}
          placeholder="EAN / código de barras"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-[#00913f]/40"
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-[#00913f] text-white text-sm font-bold hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal importar Excel ─────────────────────────────────────────────────────
function ModalImportarExcel({ productos, onClose, onImportado }) {
  const [paso, setPaso]         = useState(1); // 1=subir 2=preview 3=resultado
  const [preview, setPreview]   = useState([]); // { codigo, barcode, nombre, match, yaExiste }
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError]       = useState("");
  const fileRef = useRef();

  // Mapa código interno → producto
  const mapaCodigo = {};
  productos.forEach(p => { if (p.codigo) mapaCodigo[p.codigo.trim().toLowerCase()] = p; });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcesando(true); setError("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // Buscar cabecera: necesitamos columna "codigo" y "barcode"
      let headerIdx = -1, colCodigo = -1, colBarcode = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i].map(v => String(v || "").toLowerCase().trim());
        const ci = row.findIndex(c =>
          c === "codigo" || c === "código" || c === "cod" || c === "referencia" ||
          c === "artículo" || c === "articulo" || c === "cod. interno" || c === "codigo interno"
        );
        const bi = row.findIndex(c =>
          c === "barcode" || c === "cod. barras" || c === "ean" || c === "código de barras" ||
          c === "codigo barras" || c === "barras" || c === "cod barras"
        );
        if (ci >= 0 && bi >= 0) { headerIdx = i; colCodigo = ci; colBarcode = bi; break; }
      }
      // Fallback: asumir col 0 = codigo, col 1 = barcode
      if (headerIdx < 0) { headerIdx = 0; colCodigo = 0; colBarcode = 1; }

      // Cargar barcodes ya existentes para detectar duplicados
      const { data: existentes } = await supabase.from("producto_barcodes").select("barcode");
      const setExistentes = new Set((existentes || []).map(r => r.barcode));

      const filas = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const cod = row[colCodigo] != null ? String(row[colCodigo]).trim().replace(/\.0+$/, "") : null;
        const bc  = row[colBarcode] != null ? String(row[colBarcode]).trim().replace(/\.0+$/, "") : null;
        if (!cod || !bc) continue;
        const prod = mapaCodigo[cod.toLowerCase()] || null;
        filas.push({ codigo: cod, barcode: bc, nombre: prod?.nombre || null, prod_id: prod?.id || null, match: !!prod, yaExiste: setExistentes.has(bc) });
      }

      if (!filas.length) { setError("No se encontraron filas con código y barcode."); return; }
      setPreview(filas);
      setPaso(2);
    } catch (e) {
      setError("Error al leer el archivo: " + e.message);
    } finally {
      setProcesando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImportar = async () => {
    const lineasValidas = preview.filter(l => l.match && !l.yaExiste);
    if (!lineasValidas.length) return;
    setProcesando(true);
    const inserts = lineasValidas.map(l => ({ producto_id: l.prod_id, barcode: l.barcode }));
    const { error: e } = await supabase.from("producto_barcodes").insert(inserts);
    setProcesando(false);
    if (e) { setError("Error al importar: " + e.message); return; }
    setResultado({ ok: lineasValidas.length, sinMatch: preview.filter(l => !l.match).length, duplicados: preview.filter(l => l.yaExiste).length });
    setPaso(3);
    onImportado();
  };

  const matchCount     = preview.filter(l => l.match && !l.yaExiste).length;
  const sinMatchCount  = preview.filter(l => !l.match).length;
  const duplicadoCount = preview.filter(l => l.yaExiste).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Importar barcodes desde Excel</h3>
            <p className="text-xs text-gray-500 mt-0.5">El Excel debe tener columnas: <span className="font-mono">código interno</span> y <span className="font-mono">barcode</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Paso 1: subir archivo */}
          {paso === 1 && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-[#00913f] hover:bg-green-50/30 transition-colors"
              >
                <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-600">Haz clic para seleccionar el Excel</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx o .csv — columnas: código + barcode</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              {procesando && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Procesando...</div>}
              {error && <p className="text-sm text-red-500">{error}</p>}

              {/* Plantilla de ejemplo */}
              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
                <p className="font-semibold text-gray-600 mb-2">Formato esperado:</p>
                <table className="w-full text-left border-collapse">
                  <thead><tr className="border-b border-gray-200"><th className="pb-1 pr-6 font-mono text-gray-700">codigo</th><th className="pb-1 font-mono text-gray-700">barcode</th></tr></thead>
                  <tbody>
                    <tr><td className="py-0.5 pr-6 font-mono">2455100</td><td className="font-mono">8410128122720</td></tr>
                    <tr><td className="py-0.5 pr-6 font-mono">225001901</td><td className="font-mono">5000329002209</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paso 2: preview */}
          {paso === 2 && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{matchCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">Se importarán</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{duplicadoCount}</p>
                  <p className="text-xs text-yellow-600 mt-0.5">Ya existen</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{sinMatchCount}</p>
                  <p className="text-xs text-red-600 mt-0.5">Sin match</p>
                </div>
              </div>

              {/* Tabla de preview */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Código</th>
                      <th className="text-left px-3 py-2">Producto</th>
                      <th className="text-left px-3 py-2 font-mono">Barcode</th>
                      <th className="text-center px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((l, i) => (
                      <tr key={i} className={cls("text-xs", !l.match && "bg-red-50/40", l.yaExiste && "bg-yellow-50/40")}>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{l.codigo}</td>
                        <td className="px-3 py-1.5 text-gray-700 max-w-[160px] truncate">{l.nombre || <span className="text-red-400 italic">no encontrado</span>}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-500">{l.barcode}</td>
                        <td className="px-3 py-1.5 text-center">
                          {l.yaExiste
                            ? <span className="text-yellow-600 text-xs">duplicado</span>
                            : l.match
                              ? <Check size={14} className="inline text-green-600" />
                              : <AlertCircle size={14} className="inline text-red-500" />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}

          {/* Paso 3: resultado */}
          {paso === 3 && resultado && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="font-bold text-gray-800 text-lg">Importación completada</p>
              <p className="text-sm text-gray-500">{resultado.ok} barcodes añadidos correctamente</p>
              {resultado.duplicados > 0 && <p className="text-xs text-yellow-600">{resultado.duplicados} ya existían y se omitieron</p>}
              {resultado.sinMatch > 0 && <p className="text-xs text-red-500">{resultado.sinMatch} sin match con ningún producto</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
            {paso === 3 ? "Cerrar" : "Cancelar"}
          </button>
          {paso === 2 && (
            <button
              onClick={handleImportar}
              disabled={procesando || matchCount === 0}
              className="px-5 py-2 rounded-xl bg-[#00913f] text-white text-sm font-bold hover:bg-[#007a34] disabled:opacity-50 flex items-center gap-2"
            >
              {procesando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importar {matchCount} barcodes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CodigosBarras() {
  const [productos,   setProductos]   = useState([]);
  const [barcodes,    setBarcodes]    = useState({}); // { prod_id: [barcode, ...] }
  const [busqueda,    setBusqueda]    = useState("");
  const [cargando,    setCargando]    = useState(true);
  const [modalAdd,    setModalAdd]    = useState(null); // producto seleccionado
  const [modalImport, setModalImport] = useState(false);

  // Carga inicial
  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    const [{ data: prods }, { data: bcs }] = await Promise.all([
      supabase.from("productos").select("id, codigo, nombre, activo").order("codigo"),
      supabase.from("producto_barcodes").select("producto_id, barcode"),
    ]);
    setProductos(prods || []);
    const mapa = {};
    (bcs || []).forEach(r => {
      if (!mapa[r.producto_id]) mapa[r.producto_id] = [];
      mapa[r.producto_id].push(r.barcode);
    });
    setBarcodes(mapa);
    setCargando(false);
  };

  const handleEliminarBarcode = async (prodId, barcode) => {
    await supabase.from("producto_barcodes").delete().eq("producto_id", prodId).eq("barcode", barcode);
    setBarcodes(prev => ({ ...prev, [prodId]: (prev[prodId] || []).filter(b => b !== barcode) }));
  };

  const handleBarcodeGuardado = (prodId, barcode) => {
    setBarcodes(prev => ({ ...prev, [prodId]: [...(prev[prodId] || []), barcode] }));
  };

  // Filtrado por búsqueda (nombre, código interno o barcode)
  const productosFiltrados = productos.filter(p => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    if (p.nombre?.toLowerCase().includes(q)) return true;
    if (p.codigo?.toLowerCase().includes(q)) return true;
    if ((barcodes[p.id] || []).some(b => b.includes(q))) return true;
    return false;
  });

  const totalConBarcode = productos.filter(p => (barcodes[p.id] || []).length > 0).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Barcode size={22} className="text-[#00913f]" /> Códigos de Barras
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalConBarcode} de {productos.length} productos con barcode asignado
          </p>
        </div>
        <button
          onClick={() => setModalImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] shadow"
        >
          <Upload size={16} /> Importar Excel
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código interno o barcode…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00913f]/40"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : (
        <div className="space-y-2">
          {productosFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p>No se encontraron productos</p>
            </div>
          )}
          {productosFiltrados.map(prod => {
            const bcs = barcodes[prod.id] || [];
            return (
              <div key={prod.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Info del producto */}
                <div className="w-28 flex-shrink-0">
                  <p className="text-xs font-mono text-gray-500 leading-none">{prod.codigo || "—"}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{prod.nombre}</p>
                </div>

                {/* Barcodes */}
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {bcs.length === 0
                    ? <span className="text-xs text-gray-300 italic">Sin barcode</span>
                    : bcs.map(bc => (
                        <FilaBarcode key={bc} barcode={bc} onEliminar={() => handleEliminarBarcode(prod.id, bc)} />
                      ))
                  }
                </div>

                {/* Botón añadir */}
                <button
                  onClick={() => setModalAdd(prod)}
                  title="Añadir barcode"
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 hover:bg-[#00913f] hover:text-white text-gray-500 flex items-center justify-center transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      {modalAdd && (
        <ModalAddBarcode
          producto={modalAdd}
          onClose={() => setModalAdd(null)}
          onGuardado={(bc) => handleBarcodeGuardado(modalAdd.id, bc)}
        />
      )}
      {modalImport && (
        <ModalImportarExcel
          productos={productos}
          onClose={() => setModalImport(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}
