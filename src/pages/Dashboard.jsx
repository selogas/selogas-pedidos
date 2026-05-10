import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Package, Store, ShoppingCart, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";

const COLORES = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

export default function Dashboard() {
  const [stats, setStats]           = useState(null);
  const [topProductos, setTop]      = useState([]);
  const [pedidosPorTienda, setPorTienda] = useState([]);
  const [pedidosPorSemana, setPorSemana] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [exportando, setExportando] = useState(false);
  const [uso, setUso] = useState(null);
  const [rango, setRango]           = useState(30); // días

  useEffect(() => { cargar(); }, [rango]);

  const cargar = async () => {
    setLoading(true);
    const desde = new Date();
    desde.setDate(desde.getDate() - rango);
    const desdeISO = desde.toISOString();

    // Stats generales
    const [{ count: totalPedidos }, { data: pedidosData }, { data: itemsData }] = await Promise.all([
      supabase.from("pedidos").select("*", { count: "exact", head: true }).gte("fecha_pedido", desdeISO),
      supabase.from("pedidos").select("id, tienda_nombre, fecha_pedido, total_lineas").gte("fecha_pedido", desdeISO).order("fecha_pedido"),
      supabase.from("pedido_items").select("producto_nombre, cantidad, pedido_id").in("pedido_id",
        (await supabase.from("pedidos").select("id").gte("fecha_pedido", desdeISO)).data?.map(p => p.id) || []
      ),
    ]);

    // Top productos
    const prodMap = {};
    for (const item of itemsData || []) {
      prodMap[item.producto_nombre] = (prodMap[item.producto_nombre] || 0) + item.cantidad;
    }
    const top = Object.entries(prodMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nombre, cantidad]) => ({ nombre: nombre.substring(0, 30), cantidad }));
    setTop(top);

    // Pedidos por tienda
    const tiendaMap = {};
    for (const p of pedidosData || []) {
      const t = p.tienda_nombre || "Sin tienda";
      tiendaMap[t] = (tiendaMap[t] || 0) + 1;
    }
    setPorTienda(Object.entries(tiendaMap).sort((a, b) => b[1] - a[1]).map(([nombre, pedidos]) => ({ nombre, pedidos })));

    // Pedidos por semana
    const semanaMap = {};
    for (const p of pedidosData || []) {
      const d = new Date(p.fecha_pedido);
      const lunes = new Date(d);
      lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = lunes.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      semanaMap[key] = (semanaMap[key] || 0) + 1;
    }
    setPorSemana(Object.entries(semanaMap).map(([semana, pedidos]) => ({ semana, pedidos })));

    setStats({ totalPedidos: totalPedidos || 0, totalTiendas: Object.keys(tiendaMap).length, totalProductos: Object.keys(prodMap).length });

    // Uso del sistema — solo en la carga inicial
    const { data: usoData } = await supabase.rpc("get_uso_sistema");
    if (usoData) setUso(usoData);

    setLoading(false);
  };

  const exportarExcel = async () => {
    setExportando(true);
    const desde = new Date();
    desde.setDate(desde.getDate() - rango);

    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("numero_pedido, tienda_nombre, fecha_pedido, estado, total_lineas, observaciones")
      .gte("fecha_pedido", desde.toISOString())
      .order("fecha_pedido", { ascending: false });

    const { data: items } = await supabase
      .from("pedido_items")
      .select("pedido_id, producto_codigo, producto_nombre, producto_categoria, cantidad, pedidos(numero_pedido, tienda_nombre, fecha_pedido)")
      .in("pedido_id", (pedidos || []).map(p => p.id));

    const wb = XLSX.utils.book_new();

    // Hoja resumen pedidos
    const ws1 = XLSX.utils.json_to_sheet((pedidos || []).map(p => ({
      "Nº Pedido": p.numero_pedido,
      "Tienda": p.tienda_nombre,
      "Fecha": new Date(p.fecha_pedido).toLocaleDateString("es-ES"),
      "Estado": p.estado,
      "Artículos": p.total_lineas,
      "Observaciones": p.observaciones || "",
    })));
    XLSX.utils.book_append_sheet(wb, ws1, "Pedidos");

    // Hoja detalle
    const ws2 = XLSX.utils.json_to_sheet((items || []).map(i => ({
      "Nº Pedido": i.pedidos?.numero_pedido,
      "Tienda": i.pedidos?.tienda_nombre,
      "Fecha": i.pedidos?.fecha_pedido ? new Date(i.pedidos.fecha_pedido).toLocaleDateString("es-ES") : "",
      "Código": i.producto_codigo,
      "Producto": i.producto_nombre,
      "Categoría": i.producto_categoria,
      "Cantidad": i.cantidad,
    })));
    XLSX.utils.book_append_sheet(wb, ws2, "Detalle");

    XLSX.writeFile(wb, `pedidos_selogas_${rango}dias.xlsx`);
    setExportando(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={40} className="animate-spin text-blue-500" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp size={24} className="text-blue-600" /> Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Análisis de pedidos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRango(d)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${rango === d ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-50"}`}>
              {d} días
            </button>
          ))}
          <button onClick={exportarExcel} disabled={exportando}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
            {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pedidos", value: stats?.totalPedidos, icon: ShoppingCart, color: "text-blue-600 bg-blue-50" },
          { label: "Tiendas activas", value: stats?.totalTiendas, icon: Store, color: "text-green-600 bg-green-50" },
          { label: "Productos pedidos", value: stats?.totalProductos, icon: Package, color: "text-purple-600 bg-purple-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border p-5 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
            <div>
              <div className="text-3xl font-black text-gray-900">{value ?? "—"}</div>
              <div className="text-sm text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top productos */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">🏆 Top productos más pedidos</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProductos} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={130} />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pedidos por tienda */}
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">🏪 Pedidos por tienda</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pedidosPorTienda} dataKey="pedidos" nameKey="nombre" cx="50%" cy="50%" outerRadius={90} label={({ nombre, percent }) => `${nombre.substring(0,12)} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {pedidosPorTienda.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Evolución semanal */}
      {pedidosPorSemana.length > 1 && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">📈 Pedidos por semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pedidosPorSemana}>
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pedidos" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* ── Uso del sistema ── */}
      {uso && (
        <div className="mt-6 bg-white rounded-2xl border p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            🖥️ Uso del sistema
            <span className="text-xs font-normal text-gray-400 ml-1">Límites del plan gratuito</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Base de datos */}
            {(() => {
              const pct = Math.min(100, Math.round((uso.db_size_mb / uso.db_limit_mb) * 100));
              const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500";
              const textColor = pct > 80 ? "text-red-700" : pct > 60 ? "text-amber-700" : "text-green-700";
              const bgColor = pct > 80 ? "bg-red-50 border-red-200" : pct > 60 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";
              return (
                <div className={`border rounded-xl p-4 ${bgColor}`}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">💾 Base de datos</span>
                    <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: pct + "%" }} />
                  </div>
                  <p className="text-xs text-gray-500">{uso.db_size_mb} MB de 500 MB</p>
                  {pct > 80 && <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Considera actualizar a Pro (25€/mes)</p>}
                </div>
              );
            })()}

            {/* Emails Resend */}
            {(() => {
              const limite = 3000;
              const pct = Math.min(100, Math.round((uso.emails_este_mes / limite) * 100));
              const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500";
              const textColor = pct > 80 ? "text-red-700" : pct > 60 ? "text-amber-700" : "text-green-700";
              const bgColor = pct > 80 ? "bg-red-50 border-red-200" : pct > 60 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";
              return (
                <div className={`border rounded-xl p-4 ${bgColor}`}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">📧 Emails (Resend)</span>
                    <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: pct + "%" }} />
                  </div>
                  <p className="text-xs text-gray-500">{uso.emails_este_mes} de {limite} este mes</p>
                  {pct > 80 && <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Límite próximo — plan gratuito Resend</p>}
                </div>
              );
            })()}

            {/* Resumen general */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-3">📊 Totales</p>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between"><span>Tiendas activas</span><span className="font-bold">{uso.total_tiendas}</span></div>
                <div className="flex justify-between"><span>Usuarios</span><span className="font-bold">{uso.total_usuarios}</span></div>
                <div className="flex justify-between"><span>Productos</span><span className="font-bold">{uso.total_productos}</span></div>
                <div className="flex justify-between"><span>Pedidos totales</span><span className="font-bold">{uso.total_pedidos}</span></div>
                <div className="flex justify-between"><span>Pedidos este mes</span><span className="font-bold text-blue-600">{uso.pedidos_este_mes}</span></div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            ℹ️ El ancho de banda de Supabase (500 MB/mes gratis) no se puede medir desde la app.
            Consúltalo en <a href="https://supabase.com/dashboard/project/pasllyqgczegpvquaxvb/reports" target="_blank" rel="noreferrer" className="text-blue-500 underline">Supabase Dashboard → Reports</a>.
          </p>
        </div>
      )}
    </div>
  );
}
