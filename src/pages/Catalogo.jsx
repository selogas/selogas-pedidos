import { useState, useEffect, useMemo } from "react";
import { productosApi, pedidosApi, pedidoLineasApi, configuracionApi, sendEmail, uploadFile } from "../api";
import { useAuth } from "../lib/auth";
import { ShoppingCart, Search, Package, Loader2, CheckCircle } from "lucide-react";
import CartSidebar from "../components/CartSidebar";
import ProductCard from "../components/ProductCard";

export default function Catalogo() {
  const { user, isAdmin } = useAuth();
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState({});
  const [categoriaActiva, setCategoriaActiva] = useState("__todas__");
  const [busqueda, setBusqueda] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(null);

  useEffect(() => {
    const init = async () => {
      const prods = await productosApi.list("orden_excel", 1000);
      setProductos(prods);
      setLoading(false);
    };
    init();
  }, []);

  const categorias = useMemo(() => {
    const seen = new Set(); const result = [];
    for (const p of productos) { if (p.categoria && !seen.has(p.categoria)) { seen.add(p.categoria); result.push(p.categoria); } }
    return result;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let list = categoriaActiva !== "__todas__" ? productos.filter(p => p.categoria === categoriaActiva) : productos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [productos, categoriaActiva, busqueda]);

  const cartCount = Object.values(carrito).filter(v => v > 0).length;

  const handleAdd = (prod) => {
    const multiplo = prod.multiplo || 1;
    setCarrito(c => ({ ...c, [prod.id]: (c[prod.id] || 0) + multiplo }));
  };

  const handleQtyChange = (prodId, qty) => {
    if (qty <= 0) { const next = {...carrito}; delete next[prodId]; setCarrito(next); }
    else { setCarrito(c => ({...c, [prodId]: qty})); }
  };

  const handleRemove = (prodId) => {
    const next = {...carrito}; delete next[prodId]; setCarrito(next);
  };

  const handleEnviar = async (observaciones, lineas) => {
    if (lineas.length === 0) return;
    setEnviando(true);
    try {
      const configs = await configuracionApi.list();
      const emailDest = configs.find(c => c.clave === 'email_almacen')?.valor || '';
      const asuntoTemplate = configs.find(c => c.clave === 'asunto_email')?.valor || 'Nuevo Pedido - {Tienda} - {Fecha}';
      const textoExtra = configs.find(c => c.clave === 'texto_email')?.valor || '';

      const numeroPedido = `PED-${Date.now().toString().slice(-8)}`;
      const tiendaNombre = user?.tienda_nombre || user?.email || 'Sin tienda';
      const fecha = new Date().toLocaleDateString('es-ES');

      const pedido = await pedidosApi.create({
        numero_pedido: numeroPedido,
        tienda_id: user?.tienda_id || '',
        tienda_nombre: tiendaNombre,
        usuario_email: user?.email || '',
        usuario_nombre: user?.full_name || user?.email || '',
        fecha_pedido: new Date().toISOString(),
        estado: 'enviado',
        observaciones,
        total_lineas: lineas.length,
        email_enviado: false,
      });

      await pedidoLineasApi.bulkCreate(
        lineas.map(({ prod, qty }) => ({
          pedido_id: pedido.id,
          producto_id: prod.id,
          producto_codigo: prod.codigo || '',
          producto_nombre: prod.nombre,
          producto_categoria: prod.categoria || '',
          producto_formato: prod.formato || '',
          cantidad: qty,
          orden_excel: prod.orden_excel || 0,
        }))
      );

      if (emailDest) {
        const asunto = asuntoTemplate.replace('{Tienda}', tiendaNombre).replace('{Fecha}', fecha);
        const lineasHtml = lineas
          .sort((a, b) => (a.prod.orden_excel || 0) - (b.prod.orden_excel || 0))
          .map(({ prod, qty }) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">[${prod.codigo || '-'}] ${prod.nombre}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:bold;">${qty}</td></tr>`)
          .join('');

        const cuerpo = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2563eb;padding:24px;border-radius:8px 8px 0 0;">
            <h2 style="color:white;margin:0">SELOGAS - Pedido: ${numeroPedido}</h2>
            <p style="color:#dbeafe;margin:8px 0 0">Tienda: ${tiendaNombre} | Fecha: ${fecha}</p>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;">
            <h3 style="margin:0 0 16px">Productos solicitados (${lineas.length} líneas)</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr style="background:#f3f4f6;">
                <td style="padding:8px 12px;font-weight:bold;">PRODUCTO</td>
                <td style="padding:8px 12px;font-weight:bold;text-align:right;">CANT.</td>
              </tr>
              ${lineasHtml}
            </table>
            ${observaciones ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;"><strong>Observaciones:</strong> ${observaciones}</div>` : ''}
            ${textoExtra ? `<p style="color:#6b7280;font-size:13px;margin-top:16px;">${textoExtra}</p>` : ''}
          </div>
          <div style="background:#f9fafb;padding:12px 24px;text-align:center;font-size:11px;color:#9ca3af;">
            Pedido generado automáticamente - Sistema de Pedidos SELOGAS
          </div>
        </div>`;

        try {
          await sendEmail({ to: emailDest, subject: asunto, body: cuerpo });
          await pedidosApi.update(pedido.id, { email_enviado: true });
        } catch (emailErr) {
          console.warn('Email no enviado (configura la Edge Function de Supabase):', emailErr.message);
        }
      }

      setCarrito({});
      setCartOpen(false);
      setExito(numeroPedido);
      setTimeout(() => setExito(null), 6000);
    } catch (e) {
      console.error(e);
      alert('Error al enviar el pedido: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-gray-500">Cargando catálogo...</p>
      </div>
    </div>
  );

  if (productos.length === 0) return (
    <div className="text-center py-20">
      <Package size={60} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sin productos</h2>
      <p className="text-gray-400">Un administrador debe importar el catálogo.</p>
    </div>
  );

  return (
    <div className="relative">
      {exito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
          <CheckCircle size={22} />
          <div>
            <div className="font-bold">¡Pedido enviado!</div>
            <div className="text-sm opacity-90">Nº {exito}</div>
          </div>
        </div>
      )}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <CartSidebar carrito={carrito} productos={productos} onClose={() => setCartOpen(false)}
            onQtyChange={handleQtyChange} onRemove={handleRemove} onEnviar={handleEnviar}
            tiendaNombre={user?.tienda_nombre || ''} />
        </div>
      )}
      <div className="relative mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar productos..." className="search-bar pl-12" />
        </div>
        <button className="relative flex items-center gap-2 px-5 py-3 rounded-full font-bold shadow-lg bg-slate-800 text-white"
          onClick={() => setCartOpen(true)}>
          <ShoppingCart size={20} />
          <span>Pedido</span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {["__todas__", ...categorias].map(cat => (
          <button key={cat} onClick={() => setCategoriaActiva(cat)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${categoriaActiva === cat ? "bg-blue-600 text-white shadow-md" : "bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50"}`}>
            {cat === "__todas__" ? "🛒 Todas" : cat}
          </button>
        ))}
      </div>
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : categoriaActiva !== "__todas__" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => (
            <ProductCard key={prod.id} producto={prod} cantidad={carrito[prod.id] || 0}
              onAdd={handleAdd} onQtyChange={(qty) => handleQtyChange(prod.id, qty)} />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {(() => {
            const groups = []; const seen = new Map();
            for (const prod of productosFiltrados) {
              const cat = prod.categoria || "Sin categoría";
              if (!seen.has(cat)) { seen.set(cat, []); groups.push({ cat, prods: seen.get(cat) }); }
              seen.get(cat).push(prod);
            }
            return groups.map(({ cat, prods }) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-gray-800">{cat}</h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-sm text-gray-400">{prods.length} productos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {prods.map(prod => (
                    <ProductCard key={prod.id} producto={prod} cantidad={carrito[prod.id] || 0}
                      onAdd={handleAdd} onQtyChange={(qty) => handleQtyChange(prod.id, qty)} />
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
      {enviando && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
            <Loader2 size={40} className="animate-spin mx-auto mb-3 text-blue-600" />
            <p className="font-semibold">Enviando pedido...</p>
          </div>
        </div>
      )}
    </div>
  );
}