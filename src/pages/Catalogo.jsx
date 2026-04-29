import { useState, useEffect, useMemo } from 'react';
import { productosApi, pedidosApi, pedidoItemsApi, configuracionApi, categoriasApi } from '../api';
import { useAuth } from '../lib/auth';
import { ShoppingCart, Search, Package, Loader2, CheckCircle, Star, AlertCircle } from 'lucide-react';
import CartSidebar from '../components/CartSidebar';

function ProductCard({ producto, cantidad, onAdd, onQtyChange }) {
  const multiplo = producto.multiplo || 1;
  const minimo = producto.minimo || multiplo;
  const agotado = producto.disponible === false;

  const handleAdd = () => {
    if (agotado) return;
    onAdd(producto);
  };

  const handleMinus = () => {
    const newQty = cantidad - multiplo;
    if (newQty <= 0) onQtyChange(0);
    else onQtyChange(Math.max(minimo, newQty));
  };

  const handlePlus = () => {
    const newQty = cantidad > 0 ? cantidad + multiplo : minimo;
    onQtyChange(newQty);
  };

  return (
    <div className={`bg-white rounded-2xl border-2 border-gray-100 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-all ${agotado ? 'opacity-75' : ''}`}>
      <div className="relative h-36 bg-gray-50 flex items-center justify-center">
        {producto.favorito && (
          <span className="absolute top-2 right-2 text-yellow-400 bg-white rounded-full p-0.5 shadow-sm">
            <Star size={14} fill="currentColor" />
          </span>
        )}
        {agotado && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <AlertCircle size={12} />Agotado
            </span>
          </div>
        )}
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre}
            className="w-full h-full object-contain p-2"
            onError={e => { e.target.onerror=null; e.target.style.display='none'; }} />
        ) : (
          <Package size={36} className="text-gray-200" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="font-bold text-xs leading-snug text-gray-900 line-clamp-2 min-h-[2.5rem]">{producto.nombre}</h3>
        {producto.formato && <p className="text-xs text-gray-400 truncate">{producto.formato}</p>}
        {producto.codigo && <p className="text-xs text-gray-400 font-mono">{producto.codigo}</p>}
        <div className="text-xs text-blue-600 font-semibold">x{multiplo}</div>
        <div className="mt-auto pt-1">
          {cantidad > 0 ? (
            <div className="flex items-center gap-2">
              <button onClick={handleMinus}
                className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center hover:bg-blue-700 shadow-sm">
                −
              </button>
              <span className="flex-1 text-center font-bold text-gray-900 text-sm">{cantidad}</span>
              <button onClick={handlePlus}
                className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center hover:bg-blue-700 shadow-sm">
                +
              </button>
            </div>
          ) : (
            <button onClick={handleAdd} disabled={agotado}
              className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors">
              {agotado ? 'Agotado' : 'Añadir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Catalogo() {
  const { user, isAdmin } = useAuth();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidosRecientes, setPedidosRecientes] = useState([]);
  const [carrito, setCarrito] = useState({});
  const [categoriaActiva, setCategoriaActiva] = useState('__todas__');
  const [busqueda, setBusqueda] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(null);

  const tiendaGrupo = user?.tienda_grupo || 'ambos';

  useEffect(() => {
    const init = async () => {
      const [prods, cats] = await Promise.all([
        productosApi.list('orden_excel', 2000),
        categoriasApi.list()
      ]);
      setProductos(prods);
      setCategorias(cats);

      // Cargar pedidos recientes para sugerencias
      if (user?.tienda_id) {
        const hace14dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const pedidos = await pedidosApi.filter({ tienda_id: user.tienda_id }, 50);
        const recientes = pedidos.filter(p => p.fecha_pedido >= hace14dias);
        if (recientes.length > 0) {
          const items = await pedidoItemsApi.filter({ pedido_id: recientes[0].id }, 200);
          // Recoger todos los producto_ids pedidos en los últimos 14 días
          const allRecentItems = await Promise.all(
            recientes.map(p => pedidoItemsApi.filter({ pedido_id: p.id }, 200))
          );
          const productosPedidos = new Set(allRecentItems.flat().map(i => i.producto_id));
          setPedidosRecientes([...productosPedidos]);
        }
      }

      setLoading(false);
    };
    init();
  }, [user]);

  // Filtrar productos por grupo de tienda y visibilidad
  const productosVisibles = useMemo(() => {
    if (isAdmin) return productos;
    return productos.filter(p => {
      const vis = p.visibilidad_grupo || 'ambos';
      if (tiendaGrupo === 'ambos') return true;
      return vis === 'ambos' || vis === tiendaGrupo;
    });
  }, [productos, tiendaGrupo, isAdmin]);

  // Filtrar categorías por grupo de tienda
  const categoriasVisibles = useMemo(() => {
    if (isAdmin) return categorias;
    return categorias.filter(cat => {
      const g = cat.grupo || 'ambos';
      if (tiendaGrupo === 'ambos') return true;
      return g === 'ambos' || g === tiendaGrupo;
    });
  }, [categorias, tiendaGrupo, isAdmin]);

  const productosFiltrados = useMemo(() => {
    let list = categoriaActiva !== '__todas__'
      ? productosVisibles.filter(p => p.categoria === categoriaActiva)
      : productosVisibles;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q));
    }
    return list;
  }, [productosVisibles, categoriaActiva, busqueda]);

  // Productos NO pedidos en últimas 2 semanas (para sugerencias en carrito)
  const sugerencias = useMemo(() => {
    const enCarrito = new Set(Object.keys(carrito));
    return productosVisibles.filter(p => {
      if (p.disponible === false) return false;
      if (enCarrito.has(p.id)) return false;
      if (pedidosRecientes.length > 0 && !pedidosRecientes.includes(p.id)) return true;
      return false;
    }).slice(0, 12);
  }, [productosVisibles, pedidosRecientes, carrito]);

  const cartCount = Object.values(carrito).filter(v => v > 0).length;
  const cartTotal = Object.entries(carrito).reduce((acc, [id, qty]) => acc + qty, 0);

  const handleAdd = (prod) => {
    const multiplo = prod.multiplo || 1;
    const minimo = prod.minimo || multiplo;
    setCarrito(c => ({ ...c, [prod.id]: (c[prod.id] || 0) === 0 ? minimo : c[prod.id] + multiplo }));
  };

  const handleQtyChange = (prodId, qty) => {
    if (qty <= 0) { const n = {...carrito}; delete n[prodId]; setCarrito(n); }
    else setCarrito(c => ({...c, [prodId]: qty}));
  };

  const handleRemove = (prodId) => {
    const n = {...carrito}; delete n[prodId]; setCarrito(n);
  };

  const handleEnviar = async (observaciones, lineas) => {
    if (lineas.length === 0) return alert('El carrito está vacío');
    setEnviando(true);
    try {
      const configs = await configuracionApi.list();
      const emailDest = configs.find(c => c.clave === 'email_almacen')?.valor || '';
      const asuntoTemplate = configs.find(c => c.clave === 'asunto_email')?.valor || 'Pedido - {Tienda} - {Fecha}';
      const textoExtra = configs.find(c => c.clave === 'texto_email')?.valor || '';

      const numeroPedido = 'PED-' + Date.now().toString().slice(-8);
      const tiendaNombre = user?.tienda_nombre || user?.email || 'Sin tienda';
      const fecha = new Date().toLocaleDateString('es-ES');

      const pedido = await pedidosApi.create({
        numero_pedido: numeroPedido,
        tienda_id: user?.tienda_id || null,
        tienda_nombre: tiendaNombre,
        usuario_email: user?.email || '',
        usuario_nombre: user?.nombre || user?.email || '',
        fecha_pedido: new Date().toISOString(),
        estado: 'enviado',
        observaciones,
        total_lineas: lineas.length,
        email_enviado: false,
      });

      await pedidoItemsApi.bulkCreate(
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
          .map(({ prod, qty }) => {
            const displayName = prod.formato ? `${prod.nombre} - ${prod.formato}` : prod.nombre;
            return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${prod.codigo ? '['+prod.codigo+'] ' : ''}${displayName}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:bold;">${qty}</td></tr>`;
          }).join('');

        const pdfLink = window.location.origin + '/mis-pedidos';
        const cuerpo = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<div style="background:#1d4ed8;padding:24px;border-radius:8px 8px 0 0;">
  <h2 style="color:white;margin:0;font-size:20px;">SELOGAS - ${numeroPedido}</h2>
  <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Tienda: ${tiendaNombre} | Fecha: ${fecha}</p>
</div>
<div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;">
  <h3 style="margin:0 0 16px;font-size:16px;">Productos solicitados (${lineas.length} líneas)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr style="background:#f3f4f6;">
      <td style="padding:8px 12px;font-weight:bold;">PRODUCTO</td>
      <td style="padding:8px 12px;font-weight:bold;text-align:right;">CANT.</td>
    </tr>
    ${lineasHtml}
  </table>
  ${observaciones ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;"><strong>Observaciones:</strong> ${observaciones}</div>` : ''}
  <div style="margin-top:20px;text-align:center;">
    <a href="${pdfLink}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Ver pedido completo →</a>
  </div>
  ${textoExtra ? `<p style="color:#6b7280;font-size:13px;margin-top:16px;">${textoExtra}</p>` : ''}
</div>
<div style="background:#f9fafb;padding:12px 24px;text-align:center;font-size:11px;color:#9ca3af;">
  Pedido generado automáticamente - Sistema SELOGAS
</div></div>`;

        try {
          const { supabase } = await import('../lib/supabase');
          await supabase.functions.invoke('send-email', { body: { to: emailDest, subject: asunto, body: cuerpo } });
          await pedidosApi.update(pedido.id, { email_enviado: true });
        } catch(emailErr) {
          console.warn('Email no enviado:', emailErr.message);
        }
      }

      setCarrito({});
      setCartOpen(false);
      setExito(numeroPedido);
      setTimeout(() => setExito(null), 6000);
    } catch(e) {
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

  if (productosVisibles.length === 0) return (
    <div className="text-center py-20">
      <Package size={60} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sin productos</h2>
      <p className="text-gray-400">El administrador debe importar el catálogo.</p>
    </div>
  );

  return (
    <div className="relative">
      {exito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce-once">
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
          <CartSidebar
            carrito={carrito}
            productos={productos}
            sugerencias={sugerencias}
            onClose={() => setCartOpen(false)}
            onQtyChange={handleQtyChange}
            onRemove={handleRemove}
            onEnviar={handleEnviar}
            onAddSugerencia={(prod) => handleAdd(prod)}
            tiendaNombre={user?.tienda_nombre || ''}
          />
        </div>
      )}

      {/* Barra superior */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar productos..." className="w-full border border-gray-200 bg-white rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-400 shadow-sm" />
        </div>
        <button className="relative flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold shadow-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          onClick={() => setCartOpen(true)}>
          <ShoppingCart size={20} />
          <span className="hidden sm:inline">Pedido</span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full min-w-[1.5rem] h-6 text-xs flex items-center justify-center font-bold px-1">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Filtros por categoría */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        <button onClick={() => setCategoriaActiva('__todas__')}
          className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm ${categoriaActiva === '__todas__' ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-blue-300'}`}>
          🛒 Todas
        </button>
        {categoriasVisibles.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.nombre)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm ${categoriaActiva === cat.nombre ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'}`}>
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : categoriaActiva !== '__todas__' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => (
            <ProductCard key={prod.id} producto={prod} cantidad={carrito[prod.id] || 0}
              onAdd={handleAdd} onQtyChange={(qty) => handleQtyChange(prod.id, qty)} />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {(() => {
            const groups = [];
            const seen = new Map();
            const catOrder = new Map(categoriasVisibles.map((c, i) => [c.nombre, i]));
            for (const prod of productosFiltrados) {
              const cat = prod.categoria || 'Sin categoría';
              if (!seen.has(cat)) { seen.set(cat, []); groups.push({ cat, prods: seen.get(cat) }); }
              seen.get(cat).push(prod);
            }
            groups.sort((a, b) => (catOrder.get(a.cat) ?? 999) - (catOrder.get(b.cat) ?? 999));
            return groups.map(({ cat, prods }) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setCategoriaActiva(cat)} className="text-lg font-black text-gray-800 hover:text-blue-600 transition-colors">{cat}</button>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-sm text-gray-400 font-medium">{prods.length} productos</span>
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
