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
  // Modelo híbrido:
  //   - Corrección automática: hoja no canónica, código sucio, columna fuera de rango
  //   - Bloqueo estricto: duplicados de orden dentro de hoja+columna
  //   - Reindexación local por hoja+columna antes de escribir en BD
  //   - Output completo: correcciones, errores, resumen por hoja
  const handlePlantillaSelogas = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null); setResult(null); setProgress("Leyendo plantilla...");
    try {
      const data = await file.arrayBuffer();
      const wb   = XLSX.read(data);

      const SKIP = new Set(['ABONO', 'DESCATALOGADOS', 'RESUMEN', 'HOJA RESUMEN']);

      const productos   = [];   // productos parseados y ya corregidos
      const correcciones = [];  // log de correcciones automáticas aplicadas
      const errores     = [];   // errores bloqueantes detectados

      // ── FASE 1: PARSE + CORRECCIONES AUTOMÁTICAS ──────────────
      for (const sheetName of wb.SheetNames) {
        const rawHoja  = sheetName.trim();
        const normHoja = normNombre(rawHoja);
        if (SKIP.has(normHoja) || !rawHoja) continue;

        // Corrección automática: normalizar nombre de hoja
        const hojaCanonica = nombreCanonico(rawHoja);
        if (hojaCanonica !== rawHoja) {
          correcciones.push(`Hoja "${rawHoja}" → normalizada a "${hojaCanonica}"`);
        }

        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const seccionActual = { 1: null, 2: null, 3: null };

        // Contador independiente por columna para detectar duplicados limpiamente
        const ordenPorColumna = { 1: 0, 2: 0, 3: 0 };

        for (const row of rows) {
          for (let b = 0; b < 3; b++) {
            const raw_cod = String(row[b * 3]     ?? "").trim();
            const raw_art = String(row[b * 3 + 1] ?? "").trim();

            if (!raw_cod && !raw_art) continue;
            if (raw_art.toLowerCase() === "nan") continue;
            if (raw_cod.toUpperCase() === "CODIGO" || raw_cod.toUpperCase() === "CÓDIGO") continue;

            // Corrección automática: limpiar código
            let codLimpio = raw_cod.replace(/\.0+$/, "").replace(/[\s,]/g, "");
            if (codLimpio !== raw_cod && codLimpio.length > 0) {
              correcciones.push(`Código "${raw_cod}" (hoja ${hojaCanonica}) → limpiado a "${codLimpio}"`);
            }

            const esProducto = codLimpio.length >= 4 && /^[0-9]+[A-Za-z]?$/.test(codLimpio);

            if (esProducto) {
              // columna_excel es siempre b+1 (1, 2 o 3) — nunca puede ser fuera de rango
              // en la plantilla SELOGAS, pero lo validamos por si acaso
              let columna = b + 1;
              if (columna < 1 || columna > 3) {
                correcciones.push(`Columna ${columna} inválida para "${codLimpio}" → corregida a 1`);
                columna = 1;
              }

              ordenPorColumna[columna]++;
              productos.push({
                codigo:        codLimpio,
                hoja_excel:    hojaCanonica,
                columna_excel: columna,
                orden_excel:   ordenPorColumna[columna], // orden local por columna
                seccion_excel: seccionActual[columna] ?? null,
              });
            } else if (raw_art && !esProducto) {
              seccionActual[b + 1] = raw_art;
            }
          }
        }
      }

      if (!productos.length) throw new Error("No se encontraron productos con código en la plantilla.");

      // ── FASE 2: DETECCIÓN DE DUPLICADOS — BLOQUEO ESTRICTO ────
      // Aunque el contador es por columna, pueden existir duplicados si el mismo
      // código aparece dos veces en la misma columna/hoja
      const claves = new Map(); // "hoja|columna|orden" → codigo
      for (const p of productos) {
        const clave = `${p.hoja_excel}|${p.columna_excel}|${p.orden_excel}`;
        if (claves.has(clave)) {
          errores.push(
            `Duplicado en ${p.hoja_excel} col.${p.columna_excel} orden ${p.orden_excel}: ` +
            `"${claves.get(clave)}" y "${p.codigo}"`
          );
        } else {
          claves.set(clave, p.codigo);
        }
      }

      // También detectar mismo código dos veces en la misma hoja
      const codigosEnHoja = new Map(); // "hoja|codigo" → index
      for (const p of productos) {
        const clave = `${p.hoja_excel}|${p.codigo}`;
        if (codigosEnHoja.has(clave)) {
          errores.push(
            `Código "${p.codigo}" aparece dos veces en hoja "${p.hoja_excel}" ` +
            `(col.${codigosEnHoja.get(clave)} y col.${p.columna_excel})`
          );
        } else {
          codigosEnHoja.set(clave, p.columna_excel);
        }
      }

      if (errores.length > 0) {
        // BLOQUEO: no se escribe nada en BD
        setResult({ tipo: "bloqueado", errores, correcciones, total: productos.length });
        return;
      }

      // ── FASE 3: REINDEXACIÓN LOCAL POR HOJA+COLUMNA ───────────
      // En este punto no hay duplicados, pero reindexamos para garantizar
      // secuencias limpias 1..N sin huecos antes de escribir en BD
      const contadores = {};
      for (const p of productos) {
        const key = `${p.hoja_excel}|${p.columna_excel}`;
        contadores[key] = (contadores[key] || 0) + 1;
        p.orden_excel = contadores[key];
      }

      // ── FASE 4: ESCRIBIR EN BD ─────────────────────────────────
      setProgress(`${productos.length} productos válidos. Actualizando BD...`);

      let actualizados  = 0;
      let noEncontrados = 0;
      const resumenHojas = {}; // hoja → { actualizados, noEncontrados }
      const BATCH = 50;

      for (let i = 0; i < productos.length; i += BATCH) {
        const lote   = productos.slice(i, i + BATCH);
        const codigos = lote.map(p => p.codigo);

        const { data: found, error: fetchErr } = await supabase
          .from("productos")
          .select("id, codigo")
          .in("codigo", codigos);
        if (fetchErr) throw new Error(fetchErr.message);

        const mapaId = {};
        (found || []).forEach(p => { mapaId[p.codigo] = p.id; });

        for (const p of lote) {
          const hoja = p.hoja_excel;
          if (!resumenHojas[hoja]) resumenHojas[hoja] = { actualizados: 0, noEncontrados: 0 };

          const id = mapaId[p.codigo];
          if (!id) {
            noEncontrados++;
            resumenHojas[hoja].noEncontrados++;
            continue;
          }

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
          resumenHojas[hoja].actualizados++;
        }

        setProgress(`Actualizando... ${Math.min(i + BATCH, productos.length)}/${productos.length}`);
      }

      try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}

      setResult({
        tipo:          "plantilla",
        total:         actualizados,
        noEncontrados,
        correcciones,
        resumenHojas,
      });

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
    {/* Importación bloqueada por errores */}
    {result?.tipo === "bloqueado" && (
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-2">
            <AlertCircle size={15} /> Importación bloqueada — {result.errores.length} error(es) detectado(s)
          </div>
          <p className="text-xs text-red-600 mb-2">Ningún dato fue guardado. Corrige el Excel y vuelve a importar.</p>
          <ul className="space-y-1">
            {result.errores.map((e, i) => (
              <li key={i} className="text-xs text-red-700 font-mono bg-red-100 px-2 py-1 rounded">⛔ {e}</li>
            ))}
          </ul>
        </div>
        {result.correcciones?.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">Correcciones automáticas que se habrían aplicado ({result.correcciones.length}):</p>
            <ul className="space-y-0.5">
              {result.correcciones.slice(0, 10).map((c, i) => (
                <li key={i} className="text-xs text-amber-700 font-mono">✏️ {c}</li>
              ))}
              {result.correcciones.length > 10 && (
                <li className="text-xs text-amber-500">… y {result.correcciones.length - 10} más</li>
              )}
            </ul>
          </div>
        )}
      </div>
    )}

    {/* Importación exitosa */}
    {result?.tipo === "plantilla" && (
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-1">
            <CheckCircle size={15} /> {result.total} productos actualizados correctamente
          </div>
          {result.noEncontrados > 0 && (
            <p className="text-xs text-amber-600">⚠ {result.noEncontrados} códigos del Excel no existen en BD (no se crearon).</p>
          )}
        </div>

        {/* Resumen por hoja */}
        {result.resumenHojas && Object.keys(result.resumenHojas).length > 0 && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Impacto por hoja:</p>
            <div className="space-y-0.5">
              {Object.entries(result.resumenHojas).map(([hoja, r]) => (
                <div key={hoja} className="flex justify-between text-xs">
                  <span className="text-gray-600 font-mono">{hoja}</span>
                  <span className="text-gray-500">
                    {r.actualizados} actualizados
                    {r.noEncontrados > 0 && <span className="text-amber-600 ml-2">{r.noEncontrados} no encontrados</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Correcciones automáticas aplicadas */}
        {result.correcciones?.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">Correcciones automáticas aplicadas ({result.correcciones.length}):</p>
            <ul className="space-y-0.5">
              {result.correcciones.slice(0, 10).map((c, i) => (
                <li key={i} className="text-xs text-amber-700 font-mono">✏️ {c}</li>
              ))}
              {result.correcciones.length > 10 && (
                <li className="text-xs text-amber-500">… y {result.correcciones.length - 10} más</li>
              )}
            </ul>
          </div>
        )}
      </div>
    )}
  </div>
)}
    </div>
  );
}
