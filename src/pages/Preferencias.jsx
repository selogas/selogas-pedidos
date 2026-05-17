import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SlidersHorizontal, Loader2, Check, Store, Bell } from "lucide-react";

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-[#00913f]" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const OPCIONES_ADMIN = [
  { key: "pref_plantilla",          titulo: "Plantilla de pedido",          desc: "Permite guardar y cargar una plantilla de pedido tipo.",                                            icono: "📋" },
  { key: "pref_avisos_cantidad",    titulo: "Avisos de cantidad histórica", desc: 'Avisa cuando la cantidad pedida es inusual vs la media. Ej: "Sueles pedir 24 uds".',             icono: "📊" },
  { key: "pref_doble_pedido_aviso", titulo: "Aviso de doble pedido",        desc: "Avisa cuando un producto ya fue pedido esta semana.",                                              icono: "🔁" },
  { key: "pref_aviso_caducidad",    titulo: "Aviso de caducidad",           desc: "Marca los productos que caducan en menos de 15 días directamente en el catálogo.",               icono: "⚠️" },
];

const OPCIONES_TIENDA = [
  { key: "pref_aviso_caducidad", titulo: "Aviso de caducidad en catálogo", desc: "Muestra un aviso en el catálogo cuando un producto caduca en menos de 15 días.", icono: "⚠️" },
];

// ── Vista tienda ─────────────────────────────────────────────────────
function PreferenciasTienda() {
  const { perfil } = useAuth();
  const tienda = perfil?.tiendas || null;
  const [prefs, setPrefs]   = useState(null);
  const [saving, setSaving] = useState({});
  const [saved, setSaved]   = useState({});

  useEffect(() => {
    if (!tienda?.id) return;
    supabase.from("tiendas")
      .select("id, pref_plantilla, pref_avisos_cantidad, pref_doble_pedido_aviso, pref_aviso_caducidad")
      .eq("id", tienda.id).single()
      .then(({ data }) => setPrefs(data || {}));
  }, [tienda?.id]);

  const handleToggle = async (key, val) => {
    if (!tienda?.id) return;
    setPrefs(prev => ({ ...prev, [key]: val }));
    setSaving(prev => ({ ...prev, [key]: true }));
    await supabase.from("tiendas").update({ [key]: val }).eq("id", tienda.id);
    setSaving(prev => ({ ...prev, [key]: false }));
    setSaved(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000);
  };

  if (!tienda) return (
    <div className="max-w-xl mx-auto text-center py-20 text-gray-400">
      <SlidersHorizontal size={40} className="mx-auto mb-3 opacity-30" />
      <p>No tienes una tienda asignada.</p>
    </div>
  );

  if (!prefs) return (
    <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#00913f]" /></div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <SlidersHorizontal size={22} className="text-[#00913f]" />
        <h1 className="text-2xl font-bold text-gray-900">Mis preferencias</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Personaliza cómo funciona el catálogo para <strong>{tienda.nombre}</strong>.
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {OPCIONES_TIENDA.map(op => (
          <div key={op.key} className="flex items-center gap-4 px-5 py-4">
            <div className="text-2xl flex-shrink-0">{op.icono}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{op.titulo}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{op.desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saved[op.key] && (
                <span className="flex items-center gap-1 text-xs text-[#00913f] font-semibold">
                  <Check size={12} /> Guardado
                </span>
              )}
              {saving[op.key] && <Loader2 size={14} className="animate-spin text-[#00913f]" />}
              <Toggle value={prefs[op.key] !== false} onChange={(v) => handleToggle(op.key, v)} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center mt-4">
        Estos ajustes son solo para tu tienda y se guardan automáticamente.
      </p>
    </div>
  );
}

// ── Vista admin ──────────────────────────────────────────────────────
export default function Preferencias() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return <PreferenciasTienda />;

  const [tiendas, setTiendas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState({});
  const [saved, setSaved]       = useState({});

  // Interruptor global de recordatorios
  const [recordatoriosActivos, setRecordatoriosActivos] = useState(true);
  const [guardandoRec, setGuardandoRec] = useState(false);
  const [savedRec, setSavedRec]         = useState(false);

  useEffect(() => {
    // Cargar tiendas
    supabase.from("tiendas")
      .select("id, nombre, pref_plantilla, pref_avisos_cantidad, pref_doble_pedido_aviso, pref_aviso_caducidad, doble_pedido")
      .neq("nombre", "PRINCIPAL").eq("activa", true).order("nombre")
      .then(({ data }) => { setTiendas(data || []); setLoading(false); });

    // Cargar estado de recordatorios
    supabase.from("configuracion").select("valor").eq("clave", "recordatorios_activos").single()
      .then(({ data }) => { if (data) setRecordatoriosActivos(data.valor !== "false"); });
  }, []);

  const handleToggle = async (tiendaId, key, val) => {
    setTiendas(prev => prev.map(t => t.id === tiendaId ? { ...t, [key]: val } : t));
    setSaving(prev => ({ ...prev, [tiendaId + key]: true }));
    await supabase.from("tiendas").update({ [key]: val }).eq("id", tiendaId);
    setSaving(prev => ({ ...prev, [tiendaId + key]: false }));
    setSaved(prev => ({ ...prev, [tiendaId]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [tiendaId]: false })), 2000);
  };

  const toggleRecordatorios = async (val) => {
    setRecordatoriosActivos(val);
    setGuardandoRec(true);
    await supabase.from("configuracion")
      .update({ valor: String(val) })
      .eq("clave", "recordatorios_activos");
    setGuardandoRec(false);
    setSavedRec(true);
    setTimeout(() => setSavedRec(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <SlidersHorizontal size={22} className="text-[#00913f]" />
        <h1 className="text-2xl font-bold text-gray-900">Preferencias</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Ajustes globales del sistema y preferencias por tienda.
      </p>

      {/* ── Interruptor global recordatorios ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
          <Bell size={15} className="text-[#00913f]" />
          <p className="font-semibold text-gray-700 text-sm">Recordatorios automáticos de pedido</p>
        </div>
        <div className="flex items-start gap-4 px-5 py-4">
          <div className="text-2xl flex-shrink-0">🔔</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">Activar sistema de recordatorios</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              Cuando está activo, las tiendas reciben un aviso automático el día laborable anterior
              a su día de entrega si no han enviado el pedido. Desactívalo aquí para pausar todos los avisos globalmente.
            </p>
            {!recordatoriosActivos && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
                ⚠️ Recordatorios desactivados — las tiendas no recibirán avisos aunque tengan días configurados.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {savedRec && (
              <span className="flex items-center gap-1 text-xs text-[#00913f] font-semibold">
                <Check size={12} /> Guardado
              </span>
            )}
            {guardandoRec && <Loader2 size={14} className="animate-spin text-[#00913f]" />}
            <Toggle value={recordatoriosActivos} onChange={toggleRecordatorios} />
          </div>
        </div>
      </div>

      {/* ── Preferencias por tienda ── */}
      <div className="hidden md:grid grid-cols-[1fr_repeat(4,110px)] gap-2 px-4 mb-2">
        <div />
        {OPCIONES_ADMIN.map(op => (
          <div key={op.key} className="text-center">
            <div className="text-lg">{op.icono}</div>
            <div className="text-xs font-semibold text-gray-500 leading-tight mt-0.5">{op.titulo}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[#00913f]" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {tiendas.map((tienda, i) => (
            <div key={tienda.id}
              className={`grid grid-cols-1 md:grid-cols-[1fr_repeat(4,110px)] gap-3 items-center px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
              <div className="flex items-center gap-2">
                <Store size={15} className="text-gray-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{tienda.nombre}</p>
                  {tienda.doble_pedido && <span className="text-xs text-[#00913f] font-medium">Doble pedido activo</span>}
                </div>
                {saved[tienda.id] && (
                  <span className="flex items-center gap-1 text-xs text-[#00913f] font-semibold ml-2">
                    <Check size={12} /> Guardado
                  </span>
                )}
              </div>
              {OPCIONES_ADMIN.map(op => (
                <div key={op.key} className="flex md:justify-center items-center gap-2">
                  <span className="md:hidden text-xs text-gray-500 flex-1">{op.icono} {op.titulo}</span>
                  <div className="relative">
                    <Toggle
                      value={tienda[op.key] !== false}
                      onChange={(v) => handleToggle(tienda.id, op.key, v)}
                    />
                    {saving[tienda.id + op.key] && (
                      <Loader2 size={10} className="animate-spin text-[#00913f] absolute -top-1 -right-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Leyenda de opciones */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {OPCIONES_ADMIN.map(op => (
          <div key={op.key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-700 mb-1">{op.icono} {op.titulo}</p>
            <p className="text-xs text-gray-400 leading-snug">{op.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Necesario porque PreferenciasTienda usa useAuth
import { useAuth } from "@/lib/auth";
