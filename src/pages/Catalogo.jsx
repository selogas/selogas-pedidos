import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ShoppingCart, Search, Package, Loader2, CheckCircle } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import CartSidebar from "@/components/CartSidebar";

const CATEGORIA_EMOJIS = {
  "Bebidas": "🍺", "Alimentacion": "🍞", "Cafeteria": "☕",
  "Limpieza": "🧹", "Higiene": "🧼", "Papeleria": "📋",
  "Snacks": "🍿", "Dulces": "🍫", "Lacteos": "🥛",
  "Congelados": "❄", "Panaderia": "🥖", "Frutas": "🍎",
  "Verduras": "🥬", "Carnes": "🥩", "Pescados": "🐟",
  "Tabaco": "🚬", "Lonja": "🏪", "Butano": "🔥",
  "Gas": "💨", "Aditivos": "🧪", "Lubricantes": "🛢",
  "Bazar": "🛍", "Aguas": "💧", "Aceites": "🛢",
  "Frutas y Verduras": "🍏", "Apoyo": "💼", "Varios": "📦",
};

function getCatEmoji(nombre) {
  if (!nombre) return "📦";
  for (const [key, emoji] of Object.entries(CATEGORIA_EMOJIS)) {
    if (nombre.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return "📦";
}

export default function Catalogo() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [tienda, setTienda] = useState(null);
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
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) { setLoading(false); return; }
      const { data: p } = await supabase.from("perfiles").select("*, tiendas(*)").eq("id", u.id).single();
      setPerfil(p);
      const grupoTienda = p?.tiendas?.grupo || "estacion";
      const esAdmin = p?.rol === "admin";
      if (p?.tiendas) setTienda(p.tiendas);
      let query = supabase.from("productos").select("*, categorias(id, nombre, grupo)").eq("disponible", true).order("orden_excel");
      if (!esAdmin) {
        if (grupoTienda === "ambas") {
          query = query.in("grupo_visualizacion", ["ambas", "estacion", "cafeteria"]);
        } else {
          query = query.in("grupo_visualizacion", ["ambas", grupoTienda]);
        }
      }
      const { data: prods } = await query;
      setProductos(prods || []);
      setLoading(false);
    };
    init();
  }, []);

  const categorias = useMemo(() => {
    const seen = [];
    const s = new Set();
    for (const prod of productos) {
      const catId = prod.categoria_id;
      const catNombre = prod.categorias?.nombre;
      if (catId && catNombre && !s.has(catId)) {
        s.add(catId);
        seen.push({ id: catId, nombre: catNombre });
      }
    }
    return seen;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let list = productos;
    if (categoriaActiva !== "__todas__") list = list.filter(p => p.categoria_id === categoriaActiva);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.categorias?.nombre?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [productos, categoriaActiva, busqueda]);

  const cartCount = Object.values(carrito).filter(v => v > 0).length;

  const handleAdd = (prod) => {
    const multiplo = prod.multiplo || 1;
    setCarrito(c => ({ ...c, [prod.id]: (c[prod.id] || 0) + multiplo }));
  };

  const handleQtyChange = (prodId, qty) => {
    if (qty <= 0) {
      const next = { ...carrito };
      delete next[prodId];
      setCarrito(next);
    } else setCarrito(c => ({ ...c, [prodId]: qty }));
  };

  const handleRemove = (prodId) => {
    const next = { ...carrito };
    delete next[prodId];
    setCarrito(next);
  };

  const handleEnviar = async (observaciones, lineas) => {
    if (lineas.length === 0) return;
    setEnviando(true);
    try {
      const tiendaNombre = tienda?.nombre || perfil?.nombre_completo || user?.email || "Sin tienda";
      const numeroPedido = "PED-" + Date.now().toString().slice(-8);
      const fecha = new Date().toISOString();

      const { data: pedido, error: pedidoError } = await supabase.from("pedidos").insert([{
        numero_pedido: numeroPedido,
        tienda_id: tienda?.id || null,
        tienda_nombre: tiendaNombre,
        usuario_id: user.id,
        usuario_email: user.email,
        usuario_nombre: perfil?.nombre_completo || user.email,
        fecha_pedido: fecha,
        estado: "enviado",
        observaciones,
        total_lineas: lineas.length,
        email_enviado: false,
      }]).select().single();
      if (pedidoError) throw pedidoError;

      const lineasData = lineas.map(({ prod, qty }) => ({
        pedido_id: pedido.id,
        producto_id: prod.id,
        producto_codigo: prod.codigo || "",
        producto_nombre: prod.nombre,
        producto_categoria: prod.categorias?.nombre || "",
        producto_formato: prod.formato || "",
        cantidad: qty,
        orden_excel: prod.orden_excel || 0,
      }));

      const { error: lineasError } = await supabase.from("pedido_items").insert(lineasData);
      if (lineasError) throw lineasError;

      try {
        const { data: config } = await supabase.from("configuracion").select("*");
        const getConf = (clave) => (config || []).find(c => c.clave === clave)?.valor || "";
        const emailAlmacen = getConf("email_almacen");
        if (emailAlmacen) {
          const fechaStr = new Date().toLocaleDateString("es-ES");
          const asunto = (getConf("asunto_email") || "Pedido - {Tienda} - {Fecha}")
            .replace("{Tienda}", tiendaNombre)
            .replace("{Fecha}", fechaStr);

          // Build todos_productos list for the email (full catalog with category info)
          const todosProductos = productos.map(p => ({
            id: p.id,
            codigo: p.codigo || "",
            nombre: p.nombre || "",
            categoria_nombre: p.categorias?.nombre || "",
            orden_excel: p.orden_excel || 0,
            hoja_excel: p.hoja_excel || "1",
            multiplo: p.multiplo || 1,
            minimo: p.minimo || 1,
          }));

          await supabase.functions.invoke("send-email", {
            body: {
              to: emailAlmacen,
              subject: asunto,
              tienda_nombre: tiendaNombre,
              numero_pedido: numeroPedido,
              fecha: fecha,
              observaciones: observaciones,
              lineas: lineasData,
              todos_productos: todosProductos,
            }
          });
          await supabase.from("pedidos").update({ email_enviado: true }).eq("id", pedido.id);
        }
      } catch(emailErr) {
        console.warn("Email no enviado:", emailErr.message);
      }

      setCarrito({});
      setCartOpen(false);
      setExito(numeroPedido);
      setTimeout(() => setExito(null), 6000);
    } catch (e) {
      console.error(e);
      alert("Error al enviar el pedido: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
        <p className="text-gray-500">Cargando cat&aacute;logo...</p>
      </div>
    </div>
  );

  if (productos.length === 0) return (
    <div className="text-center py-20">
      <Package size={60} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sin productos</h2>
      <p className="text-gray-400 mb-4">El cat&aacute;logo est&aacute; vac&iacute;o. Un administrador debe importar el cat&aacute;logo.</p>
    </div>
  );

  return (
    <div className="relative">
      {exito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
          <CheckCircle size={22} />
          <div><div className="font-bold">&iexcl;Pedido enviado!</div><div className="text-sm opacity-90">N&ordm; {exito}</div></div>
        </div>
      )}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <CartSidebar
            carrito={carrito}
            productos={productos}
            onClose={() => setCartOpen(false)}
            onQtyChange={handleQtyChange}
            onRemove={handleRemove}
            onEnviar={handleEnviar}
            tiendaNombre={tienda?.nombre || ""}
          />
        </div>
      )}
      {tienda && (
        <div className={"mb-4 px-4 py-2 rounded-xl text-sm font-medium " + (tienda.grupo === "cafeteria" ? "bg-orange-50 text-orange-700 border border-orange-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>
          {tienda.grupo === "cafeteria" ? "☕" : "⚪"} <strong>{tienda.nombre}</strong> &middot; {tienda.grupo === "cafeteria" ? "Cafetería" : "Estación"} &middot; {productos.length} productos
        </div>
      )}
      <div className="relative mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className="search-bar pl-12"
          />
        </div>
        <button
          className="relative flex items-center gap-2 px-5 py-3 rounded-full font-bold shadow-lg transition-all hover:scale-105 flex-shrink-0"
          style={{ background: "#1e293b", color: "white", minWidth: "120px" }}
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart size={20} color="white" />
          <span className="text-white">Pedido</span>
          {cartCount > 0 && <span style={{ background: "#2563eb", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", position: "absolute", top: "-8px", right: "-8px" }}>{cartCount}</span>}
        </button>
      </div>
      {categorias.length > 0 && (
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setCategoriaActiva("__todas__")}
            className={"flex-shrink-0 px-5 py-3 rounded-2xl border-2 font-bold text-base transition-all shadow-sm " + (categoriaActiva === "__todas__" ? "border-blue-600 bg-blue-600 text-white shadow-blue-200" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50")}
          >
            📦 Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={"flex-shrink-0 px-5 py-3 rounded-2xl border-2 font-bold text-base transition-all shadow-sm " + (categoriaActiva === cat.id ? "border-blue-600 bg-blue-600 text-white shadow-blue-200" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50")}
            >
              {getCatEmoji(cat.nombre)} {cat.nombre}
            </button>
          ))}
        </div>
      )}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Package size={48} className="mx-auto mb-3 opacity-30" /><p>No hay productos en esta categoría</p></div>
      ) : categoriaActiva !== "__todas__" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => <ProductCard key={prod.id} producto={prod} cantidad={carrito[prod.id] || 0} onAdd={() => handleAdd(prod)} onQtyChange={(qty) => handleQtyChange(prod.id, qty)} />)}
        </div>
      ) : (
        <div>
          {categorias.map(cat => {
            const prodsCategoria = productosFiltrados.filter(p => p.categoria_id === cat.id);
            if (prodsCategoria.length === 0) return null;
            return (
              <div key={cat.id} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{getCatEmoji(cat.nombre)}</span>
                  <h2 className="text-xl font-bold text-gray-800">{cat.nombre}</h2>
                  <span className="text-sm text-gray-400 font-medium">({prodsCategoria.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {prodsCategoria.map(prod => <ProductCard key={prod.id} producto={prod} cantidad={carrito[prod.id] || 0} onAdd={() => handleAdd(prod)} onQtyChange={(qty) => handleQtyChange(prod.id, qty)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
