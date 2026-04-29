-- =============================================
-- SELOGAS - Setup Base de Datos Supabase
-- Ejecutar en SQL Editor de tu proyecto Supabase
-- =============================================

-- 1. Tabla de tiendas
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

-- 2. Tabla de perfiles (usuarios)
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nombre_completo TEXT,
  rol TEXT DEFAULT 'tienda' CHECK (rol IN ('admin', 'tienda')),
  tienda_id UUID REFERENCES tiendas(id),
  nombre_tienda TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de productos
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido TEXT,
  tienda_id UUID,
  tienda_nombre TEXT NOT NULL,
  usuario_email TEXT,
  usuario_nombre TEXT,
  fecha_pedido TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'confirmado', 'entregado')),
  observaciones TEXT,
  total_lineas INTEGER DEFAULT 0,
  email_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de lineas de pedido
CREATE TABLE IF NOT EXISTS pedido_lineas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID,
  producto_codigo TEXT,
  producto_nombre TEXT,
  producto_categoria TEXT,
  producto_formato TEXT,
  cantidad INTEGER NOT NULL,
  orden_excel INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de configuracion
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de comunicados
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

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

-- Políticas: autenticados pueden leer todo
CREATE POLICY "Autenticados pueden leer tiendas" ON tiendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados pueden leer productos" ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados pueden leer comunicados" ON comunicados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados pueden leer configuracion" ON configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados pueden leer pedidos" ON pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados pueden leer lineas" ON pedido_lineas FOR SELECT TO authenticated USING (true);

-- Políticas de escritura (todos los autenticados)
CREATE POLICY "Autenticados pueden crear pedidos" ON pedidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados pueden actualizar pedidos" ON pedidos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados pueden crear lineas" ON pedido_lineas FOR INSERT TO authenticated WITH CHECK (true);

-- Admin puede hacer todo
CREATE POLICY "Admin puede gestionar tiendas" ON tiendas FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol = 'admin')
);
CREATE POLICY "Admin puede gestionar productos" ON productos FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol = 'admin')
);
CREATE POLICY "Admin puede gestionar comunicados" ON comunicados FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol = 'admin')
);
CREATE POLICY "Admin puede gestionar configuracion" ON configuracion FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol = 'admin')
);

-- Perfiles: cada usuario ve el suyo
CREATE POLICY "Ver propio perfil" ON perfiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin ve todos los perfiles" ON perfiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol = 'admin')
);

-- =============================================
-- STORAGE: Bucket para uploads
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Uploads publicos" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Autenticados pueden subir" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');

-- =============================================
-- INSTRUCCIONES POST-SETUP:
-- 1. Ir a Authentication > Users > Add user
-- 2. Crear tu usuario admin con email y password
-- 3. Ejecutar:
--    INSERT INTO perfiles (user_id, email, rol) 
--    VALUES ('UUID-DE-TU-USUARIO', 'tu@email.com', 'admin');
-- =============================================