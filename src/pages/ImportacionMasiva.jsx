import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  Loader2, X, ChevronDown, ChevronRight, Check, Edit2,
  ClipboardList, Layers, RefreshCw, Search,
} from 'lucide-react';

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Resta N días laborables (ignora sábado y domingo) */
function restarDiasLaborables(fecha, dias = 2) {
  const d = new Date(fecha);
  let restados = 0;
  while (restados < dias) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) restados++; // 0=dom, 6=sab
  }
  return d.toISOString().split('T')[0];
}

/** Extrae DD y MM del nombre de archivo. Ej: ARENAS_13-05.xlsx → {dia:13, mes:5} */
function extraerFechaDeNombre(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(/[_\s-](\d{1,2})[_\s-](\d{2})(?:[_\s-]\d{2,4})?/);
  if (match) {
    const dia = parseInt(match[1]);
    const mes = parseInt(match[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      const año = new Date().getFullYear();
      return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return null;
}

/** Detecta tienda por similitud de tokens entre nombre de archivo y nombre de tienda */
function detectarTienda(filename, tiendas) {
  const base = filename.replace(/\.[^.]+$/, '').toUpperCase();
  // Tomar la parte antes del primer separador numérico como nombre
  const nombreParte = base.split(/[_\s]\d/)[0].replace(/[_-]/g, ' ').trim();
  const palabrasArch = new Set(nombreParte.split(/\s+/).filter(p => p.length >= 3));

  let mejorScore = 0;
  let mejorTienda = null;

  for (const t of tiendas) {
    if (t.nombre === 'PRINCIPAL') continue;
    const palabrasTienda = new Set(t.nombre.toUpperCase().split(/\s+/));
    const interseccion = [...palabrasArch].filter(p => palabrasTienda.has(p));
    if (interseccion.length > 0) {
      const score = interseccion.length / Math.max(palabrasArch.size, 1)
        + interseccion.reduce((s, p) => s + p.length, 0) * 0.05;
      if (score > mejorScore) { mejorScore = score; mejorTienda = t; }
    }
  }
  // Umbral mínimo: al menos score 0.5
  return mejorScore >= 0.5 ? mejorTienda : null;
}

/** Parsea un archivo Excel y devuelve líneas {codigo, cantidad_servida, descripcion} */
function parsearExcel(buffer) {
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerIdx = -1, colCodigo = -1, colUnidades = -1, colDesc = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(v => String(v || '').toLowerCase().trim());
    const artIdx  = row.findIndex(c => c.includes('artículo') || c.includes('articulo') || c === 'código' || c === 'codigo');
    const unidIdx = row.findIndex(c => c.includes('unidades') || c.includes('cantidad') || c.includes('uds'));
    const descIdx = row.findIndex(c => c.includes('descripción') || c.includes('descripcion') || c.includes('nombre'));
    if (artIdx >= 0 && unidIdx >= 0) {
      headerIdx = i; colCodigo = artIdx; colUnidades = unidIdx; colDesc = descIdx; break;
    }
  }
  if (headerIdx < 0) { headerIdx = 0; colCodigo = 1; colUnidades = 2; colDesc = 3; }

  const lineas = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const cod = row[colCodigo] != null ? String(row[colCodigo]).trim().replace(/\.0+$/, '') : null;
    const uds = row[colUnidades];
    const desc = colDesc >= 0 && row[colDesc] ? String(row[colDesc]).trim() : '';
    if (!cod || !uds || isNaN(Number(uds))) continue;
    lineas.push({ codigo: cod, cantidad_servida: parseInt(uds), descripcion: desc });
  }
  return lineas;
}

/** Calcula tipo de diferencia */
function calcTipo(pedida, servida) {
  if (pedida == null) return 'no_pedido';
  if (servida === 0)    return 'no_servido';
  if (servida < pedida) return 'parcial';
  if (servida > pedida) return 'exceso';
  return 'ok';
}

// ─── Constantes visuales ──────────────────────────────────────────────────────
const CONFIANZA = {
  correcto:     { label: 'Correcto',      color: 'bg-green-100 text-green-800 border-green-300',   icon: CheckCircle,    dot: 'bg-green-500' },
  ambiguo:      { label: 'Ambiguo',       color: 'bg-amber-100 text-amber-800 border-amber-300',   icon: AlertTriangle,  dot: 'bg-amber-500' },
  no_encontrado:{ label: 'Sin pedido',    color: 'bg-gray-100 text-gray-600 border-gray-300',      icon: XCircle,        dot: 'bg-gray-400' },
  sin_tienda:   { label: 'Sin tienda',    color: 'bg-red-100 text-red-700 border-red-300',         icon: XCircle,        dot: 'bg-red-500' },
  error:        { label: 'Error',         color: 'bg-red-100 text-red-700 border-red-300',         icon: XCircle,        dot: 'bg-red-500' },
};

// ─── Modal de corrección manual ───────────────────────────────────────────────
function ModalCorreccion({ item, tiendas, onSave, onClose }) {
  const [tiendaId, setTiendaId] = useState(item.tienda?.id || '');
  const [pedidoId, setPedidoId] = useState(item.pedidosSugeridos?.[0]?.id || '');
  const [pedidosTienda, setPedidosTienda] = useState(item.pedidosSugeridos || []);
  const [cargandoPed, setCargandoPed] = useState(false);

  const cambiarTienda = async (tid) => {
    setTiendaId(tid);
    setPedidoId('');
    if (!tid) return;
    setCargandoPed(true);
    const { data } = await supabase.from('pedidos')
      .select('id, numero_pedido, fecha_pedido, total_lineas')
      .eq('tienda_id', tid)
      .order('fecha_pedido', { ascending: false })
      .limit(20);
    setPedidosTienda(data || []);
    setCargandoPed(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Edit2 size={16} className="text-amber-500" /> Corregir asignación
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4 font-mono bg-gray-50 rounded-lg p-2">{item.filename}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Tienda</label>
            <select value={tiendaId} onChange={e => cambiarTienda(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">— Sin asignar —</option>
              {tiendas.filter(t => t.nombre !== 'PRINCIPAL').map(t =>
                <option key={t.id} value={t.id}>{t.nombre}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Pedido a conciliar
              <span className="ml-2 text-xs text-gray-400 font-normal">(opcional — sin pedido todas las líneas serán "no pedido")</span>
            </label>
            {cargandoPed ? (
              <div className="flex items-center gap-2 p-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Cargando...</div>
            ) : (
              <div className="border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b hover:bg-gray-50 ${!pedidoId ? 'bg-blue-50' : ''}`}>
                  <input type="radio" checked={!pedidoId} onChange={() => setPedidoId('')} />
                  <span className="text-gray-500 italic">Sin vincular a pedido</span>
                </label>
                {pedidosTienda.map(p => (
                  <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b last:border-0 hover:bg-gray-50 ${pedidoId === p.id ? 'bg-[#edf7f2]' : ''}`}>
                    <input type="radio" checked={pedidoId === p.id} onChange={() => setPedidoId(p.id)} />
                    <div>
                      <span className="font-semibold">{p.numero_pedido}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {new Date(p.fecha_pedido).toLocaleDateString('es-ES')} · {p.total_lineas} líneas
                      </span>
                    </div>
                  </label>
                ))}
                {pedidosTienda.length === 0 && tiendaId && (
                  <p className="px-3 py-2 text-sm text-gray-400">No hay pedidos para esta tienda</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm font-medium">Cancelar</button>
          <button onClick={() => onSave({ tiendaId, pedidoId: pedidoId || null })}
            disabled={!tiendaId}
            className="flex-1 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-50">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente fila de resultado ─────────────────────────────────────────────
function FilaResultado({ item, tiendas, onCorregir, onToggleExcluir }) {
  const [expandida, setExpandida] = useState(false);
  const cfg = CONFIANZA[item.confianza] || CONFIANZA.error;
  const Icon = cfg.icon;
  const incidencias = item.lineas?.filter(l => l.tipo_diferencia !== 'ok').length ?? 0;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${item.excluido ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox selección */}
        <input type="checkbox" checked={!item.excluido} onChange={() => onToggleExcluir(item.filename)}
          className="flex-shrink-0 w-4 h-4 rounded" title="Incluir en la importación masiva" />

        {/* Estado */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>

        {/* Nombre archivo */}
        <span className="font-mono text-xs text-gray-600 flex-shrink-0 hidden sm:block">{item.filename}</span>

        {/* Tienda */}
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
          {item.tienda?.nombre || <span className="text-red-500 italic">Sin tienda</span>}
        </span>

        {/* Pedido sugerido */}
        <span className="text-xs text-gray-500 flex-shrink-0 hidden md:block">
          {item.pedidoFinal
            ? item.pedidoFinal.numero_pedido
            : <span className="text-gray-300">— sin pedido</span>}
        </span>

        {/* Fecha albarán */}
        <span className="text-xs text-gray-400 flex-shrink-0">
          {item.fechaAlbaran
            ? new Date(item.fechaAlbaran).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            : '—'}
        </span>

        {/* Incidencias */}
        {incidencias > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
            {incidencias} incid.
          </span>
        )}

        {/* Lineas */}
        <span className="text-xs text-gray-400 flex-shrink-0">{item.lineas?.length ?? 0} lín.</span>

        {/* Botones */}
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onCorregir(item)}
            className="p-1.5 border rounded-lg text-amber-600 hover:bg-amber-50" title="Corregir manualmente">
            <Edit2 size={13} />
          </button>
          {item.lineas?.length > 0 && (
            <button onClick={() => setExpandida(!expandida)}
              className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50" title="Ver líneas">
              {expandida ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Detalle de líneas */}
      {expandida && item.lineas?.length > 0 && (
        <div className="border-t bg-gray-50 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 font-semibold text-gray-600">Código</th>
                <th className="text-left px-3 py-1.5 font-semibold text-gray-600">Descripción</th>
                <th className="text-center px-3 py-1.5 font-semibold text-gray-600">Pedido</th>
                <th className="text-center px-3 py-1.5 font-semibold text-gray-600">Servido</th>
                <th className="text-left px-3 py-1.5 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {item.lineas.map((l, i) => (
                <tr key={i} className={l.tipo_diferencia !== 'ok' ? 'bg-amber-50/40' : ''}>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{l.codigo_producto}</td>
                  <td className="px-3 py-1.5 text-gray-700 truncate max-w-[180px]">{l.descripcion || '—'}</td>
                  <td className="px-3 py-1.5 text-center">{l.cantidad_pedida ?? '—'}</td>
                  <td className="px-3 py-1.5 text-center font-bold">{l.cantidad_servida}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      l.tipo_diferencia === 'ok'         ? 'bg-green-100 text-green-700' :
                      l.tipo_diferencia === 'no_servido' ? 'bg-red-100 text-red-700' :
                      l.tipo_diferencia === 'parcial'    ? 'bg-amber-100 text-amber-700' :
                      l.tipo_diferencia === 'exceso'     ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>{l.tipo_diferencia.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ImportacionMasiva() {
  const { perfil } = useAuth();
  const [tiendas, setTiendas]         = useState([]);
  const [tiendassLoaded, setTiendaLoaded] = useState(false);
  const [items, setItems]             = useState([]); // resultados procesados
  const [procesando, setProcesando]   = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [progreso, setProgreso]       = useState('');
  const [importado, setImportado]     = useState(false);
  const [corrgiendoItem, setCorrigiendoItem] = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const fileRef                       = useRef();

  // Cargar tiendas al montar
  const cargarTiendas = async () => {
    if (tiendassLoaded) return tiendas;
    const { data } = await supabase.from('tiendas').select('id, nombre').eq('activa', true).order('nombre');
    const lista = data || [];
    setTiendas(lista);
    setTiendaLoaded(true);
    return lista;
  };

  // Procesar un archivo: parsear + detectar tienda + buscar pedido
  const procesarArchivo = async (file, listaTiendas) => {
    const item = {
      filename: file.name,
      tienda: null,
      fechaAlbaran: null,
      pedidosSugeridos: [],
      pedidoFinal: null,
      confianza: 'error',
      lineas: [],
      excluido: false,
      error: null,
    };

    try {
      // 1. Parsear Excel
      const buffer = await file.arrayBuffer();
      const lineasRaw = parsearExcel(buffer);
      if (!lineasRaw.length) throw new Error('No se encontraron líneas con código y cantidad');

      // 2. Detectar tienda
      const tienda = detectarTienda(file.name, listaTiendas);
      item.tienda = tienda;

      // 3. Extraer fecha del nombre de archivo
      const fechaEntrega = extraerFechaDeNombre(file.name);
      item.fechaAlbaran = fechaEntrega;

      if (!tienda) {
        item.confianza = 'sin_tienda';
        item.lineas = lineasRaw.map(l => ({ ...l, codigo_producto: l.codigo, cantidad_pedida: null, tipo_diferencia: 'no_pedido' }));
        return item;
      }

      // 4. Calcular fecha de pedido (48h laborables antes)
      let pedidosSugeridos = [];
      if (fechaEntrega) {
        const fechaPedidoCalc = restarDiasLaborables(fechaEntrega, 2);
        const dDesde = new Date(fechaPedidoCalc); dDesde.setDate(dDesde.getDate() - 1);
        const dHasta = new Date(fechaPedidoCalc); dHasta.setDate(dHasta.getDate() + 1);

        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('id, numero_pedido, fecha_pedido, total_lineas')
          .eq('tienda_id', tienda.id)
          .gte('fecha_pedido', dDesde.toISOString())
          .lte('fecha_pedido', dHasta.toISOString())
          .order('fecha_pedido', { ascending: false });

        pedidosSugeridos = pedidos || [];
      } else {
        // Sin fecha en el nombre: traer últimos 5 pedidos
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('id, numero_pedido, fecha_pedido, total_lineas')
          .eq('tienda_id', tienda.id)
          .order('fecha_pedido', { ascending: false })
          .limit(5);
        pedidosSugeridos = pedidos || [];
      }

      item.pedidosSugeridos = pedidosSugeridos;

      // 5. Determinar confianza
      if (pedidosSugeridos.length === 0) {
        item.confianza = 'no_encontrado';
        item.pedidoFinal = null;
      } else if (pedidosSugeridos.length === 1) {
        item.confianza = 'correcto';
        item.pedidoFinal = pedidosSugeridos[0];
      } else {
        item.confianza = 'ambiguo';
        item.pedidoFinal = pedidosSugeridos[0]; // preselecciona el más reciente
      }

      // 6. Cruzar con el pedido final (si existe)
      const mapaPedido = {};
      if (item.pedidoFinal) {
        const { data: pedItems } = await supabase
          .from('pedido_items')
          .select('producto_codigo, cantidad')
          .eq('pedido_id', item.pedidoFinal.id);
        (pedItems || []).forEach(pi => {
          const cod = (pi.producto_codigo || '').trim();
          if (cod) mapaPedido[cod] = (mapaPedido[cod] || 0) + pi.cantidad;
        });
      }

      // Líneas del albarán cruzadas
      const lineasConDif = lineasRaw.map(l => ({
        codigo_producto:  l.codigo,
        descripcion:      l.descripcion,
        cantidad_servida: l.cantidad_servida,
        cantidad_pedida:  mapaPedido[l.codigo] ?? null,
        tipo_diferencia:  calcTipo(mapaPedido[l.codigo] ?? null, l.cantidad_servida),
      }));
      // Productos pedidos pero no en albarán → no_servido
      Object.entries(mapaPedido).forEach(([cod, qty]) => {
        if (!lineasRaw.some(l => l.codigo === cod)) {
          lineasConDif.push({ codigo_producto: cod, descripcion: '', cantidad_servida: 0, cantidad_pedida: qty, tipo_diferencia: 'no_servido' });
        }
      });
      item.lineas = lineasConDif;

    } catch (e) {
      item.confianza = 'error';
      item.error = e.message;
    }

    return item;
  };

  // Procesar lista de archivos
  const procesarArchivos = async (files) => {
    const lista = Array.from(files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!lista.length) return;

    setProcesando(true);
    setProgreso('Cargando tiendas...');
    setImportado(false);
    const listaTiendas = await cargarTiendas();

    const resultados = [];
    for (let i = 0; i < lista.length; i++) {
      setProgreso(`Procesando ${i + 1}/${lista.length}: ${lista[i].name}`);
      const item = await procesarArchivo(lista[i], listaTiendas);
      resultados.push(item);
    }

    setItems(resultados);
    setProcesando(false);
    setProgreso('');
  };

  const handleFiles = useCallback(async (files) => {
    await procesarArchivos(files);
  }, [tiendas, tiendassLoaded]);

  // Drag & Drop
  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Corrección manual
  const handleCorreccion = async ({ tiendaId, pedidoId }) => {
    const item = corrgiendoItem;
    if (!item) return;

    const tiendaObj = tiendas.find(t => t.id === tiendaId);
    let pedidoFinal = null;
    const mapaPedido = {};

    if (pedidoId) {
      // Recargar datos del pedido seleccionado
      const { data: ped } = await supabase.from('pedidos')
        .select('id, numero_pedido, fecha_pedido, total_lineas').eq('id', pedidoId).single();
      pedidoFinal = ped;

      const { data: pedItems } = await supabase.from('pedido_items')
        .select('producto_codigo, cantidad').eq('pedido_id', pedidoId);
      (pedItems || []).forEach(pi => {
        const cod = (pi.producto_codigo || '').trim();
        if (cod) mapaPedido[cod] = (mapaPedido[cod] || 0) + pi.cantidad;
      });
    }

    // Recalcular líneas
    const lineasBase = item.lineas
      .filter(l => l.cantidad_servida > 0)
      .map(l => ({ codigo: l.codigo_producto, cantidad_servida: l.cantidad_servida, descripcion: l.descripcion }));

    const lineasConDif = lineasBase.map(l => ({
      codigo_producto: l.codigo, descripcion: l.descripcion,
      cantidad_servida: l.cantidad_servida,
      cantidad_pedida: mapaPedido[l.codigo] ?? null,
      tipo_diferencia: calcTipo(mapaPedido[l.codigo] ?? null, l.cantidad_servida),
    }));
    Object.entries(mapaPedido).forEach(([cod, qty]) => {
      if (!lineasBase.some(l => l.codigo === cod)) {
        lineasConDif.push({ codigo_producto: cod, descripcion: '', cantidad_servida: 0, cantidad_pedida: qty, tipo_diferencia: 'no_servido' });
      }
    });

    setItems(prev => prev.map(it =>
      it.filename === item.filename ? {
        ...it,
        tienda: tiendaObj,
        pedidoFinal,
        pedidosSugeridos: pedidoFinal ? [pedidoFinal] : [],
        confianza: !tiendaObj ? 'sin_tienda' : !pedidoFinal ? 'no_encontrado' : 'correcto',
        lineas: lineasConDif,
      } : it
    ));
    setCorrigiendoItem(null);
  };

  // Guardar todos los no excluidos
  const handleGuardar = async () => {
    const aGuardar = items.filter(it => !it.excluido && it.tienda && it.lineas?.length > 0);
    if (!aGuardar.length) return;

    setGuardando(true);
    let ok = 0, errores = 0;

    for (const item of aGuardar) {
      try {
        const { data: alb, error: errAlb } = await supabase.from('albaranes').insert([{
          tienda_id:      item.tienda.id,
          tienda_nombre:  item.tienda.nombre,
          numero_albaran: item.filename.replace(/\.[^.]+$/, ''),
          fecha_albaran:  item.fechaAlbaran || new Date().toISOString().split('T')[0],
          total_lineas:   item.lineas.length,
          subido_por:     perfil?.id || null,
          notas:          item.confianza === 'ambiguo' ? 'Pedido asignado automáticamente (ambiguo)' : '',
        }]).select().single();
        if (errAlb) throw errAlb;

        for (let i = 0; i < item.lineas.length; i += 100) {
          const lote = item.lineas.slice(i, i + 100).map(l => ({ ...l, albaran_id: alb.id }));
          const { error: errL } = await supabase.from('albaran_lineas').insert(lote);
          if (errL) throw errL;
        }
        ok++;
      } catch { errores++; }
    }

    setGuardando(false);
    setImportado(true);
    setProgreso(`✓ ${ok} albaranes guardados${errores > 0 ? ` · ${errores} errores` : ''}`);
  };

  // Estadísticas resumen
  const stats = {
    total:         items.length,
    correctos:     items.filter(it => it.confianza === 'correcto' && !it.excluido).length,
    ambiguos:      items.filter(it => it.confianza === 'ambiguo'  && !it.excluido).length,
    noEncontrados: items.filter(it => (it.confianza === 'no_encontrado' || it.confianza === 'sin_tienda') && !it.excluido).length,
    excluidos:     items.filter(it => it.excluido).length,
    aGuardar:      items.filter(it => !it.excluido && it.tienda).length,
  };

  return (
    <div className="max-w-5xl mx-auto">
      {corrgiendoItem && (
        <ModalCorreccion
          item={corrgiendoItem}
          tiendas={tiendas}
          onSave={handleCorreccion}
          onClose={() => setCorrigiendoItem(null)}
        />
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers size={26} className="text-[#00913f]" />
            Importación masiva de albaranes
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Sube todos los Excel de la semana de una vez
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={() => { setItems([]); setImportado(false); setProgreso(''); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            <RefreshCw size={14} /> Nueva importación
          </button>
        )}
      </div>

      {/* Zona de carga */}
      {items.length === 0 && !procesando && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-3 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer ${
            dragOver ? 'border-[#00913f] bg-green-50' : 'border-gray-300 hover:border-[#00913f] hover:bg-green-50/50'
          }`}
          onClick={() => fileRef.current?.click()}>
          <Upload size={48} className={`mx-auto mb-4 ${dragOver ? 'text-[#00913f]' : 'text-gray-300'}`} />
          <p className="font-bold text-gray-700 text-lg mb-1">Arrastra los Excel aquí</p>
          <p className="text-gray-400 text-sm mb-4">O haz clic para seleccionar múltiples archivos</p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm">
            <FileSpreadsheet size={16} /> Seleccionar archivos
          </div>
          <p className="text-xs text-gray-300 mt-3">
            Formato: NOMBRETIENDA_DD-MM.xlsx · Acepta .xlsx .xls .csv
          </p>
          <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {/* Estado procesando */}
      {procesando && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="animate-spin text-[#00a847]" />
          <p className="font-semibold text-gray-700">{progreso}</p>
          <p className="text-sm text-gray-400">Detectando tiendas y buscando pedidos...</p>
        </div>
      )}

      {/* Resultados */}
      {items.length > 0 && !procesando && (
        <>
          {/* Resumen estadístico */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Total',          value: stats.total,         color: 'bg-gray-50 border-gray-200 text-gray-700' },
              { label: 'Correctos',      value: stats.correctos,     color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Ambiguos',       value: stats.ambiguos,      color: 'bg-amber-50 border-amber-200 text-amber-700' },
              { label: 'Sin pedido',     value: stats.noEncontrados, color: 'bg-gray-50 border-gray-300 text-gray-500' },
              { label: 'A guardar',      value: stats.aGuardar,      color: 'bg-[#edf7f2] border-[#b3dfc4] text-[#00913f]' },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs font-medium opacity-70">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Aviso ambiguos */}
          {stats.ambiguos > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>
                <strong>{stats.ambiguos} albarán{stats.ambiguos > 1 ? 'es' : ''}</strong> con pedido ambiguo —
                se ha preseleccionado el más reciente. Revísalos con el botón ✏️ si es necesario.
              </span>
            </div>
          )}

          {/* Mensaje post-guardado */}
          {importado && progreso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
              <CheckCircle size={16} /> {progreso}
            </div>
          )}

          {/* Lista de resultados */}
          <div className="space-y-2 mb-6">
            {items.map(item => (
              <FilaResultado
                key={item.filename}
                item={item}
                tiendas={tiendas}
                onCorregir={it => { cargarTiendas(); setCorrigiendoItem(it); }}
                onToggleExcluir={fn => setItems(prev => prev.map(it => it.filename === fn ? { ...it, excluido: !it.excluido } : it))}
              />
            ))}
          </div>

          {/* Botón guardar */}
          {!importado && (
            <div className="flex gap-3 justify-end sticky bottom-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg flex items-center gap-3 px-4 py-3">
                <span className="text-sm text-gray-600">
                  {stats.aGuardar} albarán{stats.aGuardar !== 1 ? 'es' : ''} listos para guardar
                  {stats.excluidos > 0 && <span className="text-gray-400"> · {stats.excluidos} excluidos</span>}
                </span>
                <button
                  onClick={handleGuardar}
                  disabled={guardando || stats.aGuardar === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 shadow">
                  {guardando
                    ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                    : <><Check size={16} /> Guardar {stats.aGuardar} albaranes</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
