import { supabase } from '../lib/supabase';

// ===== HELPER: sleep para evitar rate limit =====
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===== PRODUCTOS =====
export const productosApi = {
  list: async (orderBy = 'orden_excel', limit = 2000) => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order(orderBy, { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
  filter: async (filters) => {
    let query = supabase.from('productos').select('*');
    Object.entries(filters).forEach(([key, val]) => { query = query.eq(key, val); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  create: async (prod) => {
    const { data, error } = await supabase.from('productos').insert(prod).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('productos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) throw error;
  },
  bulkCreate: async (items) => {
    const results = [];
    for (let i = 0; i < items.length; i += 20) {
      const batch = items.slice(i, i + 20);
      const { data, error } = await supabase.from('productos').insert(batch).select();
      if (error) throw error;
      results.push(...(data || []));
      if (i + 20 < items.length) await sleep(200);
    }
    return results;
  },
  bulkDelete: async (ids) => {
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const { error } = await supabase.from('productos').delete().in('id', batch);
      if (error) throw error;
      if (i + 20 < ids.length) await sleep(200);
    }
  },
  deleteAll: async () => {
    const { error } = await supabase.from('productos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
};

// ===== CATEGORIAS =====
export const categoriasApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('orden', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  create: async (cat) => {
    const { data, error } = await supabase.from('categorias').insert(cat).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('categorias').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== TIENDAS =====
export const tiendasApi = {
  list: async () => {
    const { data, error } = await supabase.from('tiendas').select('*').order('nombre');
    if (error) throw error;
    return data || [];
  },
  create: async (tienda) => {
    const { data, error } = await supabase.from('tiendas').insert(tienda).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('tiendas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('tiendas').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== PERFILES (usuarios) =====
export const perfilesApi = {
  list: async () => {
    const { data, error } = await supabase.from('perfiles').select('*').order('nombre');
    if (error) throw error;
    return data || [];
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('perfiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('perfiles').delete().eq('id', id);
    if (error) throw error;
  },
  inviteUser: async ({ email, nombre, rol, tienda_id }) => {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { nombre, rol, tienda_id }
    });
    if (error) throw error;
    return data;
  }
};

// ===== PEDIDOS =====
export const pedidosApi = {
  list: async (limit = 200) => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('fecha_pedido', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
  filter: async (filters, limit = 100) => {
    let query = supabase.from('pedidos').select('*').order('fecha_pedido', { ascending: false }).limit(limit);
    Object.entries(filters).forEach(([key, val]) => { query = query.eq(key, val); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  create: async (pedido) => {
    const { data, error } = await supabase.from('pedidos').insert(pedido).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('pedidos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
};

// ===== PEDIDO ITEMS =====
export const pedidoItemsApi = {
  filter: async (filters, limit = 500) => {
    let query = supabase.from('pedido_items').select('*').order('orden_excel', { ascending: true }).limit(limit);
    Object.entries(filters).forEach(([key, val]) => { query = query.eq(key, val); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  bulkCreate: async (items) => {
    const { data, error } = await supabase.from('pedido_items').insert(items).select();
    if (error) throw error;
    return data;
  }
};

// ===== CONFIGURACION =====
export const configuracionApi = {
  list: async () => {
    const { data, error } = await supabase.from('configuracion').select('*');
    if (error) throw error;
    return data || [];
  },
  upsert: async (clave, valor) => {
    const { data: existing } = await supabase.from('configuracion').select('id').eq('clave', clave).single();
    if (existing) {
      const { data, error } = await supabase.from('configuracion').update({ valor }).eq('clave', clave).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('configuracion').insert({ clave, valor }).select().single();
      if (error) throw error;
      return data;
    }
  },
  create: async (config) => {
    const { data, error } = await supabase.from('configuracion').insert(config).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('configuracion').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
};

// ===== COMUNICADOS =====
export const comunicadosApi = {
  list: async () => {
    const { data, error } = await supabase
      .from('comunicados')
      .select('*')
      .order('orden', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  create: async (com) => {
    const { data, error } = await supabase.from('comunicados').insert(com).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from('comunicados').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('comunicados').delete().eq('id', id);
    if (error) throw error;
  }
};

// ===== EMAIL (via Supabase Edge Function) =====
export const sendEmail = async ({ to, subject, body }) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, body }
  });
  if (error) throw error;
  return data;
};

// ===== UPLOAD FILE (via Supabase Storage) =====
export const uploadFile = async (file) => {
  const fileName = Date.now() + '-' + file.name;
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, file, { contentType: file.type });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_url: publicUrl };
};

// ===== INVITAR USUARIO (via Supabase Admin - requiere service role) =====
export const inviteUserByEmail = async ({ email, tienda_id, tienda_nombre, nombre, rol = 'tienda' }) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      data: { nombre, rol, tienda_id, tienda_nombre }
    }
  });
  if (error) throw error;
  return data;
};
