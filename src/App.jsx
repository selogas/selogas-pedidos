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
import Tiendas from './pages/Tiendas';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
        <Route path="/" element={<Navigate to="/Catalogo" replace />} />
        <Route path="/login" element={<Navigate to="/Catalogo" replace />} />
        <Route path="/Inicio" element={<Inicio />} />
        <Route path="/Catalogo" element={<Catalogo />} />
        <Route path="/MisPedidos" element={<MisPedidos />} />
        <Route path="/Productos" element={<Productos />} />
        <Route path="/ImportarProductos" element={<ImportarProductos />} />
        <Route path="/Configuracion" element={<Configuracion />} />
        <Route path="/Tiendas" element={<Tiendas />} />
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