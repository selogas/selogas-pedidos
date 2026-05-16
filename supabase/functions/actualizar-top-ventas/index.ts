// supabase/functions/actualizar-top-ventas/index.ts
//
// Edge Function de Supabase para recalcular el ranking de top ventas.
//
// Modos de invocación:
// 1. Cron programado (ej. cada 6 horas) — configurar en supabase/config.toml
// 2. HTTP POST desde el servidor después de enviar un pedido (requiere Authorization)
// 3. Trigger de base de datos a través de pg_net
//
// Variables de entorno requeridas (ya disponibles en Edge Functions):
// SUPABASE_URL              — URL del proyecto
// SUPABASE_SERVICE_ROLE_KEY — Service role key (acceso admin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOP_N = 15;
const DIAS_ATRAS = 90;

// Cabecera de cron de Supabase (invocación programada sin usuario)
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

Deno.serve(async (req) => {
  // Permitir invocaciones GET (cron) y POST (webhook tras pedido)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // ── Autenticación ──────────────────────────────────────────────────────────
  // Opción A: invocación cron con cabecera Authorization: Bearer <CRON_SECRET>
  // Opción B: invocación desde la app con token de usuario admin
  const authHeader = req.headers.get('Authorization') ?? '';
  let authorized = false;

  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) {
    // Llamada desde el cron del propio Supabase
    authorized = true;
  } else if (authHeader.startsWith('Bearer ')) {
    // Llamada desde la app: verificar que el usuario es admin
    try {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user?.id) {
        const { data: perfil } = await supabaseAdmin
          .from('perfiles')
          .select('rol, tiendas(nombre)')
          .eq('id', user.id)
          .single();
        if (perfil?.rol === 'admin' || (perfil?.tiendas as any)?.nombre === 'PRINCIPAL') {
          authorized = true;
        }
      }
    } catch { /* continúa sin autorización */ }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Opción A: usar la función SQL recalcular_top_ventas() ya definida
    const { error: sqlError } = await supabaseAdmin.rpc('recalcular_top_ventas');

    if (sqlError) {
      // Opción B: fallback — cálculo en TypeScript si la función SQL no existe
      console.warn('RPC recalcular_top_ventas falló, usando fallback TS:', sqlError.message);

      const desde = new Date();
      desde.setDate(desde.getDate() - DIAS_ATRAS);

      const { data: pedidos, error: errP } = await supabaseAdmin
        .from('pedidos')
        .select('id, tienda_id, fecha_pedido')
        .gte('fecha_pedido', desde.toISOString())
        .neq('estado', 'borrador');

      if (errP || !pedidos?.length) {
        return new Response(JSON.stringify({ ok: true, top: [], source: 'empty' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const mapPedidos = Object.fromEntries(pedidos.map((p) => [p.id, p]));
      const pedidoIds = pedidos.map((p) => p.id);

      let allItems: Array<{ producto_id: string; cantidad: number; pedido_id: string }> = [];
      const BATCH = 1000;
      for (let i = 0; i < pedidoIds.length; i += BATCH) {
        const { data: items } = await supabaseAdmin
          .from('pedido_items')
          .select('producto_id, cantidad, pedido_id')
          .in('pedido_id', pedidoIds.slice(i, i + BATCH));
        if (items?.length) allItems = allItems.concat(items as typeof allItems);
      }

      if (!allItems.length) {
        return new Response(JSON.stringify({ ok: true, top: [], source: 'no-items' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const mapa: Record<string, { unidades: number; tiendas: Set<string>; ultimaVenta: Date | null }> = {};
      for (const item of allItems) {
        if (!item.producto_id) continue;
        const ped = mapPedidos[item.pedido_id];
        if (!mapa[item.producto_id]) {
          mapa[item.producto_id] = { unidades: 0, tiendas: new Set(), ultimaVenta: null };
        }
        mapa[item.producto_id].unidades += (item.cantidad || 0);
        if (ped?.tienda_id) mapa[item.producto_id].tiendas.add(ped.tienda_id);
        if (ped?.fecha_pedido) {
          const f = new Date(ped.fecha_pedido);
          const actual = mapa[item.producto_id].ultimaVenta;
          if (!actual || f > actual) mapa[item.producto_id].ultimaVenta = f;
        }
      }

      const top = Object.entries(mapa)
        .sort(([, a], [, b]) => {
          if (b.unidades !== a.unidades) return b.unidades - a.unidades;
          if (b.tiendas.size !== a.tiendas.size) return b.tiendas.size - a.tiendas.size;
          return ((b.ultimaVenta?.getTime() ?? 0)) - ((a.ultimaVenta?.getTime() ?? 0));
        })
        .slice(0, TOP_N);

      // Borrar todo y reinsertar
      await supabaseAdmin.from('top_ventas_cache').delete().neq('rank', 0);

      const rows = top.map(([producto_id, data], idx) => ({
        producto_id,
        rank: idx + 1,
        unidades_total: data.unidades,
        tiendas_count: data.tiendas.size,
        ultima_venta: data.ultimaVenta?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabaseAdmin.from('top_ventas_cache').insert(rows);
      }

      return new Response(
        JSON.stringify({ ok: true, top: rows.map(r => r.producto_id), source: 'ts-fallback' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, source: 'sql-rpc', updated_at: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[actualizar-top-ventas] Error:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
