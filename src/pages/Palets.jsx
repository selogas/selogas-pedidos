import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Package2, Plus, Trash2, X, Check, Loader2, Send,
  ImageIcon, Upload, AlertCircle, Pencil, Store
} from "lucide-react";

// ─── Modal Admin: crear/editar producto de palet ───────────────────────────
function ModalProductoPalet({ producto, tiendas, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre: producto?.nombre || "",
    descripcion: producto?.descripcion || "",
    imagen_url: producto?.imagen_url || "",
    activo: producto?.activo ?? true,
  });
  const [tiendaIds, setTiendaIds] = useState([]);
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(producto?.imagen_url || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (producto?.id) {
      supabase.from("palet_tiendas").select("tienda_id").eq("palet_producto_id", producto.id)
        .then(({ data }) => setTiendaIds((data || []).map(r => r.tienda_id)));
    }
  }, [producto?.id]);

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const uploadImagen = async () => {
    if (!imagenFile) return form.imagen_url || null;
    const ext = imagenFile.name.split(".").pop();
    const fileName = `palets/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("imagenes").upload(fileName, imagenFile, { contentType: imagenFile.type });
    if (error) { alert("Error subiendo imagen: " + error.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from("imagenes").getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const imagen_url = await uploadImagen();
    const datos = { ...form, imagen_url };

    let id = producto?.id;
    if (id) {
      await supabase.from("palet_productos").update(datos).eq("id", id);
    } else {
      const { data } = await supabase.from("palet_productos").insert([datos]).select().single();
      id = data?.id;
    }

    if (id) {
      await supabase.from("palet_tiendas").delete().eq("palet_producto_id", id);
      if (tiendaIds.length > 0) {
        await supabase.from("palet_tiendas").insert(tiendaIds.map(tid => ({ palet_producto_id: id, tienda_id: tid })));
      }
    }

    setSaving(false);
    onSave();
  };

  const toggleTienda = (tid) => {
    setTiendaIds(prev => prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Package2 size={18} className="text-[#00913f]" />
            {producto ? "Editar producto palet" : "Nuevo producto palet"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Palet de refrescos" className="w-full border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción del palet..." rows={2}
              className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1.5"><ImageIcon size={14} /> Imagen</label>
            {imagenPreview ? (
              <div className="relative">
                <img src={imagenPreview} alt="preview" className="w-full max-h-48 object-contain rounded-xl border bg-gray-50" />
                <button onClick={() => { setImagenFile(null); setImagenPreview(null); setForm(f => ({ ...f, imagen_url: "" })); fileRef.current.value = ""; }}
                  className="absolute top-2 right-2 bg-white border rounded-lg p-1 hover:bg-red-50 text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center gap-2 text-gray-400 hover:border-[#00913f] hover:text-[#00913f] transition-colors">
                <Upload size={20} />
                <span className="text-sm">Subir imagen</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <Store size={14} /> Estaciones autorizadas
            </label>
            <p className="text-xs text-gray-400 mb-2">Sin selección = visible para todas las estaciones.</p>
            <div className="border rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
              {tiendas.filter(t => t.nombre !== "PRINCIPAL").map(t => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={tiendaIds.includes(t.id)} onChange={() => toggleTienda(t.id)}
                    className="w-4 h-4 accent-[#00913f]" />
                  <span className="text-sm">{t.nombre}</span>
                  <span className="text-xs text-gray-400 ml-auto">{t.grupo}</span>
                </label>
              ))}
            </div>
            {tiendaIds.length > 0 && (
              <p className="text-xs text-[#00913f] mt-1 font-medium">{tiendaIds.length} estación(es) seleccionada(s)</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Activo</label>
            <button onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activo ? "bg-[#00913f]" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.activo ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-medium text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre.trim()}
            className="flex-1 py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34] disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de producto de palet ─────────────────────────────────────────────
function PaletProductoCard({ producto, isAdmin, onEditar, onEliminar, onSolicitar }) {
  const [confirm, setConfirm] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSolicitar = async () => {
    setEnviando(true);
    await onSolicitar(producto, obs);
    setEnviando(false);
    setEnviado(true);
    setConfirm(false);
    setTimeout(() => setEnviado(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {producto.imagen_url && (
        <div className="w-full h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
          <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-contain p-2"
            onError={e => { e.target.parentElement.style.display = "none"; }} />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-sm leading-snug">{producto.nombre}</h3>
        {producto.descripcion && <p className="text-xs text-gray-500 mt-1 leading-snug">{producto.descripcion}</p>}

        {isAdmin ? (
          <div className="mt-3 flex gap-2">
            <button onClick={() => onEditar(producto)}
              className="flex-1 py-2 border rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-gray-50">
              <Pencil size={13} /> Editar
            </button>
            <button onClick={() => onEliminar(producto.id)}
              className="py-2 px-3 border border-red-200 text-red-500 rounded-xl hover:bg-red-50">
              <Trash2 size={13} />
            </button>
          </div>
        ) : enviado ? (
          <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-3 py-2 text-sm font-medium">
            <Check size={16} /> Solicitud enviada
          </div>
        ) : !confirm ? (
          <button onClick={() => setConfirm(true)}
            className="mt-3 w-full py-2.5 bg-[#00913f] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#007a34]">
            <Send size={15} /> Solicitar palet
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl text-amber-800 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>¿Confirmas la solicitud de este palet?</span>
            </div>
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Observaciones (opcional)..." rows={2}
              className="w-full border rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-[#00913f]" />
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2 border rounded-xl text-xs font-medium hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSolicitar} disabled={enviando}
                className="flex-1 py-2 bg-[#00913f] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-[#007a34] disabled:opacity-60">
                {enviando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal Palets ───────────────────────────────────────────────
export default function Palets() {
  const { isAdmin, perfil } = useAuth();
  const [productos, setProductos] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const tiendaId = perfil?.tienda_id;

  const cargar = async () => {
    // Esperar a que el perfil esté cargado
    if (!isAdmin && !tiendaId) return;
    setLoading(true);

    if (isAdmin) {
      // Admin ve todos los productos activos
      const { data } = await supabase.from("palet_productos").select("*").eq("activo", true).order("created_at", { ascending: false });
      setProductos(data || []);
    } else {
      // Obtener IDs de palets asignados específicamente a esta tienda
      const { data: asignados } = await supabase
        .from("palet_tiendas")
        .select("palet_producto_id")
        .eq("tienda_id", tiendaId);
      const idsAsignados = new Set((asignados || []).map(r => r.palet_producto_id));

      // Obtener IDs de palets que tienen alguna restricción de tienda
      const { data: todosConRestr } = await supabase
        .from("palet_tiendas")
        .select("palet_producto_id");
      const idsConRestr = new Set((todosConRestr || []).map(r => r.palet_producto_id));

      // Obtener todos los productos activos
      const { data: todos } = await supabase
        .from("palet_productos")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false });

      // Filtrar: si tiene restricciones, solo lo ve si está en su lista
      const visibles = (todos || []).filter(p =>
        !idsConRestr.has(p.id) || idsAsignados.has(p.id)
      );

      setProductos(visibles);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (perfil === null) return;
    if (!isAdmin && !tiendaId) return;
    cargar();
    if (isAdmin) {
      supabase.from("tiendas").select("id, nombre, grupo, email").eq("activa", true).order("nombre")
        .then(({ data }) => setTiendas(data || []));
    }
  }, [perfil?.id, tiendaId, isAdmin]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este producto de palet?")) return;
    await supabase.from("palet_tiendas").delete().eq("palet_producto_id", id);
    await supabase.from("palet_solicitudes").delete().eq("palet_producto_id", id);
    await supabase.from("palet_productos").delete().eq("id", id);
    cargar();
  };

  const solicitar = async (producto, observaciones) => {
    const tienda = perfil?.tiendas;
    await supabase.from("palet_solicitudes").insert([{
      palet_producto_id: producto.id,
      tienda_id: tiendaId,
      perfil_id: perfil?.id || null,
      nombre_producto: producto.nombre,
      nombre_tienda: tienda?.nombre || perfil?.tienda_nombre || "",
      nombre_usuario: perfil?.nombre_completo || perfil?.nombre || "",
      email_tienda: tienda?.email || perfil?.email || "",
      observaciones: observaciones || "",
    }]);

    try {
      const { data: config } = await supabase.from("configuracion").select("valor").eq("clave", "email_palets").single();
      const emailPalets = config?.valor?.trim();
      if (emailPalets) {
        const nombreTienda = tienda?.nombre || perfil?.tienda_nombre || "";
        const nombreUsuario = perfil?.nombre_completo || perfil?.nombre || "";
        const emailTienda = tienda?.email || perfil?.email || "";
        const fechaStr = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

        const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#00913f;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:20px;">Solicitud de Palet - SELOGAS</h1>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">${fechaStr}</p>
          </div>
          <div style="background:#f8f9fa;padding:24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
            <table style="width:100%;border-collapse:collapse;border-spacing:0 8px;">
              <tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;width:150px;">Producto</td>
              <td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-size:15px;font-weight:600;color:#00913f;">${producto.nombre}</td></tr>
              <tr><td colspan="2" style="padding:3px;"></td></tr>
              <tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;">Tienda</td>
              <td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">${nombreTienda}</td></tr>
              <tr><td colspan="2" style="padding:3px;"></td></tr>
              <tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;">Usuario</td>
              <td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">${nombreUsuario || "-"}</td></tr>
              <tr><td colspan="2" style="padding:3px;"></td></tr>
              <tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;">Email tienda</td>
              <td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">${emailTienda || "-"}</td></tr>
              ${observaciones ? `<tr><td colspan="2" style="padding:3px;"></td></tr>
              <tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;">Observaciones</td>
              <td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">${observaciones}</td></tr>` : ""}
            </table>
            <p style="margin-top:20px;color:#888;font-size:12px;">Solicitud enviada desde SELOGAS Pedidos.</p>
          </div>
        </div>`;

        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer re_4rosYhyz_6EsyN4w7x9wnVepGQ2gPdthK",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "SELOGAS Pedidos <onboarding@resend.dev>",
            to: [emailPalets],
            subject: `Solicitud de Palet: ${producto.nombre} - ${nombreTienda}`,
            html: htmlBody,
          }),
        });
        const resendData = await resendResp.json();
        if (!resendResp.ok) {
          alert("Error Resend: " + JSON.stringify(resendData));
        }
      }
    } catch (e) {
      alert("Error enviando email: " + e.message);
      console.error("Error enviando email palet:", e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {modal && (
        <ModalProductoPalet
          producto={editando}
          tiendas={tiendas}
          onSave={() => { setModal(false); setEditando(null); cargar(); }}
          onClose={() => { setModal(false); setEditando(null); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package2 size={24} className="text-[#00913f]" /> Palets
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? `${productos.length} producto(s) disponibles` : "Solicita palets de productos"}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditando(null); setModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00913f] text-white rounded-xl font-semibold text-sm hover:bg-[#007a34]">
            <Plus size={16} /> Nuevo producto palet
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-[#00a847]" /></div>
      ) : productos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>{isAdmin ? "No hay productos de palet creados" : "No hay productos de palet disponibles"}</p>
          {isAdmin && (
            <button onClick={() => { setEditando(null); setModal(true); }}
              className="mt-4 px-4 py-2 bg-[#00913f] text-white rounded-xl text-sm font-medium hover:bg-[#007a34]">
              Crear primer producto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productos.map(p => (
            <PaletProductoCard
              key={p.id}
              producto={p}
              isAdmin={isAdmin}
              onEditar={(p) => { setEditando(p); setModal(true); }}
              onEliminar={eliminar}
              onSolicitar={solicitar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
