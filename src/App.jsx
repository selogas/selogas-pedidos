import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Catalogo from './pages/Catalogo';
import MisPedidos from './pages/MisPedidos';
import Productos from './pages/Productos';
import ImportarProductos from './pages/ImportarProductos';
import SubirImagenes from './pages/SubirImagenes';
import Configuracion from './pages/Configuracion';
import Tiendas from './pages/Tiendas';
import Caducidades from './pages/Caducidades';
import Comunicados from './pages/Comunicados';
import Dashboard from './pages/Dashboard';
import Sesiones from './pages/Sesiones';
import Preferencias from './pages/Preferencias';

// Protege rutas solo para admin — si eres tienda redirige al catálogo
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  // Mientras carga no hacer nada — isAdmin ya incluye la guarda de loading
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  return isAdmin ? children : <Navigate to="/Catalogo" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );

  return (
    <Layout>
      <Routes>
        {/* Ruta raíz → catálogo */}
        <Route path="/" element={<Navigate to="/Catalogo" replace />} />
        <Route path="/login" element={<Navigate to="/Catalogo" replace />} />

        {/* Rutas accesibles para TODOS los usuarios autenticados */}
        <Route path="/Inicio"     element={<Inicio />} />
        <Route path="/Catalogo"   element={<Catalogo />} />
        <Route path="/MisPedidos"   element={<MisPedidos />} />
        <Route path="/Caducidades"   element={<Caducidades />} />
        <Route path="/Comunicados"    element={<Comunicados />} />
        <Route path="/Dashboard"      element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/Sesiones"       element={<AdminRoute><Sesiones /></AdminRoute>} />
        <Route path="/Preferencias"   element={<Preferencias />} />

        {/* Rutas solo para ADMIN */}
        <Route path="/Productos"        element={<AdminRoute><Productos /></AdminRoute>} />
        <Route path="/ImportarProductos"element={<AdminRoute><ImportarProductos /></AdminRoute>} />
        <Route path="/SubirImagenes"    element={<AdminRoute><SubirImagenes /></AdminRoute>} />
        <Route path="/Configuracion"    element={<AdminRoute><Configuracion /></AdminRoute>} />
        <Route path="/Tiendas"          element={<AdminRoute><Tiendas /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/Catalogo" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
