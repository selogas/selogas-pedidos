-- ═══════════════════════════════════════════════════════════════════════════
-- SELOGAS Pedidos — Backup de Base de Datos Supabase
-- Fecha: 16 de mayo de 2026
-- Proyecto: pasllyqgczegpvquaxvb (eu-west-1)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS ACTIVAS EN PRODUCCIÓN (19 tablas)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. categorias
CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  grupo TEXT
);

-- 2. comunicados
CREATE TABLE IF NOT EXISTS comunicados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT,
  contenido TEXT,
  activo BOOLEAN DEFAULT true,
  destacado BOOLEAN,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  imagen_url TEXT,
  texto TEXT,
  visible BOOLEAN,
  orden INTEGER,
  tipo TEXT,
  mensaje TEXT,
  destinatario TEXT,
  tienda_id UUID,
  expires_at TIMESTAMPTZ
);

-- 3. configuracion
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descripcion TEXT,
  updated_at TIMESTAMPTZ
);

-- 4. favoritos
CREATE TABLE IF NOT EXISTS favoritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id UUID NOT NULL,
  producto_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. hojas_orden
CREATE TABLE IF NOT EXISTS hojas_orden (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  posicion INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. novedades
CREATE TABLE IF NOT EXISTS novedades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT,
  descripcion TEXT,
  imagen_url TEXT NOT NULL,
  enlace TEXT,
  orden INTEGER,
  activa BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 7. palet_productos
CREATE TABLE IF NOT EXISTS palet_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. palet_solicitudes
CREATE TABLE IF NOT EXISTS palet_solicitudes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  palet_producto_id UUID NOT NULL,
  tienda_id UUID NOT NULL,
  perfil_id UUID,
  nombre_producto TEXT NOT NULL,
  nombre_tienda TEXT NOT NULL,
  nombre_usuario TEXT,
  email_tienda TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. palet_tiendas
CREATE TABLE IF NOT EXISTS palet_tiendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  palet_producto_id UUID NOT NULL,
  tienda_id UUID NOT NULL
);

-- 10. pedido_items
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC,
  subtotal NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  producto_codigo TEXT,
  producto_nombre TEXT,
  producto_categoria TEXT,
  producto_formato TEXT,
  orden_excel INTEGER
);

-- 11. pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido TEXT NOT NULL,
  tienda_id UUID REFERENCES tiendas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'borrador',
  total NUMERIC,
  notas TEXT,
  email_enviado BOOLEAN DEFAULT false,
  fecha_entrega_solicitada DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  tienda_nombre TEXT,
  usuario_email TEXT,
  usuario_nombre TEXT,
  fecha_pedido TIMESTAMPTZ DEFAULT NOW(),
  observaciones TEXT,
  total_lineas INTEGER
);

-- 12. perfiles
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'tienda',
  tienda_id UUID,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  tienda_nombre TEXT,
  nombre_completo TEXT
);

-- 13. plantillas_pedido
CREATE TABLE IF NOT EXISTS plantillas_pedido (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  items JSONB,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 14. preferencias_tienda
CREATE TABLE IF NOT EXISTS preferencias_tienda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id UUID NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. producto_tiendas
CREATE TABLE IF NOT EXISTS producto_tiendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL,
  tienda_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT,
  nombre TEXT NOT NULL,
  imagen_url TEXT,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  disponible BOOLEAN DEFAULT true,
  multiplo INTEGER DEFAULT 1,
  minimo INTEGER,
  orden_excel INTEGER DEFAULT 0,
  columna_excel INTEGER,
  hoja_excel TEXT,
  seccion_excel TEXT,
  grupo_visualizacion TEXT DEFAULT 'ambas',
  etiqueta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 17. sesiones_activas
CREATE TABLE IF NOT EXISTS sesiones_activas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID NOT NULL,
  tienda_id UUID,
  tienda_nombre TEXT,
  usuario_nombre TEXT,
  ultima_actividad TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. tiendas
CREATE TABLE IF NOT EXISTS tiendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT,
  email TEXT,
  responsable TEXT,
  activa BOOLEAN DEFAULT true,
  grupo TEXT DEFAULT 'estacion',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  google_calendar_id TEXT,
  mensaje_banner TEXT,
  doble_pedido BOOLEAN DEFAULT false,
  pref_plantilla BOOLEAN DEFAULT true,
  pref_avisos_cantidad BOOLEAN DEFAULT true,
  pref_doble_pedido_aviso BOOLEAN DEFAULT true,
  pref_aviso_caducidad BOOLEAN DEFAULT true
);

-- 19. top_ventas_cache
CREATE TABLE IF NOT EXISTS top_ventas_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  unidades_total INTEGER DEFAULT 0,
  tiendas_count INTEGER DEFAULT 0,
  ultima_venta TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible);
CREATE INDEX IF NOT EXISTS idx_productos_grupo ON productos(grupo_visualizacion);
CREATE INDEX IF NOT EXISTS idx_pedidos_tienda ON pedidos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_tienda ON perfiles(tienda_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_ventas_rank ON top_ventas_cache(rank);
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_ventas_producto_id ON top_ventas_cache(producto_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_unique ON favoritos(tienda_id, producto_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesiones_perfil ON sesiones_activas(perfil_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_activas ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE palet_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE palet_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE palet_tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_ventas_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE novedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_tiendas ENABLE ROW LEVEL SECURITY;

-- Políticas lectura autenticados
CREATE POLICY "select_auth" ON productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON categorias FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON tiendas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON comunicados FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON configuracion FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON novedades FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON palet_productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "select_auth" ON top_ventas_cache FOR SELECT TO authenticated USING (true);

-- Políticas admin (escritura)
CREATE POLICY "admin_all" ON productos FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin_all" ON categorias FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin_all" ON tiendas FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin_all" ON comunicados FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "admin_all" ON configuracion FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas perfiles
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'admin'));
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- Políticas pedidos
CREATE POLICY "pedidos_select" ON pedidos FOR SELECT USING (auth.uid() = usuario_id OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "pedidos_insert" ON pedidos FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "pedidos_update" ON pedidos FOR UPDATE USING (auth.uid() = usuario_id OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: crear perfil al registrarse
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, nombre_completo, nombre, rol)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'tienda')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DEL BACKUP — 16/05/2026
-- Para restaurar: ejecutar este SQL en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────────────────
