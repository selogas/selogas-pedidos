import { useState, useEffect, useRef } from 'react';

import { configuracionApi } from '../api';

import { supabase } from '../lib/supabase';

import {
    Save, CheckCircle, Loader2, Mail, MessageSquare, FileText,
    Package2, Image, Plus, Trash2, GripVertical, Eye, EyeOff
} from 'lucide-react';

const CAMPOS = [
  {
        clave: 'email_almacen',
        label: 'Email del Almacén',
        descripcion: 'Dirección(es) donde se recibirán los pedidos y el catálogo PDF (separadas por coma)',
        icon: Mail,
        placeholder: 'almacen@empresa.com, almacen2@empresa.com',
        type: 'email'
  },
  {
        clave: 'email_palets',
        label: 'Email de Palets',
        descripcion: 'Dirección exclusiva para recibir solicitudes de palets (separada del correo de pedidos normal)',
        icon: Package2,
        placeholder: 'palets@empresa.com',
        type: 'email'
  },
  {
        clave: 'asunto_email',
        label: 'Asunto del email',
        descripcion: 'Usa {Tienda} y {Fecha} como variables',
        icon: FileText,
        placeholder: 'Pedido - {Tienda} - {Fecha}',
        type: 'text'
  },
  {
        clave: 'texto_email',
        label: 'Texto adicional en el email',
        descripcion: 'Texto al final del email (opcional)',
        icon: MessageSquare,
        placeholder: 'Gracias por tu pedido...',
        type: 'textarea'
  },
  ];

// ─── Gestión de Novedades ──────────────────────────────────────────────────

const FORM_VACIO = { titulo: '', descripcion: '', imagen_url: '', enlace: '', activa: true };

const SUPABASE_URL = 'https://pasllyqgczegpvquaxvb.supabase.co';

function GestionNovedades() {
    const [novedades, setNovedades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(FORM_VACIO);
    const [editandoId, setEditandoId] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [exito, setExito] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const dragItem = useRef(null);
    const [draggingIdx, setDraggingIdx] = useState(null);
    const [overIdx, setOverIdx] = useState(null);
    const fileInputRef = useRef(null);

  const mostrarExito = (msg) => {
        setExito(msg);
        setTimeout(() => setExito(''), 2500);
  };

  const fetchNovedades = async () => {
        const { data } = await supabase
          .from('novedades')
          .select('*')
          .order('orden', { ascending: true });
        setNovedades(data || []);
        setLoading(false);
  };

  useEffect(() => { fetchNovedades(); }, []);

  const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setErrorMsg('Solo se permiten imágenes.'); return; }
        if (file.size > 5 * 1024 * 1024) { setErrorMsg('La imagen no puede superar 5MB.'); return; }
        setSubiendo(true);
        setErrorMsg('');
        const ext = file.name.split('.').pop();
        const nombre = `novedad_${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('novedades')
          .upload(nombre, file, { upsert: false });
        if (error) {
                setErrorMsg('Error al subir: ' + error.message);
        } else {
                const url = `${SUPABASE_URL}/storage/v1/object/public/novedades/${nombre}`;
                setForm(f => ({ ...f, imagen_url: url }));
        }
        setSubiendo(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.imagen_url.trim()) { setErrorMsg('Sube una imagen o introduce una URL.'); return; }
        setErrorMsg('');
        setGuardando(true);
        if (editandoId) {
                await supabase.from('novedades').update(form).eq('id', editandoId);
                mostrarExito('Novedad actualizada.');
                setEditandoId(null);
                setForm(FORM_VACIO);
        } else {
                await supabase.from('novedades').insert([{ ...form, orden: novedades.length }]);
                mostrarExito('Novedad añadida.');
                setForm(FORM_VACIO);
        }
        setGuardando(false);
        fetchNovedades();
  };

  const iniciarEdicion = (nov) => {
        setEditandoId(nov.id);
        setForm({ titulo: nov.titulo || '', descripcion: nov.descripcion || '', imagen_url: nov.imagen_url, enlace: nov.enlace || '', activa: nov.activa });
  };

  const cancelar = () => { setEditandoId(null); setForm(FORM_VACIO); setErrorMsg(''); };

  const toggleActiva = async (nov) => {
        await supabase.from('novedades').update({ activa: !nov.activa }).eq('id', nov.id);
        fetchNovedades();
  };

  const eliminar = async (id) => {
        if (!confirm('¿Eliminar esta novedad?')) return;
        await supabase.from('novedades').delete().eq('id', id);
        mostrarExito('Novedad eliminada.');
        fetchNovedades();
  };

  const onDragStart = (idx) => { dragItem.current = idx; setDraggingIdx(idx); };
    const onDragEnter = (idx) => setOverIdx(idx);
    const onDragEnd = async () => {
          if (dragItem.current !== null && overIdx !== null && dragItem.current !== overIdx) {
                  const reord = [...novedades];
                  const [mov] = reord.splice(dragItem.current, 1);
                  reord.splice(overIdx, 0, mov);
                  setNovedades(reord);
                  await Promise.all(reord.map(({ id }, i) => supabase.from('novedades').update({ orden: i }).eq('id', id)));
                  mostrarExito('Orden guardado.');
          }
          dragItem.current = null;
          setDraggingIdx(null);
          setOverIdx(null);
    };

  return (
        <div className="space-y-4">
              <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-3">
                      <h3 className="font-semibold text-gray-800 text-sm">
                        {editandoId ? 'Editar novedad' : 'Añadir novedad'}
                      </h3>h3>
                {/* Imagen */}
                      <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Imagen *</label>label>
                                <button
                                              type="button"
                                              onClick={() => fileInputRef.current?.click()}
                                              disabled={subiendo}
                                              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-600 transition-colors mb-2"
                                            >
                                  {subiendo
                                                  ? <><Loader2 size={15} className="animate-spin text-[#00913f]" /> Subiendo imagen...</>>
                                                  : <><Plus size={15} className="text-[#00913f]" /> Subir imagen desde tu dispositivo</>>
                                  }
                                </button>button>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                <div className="flex items-center gap-2 mb-2">
                                            <div className="flex-1 h-px bg-gray-200" />
                                            <span className="text-xs text-gray-400">o pegar URL</span>span>
                                            <div className="flex-1 h-px bg-gray-200" />
                                </div>div>
                                <input
                                              type="url"
                                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00c254]"
                                              placeholder="https://..."
                                              value={form.imagen_url}
                                              onChange={e => setForm({ ...form, imagen_url: e.target.value })}
                                            />
                        {form.imagen_url && (
                      <div className="mt-2 relative">
                                    <img
                                                      src={form.imagen_url}
                                                      alt="Preview"
                                                      className="w-full rounded-xl object-cover"
                                                      style={{ maxHeight: '130px' }}
                                                      onError={e => { e.target.style.display = 'none'; }}
                                                    />
                                    <button
                                                      type="button"
                                                      onClick={() => setForm(f => ({ ...f, imagen_url: '' }))}
                                                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                                                    >
                                                    <Trash2 size={11} className="text-white" />
                                    </button>button>
                      </div>div>
                                )}
                      </div>div>
                      <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Título (opcional)</label>label>
                                <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00c254]" placeholder="Ej: Nuevos productos de temporada" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
                      </div>div>
                      <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Descripción corta (opcional)</label>label>
                                <input type="text" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00c254]" placeholder="Texto breve visible sobre la imagen" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                      </div>div>
                      <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Enlace al pulsar (opcional)</label>label>
                                <input type="url" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00c254]" placeholder="https://..." value={form.enlace} onChange={e => setForm({ ...form, enlace: e.target.value })} />
                      </div>div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={form.activa} onChange={e => setForm({ ...form, activa: e.target.checked })} className="rounded" />
                                Visible en la app
                      </label>label>
                {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>p>}
                {exito && <p className="text-[#00913f] text-xs font-semibold">{exito}</p>p>}
                      <div className="flex gap-2 pt-1">
                                <button type="submit" disabled={guardando || subiendo} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors" style={{ background: '#00913f', opacity: (guardando || subiendo) ? 0.7 : 1 }}>
                                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                  {editandoId ? 'Guardar cambios' : 'Añadir'}
                                </button>button>
                        {editandoId && (
                      <button type="button" onClick={cancelar} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">Cancelar</button>button>
                                )}
                      </div>div>
              </form>form>
        
          {/* Lista */}
              <div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                <GripVertical size={13} /> Arrastra para reordenar
                      </p>p>
                {loading ? (
                    <div className="flex justify-center py-4"><Loader2 size={22} className="animate-spin text-[#00913f]" /></div>div>
                  ) : novedades.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No hay novedades todavía.</p>p>
                  ) : (
                    <div className="space-y-2">
                      {novedades.map((nov, idx) => (
                                    <div
                                                      key={nov.id}
                                                      draggable
                                                      onDragStart={() => onDragStart(idx)}
                                                      onDragEnter={() => onDragEnter(idx)}
                                                      onDragEnd={onDragEnd}
                                                      onDragOver={e => e.preventDefault()}
                                                      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 transition-all"
                                                      style={{ opacity: draggingIdx === idx ? 0.4 : 1, borderTop: overIdx === idx && draggingIdx !== idx ? '2px solid #00913f' : undefined, cursor: 'grab' }}
                                                    >
                                                    <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                                                    <img src={nov.imagen_url} alt="" className="w-14 h-9 object-cover rounded-lg flex-shrink-0 bg-gray-100" onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="36"><rect fill="%23eee" width="56" height="36"/></svg>'; }} />
                                                    <div className="flex-1 min-w-0">
                                                                      <p className="text-sm font-semibold text-gray-800 truncate">{nov.titulo || <span className="text-gray-400 font-normal italic">Sin título</span>span>}</p>p>
                                                    </div>div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                      <button onClick={() => toggleActiva(nov)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title={nov.activa ? 'Ocultar' : 'Mostrar'}>
                                                                        {nov.activa ? <Eye size={15} className="text-[#00913f]" /> : <EyeOff size={15} className="text-gray-400" />}
                                                                      </button>button>
                                                                      <button onClick={() => iniciarEdicion(nov)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" title="Editar">✏️</button>button>
                                                                      <button onClick={() => eliminar(nov.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="Eliminar">
                                                                                          <Trash2 size={14} className="text-red-400" />
                                                                      </button>button>
                                                    </div>div>
                                    </div>div>
                                  ))}
                    </div>div>
                      )}
              </div>div>
        </div>div>
      );
}

// ─── Página Configuración ──────────────────────────────────────────────────

export default function Configuracion() {
    const [valores, setValores] = useState({});
    const [loading, setLoading] = useState(true);
    const [guardando, setGuardando] = useState({});
    const [exito, setExito] = useState({});
  
    useEffect(() => {
          configuracionApi.list().then((configs) => {
                  const vals = {};
                  configs.forEach((c) => { vals[c.clave] = c.valor || ''; });
                  setValores(vals);
                  setLoading(false);
          });
    }, []);
  
    const handleGuardar = async (clave) => {
          setGuardando((g) => ({ ...g, [clave]: true }));
          await configuracionApi.upsert(clave, valores[clave] || '');
          setGuardando((g) => ({ ...g, [clave]: false }));
          setExito((e) => ({ ...e, [clave]: true }));
          setTimeout(() => setExito((e) => ({ ...e, [clave]: false })), 2000);
    };
  
    if (loading) return (
          <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 size={32} className="animate-spin text-[#00913f]" />
          </div>div>
        );
  
    return (
          <div className="max-w-2xl mx-auto space-y-6">
                <div>
                        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>h1>
                        <p className="text-gray-500 text-sm mt-1">Ajustes generales del sistema de pedidos</p>p>
                </div>div>
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                  {CAMPOS.map(({ clave, label, descripcion, icon: Icon, placeholder, type }) => (
                      <div key={clave} className="p-6">
                                  <div className="flex items-start gap-3 mb-3">
                                                <div className="w-9 h-9 rounded-lg bg-[#edf7f2] flex items-center justify-center flex-shrink-0">
                                                                <Icon size={18} className="text-[#00913f]" />
                                                </div>div>
                                                <div>
                                                                <div className="font-semibold text-gray-900">{label}</div>div>
                                                                <div className="text-xs text-gray-400 mt-0.5">{descripcion}</div>div>
                                                </div>div>
                                  </div>div>
                                  <div className="flex gap-3 mt-3">
                                    {type === 'textarea' ? (
                                        <textarea className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[#00c254]" rows={3} placeholder={placeholder} value={valores[clave] || ''} onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))} />
                                      ) : (
                                        <input type="text" className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#00c254]" placeholder={placeholder} value={valores[clave] || ''} onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))} />
                                      )}
                                                <button onClick={() => handleGuardar(clave)} disabled={!!guardando[clave]} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-colors" style={{ background: exito[clave] ? '#22c55e' : '#00913f', opacity: guardando[clave] ? 0.7 : 1 }}>
                                                  {guardando[clave] ? <Loader2 size={16} className="animate-spin" /> : exito[clave] ? <CheckCircle size={16} /> : <Save size={16} />}
                                                  {exito[clave] ? 'Guardado' : 'Guardar'}
                                                </button>button>
                                  </div>div>
                      </div>div>
                    ))}
                </div>div>
          
            {/* Novedades */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-start gap-3 mb-5">
                                  <div className="w-9 h-9 rounded-lg bg-[#edf7f2] flex items-center justify-center flex-shrink-0">
                                              <Image size={18} className="text-[#00913f]" />
                                  </div>div>
                                  <div>
                                              <div className="font-semibold text-gray-900">Novedades</div>div>
                                              <div className="text-xs text-gray-400 mt-0.5">Imágenes del carrusel que aparecen en la página de Inicio</div>div>
                                  </div>div>
                        </div>div>
                        <GestionNovedades />
                </div>div>
          </div>div>
        );
}</></></div>
