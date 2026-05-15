import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ShoppingCart, Search, Package, Loader2, CheckCircle } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import CartSidebar from "@/components/CartSidebar";
import { useTopProductos, invalidateTopProductosCache } from "@/lib/useTopProductos";

const CAT_COLORS = [
  "#00a847","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#f97316","#06b6d4","#ec4899","#84cc16","#6366f1",
  "#14b8a6","#a855f7","#f43f5e","#0ea5e9","#d97706",
  "#4ade80","#fb7185","#38bdf8","#c084fc","#facc15",
];

function getCatColor(nombre, index) {
  return CAT_COLORS[index % CAT_COLORS.length];
}

export default function Catalogo() {
  const { user, perfil, isAdmin, loading: authLoading } = useAuth();

  const tienda      = perfil?.tiendas || null;
  const grupoTienda = tienda?.grupo   || "estacion";

  const prefPlantilla      = tienda?.pref_plantilla       !== false;
  const prefAvisosCantidad = tienda?.pref_avisos_cantidad !== false;
  const prefDoblePedido    = tienda?.pref_doble_pedido_aviso !== false;
  // ── NUEVO: preferencia aviso caducidad ────────────────────────────
  const prefAvisoCaducidad = tienda?.pref_aviso_caducidad !== false;

  const [productos, setProductos]   = useState([]);
  const [carrito, setCarrito]       = useState(() => {
    try {
      const saved = localStorage.getItem('selogas_carrito');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [categoriaActiva, setCategoriaActiva] = useState("__todas__");
  const [busqueda, setBusqueda]               = useState("");
  const [cartOpen, setCartOpen]               = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [enviando, setEnviando]               = useState(false);
  const [exito, setExito]                     = useState(null);
  const [sugerencias, setSugerencias]         = useState([]);
  const scrollCatRef = useRef(null);

  const [pedidoEstaSemanaPorProducto, setPedidoEstaSemanaPorProducto] = useState({});
  const [mediasPorProducto, setMediasPorProducto] = useState({});
  const [favoritos, setFavoritos]     = useState(new Set());
  const [plantillaActiva, setPlantilla] = useState(null);
  const [plantillaOn, setPlantillaOn]   = useState(false);
  const [mapaCaducidades, setMapaCaducidades] = useState({});

  const { topSet: topProductos } = useTopProductos();

  useEffect(() => {
    try { localStorage.setItem('selogas_carrito', JSON.stringify(carrito)); } catch {}
  }, [carrito]);

  useEffect(() => {
    if (!user) return;
    if (authLoading) return;

    const cargar = async () => {
      setLoading(true);
      try {
        const CACHE_KEY = `selogas_cat_${perfil?.tienda_id || 'admin'}`;
        const CACHE_TTL = 2 * 60 * 60 * 1000;
        let listaProductos = null;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts < CACHE_TTL) listaProductos = data;
          }
        } catch {}

        if (!listaProductos) {
          let query = supabase
            .from("productos")
            .select("id, codigo, nombre, imagen_url, categoria_id, disponible, multiplo, minimo, orden_excel, columna_excel, hoja_excel, seccion_excel, grupo_visualizacion, etiqueta, categorias(id, nombre)")
            .eq("disponible", true)
            .order("orden_excel");

          if (!isAdmin) {
            if (grupoTienda === "ambos") {
              query = query.in("grupo_visualizacion", ["ambos", "ambas", "estacion", "cafeteria"]);
            } else {
              query = query.in("grupo_visualizacion", ["ambos", "ambas", grupoTienda]);
            }
          }

          const { data: prods } = await query;
          listaProductos = prods || [];
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: listaProductos })); } catch {}
        }

        if (!isAdmin && tienda?.id) {
          try {
            const { data: asignados } = await supabase
              .from("producto_tiendas")
              .select("producto_id")
              .eq("tienda_id", tienda.id);

            if (asignados?.length) {
              const idsAsignados  = asignados.map(a => a.producto_id);
              const idsYaCargados = new Set(listaProductos.map(p => p.id));
              const idsNuevos     = idsAsignados.filter(id => !idsYaCargados.has(id));
              if (idsNuevos.length) {
                const { data: prodsEspecificos } = await supabase
                  .from("productos")
                  .select("id, codigo, nombre, imagen_url, categoria_id, disponible, multiplo, minimo, orden_excel, columna_excel, hoja_excel, seccion_excel, grupo_visualizacion, etiqueta, categorias(id, nombre)")
                  .in("id", idsNuevos)
                  .eq("disponible", true);
                if (prodsEspecificos?.length) listaProductos = [...listaProductos, ...prodsEspecificos];
              }
            }
          } catch {}
        }

        setProductos(listaProductos);

        const [sugsData, pedidosRecientes, mediasHistoricas, favSet, plantilla, caducMap] = await Promise.all([
          tienda?.id ? cargarSugerencias(tienda.id) : Promise.resolve([]),
          (tienda?.id && tienda?.doble_pedido && prefDoblePedido) ? cargarPedidosRecientes(tienda.id) : Promise.resolve({}),
          (tienda?.id && prefAvisosCantidad) ? cargarMediasHistoricas(tienda.id) : Promise.resolve({}),
          tienda?.id ? cargarFavoritos(tienda.id) : Promise.resolve(new Set()),
          tienda?.id ? cargarPlantilla(tienda.id) : Promise.resolve(null),
          // ── Solo cargar caducidades si la tienda tiene calendario Y la pref está activa ──
          (tienda?.google_calendar_id && prefAvisoCaducidad) ? cargarCaducidades() : Promise.resolve({}),
        ]);

        if (Object.keys(pedidosRecientes).length > 0) setPedidoEstaSemanaPorProducto(pedidosRecientes);
        if (Object.keys(caducMap).length > 0) setMapaCaducidades(caducMap);
        if (Object.keys(mediasHistoricas).length > 0) setMediasPorProducto(mediasHistoricas);
        if (favSet.size > 0) setFavoritos(favSet);
        if (plantilla) setPlantilla(plantilla);

        if (sugsData.length > 0 && listaProductos.length > 0) {
          const idsOrdenados = new Set(sugsData);
          setSugerencias(listaProductos
            .filter(p => !idsOrdenados.has(p.id) && (p.hoja_excel || "").toUpperCase() !== "AUTOCONSUMO")
            .slice(0, 20));
        }
      } catch (e) {
        console.error("Error cargando catálogo:", e.message);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [user?.id, perfil?.rol, perfil?.tiendas?.id, authLoading]);

  async function cargarCaducidades() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("get-caducidades", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error || res.data?.error || res.data?.sinCalendario) return {};
      const eventos = res.data?.caducidades || [];
      const mapa = {};
      for (const ev of eventos) {
        // La Edge Function devuelve codigoProducto (camelCase)
        const cod = (ev.codigoProducto || ev.codigo_producto)?.trim();
        if (cod && ev.diasRestantes <= 15) {
          if (mapa[cod] === undefined || ev.diasRestantes < mapa[cod]) {
            mapa[cod] = ev.diasRestantes;
          }
        }
      }
      return mapa;
    } catch { return {}; }
  }

  async function cargarFavoritos(tiendaId) {
    try {
      const { data } = await supabase.from("favoritos").select("producto_id").eq("tienda_id", tiendaId);
      return new Set((data || []).map(f => f.producto_id));
    } catch { return new Set(); }
  }

  const toggleFavorito = async (prodId) => {
    if (!tienda?.id) return;
    const esFav = favoritos.has(prodId);
    const newFavs = new Set(favoritos);
    if (esFav) {
      newFavs.delete(prodId);
      await supabase.from("favoritos").delete().eq("tienda_id", tienda.id).eq("producto_id", prodId);
    } else {
      newFavs.add(prodId);
      await supabase.from("favoritos").insert([{ tienda_id: tienda.id, producto_id: prodId }]);
    }
    setFavoritos(newFavs);
  };

  async function cargarPlantilla(tiendaId) {
    try {
      const { data } = await supabase.from("plantillas_pedido")
        .select("*").eq("tienda_id", tiendaId).order("created_at").limit(1).single();
      return data || null;
    } catch { return null; }
  }

  const guardarPlantilla = async () => {
    if (!tienda?.id) return;
    const lineas = Object.entries(carrito)
      .filter(([, qty]) => qty > 0)
      .map(([prodId, cantidad]) => ({ producto_id: prodId, cantidad }));
    if (!lineas.length) { alert("El carrito está vacío."); return; }
    const nombre = `Plantilla ${new Date().toLocaleDateString("es-ES")}`;
    if (plantillaActiva?.id) {
      await supabase.from("plantillas_pedido").update({ items: lineas, nombre, updated_at: new Date().toISOString() }).eq("id", plantillaActiva.id);
    } else {
      const { data } = await supabase.from("plantillas_pedido").insert([{ tienda_id: tienda.id, nombre, items: lineas, activa: true }]).select().single();
      setPlantilla(data);
    }
    alert("✅ Plantilla guardada");
  };

  const cargarDesdePlantilla = () => {
    if (!plantillaActiva?.items?.length) return;
    const nuevoCarrito = {};
    for (const item of plantillaActiva.items) {
      const prod = productos.find(p => p.id === item.producto_id);
      if (prod) nuevoCarrito[item.producto_id] = item.cantidad;
    }
    setCarrito(nuevoCarrito);
  };

  const togglePlantilla = async () => {
    const newVal = !plantillaOn;
    setPlantillaOn(newVal);
    if (newVal && plantillaActiva) cargarDesdePlantilla();
    if (!newVal) setCarrito({});
  };

  async function cargarPedidosRecientes(tiendaId) {
    try {
      const hace7dias = new Date();
      hace7dias.setDate(hace7dias.getDate() - 7);
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, fecha_pedido")
        .eq("tienda_id", tiendaId)
        .gte("fecha_pedido", hace7dias.toISOString())
        .order("fecha_pedido", { ascending: false })
        .limit(10);
      if (!pedidos?.length) return {};
      const { data: items } = await supabase
        .from("pedido_items")
        .select("producto_id, pedidos(fecha_pedido)")
        .in("pedido_id", pedidos.map(p => p.id));
      const mapa = {};
      for (const item of items || []) {
        const fecha = item.pedidos?.fecha_pedido;
        if (!fecha) continue;
        if (!mapa[item.producto_id]) mapa[item.producto_id] = [];
        mapa[item.producto_id].push(fecha);
      }
      return mapa;
    } catch { return {}; }
  }

  async function cargarMediasHistoricas(tiendaId) {
    try {
      const hace90dias = new Date();
      hace90dias.setDate(hace90dias.getDate() - 90);
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id")
        .eq("tienda_id", tiendaId)
        .gte("fecha_pedido", hace90dias.toISOString())
        .limit(100);
      if (!pedidos?.length) return {};
      const { data: items } = await supabase
        .from("pedido_items")
        .select("producto_id, cantidad")
        .in("pedido_id", pedidos.map(p => p.id));
      if (!items?.length) return {};
      const grupos = {};
      for (const item of items) {
        if (!grupos[item.producto_id]) grupos[item.producto_id] = [];
        grupos[item.producto_id].push(item.cantidad);
      }
      const medias = {};
      for (const [prodId, cantidades] of Object.entries(grupos)) {
        if (cantidades.length < 3) continue;
        const media = cantidades.reduce((a, b) => a + b, 0) / cantidades.length;
        medias[prodId] = { media: Math.round(media), numPedidos: cantidades.length, cantidades };
      }
      return medias;
    } catch { return {}; }
  }

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
    } catch { return []; }
  }

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

  // ── Helper para calcular diasCaducidad de un producto ────────────
  const getDiasCaducidad = (prod) => {
    if (!prefAvisoCaducidad) return null;
    return prod.codigo ? (mapaCaducidades[prod.codigo] ?? null) : null;
  };

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

  const handleEnviar = async (observaciones, lineas) => {
    if (!lineas.length) return;
    setEnviando(true);
    try {
      const tiendaNombre  = tienda?.nombre || perfil?.nombre_completo || perfil?.nombre || user?.email || "Sin tienda";
      const numeroPedido  = "PED-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
      const fecha         = new Date().toISOString();

      const { data: pedido, error: pedidoError } = await supabase.from("pedidos").insert([{
        numero_pedido: numeroPedido,
        tienda_id:     tienda?.id || null,
        tienda_nombre: tiendaNombre,
        usuario_id:    user.id,
        usuario_email: user.email,
        usuario_nombre: perfil?.nombre_completo || perfil?.nombre || user.email,
        fecha_pedido:  fecha,
        estado:        "enviado",
        observaciones,
        total_lineas:  lineas.length,
        email_enviado: false,
      }]).select().single();
      if (pedidoError) throw pedidoError;

      const lineasData = lineas.map(({ prod, qty }) => ({
        pedido_id:          pedido.id,
        producto_id:        prod.id,
        producto_codigo:    prod.codigo || "",
        producto_nombre:    prod.nombre,
        producto_categoria: prod.categorias?.nombre || "",
        producto_formato:   prod.formato || "",
        cantidad:           qty,
        orden_excel:        prod.orden_excel || 0,
      }));

      const { error: lineasError } = await supabase.from("pedido_items").insert(lineasData);
      if (lineasError) throw lineasError;

      invalidateTopProductosCache();
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
    const asunto   = (getConf("asunto_email") || "Pedido - {Tienda} - {Fecha}")
      .replace("{Tienda}", tiendaNombre).replace("{Fecha}", fechaStr);
    const { data: todosProds } = await supabase
      .from("productos")
      .select("id,codigo,referencia,nombre,hoja_excel,seccion_excel,orden_excel,columna_excel")
      .eq("activo", true)
      .order("orden_excel", { ascending: true })
      .limit(2000);
    await supabase.functions.invoke("send-email", {
      body: { to: emailAlmacen, subject: asunto, tienda_nombre: tiendaNombre,
              numero_pedido: numeroPedido, fecha, observaciones,
              lineas: lineasData, todos_productos: todosProds || [] }
    });
    await supabase.from("pedidos").update({ email_enviado: true }).eq("id", pedidoId);
  }

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
            pedidoEstaSemanaPorProducto={pedidoEstaSemanaPorProducto}
            mediasPorProducto={mediasPorProducto}
          />
        </div>
      )}

      {tienda && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-medium ${
          tienda.grupo === "cafeteria"
            ? "bg-orange-50 text-orange-700 border border-orange-200"
            : "bg-[#edf7f2] text-[#007a34] border border-[#b3dfc4]"
        }`}>
          {tienda.grupo === "cafeteria" ? "☕" : "⚪"} <strong>{tienda.nombre}</strong> · {tienda.grupo === "cafeteria" ? "Cafetería" : "Estación"} · {productos.length} productos
        </div>
      )}

      {plantillaActiva && prefPlantilla && (
        <div className="mb-3 flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-2.5">
          <span className="text-sm text-purple-700 font-semibold flex-1">📋 {plantillaActiva.nombre}</span>
          <button onClick={togglePlantilla}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${plantillaOn ? "bg-purple-600 text-white" : "border border-purple-300 text-purple-600 hover:bg-purple-100"}`}>
            {plantillaOn ? "✓ Activa" : "Cargar"}
          </button>
          <button onClick={guardarPlantilla} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-300 text-purple-600 hover:bg-purple-100">
            Actualizar
          </button>
        </div>
      )}
      {!plantillaActiva && prefPlantilla && Object.values(carrito).some(v => v > 0) && (
        <div className="mb-3 flex justify-end">
          <button onClick={guardarPlantilla} className="text-xs text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1">
            💾 Guardar como plantilla
          </button>
        </div>
      )}

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
          style={{ background: "#1a3d2b", color: "white", minWidth: "120px" }}
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart size={20} color="white" />
          <span className="text-white">Pedido</span>
          {cartCount > 0 && (
            <span style={{
              background: "#00913f", color: "white", borderRadius: "50%",
              width: "22px", height: "22px", fontSize: "11px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "700", position: "absolute", top: "-8px", right: "-8px"
            }}>{cartCount}</span>
          )}
        </button>
      </div>

      {categorias.length > 0 && (
        <div className="mb-6 relative flex items-center gap-1.5">
          <button
            onClick={() => scrollCatRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all text-base leading-none shadow-sm"
            aria-label="Scroll izquierda"
          >‹</button>
          <div className="absolute left-9 top-0 bottom-0 w-5 pointer-events-none z-10"
            style={{ background: "linear-gradient(to right, white, transparent)" }} />
          <div
            ref={scrollCatRef}
            className="flex gap-2 overflow-x-auto flex-1 py-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <button
              onClick={() => setCategoriaActiva("__todas__")}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={categoriaActiva === "__todas__"
                ? { background: "#1a3d2b", color: "#fff", borderColor: "#1a3d2b" }
                : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: categoriaActiva === "__todas__" ? "#94a3b8" : "#cbd5e1" }} />
              Todas
            </button>
            {categorias.map((cat, idx) => {
              const color  = getCatColor(cat.nombre, idx);
              const activa = categoriaActiva === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaActiva(cat.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border"
                  style={activa
                    ? { background: "#1a3d2b", color: "#fff", borderColor: "#1a3d2b" }
                    : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: color, opacity: activa ? 0.9 : 0.7 }} />
                  {cat.nombre}
                </button>
              );
            })}
          </div>
          <div className="absolute right-9 top-0 bottom-0 w-5 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, white, transparent)" }} />
          <button
            onClick={() => scrollCatRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all text-base leading-none shadow-sm"
            aria-label="Scroll derecha"
          >›</button>
        </div>
      )}

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : categoriaActiva !== "__todas__" ? (
        // ── Vista filtrada por categoría — con diasCaducidad ──────────
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {productosFiltrados.map(prod => (
            <ProductCard key={prod.id} producto={prod}
              cantidad={carrito[prod.id] || 0}
              onAdd={() => handleAdd(prod)}
              onQtyChange={(qty) => handleQtyChange(prod.id, qty)}
              fechasPedido={prefDoblePedido ? (pedidoEstaSemanaPorProducto[prod.id] || []) : []}
              mediaHistorica={prefAvisosCantidad ? (mediasPorProducto[prod.id] || null) : null}
              esFavorito={favoritos.has(prod.id)}
              esTop={topProductos.has(prod.id)}
              onToggleFavorito={() => toggleFavorito(prod.id)}
              diasCaducidad={getDiasCaducidad(prod)}
            />
          ))}
        </div>
      ) : (
        // ── Vista "todas" agrupada por categoría ──────────────────────
        <div>
          {categorias.map((cat, idx) => {
            const prodsCategoria = productosFiltrados.filter(p => p.categoria_id === cat.id);
            if (!prodsCategoria.length) return null;
            const color = getCatColor(cat.nombre, idx);
            return (
              <div key={cat.id} className="mb-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                  <h2 className="text-lg font-bold text-gray-800">{cat.nombre}</h2>
                  <span className="text-sm text-gray-400 font-medium">({prodsCategoria.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {prodsCategoria.map(prod => (
                    <ProductCard key={prod.id} producto={prod}
                      cantidad={carrito[prod.id] || 0}
                      onAdd={() => handleAdd(prod)}
                      onQtyChange={(qty) => handleQtyChange(prod.id, qty)}
                      fechasPedido={prefDoblePedido ? (pedidoEstaSemanaPorProducto[prod.id] || []) : []}
                      mediaHistorica={prefAvisosCantidad ? (mediasPorProducto[prod.id] || null) : null}
                      esFavorito={favoritos.has(prod.id)}
                      esTop={topProductos.has(prod.id)}
                      onToggleFavorito={() => toggleFavorito(prod.id)}
                      diasCaducidad={getDiasCaducidad(prod)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {/* Productos sin categoría — con diasCaducidad ─────────────── */}
          {(() => {
            const sinCat = productosFiltrados.filter(p => !p.categoria_id);
            if (!sinCat.length) return null;
            return (
              <div className="mb-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#94a3b8", flexShrink: 0, display: "inline-block" }} />
                  <h2 className="text-lg font-bold text-gray-800">Sin categoría</h2>
                  <span className="text-sm text-gray-400 font-medium">({sinCat.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {sinCat.map(prod => (
                    <ProductCard key={prod.id} producto={prod}
                      cantidad={carrito[prod.id] || 0}
                      onAdd={() => handleAdd(prod)}
                      onQtyChange={(qty) => handleQtyChange(prod.id, qty)}
                      fechasPedido={prefDoblePedido ? (pedidoEstaSemanaPorProducto[prod.id] || []) : []}
                      mediaHistorica={prefAvisosCantidad ? (mediasPorProducto[prod.id] || null) : null}
                      esFavorito={favoritos.has(prod.id)}
                      esTop={topProductos.has(prod.id)}
                      onToggleFavorito={() => toggleFavorito(prod.id)}
                      diasCaducidad={getDiasCaducidad(prod)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
