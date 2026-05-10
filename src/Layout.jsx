import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ShoppingCart, Package, Store, Settings, ClipboardList, LogOut, Menu, X, Upload, Home, Image, Bell, AlertTriangle, BarChart2, Radio } from 'lucide-react';

export default function Layout({ children }) {
  const { user, perfil, isAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerCerrado, setBannerCerrado] = useState(false);
  const location = useLocation();

  const tienda = perfil?.tiendas || null;
  const grupoLabel = tienda?.grupo === 'cafeteria' ? 'Cafetería' : 'Estación';
  const nombreUsuario = (perfil?.nombre_completo || perfil?.nombre)?.split(' ')[0]
    || user?.email?.split('@')[0] || '';

  // Banner: solo se muestra a tiendas con mensaje activo
  const mensajeBanner = !isAdmin && tienda?.nombre !== 'PRINCIPAL' && tienda?.mensaje_banner?.trim()
    ? tienda.mensaje_banner.trim()
    : null;

  const navItemsTienda = [
    { path: '/Inicio',     label: 'Inicio',      icon: Home },
    { path: '/Catalogo',   label: 'Catálogo',    icon: ShoppingCart },
    { path: '/MisPedidos',   label: 'Mis Pedidos', icon: ClipboardList },
    { path: '/Caducidades',  label: 'Caducidades', icon: AlertTriangle },
    { path: '/Comunicados',   label: 'Avisos',       icon: Bell },
  ];

  const navItemsAdmin = [
    { path: '/Inicio',            label: 'Inicio',    icon: Home },
    { path: '/Catalogo',          label: 'Catálogo',  icon: ShoppingCart },
    { path: '/MisPedidos',        label: 'Pedidos',     icon: ClipboardList },
    { path: '/Caducidades',        label: 'Caducidades', icon: AlertTriangle },
    { path: '/Comunicados',        label: 'Comunicados',  icon: Bell },
    { path: '/Dashboard',          label: 'Dashboard',    icon: BarChart2 },
    { path: '/Sesiones',           label: 'Sesiones',     icon: Radio },
    { path: '/Tiendas',           label: 'Tiendas',   icon: Store },
    { path: '/Productos',         label: 'Productos', icon: Package },
    { path: '/ImportarProductos', label: 'Importar',  icon: Upload },
    { path: '/SubirImagenes',     label: 'Imágenes',  icon: Image },
    { path: '/Configuracion',     label: 'Config',    icon: Settings },
  ];

  const navItems = isAdmin ? navItemsAdmin : navItemsTienda;
  const currentPath = location.pathname;

  const handleLogout = () => signOut();

  const NavLink = ({ item, mobile = false }) => (
    <Link
      to={item.path}
      onClick={() => mobile && setSidebarOpen(false)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${mobile ? 'gap-2 py-2.5' : ''}
        ${currentPath === item.path
          ? 'bg-[#00913f] text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      <item.icon size={mobile ? 16 : 15} />
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Banner de mensaje para tiendas ── */}
      {mensajeBanner && !bannerCerrado && (
        <div className="bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between gap-3 sticky top-0 z-50">
          <div className="flex items-center gap-2 flex-1 justify-center">
            <Bell size={15} className="flex-shrink-0" />
            <span className="text-sm font-semibold text-center">{mensajeBanner}</span>
          </div>
          <button
            onClick={() => setBannerCerrado(true)}
            className="flex-shrink-0 p-1 hover:bg-amber-500 rounded transition-colors"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ top: mensajeBanner && !bannerCerrado ? '36px' : '0' }}>
        <div className="max-w-[1400px] mx-auto px-4 flex items-center h-14 gap-6">

          <Link to="/Catalogo" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#00913f]">
              <Package size={16} color="white" />
            </div>
            <span className="font-bold text-base text-gray-900">SELOGAS</span>
          </Link>

          <button
            className="lg:hidden ml-auto p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {navItems.map(item => <NavLink key={item.path} item={item} />)}
          </nav>

          {user && (
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 leading-tight">{nombreUsuario}</div>
                <div className="text-xs text-gray-400">
                  {isAdmin ? 'Administrador' : (tienda ? `${tienda.nombre} · ${grupoLabel}` : 'Sin tienda')}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Sidebar mobile ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 bottom-0 w-64 bg-white shadow-xl p-4 overflow-y-auto"
               style={{ top: mensajeBanner && !bannerCerrado ? '86px' : '56px' }}>
            <nav className="flex flex-col gap-1">
              {navItems.map(item => <NavLink key={item.path} item={item} mobile />)}
            </nav>
            {user && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{nombreUsuario}</div>
                  <div className="text-xs text-gray-400">
                    {isAdmin ? 'Admin' : (tienda ? `${tienda.nombre} · ${grupoLabel}` : 'Sin tienda')}
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Contenido ── */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
