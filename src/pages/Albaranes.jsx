import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet, Upload, Trash2, Search, Filter, ChevronDown,
  ChevronRight, AlertTriangle, CheckCircle, XCircle, Plus,
  TrendingDown, TrendingUp, Package, Loader2, X, Calendar,
  RefreshCw, ClipboardList,
} from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPOS = {
  ok:         { label: 'OK',           color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle,    dot: 'bg-green-500' },
  parcial:    { label: 'Parcial',      color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: TrendingDown,   dot: 'bg-amber-500' },
  exceso:     { label: 'Exceso',       color: 'bg-blue-100 text-blue-800 border-blue-200',      icon: TrendingUp,     dot: 'bg-blue-500' },
  no_servido: { label: 'No servido',   color: 'bg-red-100 text-red-800 border-red-200',         icon: XCircle,        dot: 'bg-red-500' },
  no_pedido:  { label: 'No pedido',    color: 'bg-purple-100 text-purple-800 border-purple-200',icon: Package,        dot: 'bg-purple-500' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTipo(pedida, servida) {
  if (pedida === null || pedida === undefined) return 'no_pedido';
  if (servida === 0)    return 'no_servido';
  if (servida < pedida) return 'parcial';
  if (servida > pedida) return 'exceso';
  return 'ok';
}

function Badge({ tipo }) {
  const cfg = TIPOS[tipo] || TIPOS.no_pedido;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function ResumenBadges({ lineas }) {
  const counts = { ok: 0, parcial: 0, exceso: 0, no_servido: 0, no_pedido: 0 };
  lineas.forEach(l => counts[l.tipo_diferencia]++);
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(counts).filter(([, n]) => n > 0).map(([tipo, n]) => {
        const cfg = TIPOS[tipo];
        return (
          <span key={tipo} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {n} {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Modal: Subir albarán ─────────────────────────────────────────────────────
function ModalSubir({ tiendas, onClose, onSaved }) {
  const { perfil } = useAuth();
  const [tiendaId, setTiendaId]       = useState('');
  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0]);
  const [numero, setNumero]           = useState('');
  const [notas, setNotas]             = useState('');
  const [lineasAlbaran, setLineas]    = useState([]); // líneas parseadas del Excel
  const [procesando, setProcesando]   = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [error, setError]             = useState('');
  const [paso, setPaso]               = useState(1); // 1=datos, 2=excel, 3=preview
  const fileRef = useRef();

  // Parsear el archivo Excel en el cliente
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcesando(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // Detectar cabecera: buscar fila con "Artículo" y "Unidades"
      let headerIdx = -1;
      let colCodigo = -1, colUnidades = -1, colDesc = -1;

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i].map(v => String(v || '').toLowerCase().trim());
        const artIdx  = row.findIndex(c => c.includes('artículo') || c.includes('articulo') || c === 'código' || c === 'codigo');
        const unidIdx = row.findIndex(c => c.includes('unidades') || c.includes('cantidad') || c.includes('uds'));
        const descIdx = row.findIndex(c => c.includes('descripción') || c.includes('descripcion') || c.includes('nombre'));
        if (artIdx >= 0 && unidIdx >= 0) {
          headerIdx = i; colCodigo = artIdx; colUnidades = unidIdx; colDesc = descIdx;
          break;
        }
      }

      if (headerIdx < 0) {
        // Fallback: asumir columna 1 = código, col 2 = unidades, col 3 = descripción
        headerIdx = 0; colCodigo = 1; colUnidades = 2; colDesc = 3;
      }

      const parsed = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const cod = row[colCodigo] !== null && row[colCodigo] !== undefined
          ? String(row[colCodigo]).trim().replace(/\.0+$/, '')
          : null;
        const uds = row[colUnidades];
        const desc = colDesc >= 0 && row[colDesc] ? String(row[colDesc]).trim() : '';
        if (!cod || !uds || isNaN(Number(uds))) continue;
        parsed.push({ codigo: cod, cantidad_servida: parseInt(uds), descripcion: desc });
      }

      if (!parsed.length) { setError('No se encontraron líneas con código y cantidad en el archivo.'); return; }

      // Intentar extraer nombre del archivo como sugerencia de número
      if (!numero) {
        const nombre = file.name.replace(/\.[^.]+$/, '');
        setNumero(nombre);
      }

      setLineas(parsed);
      setPaso(3);
    } catch (e) {
      setError('Error al leer el archivo: ' + e.message);
    } finally {
      setProcesando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleGuardar = async () => {
    if (!tiendaId || !fecha || !lineasAlbaran.length) return;
    setGuardando(true);
    setError('');
    try {
      const tienda = tiendas.find(t => t.id === tiendaId);

      // 1. Buscar pedidos de esa tienda en ±7 días de la fecha del albarán
      const fechaD = new Date(fecha);
      const desde = new Date(fechaD); desde.setDate(desde.getDate() - 7);
      const hasta = new Date(fechaD); hasta.setDate(hasta.getDate() + 7);

      const { data: pedidosData } = await supabase
        .from('pedido_items')
        .select('producto_codigo, cantidad, pedido_id, pedidos!inner(tienda_id, fecha_pedido)')
        .eq('pedidos.tienda_id', tiendaId)
        .gte('pedidos.fecha_pedido', desde.toISOString())
        .lte('pedidos.fecha_pedido', hasta.toISOString());

      // Construir mapa código → cantidad pedida (suma si hay varios pedidos)
      const mapaPedido = {};
      (pedidosData || []).forEach(item => {
        const cod = (item.producto_codigo || '').trim();
        if (cod) mapaPedido[cod] = (mapaPedido[cod] || 0) + item.cantidad;
      });

      // 2. Cruzar albarán con pedidos
      const lineasConDif = lineasAlbaran.map(l => ({
        codigo_producto:  l.codigo,
        descripcion:      l.descripcion,
        cantidad_servida: l.cantidad_servida,
        cantidad_pedida:  mapaPedido[l.codigo] ?? null,
        tipo_diferencia:  calcTipo(mapaPedido[l.codigo] ?? null, l.cantidad_servida),
      }));

      // Añadir productos que estaban en el pedido pero NO en el albarán (no servidos)
      Object.entries(mapaPedido).forEach(([cod, qty]) => {
        const yaEnAlbaran = lineasAlbaran.some(l => l.codigo === cod);
        if (!yaEnAlbaran) {
          lineasConDif.push({
            codigo_producto:  cod,
            descripcion:      '',
            cantidad_servida: 0,
            cantidad_pedida:  qty,
            tipo_diferencia:  'no_servido',
          });
        }
      });

      // 3. Insertar albarán
      const { data: albaran, error: errAlb } = await supabase
        .from('albaranes')
        .insert([{
          tienda_id:      tiendaId,
          tienda_nombre:  tienda?.nombre || '',
          numero_albaran: numero.trim() || `ALB-${Date.now()}`,
          fecha_albaran:  fecha,
          total_lineas:   lineasConDif.length,
          subido_por:     perfil?.id || null,
          notas:          notas.trim(),
        }])
        .select()
        .single();
      if (errAlb) throw errAlb;

      // 4. Insertar líneas en lotes de 100
      for (let i = 0; i < lineasConDif.length; i += 100) {
        const lote = lineasConDif.slice(i, i + 100).map(l => ({ ...l, albaran_id: albaran.id }));
        const { error: errL } = await supabase.from('albaran_lineas').insert(lote);
        if (errL) throw errL;
      }

      onSaved();
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-[#00913f]" />
            Subir albarán
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {/* Paso 1 + 2: datos básicos + subir archivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Tienda *</label>
              <select value={tiendaId} onChange={e => setTiendaId(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white">
                <option value="">— Selecciona tienda —</option>
                {tiendas.filter(t => t.nombre !== 'PRINCIPAL').map(t =>
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Fecha del albarán *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Nº albarán</label>
              <input type="text" value={numero} onChange={e => setNumero(e.target.value)}
                placeholder="Ej: ARENAS_13-5"
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Notas (opcional)</label>
              <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Cualquier anotación..."
                className="w-full border rounded-xl px-4 py-2.5 text-sm" />
            </div>
          </div>

          {/* Subir Excel */}
          {paso < 3 && (
            <div>
              <label className="block text-sm font-semibold mb-2">Archivo del albarán *</label>
              {procesando ? (
                <div className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-500">
                  <Loader2 size={20} className="animate-spin" /> Procesando archivo...
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="p-8 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-[#00913f] hover:bg-green-50 transition-colors">
                    <Upload size={28} className="mx-auto mb-2 text-gray-400" />
                    <p className="font-semibold text-gray-600 text-sm">Haz clic para subir el Excel</p>
                    <p className="text-xs text-gray-400 mt-1">Formato: .xlsx — columnas Artículo + Unidades</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* Preview de líneas parseadas */}
          {paso === 3 && lineasAlbaran.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  ✓ {lineasAlbaran.length} líneas leídas del archivo
                </p>
                <button onClick={() => { setLineas([]); setPaso(2); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Cambiar archivo
                </button>
              </div>
              <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Código</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Descripción</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Uds.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineasAlbaran.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-gray-600">{l.codigo}</td>
                        <td className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{l.descripcion}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-gray-800">{l.cantidad_servida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-5 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !tiendaId || !fecha || lineasAlbaran.length === 0}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2">
            {guardando ? <><Loader2 size={16} className="animate-spin" /> Procesando...</> : 'Guardar albarán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Borrado por rango de fechas ───────────────────────────────────────
function ModalBorrar({ onClose, onDeleted }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [preview, setPreview] = useState(null); // { count } o null
  const [cargando, setCargando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handlePreview = async () => {
    if (!desde || !hasta) { setError('Selecciona ambas fechas'); return; }
    if (new Date(desde) > new Date(hasta)) { setError('La fecha inicial debe ser anterior a la final'); return; }
    setCargando(true); setError('');
    const { count } = await supabase.from('albaranes')
      .select('*', { count: 'exact', head: true })
      .gte('fecha_albaran', desde)
      .lte('fecha_albaran', hasta);
    setPreview({ count: count || 0 });
    setCargando(false);
  };

  const handleBorrar = async () => {
    if (confirm !== 'BORRAR') return;
    setBorrando(true); setError('');
    try {
      // Las líneas se borran en cascada por FK ON DELETE CASCADE
      const { error: e } = await supabase.from('albaranes')
        .delete()
        .gte('fecha_albaran', desde)
        .lte('fecha_albaran', hasta);
      if (e) throw e;
      onDeleted();
    } catch (e) {
      setError('Error al borrar: ' + e.message);
      setBorrando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2 text-red-600">
            <Trash2 size={20} /> Borrar albaranes por fecha
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Elimina todos los albaranes (y sus líneas) dentro del rango de fechas. Útil para limpiar datos de un año anterior.
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPreview(null); setConfirm(''); }}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPreview(null); setConfirm(''); }}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
        </div>

        {/* Botón previsualizar */}
        {!preview && (
          <button onClick={handlePreview} disabled={cargando || !desde || !hasta}
            className="w-full py-2.5 border-2 border-amber-400 text-amber-700 rounded-xl font-semibold text-sm hover:bg-amber-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Ver cuántos registros se borrarán
          </button>
        )}

        {/* Preview y confirmación */}
        {preview !== null && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border-2 text-center ${preview.count > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
              {preview.count === 0 ? (
                <p className="font-semibold text-green-700">No hay albaranes en ese rango de fechas.</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-700">{preview.count}</p>
                  <p className="text-sm text-red-600">albaranes se eliminarán definitivamente</p>
                  <p className="text-xs text-red-500 mt-1">(y todas sus líneas de detalle)</p>
                </>
              )}
            </div>

            {preview.count > 0 && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Escribe <code className="bg-gray-100 px-1 rounded text-red-600">BORRAR</code> para confirmar
                  </label>
                  <input type="text" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="BORRAR" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <button onClick={handleBorrar} disabled={borrando || confirm !== 'BORRAR'}
                  className="w-full py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {borrando ? <><Loader2 size={16} className="animate-spin" /> Borrando...</> : <><Trash2 size={16} /> Borrar {preview.count} albaranes</>}
                </button>
              </>
            )}
          </div>
        )}

        <button onClick={onClose} className="w-full mt-3 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Detalle de un albarán ────────────────────────────────────────────────────
function DetalleAlbaran({ albaran, onClose }) {
  const [lineas, setLineas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    supabase.from('albaran_lineas')
      .select('*')
      .eq('albaran_id', albaran.id)
      .order('tipo_diferencia')
      .then(({ data }) => { setLineas(data || []); setLoading(false); });
  }, [albaran.id]);

  const lineasFiltradas = useMemo(() => {
    let list = lineas;
    if (filtroTipo !== 'todos') list = list.filter(l => l.tipo_diferencia === filtroTipo);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(l => l.codigo_producto?.toLowerCase().includes(q) || l.descripcion?.toLowerCase().includes(q));
    }
    return list;
  }, [lineas, filtroTipo, busqueda]);

  const totalIncidencias = lineas.filter(l => l.tipo_diferencia !== 'ok').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-lg">{albaran.numero_albaran}</h2>
            <p className="text-sm text-gray-500">{albaran.tienda_nombre} · {new Date(albaran.fecha_albaran).toLocaleDateString('es-ES')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Resumen rápido */}
        <div className="px-5 py-3 bg-gray-50 border-b flex flex-wrap gap-3 items-center">
          {Object.entries(TIPOS).map(([tipo, cfg]) => {
            const n = lineas.filter(l => l.tipo_diferencia === tipo).length;
            if (!n) return null;
            return (
              <button key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-sm font-semibold transition-all ${filtroTipo === tipo ? cfg.color : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {n} {cfg.label}
              </button>
            );
          })}
          {totalIncidencias > 0 && (
            <span className="text-xs text-red-600 font-semibold ml-auto">
              {totalIncidencias} incidencia{totalIncidencias > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Buscador */}
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-8 pr-4 py-2 border rounded-xl text-sm" />
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[#00913f]" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Descripción</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Pedido</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Servido</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Diferencia</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineasFiltradas.map(l => {
                  const diff = l.cantidad_pedida != null ? l.cantidad_servida - l.cantidad_pedida : null;
                  return (
                    <tr key={l.id} className={`hover:bg-gray-50 ${l.tipo_diferencia === 'no_servido' ? 'bg-red-50/30' : l.tipo_diferencia === 'no_pedido' ? 'bg-purple-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{l.codigo_producto}</td>
                      <td className="px-4 py-2.5 text-gray-800 max-w-[220px] truncate" title={l.descripcion}>{l.descripcion || '—'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-gray-700">
                        {l.cantidad_pedida != null ? l.cantidad_pedida : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-gray-900">{l.cantidad_servida}</td>
                      <td className="px-4 py-2.5 text-center text-sm font-semibold">
                        {diff != null ? (
                          <span className={diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5"><Badge tipo={l.tipo_diferencia} /></td>
                    </tr>
                  );
                })}
                {lineasFiltradas.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t text-xs text-gray-400 flex justify-between">
          <span>{lineasFiltradas.length} líneas mostradas de {lineas.length} total</span>
          {albaran.notas && <span>Nota: {albaran.notas}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Albaranes() {
  const [albaranes, setAlbaranes]   = useState([]);
  const [tiendas, setTiendas]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalSubir, setModalSubir] = useState(false);
  const [modalBorrar, setModalBorrar] = useState(false);
  const [detalle, setDetalle]       = useState(null);
  const [filtroTienda, setFiltroTienda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda]     = useState('');
  const [lineasPorAlbaran, setLineasPorAlbaran] = useState({}); // { albaran_id: lineas[] }
  const [cargandoLineas, setCargandoLineas] = useState(new Set());

  const cargar = async () => {
    setLoading(true);
    const [{ data: albs }, { data: tds }] = await Promise.all([
      supabase.from('albaranes').select('*').order('fecha_albaran', { ascending: false }),
      supabase.from('tiendas').select('id, nombre').eq('activa', true).order('nombre'),
    ]);
    setAlbaranes(albs || []);
    setTiendas(tds || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  // Cargar resumen de líneas al expandir
  const cargarLineas = async (albanId) => {
    if (lineasPorAlbaran[albanId]) return;
    setCargandoLineas(prev => new Set([...prev, albanId]));
    const { data } = await supabase.from('albaran_lineas')
      .select('tipo_diferencia')
      .eq('albaran_id', albanId);
    setLineasPorAlbaran(prev => ({ ...prev, [albanId]: data || [] }));
    setCargandoLineas(prev => { const s = new Set(prev); s.delete(albanId); return s; });
  };

  const albsFiltrados = useMemo(() => {
    let list = albaranes;
    if (filtroTienda) list = list.filter(a => a.tienda_id === filtroTienda);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(a =>
        a.numero_albaran?.toLowerCase().includes(q) ||
        a.tienda_nombre?.toLowerCase().includes(q)
      );
    }
    if (filtroEstado) {
      list = list.filter(a => {
        const lineas = lineasPorAlbaran[a.id] || [];
        if (filtroEstado === 'ok')          return lineas.every(l => l.tipo_diferencia === 'ok');
        if (filtroEstado === 'incidencias') return lineas.some(l => l.tipo_diferencia !== 'ok');
        return true;
      });
    }
    return list;
  }, [albaranes, filtroTienda, busqueda, filtroEstado, lineasPorAlbaran]);

  // Agrupar por mes para mostrar mejor
  const albsPorMes = useMemo(() => {
    const grupos = {};
    albsFiltrados.forEach(a => {
      const mes = a.fecha_albaran.slice(0, 7); // YYYY-MM
      if (!grupos[mes]) grupos[mes] = [];
      grupos[mes].push(a);
    });
    return grupos;
  }, [albsFiltrados]);

  const mesesOrdenados = Object.keys(albsPorMes).sort((a, b) => b.localeCompare(a));

  const formatMes = (ym) => {
    const [y, m] = ym.split('-');
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="max-w-5xl mx-auto">
      {modalSubir && <ModalSubir tiendas={tiendas} onClose={() => setModalSubir(false)} onSaved={() => { setModalSubir(false); cargar(); }} />}
      {modalBorrar && <ModalBorrar onClose={() => setModalBorrar(false)} onDeleted={() => { setModalBorrar(false); cargar(); }} />}
      {detalle && <DetalleAlbaran albaran={detalle} onClose={() => setDetalle(null)} />}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList size={26} className="text-[#00913f]" />
            Control de albaranes
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Compara lo pedido vs. lo servido por el almacén
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalBorrar(true)}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 bg-red-50 rounded-xl text-sm font-semibold hover:bg-red-100">
            <Trash2 size={15} /> Borrar por fechas
          </button>
          <button onClick={cargar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
            <RefreshCw size={15} /> Actualizar
          </button>
          <button onClick={() => setModalSubir(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34] shadow">
            <Plus size={16} /> Subir albarán
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por tienda o nº albarán..."
            className="w-full pl-8 pr-4 py-2 border rounded-xl text-sm" />
        </div>
        <select value={filtroTienda} onChange={e => setFiltroTienda(e.target.value)}
          className="border rounded-xl px-4 py-2 text-sm bg-white min-w-[150px]">
          <option value="">Todas las tiendas</option>
          {tiendas.filter(t => t.nombre !== 'PRINCIPAL').map(t =>
            <option key={t.id} value={t.id}>{t.nombre}</option>
          )}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border rounded-xl px-4 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="incidencias">Con incidencias</option>
          <option value="ok">Sin incidencias</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={36} className="animate-spin text-[#00a847]" /></div>
      ) : albsFiltrados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileSpreadsheet size={52} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No hay albaranes</p>
          <p className="text-sm mt-1">Sube el primer albarán con el botón superior</p>
        </div>
      ) : (
        <div className="space-y-6">
          {mesesOrdenados.map(mes => (
            <div key={mes}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Calendar size={14} /> {formatMes(mes)}
                <span className="text-gray-300 font-normal">({albsPorMes[mes].length})</span>
              </h3>
              <div className="space-y-2">
                {albsPorMes[mes].map(alb => {
                  const lineas = lineasPorAlbaran[alb.id];
                  const cargando = cargandoLineas.has(alb.id);
                  const totalIncid = lineas ? lineas.filter(l => l.tipo_diferencia !== 'ok').length : null;

                  return (
                    <div key={alb.id}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer"
                        onClick={() => {
                          if (!lineas && !cargando) cargarLineas(alb.id);
                        }}>
                        {/* Icono estado */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          totalIncid === 0 ? 'bg-green-100' :
                          totalIncid === null ? 'bg-gray-100' : 'bg-amber-100'}`}>
                          {cargando ? <Loader2 size={18} className="animate-spin text-gray-400" /> :
                           totalIncid === 0 ? <CheckCircle size={18} className="text-green-600" /> :
                           totalIncid === null ? <FileSpreadsheet size={18} className="text-gray-400" /> :
                           <AlertTriangle size={18} className="text-amber-600" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">{alb.numero_albaran}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(alb.fecha_albaran).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {totalIncid !== null && totalIncid > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                                {totalIncid} incidencia{totalIncid > 1 ? 's' : ''}
                              </span>
                            )}
                            {totalIncid === 0 && (
                              <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                                Sin incidencias
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">{alb.tienda_nombre}</span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{alb.total_lineas} líneas</span>
                            {alb.notas && <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400 italic truncate max-w-[200px]">{alb.notas}</span>
                            </>}
                          </div>
                          {/* Badges resumen si ya cargadas */}
                          {lineas && <div className="mt-1.5"><ResumenBadges lineas={lineas} /></div>}
                        </div>

                        {/* Botón ver detalle */}
                        <button
                          onClick={e => { e.stopPropagation(); setDetalle(alb); }}
                          className="flex-shrink-0 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
                          Ver detalle
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
