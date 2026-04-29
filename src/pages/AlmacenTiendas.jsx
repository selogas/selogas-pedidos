import { useState, useEffect } from 'react';
import { tiendasApi, perfilesApi } from '../api';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, UserPlus, X, Save, Loader2, Store, Users, CheckCircle, AlertCircle } from 'lucide-react';

const GRUPOS = ['estacion', 'cafeteria', 'ambos'];

function TiendaModal({ tienda, onClose, onSave }) {
  const [form, setForm] = useState(tienda || { codigo: '', nombre: '', email: '', responsable: '', grupo: 'estacion', activa: true });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    setSaving(true);
    try {
      let result;
      if (form.id) {
        result = await tiendasApi.update(form.id, form);
      } else {
        result = await tiendasApi.create(form);
      }
      onSave(result);
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">{form.id ? 'Editar tienda' : 'Nueva tienda'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { field: 'codigo', label: 'Código', placeholder: 'COD001' },
            { field: 'nombre', label: 'Nombre *', placeholder: 'Nombre de la tienda' },
            { field: 'email', label: 'Email', placeholder: 'tienda@empresa.com', type: 'email' },
            { field: 'responsable', label: 'Responsable', placeholder: 'Nombre del responsable' },
          ].map(({ field, label, placeholder, type = 'text' }) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
              <input type={type} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                placeholder={placeholder} value={form[field] || ''}
                onChange={e => setForm(f => ({...f, [field]: e.target.value}))} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Grupo *</label>
            <select className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={form.grupo || 'estacion'} onChange={e => setForm(f => ({...f, grupo: e.target.value}))}>
              <option value="estacion">Estación de Servicio</option>
              <option value="cafeteria">Cafetería</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-xl">
            <input type="checkbox" checked={form.activa !== false} onChange={e => setForm(f => ({...f, activa: e.target.checked}))}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-medium text-gray-700">Tienda activa</span>
          </label>
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

function InviteModal({ tiendas, onClose }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [tienda_id, setTiendaId] = useState('');
  const [rol, setRol] = useState('tienda');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleInvite = async () => {
    if (!email.trim() || !/^[^@]+@[^@]+.[^@]+$/.test(email)) return setResult({ error: 'Email inválido' });
    setLoading(true);
    setResult(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: { nombre: nombre.trim(), rol, tienda_id: tienda_id || null }
        }
      });
      if (error) throw error;
      setResult({ success: true });
    } catch(e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-bold text-lg">Invitar usuario</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
            <input type="email" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="usuario@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre</label>
            <input type="text" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Nombre del usuario" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol</label>
            <select className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              value={rol} onChange={e => setRol(e.target.value)}>
              <option value="tienda">Tienda</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {rol === 'tienda' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tienda asignada</label>
              <select className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                value={tienda_id} onChange={e => setTiendaId(e.target.value)}>
                <option value="">Sin tienda asignada</option>
                {tiendas.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {result?.success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm">
              <CheckCircle size={16} />
              <span>Invitación enviada a <strong>{email}</strong></span>
            </div>
          )}
          {result?.error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{result.error}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cerrar</button>
          <button onClick={handleInvite} disabled={loading || result?.success}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {loading ? 'Enviando...' : result?.success ? 'Enviada' : 'Enviar invitación'}
          </button>
        </div>
      </div>
    </div>
  );
}

const GRUPO_LABEL = { estacion: 'Estación', cafeteria: 'Cafetería', ambos: 'Ambos' };
const GRUPO_COLOR = { estacion: 'bg-orange-100 text-orange-700', cafeteria: 'bg-purple-100 text-purple-700', ambos: 'bg-blue-100 text-blue-700' };

export default function AlmacenTiendas() {
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tab, setTab] = useState('tiendas');

  useEffect(() => {
    Promise.all([tiendasApi.list(), perfilesApi.list()]).then(([t, u]) => {
      setTiendas(t);
      setUsuarios(u);
      setLoading(false);
    });
  }, []);

  const handleSaveTienda = (saved) => {
    setTiendas(prev => {
      const exists = prev.find(t => t.id === saved.id);
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved];
    });
    setModal(null);
  };

  const handleDeleteTienda = async (id) => {
    if (!confirm('¿Eliminar esta tienda?')) return;
    await tiendasApi.delete(id);
    setTiendas(prev => prev.filter(t => t.id !== id));
  };

  const handleDeleteUsuario = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await perfilesApi.delete(id);
    setUsuarios(prev => prev.filter(u => u.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-blue-600" /></div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {modal && <TiendaModal tienda={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSaveTienda} />}
      {inviteOpen && <InviteModal tiendas={tiendas} onClose={() => setInviteOpen(false)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almacén / Tiendas y Usuarios</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gestión de tiendas y accesos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
            <UserPlus size={16} />Invitar usuario
          </button>
          <button onClick={() => setModal('new')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 shadow-sm">
            <Plus size={16} />Nueva tienda
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        <button onClick={() => setTab('tiendas')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${tab === 'tiendas' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <Store size={16} />Tiendas ({tiendas.length})
        </button>
        <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${tab === 'usuarios' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={16} />Usuarios ({usuarios.length})
        </button>
      </div>

      {tab === 'tiendas' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Código', 'Nombre', 'Email', 'Responsable', 'Grupo', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tiendas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay tiendas</td></tr>
              ) : tiendas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{t.codigo || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 text-sm">{t.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.responsable || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${GRUPO_COLOR[t.grupo] || 'bg-gray-100 text-gray-600'}`}>
                      {GRUPO_LABEL[t.grupo] || t.grupo || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${t.activa !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activa !== false ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"><Pencil size={15} /></button>
                      <button onClick={() => handleDeleteTienda(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nombre', 'Email', 'Rol', 'Tienda', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay usuarios</td></tr>
              ) : usuarios.map(u => {
                const tienda = tiendas.find(t => t.id === u.tienda_id);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900 text-sm">{u.nombre || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.rol === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tienda?.nombre || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.activo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteUsuario(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
