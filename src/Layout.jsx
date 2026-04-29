import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./lib/auth";
import {
  ShoppingCart, Package, Store, Settings, ClipboardList, LogOut, Menu, X, Warehouse
} from "lucide-react";

export default function Layout({ children, currentPageName }) {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = isAdmin
    ? [
        { name: "Inicio", label: "Inicio", icon: Package },
        { name: "Catalogo", label: "Catálogo", icon: ShoppingCart },
        { name: "MisPedidos", label: "Mis Pedidos", icon: ClipboardList },
        { name: "Tiendas", label: "Almacén", icon: Warehouse },
        { name: "Productos", label: "Productos", icon: Package },
        { name: "ImportarProductos", label: "Importar", icon: Package },
        { name: "Configuracion", label: "Configuración", icon: Settings },
      ]
    : [
        { name: "Inicio", label: "Inicio", icon: Package },
        { name: "Catalogo", label: "Catálogo", icon: ShoppingCart },
        { name: "MisPedidos", label: "Mis Pedidos", icon: ClipboardList },
      ];

  const isActive = (name) => currentPageName === name;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center h-14 gap-8">
          <Link to="/Catalogo" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Package size={16} color="white" />
            </div>
            <span className="font-bold text-base text-gray-900">Pedidos</span>
          </Link>
          <button
            className="lg:hidden ml-auto p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {navItems.map(item => (
              <Link
                key={item.name}
                to={`/${item.name}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.name)
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
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
                  {user.tienda_nombre || user.email?.split("@")[0]}
                </div>
                <div className="text-xs text-gray-400">
                  {isAdmin ? "Administrador" : "Tienda"}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                title="Cerrar sesión"
              >
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
                <Link
                  key={item.name}
                  to={`/${item.name}`}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.name) ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
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
                  <div className="text-sm font-semibold">{user.tienda_nombre || user.email}</div>
                  <div className="text-xs text-gray-400">{isAdmin ? "Admin" : "Tienda"}</div>
                </div>
                <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500">
                  <LogOut size={16} />
                </button>
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