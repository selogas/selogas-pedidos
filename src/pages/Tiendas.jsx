import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, Store, X, Check, Loader2,
  Users, Mail, KeyRound, ShieldCheck, ShieldAlert,
  UserPlus, Eye, EyeOff, RefreshCw, Calendar, Save
} from "lucide-react";

// ── Modal Tienda ─────────────────────────────────────────────────────
function TiendaModal({ tienda, onSave, onClose }) {
  const [form, setForm] = useState(
    tienda || { nombre: "", codigo: "", email: "", responsable: "", activa: true, grupo: "estacion", mensaje_banner: "", google_calendar_id: "", doble_pedido: false }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (tienda?.id) {
      const { error } = await supabase.from("tiendas").update(form).eq("id", tienda.id);
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tiendas").insert([form]);
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
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
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">📅 Google Calendar ID</label>
            <input
              type="text"
              value={form.google_calendar_id || ""}
              onChange={e => setForm(f => ({ ...f, google_calendar_id: e.target.value }))}
              placeholder="Ej: tormo22@megino.com o bpnassica365@gmail.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">Email del Google Calendar de caducidades de esta tienda.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              📢 Mensaje banner (opcional)
            </label>
            <textarea
              value={form.mensaje_banner || ""}
              onChange={e => setForm(f => ({ ...f, mensaje_banner: e.target.value }))}
              placeholder="Ej: Tu día de pedido es el MARTES. ¡Realiza tu pedido antes de las 12h!"
              rows={2}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Se muestra como banner amarillo al usuario de esta tienda al entrar. Déjalo vacío para no mostrar nada.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Tipo de tienda *</label>
            <select
              value={form.grupo || "estacion"}
              onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="estacion">🏪 Estación (catálogo estación)</option>
              <option value="cafeteria">☕ Cafetería (catálogo cafetería)</option>
              <option value="ambas">📦 Ambas (ve todos los productos)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.doble_pedido === true}
              onChange={e => setForm(f => ({ ...f, doble_pedido: e.target.checked }))}
              className="rounded"
            />
            <div>
              <span className="text-sm font-medium">Doble pedido semanal</span>
              <p className="text-xs text-gray-400">Avisa cuando un producto ya fue pedido en los últimos 7 días</p>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activa !== false}
              onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm font-medium">Tienda activa</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">Cancelar</button>
          <button
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !form.nombre}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
        </div>
      </div>
      {/* ===== TAB CALENDARIOS ===== */}
      {tab === "calendarios" && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <Calendar size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Calendarios de Google para Caducidades</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Escribe el email del calendario de Google de cada tienda (ej: <code className="bg-amber-100 px-1 rounded">bpnassica365@gmail.com</code>). 
                La cuenta <strong>caducidades@gmail.com</strong> debe tener acceso a ese calendario.
              </p>
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
                  const valor = editandoCalendario[t.id] !== undefined
                    ? editandoCalendario[t.id]
                    : (t.google_calendar_id || "");
                  const guardando = guardandoCal[t.id];
                  const guardado  = editandoCalendario[t.id] !== undefined
                    && editandoCalendario[t.id] === (t.google_calendar_id || "");

                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.nombre}</div>
                        {t.codigo && <div className="text-xs text-gray-400 font-mono">{t.codigo}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={valor}
                          onChange={e => setEditandoCalendario(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && guardarCalendario(t.id)}
                          placeholder="email@gmail.com"
                          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors ${
                            valor && valor !== (t.google_calendar_id || "")
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => guardarCalendario(t.id)}
                          disabled={guardando || valor === (t.google_calendar_id || "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mx-auto"
                          title="Guardar (o pulsa Enter)"
                        >
                          {guardando
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Save size={13} />}
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tiendas.filter(t => t.nombre !== "PRINCIPAL").length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay tiendas registradas. Añade tiendas primero.
              </div>
            )}
          </div>

          {/* Mapa de referencia del script Python */}
          <div className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">📋 Referencia de calendarios del script Python:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 font-mono">
              {[
                ["tormo", "atalaya365megino@gmail.com"],
                ["atalayuela", "atalayuelamegino@gmail.com"],
                ["nassica", "bpnassica365@gmail.com"],
                ["corvo", "bpriocorvo365@gmail.com"],
                ["cepsasanfernando", "cepsasanfernando0@gmail.com"],
                ["sanfer", "bpsanfernando365@gmail.com"],
                ["cabanillas", "empleadoscabanillas@gmail.com"],
                ["europa", "areaeuropa81@gmail.com"],
                ["guadalcanal", "guadalcanal365@gmail.com"],
                ["lagavia", "lagavia.megino@gmail.com"],
                ["laguna", "lagunamegino532@gmail.com"],
                ["polvoranca", "polvorancamegino247@gmail.com"],
                ["arenas", "cepsalasarenas@gmail.com"],
                ["mayorazgo", "bpmayorazgo@gmail.com"],
                ["urtinsa", "urtinsamegino@gmail.com"],
                ["portillo", "portillorepsol@gmail.com"],
                ["pozuelo", "pozuelomegino26@gmail.com"],
                ["pinto", "expendedoresrepsol@gmail.com"],
                ["sanpedro", "sanpedromegino@gmail.com"],
                ["shellatalayuela", "atalayuelashell@gmail.com"],
                ["taraza", "tarazamegino@gmail.com"],
                ["puentearce", "puentearcemegino@gmail.com"],
                ["elalamo", "alamodualez@gmail.com"],
                ["centro", "meginoslbpcentro@gmail.com"],
              ].map(([nombre, email]) => (
                <div key={nombre} className="flex gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">{nombre}:</span>
                  <span className="text-gray-600 truncate">{email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
        // Editar solo el perfil (email y contraseña no cambian desde aquí)
        // Si es admin, asignar tienda PRINCIPAL
        let tiendaIdEdit = form.tienda_id || null;
        if (form.rol === "admin") {
          const { data: principal } = await supabase
            .from("tiendas").select("id").eq("nombre", "PRINCIPAL").single();
          tiendaIdEdit = principal?.id || null;
        }
        const { error: e } = await supabase.from("perfiles").update({
          nombre_completo: form.nombre_completo,
          rol: "tienda",
          tienda_id: tiendaIdEdit,
          activo: form.activo,
        }).eq("id", usuarioEditar.id);
        if (e) throw e;
      } else {
        // Crear usuario via función SQL con privilegios de servicio
        // Si es admin, buscar tienda PRINCIPAL y asignarla
        let tiendaId = form.tienda_id || null;
        if (form.rol === "admin") {
          const { data: principal } = await supabase
            .from("tiendas").select("id").eq("nombre", "PRINCIPAL").single();
          tiendaId = principal?.id || null;
        }
        const { data: rpcData, error: rpcError } = await supabase.rpc("crear_usuario_tienda", {
          p_email: form.email.trim(),
          p_password: password,
          p_nombre: form.nombre_completo || "",
          p_rol: "tienda",  // todos son rol tienda, la tienda PRINCIPAL da acceso admin
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
              <UserPlus size={20} className="text-blue-600" />
              {esEdicion ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>
            {!esEdicion && (
              <p className="text-xs text-gray-400 mt-0.5">El usuario podrá acceder inmediatamente con estas credenciales</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              disabled={esEdicion}
              placeholder="correo@tienda.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Nombre completo</label>
            <input
              type="text"
              value={form.nombre_completo}
              onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
              placeholder="Nombre del responsable"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Contraseña — solo en creación */}
          {!esEdicion && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Contraseña *</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Rol *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, rol: "tienda" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${
                  form.rol === "tienda"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Store size={16} /> Tienda
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, rol: "admin" }))}
                className={`p-3 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-all ${
                  form.rol === "admin"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <ShieldCheck size={16} /> Admin
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.rol === "tienda"
                ? "Solo verá Inicio, Catálogo y sus pedidos."
                : "Acceso completo a todas las secciones."}
            </p>
          </div>

          {/* Tienda asignada — solo para rol tienda */}
          {form.rol === "tienda" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Tienda asignada</label>
              <select
                value={form.tienda_id}
                onChange={e => setForm(f => ({ ...f, tienda_id: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="">— Sin tienda asignada —</option>
                {tiendas.filter(t => t.activa !== false).map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Activo */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo !== false}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm font-medium">Usuario activo</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {esEdicion ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
      {/* ===== TAB CALENDARIOS ===== */}
      {tab === "calendarios" && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <Calendar size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Calendarios de Google para Caducidades</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Escribe el email del calendario de Google de cada tienda (ej: <code className="bg-amber-100 px-1 rounded">bpnassica365@gmail.com</code>). 
                La cuenta <strong>caducidades@gmail.com</strong> debe tener acceso a ese calendario.
              </p>
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
                  const valor = editandoCalendario[t.id] !== undefined
                    ? editandoCalendario[t.id]
                    : (t.google_calendar_id || "");
                  const guardando = guardandoCal[t.id];
                  const guardado  = editandoCalendario[t.id] !== undefined
                    && editandoCalendario[t.id] === (t.google_calendar_id || "");

                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.nombre}</div>
                        {t.codigo && <div className="text-xs text-gray-400 font-mono">{t.codigo}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={valor}
                          onChange={e => setEditandoCalendario(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && guardarCalendario(t.id)}
                          placeholder="email@gmail.com"
                          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors ${
                            valor && valor !== (t.google_calendar_id || "")
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => guardarCalendario(t.id)}
                          disabled={guardando || valor === (t.google_calendar_id || "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mx-auto"
                          title="Guardar (o pulsa Enter)"
                        >
                          {guardando
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Save size={13} />}
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tiendas.filter(t => t.nombre !== "PRINCIPAL").length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay tiendas registradas. Añade tiendas primero.
              </div>
            )}
          </div>

          {/* Mapa de referencia del script Python */}
          <div className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">📋 Referencia de calendarios del script Python:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 font-mono">
              {[
                ["tormo", "atalaya365megino@gmail.com"],
                ["atalayuela", "atalayuelamegino@gmail.com"],
                ["nassica", "bpnassica365@gmail.com"],
                ["corvo", "bpriocorvo365@gmail.com"],
                ["cepsasanfernando", "cepsasanfernando0@gmail.com"],
                ["sanfer", "bpsanfernando365@gmail.com"],
                ["cabanillas", "empleadoscabanillas@gmail.com"],
                ["europa", "areaeuropa81@gmail.com"],
                ["guadalcanal", "guadalcanal365@gmail.com"],
                ["lagavia", "lagavia.megino@gmail.com"],
                ["laguna", "lagunamegino532@gmail.com"],
                ["polvoranca", "polvorancamegino247@gmail.com"],
                ["arenas", "cepsalasarenas@gmail.com"],
                ["mayorazgo", "bpmayorazgo@gmail.com"],
                ["urtinsa", "urtinsamegino@gmail.com"],
                ["portillo", "portillorepsol@gmail.com"],
                ["pozuelo", "pozuelomegino26@gmail.com"],
                ["pinto", "expendedoresrepsol@gmail.com"],
                ["sanpedro", "sanpedromegino@gmail.com"],
                ["shellatalayuela", "atalayuelashell@gmail.com"],
                ["taraza", "tarazamegino@gmail.com"],
                ["puentearce", "puentearcemegino@gmail.com"],
                ["elalamo", "alamodualez@gmail.com"],
                ["centro", "meginoslbpcentro@gmail.com"],
              ].map(([nombre, email]) => (
                <div key={nombre} className="flex gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">{nombre}:</span>
                  <span className="text-gray-600 truncate">{email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────
export default function Tiendas() {
  const [tiendas, setTiendas]   = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [tab, setTab]           = useState("tiendas"); // "tiendas" | "usuarios" | "calendarios"
  const [editandoCalendario, setEditandoCalendario] = useState({}); // {id: valor}
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
    const { data } = await supabase
      .from("perfiles")
      .select("*, tiendas(nombre)")
      .order("nombre_completo");
    setUsuarios(data || []);
    setLoadingUsuarios(false);
  };

  useEffect(() => {
    cargarTiendas();
    cargarUsuarios();
  }, []);

  const eliminarTienda = async (id) => {
    if (!confirm("¿Eliminar esta tienda?")) return;
    await supabase.from("tiendas").delete().eq("id", id);
    cargarTiendas();
  };

  const eliminarUsuario = async (id) => {
    if (!confirm("¿Eliminar este usuario? Solo se eliminará el perfil, no la cuenta de acceso.")) return;
    await supabase.from("perfiles").delete().eq("id", id);
    cargarUsuarios();
  };

  const toggleActivo = async (usuario) => {
    await supabase.from("perfiles").update({ activo: !usuario.activo }).eq("id", usuario.id);
    cargarUsuarios();
  };

  const grupoInfo = (grupo) => {
    if (grupo === "cafeteria") return { label: "Cafetería", color: "bg-orange-100 text-orange-700" };
    if (grupo === "ambas")     return { label: "Ambas",     color: "bg-purple-100 text-purple-700" };
    return                            { label: "Estación",  color: "bg-blue-100 text-blue-700" };
  };

  return (
    <div>
      {/* Modales */}
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

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Tiendas y Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tiendas.length} tiendas · {usuarios.length} usuarios registrados
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700"
          onClick={() => {
            if (tab === "tiendas") { setEditandoTienda(null); setModalTienda(true); }
            else                   { setEditandoUsuario(null); setModalUsuario(true); }
          }}
        >
          <Plus size={16} />
          {tab === "tiendas" ? "Nueva tienda" : "Nuevo usuario"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        <button
          onClick={() => setTab("tiendas")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "tiendas" ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Store size={15} /> Tiendas
        </button>
        <button
          onClick={() => setTab("usuarios")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "usuarios" ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users size={15} /> Usuarios
        </button>
        <button
          onClick={() => setTab("calendarios")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "calendarios" ? "bg-white text-blue-700 shadow" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar size={15} /> Calendarios
        </button>
      </div>

      {/* ===== TAB TIENDAS ===== */}
      {tab === "tiendas" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🏪</span>
                <span className="font-bold text-blue-800">Estaciones</span>
              </div>
              <p className="text-sm text-blue-700">Ven todos los productos marcados como "estación" o "ambas"</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">☕</span>
                <span className="font-bold text-orange-800">Cafeterías</span>
              </div>
              <p className="text-sm text-orange-700">Ven los productos marcados como "cafetería" o "ambas"</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
            ) : tiendas.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Store size={48} className="mx-auto mb-3 opacity-30" />
                <p>No hay tiendas registradas</p>
                <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700" onClick={() => setModalTienda(true)}>
                  Añadir primera tienda
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Código", "Nombre", "Email", "Responsable", "Tipo", "Estado", "Acciones"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiendas.map(t => {
                    const gi = grupoInfo(t.grupo);
                    return (
                      <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm text-gray-500">{t.codigo || "—"}</td>
                        <td className="px-4 py-3 font-semibold">{t.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.email || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.responsable || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${gi.color}`}>{gi.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            t.activa !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {t.activa !== false ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditandoTienda(t); setModalTienda(true); }} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500"><Pencil size={15} /></button>
                            <button onClick={() => eliminarTienda(t.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ===== TAB USUARIOS ===== */}
      {tab === "usuarios" && (
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          {loadingUsuarios ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>No hay usuarios registrados</p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700" onClick={() => { setEditandoUsuario(null); setModalUsuario(true); }}>
                Crear primer usuario
              </button>
            </div>
          ) : (
            <table className="w-full">
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
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm">{u.nombre_completo || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} className="text-gray-400" />
                        {u.email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                        (u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin")
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? <ShieldCheck size={11} /> : <Store size={11} />}
                        {(u.tiendas?.nombre === "PRINCIPAL" || u.rol === "admin") ? "Admin" : "Tienda"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.tiendas?.nombre || <span className="text-gray-300">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActivo(u)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${
                          u.activo !== false
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                        title="Clic para cambiar estado"
                      >
                        {u.activo !== false ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditandoUsuario(u); setModalUsuario(true); }}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-500"
                          title="Editar usuario"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => eliminarUsuario(u.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-400"
                          title="Eliminar perfil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <p className="text-xs text-amber-700 mt-0.5">
                Escribe el email del calendario de Google de cada tienda (ej: <code className="bg-amber-100 px-1 rounded">bpnassica365@gmail.com</code>). 
                La cuenta <strong>caducidades@gmail.com</strong> debe tener acceso a ese calendario.
              </p>
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
                  const valor = editandoCalendario[t.id] !== undefined
                    ? editandoCalendario[t.id]
                    : (t.google_calendar_id || "");
                  const guardando = guardandoCal[t.id];
                  const guardado  = editandoCalendario[t.id] !== undefined
                    && editandoCalendario[t.id] === (t.google_calendar_id || "");

                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.nombre}</div>
                        {t.codigo && <div className="text-xs text-gray-400 font-mono">{t.codigo}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={valor}
                          onChange={e => setEditandoCalendario(prev => ({ ...prev, [t.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && guardarCalendario(t.id)}
                          placeholder="email@gmail.com"
                          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors ${
                            valor && valor !== (t.google_calendar_id || "")
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-200"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => guardarCalendario(t.id)}
                          disabled={guardando || valor === (t.google_calendar_id || "")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mx-auto"
                          title="Guardar (o pulsa Enter)"
                        >
                          {guardando
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Save size={13} />}
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tiendas.filter(t => t.nombre !== "PRINCIPAL").length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay tiendas registradas. Añade tiendas primero.
              </div>
            )}
          </div>

          {/* Mapa de referencia del script Python */}
          <div className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">📋 Referencia de calendarios del script Python:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 font-mono">
              {[
                ["tormo", "atalaya365megino@gmail.com"],
                ["atalayuela", "atalayuelamegino@gmail.com"],
                ["nassica", "bpnassica365@gmail.com"],
                ["corvo", "bpriocorvo365@gmail.com"],
                ["cepsasanfernando", "cepsasanfernando0@gmail.com"],
                ["sanfer", "bpsanfernando365@gmail.com"],
                ["cabanillas", "empleadoscabanillas@gmail.com"],
                ["europa", "areaeuropa81@gmail.com"],
                ["guadalcanal", "guadalcanal365@gmail.com"],
                ["lagavia", "lagavia.megino@gmail.com"],
                ["laguna", "lagunamegino532@gmail.com"],
                ["polvoranca", "polvorancamegino247@gmail.com"],
                ["arenas", "cepsalasarenas@gmail.com"],
                ["mayorazgo", "bpmayorazgo@gmail.com"],
                ["urtinsa", "urtinsamegino@gmail.com"],
                ["portillo", "portillorepsol@gmail.com"],
                ["pozuelo", "pozuelomegino26@gmail.com"],
                ["pinto", "expendedoresrepsol@gmail.com"],
                ["sanpedro", "sanpedromegino@gmail.com"],
                ["shellatalayuela", "atalayuelashell@gmail.com"],
                ["taraza", "tarazamegino@gmail.com"],
                ["puentearce", "puentearcemegino@gmail.com"],
                ["elalamo", "alamodualez@gmail.com"],
                ["centro", "meginoslbpcentro@gmail.com"],
              ].map(([nombre, email]) => (
                <div key={nombre} className="flex gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">{nombre}:</span>
                  <span className="text-gray-600 truncate">{email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
