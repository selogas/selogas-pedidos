import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Bell, Plus, Trash2, X, Check, Loader2, AlertTriangle, Info, Megaphone } from "lucide-react";

const TIPO_CONFIG = {
  info:    { color: "bg-[#edf7f2] border-[#b3dfc4] text-blue-800",   icon: Info,         dot: "bg-[#00a847]",   label: "Información" },
  aviso:   { color: "bg-amber-50 border-amber-200 text-amber-800", icon: AlertTriangle, dot: "bg-amber-500",  label: "Aviso" },
  urgente: { color: "bg-red-50 border-red-200 text-red-800",       icon: Megaphone,    dot: "bg-red-500",    label: "Urgente" },
};

function ComunicadoCard({ c }) {
  const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.info;
  const Icon = cfg.icon;
  const fecha = new Date(c.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return (
    <div className={`border-2 rounded-2xl p-4 flex gap-3 ${cfg.color}`}>
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm">{c.titulo}</span>
          <span className="text-xs opacity-60">{fecha}</span>
        </div>
        <p className="text-sm leading-snug">{c.mensaje}</p>
      </div>
    </div>
  );
}

function ModalComunicado({ tiendas, onSave, onClose }) {
  const [form, setForm] = useState({ titulo: "", mensaje: "", tipo: "info", destinatario: "todas", tienda_id: null, expires_at: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.mensaje.trim()) return;
    setSaving(true);
    await supabase.from("comunicados").insert([{
      ...form,
      tienda_id: form.destinatario === "tienda" ? form.tienda_id : null,
      expires_at: form.expires_at || null,
      activo: true,
    }]);
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2"><Bell size={18} className="text-[#00913f]" /> Nuevo comunicado</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ej: Cambio de horario de reparto" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mensaje *</label>
            <textarea value={form.mensaje} onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))}
              placeholder="Escribe el mensaje completo..." rows={3}
              className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white">
                <option value="info">ℹ️ Información</option>
                <option value="aviso">⚠️ Aviso</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Destinatario</label>
              <select value={form.destinatario} onChange={e => setForm(f => ({ ...f, destinatario: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white">
                <option value="todas">Todas las tiendas</option>
                <option value="estacion">Solo estaciones</option>
                <option value="cafeteria">Solo cafeterías</option>
                <option value="tienda">Tienda concreta</option>
              </select>
            </div>
          </div>
          {form.destinatario === "tienda" && (
            <div>
              <label className="block text-sm font-medium mb-1">Tienda</label>
              <select value={form.tienda_id || ""} onChange={e => setForm(f => ({ ...f, tienda_id: e.target.value || null }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white">
                <option value="">— Selecciona —</option>
                {tiendas.filter(t => t.nombre !== "PRINCIPAL").map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Caduca (opcional)</label>
            <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.titulo || !form.mensaje}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34] disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Comunicados() {
  const { isAdmin, perfil } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [tiendas, setTiendas]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(false);

  const cargar = async () => {
    setLoading(true);
    const ahora = new Date().toISOString();
    let query = supabase.from("comunicados")
      .select("*")
      .eq("activo", true)
      .or(`expires_at.is.null,expires_at.gt.${ahora}`)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      const grupo = perfil?.tiendas?.grupo || "estacion";
      const tiendaId = perfil?.tienda_id;
      query = query.or(
        `destinatario.eq.todas,destinatario.eq.${grupo}${tiendaId ? `,and(destinatario.eq.tienda,tienda_id.eq.${tiendaId})` : ""}`
      );
    }

    const { data } = await query;
    setComunicados(data || []);
    setLoading(false);
  };

  const cargarTiendas = async () => {
    const { data } = await supabase.from("tiendas").select("id, nombre").eq("activa", true).order("nombre");
    setTiendas(data || []);
  };

  useEffect(() => { if (perfil !== null) { cargar(); if (isAdmin) cargarTiendas(); } }, [perfil?.id]);

  const eliminar = async (id) => {
    if (!confirm("¿Desactivar este comunicado?")) return;
    await supabase.from("comunicados").update({ activo: false }).eq("id", id);
    cargar();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {modal && <ModalComunicado tiendas={tiendas} onSave={() => { setModal(false); cargar(); }} onClose={() => setModal(false)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bell size={24} className="text-[#00913f]" /> Comunicados</h1>
          <p className="text-gray-500 text-sm mt-1">Avisos y mensajes importantes</p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00913f] text-white rounded-xl font-semibold text-sm hover:bg-[#007a34]">
            <Plus size={16} /> Nuevo aviso
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-[#00a847]" /></div>
      ) : comunicados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay comunicados activos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicados.map(c => (
            <div key={c.id} className="relative group">
              <ComunicadoCard c={c} />
              {isAdmin && (
                <button onClick={() => eliminar(c.id)}
                  className="absolute top-3 right-3 p-1.5 bg-white border rounded-lg text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
