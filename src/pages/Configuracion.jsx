import { useState, useEffect } from "react";
import { configuracionApi } from "../api";
import { Save, CheckCircle, Loader2, Mail, MessageSquare, FileText } from "lucide-react";

const CAMPOS = [
  { clave: "email_almacen", label: "Email del Almacén", descripcion: "Dirección donde se recibirán los pedidos", icon: Mail, placeholder: "almacen@empresa.com", type: "email" },
  { clave: "asunto_email", label: "Asunto del email", descripcion: "Usa {Tienda} y {Fecha} como variables", icon: FileText, placeholder: "Pedido - {Tienda} - {Fecha}", type: "text" },
  { clave: "texto_email", label: "Texto adicional en el email", descripcion: "Texto al final del email (opcional)", icon: MessageSquare, placeholder: "Texto adicional...", type: "textarea" },
];

export default function Configuracion() {
  const [valores, setValores] = useState({});
  const [ids, setIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState({});
  const [exito, setExito] = useState({});

  useEffect(() => {
    configuracionApi.list().then((configs) => {
      const vals = {};
      const idsMap = {};
      configs.forEach((c) => { vals[c.clave] = c.valor || ""; idsMap[c.clave] = c.id; });
      setValores(vals);
      setIds(idsMap);
      setLoading(false);
    });
  }, []);

  const handleGuardar = async (clave) => {
    setGuardando((g) => ({ ...g, [clave]: true }));
    const valor = valores[clave] || "";
    if (ids[clave]) {
      await configuracionApi.update(ids[clave], { clave, valor });
    } else {
      const nuevo = await configuracionApi.create({ clave, valor });
      setIds((prev) => ({ ...prev, [clave]: nuevo.id }));
    }
    setGuardando((g) => ({ ...g, [clave]: false }));
    setExito((e) => ({ ...e, [clave]: true }));
    setTimeout(() => setExito((e) => ({ ...e, [clave]: false })), 2000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes generales del sistema de pedidos</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {CAMPOS.map(({ clave, label, descripcion, icon: Icon, placeholder, type }) => (
          <div key={clave} className="p-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{descripcion}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              {type === "textarea" ? (
                <textarea
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400"
                  rows={3} placeholder={placeholder}
                  value={valores[clave] || ""}
                  onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
                />
              ) : (
                <input
                  type={type}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                  placeholder={placeholder}
                  value={valores[clave] || ""}
                  onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
                />
              )}
              <button
                onClick={() => handleGuardar(clave)}
                disabled={!!guardando[clave]}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0"
                style={{ background: exito[clave] ? "#22c55e" : "#2563eb", opacity: guardando[clave] ? 0.7 : 1 }}
              >
                {guardando[clave] ? <Loader2 size={16} className="animate-spin" /> : exito[clave] ? <CheckCircle size={16} /> : <Save size={16} />}
                {exito[clave] ? "Guardado" : "Guardar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}