import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
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
  // ── Usar contexto auth — NO volvemos a pedir el perfil ──────────
  const { user, perfil, isAdmin, loading: authLoading } = useAuth();

  const tienda = perfil?.tiendas || null;
  const grupoTienda = tienda?.grupo || "estacion";

  const [productos, setProductos]         = useState([]);
  const [carrito, setCarrito] = useState(() => {
    try {
      const saved = localStorage.getItem('selogas_carrito');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [categoriaActiva, setCategoriaActiva] = useState("__todas__");
  const [busqueda, setBusqueda]           = useState("");
  const [cartOpen, setCartOpen]           = useState(false);
  const [loading, setLoading]             = useState(true);
  const [enviando, setEnviando]           = useState(false);
  const [exito, setExito]                 = useState(null);
  const [sugerencias, setSugerencias]     = useState([]);

  // ── Persistir carrito en localStorage ───────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('selogas_carrito', JSON.stringify(carrito));
    } catch {}
  }, [carrito]);

  // ── Carga de productos — solo columnas necesarias ────────────────
  useEffect(() => {
    if (!user) return; // sin usuario no hay catálogo
    if (authLoading) return; // esperar a que auth termine de cargar el perfil

    const cargar = async () => {
      setLoading(true);
      try {
        // Query productos — solo las columnas que usa la UI
        let query = supabase
          .from("productos")
          .select("id, codigo, nombre, precio, imagen_url, categoria_id, disponible, multiplo, minimo, orden_excel, columna_excel, hoja_excel, grupo_visualizacion, categorias(id, nombre)")
          .eq("disponible", true)
          .order("orden_excel");

        // Filtrar por grupo si no es admin
        if (!isAdmin) {
          if (grupoTienda === "ambas") {
            query = query.in("grupo_visualizacion", ["ambas", "estacion", "cafeteria"]);
          } else {
            query = query.in("grupo_visualizacion", ["ambas", grupoTienda]);
          }
        }

        // Cargar productos y sugerencias en PARALELO
        const [{ data: prods }, sugsData] = await Promise.all([
          query,
          tienda?.id ? cargarSugerencias(tienda.id) : Promise.resolve([]),
        ]);

        const listaProductos = prods || [];
        setProductos(listaProductos);

        // Calcular sugerencias con los productos ya cargados
        if (sugsData.length > 0 && listaProductos.length > 0) {
          const idsOrdenados = new Set(sugsData);
          const sugs = listaProductos
            .filter(p => !idsOrdenados.has(p.id) && (p.hoja_excel || "").toUpperCase() !== "AUTOCONSUMO")
            .slice(0, 20);
          setSugerencias(sugs);
        }
      } catch (e) {
        console.error("Error cargando catálogo:", e.message);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [user?.id, perfil?.rol, perfil?.tiendas?.id, authLoading]); // re-ejecutar si cambia rol o tienda

  // ── Sugerencias: IDs de productos pedidos últimas 2 semanas ─────
  async function cargarSugerencias(tiendaId) {
    try {
      const hace14dias = new Date();
      hace14dias.setDate(hace14dias.getDate() - 14);

      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id")
        .eq("tienda_id", tiendaId)
        .gte("fecha_pedido", hace14dias.toISOString())
        .limit(50);

      if (!pedidos?.length) return [];

      const { data: items } = await supabase
        .from("pedido_items")
        .select("producto_id")
        .in("pedido_id", pedidos.map(p => p.id));

      return items?.map(i => i.producto_id) || [];
    } catch {
      return [];
    }
  }

  // ── Derivados memoizados ─────────────────────────────────────────
  const categorias = useMemo(() => {
    const seen = [], s = new Set();
    for (const prod of productos) {
      const id = prod.categoria_id, nombre = prod.categorias?.nombre;
      if (id && nombre && !s.has(id)) { s.add(id); seen.push({ id, nombre }); }
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

  const cartCount = useMemo(() => Object.values(carrito).filter(v => v > 0).length, [carrito]);

  // ── Handlers carrito ─────────────────────────────────────────────
  const handleAdd = (prod) => {
    setCarrito(c => ({ ...c, [prod.id]: (c[prod.id] || 0) + (prod.multiplo || 1) }));
  };
  const handleQtyChange = (prodId, qty) => {
    if (qty <= 0) { const next = { ...carrito }; delete next[prodId]; setCarrito(next); }
    else setCarrito(c => ({ ...c, [prodId]: qty }));
  };
  const handleRemove = (prodId) => {
    const next = { ...carrito }; delete next[prodId]; setCarrito(next);
  };
  const handleAddSugerencia = (prod) => {
    const minimo = prod.minimo || prod.multiplo || 1;
    setCarrito(c => ({ ...c, [prod.id]: (c[prod.id] || 0) + minimo }));
    setSugerencias(prev => prev.filter(s => s.id !== prod.id));
  };

  // ── Enviar pedido ────────────────────────────────────────────────
  const handleEnviar = async (observaciones, lineas) => {
    if (!lineas.length) return;
    setEnviando(true);
    try {
      const tiendaNombre = tienda?.nombre || perfil?.nombre_completo || perfil?.nombre || user?.email || "Sin tienda";
      const numeroPedido = "PED-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
      const fecha = new Date().toISOString();

      const { data: pedido, error: pedidoError } = await supabase.from("pedidos").insert([{
        numero_pedido: numeroPedido,
        tienda_id: tienda?.id || null,
        tienda_nombre: tiendaNombre,
        usuario_id: user.id,
        usuario_email: user.email,
        usuario_nombre: perfil?.nombre_completo || perfil?.nombre || user.email,
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

      // Email en background — no bloquea el UI
      enviarEmail(pedido.id, numeroPedido, fecha, tiendaNombre, observaciones, lineasData).catch(() => {});

      setCarrito({});
      localStorage.removeItem('selogas_carrito');
      setCartOpen(false);
      setExito(numeroPedido);
      setTimeout(() => setExito(null), 6000);
    } catch (e) {
      alert("Error al enviar el pedido: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  async function enviarEmail(pedidoId, numeroPedido, fecha, tiendaNombre, observaciones, lineasData) {
    const { data: config } = await supabase.from("configuracion").select("clave, valor");
    const getConf = (clave) => (config || []).find(c => c.clave === clave)?.valor || "";
    const emailAlmacen = getConf("email_almacen");
    if (!emailAlmacen) return;

    const fechaStr = new Date().toLocaleDateString("es-ES");
    const asunto = (getConf("asunto_email") || "Pedido - {Tienda} - {Fecha}")
      .replace("{Tienda}", tiendaNombre).replace("{Fecha}", fechaStr);

    const todosProductos = productos.map(p => ({
      id: p.id, codigo: p.codigo || "", nombre: p.nombre || "",
      categoria_nombre: p.categorias?.nombre || "",
      orden_excel: p.orden_excel || 0, columna_excel: p.columna_excel || 0,
      hoja_excel: p.hoja_excel || "", multiplo: p.multiplo || 1, minimo: p.minimo || 1,
    }));

    await supabase.functions.invoke("send-email", {
      body: { to: emailAlmacen, subject: asunto, tienda_nombre: tiendaNombre,
              numero_pedido: numeroPedido, fecha, observaciones,
              lineas: lineasData, todos_productos: todosProductos }
    });
    await supabase.from("pedidos").update({ email_enviado: true }).eq("id", pedidoId);
  }

  // ── Render ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
        <p className="text-gray-500">Cargando catálogo...</p>
      </div>
    </div>
  );

  if (!productos.length) return (
    <div className="text-center py-20">
      <Package size={60} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sin productos</h2>
      <p className="text-gray-400">El catálogo está vacío. Un administrador debe importar el catálogo.</p>
    </div>
  );

  return (
    <div className="relative">
      {exito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
          <CheckCircle size={22} />
          <div><div className="font-bold">¡Pedido enviado!</div><div className="text-sm opacity-90">Nº {exito}</div></div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <CartSidebar
            carrito={carrito} productos={productos} sugerencias={sugerencias}
            onClose={() => setCartOpen(false)} onQtyChange={handleQtyChange}
            onRemove={handleRemove} onEnviar={handleEnviar}
            onAddSugerencia={handleAddSugerencia}
            tiendaNombre={tienda?.nombre || ""}
            enviando={enviando}
          />
        </div>
      )}

      {tienda && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-medium ${
          tienda.grupo === "cafeteria"
            ? "bg-orange-50 text-orange-700 border border-orange-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {tienda.grupo === "cafeteria" ? "☕" : "⚪"} <strong>{tienda.nombre}</strong> · {tienda.grupo === "cafeteria" ? "Cafetería" : "Estación"} · {productos.length} productos
        </div>
      )}

      {/* Buscador + botón carrito */}
      <div className="relative mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
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
          {cartCount > 0 && (
            <span style={{
              background: "#2563eb", color: "white", borderRadius: "50%",
              width: "22px", height: "22px", fontSize: "11px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "700", position: "absolute", top: "-8px", right: "-8px"
            }}>{cartCount}</span>
          )}
        </button>
      </div>

      {/* Filtros de categoría */}
      {categorias.length > 0 && (
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setCategoriaActiva("__todas__")}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl border-2 font-bold text-base transition-all shadow-sm ${
              categoriaActiva === "__todas__"
                ? "border-blue-600 bg-blue-600 text-white shadow-blue-200"
                : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            📦 Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id} onClick={() => setCategoriaActiva(cat.id)}
              className={`flex-shrink-0 px-5 py-3 rounded-2xl border-2 font-bold text-base transition-all shadow-sm ${
                categoriaActiva === cat.id
                  ? "border-blue-600 bg-blue-600 text-white shadow-blue-200"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {getCatEmoji(cat.nombre)} {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : categoriaActiva !== "__todas__" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => (
            <ProductCard key={prod.id} producto={prod}
              cantidad={carrito[prod.id] || 0}
              onAdd={() => handleAdd(prod)}
              onQtyChange={(qty) => handleQtyChange(prod.id, qty)}
            />
          ))}
        </div>
      ) : (
        <div>
          {categorias.map(cat => {
            const prodsCategoria = productosFiltrados.filter(p => p.categoria_id === cat.id);
            if (!prodsCategoria.length) return null;
            return (
              <div key={cat.id} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{getCatEmoji(cat.nombre)}</span>
                  <h2 className="text-xl font-bold text-gray-800">{cat.nombre}</h2>
                  <span className="text-sm text-gray-400 font-medium">({prodsCategoria.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {prodsCategoria.map(prod => (
                    <ProductCard key={prod.id} producto={prod}
                      cantidad={carrito[prod.id] || 0}
                      onAdd={() => handleAdd(prod)}
                      onQtyChange={(qty) => handleQtyChange(prod.id, qty)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
