import { useState, useEffect } from 'react';
import { comunicadosApi, uploadFile } from '../api';
import { useAuth } from '../lib/auth';
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, X, Save, Loader2, ImageIcon, Megaphone } from 'lucide-react';

function ComunicadoModal({ com, onClose, onSave }) {
  const [form, setForm] = useState(com || { titulo: '', texto: '', imagen_url: '', visible: true, orden: 99 });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      setForm(f => ({ ...f, imagen_url: file_url }));
    } catch(err) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return alert('El título es obligatorio');
    setSaving(true);
    try {
      let result;
      if (form.id) {
        result = await comunicadosApi.update(form.id, form);
      } else {
        result = await comunicadosApi.create(form);
      }
      onSave(result);
    } catch(e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">{form.id ? 'Editar comunicado' : 'Nuevo comunicado'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Título *</label>
            <input className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))} placeholder="Título del comunicado" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Texto</label>
            <textarea className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400"
              rows={4} value={form.texto} onChange={e => setForm(f => ({...f, texto: e.target.value}))} placeholder="Contenido del comunicado..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Imagen</label>
            <div className="flex gap-2">
              <input className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={form.imagen_url || ''} onChange={e => setForm(f => ({...f, imagen_url: e.target.value}))} placeholder="URL de imagen..." />
              <label className="px-3 py-2.5 rounded-xl border border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 text-sm text-gray-500 flex items-center gap-1">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                <span>Subir</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            {form.imagen_url && (
              <img src={form.imagen_url} alt="preview" className="mt-2 h-24 object-cover rounded-xl border" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.visible !== false}
                onChange={e => setForm(f => ({...f, visible: e.target.checked}))} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">Visible para tiendas</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Orden</label>
            <input type="number" className="w-32 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.orden || 0} onChange={e => setForm(f => ({...f, orden: Number(e.target.value)}))} />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Inicio() {
  const { isAdmin } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | comunicado obj

  useEffect(() => {
    comunicadosApi.list().then(data => {
      const visible = isAdmin ? data : data.filter(c => c.visible);
      setComunicados(visible);
      setLoading(false);
    });
  }, [isAdmin]);

  const handleSave = (saved) => {
    setComunicados(prev => {
      const exists = prev.find(c => c.id === saved.id);
      if (exists) return prev.map(c => c.id === saved.id ? saved : c).sort((a,b) => (a.orden||0)-(b.orden||0));
      return [...prev, saved].sort((a,b) => (a.orden||0)-(b.orden||0));
    });
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar comunicado?')) return;
    await comunicadosApi.delete(id);
    setComunicados(prev => prev.filter(c => c.id !== id));
  };

  const handleToggleVisible = async (com) => {
    const updated = await comunicadosApi.update(com.id, { visible: !com.visible });
    setComunicados(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleMove = async (idx, dir) => {
    const arr = [...comunicados];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    arr.forEach((c, i) => { c.orden = i; });
    setComunicados(arr);
    for (const c of arr) await comunicadosApi.update(c.id, { orden: c.orden });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
          <p className="text-gray-400 text-sm mt-0.5">Comunicados y noticias</p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal('new')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm">
            <Plus size={18} />
            Nuevo comunicado
          </button>
        )}
      </div>

      {modal && (
        <ComunicadoModal
          com={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : comunicados.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">No hay comunicados</p>
          {isAdmin && <p className="text-sm text-gray-400 mt-1">Crea el primer comunicado con el botón de arriba</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {comunicados.map((com, idx) => (
            <div key={com.id} className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm ${!com.visible ? 'opacity-60' : ''}`}>
              {com.imagen_url && (
                <div className="h-48 bg-gray-100">
                  <img src={com.imagen_url} alt={com.titulo} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-gray-900 text-base leading-snug">{com.titulo}</h2>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-400">
                        <ChevronUp size={16} />
                      </button>
                      <button onClick={() => handleMove(idx, 1)} disabled={idx === comunicados.length - 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-400">
                        <ChevronDown size={16} />
                      </button>
                      <button onClick={() => handleToggleVisible(com)}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 ${com.visible ? 'text-green-600' : 'text-gray-400'}`}>
                        {com.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => setModal(com)} className="p-1.5 rounded-lg hover:bg-gray-100 text-blue-500">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(com.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {com.texto && <p className="text-gray-600 text-sm mt-2 leading-relaxed whitespace-pre-wrap">{com.texto}</p>}
                {!com.visible && isAdmin && (
                  <span className="mt-2 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Oculto</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
