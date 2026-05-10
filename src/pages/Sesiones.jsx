import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Wifi, WifiOff, RefreshCw, LogOut, AlertTriangle, Users, Loader2, ShieldOff } from "lucide-react";

export default function Sesiones() {
  const [sesiones, setSesiones]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [mantenimiento, setMantenimiento] = useState(false);
  const [toggling, setToggling]         = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const intervalRef = useRef(null);

  const cargar = async () => {
    // Sesiones activas en los últimos 5 minutos
    const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("sesiones_activas")
      .select("*")
      .gte("ultima_actividad", hace5min)
      .order("ultima_actividad", { ascending: false });
    setSesiones(data || []);
    setLoading(false);

    // Leer modo mantenimiento
    const { data: conf } = await supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "modo_mantenimiento")
      .single();
    setMantenimiento(conf?.valor === "true");
  };

  useEffect(() => {
    cargar();
    intervalRef.current = setInterval(cargar, 30000); // refrescar cada 30s
    return () => clearInterval(intervalRef.current);
  }, []);

  const toggleMantenimiento = async () => {
    setToggling(true);
    const nuevoValor = (!mantenimiento).toString();
    await supabase.from("configuracion")
      .update({ valor: nuevoValor })
      .eq("clave", "modo_mantenimiento");
    setMantenimiento(!mantenimiento);
    setToggling(false);
  };

  const desconectarTodos = async () => {
    if (!confirm("¿Desconectar a todas las tiendas ahora mismo? Perderán su sesión activa.")) return;
    setDesconectando(true);
    // Activar mantenimiento primero
    await supabase.from("configuracion").update({ valor: "true" }).eq("clave", "modo_mantenimiento");
    setMantenimiento(true);
    // Borrar todas las sesiones excepto la del admin
    await supabase.from("sesiones_activas").delete().neq("tienda_nombre", "PRINCIPAL");
    await cargar();
    setDesconectando(false);
  };

  const tiempoDesde = (iso) => {
    const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seg < 60) return `hace ${seg}s`;
    if (seg < 3600) return `hace ${Math.floor(seg / 60)}min`;
    return `hace ${Math.floor(seg / 3600)}h`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> Sesiones activas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tiendas conectadas en los últimos 5 minutos · se actualiza cada 30s
          </p>
        </div>
        <button onClick={cargar} className="p-2.5 border rounded-xl hover:bg-gray-50 text-gray-500" title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Panel de mantenimiento */}
      <div className={`rounded-2xl border-2 p-5 mb-6 transition-all ${mantenimiento ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${mantenimiento ? "bg-red-100" : "bg-gray-100"}`}>
              <ShieldOff size={20} className={mantenimiento ? "text-red-600" : "text-gray-500"} />
            </div>
            <div>
              <p className="font-bold text-gray-900">Modo mantenimiento</p>
              <p className="text-sm text-gray-500">
                {mantenimiento
                  ? "🔴 Activo — las tiendas no pueden entrar a la app"
                  : "🟢 Desactivado — acceso normal para todas las tiendas"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleMantenimiento}
              disabled={toggling}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                mantenimiento
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-700 text-white hover:bg-gray-800"
              } disabled:opacity-50`}
            >
              {toggling ? <Loader2 size={15} className="animate-spin" /> : null}
              {mantenimiento ? "✓ Reactivar acceso" : "Activar mantenimiento"}
            </button>
            <button
              onClick={desconectarTodos}
              disabled={desconectando}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50"
              title="Activa el mantenimiento y desconecta todas las tiendas ahora"
            >
              {desconectando ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Desconectar todos
            </button>
          </div>
        </div>
        {mantenimiento && (
          <div className="mt-3 p-3 bg-red-100 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle size={15} className="flex-shrink-0" />
            Las tiendas que intenten entrar verán una pantalla de mantenimiento. Tú sigues con acceso completo como admin.
          </div>
        )}
      </div>

      {/* Lista de sesiones */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <WifiOff size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No hay tiendas conectadas ahora mismo</p>
          <p className="text-sm mt-1">Se considera activa si ha tenido actividad en los últimos 5 minutos</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-700">{sesiones.length} {sesiones.length === 1 ? "tienda conectada" : "tiendas conectadas"}</span>
          </div>
          <div className="divide-y">
            {sesiones.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.tienda_nombre || "Sin tienda"}</p>
                  <p className="text-xs text-gray-400 truncate">{s.usuario_nombre}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                  <Wifi size={12} className="text-green-500" />
                  {tiempoDesde(s.ultima_actividad)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
