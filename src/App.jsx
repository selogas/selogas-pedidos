import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './Layout';
import Login from './pages/Login';
import Catalogo from './pages/Catalogo';
import MisPedidos from './pages/MisPedidos';
import Inicio from './pages/Inicio';
import Tiendas from './pages/Tiendas';
import Productos from './pages/Productos';
import ImportarProductos from './pages/ImportarProductos';
import Configuracion from './pages/Configuracion';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } }
});

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/Catalogo" replace />;
  return children;
};

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/Catalogo" replace />} />
      <Route path="/" element={<Navigate to="/Catalogo" replace />} />
      <Route path="/Inicio" element={<ProtectedRoute><Layout currentPageName="Inicio"><Inicio /></Layout></ProtectedRoute>} />
      <Route path="/Catalogo" element={<ProtectedRoute><Layout currentPageName="Catalogo"><Catalogo /></Layout></ProtectedRoute>} />
      <Route path="/MisPedidos" element={<ProtectedRoute><Layout currentPageName="MisPedidos"><MisPedidos /></Layout></ProtectedRoute>} />
      <Route path="/Tiendas" element={<ProtectedRoute adminOnly><Layout currentPageName="Tiendas"><Tiendas /></Layout></ProtectedRoute>} />
      <Route path="/Productos" element={<ProtectedRoute adminOnly><Layout currentPageName="Productos"><Productos /></Layout></ProtectedRoute>} />
      <Route path="/ImportarProductos" element={<ProtectedRoute adminOnly><Layout currentPageName="ImportarProductos"><ImportarProductos /></Layout></ProtectedRoute>} />
      <Route path="/Configuracion" element={<ProtectedRoute adminOnly><Layout currentPageName="Configuracion"><Configuracion /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/Catalogo" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster position="top-center" />
      </QueryClientProvider>
    </AuthProvider>
  );
}