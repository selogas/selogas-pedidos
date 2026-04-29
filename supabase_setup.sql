-- SELOGAS - Base de datos Supabase
-- Ejecutar este SQL en el SQL Editor de Supabase

-- =============================================
-- TABLAS PRINCIPALES
-- =============================================

-- Tabla perfiles (extiende auth.users)
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  nombre_completo TEXT,
  rol TEXT DEFAULT 'tienda' CHECK (rol IN ('admin', 'tienda')),
  tienda_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla tiendas
CREATE TABLE IF NOT EXISTS tiendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT,
  email TEXT,
  responsable TEXT,
  activa BOOLEAN DEFAULT true,
  grupo TEXT DEFAULT 'estacion' CHECK (grupo IN ('estacion', 'cafeteria')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT,
  nombre TEXT NOT NULL,
  categoria TEXT,
  subcategoria TEXT,
  formato TEXT,
  multiplo INTEGER DEFAULT 1,
  precio DECIMAL,
  imagen_url TEXT,
  disponible BOOLEAN DEFAULT true,
  favorito BOOLEAN DEFAULT false,
  orden_excel INTEGER DEFAULT 0,
  hoja_excel TEXT,
  grupo_visualizacion TEXT DEFAULT 'ambas' CHECK (grupo_visualizacion IN ('estacion', 'cafeteria', 'ambas')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido TEXT NOT NULL,
  tienda_id UUID REFERENCES tiendas(id) ON DELETE SET NULL,
  tienda_nombre TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email TEXT,
  usuario_nombre TEXT,
  fecha_pedido TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'confirmado', 'entregado')),
  observaciones TEXT,
  total_lineas INTEGER DEFAULT 0,
  email_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla pedido_items (líneas del pedido)
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  producto_codigo TEXT,
  producto_nombre TEXT,
  producto_categoria TEXT,
  producto_formato TEXT,
  cantidad INTEGER NOT NULL,
  orden_excel INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla comunicados
CREATE TABLE IF NOT EXISTS comunicados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  contenido TEXT,
  imagen_url TEXT,
  tipo TEXT DEFAULT 'comunicado' CHECK (tipo IN ('noticia', 'comunicado', 'oferta', 'aviso')),
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla configuracion
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FOREIGN KEYS
-- =============================================
ALTER TABLE perfiles 
  DROP CONSTRAINT IF EXISTS perfiles_tienda_id_fkey;
ALTER TABLE perfiles 
  ADD CONSTRAINT perfiles_tienda_id_fkey 
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE SET NULL;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles
DROP POLICY IF EXISTS "perfiles_select" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'admin'));
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- Políticas para tiendas (todos los autenticados pueden leer, solo admin puede modificar)
DROP POLICY IF EXISTS "tiendas_select" ON tiendas;
DROP POLICY IF EXISTS "tiendas_all" ON tiendas;
CREATE POLICY "tiendas_select" ON tiendas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tiendas_all" ON tiendas FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas para productos
DROP POLICY IF EXISTS "productos_select" ON productos;
DROP POLICY IF EXISTS "productos_all" ON productos;
CREATE POLICY "productos_select" ON productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "productos_all" ON productos FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas para pedidos
DROP POLICY IF EXISTS "pedidos_select" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update" ON pedidos;
CREATE POLICY "pedidos_select" ON pedidos FOR SELECT USING (
  auth.uid() = usuario_id OR 
  EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
);
CREATE POLICY "pedidos_insert" ON pedidos FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "pedidos_update" ON pedidos FOR UPDATE USING (
  auth.uid() = usuario_id OR 
  EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Políticas para pedido_items
DROP POLICY IF EXISTS "items_select" ON pedido_items;
DROP POLICY IF EXISTS "items_insert" ON pedido_items;
CREATE POLICY "items_select" ON pedido_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND (p.usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')))
);
CREATE POLICY "items_insert" ON pedido_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_id AND p.usuario_id = auth.uid())
);

-- Políticas para comunicados (todos leen, solo admin modifica)
DROP POLICY IF EXISTS "comunicados_select" ON comunicados;
DROP POLICY IF EXISTS "comunicados_all" ON comunicados;
CREATE POLICY "comunicados_select" ON comunicados FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comunicados_all" ON comunicados FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas para configuracion
DROP POLICY IF EXISTS "config_select" ON configuracion;
DROP POLICY IF EXISTS "config_all" ON configuracion;
CREATE POLICY "config_select" ON configuracion FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "config_all" ON configuracion FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- =============================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, nombre_completo, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'tienda'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- CONFIGURACIÓN INICIAL
-- =============================================
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('email_almacen', '', 'Email donde se reciben los pedidos'),
  ('asunto_email', 'Nuevo Pedido - {Tienda} - {Fecha}', 'Asunto del email de pedido'),
  ('texto_email', '', 'Texto adicional en el email')
ON CONFLICT (clave) DO NOTHING;

-- =============================================
-- ÍNDICES para mejor rendimiento
-- =============================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible);
CREATE INDEX IF NOT EXISTS idx_productos_grupo ON productos(grupo_visualizacion);
CREATE INDEX IF NOT EXISTS idx_pedidos_tienda ON pedidos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_tienda ON perfiles(tienda_id);

-- =============================================
-- Para dar rol admin al primer usuario:
-- UPDATE perfiles SET rol = 'admin' WHERE email = 'tu@email.com';
-- =============================================