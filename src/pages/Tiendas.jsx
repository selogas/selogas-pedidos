import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, Store, X, Check, Loader2,
  Users, Mail, KeyRound, ShieldCheck, ShieldAlert,
  UserPlus, Eye, EyeOff, RefreshCw, Calendar, Save,
  Bell, Play, CheckCircle
} from "lucide-react";

const DIAS_SEMANA = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

// ── Modal Tienda ─────────────────────────────────────────────────────
function TiendaModal({ tienda, onSave, onClose }) {
  const [form, setForm] = useState(
    tienda || { nombre: "", codigo: "", email: "", responsable: "", activa: true, grupo: "estacion", mensaje_banner: "", google_calendar_id: "", doble_pedido: false, dia_pedido: "" }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
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
      dia_pedido:         form.dia_pedido !== "" && form.dia_pedido !== null ? Number(form.dia_pedido) : null,
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{tienda ? "Editar Tienda" : "Nueva Tienda"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          {[
            { field: "nombre", label: "Nombre de la tienda", required: true },
            { field: "codigo", label: "Código" },
            { field: "email", label: "Email" },
            { field: "responsable", label: "Responsable" },
          ].map(({ field, label, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 text-gray-700">{label}{required && " *"}</label>
              <input
                type={field === "email" ? "email" : "text"}
                value={form[field] || ""}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
              />
            </div>
          ))}

          {/* Día de pedido */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
              <Bell size={14} className="text-[#00913f]" /> Día de pedido semanal
            </label>
            <select
              value={form.dia_pedido !== null && form.dia_pedido !== undefined && form.dia_pedido !== "" ? String(form.dia_pedido) : ""}
              onChange={e => setForm(f => ({ ...f, dia_pedido: e.target.value === "" ? null : Number(e.target.value) }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
            >
              <option value="">— Sin recordatorio automático —</option>
              {DIAS_SEMANA.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Si ese día llega y la tienda no ha pedido esa semana, recibirá un aviso por email.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">📅 Google Calendar ID</label>
            <input
              type="text"
              value={form.google_calendar_id || ""}
              onChange={e => setForm(f => ({ ...f, google_calendar_id: e.target.value }))}
              placeholder="Ej: tormo22@megino.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">📢 Mensaje banner (opcional)</label>
            <textarea
              value={form.mensaje_banner || ""}
              onChange={e => setForm(f => ({ ...f, mensaje_banner: e.target.value }))}
              placeholder="Ej: Tu día de pedido es el MARTES. ¡Realiza tu pedido antes de las 12h!"
              rows={2}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254] resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Se muestra como banner amarillo al usuario al entrar.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Tipo de tienda *</label>
            <select
              value={form.grupo || "estacion"}
              onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]"
            >
              <option value="estacion">🏪 Estación (catálogo estación)</option>
              <option value="cafeteria">☕ Cafetería (catálogo cafetería)</option>
              <option value="ambos">📦 Ambos (ve todos los productos)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.doble_pedido === true} onChange={e => setForm(f => ({ ...f, doble_pedido: e.target.checked }))} className="rounded" />
            <div>
              <span className="text-sm font-medium">Doble pedido semanal</span>
              <p className="text-xs text-gray-400">Avisa cuando un producto ya fue pedido en los últimos 7 días</p>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activa !== false} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} className="rounded" />
            <span className="text-sm font-medium">Tienda activa</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">Cancelar</button>
          <button
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34] disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !form.nombre}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nuevo Usuario ───────────────────────────────────────────────
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
          nombre_completo: form.nombre_completo,
          rol: "tienda",
          tienda_id: tiendaIdEdit,
          activo: form.activo,
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
          p_email: form.email.trim(),
          p_password: password,
          p_nombre: form.nombre_completo || "",
          p_rol: "tienda",
          p_tienda_id: tiendaId,
        });
        if (rpcError) throw rpcError;
        if (rpcData?.error) throw new Error(rpcData.error);
      }
      onSave();
    } catch (err) {
      setError(err.message || "Error al guardar el usuario.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <UserPlus size={20} className="text-[#00913f]" />
              {esEdicion ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>
            {!esEdicion && <p className="text-xs text-gray-400 mt-0.5">El usuario podrá acceder inmediatamente con estas credenciales</p>}
          </div>
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
              placeholder="correo@tienda.com" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254] disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Nombre completo</label>
            <input type="text" value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
              placeholder="Nombre del responsable" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Contraseña *</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder={esEdicion ? "Nueva contraseña (dejar vacío para no cambiar)" : "Mínimo 6 caracteres"}
                className="w-full border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#00c254]" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Rol *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, rol: "tienda" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${form.rol === "tienda" ? "border-[#00a847] bg-[#edf7f2] text-[#007a34]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                <Store size={16} /> Tienda
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, rol: "admin" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${form.rol === "admin" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                <ShieldCheck size={16} /> Admin
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.rol === "tienda" ? "Solo verá Inicio, Catálogo y sus pedidos." : "Acceso completo a todas las secciones."}
            </p>
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
            <input type="checkbox" checked={form.activo !== false} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
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

// ── Panel de recordatorios (admin) ───────────────────────────────────
function PanelRecordatorios({ tiendas }) {
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado]   = useState(null);
  const [historial, setHistorial]   = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const cargarHistorial = async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from("recordatorios_pedido")
      .select("*, tiendas(nombre)")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistorial(data || []);
    setLoadingHist(false);
  };

  useEffect(() => { cargarHistorial(); }, []);

  const ejecutarAhora = async () => {
    setEjecutando(true);
    setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recordatorio-pedido`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: "{}",
        }
      );
      const json = await res.json();
      setResultado(json);
      if (json.ok) cargarHistorial();
    } catch (err) {
      setResultado({ ok: false, error: err.message });
    }
    setEjecutando(false);
  };

  const tiendasConDia = tiendas.filter(t => t.dia_pedido !== null && t.dia_pedido !== undefined && t.nombre !== "PRINCIPAL");

  return (
    <div className="space-y-5">
      {/* Resumen configuración */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Configuración de días de pedido</p>
            <p className="text-xs text-gray-400 mt-0.5">{tiendasConDia.length} tiendas con recordatorio activado</p>
          </div>
          <button onClick={ejecutarAhora} disabled={ejecutando}
            className="flex items-center gap-2 px-4 py-2 bg-[#00913f] text-white rounded-xl font-bold text-sm hover:bg-[#007a34] disabled:opacity-50 transition-colors">
            {ejecutando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {ejecutando ? "Ejecutando..." : "Lanzar recordatorios ahora"}
          </button>
        </div>

        {tiendasConDia.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <Bell size={36} className="mx-auto mb-2 opacity-20" />
            Ninguna tienda tiene día de pedido configurado.<br />
            Edita las tiendas para asignarles un día.
          </div>
        ) : (
          <div className="divide-y">
            {tiendasConDia.map(t => {
              const diaNombre = DIAS_SEMANA.find(d => d.value === t.dia_pedido)?.label || "—";
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="w-2 h-2 rounded-full bg-[#00913f] flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{t.nombre}</p>
                    {t.email && <p className="text-xs text-gray-400">{t.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 bg-[#edf7f2] text-[#007a34] rounded-full font-semibold">
                      {diaNombre}
                    </span>
                    {!t.email && (
                      <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                        Sin email
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resultado de ejecución */}
      {resultado && (
        <div className={`rounded-2xl border-2 p-4 ${resultado.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {resultado.ok
              ? <CheckCircle size={18} className="text-green-600" />
              : <X size={18} className="text-red-500" />}
            <span className={`font-bold text-sm ${resultado.ok ? "text-green-800" : "text-red-700"}`}>
              {resultado.ok ? `✓ Completado — ${resultado.enviados} enviados, ${resultado.omitidos} sin acción` : "Error en la ejecución"}
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
          <p className="font-semibold text-gray-700 text-sm">Historial de recordatorios enviados</p>
          <button onClick={cargarHistorial} disabled={loadingHist} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500">
            {loadingHist ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
        {historial.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aún no se han enviado recordatorios.</div>
        ) : (
          <div className="divide-y max-h-64 overflow-y-auto">
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
  const [tab, setTab]           = useState("tiendas"); // "tiendas" | "usuarios" | "calendarios" | "recordatorios"
  const [editandoCalendario, setEditandoCalendario] = useState({});
  const [guardandoCal, setGuardandoCal] = useState({});
  const [modalTienda, setModalTienda]   = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editandoTienda,  setEditandoTienda]  = useState(null);
  const [editandoUsuario, setEditandoUsuario] = useState(null);

  const guardarCalendario = async (tiendaId) => {
    const valor = editandoCalendario[tiendaId] ?? "";
    setGuardandoCal(prev => ({ ...prev, [tiendaId]: true }));
    await supabase.from("tiendas").update({ google_calendar_id: valor || null }).eq("id", tiendaId);
    setGuardandoCal(prev => ({ ...prev, [tiendaId]: false }));
    setTiendas(prev => prev.map(t => t.id === tiendaId ? { ...t, google_calendar_id: valor || null } : t));
  };

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
    { id: "tiendas",        icon: Store,    label: "Tiendas" },
    { id: "usuarios",       icon: Users,    label: "Usuarios" },
    { id: "calendarios",    icon: Calendar, label: "Calendarios" },
    { id: "recordatorios",  icon: Bell,     label: "Recordatorios" },
  ];

  return (
    <div>
      {modalTienda && (
        <TiendaModal
          tienda={editandoTienda}
          onSave={() => { setModalTienda(false); setEditandoTienda(null); cargarTiendas(); }}
          onClose={() => { setModalTienda(false); setEditandoTienda(null); }}
        />
      )}
      {modalUsuario && (
        <UsuarioModal
          key={editandoUsuario?.id || 'nuevo'}
          tiendas={tiendas}
          usuarioEditar={editandoUsuario}
          onSave={() => { setModalUsuario(false); setEditandoUsuario(null); cargarUsuarios(); }}
          onClose={() => { setModalUsuario(false); setEditandoUsuario(null); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Tiendas y Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tiendas.length} tiendas · {usuarios.length} usuarios registrados
          </p>
        </div>
        {(tab === "tiendas" || tab === "usuarios") && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00913f] text-white rounded-xl font-semibold text-sm hover:bg-[#007a34]"
            onClick={() => {
              if (tab === "tiendas") { setEditandoTienda(null); setModalTienda(true); }
              else                   { setEditandoUsuario(null); setModalUsuario(true); }
            }}
          >
            <Plus size={16} />
            {tab === "tiendas" ? "Nueva tienda" : "Nuevo usuario"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-[#007a34] shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB TIENDAS ===== */}
      {tab === "tiendas" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[#edf7f2] border border-[#b3dfc4] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><span className="text-2xl">🏪</span><span className="font-bold text-blue-800">Estaciones</span></div>
              <p className="text-sm text-[#007a34]">Ven todos los productos marcados como "estación" o "ambas"</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><span className="text-2xl">☕</span><span className="font-bold text-orange-800">Cafeterías</span></div>
              <p className="text-sm text-orange-700">Ven los productos marcados como "cafetería" o "ambas"</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#00913f]" /></div>
            ) : tiendas.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Store size={48} className="mx-auto mb-3 opacity-30" />
                <p>No hay tiendas registradas</p>
                <button className="mt-4 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34]" onClick={() => setModalTienda(true)}>Añadir primera tienda</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Código", "Nombre", "Email", "Tipo", "Día pedido", "Estado", "Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiendas.map(t => {
                      const gi = grupoInfo(t.grupo);
                      const diaNombre = t.dia_pedido !== null && t.dia_pedido !== undefined
                        ? DIAS_SEMANA.find(d => d.value === t.dia_pedido)?.label
                        : null;
                      return (
                        <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm text-gray-500">{t.codigo || "—"}</td>
                          <td className="px-4 py-3 font-semibold">{t.nombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{t.email || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${gi.color}`}>{gi.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {diaNombre
                              ? <span className="text-xs px-2.5 py-1 bg-[#edf7f2] text-[#007a34] rounded-full font-semibold">{diaNombre}</span>
                              : <span className="text-xs text-gray-300">—</span>}
                          </td>
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

      {/* ===== TAB USUARIOS ===== */}
      {tab === "usuarios" && (
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          {loadingUsuarios ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-[#00913f]" /></div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>No hay usuarios registrados</p>
              <button className="mt-4 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-bold hover:bg-[#007a34]" onClick={() => { setEditandoUsuario(null); setModalUsuario(true); }}>Crear primer usuario</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Usuario", "Email", "Rol", "Tienda asignada", "Estado", "Acciones"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-sm">{u.nombre_completo || "—"}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5"><Mail size={13} className="text-gray-400" />{u.email || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? "bg-purple-100 text-purple-700" : "bg-[#d9f0e4] text-[#007a34]"}`}>
                          {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? <ShieldCheck size={11} /> : <Store size={11} />}
                          {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? "Admin" : "Tienda"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.tiendas?.nombre || <span className="text-gray-300">Sin asignar</span>}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActivo(u)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${u.activo !== false ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
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

      {/* ===== TAB CALENDARIOS ===== */}
      {tab === "calendarios" && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <Calendar size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Calendarios de Google para Caducidades</p>
              <p className="text-xs text-amber-700 mt-0.5">Escribe el email del calendario de Google de cada tienda. La cuenta <strong>caducidades@gmail.com</strong> debe tener acceso a ese calendario.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tienda</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Google Calendar ID (email)</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600 w-24">Guardar</th>
                </tr>
              </thead>
              <tbody>
                {tiendas.filter(t => t.nombre !== "PRINCIPAL").map(t => {
                  const valor = editandoCalendario[t.id] !== undefined ? editandoCalendario[t.id] : (t.google_calendar_id || "");
                  const guardando = guardandoCal[t.id];
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.nombre}</div>
                        {t.codigo && <div className="text-xs text-gray-400 font-mono">{t.codigo}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <input type="email" value={valor}
                          onChange={e => setEditandoCalendario(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && guardarCalendario(t.id)}
                          placeholder="email@gmail.com"
                          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors ${valor && valor !== (t.google_calendar_id || "") ? "border-[#00c254] bg-[#edf7f2]" : "border-gray-200"}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => guardarCalendario(t.id)} disabled={guardando || valor === (t.google_calendar_id || "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#00913f] text-white rounded-xl text-xs font-bold hover:bg-[#007a34] disabled:opacity-40 disabled:cursor-not-allowed mx-auto">
                          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tiendas.filter(t => t.nombre !== "PRINCIPAL").length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No hay tiendas registradas.</div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB RECORDATORIOS ===== */}
      {tab === "recordatorios" && (
        <PanelRecordatorios tiendas={tiendas.filter(t => t.nombre !== "PRINCIPAL" && t.activa !== false)} />
      )}
    </div>
  );
}
