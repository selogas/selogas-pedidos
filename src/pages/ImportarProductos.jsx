import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, LayoutGrid } from "lucide-react";

// ── Mapa canónico de nombres de hoja ─────────────────────────────────────
// Clave: nombre normalizado (UPPER + trim + espacios colapsados)
// Valor: nombre canónico que se guarda en BD y aparece en el PDF
const HOJA_CANONICO = {
  'BEBIDAS 1':                   'BEBIDAS 1',
  'BEBIDAS 2':                   'BEBIDAS 2',
  'GOLOSINAS':                   'GOLOSINAS',
  'CHOCOLATES Y GALLETAS':       'CHOCOLATES Y GALLETAS',
  'CHOCOLATES':                  'CHOCOLATES Y GALLETAS',
  'SNACK':                       'SNACK',
  'NUTRISPORT':                  'NUTRISPORT',
  'VAPER':                       'VAPER',
  'ARTICH Y GAFAS DE LECTURA':   'ARTICH Y GAFAS DE LECTURA',
  'ARTICH Y GAFAS LECTURA':      'ARTICH Y GAFAS DE LECTURA',
  'ASTRICH Y GAFAS LECTURA':     'ARTICH Y GAFAS DE LECTURA',
  'ARTICH':                      'ARTICH Y GAFAS DE LECTURA',
  'GAFAS DE LECTURA':            'ARTICH Y GAFAS DE LECTURA',
  'GAFAS LECTURA':               'ARTICH Y GAFAS DE LECTURA',
  'DROGUERIA':                   'DROGUERIA',
  'DROGUERÍA':                   'DROGUERIA',
  'CONSUMIBLES':                 'CONSUMIBLES',
  'CONGELADOS':                  'CONGELADOS',
  'PROMOCIONES Y NOVEDADES':     'PROMOCIONES Y NOVEDADES',
  'PROMOCIONES':                 'PROMOCIONES Y NOVEDADES',
  'ABONO':                       'ABONO',
  'DESCATALOGADOS':              'DESCATALOGADOS',
  'HOJA 3':                      'HOJA 3',
  'GENERAL':                     'GENERAL',
};

function normNombre(s) {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

function nombreCanonico(raw) {
  const norm = normNombre(raw);
  return HOJA_CANONICO[norm] || raw.trim();
}

const ORDEN_PDF = [
  'BEBIDAS 1', 'BEBIDAS 2', 'GOLOSINAS', 'CHOCOLATES Y GALLETAS',
  'SNACK', 'NUTRISPORT', 'VAPER', 'ARTICH Y GAFAS DE LECTURA',
  'DROGUERIA', 'CONSUMIBLES', 'CONGELADOS', 'PROMOCIONES Y NOVEDADES',
  'ABONO', 'DESCATALOGADOS',
];

export default function ImportarProductos() {
  const [tab, setTab] = useState("excel"); // "excel" | "plantilla"
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRefExcel = useRef(null);
  const fileRefPlantilla = useRef(null);

  // ── Opción 1: Importar productos nuevos desde Excel simple ──────
  // Col A = código, Col B = nombre
  const handleExcelSimple = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setProgress("Leyendo Excel...");
    try {
      const data = await file.arrayBuffer();
      const wb   = XLSX.read(data);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      const productos = [];
      for (const row of rows) {
        const codigo = String(row[0] || "").trim();
        const nombre = String(row[1] || "").trim();
        if (!codigo || !nombre) continue;
        if (codigo.toLowerCase() === "codigo" || codigo.toLowerCase() === "código") continue; // saltar cabecera
        productos.push({ codigo, nombre, disponible: true });
      }

      if (!productos.length) throw new Error("No se encontraron productos en el archivo.");

      setProgress(`Importando ${productos.length} productos...`);

      // Upsert en lote usando codigo como clave de conflicto
      let insertados = 0;
      for (let i = 0; i < productos.length; i += 50) {
        const lote = productos.slice(i, i + 50);
        const { error: upsertError, data: upserted } = await supabase
          .from("productos")
          .upsert(lote, { onConflict: "codigo", ignoreDuplicates: false })
          .select("id");
        if (upsertError) {
          if (upsertError.code === "42501" || upsertError.message?.includes("policy")) {
            throw new Error("Sin permisos para importar. Asegúrate de estar logueado como admin.");
          }
          throw new Error(upsertError.message);
        }
        insertados += (upserted?.length || lote.length);
        setProgress(`Procesando... ${Math.min(i + 50, productos.length)}/${productos.length}`);
      }

      // Invalidar caché
      try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}
      setResult({ total: insertados, actualizados: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false); setProgress("");
      if (fileRefExcel.current) fileRefExcel.current.value = "";
    }
  };

  // ── Opción 2: Importar plantilla SELOGAS ───────────────────────
  // Formato: 3 bloques (CODIGO, ARTICULO, PED) por fila
  // Orden: fila × bloque — igual que el PDF adjunto
  // También guarda la sección/cabecera (MAHOU, SAN MIGUEL...) de cada producto
  const handlePlantillaSelogas = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setLoading(true); setError(null); setResult(null); setProgress("Leyendo plantilla...");
  try {
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data);

    // Pestañas a ignorar completamente
    const SKIP = new Set(['ABONO', 'DESCATALOGADOS', 'RESUMEN', 'HOJA RESUMEN']);

    const productos = [];

    for (const sheetName of wb.SheetNames) {
      const rawHoja = sheetName.trim();
      const normHoja = normNombre(rawHoja);

      if (SKIP.has(normHoja)) continue;
      if (!rawHoja) continue;

      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // Nombre canónico para guardar en BD
      const hojaCanonica = nombreCanonico(rawHoja);

      const seccionActual = { 1: null, 2: null, 3: null };
      let orden = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        for (let b = 0; b < 3; b++) {
          const colCod = b * 3;
          const colArt = b * 3 + 1;

          const raw_cod = String(row[colCod] ?? "").trim();
          const raw_art = String(row[colArt] ?? "").trim();

          if (!raw_cod && !raw_art) continue;
          if (raw_art.toLowerCase() === "nan") continue;
          if (raw_cod.toUpperCase() === "CODIGO" || raw_cod.toUpperCase() === "CÓDIGO") continue;

          let codLimpio = raw_cod
            .replace(/\.0+$/, "")
            .replace(/[\s,]/g, "");

          const esProducto = codLimpio.length >= 4 &&
            /^[0-9]+[A-Za-z]?$/.test(codLimpio);

          if (esProducto) {
            orden++;
            productos.push({
              codigo:        codLimpio,
              hoja_excel:    hojaCanonica,   // nombre canónico
              columna_excel: b + 1,
              orden_excel:   orden,
              seccion_excel: seccionActual[b + 1] ?? null,
            });
          } else if (raw_art && !esProducto) {
            seccionActual[b + 1] = raw_art;
          }
        }
      }
    }

    if (!productos.length) throw new Error("No se encontraron productos con código en la plantilla.");
    setProgress(`${productos.length} productos encontrados. Actualizando BD...`);

    let actualizados = 0;
    let noEncontrados = 0;
    const BATCH = 50;

    for (let i = 0; i < productos.length; i += BATCH) {
      const lote = productos.slice(i, i + BATCH);
      const codigos = lote.map(p => p.codigo);
      const { data: found, error: fetchErr } = await supabase
        .from("productos")
        .select("id, codigo")
        .in("codigo", codigos);

      if (fetchErr) throw new Error(fetchErr.message);

      const mapaId = {};
      (found || []).forEach(p => { mapaId[p.codigo] = p.id; });

      for (const p of lote) {
        const id = mapaId[p.codigo];
        if (!id) { noEncontrados++; continue; }

        const { error: updErr } = await supabase
          .from("productos")
          .update({
            hoja_excel:    p.hoja_excel,
            columna_excel: p.columna_excel,
            orden_excel:   p.orden_excel,
            seccion_excel: p.seccion_excel,
          })
          .eq("id", id);

        if (updErr) throw new Error(`Error actualizando ${p.codigo}: ${updErr.message}`);
        actualizados++;
      }

      setProgress(`Actualizando... ${Math.min(i + BATCH, productos.length)}/${productos.length}`);
    }

    try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}
    setResult({ total: actualizados, noEncontrados, tipo: "plantilla" });
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false); setProgress("");
    if (fileRefPlantilla.current) fileRefPlantilla.current.value = "";
  }
};

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Importar Productos</h1>
      <p className="text-gray-500 text-sm mb-5">Dos opciones para añadir o actualizar productos</p>

      {/* Pestañas */}
      <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-2xl">
        {[
          { id: "excel",    icon: FileSpreadsheet, label: "Excel simple" },
          { id: "plantilla",icon: LayoutGrid,      label: "Plantilla SELOGAS" },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id ? "bg-white shadow text-[#00913f]" : "text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Excel simple ── */}
      {tab === "excel" && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-[#00913f]" /> Importar productos nuevos
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Excel con <strong>columna A = código</strong> y <strong>columna B = nombre</strong>.
            Si el código ya existe se omite. Los productos quedan sin categoría.
          </p>
          <div
            onClick={() => !loading && fileRefExcel.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              loading ? "opacity-50 cursor-not-allowed" : "border-gray-200 hover:border-[#00913f] hover:bg-[#edf7f2]"
            }`}
          >
            <Upload size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-600">Haz clic para seleccionar el Excel</p>
            <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .ods</p>
          </div>
          <input ref={fileRefExcel} type="file" accept=".xlsx,.xls,.ods,.csv" className="hidden"
            onChange={handleExcelSimple} />

          {progress && (
            <div className="mt-4 p-3 bg-[#edf7f2] rounded-xl text-[#007a34] text-sm flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> {progress}
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {result && !result.tipo && (
            <div className="mt-4 p-3 bg-green-50 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <CheckCircle size={15} />
              <span>✅ <strong>{result.total} nuevos</strong> insertados.
              {result.actualizados > 0 && ` <strong>${result.actualizados}</strong> actualizados (nombre).`}</span>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Plantilla SELOGAS ── */}
      {tab === "plantilla" && (
  <div className="bg-white rounded-2xl border p-6 shadow-sm">
    <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
      <LayoutGrid size={20} className="text-[#00913f]" /> Plantilla SELOGAS
    </h2>
    <p className="text-gray-500 text-sm mb-2">
      Importa el Excel de la hoja de pedido SELOGAS. Cada pestaña = una sección del PDF (una página por sección).
    </p>
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
      <p className="text-xs font-semibold text-amber-800 mb-2">Secciones del PDF (14 páginas):</p>
      <div className="grid grid-cols-2 gap-1 text-xs text-amber-700">
        {ORDEN_PDF.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-4 h-4 bg-amber-200 rounded text-center font-bold text-amber-900 text-xs leading-4 flex-shrink-0">{i+1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-gray-50 border rounded-xl p-3 mb-4 text-xs text-gray-500 font-mono">
      <div className="grid grid-cols-9 gap-0.5 text-center font-bold text-gray-700 mb-1">
        <span className="col-span-1 bg-gray-200 rounded p-1">CÓDIGO</span>
        <span className="col-span-2 bg-gray-200 rounded p-1">ARTÍCULO</span>
        <span className="col-span-1 bg-gray-200 rounded p-1">PED</span>
        <span className="col-span-1 bg-gray-200 rounded p-1">CÓDIGO</span>
        <span className="col-span-2 bg-gray-200 rounded p-1">ARTÍCULO</span>
        <span className="col-span-1 bg-gray-200 rounded p-1">PED</span>
        <span className="col-span-1 bg-gray-200 rounded p-1">...</span>
      </div>
      <p className="text-center text-gray-400 mt-1">Formato 3 columnas idéntico al PDF</p>
    </div>
    <div
      onClick={() => !loading && fileRefPlantilla.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
        loading ? "opacity-50 cursor-not-allowed" : "border-gray-200 hover:border-[#00913f] hover:bg-[#edf7f2]"
      }`}
    >
      <LayoutGrid size={36} className="mx-auto mb-3 text-gray-300" />
      <p className="font-semibold text-gray-600">Haz clic para seleccionar la plantilla</p>
      <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .ods</p>
    </div>
    <input ref={fileRefPlantilla} type="file" accept=".xlsx,.xls,.ods" className="hidden"
      onChange={handlePlantillaSelogas} />
    {progress && (
      <div className="mt-4 p-3 bg-[#edf7f2] rounded-xl text-[#007a34] text-sm flex items-center gap-2">
        <Loader2 size={15} className="animate-spin" /> {progress}
      </div>
    )}
    {error && (
      <div className="mt-4 p-3 bg-red-50 rounded-xl text-red-700 text-sm flex items-center gap-2">
        <AlertCircle size={15} /> {error}
      </div>
    )}
    {result?.tipo === "plantilla" && (
      <div className="mt-4 p-3 bg-green-50 rounded-xl text-green-700 text-sm flex items-center gap-2">
        <CheckCircle size={15} />
        <span>
          ✅ <strong>{result.total} productos</strong> actualizados con orden y sección del PDF.
          {result.noEncontrados > 0 && ` ${result.noEncontrados} códigos no encontrados en BD.`}
        </span>
      </div>
    )}
  </div>
)}
    </div>
  );
}
