import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, Store, X, Check, Loader2,
  Users, Mail, ShieldCheck, ShieldAlert,
  UserPlus, Eye, EyeOff, RefreshCw, Calendar, Save,
  Bell, Play, CheckCircle, FlaskConical
} from "lucide-react";

const DIAS_SEMANA = [
  { value: 0, label: "Lunes",     short: "L" },
  { value: 1, label: "Martes",    short: "M" },
  { value: 2, label: "Miércoles", short: "X" },
  { value: 3, label: "Jueves",    short: "J" },
  { value: 4, label: "Viernes",   short: "V" },
  { value: 5, label: "Sábado",    short: "S" },
  { value: 6, label: "Domingo",   short: "D" },
];

// Día en que se envía el aviso para cada día de llegada
// Llegada Lunes(0) → aviso Viernes(4) anterior
// Llegada Mar-Vie  → aviso el día anterior
const DIA_AVISO: Record<number, string> = {
  0: "Viernes (semana anterior)",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
};

// ── Selector de días múltiple ────────────────────────────────────────
function SelectorDias({ value = [], onChange }) {
  const actual = Array.isArray(value) ? value : [];
  const toggle = (diaVal) => {
    if (actual.includes(diaVal)) {
      onChange(actual.filter(v => v !== diaVal).sort((a, b) => a - b));
    } else {
      onChange([...actual, diaVal].sort((a, b) => a - b));
    }
  };
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DIAS_SEMANA.map(d => (
        <button key={d.value} type="button" onClick={() => toggle(d.value)}
          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all border-2 ${
            actual.includes(d.value)
              ? "bg-[#00913f] text-white border-[#00913f] shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-[#00913f] hover:text-[#00913f]"
          }`} title={d.label}>
          {d.short}
        </button>
      ))}
      {actual.length > 0 && (
        <button type="button" onClick={() => onChange([])}
          className="px-2 h-9 rounded-xl text-xs text-gray-400 hover:text-red-400 border-2 border-dashed border-gray-200 hover:border-red-200 transition-all" title="Quitar todos">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Badges de días con su día de aviso ──────────────────────────────
function BadgesDias({ dias }) {
  if (!Array.isArray(dias) || dias.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {dias.map(v => {
        const d = DIAS_SEMANA.find(x => x.value === v);
        return d ? (
          <span key={v} className="text-xs px-2 py-0.5 bg-[#edf7f2] text-[#007a34] rounded-full font-semibold">{d.label}</span>
        ) : null;
      })}
    </div>
  );
}

// ── Modal Tienda ─────────────────────────────────────────────────────
function TiendaModal({ tienda, onSave, onClose }) {
  const diasIniciales = Array.isArray(tienda?.dia_pedido) ? tienda.dia_pedido : [];
  const [form, setForm] = useState(
    tienda
      ? { ...tienda, dia_pedido: diasIniciales }
      : { nombre: "", codigo: "", email: "", responsable: "", activa: true, grupo: "estacion", mensaje_banner: "", google_calendar_id: "", doble_pedido: false, dia_pedido: [] }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);
    const campos = {
      nombre:             form.nombre,
      codigo:             form.codigo || null,
      email:              form.email || null,
      responsable:        form.responsable || null,
      grupo:              form.grupo || "estacion",
      activa:             form.activa !== false,
      mensaje_banner:     form.mensaje_banner || null,
      google_calendar_id: form.google_calendar_id || null,
      doble_pedido:       form.doble_pedido === true,
      dia_pedido:         Array.isArray(form.dia_pedido) && form.dia_pedido.length > 0 ? form.dia_pedido : null,
    };
    if (tienda?.id) {
      const { error } = await supabase.from("tiendas").update(campos).eq("id", tienda.id);
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tiendas").insert([campos]);
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSave();
  };

  const diasSeleccionados = Array.isArray(form.dia_pedido) ? form.dia_pedido : [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{tienda ? "Editar Tienda" : "Nueva Tienda"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          {[
            { field: "nombre",      label: "Nombre de la tienda", required: true },
            { field: "codigo",      label: "Código" },
            { field: "email",       label: "Email" },
            { field: "responsable", label: "Responsable" },
          ].map(({ field, label, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 text-gray-700">{label}{required && " *"}</label>
              <input type={field === "email" ? "email" : "text"} value={form[field] || ""}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]" />
            </div>
          ))}

          {/* Selector días + tabla de avisos */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 flex items-center gap-1.5">
              <Bell size={14} className="text-[#00913f]" />
              Días que llega el pedido
              {diasSeleccionados.length > 0 && (
                <span className="text-xs text-gray-400 font-normal">({diasSeleccionados.length} día{diasSeleccionados.length > 1 ? "s" : ""})</span>
              )}
            </label>
            <SelectorDias value={form.dia_pedido} onChange={dias => setForm(f => ({ ...f, dia_pedido: dias }))} />

            {/* Tabla de cuándo salta el aviso */}
            {diasSeleccionados.length > 0 && (
              <div className="mt-2 rounded-xl border border-[#b3dfc4] bg-[#edf7f2] overflow-hidden">
                <div className="px-3 py-1.5 text-xs font-semibold text-[#007a34] border-b border-[#b3dfc4]">
                  📬 Cuándo se enviará el aviso si no hay pedido
                </div>
                {diasSeleccionados.map(v => {
                  const d = DIAS_SEMANA.find(x => x.value === v);
                  const aviso = DIA_AVISO[v] ?? "—";
                  return d ? (
                    <div key={v} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[#d9f0e4] last:border-0">
                      <span className="text-gray-600">Llega el <strong>{d.label}</strong></span>
                      <span className="text-[#007a34] font-semibold">→ aviso el {aviso}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">
              El aviso se envía el día laborable anterior si esa semana no hay pedido registrado.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">📅 Google Calendar ID</label>
            <input type="text" value={form.google_calendar_id || ""}
              onChange={e => setForm(f => ({ ...f, google_calendar_id: e.target.value }))}
              placeholder="Ej: tormo22@megino.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">📢 Mensaje banner</label>
            <textarea value={form.mensaje_banner || ""}
              onChange={e => setForm(f => ({ ...f, mensaje_banner: e.target.value }))}
              placeholder="Ej: Tu día de pedido es el MARTES..."
              rows={2} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254] resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Tipo de tienda *</label>
            <select value={form.grupo || "estacion"} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]">
              <option value="estacion">🏪 Estación</option>
              <option value="cafeteria">☕ Cafetería</option>
              <option value="ambos">📦 Ambos</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.doble_pedido === true}
              onChange={e => setForm(f => ({ ...f, doble_pedido: e.target.checked }))} className="rounded" />
            <div>
              <span className="text-sm font-medium">Doble pedido semanal</span>
              <p className="text-xs text-gray-400">Avisa en catálogo cuando un producto ya fue pedido esta semana</p>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activa !== false}
              onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} className="rounded" />
            <span className="text-sm font-medium">Tienda activa</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34] disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nuevo/Editar Usuario ────────────────────────────────────────
function UsuarioModal({ tiendas, usuarioEditar, onSave, onClose }) {
  const [form, setForm] = useState({
    email: usuarioEditar?.email || "",
    nombre_completo: usuarioEditar?.nombre_completo || "",
    rol: usuarioEditar?.rol || "tienda",
    tienda_id: usuarioEditar?.tienda_id || "",
    activo: usuarioEditar?.activo !== false,
  });
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const esEdicion = !!usuarioEditar?.id;

  const handleSave = async () => {
    setError("");
    if (!form.email.trim()) { setError("El email es obligatorio."); return; }
    if (!esEdicion && !password.trim()) { setError("La contraseña es obligatoria para nuevos usuarios."); return; }
    if (!esEdicion && password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setSaving(true);
    try {
      if (esEdicion) {
        let tiendaIdEdit = form.tienda_id || null;
        if (form.rol === "admin") {
          const { data: principal } = await supabase.from("tiendas").select("id").eq("nombre", "PRINCIPAL").single();
          tiendaIdEdit = principal?.id || null;
        }
        const { error: e } = await supabase.from("perfiles").update({
          nombre_completo: form.nombre_completo, rol: "tienda",
          tienda_id: tiendaIdEdit, activo: form.activo,
        }).eq("id", usuarioEditar.id);
        if (e) throw e;
        if (password.trim().length >= 6) {
          const { error: pwError } = await supabase.rpc("cambiar_password_usuario", { p_user_id: usuarioEditar.id, p_password: password });
          if (pwError) throw pwError;
        }
      } else {
        let tiendaId = form.tienda_id || null;
        if (form.rol === "admin") {
          const { data: principal } = await supabase.from("tiendas").select("id").eq("nombre", "PRINCIPAL").single();
          tiendaId = principal?.id || null;
        }
        const { data: rpcData, error: rpcError } = await supabase.rpc("crear_usuario_tienda", {
          p_email: form.email.trim(), p_password: password,
          p_nombre: form.nombre_completo || "", p_rol: "tienda", p_tienda_id: tiendaId,
        });
        if (rpcError) throw rpcError;
        if (rpcData?.error) throw new Error(rpcData.error);
      }
      onSave();
    } catch (err) { setError(err.message || "Error al guardar el usuario."); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserPlus size={20} className="text-[#00913f]" />
            {esEdicion ? "Editar Usuario" : "Nuevo Usuario"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={esEdicion}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254] disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Nombre completo</label>
            <input type="text" value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Contraseña *</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder={esEdicion ? "Nueva contraseña (vacío = no cambiar)" : "Mínimo 6 caracteres"}
                className="w-full border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#00c254]" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Rol *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, rol: "tienda" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${form.rol === "tienda" ? "border-[#00a847] bg-[#edf7f2] text-[#007a34]" : "border-gray-200 text-gray-500"}`}>
                <Store size={16} /> Tienda
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, rol: "admin" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${form.rol === "admin" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"}`}>
                <ShieldCheck size={16} /> Admin
              </button>
            </div>
          </div>
          {form.rol === "tienda" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Tienda asignada</label>
              <select value={form.tienda_id} onChange={e => setForm(f => ({ ...f, tienda_id: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]">
                <option value="">— Sin tienda asignada —</option>
                {tiendas.filter(t => t.activa !== false).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activo !== false}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
            <span className="text-sm font-medium">Usuario activo</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34] disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {esEdicion ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel de Recordatorios ───────────────────────────────────────────
function PanelRecordatorios({ tiendas }) {
  const [ejecutando, setEjecutando]   = useState(false);
  const [resultado, setResultado]     = useState(null);
  const [historial, setHistorial]     = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // Test
  const [emailTest, setEmailTest]       = useState("");
  const [enviandoTest, setEnviandoTest] = useState(false);
  const [resultadoTest, setResultadoTest] = useState(null);

  const cargarHistorial = async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from("recordatorios_pedido")
      .select("*, tiendas(nombre)")
      .order("created_at", { ascending: false })
      .limit(30);
    setHistorial(data || []);
    setLoadingHist(false);
  };

  useEffect(() => { cargarHistorial(); }, []);

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const ejecutarAhora = async () => {
    setEjecutando(true);
    setResultado(null);
    try {
      const session = await getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recordatorio-pedido`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: "{}" }
      );
      const json = await res.json();
      setResultado(json);
      if (json.ok) cargarHistorial();
    } catch (err) {
      setResultado({ ok: false, error: err.message });
    }
    setEjecutando(false);
  };

  const enviarTest = async () => {
    if (!emailTest.trim()) { alert("Introduce un email para el test"); return; }
    setEnviandoTest(true);
    setResultadoTest(null);
    try {
      const session = await getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recordatorio-pedido`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ test: true, email: emailTest.trim(), nombre: "Tienda de Prueba" }),
        }
      );
      const json = await res.json();
      setResultadoTest(json);
    } catch (err) {
      setResultadoTest({ ok: false, error: err.message });
    }
    setEnviandoTest(false);
  };

  const tiendasConDia = tiendas.filter(t => Array.isArray(t.dia_pedido) && t.dia_pedido.length > 0);

  return (
    <div className="space-y-5">

      {/* Explicación lógica */}
      <div className="bg-[#edf7f2] border border-[#b3dfc4] rounded-xl p-4 text-sm text-[#007a34] space-y-1">
        <p><strong>Cron automático:</strong> se ejecuta cada día laborable a las 09:00 Madrid.</p>
        <p><strong>Lógica:</strong> si hoy es el día laborable anterior al día de llegada del pedido, y esa tienda no tiene ningún pedido registrado esta semana → envía aviso.</p>
        <p><strong>Ejemplo:</strong> pedido llega el Martes → aviso el Lunes. Pedido llega el Lunes → aviso el Viernes anterior.</p>
        <p><strong>Fin de semana:</strong> no se envían avisos sábado ni domingo.</p>
        <p className="text-xs text-[#007a34]/70">Emails desde <code className="bg-[#d9f0e4] px-1 rounded">onboarding@resend.dev</code></p>
      </div>

      {/* Test de email */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-amber-50 flex items-center gap-2">
          <FlaskConical size={16} className="text-amber-600" />
          <p className="font-semibold text-amber-800 text-sm">Probar que los emails llegan</p>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Envía un email de prueba a cualquier dirección para verificar que el sistema funciona. No registra nada ni comprueba pedidos.</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailTest}
              onChange={e => setEmailTest(e.target.value)}
              onKeyDown={e => e.key === "Enter" && enviarTest()}
              placeholder="tu@email.com"
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
            />
            <button onClick={enviarTest} disabled={enviandoTest || !emailTest.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors whitespace-nowrap">
              {enviandoTest ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
              {enviandoTest ? "Enviando..." : "Enviar test"}
            </button>
          </div>
          {resultadoTest && (
            <div className={`rounded-xl p-3 flex items-start gap-2 text-sm ${resultadoTest.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {resultadoTest.ok
                ? <><CheckCircle size={16} className="flex-shrink-0 mt-0.5" /><span>Email enviado a <strong>{emailTest}</strong>. Si no llega en 1-2 minutos, revisa la carpeta de spam.</span></>
                : <><X size={16} className="flex-shrink-0 mt-0.5" /><span>Error: {resultadoTest.error}</span></>
              }
              <button onClick={() => setResultadoTest(null)} className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={13} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla configuración */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Días configurados por tienda</p>
            <p className="text-xs text-gray-400 mt-0.5">{tiendasConDia.length} tienda{tiendasConDia.length !== 1 ? "s" : ""} con recordatorio activo</p>
          </div>
          <button onClick={ejecutarAhora} disabled={ejecutando}
            className="flex items-center gap-2 px-4 py-2 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50">
            {ejecutando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {ejecutando ? "Ejecutando..." : "Lanzar ahora"}
          </button>
        </div>

        {tiendasConDia.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <Bell size={36} className="mx-auto mb-2 opacity-20" />
            Ninguna tienda tiene días configurados.<br />
            Edita una tienda y selecciona sus días de llegada de pedido.
          </div>
        ) : (
          <div className="divide-y">
            {tiendasConDia.map(t => (
              <div key={t.id} className="px-5 py-3 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#00913f] flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{t.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {t.email || <span className="text-amber-500 font-medium">Sin email — no recibirá avisos</span>}
                    </p>
                    {/* Detallar cada día con su día de aviso */}
                    {Array.isArray(t.dia_pedido) && (
                      <div className="mt-1.5 space-y-0.5">
                        {t.dia_pedido.map(v => {
                          const d = DIAS_SEMANA.find(x => x.value === v);
                          const aviso = DIA_AVISO[v];
                          return d && aviso ? (
                            <p key={v} className="text-xs text-gray-500">
                              Llega el <span className="font-semibold text-gray-700">{d.label}</span>
                              <span className="text-gray-400"> → aviso el </span>
                              <span className="font-semibold text-[#00913f]">{aviso}</span>
                            </p>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <BadgesDias dias={t.dia_pedido} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultado ejecución manual */}
      {resultado && (
        <div className={`rounded-2xl border-2 p-4 ${resultado.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {resultado.ok ? <CheckCircle size={18} className="text-green-600" /> : <X size={18} className="text-red-500" />}
            <span className={`font-bold text-sm ${resultado.ok ? "text-green-800" : "text-red-700"}`}>
              {resultado.ok
                ? `Completado — ${resultado.enviados} enviado${resultado.enviados !== 1 ? "s" : ""}, ${resultado.omitidos} sin acción`
                : "Error en la ejecución"}
            </span>
            <button onClick={() => setResultado(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          {resultado.log && (
            <pre className="text-xs font-mono text-gray-700 bg-white/70 rounded-xl p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {resultado.log.join("\n")}
            </pre>
          )}
          {resultado.error && <p className="text-sm text-red-600 font-mono">{resultado.error}</p>}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <p className="font-semibold text-gray-700 text-sm">Historial de envíos</p>
          <button onClick={cargarHistorial} disabled={loadingHist} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500">
            {loadingHist ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
        {historial.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aún no se han enviado recordatorios.</div>
        ) : (
          <div className="divide-y max-h-72 overflow-y-auto">
            {historial.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <div className="w-2 h-2 rounded-full bg-[#00913f] flex-shrink-0" />
                <span className="font-medium text-gray-800 flex-1">{r.tiendas?.nombre || "—"}</span>
                <span className="text-gray-400 text-xs">{r.fecha_envio}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────
export default function Tiendas() {
  const [tiendas, setTiendas]   = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [tab, setTab] = useState("tiendas");
  const [editandoCalendario, setEditandoCalendario] = useState({});
  const [guardandoCal, setGuardandoCal] = useState({});
  const [modalTienda,  setModalTienda]  = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editandoTienda,  setEditandoTienda]  = useState(null);
  const [editandoUsuario, setEditandoUsuario] = useState(null);

  const cargarTiendas = async () => {
    setLoading(true);
    const { data } = await supabase.from("tiendas").select("*").order("nombre");
    setTiendas(data || []);
    setLoading(false);
  };

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    const { data } = await supabase.from("perfiles").select("*, tiendas(nombre)").order("nombre_completo");
    setUsuarios(data || []);
    setLoadingUsuarios(false);
  };

  useEffect(() => { cargarTiendas(); cargarUsuarios(); }, []);

  const guardarCalendario = async (tiendaId) => {
    const valor = editandoCalendario[tiendaId] ?? "";
    setGuardandoCal(prev => ({ ...prev, [tiendaId]: true }));
    await supabase.from("tiendas").update({ google_calendar_id: valor || null }).eq("id", tiendaId);
    setGuardandoCal(prev => ({ ...prev, [tiendaId]: false }));
    setTiendas(prev => prev.map(t => t.id === tiendaId ? { ...t, google_calendar_id: valor || null } : t));
  };

  const eliminarTienda = async (id) => {
    if (!confirm("¿Eliminar esta tienda?")) return;
    await supabase.from("tiendas").delete().eq("id", id);
    cargarTiendas();
  };

  const eliminarUsuario = async (id) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    await supabase.from("perfiles").delete().eq("id", id);
    cargarUsuarios();
  };

  const toggleActivo = async (usuario) => {
    await supabase.from("perfiles").update({ activo: !usuario.activo }).eq("id", usuario.id);
    cargarUsuarios();
  };

  const grupoInfo = (grupo) => {
    if (grupo === "cafeteria") return { label: "Cafetería", color: "bg-orange-100 text-orange-700" };
    if (grupo === "ambos")     return { label: "Ambos",     color: "bg-purple-100 text-purple-700" };
    return                            { label: "Estación",  color: "bg-[#d9f0e4] text-[#007a34]" };
  };

  const TABS = [
    { id: "tiendas",       icon: Store,    label: "Tiendas" },
    { id: "usuarios",      icon: Users,    label: "Usuarios" },
    { id: "calendarios",   icon: Calendar, label: "Calendarios" },
    { id: "recordatorios", icon: Bell,     label: "Recordatorios" },
  ];

  return (
    <div>
      {modalTienda && (
        <TiendaModal tienda={editandoTienda}
          onSave={() => { setModalTienda(false); setEditandoTienda(null); cargarTiendas(); }}
          onClose={() => { setModalTienda(false); setEditandoTienda(null); }} />
      )}
      {modalUsuario && (
        <UsuarioModal key={editandoUsuario?.id || "nuevo"} tiendas={tiendas} usuarioEditar={editandoUsuario}
          onSave={() => { setModalUsuario(false); setEditandoUsuario(null); cargarUsuarios(); }}
          onClose={() => { setModalUsuario(false); setEditandoUsuario(null); }} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Tiendas y Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">{tiendas.length} tiendas · {usuarios.length} usuarios</p>
        </div>
        {(tab === "tiendas" || tab === "usuarios") && (
          <button onClick={() => { if (tab === "tiendas") { setEditandoTienda(null); setModalTienda(true); } else { setEditandoUsuario(null); setModalUsuario(true); } }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00913f] text-white rounded-xl font-semibold text-sm hover:bg-[#007a34]">
            <Plus size={16} />{tab === "tiendas" ? "Nueva tienda" : "Nuevo usuario"}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-[#007a34] shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* TIENDAS */}
      {tab === "tiendas" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[#edf7f2] border border-[#b3dfc4] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🏪</span><span className="font-bold text-[#007a34]">Estaciones</span></div>
              <p className="text-sm text-[#007a34]">Ven productos marcados como "estación" o "ambas"</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><span className="text-2xl">☕</span><span className="font-bold text-orange-800">Cafeterías</span></div>
              <p className="text-sm text-orange-700">Ven productos marcados como "cafetería" o "ambas"</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#00913f]" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Código","Nombre","Email","Tipo","Días llegada pedido","Estado","Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiendas.map(t => {
                      const gi = grupoInfo(t.grupo);
                      return (
                        <tr key={t.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm text-gray-500">{t.codigo || "—"}</td>
                          <td className="px-4 py-3 font-semibold text-sm">{t.nombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{t.email || "—"}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${gi.color}`}>{gi.label}</span></td>
                          <td className="px-4 py-3"><BadgesDias dias={t.dia_pedido} /></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.activa !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {t.activa !== false ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditandoTienda(t); setModalTienda(true); }} className="p-2 hover:bg-[#edf7f2] rounded-lg text-[#00a847]"><Pencil size={15} /></button>
                              <button onClick={() => eliminarTienda(t.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* USUARIOS */}
      {tab === "usuarios" && (
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          {loadingUsuarios ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#00913f]" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-gray-50 border-b">
                  <tr>{["Usuario","Email","Rol","Tienda","Estado","Acciones"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-sm">{u.nombre_completo || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600"><div className="flex items-center gap-1.5"><Mail size={13} className="text-gray-400" />{u.email || "—"}</div></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? "bg-purple-100 text-purple-700" : "bg-[#d9f0e4] text-[#007a34]"}`}>
                          {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? <ShieldCheck size={11} /> : <Store size={11} />}
                          {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? "Admin" : "Tienda"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.tiendas?.nombre || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActivo(u)} className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer ${u.activo !== false ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {u.activo !== false ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditandoUsuario(u); setModalUsuario(true); }} className="p-2 hover:bg-[#edf7f2] rounded-lg text-[#00a847]"><Pencil size={15} /></button>
                          <button onClick={() => eliminarUsuario(u.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CALENDARIOS */}
      {tab === "calendarios" && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <Calendar size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Calendarios de Google para Caducidades</p>
              <p className="text-xs text-amber-700 mt-0.5">Email del calendario de cada tienda. La cuenta <strong>caducidades@gmail.com</strong> debe tener acceso.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tienda</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Google Calendar ID</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {tiendas.filter(t => t.nombre !== "PRINCIPAL").map(t => {
                  const valor = editandoCalendario[t.id] !== undefined ? editandoCalendario[t.id] : (t.google_calendar_id || "");
                  const guardando = guardandoCal[t.id];
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-semibold text-sm">{t.nombre}</div>{t.codigo && <div className="text-xs text-gray-400 font-mono">{t.codigo}</div>}</td>
                      <td className="px-4 py-3">
                        <input type="email" value={valor}
                          onChange={e => setEditandoCalendario(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && guardarCalendario(t.id)}
                          placeholder="email@gmail.com"
                          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${valor && valor !== (t.google_calendar_id || "") ? "border-[#00c254] bg-[#edf7f2]" : "border-gray-200"}`} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => guardarCalendario(t.id)} disabled={guardando || valor === (t.google_calendar_id || "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#00913f] text-white rounded-xl text-xs font-bold hover:bg-[#007a34] disabled:opacity-40 mx-auto">
                          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORDATORIOS */}
      {tab === "recordatorios" && (
        <PanelRecordatorios tiendas={tiendas.filter(t => t.nombre !== "PRINCIPAL" && t.activa !== false)} />
      )}
    </div>
  );
}
