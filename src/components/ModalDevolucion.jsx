import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Search, Trash2, Plus, Loader2, AlertCircle, Send, RotateCcw } from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 800;
const RETRY_DELAY_MS = 5000;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ModalDevolucion({
  borradorInicial,   // { id, observaciones, devolucion_items: [...] } | null
  productos,         // catálogo ya cargado en Catalogo.jsx — sin queries extra
  tienda,
  usuario,
  onEnviada,         // () => void — se llama cuando pedido+devolución se envían
  onCancelar,        // () => void — cancela la devolución, envía solo el pedido
  onClose,           // () => void — cierra sin enviar nada (pedido queda pendiente)
  enviandoPedido,    // bool — spinner mientras se procesa el envío total
}) {
  // ── Estado del formulario ────────────────────────────────────────
  const [lineas, setLineas]             = useState(() => {
    if (!borradorInicial?.devolucion_items?.length) return [];
    return borradorInicial.devolucion_items.map(it => ({
      _key:             it.id || Math.random().toString(36).slice(2),
      producto_id:      it.producto_id || null,
      producto_codigo:  it.producto_codigo || '',
      producto_nombre:  it.producto_nombre || '',
      producto_formato: it.producto_formato || '',
      cantidad:         it.cantidad || 1,
      observaciones:    it.observaciones || '',
    }));
  });
  const [obsGenerales, setObsGenerales] = useState(borradorInicial?.observaciones || '');
  const [borradorId, setBorradorId]     = useState(borradorInicial?.id || null);

  // ── Estado de sincronización ─────────────────────────────────────
  const [syncState, setSyncState]       = useState('ok'); // 'ok' | 'saving' | 'error' | 'offline'
  const pendienteRef                    = useRef(false);   // hay cambios sin guardar
  const lineasRef                       = useRef(lineas);
  const obsRef                          = useRef(obsGenerales);

  // ── Estado UI ────────────────────────────────────────────────────
  const [busqueda, setBusqueda]         = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [creandoBorrador, setCreandoBorrador] = useState(!borradorInicial?.id);
  const busquedaRef                     = useRef(null);
  const debounceTimer                   = useRef(null);
  const retryTimer                      = useRef(null);

  // ─── Mantener refs sincronizadas con state ───────────────────────
  useEffect(() => { lineasRef.current = lineas; }, [lineas]);
  useEffect(() => { obsRef.current = obsGenerales; }, [obsGenerales]);

  // ─── Crear borrador si no existe todavía ─────────────────────────
  useEffect(() => {
    if (borradorId) { setCreandoBorrador(false); return; }
    const crear = async () => {
      try {
        const { data, error } = await supabase.from('devoluciones').insert([{
          tienda_id:      tienda?.id || null,
          usuario_id:     usuario?.id || null,
          tienda_nombre:  tienda?.nombre || '',
          usuario_nombre: usuario?.nombre || usuario?.nombre_completo || '',
          usuario_email:  usuario?.email || '',
          estado:         'borrador',
        }]).select().single();
        if (error) throw error;
        setBorradorId(data.id);
        console.log('[DEVOLUCION] Borrador creado:', data.id);
      } catch (err) {
        console.error('[DEVOLUCION] Error creando borrador:', err.message);
        setSyncState('error');
      } finally {
        setCreandoBorrador(false);
      }
    };
    crear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Función de guardado real ────────────────────────────────────
  const guardarEnSupabase = useCallback(async (idBorrador, lineasActuales, obsActuales) => {
    if (!idBorrador) return;
    setSyncState('saving');
    try {
      // DELETE + INSERT batch — una transacción lógica, dos queries
      await supabase.from('devolucion_items').delete().eq('devolucion_id', idBorrador);
      if (lineasActuales.length > 0) {
        const rows = lineasActuales.map(l => ({
          devolucion_id:    idBorrador,
          producto_id:      l.producto_id || null,
          producto_codigo:  l.producto_codigo,
          producto_nombre:  l.producto_nombre,
          producto_formato: l.producto_formato || null,
          cantidad:         l.cantidad,
          observaciones:    l.observaciones || null,
        }));
        const { error } = await supabase.from('devolucion_items').insert(rows);
        if (error) throw error;
      }
      // Actualizar observaciones generales y updated_at
      await supabase.from('devoluciones')
        .update({ observaciones: obsActuales || null, updated_at: new Date().toISOString() })
        .eq('id', idBorrador);

      pendienteRef.current = false;
      setSyncState('ok');
      if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
      console.log('[DEVOLUCION] Autosave OK — líneas:', lineasActuales.length);
    } catch (err) {
      console.error('[DEVOLUCION] Error autosave:', err.message);
      setSyncState(navigator.onLine ? 'error' : 'offline');
      // Reintento automático en 5s
      retryTimer.current = setTimeout(() => {
        if (pendienteRef.current) {
          guardarEnSupabase(borradorId, lineasRef.current, obsRef.current);
        }
      }, RETRY_DELAY_MS);
    }
  }, [borradorId]);

  // ─── Disparar autosave con debounce ─────────────────────────────
  const programarGuardado = useCallback(() => {
    pendienteRef.current = true;
    if (!borradorId) return; // esperar a que se cree el borrador
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      guardarEnSupabase(borradorId, lineasRef.current, obsRef.current);
    }, DEBOUNCE_MS);
  }, [borradorId, guardarEnSupabase]);

  // ─── Detectar reconexión y reintentar ───────────────────────────
  useEffect(() => {
    const onOnline = () => {
      if (pendienteRef.current && borradorId) {
        console.log('[DEVOLUCION] Conexión restaurada — reintentando guardado');
        guardarEnSupabase(borradorId, lineasRef.current, obsRef.current);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [borradorId, guardarEnSupabase]);

  // ─── Guardar antes de cerrar si hay cambios pendientes ──────────
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimer.current);
      clearTimeout(retryTimer.current);
    };
  }, []);

  // ─── Autocomplete — filtro local sobre catálogo en memoria ───────
  const resultadosBusqueda = (() => {
    const q = busqueda.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const yaEnLineas = new Set(lineas.map(l => l.producto_id).filter(Boolean));
    return productos
      .filter(p =>
        (p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)) &&
        !yaEnLineas.has(p.id)
      )
      .slice(0, 8);
  })();

  // ─── Añadir producto desde autocomplete ─────────────────────────
  const handleSeleccionarProducto = (prod) => {
    const nuevaLinea = {
      _key:             Math.random().toString(36).slice(2),
      producto_id:      prod.id,
      producto_codigo:  prod.codigo || prod.referencia || '',
      producto_nombre:  prod.nombre || '',
      producto_formato: prod.formato || '',
      cantidad:         1,
      observaciones:    '',
    };
    setLineas(prev => {
      const updated = [...prev, nuevaLinea];
      lineasRef.current = updated;
      return updated;
    });
    setBusqueda('');
    setDropdownOpen(false);
    programarGuardado();
  };

  // ─── Modificar línea ─────────────────────────────────────────────
  const handleCambioLinea = (key, campo, valor) => {
    setLineas(prev => {
      const updated = prev.map(l => l._key === key ? { ...l, [campo]: valor } : l);
      lineasRef.current = updated;
      return updated;
    });
    programarGuardado();
  };

  // ─── Eliminar línea ──────────────────────────────────────────────
  const handleEliminarLinea = (key) => {
    setLineas(prev => {
      const updated = prev.filter(l => l._key !== key);
      lineasRef.current = updated;
      return updated;
    });
    programarGuardado();
  };

  // ─── Cambio en observaciones generales ──────────────────────────
  const handleObsGenerales = (val) => {
    setObsGenerales(val);
    obsRef.current = val;
    programarGuardado();
  };

  // ─── Enviar devolución ───────────────────────────────────────────
  const handleEnviar = async () => {
    if (lineas.length === 0) return;
    // Guardar estado final antes de enviar (flush)
    clearTimeout(debounceTimer.current);
    if (pendienteRef.current) {
      await guardarEnSupabase(borradorId, lineasRef.current, obsRef.current);
    }
    onEnviada(borradorId, lineas, obsGenerales);
  };

  // ─── Cancelar devolución ─────────────────────────────────────────
  const handleConfirmarCancelar = async () => {
    if (borradorId) {
      // Eliminar borrador silenciosamente — no bloquear flujo del pedido
      supabase.from('devoluciones').delete().eq('id', borradorId).then(({ error }) => {
        if (error) console.error('[DEVOLUCION] Error eliminando borrador:', error.message);
        else console.log('[DEVOLUCION] Borrador eliminado');
      });
    }
    onCancelar();
  };

  // ─── UI de estado de sincronización ─────────────────────────────
  const SyncIndicator = () => {
    if (syncState === 'saving') return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 size={11} className="animate-spin" /> Guardando...
      </span>
    );
    if (syncState === 'error') return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertCircle size={11} /> No guardado — reintentando
      </span>
    );
    if (syncState === 'offline') return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle size={11} /> Sin conexión — se guardará al reconectar
      </span>
    );
    return (
      <span className="text-xs text-gray-300">✓ Guardado</span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────
  if (creandoBorrador) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
        <Loader2 size={32} className="animate-spin text-[#00913f]" />
        <p className="text-sm text-gray-500 font-medium">Preparando devolución...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* ── Cabecera ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#00913f] rounded-t-2xl">
          <div>
            <h2 className="font-bold text-white text-base">Hoja de Devolución</h2>
            <p className="text-xs text-[#d9f0e4] mt-0.5">
              {tienda?.nombre} · {new Date().toLocaleDateString('es-ES')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#007a34] text-white transition-colors"
              title="Cerrar (el pedido queda pendiente)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Buscador autocomplete ── */}
        <div className="px-5 pt-4 pb-2 relative">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={busquedaRef}
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Buscar producto por nombre o código..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00913f] bg-gray-50"
            />
          </div>
          {/* Dropdown resultados */}
          {dropdownOpen && resultadosBusqueda.length > 0 && (
            <div className="absolute left-5 right-5 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {resultadosBusqueda.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => handleSeleccionarProducto(prod)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#edf7f2] text-left transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="font-mono text-xs text-gray-400 w-16 flex-shrink-0 truncate">
                    {prod.codigo || '—'}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 font-medium truncate">{prod.nombre}</span>
                  {prod.formato && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{prod.formato}</span>
                  )}
                  <Plus size={14} className="text-[#00913f] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          {dropdownOpen && busqueda.trim().length >= 2 && resultadosBusqueda.length === 0 && (
            <div className="absolute left-5 right-5 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-gray-400">
              Sin resultados para "{busqueda}"
            </div>
          )}
        </div>

        {/* ── Tabla de líneas ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-2" onClick={() => setDropdownOpen(false)}>
          {lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
              <RotateCcw size={36} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Sin productos añadidos</p>
              <p className="text-xs mt-1">Usa el buscador para añadir productos a devolver</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">REF.</th>
                  <th className="text-left py-2 pr-3 text-xs font-bold text-gray-500 uppercase tracking-wide">DESCRIPCIÓN</th>
                  <th className="text-center py-2 pr-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-16">UDS.</th>
                  <th className="text-left py-2 pr-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-32">OBSERV.</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineas.map(linea => (
                  <tr key={linea._key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-gray-500">{linea.producto_codigo || '—'}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-sm font-medium text-gray-800 leading-snug">{linea.producto_nombre}</div>
                      {linea.producto_formato && (
                        <div className="text-xs text-gray-400">{linea.producto_formato}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={linea.cantidad}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (v > 0) handleCambioLinea(linea._key, 'cantidad', v);
                        }}
                        className="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm font-bold focus:outline-none focus:border-[#00913f]"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={linea.observaciones}
                        onChange={e => handleCambioLinea(linea._key, 'observaciones', e.target.value)}
                        placeholder="Opcional..."
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00913f]"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => handleEliminarLinea(linea._key)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Observaciones generales ── */}
        <div className="px-5 pt-2 pb-3 border-t border-gray-100">
          <textarea
            rows={2}
            value={obsGenerales}
            onChange={e => handleObsGenerales(e.target.value)}
            placeholder="Observaciones generales de la devolución (opcional)..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#00913f] bg-gray-50"
          />
        </div>

        {/* ── Aviso líneas vacías ── */}
        {lineas.length === 0 && (
          <div className="px-5 pb-2">
            <p className="text-xs text-amber-600 text-center">
              Añade al menos un producto para enviar la devolución
            </p>
          </div>
        )}

        {/* ── Footer con botones ── */}
        {!confirmCancelar ? (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => setConfirmCancelar(true)}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar devolución
            </button>
            <button
              onClick={handleEnviar}
              disabled={lineas.length === 0 || enviandoPedido || creandoBorrador}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors
                ${lineas.length === 0 || enviandoPedido
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#00913f] text-white hover:bg-[#007a34]'
                }`}
            >
              {enviandoPedido
                ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                : <><Send size={15} /> Enviar pedido + devolución</>
              }
            </button>
          </div>
        ) : (
          /* ── Confirmación cancelar ── */
          <div className="px-5 py-4 border-t border-amber-100 bg-amber-50 rounded-b-2xl">
            <p className="text-sm font-semibold text-amber-800 mb-1">¿Cancelar la devolución?</p>
            <p className="text-xs text-amber-600 mb-3">
              El pedido se enviará igualmente, sin la devolución.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancelar(false)}
                className="flex-1 py-2 border border-amber-300 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmarCancelar}
                className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
              >
                Sí, cancelar devolución
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
