import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, Calendar, Loader2, RefreshCw, Package, CheckCircle } from "lucide-react";

const SEMAFORO = {
  rojo:     { color: "bg-red-100 border-red-300 text-red-800",     dot: "bg-red-500",    label: "Caduca en menos de 3 días", orden: 0 },
  naranja:  { color: "bg-orange-100 border-orange-300 text-orange-800", dot: "bg-orange-500", label: "Caduca esta semana",        orden: 1 },
  amarillo: { color: "bg-yellow-100 border-yellow-300 text-yellow-800", dot: "bg-yellow-500", label: "Caduca en 2 semanas",       orden: 2 },
  verde:    { color: "bg-green-100 border-green-300 text-green-800",  dot: "bg-green-500",  label: "Caduca en el mes",           orden: 3 },
};

function TarjetaCaducidad({ item }) {
  const s = SEMAFORO[item.semaforo];
  const fecha = new Date(item.fecha + "T00:00:00");
  const fechaStr = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`border-2 rounded-xl p-4 ${s.color} flex items-center gap-4`}>
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{item.producto}</p>
        <p className="text-xs mt-0.5 capitalize">{fechaStr}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-2xl font-black ${item.diasRestantes <= 3 ? "text-red-600" : ""}`}>
          {item.diasRestantes === 0 ? "¡HOY!" : item.diasRestantes === 1 ? "1 día" : `${item.diasRestantes}d`}
        </div>
      </div>
    </div>
  );
}

export default function Caducidades() {
  const { perfil } = useAuth();
  const [caducidades, setCaducidades] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [tienda, setTienda]           = useState(null);
  const [sinCalendario, setSinCalendario] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("get-caducidades", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data;

      if (data.error) throw new Error(data.error);
      if (data.sinCalendario) { setSinCalendario(true); return; }

      setCaducidades(data.caducidades || []);
      setTienda(data.tienda);
      setUltimaActualizacion(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Agrupar por semáforo
  const grupos = {
    rojo:     caducidades.filter(c => c.semaforo === "rojo"),
    naranja:  caducidades.filter(c => c.semaforo === "naranja"),
    amarillo: caducidades.filter(c => c.semaforo === "amarillo"),
    verde:    caducidades.filter(c => c.semaforo === "verde"),
  };

  const total = caducidades.length;
  const urgentes = grupos.rojo.length + grupos.naranja.length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-gray-500">Cargando caducidades del calendario...</p>
      </div>
    </div>
  );

  if (sinCalendario) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <Calendar size={60} className="mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sin calendario configurado</h2>
      <p className="text-gray-400 text-sm">Esta tienda no tiene un Google Calendar asignado. Contacta con el administrador.</p>
    </div>
  );

  if (error) {
    const esSecrets  = error.includes('SECRETS_MISSING');
    const esPermiso  = error.includes('CALENDAR_NO_PERMISSION') || error.includes('CALENDAR_NOT_FOUND');
    const msgLimpio  = error.replace(/^[A-Z_]+: /, '');
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle size={48} className="mx-auto mb-3 text-red-400" />
          <h2 className="text-lg font-bold text-red-800 mb-2">
            {esSecrets ? "Credenciales de Google no configuradas" :
             esPermiso ? "Sin acceso al calendario" : "Error al cargar caducidades"}
          </h2>
          <p className="text-red-700 text-sm mb-4">{msgLimpio}</p>
          {esSecrets && (
            <div className="bg-white border border-red-200 rounded-xl p-4 text-left text-xs text-gray-600 mb-4">
              <p className="font-semibold mb-2">Pasos para configurar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ve a <strong>Supabase → Settings → Edge Functions</strong></li>
                <li>Añade los secrets: <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_ID</code>, <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, <code className="bg-gray-100 px-1 rounded">GOOGLE_REFRESH_TOKEN</code></li>
              </ol>
            </div>
          )}
          {esPermiso && (
            <div className="bg-white border border-red-200 rounded-xl p-4 text-left text-xs text-gray-600 mb-4">
              <p className="font-semibold mb-1">Solución:</p>
              <p>Comparte el Google Calendar de esta tienda con <strong>caducidades@gmail.com</strong> con permisos de lectura.</p>
            </div>
          )}
          <button onClick={cargar} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 mx-auto text-sm">
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={24} className="text-blue-600" /> Mis Caducidades
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {tienda && <span className="font-semibold">{tienda} · </span>}
            Próximos 30 días · {total} {total === 1 ? "producto" : "productos"}
            {ultimaActualizacion && (
              <span className="text-gray-400"> · Actualizado {ultimaActualizacion.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <button onClick={cargar} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500" title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Resumen */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(grupos).map(([key, items]) => {
            const s = SEMAFORO[key];
            return (
              <div key={key} className={`rounded-xl border-2 p-3 text-center ${s.color}`}>
                <div className="text-2xl font-black">{items.length}</div>
                <div className="text-xs font-semibold mt-0.5">{
                  key === "rojo" ? "Urgente" :
                  key === "naranja" ? "Esta semana" :
                  key === "amarillo" ? "2 semanas" : "Este mes"
                }</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alerta urgentes */}
      {urgentes > 0 && (
        <div className="mb-5 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3">
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 font-semibold text-sm">
            ⚠️ Tienes <strong>{urgentes} {urgentes === 1 ? "producto" : "productos"}</strong> que {urgentes === 1 ? "caduca" : "caducan"} esta semana. Revísalos y retíralos si es necesario.
          </p>
        </div>
      )}

      {/* Sin productos */}
      {total === 0 && (
        <div className="text-center py-16">
          <CheckCircle size={60} className="mx-auto mb-4 text-green-400" />
          <h2 className="text-xl font-bold text-gray-600 mb-2">¡Todo en orden!</h2>
          <p className="text-gray-400">No hay productos con caducidad en los próximos 30 días.</p>
        </div>
      )}

      {/* Grupos */}
      {Object.entries(grupos).map(([key, items]) => {
        if (!items.length) return null;
        const s = SEMAFORO[key];
        return (
          <div key={key} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-3 h-3 rounded-full ${s.dot}`} />
              <h2 className="font-bold text-gray-700">{s.label}</h2>
              <span className="text-sm text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <TarjetaCaducidad key={i} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
