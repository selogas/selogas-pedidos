import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table2, Save, Plus, Trash2, Loader2, Check, Download, Send,
  FileText, RefreshCw, Search, ChevronUp, ChevronDown, Mail
} from "lucide-react";

const COLUMNAS = [
  { key: "codigo",      label: "Código",      width: 100, editable: true },
  { key: "referencia",  label: "Referencia",  width: 100, editable: true },
  { key: "nombre",      label: "Nombre",      width: 260, editable: true },
  { key: "descripcion", label: "Descripción", width: 180, editable: true },
  { key: "formato",     label: "Formato",     width: 110, editable: true },
  { key: "precio",      label: "Precio",      width: 80,  editable: true, type: "number" },
  { key: "unidad_medida", label: "Unidad",    width: 80,  editable: true },
  { key: "hoja_excel",  label: "Hoja",        width: 120, editable: true },
  { key: "seccion_excel", label: "Sección",   width: 130, editable: true },
  { key: "orden_excel", label: "Orden",       width: 70,  editable: true, type: "number" },
];

function celda(prod, key) {
  const v = prod[key];
  if (v === null || v === undefined) return "";
  return v;
}

function EditCell({ value, type = "text", onCommit, onNav }) {
  const [val, setVal] = useState(value === null || value === undefined ? "" : String(value));
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => onCommit(type === "number" ? (val === "" ? null : Number(val)) : val);

  return (
    <input
      ref={ref}
      type={type === "number" ? "number" : "text"}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") { commit(); onNav("down"); }
        else if (e.key === "Tab") { e.preventDefault(); commit(); onNav(e.shiftKey ? "left" : "right"); }
        else if (e.key === "Escape") { onNav("escape"); }
      }}
      className="w-full h-full border-0 outline-none bg-blue-50 px-2 text-xs font-mono"
      style={{ minWidth: 0 }}
    />
  );
}

export default function ExcelSelogas() {
  const [productos, setProductos] = useState([]);
  const [modificados, setModificados] = useState({}); // id -> {campo: valor}
  const [nuevos, setNuevos] = useState([]); // filas temporales con _tempId
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [celActiva, setCelActiva] = useState(null); // {rowId, col}
  const [busqueda, setBusqueda] = useState("");
  const [filtrando, setFiltrando] = useState(false);
  const [sortCol, setSortCol] = useState("orden_excel");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const containerRef = useRef();

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("productos")
      .select("id,codigo,referencia,nombre,descripcion,formato,precio,unidad_medida,hoja_excel,seccion_excel,orden_excel,activo")
      .order("orden_excel", { ascending: true })
      .limit(2000);
    setProductos(data || []);
    setModificados({});
    setNuevos([]);
    setSelectedRows(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const getValor = (id, key, original) => {
    if (modificados[id] && modificados[id][key] !== undefined) return modificados[id][key];
    return original;
  };

  const handleEdit = (id, key, valor) => {
    setModificados(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: valor }
    }));
    setCelActiva(null);
  };

  const handleEditNuevo = (tempId, key, valor) => {
    setNuevos(prev => prev.map(n => n._tempId === tempId ? { ...n, [key]: valor } : n));
    setCelActiva(null);
  };

  const addFila = () => {
    const tempId = "_new_" + Date.now();
    setNuevos(prev => [...prev, { _tempId: tempId, nombre: "", codigo: "", precio: 0, orden_excel: 0, activo: true }]);
    setTimeout(() => setCelActiva({ rowId: tempId, col: 0 }), 50);
  };

  const eliminarNuevo = (tempId) => {
    setNuevos(prev => prev.filter(n => n._tempId !== tempId));
  };

  const eliminarSeleccionados = async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedRows.size} producto(s)? Esta acción no se puede deshacer.`)) return;
    const ids = [...selectedRows].filter(id => !id.startsWith("_new_"));
    if (ids.length > 0) {
      await supabase.from("productos").delete().in("id", ids);
    }
    setNuevos(prev => prev.filter(n => !selectedRows.has(n._tempId)));
    setSelectedRows(new Set());
    cargar();
  };

  const guardarTodo = async () => {
    setGuardando(true);
    // Actualizar modificados
    const updates = Object.entries(modificados);
    for (const [id, cambios] of updates) {
      await supabase.from("productos").update(cambios).eq("id", id);
    }
    // Insertar nuevos (solo los que tienen nombre)
    const paraInsertar = nuevos.filter(n => n.nombre?.trim()).map(({ _tempId, ...rest }) => rest);
    if (paraInsertar.length > 0) {
      await supabase.from("productos").insert(paraInsertar);
    }
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
    cargar();
  };

  const generarYEnviarPDF = async () => {
    setEnviando(true);
    try {
      // Obtener email almacén
      const { data: cfg } = await supabase.from("configuracion").select("valor").eq("clave", "email_almacen").single();
      const emailAlmacen = cfg?.valor?.trim();
      if (!emailAlmacen) { alert("Configura primero el email del almacén en Configuración."); setEnviando(false); return; }

      // Preparar todos los productos actuales (con cambios guardados)
      const todosProds = productos.map(p => ({
        ...p,
        ...((modificados[p.id]) || {})
      }));

      await supabase.functions.invoke("send-email", {
        body: {
          to: emailAlmacen,
          subject: "Catálogo SELOGAS — " + new Date().toLocaleDateString("es-ES"),
          tienda_nombre: "SELOGAS",
          numero_pedido: "CATALOGO-" + new Date().toISOString().slice(0, 10),
          fecha: new Date().toISOString(),
          lineas: [],
          todos_productos: todosProds,
          es_catalogo: true,
        }
      });
      alert("✅ PDF del catálogo enviado a " + emailAlmacen);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setEnviando(false);
  };

  const navCell = (rowId, colIdx, dir) => {
    const isNew = String(rowId).startsWith("_new_");
    const allRows = [
      ...productos.filter(p => pasaFiltro(p)).sort(sortFn).map(p => p.id),
      ...nuevos.map(n => n._tempId)
    ];
    const rIdx = allRows.indexOf(rowId);
    if (dir === "down") setCelActiva({ rowId: allRows[Math.min(rIdx + 1, allRows.length - 1)], col: colIdx });
    else if (dir === "up") setCelActiva({ rowId: allRows[Math.max(rIdx - 1, 0)], col: colIdx });
    else if (dir === "right") setCelActiva({ rowId, col: Math.min(colIdx + 1, COLUMNAS.length - 1) });
    else if (dir === "left") setCelActiva({ rowId, col: Math.max(colIdx - 1, 0) });
    else setCelActiva(null);
  };

  const pasaFiltro = (p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (p.nombre || "").toLowerCase().includes(q)
      || (p.codigo || "").toLowerCase().includes(q)
      || (p.referencia || "").toLowerCase().includes(q)
      || (p.hoja_excel || "").toLowerCase().includes(q);
  };

  const sortFn = (a, b) => {
    const va = a[sortCol] ?? "";
    const vb = b[sortCol] ?? "";
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  };

  const toggleSort = (key) => {
    if (sortCol === key) setSortAsc(a => !a);
    else { setSortCol(key); setSortAsc(true); }
  };

  const prodsFiltrados = productos.filter(pasaFiltro).sort(sortFn);
  const hayModificaciones = Object.keys(modificados).length > 0 || nuevos.some(n => n.nombre?.trim());

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Table2 size={24} className="text-[#00913f]" /> Excel Selogas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Catálogo maestro de productos · {productos.length} productos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={cargar} className="flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm hover:bg-gray-50" title="Recargar">
            <RefreshCw size={14} /> Recargar
          </button>
          <button onClick={generarYEnviarPDF} disabled={enviando}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#00913f] text-[#00913f] rounded-xl text-sm hover:bg-[#edf7f2] font-medium disabled:opacity-50">
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {enviando ? "Enviando..." : "Enviar PDF al almacén"}
          </button>
          <button onClick={guardarTodo} disabled={!hayModificaciones || guardando}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${guardado ? "bg-green-500" : "bg-[#00913f] hover:bg-[#007a34]"}`}>
            {guardando ? <Loader2 size={14} className="animate-spin" /> : guardado ? <Check size={14} /> : <Save size={14} />}
            {guardado ? "Guardado" : guardando ? "Guardando..." : `Guardar${hayModificaciones ? " *" : ""}`}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar producto..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-8 pr-4 py-2 border rounded-xl text-sm w-56 focus:outline-none focus:border-[#00913f]" />
        </div>
        <button onClick={addFila}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#00913f] text-white rounded-xl text-sm font-medium hover:bg-[#007a34]">
          <Plus size={14} /> Añadir fila
        </button>
        {selectedRows.size > 0 && (
          <button onClick={eliminarSeleccionados}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100">
            <Trash2 size={14} /> Eliminar {selectedRows.size} seleccionado(s)
          </button>
        )}
        {hayModificaciones && (
          <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg">
            ⚠ Cambios sin guardar
          </span>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#00a847]" /></div>
      ) : (
        <div ref={containerRef} className="overflow-auto border border-gray-200 rounded-2xl" style={{ maxHeight: "calc(100vh - 260px)" }}>
          <table className="border-collapse text-xs" style={{ minWidth: COLUMNAS.reduce((s, c) => s + c.width, 0) + 80 }}>
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 w-8 px-2 py-2">
                  <input type="checkbox"
                    checked={selectedRows.size === prodsFiltrados.length + nuevos.length && prodsFiltrados.length + nuevos.length > 0}
                    onChange={e => {
                      if (e.target.checked) setSelectedRows(new Set([...prodsFiltrados.map(p => p.id), ...nuevos.map(n => n._tempId)]));
                      else setSelectedRows(new Set());
                    }}
                    className="accent-[#00913f]" />
                </th>
                {COLUMNAS.map((col, ci) => (
                  <th key={col.key}
                    className="border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    style={{ minWidth: col.width }}
                    onClick={() => toggleSort(col.key)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <span className="w-3" />}
                    </div>
                  </th>
                ))}
                <th className="border-b border-gray-200 px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {prodsFiltrados.map((prod, ri) => (
                <tr key={prod.id}
                  className={`${selectedRows.has(prod.id) ? "bg-blue-50" : ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/40`}>
                  <td className="sticky left-0 border-b border-r border-gray-100 px-2 py-0.5"
                    style={{ background: selectedRows.has(prod.id) ? "#eff6ff" : ri % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <input type="checkbox" checked={selectedRows.has(prod.id)}
                      onChange={e => {
                        setSelectedRows(prev => { const n = new Set(prev); e.target.checked ? n.add(prod.id) : n.delete(prod.id); return n; });
                      }}
                      className="accent-[#00913f]" />
                  </td>
                  {COLUMNAS.map((col, ci) => {
                    const isEditing = celActiva?.rowId === prod.id && celActiva?.col === ci;
                    const val = getValor(prod.id, col.key, celda(prod, col.key));
                    const hasChange = modificados[prod.id]?.[col.key] !== undefined;
                    return (
                      <td key={col.key}
                        className={`border-b border-r border-gray-100 p-0 h-7 cursor-text ${isEditing ? "ring-2 ring-inset ring-blue-400" : hasChange ? "bg-yellow-50" : ""}`}
                        style={{ minWidth: col.width }}
                        onClick={() => setCelActiva({ rowId: prod.id, col: ci })}>
                        {isEditing ? (
                          <EditCell value={val} type={col.type}
                            onCommit={v => handleEdit(prod.id, col.key, v)}
                            onNav={dir => navCell(prod.id, ci, dir)} />
                        ) : (
                          <div className="px-2 py-0.5 font-mono overflow-hidden whitespace-nowrap text-ellipsis" style={{ maxWidth: col.width }}>
                            {val === "" || val === null ? <span className="text-gray-300">—</span> : String(val)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-gray-100 px-1 py-0.5 text-center">
                    <button onClick={() => {
                      setSelectedRows(prev => { const n = new Set(prev); n.add(prod.id); return n; });
                      setTimeout(() => eliminarSeleccionados(), 0);
                    }}
                      className="text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Filas nuevas */}
              {nuevos.map((fila, ri) => (
                <tr key={fila._tempId} className="bg-green-50">
                  <td className="sticky left-0 border-b border-r border-gray-100 px-2 py-0.5 bg-green-50">
                    <input type="checkbox" checked={selectedRows.has(fila._tempId)}
                      onChange={e => {
                        setSelectedRows(prev => { const n = new Set(prev); e.target.checked ? n.add(fila._tempId) : n.delete(fila._tempId); return n; });
                      }}
                      className="accent-[#00913f]" />
                  </td>
                  {COLUMNAS.map((col, ci) => {
                    const isEditing = celActiva?.rowId === fila._tempId && celActiva?.col === ci;
                    const val = fila[col.key] ?? "";
                    return (
                      <td key={col.key}
                        className={`border-b border-r border-gray-100 p-0 h-7 cursor-text ${isEditing ? "ring-2 ring-inset ring-green-400" : ""}`}
                        style={{ minWidth: col.width }}
                        onClick={() => setCelActiva({ rowId: fila._tempId, col: ci })}>
                        {isEditing ? (
                          <EditCell value={val} type={col.type}
                            onCommit={v => handleEditNuevo(fila._tempId, col.key, v)}
                            onNav={dir => navCell(fila._tempId, ci, dir)} />
                        ) : (
                          <div className="px-2 py-0.5 font-mono overflow-hidden whitespace-nowrap text-ellipsis" style={{ maxWidth: col.width }}>
                            {val === "" || val === null ? <span className="text-gray-200">nueva fila</span> : String(val)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-gray-100 px-1 py-0.5 text-center">
                    <button onClick={() => eliminarNuevo(fila._tempId)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Fila añadir */}
              <tr>
                <td colSpan={COLUMNAS.length + 2} className="py-2 px-3">
                  <button onClick={addFila}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00913f] transition-colors">
                    <Plus size={13} /> Añadir fila
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 flex gap-4">
        <span>💡 Haz clic en una celda para editar · Enter para bajar · Tab para avanzar</span>
        <span className="text-yellow-600">■ Amarillo = cambio pendiente de guardar</span>
        <span className="text-green-600">■ Verde = fila nueva</span>
      </div>
    </div>
  );
}
