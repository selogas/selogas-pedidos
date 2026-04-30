import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Pencil, Trash2, Store, Users, X, Check, Loader2 } from "lucide-react";

function TiendaModal({ tienda, onSave, onClose }) {
  const [form, setForm] = useState(tienda || { nombre: "", codigo: "", email: "", responsable: "", activa: true, grupo: "estacion" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (tienda?.id) {
      const { error } = await supabase.from('tiendas').update(form).eq('id', tienda.id);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('tiendas').insert([form]);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
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
            { field: "codigo", label: "CÃ³digo" },
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
            <p className="text-xs text-gray-400 mt-1">
              Estación: ve productos de estación y "ambas". Cafetería: ve productos de cafetería y "ambas". Ambas: ve todos los productos.</p>
          </div>

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
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving || !form.nombre}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tiendas() {
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [user, setUser] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tiendas').select('*').order('nombre');
    if (!error) setTiendas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', u.id).single();
        if (!perfil || perfil.rol !== 'admin') {
          window.location.href = '/Catalogo';
          return;
        }
      }
    };
    checkAccess();
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Â¿Eliminar esta tienda?")) return;
    await supabase.from('tiendas').delete().eq('id', id);
    load();
  };

  const grupoInfo = (grupo) => {
    if (grupo === 'cafeteria') return { label: 'CafeterÃ­a', color: 'bg-orange-100 text-orange-700' };
    return { label: 'EstaciÃ³n', color: 'bg-blue-100 text-blue-700' };
  };

  return (
    <div>
      {modal === "tienda" && (
        <TiendaModal
          tienda={editing}
          onSave={() => { setModal(null); setEditing(null); load(); }}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">GestiÃ³n de Tiendas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tiendas.length} tiendas registradas Â· 
            {tiendas.filter(t => t.grupo === 'cafeteria').length} cafeterÃ­as Â· 
            {tiendas.filter(t => t.grupo !== 'cafeteria').length} estaciones
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { setEditing(null); setModal("tienda"); }}
        >
          <Plus size={16} />
          Nueva tienda
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">ðª</span>
            <span className="font-bold text-blue-800">Estaciones</span>
          </div>
          <p className="text-sm text-blue-700">Ven todos los productos marcados como "estaciÃ³n" o "ambas" (catÃ¡logo completo)</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">â</span>
            <span className="font-bold text-orange-800">CafeterÃ­as</span>
          </div>
          <p className="text-sm text-orange-700">Ven los productos marcados como "cafeterÃ­a" o "ambas" (catÃ¡logo reducido)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" style={{ color: "var(--color-primary)" }} /></div>
        ) : tiendas.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Store size={48} className="mx-auto mb-3 opacity-30" />
            <p>No hay tiendas registradas</p>
            <button className="btn-primary mt-4" onClick={() => setModal("tienda")}>AÃ±adir primera tienda</button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["CÃ³digo", "Nombre", "Email", "Responsable", "Tipo", "Estado", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiendas.map((t, i) => {
                const gi = grupoInfo(t.grupo);
                return (
                  <tr key={t.id} className={`border-b hover:bg-gray-50 transition-colors`}>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{t.codigo || "-"}</td>
                    <td className="px-4 py-3 font-semibold">{t.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.email || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.responsable || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${gi.color}`}>
                        {gi.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.activa !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.activa !== false ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditing(t); setModal("tienda"); }} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}