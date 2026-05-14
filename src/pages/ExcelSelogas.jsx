import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table2, Loader2, RefreshCw, Search, ChevronDown, ChevronUp,
  Save, X, GripVertical, Layers
} from "lucide-react";

const ORDEN_HOJAS_DEFAULT = [
  "BEBIDAS 1", "BEBIDAS 2", "HOJA 3", "GOLOSINAS", "CHOCOLATES Y GALLETAS",
  "SNACK", "NUTRISPORT", "VAPER", "ARTICH Y GAFAS DE LECTURA",
  "DROGUERIA", "CONSUMIBLES", "CONGELADOS", "PROMOCIONES Y NOVEDADES",
  "ABONO", "DESCATALOGADOS", "GENERAL",
];

// ── Celda editable: número de fila (orden_excel) ──────────────────────────
function CeldaOrden({ value, disabled, onSave }) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editando) ref.current?.select(); }, [editando]);

  const commit = () => {
    setEditando(false);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n !== value) onSave(n);
    else setVal(value);
  };

  if (editando) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <input
          ref={ref}
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditando(false); setVal(value); }
          }}
          style={{ width: "44px", fontSize: "11px", padding: "1px 3px", border: "1px solid #00913f", borderRadius: "3px", background: "#e8f5e9", fontFamily: "var(--font-mono)" }}
        />
        <button onClick={commit} style={{ background: "none", border: "none", cursor: "pointer", padding: "0", color: "#00913f", display: "flex" }}>
          <Save size={10} />
        </button>
        <button onClick={() => { setEditando(false); setVal(value); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "0", color: "#aaa", display: "flex" }}>
          <X size={10} />
        </button>
      </span>
    );
  }

  return (
    <span
      title="Clic para cambiar la fila"
      onClick={() => !disabled && setEditando(true)}
      style={{
        fontSize: "10px", fontFamily: "var(--font-mono)", color: "#888",
        padding: "1px 3px", borderRadius: "3px", cursor: disabled ? "default" : "pointer",
        border: "1px dashed transparent", display: "inline-block",
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = "#a5d6a7"; e.currentTarget.style.color = "#2e7d32"; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#888"; }}
    >
      {value ?? "—"}
    </span>
  );
}

// ── Celda editable: columna visual (columna_excel) ────────────────────────
function CeldaColumna({ value, disabled, onSave }) {
  const [editando, setEditando] = useState(false);
  const ref = useRef();

  useEffect(() => { if (editando) ref.current?.focus(); }, [editando]);

  const commit = (nuevoVal) => {
    setEditando(false);
    const n = parseInt(nuevoVal, 10);
    if (!isNaN(n) && n !== value) onSave(n);
  };

  const LABELS = { 1: "A/B", 2: "D/E", 3: "G/H" };

  if (editando) {
    return (
      <select
        ref={ref}
        defaultValue={value}
        onChange={e => commit(e.target.value)}
        onBlur={() => setEditando(false)}
        style={{ fontSize: "10px", padding: "1px 2px", border: "1px solid #00913f", borderRadius: "3px", background: "#e8f5e9", color: "#1b5e20" }}
      >
        <option value={1}>Col 1 — A/B</option>
        <option value={2}>Col 2 — D/E</option>
        <option value={3}>Col 3 — G/H</option>
      </select>
    );
  }

  return (
    <span
      title="Clic para cambiar columna"
      onClick={() => !disabled && setEditando(true)}
      style={{
        fontSize: "10px", color: "#2e7d32", fontWeight: 500,
        padding: "1px 4px", borderRadius: "3px", cursor: disabled ? "default" : "pointer",
        border: "1px dashed transparent", display: "inline-block", background: "#f1f8e9",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = "#66bb6a"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; }}
    >
      {LABELS[value] || "?"}
    </span>
  );
}

// ── Panel de orden de hojas (drag & drop) ─────────────────────────────────
function PanelOrdenHojas({ hojasEnBD, ordenGuardado, onOrdenCambiado }) {
  const [lista, setLista] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const dragIdx = useRef(null);
  const [overIdx, setOverIdx] = useState(null);

  // Inicializar lista combinando orden guardado + hojas en BD no incluidas
  useEffect(() => {
    const ordenadas = [...ordenGuardado];
    for (const h of hojasEnBD) {
      if (!ordenadas.includes(h)) ordenadas.push(h);
    }
    // Quitar las que ya no existen en BD
    setLista(ordenadas.filter(h => hojasEnBD.includes(h)));
  }, [ordenGuardado, hojasEnBD]);

  const onDragStart = (idx) => { dragIdx.current = idx; };
  const onDragEnter = (idx) => setOverIdx(idx);
  const onDragEnd = () => {
    if (dragIdx.current !== null && overIdx !== null && dragIdx.current !== overIdx) {
      const nueva = [...lista];
      const [moved] = nueva.splice(dragIdx.current, 1);
      nueva.splice(overIdx, 0, moved);
      setLista(nueva);
    }
    dragIdx.current = null;
    setOverIdx(null);
  };

  const guardar = async () => {
    setGuardando(true);
    // Upsert todas las posiciones
    const rows = lista.map((nombre, i) => ({ nombre, posicion: i }));
    for (const row of rows) {
      await supabase.from("hojas_orden").upsert(row, { onConflict: "nombre" });
    }
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
    onOrdenCambiado(lista);
  };

  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: "16px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={16} style={{ color: "#00913f" }} />
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary)" }}>Orden de páginas del PDF</span>
          <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>— arrastra para reordenar</span>
        </div>
        <button
          onClick={guardar}
          disabled={guardando}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", border: "none", borderRadius: "var(--border-radius-md)",
            background: guardado ? "#e8f5e9" : "#00913f",
            color: guardado ? "#2e7d32" : "#fff",
            fontSize: "12px", fontWeight: 500, cursor: "pointer",
          }}
        >
          {guardando
            ? <Loader2 size={13} style={{ animation: "xspin 1s linear infinite" }} />
            : <Save size={13} />
          }
          {guardado ? "Guardado" : "Guardar orden"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {lista.map((nombre, idx) => (
          <div
            key={nombre}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 10px", borderRadius: "var(--border-radius-md)",
              border: overIdx === idx && dragIdx.current !== idx
                ? "1.5px solid #00913f"
                : "0.5px solid var(--color-border-secondary)",
              background: overIdx === idx && dragIdx.current !== idx
                ? "#e8f5e9"
                : "var(--color-background-secondary)",
              cursor: "grab", userSelect: "none",
              opacity: dragIdx.current === idx ? 0.4 : 1,
              fontSize: "12px", color: "var(--color-text-primary)",
            }}
          >
            <GripVertical size={12} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
            <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", minWidth: "16px" }}>{idx + 1}</span>
            <span>{nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ExcelSelogas() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [hojaAbierta, setHojaAbierta] = useState(null);
  const [cambios, setCambios] = useState(0);
  const [ordenHojas, setOrdenHojas] = useState(ORDEN_HOJAS_DEFAULT);
  const [tab, setTab] = useState("excel"); // "excel" | "orden"

  const cargar = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: orden }] = await Promise.all([
      supabase
        .from("productos")
        .select("id,codigo,nombre,hoja_excel,columna_excel,orden_excel,seccion_excel")
        .order("hoja_excel")
        .limit(3000),
      supabase
        .from("hojas_orden")
        .select("nombre,posicion")
        .order("posicion", { ascending: true }),
    ]);
    setProductos(prods || []);
    if (orden && orden.length > 0) {
      setOrdenHojas(orden.map(r => r.nombre));
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSave = useCallback(async (id, campo, nuevoValor) => {
    setGuardando(prev => ({ ...prev, [id]: true }));
    const { error } = await supabase
      .from("productos")
      .update({ [campo]: nuevoValor })
      .eq("id", id);
    if (!error) {
      setProductos(prev => prev.map(p => p.id === id ? { ...p, [campo]: nuevoValor } : p));
      setCambios(n => n + 1);
      try { Object.keys(localStorage).filter(k => k.startsWith("selogas_cat_")).forEach(k => localStorage.removeItem(k)); } catch {}
    } else {
      alert("Error al guardar: " + error.message);
    }
    setGuardando(prev => ({ ...prev, [id]: false }));
  }, []);

  // Hojas únicas que existen en BD
  const hojasEnBD = [...new Set(productos.map(p => p.hoja_excel).filter(Boolean))];

  // Agrupar productos por hoja → columna → orden
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

    for (const hoja of Object.values(mapaHojas))
      for (const col of [1, 2, 3])
        hoja[col].sort((a, b) => (a.orden_excel || 0) - (b.orden_excel || 0));

    // Usar el orden guardado, luego las hojas no incluidas al final
    const nombresOrdenados = [
      ...ordenHojas.filter(h => mapaHojas[h]),
      ...Object.keys(mapaHojas).filter(h => !ordenHojas.includes(h)).sort(),
    ];

    return nombresOrdenados.map(nombre => ({
      nombre,
      cols: mapaHojas[nombre],
      total: mapaHojas[nombre][1].length + mapaHojas[nombre][2].length + mapaHojas[nombre][3].length,
    }));
  })();

  return (
    <div style={{ maxWidth: "100%", fontFamily: "var(--font-sans)" }}>
      <style>{`
        @keyframes xspin { to { transform: rotate(360deg); } }
        .xt { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 12px; }
        .xt th { background: #e8f5e9; color: #2e7d32; font-weight: 500; font-size: 11px; padding: 5px 6px; border: 0.5px solid #c8e6c9; text-align: left; white-space: nowrap; overflow: hidden; }
        .xt td { padding: 3px 6px; border: 0.5px solid var(--color-border-tertiary); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .xt tr:nth-child(even) td { background: var(--color-background-secondary); }
        .xt tr:hover td { background: #f1f8e9; }
        .sep { border-left: 2px solid #a5d6a7 !important; }
        .cod { color: var(--color-text-secondary); font-family: var(--font-mono); font-size: 11px; }
        .nom { color: var(--color-text-primary); font-size: 12px; }
        .rn { color: var(--color-text-tertiary); font-size: 10px; font-family: var(--font-mono); text-align: right; background: var(--color-background-secondary) !important; border-right: 1px solid var(--color-border-secondary) !important; }
        .colh { background: #c8e6c9 !important; text-align: center !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Table2 size={22} style={{ color: "#00913f" }} />
            Excel Selogas
          </h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            {productos.length} productos · {hojasEnBD.length} hojas
            {cambios > 0 && (
              <span style={{ marginLeft: "10px", color: "#00913f", fontWeight: 500 }}>
                · {cambios} cambio{cambios !== 1 ? "s" : ""} guardado{cambios !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", fontSize: "13px", cursor: "pointer" }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "xspin 1s linear infinite" }} /> : <RefreshCw size={14} />}
          Recargar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "18px", background: "var(--color-background-secondary)", padding: "4px", borderRadius: "var(--border-radius-md)", width: "fit-content" }}>
        {[
          { id: "excel", label: "Vista Excel" },
          { id: "orden", label: "Orden de páginas PDF" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 16px", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
              background: tab === t.id ? "var(--color-background-primary)" : "transparent",
              color: tab === t.id ? "#00913f" : "var(--color-text-secondary)",
              fontWeight: tab === t.id ? 500 : 400,
              boxShadow: tab === t.id ? "0 0.5px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Orden de páginas ── */}
      {tab === "orden" && !loading && (
        <PanelOrdenHojas
          hojasEnBD={hojasEnBD}
          ordenGuardado={ordenHojas}
          onOrdenCambiado={setOrdenHojas}
        />
      )}

      {/* ── TAB: Vista Excel ── */}
      {tab === "excel" && (
        <>
          {/* Leyenda */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "12px", flexWrap: "wrap", fontSize: "11px", color: "var(--color-text-secondary)" }}>
            <span>💡 Clic en el <strong>número de fila</strong> (junto al código) → cambiar posición</span>
            <span>💡 Clic en <strong>A/B · D/E · G/H</strong> → mover a otra columna</span>
          </div>

          {/* Buscador */}
          <div style={{ position: "relative", marginBottom: "18px", maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
            <input
              type="text"
              placeholder="Buscar producto o código..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: "100%", paddingLeft: "32px", paddingRight: "12px", height: "34px", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", fontSize: "13px", background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
            />
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", color: "var(--color-text-secondary)" }}>
              <Loader2 size={28} style={{ animation: "xspin 1s linear infinite", marginRight: "10px" }} />
              Cargando...
            </div>
          ) : hojas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--color-text-tertiary)", fontSize: "14px" }}>
              No hay productos con datos de posición. Importa la plantilla primero.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {hojas.map(hoja => {
                const abierta = hojaAbierta === null || hojaAbierta === hoja.nombre;
                const maxRows = Math.max(hoja.cols[1].length, hoja.cols[2].length, hoja.cols[3].length);

                return (
                  <div key={hoja.nombre} style={{ border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden", background: "var(--color-background-primary)" }}>
                    {/* Tab de hoja */}
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

                    {abierta && (
                      <div style={{ overflowX: "auto" }}>
                        <table className="xt">
                          <colgroup>
                            <col style={{ width: "26px" }} />
                            <col style={{ width: "46px" }} />
                            <col style={{ width: "100px" }} />
                            <col style={{ width: "190px" }} />
                            <col style={{ width: "46px" }} />
                            <col style={{ width: "100px" }} />
                            <col style={{ width: "190px" }} />
                            <col style={{ width: "46px" }} />
                            <col style={{ width: "100px" }} />
                            <col style={{ width: "190px" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th style={{ background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)", textAlign: "center", fontSize: "10px" }}>#</th>
                              <th className="colh">Col</th>
                              <th>A — Código</th>
                              <th>B — Nombre</th>
                              <th className="colh sep">Col</th>
                              <th className="sep">D — Código</th>
                              <th>E — Nombre</th>
                              <th className="colh sep">Col</th>
                              <th className="sep">G — Código</th>
                              <th>H — Nombre</th>
                            </tr>
                          </thead>
                          <tbody>
                            {maxRows === 0 ? (
                              <tr>
                                <td colSpan={10} style={{ textAlign: "center", color: "var(--color-text-tertiary)", padding: "12px" }}>Sin productos</td>
                              </tr>
                            ) : (
                              Array.from({ length: maxRows }, (_, i) => {
                                const p1 = hoja.cols[1][i];
                                const p2 = hoja.cols[2][i];
                                const p3 = hoja.cols[3][i];
                                const filaRef = p1?.orden_excel ?? p2?.orden_excel ?? p3?.orden_excel ?? i;

                                return (
                                  <tr key={i}>
                                    <td className="rn">{filaRef}</td>

                                    <td style={{ background: "#f1f8e9", textAlign: "center" }}>
                                      {p1 && <CeldaColumna value={p1.columna_excel} disabled={!!guardando[p1.id]} onSave={v => handleSave(p1.id, "columna_excel", v)} />}
                                    </td>
                                    <td className="cod" style={{ opacity: guardando[p1?.id] ? 0.4 : 1 }}>
                                      {p1 && (
                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                          <span>{p1.codigo}</span>
                                          <CeldaOrden value={p1.orden_excel} disabled={!!guardando[p1.id]} onSave={v => handleSave(p1.id, "orden_excel", v)} />
                                        </span>
                                      )}
                                    </td>
                                    <td className="nom">{p1?.nombre || ""}</td>

                                    <td className="sep" style={{ background: "#f1f8e9", textAlign: "center" }}>
                                      {p2 && <CeldaColumna value={p2.columna_excel} disabled={!!guardando[p2.id]} onSave={v => handleSave(p2.id, "columna_excel", v)} />}
                                    </td>
                                    <td className="cod sep" style={{ opacity: guardando[p2?.id] ? 0.4 : 1 }}>
                                      {p2 && (
                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                          <span>{p2.codigo}</span>
                                          <CeldaOrden value={p2.orden_excel} disabled={!!guardando[p2.id]} onSave={v => handleSave(p2.id, "orden_excel", v)} />
                                        </span>
                                      )}
                                    </td>
                                    <td className="nom">{p2?.nombre || ""}</td>

                                    <td className="sep" style={{ background: "#f1f8e9", textAlign: "center" }}>
                                      {p3 && <CeldaColumna value={p3.columna_excel} disabled={!!guardando[p3.id]} onSave={v => handleSave(p3.id, "columna_excel", v)} />}
                                    </td>
                                    <td className="cod sep" style={{ opacity: guardando[p3?.id] ? 0.4 : 1 }}>
                                      {p3 && (
                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                          <span>{p3.codigo}</span>
                                          <CeldaOrden value={p3.orden_excel} disabled={!!guardando[p3.id]} onSave={v => handleSave(p3.id, "orden_excel", v)} />
                                        </span>
                                      )}
                                    </td>
                                    <td className="nom">{p3?.nombre || ""}</td>
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
        </>
      )}
    </div>
  );
}
