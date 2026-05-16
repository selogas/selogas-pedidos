-- ═══════════════════════════════════════════════════════════════════════════
-- SELOGAS — Funcionalidad de Top Ventas (Productos Destacados)
-- Ejecutar en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLA DE CACHÉ DEL RANKING GLOBAL
--    Almacena los 15 productos más vendidos, precalculados.
--    Se actualiza automáticamente por la Edge Function o por el trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS top_ventas_cache (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id     UUID    REFERENCES productos(id) ON DELETE CASCADE,
  rank            INTEGER NOT NULL,             -- Posición 1-15
  unidades_total  INTEGER DEFAULT 0,            -- Volumen vendido (90 días)
  tiendas_count   INTEGER DEFAULT 0,            -- Recurrencia: nº tiendas distintas
  ultima_venta    TIMESTAMPTZ,                  -- Tendencia: fecha más reciente
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_ventas_rank        ON top_ventas_cache(rank);
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_ventas_producto_id ON top_ventas_cache(producto_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS (Row Level Security)
--    Lectura pública para usuarios autenticados.
--    Escritura solo por service_role (la Edge Function usa la service key).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE top_ventas_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "top_ventas_select" ON top_ventas_cache;
CREATE POLICY "top_ventas_select"
  ON top_ventas_cache FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNCIÓN SQL: recalcular_top_ventas()
--    Calcula el ranking de los 15 productos más vendidos (últimos 90 días)
--    con los tres criterios de desempate y actualiza la tabla de caché.
--    Se ejecuta directamente desde Supabase o desde la Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalcular_top_ventas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_desde TIMESTAMPTZ := NOW() - INTERVAL '90 days';
BEGIN
  -- Vaciar la caché anterior y recalcular en una sola operación atómica.
  -- El bloque EXCEPTION garantiza que si el INSERT falla, el DELETE se revierte
  -- y la caché no queda vacía.
  DELETE FROM top_ventas_cache;

  INSERT INTO top_ventas_cache (producto_id, rank, unidades_total, tiendas_count, ultima_venta, updated_at)
  WITH ranking AS (
    SELECT
      pi.producto_id,
      SUM(pi.cantidad)            AS unidades_total,
      COUNT(DISTINCT p.tienda_id) AS tiendas_count,
      MAX(p.fecha_pedido)         AS ultima_venta
    FROM pedido_items pi
    INNER JOIN pedidos p ON p.id = pi.pedido_id
    WHERE
      p.fecha_pedido >= v_desde
      AND p.estado != 'borrador'
      AND pi.producto_id IS NOT NULL
    GROUP BY pi.producto_id
  )
  SELECT
    producto_id,
    ROW_NUMBER() OVER (
      ORDER BY
        unidades_total DESC, -- 1º criterio: mayor volumen
        tiendas_count  DESC, -- 2º criterio: más tiendas distintas (recurrencia)
        ultima_venta   DESC  -- 3º criterio: venta más reciente (tendencia)
    ) AS rank,
    unidades_total,
    tiendas_count,
    ultima_venta,
    NOW()
  FROM ranking
  LIMIT 15;

EXCEPTION
  WHEN OTHERS THEN
    -- Si el INSERT falla, relanzar el error. PostgreSQL revertirá el DELETE
    -- ya que ambas sentencias están en el mismo bloque transaccional.
    RAISE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: actualizar caché cuando se inserta un nuevo pedido_item
--    Usa una cola de actualización diferida para evitar recalcular en
--    cada línea de pedido (puede haber decenas por pedido).
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla de cola para actualizaciones diferidas (evita recalcular en cada INSERT)
CREATE TABLE IF NOT EXISTS top_ventas_refresh_queue (
  id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE top_ventas_refresh_queue ENABLE ROW LEVEL SECURITY;

-- Función que encola una actualización (no recalcula inmediatamente)
CREATE OR REPLACE FUNCTION encolar_top_ventas_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insertar solo si no hay una entrada reciente (throttle: no más de 1 por minuto)
  INSERT INTO top_ventas_refresh_queue (created_at)
  SELECT NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM top_ventas_refresh_queue
    WHERE created_at > NOW() - INTERVAL '1 minute'
  );
  RETURN NEW;
END;
$$;

-- Trigger que dispara la cola cuando se cierra un pedido (estado → 'enviado')
DROP TRIGGER IF EXISTS trg_top_ventas_pedido ON pedidos;
CREATE TRIGGER trg_top_ventas_pedido
  AFTER UPDATE OF estado ON pedidos
  FOR EACH ROW
  WHEN (NEW.estado = 'enviado' AND OLD.estado IS DISTINCT FROM 'enviado')
  EXECUTE FUNCTION encolar_top_ventas_refresh();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VISTA: top_ventas_detalle (opcional, para el panel de admin)
--    Muestra el ranking con información completa del producto.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW top_ventas_detalle AS
SELECT
  tvc.rank,
  tvc.producto_id,
  p.nombre                          AS producto_nombre,
  p.codigo                          AS producto_codigo,
  p.imagen_url,
  cat.nombre                        AS categoria,
  tvc.unidades_total,
  tvc.tiendas_count,
  tvc.ultima_venta,
  tvc.updated_at                    AS cache_actualizada
FROM top_ventas_cache    tvc
JOIN productos           p   ON p.id  = tvc.producto_id
LEFT JOIN categorias     cat ON cat.id = p.categoria_id
ORDER BY tvc.rank;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PRIMERA EJECUCIÓN — Poblar la caché inicialmente
-- ─────────────────────────────────────────────────────────────────────────────

SELECT recalcular_top_ventas();

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT * FROM top_ventas_detalle;
