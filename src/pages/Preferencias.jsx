import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SlidersHorizontal, Loader2, Check, Store } from "lucide-react";

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-[#00913f]" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const OPCIONES = [
  {
    key: "pref_plantilla",
    titulo: "Plantilla de pedido",
    desc: "Permite guardar y cargar una plantilla de pedido tipo. Aparece la barra de plantilla en el catálogo.",
    icono: "📋",
  },
  {
    key: "pref_avisos_cantidad",
    titulo: "Avisos de cantidad histórica",
    desc: 'Avisa cuando la cantidad pedida es inusual vs la media. Ej: "Sueles pedir 24 uds".',
    icono: "📊",
  },
  {
    key: "pref_doble_pedido_aviso",
    titulo: "Aviso de doble pedido semanal",
    desc: "Avisa cuando un producto ya fue pedido esta semana. Requiere que la tienda tenga Doble Pedido activado.",
    icono: "🔁",
  },
  {
    key: "pref_aviso_caducidad",
    titulo: "Aviso de caducidad en catálogo",
    desc: "Marca los productos que caducan en menos de 15 días directamente en el catálogo de pedidos.",
    icono: "⚠️",
  },
];

export default function Preferencias() {
  const { isAdmin } = useAuth();
  const [tiendas, setTiendas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState({});
  const [saved, setSaved]       = useState({});

  useEffect(() => {
    supabase.from("tiendas")
      .select("id, nombre, pref_plantilla, pref_avisos_cantidad, pref_doble_pedido_aviso, pref_aviso_caducidad, doble_pedido")
      .neq("nombre", "PRINCIPAL")
      .eq("activa", true)
      .order("nombre")
      .then(({ data }) => { setTiendas(data || []); setLoading(false); });
  }, []);

  const handleToggle = async (tiendaId, key, val) => {
    setTiendas(prev => prev.map(t => t.id === tiendaId ? { ...t, [key]: val } : t));
    setSaving(prev => ({ ...prev, [tiendaId + key]: true }));

    await supabase.from("tiendas").update({ [key]: val }).eq("id", tiendaId);

    setSaving(prev => ({ ...prev, [tiendaId + key]: false }));
    setSaved(prev => ({ ...prev, [tiendaId]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [tiendaId]: false })), 2000);
  };

  if (!isAdmin) return (
    <div className="max-w-xl mx-auto text-center py-20 text-gray-400">
      <SlidersHorizontal size={40} className="mx-auto mb-3 opacity-30" />
      <p>Esta sección es solo para administradores.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <SlidersHorizontal size={22} className="text-[#00913f]" />
        <h1 className="text-2xl font-bold text-gray-900">Preferencias por tienda</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Activa o desactiva las funciones inteligentes del catálogo para cada tienda.
      </p>

      {/* Cabecera de columnas */}
      <div className="hidden md:grid grid-cols-[1fr_repeat(4,110px)] gap-2 px-4 mb-2">
        <div />
        {OPCIONES.map(op => (
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
              className={`grid grid-cols-1 md:grid-cols-[1fr_repeat(4,110px)] gap-3 items-center px-5 py-4 ${
                i > 0 ? "border-t border-gray-100" : ""
              } hover:bg-gray-50 transition-colors`}>

              {/* Nombre tienda */}
              <div className="flex items-center gap-2">
                <Store size={15} className="text-gray-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{tienda.nombre}</p>
                  {tienda.doble_pedido && (
                    <span className="text-xs text-[#00913f] font-medium">Doble pedido activo</span>
                  )}
                </div>
                {saved[tienda.id] && (
                  <span className="flex items-center gap-1 text-xs text-[#00913f] font-semibold ml-2">
                    <Check size={12} /> Guardado
                  </span>
                )}
              </div>

              {/* Toggles */}
              {OPCIONES.map(op => (
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

      {/* Leyenda */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {OPCIONES.map(op => (
          <div key={op.key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-700 mb-1">{op.icono} {op.titulo}</p>
            <p className="text-xs text-gray-400 leading-snug">{op.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
