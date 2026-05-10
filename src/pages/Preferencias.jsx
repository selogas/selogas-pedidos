import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Settings, Check, Loader2 } from "lucide-react";

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
        value ? "bg-[#00913f]" : "bg-gray-200"
      } disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        value ? "translate-x-6" : "translate-x-0.5"
      }`} />
    </button>
  );
}

export default function Preferencias() {
  const { perfil, isAdmin } = useAuth();

  const [prefs, setPrefs] = useState({
    pref_plantilla:       perfil?.pref_plantilla       !== false,
    pref_avisos_cantidad: perfil?.pref_avisos_cantidad  !== false,
    pref_doble_pedido:    perfil?.pref_doble_pedido     !== false,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleChange = (key, val) => {
    setPrefs(p => ({ ...p, [key]: val }));
    setSaved(false);
  };

  const guardar = async () => {
    setSaving(true);
    await supabase.from("perfiles").update(prefs).eq("id", perfil.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const opciones = [
    {
      key:   "pref_plantilla",
      titulo: "Plantilla de pedido",
      desc:   "Muestra la barra de plantilla en el catálogo y permite cargar automáticamente los productos guardados al entrar.",
      icono:  "📋",
    },
    {
      key:   "pref_avisos_cantidad",
      titulo: "Avisos de cantidad histórica",
      desc:   "Avisa cuando pides una cantidad inusual respecto a tu media de los últimos 90 días. Ej: «Sueles pedir 24 uds».",
      icono:  "📊",
    },
    {
      key:   "pref_doble_pedido",
      titulo: "Aviso de doble pedido semanal",
      desc:   "Avisa cuando añades al carrito un producto que ya has pedido esta semana, mostrando el día en que se pidió.",
      icono:  "🔁",
      soloSi: perfil?.tiendas?.doble_pedido, // solo relevante si la tienda tiene doble_pedido activo
    },
  ];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={22} className="text-[#00913f]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preferencias</h1>
          <p className="text-gray-400 text-sm">Personaliza cómo funciona el catálogo</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
        {opciones.map((op, i) => (
          <div key={op.key}
            className={`flex items-center gap-4 p-5 ${i > 0 ? "border-t border-gray-100" : ""}`}>
            <div className="w-10 h-10 rounded-xl bg-[#edf7f2] flex items-center justify-center text-xl flex-shrink-0">
              {op.icono}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{op.titulo}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{op.desc}</p>
              {op.soloSi === false && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  ⚠️ Esta opción solo tiene efecto si el admin ha activado "Doble pedido" en tu tienda
                </p>
              )}
            </div>
            <Toggle
              value={prefs[op.key]}
              onChange={(v) => handleChange(op.key, v)}
            />
          </div>
        ))}
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        className="w-full py-3 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
      >
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
          : saved
          ? <><Check size={16} /> Guardado correctamente</>
          : "Guardar preferencias"
        }
      </button>

      {!isAdmin && (
        <p className="text-xs text-center text-gray-400 mt-3">
          Estas preferencias son personales — solo afectan a tu cuenta
        </p>
      )}
    </div>
  );
}
