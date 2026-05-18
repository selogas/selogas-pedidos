import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  Loader2, X, ChevronDown, ChevronRight, Check, Edit2,
  Layers, RefreshCw, Settings, Plus, Trash2,
} from 'lucide-react';

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Resta N días laborables ignorando sábado (6) y domingo (0) */
function restarDiasLaborables(fechaStr, dias = 2) {
  const d = new Date(fechaStr + 'T12:00:00');
  let restados = 0;
  while (restados < dias) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) restados++;
  }
  return d.toISOString().split('T')[0];
}

/** Obtiene lunes y viernes de la semana a la que pertenece una fecha */
function semanaDeDate(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00');
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // lun=1 … dom=7
  const lunes = new Date(d); lunes.setDate(d.getDate() - (dow - 1));
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  return {
    desde: lunes.toISOString().split('T')[0],
    hasta: domingo.toISOString().split('T')[0],
  };
}

/** Extrae DD-MM del nombre de archivo → YYYY-MM-DD */
function extraerFechaDeNombre(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const m = base.match(/[_\s-](\d{1,2})[_\s-](\d{2})(?:[_\s-]\d{2,4})?/);
  if (m) {
    const dia = parseInt(m[1]), mes = parseInt(m[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return `${new Date().getFullYear()}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
  }
  return null;
}

/** Resuelve tienda desde nombre de archivo usando tabla de equivalencias */
function resolverTiendaPorAlias(filename, equivalencias) {
  const base = filename.replace(/\.[^.]+$/, '').toUpperCase();
  // Extraer parte del nombre (antes del primer separador con dígito)
  const nombreParte = base.split(/[_\s-]\d/)[0].replace(/[_-]/g,' ').trim();

  // 1. Coincidencia exacta con alias completo
  const exacta = equivalencias.find(e => e.alias.toUpperCase() === nombreParte);
  if (exacta) return exacta;

  // 2. Coincidencia parcial: alias contenido en nombreParte o viceversa
  const parcial = equivalencias
    .map(e => ({
      eq: e,
      score: nombreParte.includes(e.alias.toUpperCase())
        ? e.alias.length
        : e.alias.toUpperCase().includes(nombreParte)
        ? nombreParte.length * 0.8
        : 0,
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return parcial?.eq || null;
}

/** Parsea Excel → [{codigo, cantidad_servida, descripcion}] */
function parsearExcel(buffer) {
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let hi = -1, cCod = -1, cUds = -1, cDesc = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(v => String(v||'').toLowerCase().trim());
    const ai = row.findIndex(c => c.includes('artículo')||c.includes('articulo')||c==='código'||c==='codigo');
    const ui = row.findIndex(c => c.includes('unidades')||c.includes('cantidad')||c.includes('uds'));
    const di = row.findIndex(c => c.includes('descripción')||c.includes('descripcion')||c.includes('nombre'));
    if (ai >= 0 && ui >= 0) { hi = i; cCod = ai; cUds = ui; cDesc = di; break; }
  }
  if (hi < 0) { hi = 0; cCod = 1; cUds = 2; cDesc = 3; }

  const lineas = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    const cod = row[cCod] != null ? String(row[cCod]).trim().replace(/\.0+$/,'') : null;
    const uds = row[cUds];
    const desc = cDesc >= 0 && row[cDesc] ? String(row[cDesc]).trim() : '';
    if (!cod || !uds || isNaN(Number(uds))) continue;
    lineas.push({ codigo: cod, cantidad_servida: parseInt(uds), descripcion: desc });
  }
  return lineas;
}

function calcTipo(pedida, servida) {
  if (pedida == null) return 'no_pedido';
  if (servida === 0)    return 'no_servido';
  if (servida < pedida) return 'parcial';
  if (servida > pedida) return 'exceso';
  return 'ok';
}

// ─── Colores ──────────────────────────────────────────────────────────────────
const CONF_CFG = {
  correcto:      { label:'Correcto',   color:'bg-green-100 text-green-800 border-green-300',  dot:'bg-green-500',  icon:CheckCircle },
  ambiguo:       { label:'Ambiguo',    color:'bg-amber-100 text-amber-800 border-amber-300',  dot:'bg-amber-500',  icon:AlertTriangle },
  no_encontrado: { label:'Sin pedido', color:'bg-gray-100 text-gray-600 border-gray-300',     dot:'bg-gray-400',   icon:XCircle },
  sin_tienda:    { label:'Sin tienda', color:'bg-red-100 text-red-700 border-red-300',        dot:'bg-red-500',    icon:XCircle },
  error:         { label:'Error',      color:'bg-red-100 text-red-700 border-red-300',        dot:'bg-red-500',    icon:XCircle },
};

// ─── Panel gestión equivalencias ─────────────────────────────────────────────
function PanelEquivalencias({ tiendas, onClose }) {
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [nuevoAlias, setNuevoAlias] = useState('');
  const [nuevaTienda, setNuevaTienda] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('equivalencias_tiendas')
      .select('id, alias, tienda_id, tiendas(nombre)')
      .order('alias');
    setLista(data || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleAdd = async () => {
    if (!nuevoAlias.trim() || !nuevaTienda) { setError('Alias y tienda son obligatorios'); return; }
    setSaving(true); setError('');
    const { error: e } = await supabase.from('equivalencias_tiendas')
      .insert([{ alias: nuevoAlias.trim().toUpperCase(), tienda_id: nuevaTienda }]);
    if (e) setError(e.message);
    else { setNuevoAlias(''); setNuevaTienda(''); cargar(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await supabase.from('equivalencias_tiendas').delete().eq('id', id);
    cargar();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Settings size={18} className="text-[#00913f]" /> Equivalencias de tiendas
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <p className="px-5 pt-3 text-sm text-gray-500">
          Define qué texto en el nombre del archivo corresponde a cada tienda.
          Ej: <code className="bg-gray-100 px-1 rounded">ARENAS</code> → LAS ARENAS
        </p>
        {error && <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {/* Añadir nuevo */}
        <div className="p-5 border-b">
          <div className="flex gap-2">
            <input
              type="text" value={nuevoAlias} onChange={e => setNuevoAlias(e.target.value.toUpperCase())}
              placeholder="Alias en el archivo..." className="flex-1 border rounded-xl px-3 py-2 text-sm uppercase"
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <select value={nuevaTienda} onChange={e => setNuevaTienda(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">— Tienda —</option>
              {tiendas.filter(t => t.nombre !== 'PRINCIPAL').map(t =>
                <option key={t.id} value={t.id}>{t.nombre}</option>
              )}
            </select>
            <button onClick={handleAdd} disabled={saving}
              className="px-3 py-2 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 flex-shrink-0">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Alias en archivo</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Tienda</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lista.map(eq => (
                  <tr key={eq.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs font-bold text-gray-700">{eq.alias}</td>
                    <td className="px-4 py-2 text-gray-600">{eq.tiendas?.nombre}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => handleDelete(eq.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t">
          <button onClick={onClose} className="w-full py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal corrección manual ──────────────────────────────────────────────────
function ModalCorreccion({ item, tiendas, onSave, onClose }) {
  const [tiendaId, setTiendaId]     = useState(item.tienda?.id || '');
  const [pedidosDisp, setPedidos]   = useState(item.pedidosSugeridos || []);
  const [selecPedidos, setSelec]    = useState(new Set(item.pedidoFinal ? [item.pedidoFinal.id] : []));
  const [cargando, setCargando]     = useState(false);

  const cambiarTienda = async (tid) => {
    setTiendaId(tid); setSelec(new Set());
    if (!tid) return;
    setCargando(true);
    const { data } = await supabase.from('pedidos')
      .select('id, numero_pedido, fecha_pedido, total_lineas')
      .eq('tienda_id', tid).order('fecha_pedido', { ascending: false }).limit(20);
    setPedidos(data || []);
    setCargando(false);
  };

  const togglePed = id => setSelec(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><Edit2 size={16} className="text-amber-500" /> Corregir asignación</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <p className="text-xs font-mono bg-gray-50 rounded-lg p-2 mb-4 text-gray-600">{item.filename}</p>

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
              Pedido(s) <span className="font-normal text-xs text-gray-400">— marca 1 o 2 si doble pedido</span>
            </label>
            {cargando ? (
              <div className="flex items-center gap-2 p-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Cargando...</div>
            ) : (
              <div className="border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {pedidosDisp.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No hay pedidos</p>}
                {pedidosDisp.map(p => (
                  <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b last:border-0 hover:bg-gray-50 ${selecPedidos.has(p.id) ? 'bg-[#edf7f2]' : ''}`}>
                    <input type="checkbox" checked={selecPedidos.has(p.id)} onChange={() => togglePed(p.id)} className="rounded" />
                    <span className="font-semibold">{p.numero_pedido}</span>
                    <span className="text-xs text-gray-400">{new Date(p.fecha_pedido).toLocaleDateString('es-ES')} · {p.total_lineas} lín.</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm">Cancelar</button>
          <button onClick={() => onSave({ tiendaId, pedidoIds: [...selecPedidos] })} disabled={!tiendaId}
            className="flex-1 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold disabled:opacity-50">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila resultado ───────────────────────────────────────────────────────────
function FilaResultado({ item, tiendas, onCorregir, onToggleExcluir }) {
  const [expandida, setExpandida] = useState(false);
  const cfg = CONF_CFG[item.confianza] || CONF_CFG.error;
  const Icon = cfg.icon;
  const incid = item.lineas?.filter(l => l.tipo_diferencia !== 'ok').length ?? 0;

  return (
    <div className={`border rounded-2xl overflow-hidden ${item.excluido ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2 p-3 flex-wrap sm:flex-nowrap">
        <input type="checkbox" checked={!item.excluido} onChange={() => onToggleExcluir(item.filename)}
          className="flex-shrink-0 w-4 h-4 rounded" />

        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
        </span>

        <span className="font-mono text-xs text-gray-500 flex-shrink-0 hidden sm:block truncate max-w-[160px]">{item.filename}</span>

        <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate">
          {item.tienda?.nombre || <span className="text-red-500 italic font-normal">Sin tienda</span>}
          {item.tienda?.doble_pedido && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">2x</span>}
        </span>

        <span className="text-xs text-gray-500 flex-shrink-0 hidden md:block">
          {item.pedidosSeleccionados?.length > 0
            ? item.pedidosSeleccionados.map(p => p.numero_pedido).join(' + ')
            : <span className="text-gray-300">sin pedido</span>}
        </span>

        <span className="text-xs text-gray-400 flex-shrink-0">
          {item.fechaAlbaran ? new Date(item.fechaAlbaran).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : '—'}
        </span>

        {incid > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
            {incid} incid.
          </span>
        )}
        {item.confianza === 'ambiguo' && (
          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
            {item.pedidosSugeridos?.length} pedidos
          </span>
        )}

        <span className="text-xs text-gray-400 flex-shrink-0">{item.lineas?.length ?? 0} lín.</span>

        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onCorregir(item)} className="p-1.5 border rounded-lg text-amber-600 hover:bg-amber-50" title="Corregir">
            <Edit2 size={13} />
          </button>
          {item.lineas?.length > 0 && (
            <button onClick={() => setExpandida(!expandida)} className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50">
              {expandida ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>

      {expandida && item.lineas?.length > 0 && (
        <div className="border-t bg-gray-50 max-h-44 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 text-gray-600 font-semibold">Código</th>
                <th className="text-left px-3 py-1.5 text-gray-600 font-semibold">Descripción</th>
                <th className="text-center px-3 py-1.5 text-gray-600 font-semibold">Pedido</th>
                <th className="text-center px-3 py-1.5 text-gray-600 font-semibold">Servido</th>
                <th className="text-left px-3 py-1.5 text-gray-600 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {item.lineas.map((l, i) => (
                <tr key={i} className={l.tipo_diferencia !== 'ok' ? 'bg-amber-50/40' : ''}>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{l.codigo_producto}</td>
                  <td className="px-3 py-1.5 text-gray-700 truncate max-w-[160px]">{l.descripcion || '—'}</td>
                  <td className="px-3 py-1.5 text-center">{l.cantidad_pedida ?? '—'}</td>
                  <td className="px-3 py-1.5 text-center font-bold">{l.cantidad_servida}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      l.tipo_diferencia==='ok'         ? 'bg-green-100 text-green-700' :
                      l.tipo_diferencia==='no_servido' ? 'bg-red-100 text-red-700' :
                      l.tipo_diferencia==='parcial'    ? 'bg-amber-100 text-amber-700' :
                      l.tipo_diferencia==='exceso'     ? 'bg-blue-100 text-blue-700' :
                                                         'bg-purple-100 text-purple-700'
                    }`}>{l.tipo_diferencia.replace('_',' ')}</span>
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
  const [tiendas, setTiendas]           = useState([]);
  const [equivalencias, setEquivalencias] = useState([]);
  const [dataLoaded, setDataLoaded]     = useState(false);
  const [items, setItems]               = useState([]);
  const [procesando, setProcesando]     = useState(false);
  const [guardando, setGuardando]       = useState(false);
  const [progreso, setProgreso]         = useState('');
  const [importado, setImportado]       = useState(false);
  const [corrgiendoItem, setCorrigiendo] = useState(null);
  const [panelEquiv, setPanelEquiv]     = useState(false);
  const [dragOver, setDragOver]         = useState(false);
  const fileRef                         = useRef();

  const cargarDatos = async () => {
    if (dataLoaded) return { tiendas, equivalencias };
    const [{ data: tds }, { data: eqs }] = await Promise.all([
      supabase.from('tiendas').select('id, nombre, doble_pedido').eq('activa', true).order('nombre'),
      supabase.from('equivalencias_tiendas').select('id, alias, tienda_id, tiendas(id, nombre, doble_pedido)'),
    ]);
    const t = tds || [], e = eqs || [];
    setTiendas(t); setEquivalencias(e); setDataLoaded(true);
    return { tiendas: t, equivalencias: e };
  };

  // Construir mapa código→cantidad de un array de pedido_ids
  const mapaPedidos = async (pedidoIds) => {
    if (!pedidoIds?.length) return {};
    const { data } = await supabase
      .from('pedido_items')
      .select('producto_codigo, cantidad')
      .in('pedido_id', pedidoIds);
    const mapa = {};
    (data || []).forEach(item => {
      const cod = (item.producto_codigo || '').trim();
      if (cod) mapa[cod] = (mapa[cod] || 0) + item.cantidad;
    });
    return mapa;
  };

  // Cruzar líneas del albarán con el mapa de pedidos
  const cruzarLineas = (lineasRaw, mapa) => {
    const lineas = lineasRaw.map(l => ({
      codigo_producto: l.codigo, descripcion: l.descripcion,
      cantidad_servida: l.cantidad_servida,
      cantidad_pedida: mapa[l.codigo] ?? null,
      tipo_diferencia: calcTipo(mapa[l.codigo] ?? null, l.cantidad_servida),
    }));
    // Añadir los no servidos (en pedido pero no en albarán)
    Object.entries(mapa).forEach(([cod, qty]) => {
      if (!lineasRaw.some(l => l.codigo === cod)) {
        lineas.push({ codigo_producto: cod, descripcion: '', cantidad_servida: 0, cantidad_pedida: qty, tipo_diferencia: 'no_servido' });
      }
    });
    return lineas;
  };

  const procesarArchivo = async (file, tds, eqs) => {
    const item = {
      filename: file.name,
      tienda: null,
      fechaAlbaran: null,
      pedidosSugeridos: [],
      pedidosSeleccionados: [],
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

      // 2. Detectar tienda por equivalencias
      const eq = resolverTiendaPorAlias(file.name, eqs.map(e => ({ alias: e.alias, ...e.tiendas })));
      if (eq) {
        item.tienda = { id: eq.tienda_id || eq.id, nombre: eq.nombre, doble_pedido: eq.doble_pedido };
        // Buscar tienda completa si faltan datos
        if (!item.tienda.nombre) {
          const t = tds.find(t => t.id === item.tienda.id);
          if (t) item.tienda = t;
        }
      }

      // 3. Extraer fecha
      const fechaEntrega = extraerFechaDeNombre(file.name);
      item.fechaAlbaran = fechaEntrega;

      if (!item.tienda) {
        item.confianza = 'sin_tienda';
        item.lineas = lineasRaw.map(l => ({ codigo_producto: l.codigo, descripcion: l.descripcion, cantidad_servida: l.cantidad_servida, cantidad_pedida: null, tipo_diferencia: 'no_pedido' }));
        return item;
      }

      // 4. Buscar pedidos según doble_pedido y fecha
      let pedidosSugeridos = [];
      if (fechaEntrega) {
        const esTiendaDoble = item.tienda.doble_pedido;

        if (esTiendaDoble) {
          // Tienda con doble pedido: buscar TODOS los pedidos de la semana natural
          const semana = semanaDeDate(fechaEntrega);
          const { data } = await supabase.from('pedidos')
            .select('id, numero_pedido, fecha_pedido, total_lineas')
            .eq('tienda_id', item.tienda.id)
            .gte('fecha_pedido', semana.desde)
            .lte('fecha_pedido', semana.hasta)
            .order('fecha_pedido', { ascending: false });
          pedidosSugeridos = data || [];
        } else {
          // Tienda normal: buscar 1 pedido en la semana natural
          const semana = semanaDeDate(fechaEntrega);
          const { data } = await supabase.from('pedidos')
            .select('id, numero_pedido, fecha_pedido, total_lineas')
            .eq('tienda_id', item.tienda.id)
            .gte('fecha_pedido', semana.desde)
            .lte('fecha_pedido', semana.hasta)
            .order('fecha_pedido', { ascending: false });
          pedidosSugeridos = data || [];
        }
      } else {
        // Sin fecha en el nombre: traer últimos 5 pedidos
        const { data } = await supabase.from('pedidos')
          .select('id, numero_pedido, fecha_pedido, total_lineas')
          .eq('tienda_id', item.tienda.id)
          .order('fecha_pedido', { ascending: false }).limit(5);
        pedidosSugeridos = data || [];
      }

      item.pedidosSugeridos = pedidosSugeridos;

      // 5. Determinar confianza y pedidos seleccionados
      const esTiendaDoble = item.tienda.doble_pedido;

      if (pedidosSugeridos.length === 0) {
        item.confianza = 'no_encontrado';
        item.pedidosSeleccionados = [];
      } else if (!esTiendaDoble && pedidosSugeridos.length === 1) {
        // Tienda normal, 1 pedido exacto → CORRECTO
        item.confianza = 'correcto';
        item.pedidosSeleccionados = [pedidosSugeridos[0]];
      } else if (esTiendaDoble && pedidosSugeridos.length === 2) {
        // Tienda doble, 2 pedidos en la semana → CORRECTO (se suman)
        item.confianza = 'correcto';
        item.pedidosSeleccionados = pedidosSugeridos;
      } else {
        // Cualquier otro caso → AMBIGUO
        item.confianza = 'ambiguo';
        item.pedidosSeleccionados = [pedidosSugeridos[0]];
      }

      // 6. Cruzar
      if (item.pedidosSeleccionados.length > 0) {
        const mapa = await mapaPedidos(item.pedidosSeleccionados.map(p => p.id));
        item.lineas = cruzarLineas(lineasRaw, mapa);
      } else {
        item.lineas = lineasRaw.map(l => ({ codigo_producto: l.codigo, descripcion: l.descripcion, cantidad_servida: l.cantidad_servida, cantidad_pedida: null, tipo_diferencia: 'no_pedido' }));
      }

    } catch (e) {
      item.confianza = 'error';
      item.error = e.message;
    }

    return item;
  };

  const procesarArchivos = async (files) => {
    const lista = Array.from(files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!lista.length) return;
    setProcesando(true); setProgreso('Cargando configuración...'); setImportado(false);
    const { tiendas: tds, equivalencias: eqs } = await cargarDatos();

    const resultados = [];
    for (let i = 0; i < lista.length; i++) {
      setProgreso(`Procesando ${i+1}/${lista.length}: ${lista[i].name}`);
      const item = await procesarArchivo(lista[i], tds, eqs);
      resultados.push(item);
    }
    setItems(resultados);
    setProcesando(false); setProgreso('');
  };

  const handleFiles = useCallback(async (files) => { await procesarArchivos(files); }, [dataLoaded, tiendas, equivalencias]);

  const onDrop = useCallback(e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);

  // Corrección manual aplicada
  const handleCorreccion = async ({ tiendaId, pedidoIds }) => {
    const item = corrgiendoItem;
    const tiendaObj = tiendas.find(t => t.id === tiendaId);
    let pedidosSelec = [];
    let lineas = item.lineas.filter(l => l.cantidad_servida > 0).map(l => ({ codigo: l.codigo_producto, cantidad_servida: l.cantidad_servida, descripcion: l.descripcion }));

    if (pedidoIds?.length > 0) {
      const { data: peds } = await supabase.from('pedidos')
        .select('id, numero_pedido, fecha_pedido, total_lineas').in('id', pedidoIds);
      pedidosSelec = peds || [];
      const mapa = await mapaPedidos(pedidoIds);
      lineas = cruzarLineas(lineas, mapa);
    } else {
      lineas = lineas.map(l => ({ codigo_producto: l.codigo, descripcion: l.descripcion, cantidad_servida: l.cantidad_servida, cantidad_pedida: null, tipo_diferencia: 'no_pedido' }));
    }

    setItems(prev => prev.map(it =>
      it.filename === item.filename ? {
        ...it,
        tienda: tiendaObj,
        pedidosSeleccionados: pedidosSelec,
        pedidosSugeridos: pedidosSelec,
        confianza: !tiendaObj ? 'sin_tienda' : pedidosSelec.length === 0 ? 'no_encontrado' : 'correcto',
        lineas,
      } : it
    ));
    setCorrigiendo(null);
  };

  const handleGuardar = async () => {
    const aGuardar = items.filter(it => !it.excluido && it.tienda && it.lineas?.length > 0);
    if (!aGuardar.length) return;
    setGuardando(true);
    let ok = 0, errores = 0;

    for (const item of aGuardar) {
      try {
        const { data: alb, error: e } = await supabase.from('albaranes').insert([{
          tienda_id:      item.tienda.id,
          tienda_nombre:  item.tienda.nombre,
          numero_albaran: item.filename.replace(/\.[^.]+$/,''),
          fecha_albaran:  item.fechaAlbaran || new Date().toISOString().split('T')[0],
          total_lineas:   item.lineas.length,
          subido_por:     perfil?.id || null,
          notas:          item.confianza === 'ambiguo' ? 'Asignado automáticamente (ambiguo)' : '',
        }]).select().single();
        if (e) throw e;

        for (let i = 0; i < item.lineas.length; i += 100) {
          const lote = item.lineas.slice(i, i+100).map(l => ({ ...l, albaran_id: alb.id }));
          const { error: el } = await supabase.from('albaran_lineas').insert(lote);
          if (el) throw el;
        }
        ok++;
      } catch { errores++; }
    }

    setGuardando(false); setImportado(true);
    setProgreso(`✓ ${ok} albaranes guardados${errores > 0 ? ` · ${errores} errores` : ''}`);
  };

  const stats = {
    total:         items.length,
    correctos:     items.filter(it => it.confianza==='correcto' && !it.excluido).length,
    ambiguos:      items.filter(it => it.confianza==='ambiguo'  && !it.excluido).length,
    noEncontrados: items.filter(it => (it.confianza==='no_encontrado'||it.confianza==='sin_tienda') && !it.excluido).length,
    aGuardar:      items.filter(it => !it.excluido && it.tienda).length,
  };

  return (
    <div className="max-w-5xl mx-auto">
      {corrgiendoItem && <ModalCorreccion item={corrgiendoItem} tiendas={tiendas} onSave={handleCorreccion} onClose={() => setCorrigiendo(null)} />}
      {panelEquiv && <PanelEquivalencias tiendas={tiendas} onClose={() => { setPanelEquiv(false); setDataLoaded(false); }} />}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers size={26} className="text-[#00913f]" /> Importación masiva de albaranes
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Sube todos los Excel de la semana a la vez</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { cargarDatos(); setPanelEquiv(true); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
            <Settings size={14} /> Equivalencias
          </button>
          {items.length > 0 && (
            <button onClick={() => { setItems([]); setImportado(false); setProgreso(''); }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              <RefreshCw size={14} /> Nueva importación
            </button>
          )}
        </div>
      </div>

      {/* Zona carga */}
      {items.length === 0 && !procesando && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragOver ? 'border-[#00913f] bg-green-50' : 'border-gray-300 hover:border-[#00913f] hover:bg-green-50/50'}`}>
          <Upload size={48} className={`mx-auto mb-4 ${dragOver ? 'text-[#00913f]' : 'text-gray-300'}`} />
          <p className="font-bold text-gray-700 text-lg mb-1">Arrastra los Excel aquí</p>
          <p className="text-gray-400 text-sm mb-4">O haz clic para seleccionar múltiples archivos</p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm">
            <FileSpreadsheet size={16} /> Seleccionar archivos
          </div>
          <p className="text-xs text-gray-300 mt-3">Formato esperado: ALIAS_DD-MM.xlsx</p>
          <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {/* Procesando */}
      {procesando && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="animate-spin text-[#00a847]" />
          <p className="font-semibold text-gray-700">{progreso}</p>
        </div>
      )}

      {/* Resultados */}
      {items.length > 0 && !procesando && (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label:'Total',      value:stats.total,         color:'bg-gray-50 border-gray-200 text-gray-700' },
              { label:'Correctos',  value:stats.correctos,     color:'bg-green-50 border-green-200 text-green-700' },
              { label:'Ambiguos',   value:stats.ambiguos,      color:'bg-amber-50 border-amber-200 text-amber-700' },
              { label:'A guardar',  value:stats.aGuardar,      color:'bg-[#edf7f2] border-[#b3dfc4] text-[#00913f]' },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs font-medium opacity-70">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Avisos */}
          {stats.ambiguos > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span><strong>{stats.ambiguos} albarán{stats.ambiguos>1?'es':''} ambiguo{stats.ambiguos>1?'s':''}.</strong> Revísalos con ✏️ — puede haber pedidos de otras semanas mezclados.</span>
            </div>
          )}
          {stats.noEncontrados > 0 && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center gap-2">
              <XCircle size={16} className="flex-shrink-0" />
              <span><strong>{stats.noEncontrados}</strong> sin tienda o sin pedido — corrígelos o exclúyelos.</span>
            </div>
          )}
          {importado && progreso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
              <CheckCircle size={16} /> {progreso}
            </div>
          )}

          {/* Lista */}
          <div className="space-y-2 mb-6">
            {items.map(item => (
              <FilaResultado
                key={item.filename}
                item={item}
                tiendas={tiendas}
                onCorregir={it => { cargarDatos(); setCorrigiendo(it); }}
                onToggleExcluir={fn => setItems(prev => prev.map(it => it.filename === fn ? {...it, excluido: !it.excluido} : it))}
              />
            ))}
          </div>

          {/* Guardar */}
          {!importado && (
            <div className="flex justify-end sticky bottom-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg flex items-center gap-4 px-5 py-3">
                <span className="text-sm text-gray-600">{stats.aGuardar} albarán{stats.aGuardar!==1?'es':''} listos</span>
                <button onClick={handleGuardar} disabled={guardando || stats.aGuardar===0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 shadow">
                  {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Check size={16} /> Guardar {stats.aGuardar}</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
