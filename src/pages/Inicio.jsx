import { useState, useEffect } from "react";
import { comunicadosApi } from "../api";
import { useAuth } from "../lib/auth";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";

const TIPO_COLORS = {
  noticia: "bg-blue-100 text-blue-800",
  comunicado: "bg-gray-100 text-gray-800",
  oferta: "bg-green-100 text-green-800",
  aviso: "bg-yellow-100 text-yellow-800",
};

const TIPO_LABELS = { noticia: "Noticia", comunicado: "Comunicado", oferta: "Oferta", aviso: "Aviso" };

function ComunicadoForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState(item || { titulo: "", contenido: "", imagen_url: "", tipo: "comunicado", activo: true, orden: 0 });

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Título *</label>
          <input value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Título..." />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
          <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="comunicado">Comunicado</option>
            <option value="noticia">Noticia</option>
            <option value="oferta">Oferta</option>
            <option value="aviso">Aviso</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Contenido</label>
        <textarea value={form.contenido} onChange={e => setForm(f => ({...f, contenido: e.target.value}))}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={4} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">URL de imagen</label>
        <input value={form.imagen_url} onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({...f, activo: e.target.checked}))} />
        <span className="text-sm text-gray-700">Visible para las tiendas</span>
      </label>
      <div className="flex gap-2 justify-end pt-2 border-t">
        <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
        <button onClick={() => onSave(form)} disabled={!form.titulo}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {item ? "Guardar cambios" : "Publicar"}
        </button>
      </div>
    </div>
  );
}

export default function Inicio() {
  const { isAdmin } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadComunicados(); }, []);

  const loadComunicados = async () => {
    setLoading(true);
    const data = await comunicadosApi.list('orden', 100);
    setComunicados(data);
    setLoading(false);
  };

  const visibles = isAdmin ? comunicados : comunicados.filter(c => c.activo);

  const handleSave = async (form) => {
    if (editing) {
      await comunicadosApi.update(editing.id, form);
    } else {
      const maxOrden = comunicados.length > 0 ? Math.max(...comunicados.map(c => c.orden || 0)) : 0;
      await comunicadosApi.create({ ...form, orden: maxOrden + 1 });
    }
    setShowForm(false); setEditing(null);
    loadComunicados();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Noticias y comunicados</p>
        </div>
        {isAdmin && !showForm && !editing && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm">
            <Plus size={16} /> Nuevo comunicado
          </button>
        )}
      </div>
      {(showForm || editing) && (
        <div className="mb-6">
          <ComunicadoForm item={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </div>
      )}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {isAdmin ? "Aún no hay comunicados. ¡Crea el primero!" : "No hay comunicados disponibles."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibles.map((item, idx) => (
            <div key={item.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${!item.activo && isAdmin ? "opacity-60" : ""}`}>
              {item.imagen_url && <img src={item.imagen_url} alt={item.titulo} className="w-full h-48 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[item.tipo] || "bg-gray-100 text-gray-700"}`}>
                    {TIPO_LABELS[item.tipo] || item.tipo}
                  </span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => comunicadosApi.update(item.id, { activo: !item.activo }).then(loadComunicados)} className="p-1 hover:bg-gray-100 rounded">
                        {item.activo ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button onClick={() => { setEditing(item); setShowForm(false); }} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Pencil size={15} /></button>
                      <button onClick={() => { if(confirm("¿Eliminar?")) comunicadosApi.delete(item.id).then(loadComunicados); }} className="p-1 hover:bg-gray-100 rounded text-red-500"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-1">{item.titulo}</h3>
                {item.contenido && <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.contenido}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}