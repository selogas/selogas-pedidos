import { supabase } from '../lib/supabase';

// ===== PRODUCTOS =====
export const productosApi = {
  list: async (orderBy = 'orden_excel', limit = 1000) => {
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
    const { data, error } = await supabase.from('productos').insert(items).select();
    if (error) throw error;
    return data;
  }
};

// ===== TIENDAS =====
export const tiendasApi = {
  list: async (orderBy = 'nombre', limit = 200) => {
    const { data, error } = await supabase.from('tiendas').select('*').order(orderBy).limit(limit);
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

// ===== PEDIDOS =====
export const pedidosApi = {
  list: async (orderBy = '-fecha_pedido', limit = 200) => {
    const isDesc = orderBy.startsWith('-');
    const col = isDesc ? orderBy.slice(1) : orderBy;
    const { data, error } = await supabase.from('pedidos').select('*').order(col, { ascending: !isDesc }).limit(limit);
    if (error) throw error;
    return data || [];
  },
  filter: async (filters, orderBy = '-fecha_pedido', limit = 100) => {
    const isDesc = orderBy.startsWith('-');
    const col = isDesc ? orderBy.slice(1) : orderBy;
    let query = supabase.from('pedidos').select('*').order(col, { ascending: !isDesc }).limit(limit);
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

// ===== PEDIDO LINEAS =====
export const pedidoLineasApi = {
  filter: async (filters, orderBy = 'orden_excel', limit = 500) => {
    let query = supabase.from('pedido_lineas').select('*').order(orderBy, { ascending: true }).limit(limit);
    Object.entries(filters).forEach(([key, val]) => { query = query.eq(key, val); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  bulkCreate: async (items) => {
    const { data, error } = await supabase.from('pedido_lineas').insert(items).select();
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
  filter: async (filters) => {
    let query = supabase.from('configuracion').select('*');
    Object.entries(filters).forEach(([key, val]) => { query = query.eq(key, val); });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
  list: async (orderBy = 'orden', limit = 100) => {
    const { data, error } = await supabase.from('comunicados').select('*').order(orderBy, { ascending: true }).limit(limit);
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