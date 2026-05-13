import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Table2, Loader2, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react";

// Columnas visuales fijas
const COL_LABELS = {
  1: { cod: "A", nom: "B", label: "Columna 1" },
  2: { cod: "D", nom: "E", label: "Columna 2" },
  3: { cod: "G", nom: "H", label: "Columna 3" },
};

export default function ExcelSelogas() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [hojaAbierta, setHojaAbierta] = useState(null); // null = todas abiertas

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("productos")
      .select("id,codigo,nombre,hoja_excel,columna_excel,orden_excel,seccion_excel,activo")
      .order("hoja_excel")
      .limit(3000);
    setProductos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Agrupar por hoja, luego por columna, ordenado por orden_excel
  const hojas = (() => {
    const filtrados = busqueda.trim()
      ? productos.filter(p =>
          (p.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
          (p.codigo || "").toLowerCase().includes(busqueda.toLowerCase())
        )
      : productos;

    const mapaHojas = {};
    for (const p of filtrados) {
      const hoja = p.hoja_excel || "SIN HOJA";
      if (!mapaHojas[hoja]) mapaHojas[hoja] = { 1: [], 2: [], 3: [] };
      const col = p.columna_excel >= 1 && p.columna_excel <= 3 ? p.columna_excel : 1;
      mapaHojas[hoja][col].push(p);
    }

    // Ordenar cada columna por orden_excel
    for (const hoja of Object.values(mapaHojas)) {
      for (const col of [1, 2, 3]) {
        hoja[col].sort((a, b) => (a.orden_excel || 0) - (b.orden_excel || 0));
      }
    }

    // Orden canónico de hojas
    const ORDEN = [
      "BEBIDAS 1", "BEBIDAS 2", "HOJA 3", "GOLOSINAS", "CHOCOLATES Y GALLETAS",
      "SNACK", "NUTRISPORT", "VAPER", "ARTICH Y GAFAS DE LECTURA",
      "DROGUERIA", "CONSUMIBLES", "CONGELADOS", "PROMOCIONES Y NOVEDADES",
      "ABONO", "DESCATALOGADOS", "GENERAL",
    ];

    const nombresOrdenados = [
      ...ORDEN.filter(h => mapaHojas[h]),
      ...Object.keys(mapaHojas).filter(h => !ORDEN.includes(h)).sort(),
    ];

    return nombresOrdenados.map(nombre => ({
      nombre,
      cols: mapaHojas[nombre],
      total: mapaHojas[nombre][1].length + mapaHojas[nombre][2].length + mapaHojas[nombre][3].length,
    }));
  })();

  const totalProductos = productos.length;

  return (
    <div style={{ maxWidth: "100%", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Table2 size={22} style={{ color: "#00913f" }} />
            Excel Selogas
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Vista visual de la plantilla · {totalProductos} productos · {hojas.length} hojas
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", fontSize: "13px", cursor: "pointer" }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
          Recargar
        </button>
      </div>

      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: "20px", maxWidth: "340px" }}>
        <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
        <input
          type="text"
          placeholder="Buscar producto o código..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", paddingLeft: "32px", paddingRight: "12px", height: "34px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", fontSize: "13px", background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .hoja-table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 12px; }
        .hoja-table th { background: #e8f5e9; color: #2e7d32; font-weight: 500; font-size: 11px; padding: 5px 6px; border: 0.5px solid #c8e6c9; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hoja-table td { padding: 3px 6px; border: 0.5px solid var(--color-border-tertiary); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .hoja-table tr:nth-child(even) td { background: var(--color-background-secondary); }
        .hoja-table tr:hover td { background: #e8f5e9; }
        .col-sep { border-left: 2px solid #a5d6a7 !important; }
        .cod-cell { color: var(--color-text-secondary); font-family: var(--font-mono); font-size: 11px; }
        .nom-cell { color: var(--color-text-primary); }
        .fila-num { color: var(--color-text-tertiary); font-size: 10px; font-family: var(--font-mono); text-align: right; background: var(--color-background-secondary) !important; border-right: 1px solid var(--color-border-secondary) !important; width: 28px; min-width: 28px; }
      `}</style>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", color: "var(--color-text-secondary)" }}>
          <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginRight: "10px" }} />
          Cargando productos...
        </div>
      ) : hojas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--color-text-tertiary)", fontSize: "14px" }}>
          No hay productos con datos de posición. Importa la plantilla primero.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {hojas.map(hoja => {
            const abierta = hojaAbierta === null || hojaAbierta === hoja.nombre;
            const maxRows = Math.max(hoja.cols[1].length, hoja.cols[2].length, hoja.cols[3].length);

            return (
              <div
                key={hoja.nombre}
                style={{ border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden", background: "var(--color-background-primary)" }}
              >
                {/* Cabecera de hoja */}
                <div
                  onClick={() => setHojaAbierta(prev => prev === hoja.nombre ? null : hoja.nombre)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#00913f", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#fff" }}>{hoja.nombre}</span>
                    <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.2)", color: "#fff", padding: "2px 8px", borderRadius: "10px" }}>
                      {hoja.total} productos
                    </span>
                  </div>
                  {abierta
                    ? <ChevronUp size={15} style={{ color: "rgba(255,255,255,0.8)" }} />
                    : <ChevronDown size={15} style={{ color: "rgba(255,255,255,0.8)" }} />
                  }
                </div>

                {/* Tabla tipo Excel */}
                {abierta && (
                  <div style={{ overflowX: "auto" }}>
                    <table className="hoja-table">
                      <colgroup>
                        <col style={{ width: "28px" }} />
                        {/* Col 1 */}
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "200px" }} />
                        {/* Col 2 */}
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "200px" }} />
                        {/* Col 3 */}
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "200px" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-tertiary)", textAlign: "center" }}></th>
                          {/* Col 1 */}
                          <th>A — Código</th>
                          <th>B — Nombre</th>
                          {/* Col 2 */}
                          <th className="col-sep">D — Código</th>
                          <th>E — Nombre</th>
                          {/* Col 3 */}
                          <th className="col-sep">G — Código</th>
                          <th>H — Nombre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maxRows === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: "12px" }}>
                              Sin productos
                            </td>
                          </tr>
                        ) : (
                          Array.from({ length: maxRows }, (_, i) => {
                            const p1 = hoja.cols[1][i];
                            const p2 = hoja.cols[2][i];
                            const p3 = hoja.cols[3][i];
                            // Número de fila real (orden_excel del primer producto no vacío en esa fila)
                            const filaNum = (p1?.orden_excel ?? p2?.orden_excel ?? p3?.orden_excel ?? i);
                            return (
                              <tr key={i}>
                                <td className="fila-num">{filaNum}</td>
                                {/* Col 1 */}
                                <td className="cod-cell">{p1?.codigo || ""}</td>
                                <td className="nom-cell">{p1?.nombre || ""}</td>
                                {/* Col 2 */}
                                <td className="cod-cell col-sep">{p2?.codigo || ""}</td>
                                <td className="nom-cell">{p2?.nombre || ""}</td>
                                {/* Col 3 */}
                                <td className="cod-cell col-sep">{p3?.codigo || ""}</td>
                                <td className="nom-cell">{p3?.nombre || ""}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
