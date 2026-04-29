import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Home, ShoppingBag, ClipboardList, Store, Package, Upload, Settings, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/almacen', icon: Store, label: 'Almacén / Tiendas' },
    { to: '/productos', icon: Package, label: 'Productos' },
    { to: '/importar', icon: Upload, label: 'Importar' },
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
  ];

  const commonLinks = [
    { to: '/inicio', icon: Home, label: 'Inicio' },
    { to: '/catalogo', icon: ShoppingBag, label: 'Catálogo' },
    { to: '/mis-pedidos', icon: ClipboardList, label: 'Mis pedidos' },
  ];

  const allLinks = isAdmin ? [...commonLinks, ...adminLinks] : commonLinks;

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-20">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">SELOGAS</div>
              <div className="text-xs text-gray-400">Sistema de Pedidos</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allLinks.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
              {(user?.nombre || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">{user?.nombre || user?.email}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.rol || 'tienda'}</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 font-medium transition-colors">
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">SELOGAS</span>
        </div>
        <button onClick={() => setMenuOpen(m => !m)} className="p-2 rounded-lg hover:bg-gray-100">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white p-4 pt-16" onClick={e => e.stopPropagation()}>
            <nav className="space-y-1">
              {allLinks.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={linkClass} onClick={() => setMenuOpen(false)}>
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t">
              <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 font-medium">
                <LogOut size={16} />Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
