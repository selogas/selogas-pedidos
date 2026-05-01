import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ShoppingCart, Package, Store, Settings, ClipboardList, LogOut, Menu, X, Upload, Home, Image } from 'lucide-react';

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [tienda, setTienda] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: p } = await supabase.from('perfiles').select('*, tiendas(*)').eq('id', u.id).single();
        setPerfil(p);
        if (p?.tiendas) setTienda(p.tiendas);
      }
    };
    getUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) getUser();
      if (event === 'SIGNED_OUT') { setUser(null); setPerfil(null); setTienda(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = perfil?.rol === 'admin';

  const navItemsTienda = [
    { path: '/Inicio', label: 'Inicio', icon: Home },
    { path: '/Catalogo', label: 'Cat\u00E1logo', icon: ShoppingCart },
    { path: '/MisPedidos', label: 'Mis Pedidos', icon: ClipboardList },
  ];

  const navItemsAdmin = [
    { path: '/Inicio', label: 'Inicio', icon: Home },
    { path: '/Catalogo', label: 'Cat\u00E1logo', icon: ShoppingCart },
    { path: '/MisPedidos', label: 'Pedidos', icon: ClipboardList },
    { path: '/Tiendas', label: 'Tiendas', icon: Store },
    { path: '/Productos', label: 'Productos', icon: Package },
    { path: '/ImportarProductos', label: 'Importar', icon: Upload },
    { path: '/SubirImagenes', label: 'Im\u00E1genes', icon: Image },
    { path: '/Configuracion', label: 'Config', icon: Settings },
  ];

  const navItems = isAdmin ? navItemsAdmin : navItemsTienda;
  const currentPath = location.pathname;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const grupoLabel = tienda?.grupo === 'cafeteria' ? 'Cafeter\u00EDa' : 'Estaci\u00F3n';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center h-14 gap-6">
          <Link to="/Catalogo" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Package size={16} color="white" />
            </div>
            <span className="font-bold text-base text-gray-900">SELOGAS</span>
          </Link>

          <button className="lg:hidden ml-auto p-2 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentPath === item.path ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            ))}
          </nav>

          {user && (
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 leading-tight">
                  {perfil?.nombre_completo?.split(" ")[0] || user.email?.split("@")[0]}
                </div>
                <div className="text-xs text-gray-400">
                  {isAdmin ? "Administrador" : (tienda ? `${tienda.nombre} \u00B7 ${grupoLabel}` : "Sin tienda")}
                </div>
              </div>
              <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Cerrar sesi\u00F3n">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-14 bottom-0 w-64 bg-white shadow-xl p-4 overflow-y-auto">
            <nav className="flex flex-col gap-1">
              {navItems.map(item => (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${currentPath === item.path ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              ))}
            </nav>
            {user && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{perfil?.nombre_completo || user.email}</div>
                  <div className="text-xs text-gray-400">
                    {isAdmin ? "Admin" : (tienda ? `${tienda.nombre} \u00B7 ${grupoLabel}` : "Sin tienda")}
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500"><LogOut size={16} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
