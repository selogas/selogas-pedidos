import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Catalogo from './pages/Catalogo';
import MisPedidos from './pages/MisPedidos';
import Productos from './pages/Productos';
import ImportarProductos from './pages/ImportarProductos';
import Configuracion from './pages/Configuracion';
import AlmacenTiendas from './pages/AlmacenTiendas';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/catalogo" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/inicio" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="inicio" element={<Inicio />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="mis-pedidos" element={<MisPedidos />} />
        <Route path="almacen" element={<ProtectedRoute adminOnly><AlmacenTiendas /></ProtectedRoute>} />
        <Route path="productos" element={<ProtectedRoute adminOnly><Productos /></ProtectedRoute>} />
        <Route path="importar" element={<ProtectedRoute adminOnly><ImportarProductos /></ProtectedRoute>} />
        <Route path="configuracion" element={<ProtectedRoute adminOnly><Configuracion /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
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
