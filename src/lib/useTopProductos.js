import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// useTopProductos — Hook para obtener el ranking global de los 15 productos
// más vendidos en todas las estaciones de servicio.
//
// Estrategia de caché multicapa:
//   1. Memoria (instancia React activa)  → 0 ms latencia
//   2. localStorage con TTL 6 h         → persiste entre páginas
//   3. Tabla top_ventas_cache (Supabase) → datos precalculados por Edge Function
//   4. Cálculo en tiempo real           → fallback para instalaciones nuevas
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY    = 'selogas_top_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const TOP_N        = 15;

// Cache en memoria compartida entre montajes del hook en la misma sesión
let _memIds  = null;
let _memTime = 0;

function readLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, ids } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return ids;
  } catch { return null; }
}

function writeLocalCache(ids) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), ids })); } catch {}
}

/**
 * Invalida las capas de caché. Llamar después de enviar un pedido
 * para que el ranking se actualice en el próximo acceso.
 */
export function invalidateTopProductosCache() {
  _memIds  = null;
  _memTime = 0;
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/**
 * Calcula el ranking directamente desde pedido_items + pedidos.
 * Soporta miles de productos gracias a paginación interna en lotes de 1 000.
 * Reglas de desempate:
 *   1) mayor volumen de unidades vendidas
 *   2) mayor número de tiendas distintas que lo pidieron (recurrencia)
 *   3) fecha de la venta más reciente (tendencia)
 */
async function calcularRankingDirecto() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);

  const { data: pedidos, error: errP } = await supabase
    .from('pedidos')
    .select('id, tienda_id, fecha_pedido')
    .gte('fecha_pedido', desde.toISOString())
    .neq('estado', 'borrador');

  if (errP || !pedidos?.length) return [];

  const mapPedidos = Object.fromEntries(pedidos.map(p => [p.id, p]));
  const pedidoIds  = pedidos.map(p => p.id);

  // Paginación por lotes para soportar volúmenes grandes
  let allItems = [];
  const BATCH  = 1000;
  for (let i = 0; i < pedidoIds.length; i += BATCH) {
    const { data: items } = await supabase
      .from('pedido_items')
      .select('producto_id, cantidad, pedido_id')
      .in('pedido_id', pedidoIds.slice(i, i + BATCH));
    if (items?.length) allItems = allItems.concat(items);
  }

  if (!allItems.length) return [];

  // Acumulación de métricas
  const mapa = {};
  for (const item of allItems) {
    if (!item.producto_id) continue;
    const ped = mapPedidos[item.pedido_id];
    if (!mapa[item.producto_id]) {
      mapa[item.producto_id] = { unidades: 0, tiendas: new Set(), ultimaVenta: null };
    }
    mapa[item.producto_id].unidades += (item.cantidad || 0);
    if (ped?.tienda_id) mapa[item.producto_id].tiendas.add(ped.tienda_id);
    if (ped?.fecha_pedido) {
      const f = new Date(ped.fecha_pedido);
      const actual = mapa[item.producto_id].ultimaVenta;
      if (!actual || f > actual) mapa[item.producto_id].ultimaVenta = f;
    }
  }

  // Ordenar con los tres criterios de desempate
  return Object.entries(mapa)
    .sort(([, a], [, b]) => {
      if (b.unidades       !== a.unidades)       return b.unidades       - a.unidades;
      if (b.tiendas.size   !== a.tiendas.size)   return b.tiendas.size   - a.tiendas.size;
      return (b.ultimaVenta || 0) - (a.ultimaVenta || 0);
    })
    .slice(0, TOP_N)
    .map(([id]) => id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useTopProductos()
 *
 * @returns {{
 *   topSet:  Set<string>,   // IDs de los TOP_N productos más vendidos
 *   loading: boolean,       // true mientras se está calculando
 *   refresh: () => void     // fuerza recarga descartando caché
 * }}
 */
export function useTopProductos() {
  const [topSet, setTopSet] = useState(() => {
    if (_memIds && Date.now() - _memTime < CACHE_TTL_MS) return new Set(_memIds);
    return new Set();
  });
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = async (force = false) => {
    setLoading(true);
    try {
      // 1. Caché en memoria
      if (!force && _memIds && Date.now() - _memTime < CACHE_TTL_MS) {
        if (mounted.current) setTopSet(new Set(_memIds));
        return;
      }

      // 2. Caché en localStorage
      if (!force) {
        const cached = readLocalCache();
        if (cached?.length) {
          _memIds  = cached;
          _memTime = Date.now();
          if (mounted.current) setTopSet(new Set(cached));
          return;
        }
      }

      // 3. Tabla precalculada top_ventas_cache (llenada por Edge Function o trigger)
      let ids = null;
      try {
        const { data: cache } = await supabase
          .from('top_ventas_cache')
          .select('producto_id, rank')
          .order('rank', { ascending: true })
          .limit(TOP_N);
        // Usar caché si tiene al menos 1 resultado (no exigir exactamente TOP_N
        // por si el catálogo tiene menos de 15 productos)
        if (cache?.length > 0) ids = cache.map(r => r.producto_id);
      } catch {
        // La tabla aún no existe: continuar al siguiente nivel
      }

      // 4. Cálculo en tiempo real como fallback
      if (!ids?.length) ids = await calcularRankingDirecto();

      if (ids?.length) {
        _memIds  = ids;
        _memTime = Date.now();
        writeLocalCache(ids);
        if (mounted.current) setTopSet(new Set(ids));
      }
    } catch (err) {
      console.warn('[useTopProductos] Error:', err?.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { topSet, loading, refresh: () => { invalidateTopProductosCache(); load(true); } };
}
