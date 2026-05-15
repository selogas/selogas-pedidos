/**
 * ejecutar-caducidades
 * Replica la lógica de caducidades.py:
 *  1. Refresca el access_token con el refresh_token guardado en secrets
 *  2. Busca en Gmail adjuntos Excel de los últimos 7 días
 *  3. Procesa cada Excel y crea/actualiza eventos en Google Calendar
 *  4. Formatea eventos manuales y limpia duplicados
 * Solo accesible para admin (verificado via JWT + perfil en BD).
 */

import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Mapa calendarios ────────────────────────────────────────────────────────
const calendarMap: Record<string, { id: string }> = {
  tormo:            { id: "atalaya365megino@gmail.com" },
  atalayuela:       { id: "atalayuelamegino@gmail.com" },
  nassica:          { id: "bpnassica365@gmail.com" },
  corvo:            { id: "bpriocorvo365@gmail.com" },
  cepsasanfernando: { id: "cepsasanfernando0@gmail.com" },
  sanfer:           { id: "bpsanfernando365@gmail.com" },
  cabanillas:       { id: "empleadoscabanillas@gmail.com" },
  europa:           { id: "areaeuropa81@gmail.com" },
  guadalcanal:      { id: "guadalcanal365@gmail.com" },
  lagavia:          { id: "lagavia.megino@gmail.com" },
  laguna:           { id: "lagunamegino532@gmail.com" },
  polvoranca:       { id: "polvorancamegino247@gmail.com" },
  arenas:           { id: "cepsalasarenas@gmail.com" },
  mayorazgo:        { id: "bpmayorazgo@gmail.com" },
  urtinsa:          { id: "urtinsamegino@gmail.com" },
  portillo:         { id: "portillorepsol@gmail.com" },
  pozuelo:          { id: "pozuelomegino26@gmail.com" },
  pinto:            { id: "expendedoresrepsol@gmail.com" },
  sanpedro:         { id: "sanpedromegino@gmail.com" },
  shellatalayuela:  { id: "atalayuelashell@gmail.com" },
  taraza:           { id: "tarazamegino@gmail.com" },
  puentearce:       { id: "puentearcemegino@gmail.com" },
  elalamo:          { id: "alamodualez@gmail.com" },
  altocampo:        { id: "altocampo365@gmail.com" },
  selogas:          { id: "selogascaducidades@gmail.com" },
  trigorico:        { id: "selogascaducidades@gmail.com" },
  impulso:          { id: "selogascaducidades@gmail.com" },
  qualianza:        { id: "selogascaducidades@gmail.com" },
  saexma:           { id: "selogascaducidades@gmail.com" },
  centro:           { id: "meginoslbpcentro@gmail.com" },
};

const aliasMap: Record<string, string> = {
  riocorvo: "corvo", lasarenas: "arenas", cepsasanfer: "cepsasanfernando",
  ricardotormo: "tormo", atalaya: "tormo", bpsanfernando: "sanfer",
  sanfernando: "sanfer", sanpeter: "sanpedro",
  tormoi: "tormo", tormoii: "tormo", tormo1: "tormo", tormo2: "tormo",
  atalayuelai: "atalayuela", atalayuelaii: "atalayuela",
  nassicai: "nassica", nassicaii: "nassica",
  corvoi: "corvo", corvoii: "corvo",
  sanferi: "sanfer", sanferii: "sanfer",
  cabanillasi: "cabanillas", cabanillasii: "cabanillas",
  europai: "europa", europaii: "europa",
  guadalcanali: "guadalcanal", guadalcanalii: "guadalcanal",
  lagaviai: "lagavia", lagaviaii: "lagavia",
  lagunai: "laguna", lagunaii: "laguna",
  polvorancai: "polvoranca", polvorancaii: "polvoranca",
  arenasi: "arenas", arenasii: "arenas",
  mayorazgoi: "mayorazgo", mayorazgoii: "mayorazgo",
  urtinsai: "urtinsa", urtinsaii: "urtinsa",
  portilloi: "portillo", portilloii: "portillo",
  pozueloi: "pozuelo", pozueloii: "pozuelo",
  pintoi: "pinto", pintoii: "pinto",
  sanpedroi: "sanpedro", sanpedroii: "sanpedro",
  shellatalayuelai: "shellatalayuela", shellatalayuelaii: "shellatalayuela",
  tarazai: "taraza", tarazaii: "taraza",
  alamo: "elalamo", centroi: "centro", centroii: "centro",
};

const CATALOGO_URL = "https://docs.google.com/spreadsheets/d/1L-8hN_jb2ranxU8Z_Pq3P8zmOQmEnXabxHMc7SLK4Yc/edit?gid=2143597533#gid=2143597533";
const COL_CODIGO    = 1; // B
const COL_PRODUCTO  = 3; // D
const COL_CADUCIDAD = 6; // G

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizaProducto(texto: string): string {
  let t = (texto || "").toString().toUpperCase();
  t = t.replace(/[ÁÀÂÄ]/g, "A").replace(/[ÉÈÊË]/g, "E")
       .replace(/[ÍÌÎÏ]/g, "I").replace(/[ÓÒÔÖ]/g, "O")
       .replace(/[ÚÙÛÜ]/g, "U").replace(/[^A-Z0-9 ]/g, "")
       .replace(/\s{2,}/g, " ").trim();
  return t;
}

function canonProducto(texto: string): string {
  let t = normalizaProducto(texto);
  t = t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/\s+(CL|L)\b/g, " $1").replace(/\s{2,}/g, " ").trim();
  return t;
}

function limpiarCodigo(val: any): string {
  if (val === null || val === undefined) return "";
  return val.toString().trim().replace(/\.0$/, "");
}

function detectarClavePorNombre(nombre: string): string | null {
  const base = nombre.toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[-_\s]+/g, "")
    .replace(/caducidades?/g, "")
    .replace(/\d{4,}/g, "")
    .trim();

  if (calendarMap[base]) return base;
  if (aliasMap[base] && calendarMap[aliasMap[base]]) return aliasMap[base];

  for (const [alias, canon] of Object.entries(aliasMap)) {
    if (base.includes(alias) && calendarMap[canon]) return canon;
  }
  for (const clave of Object.keys(calendarMap)) {
    if (base.includes(clave)) return clave;
  }
  return null;
}

function truncarFecha(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = val.toString().trim();
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function appendCatalogoLink(desc: string): string {
  if (desc.includes(CATALOGO_URL)) return desc;
  return desc + `\n\nCatálogo: ${CATALOGO_URL}`;
}

// ── Google OAuth ─────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId     = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("SECRETS_MISSING: Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en Supabase Edge Function secrets.");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) {
    throw new Error(`Error refrescando token Google: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ── Gmail API ────────────────────────────────────────────────────────────────

async function gmailSearch(token: string, query: string): Promise<any[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=200`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  return d.messages || [];
}

async function gmailGetMessage(token: string, msgId: string): Promise<any> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function gmailGetAttachment(token: string, msgId: string, attId: string): Promise<Uint8Array> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  const b64 = (d.data || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// ── Calendar API ─────────────────────────────────────────────────────────────

async function calListEventsOnDay(token: string, calId: string, fecha: string): Promise<any[]> {
  const tMin = `${fecha}T00:00:00Z`;
  const tMax = `${fecha}T23:59:59Z`;
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${tMin}&timeMax=${tMax}&singleEvents=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  return d.items || [];
}

async function calListEventsRange(token: string, calId: string, tMin: string, tMax: string, pageToken?: string): Promise<any> {
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${tMin}&timeMax=${tMax}&singleEvents=true&maxResults=2500`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function calCreateEvent(token: string, calId: string, fecha: string, title: string, description: string, codigo: string): Promise<void> {
  const body = {
    summary: title,
    description,
    start: { date: fecha },
    end:   { date: fecha },
    extendedProperties: { private: { codigo_producto: codigo } },
  };
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function calPatchEvent(token: string, calId: string, eventId: string, fields: Record<string, any>): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

async function calDeleteEvent(token: string, calId: string, eventId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Lógica principal ─────────────────────────────────────────────────────────

async function formatearManualesYLimpiarDuplicados(token: string, calId: string, logs: string[]): Promise<void> {
  const hoy    = new Date();
  const tMin   = new Date(hoy.getTime() - 400 * 86400000).toISOString();
  const tMax   = new Date(hoy.getTime() + 400 * 86400000).toISOString();

  let pageToken: string | undefined;
  const events: any[] = [];
  do {
    const res = await calListEventsRange(token, calId, tMin, tMax, pageToken);
    events.push(...(res.items || []));
    pageToken = res.nextPageToken;
  } while (pageToken);

  // Formatear manuales
  let formateados = 0;
  for (const e of events) {
    const title = (e.summary || "").trim();
    if (!title.startsWith("⚠️ Caduca:")) {
      const newTitle = `⚠️ Caduca: ${title || "(sin título)"}`;
      const newDesc  = appendCatalogoLink(e.description || "");
      await calPatchEvent(token, calId, e.id, { summary: newTitle, description: newDesc });
      formateados++;
    }
  }
  if (formateados) logs.push(`  ${calId}: ${formateados} eventos manuales formateados`);

  // Limpiar duplicados
  const buckets: Record<string, any[]> = {};
  for (const e of events) {
    const title = (e.summary || "").trim();
    if (!title.startsWith("⚠️ Caduca:")) continue;
    const day = (e.start?.date || (e.start?.dateTime || "").slice(0, 10));
    if (!day) continue;
    const key = `${day}||${title}`;
    (buckets[key] = buckets[key] || []).push(e);
  }
  let eliminados = 0;
  for (const arr of Object.values(buckets)) {
    for (const extra of arr.slice(1)) {
      await calDeleteEvent(token, calId, extra.id);
      eliminados++;
    }
  }
  if (eliminados) logs.push(`  ${calId}: ${eliminados} duplicados eliminados`);
}

async function procesarExcel(bytes: Uint8Array, nombre: string, clave: string, token: string, logs: string[]): Promise<void> {
  const cfg  = calendarMap[clave];
  const wb   = XLSX.read(bytes, { type: "array", cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const hoy    = new Date(); hoy.setHours(0, 0, 0, 0);
  const maxD   = new Date(hoy.getTime() + 365 * 86400000);

  let creados = 0, actualizados = 0;

  for (let i = 1; i < rows.length; i++) {
    const row      = rows[i];
    const codigo   = limpiarCodigo(row[COL_CODIGO]);
    const producto = row[COL_PRODUCTO];
    const cadRaw   = row[COL_CADUCIDAD];

    if (!producto || !cadRaw) continue;

    const prod  = canonProducto(String(producto));
    const fecha = truncarFecha(cadRaw);
    if (!fecha) continue;

    const fechaD = new Date(fecha + "T00:00:00");
    if (fechaD < hoy || fechaD > maxD) continue;

    const baseTitle = `⚠️ Caduca: ${prod}`;
    const desc      = appendCatalogoLink(`Producto: ${prod}`);
    const eventos   = await calListEventsOnDay(token, cfg.id, fecha);
    const mismos    = eventos.filter(e => (e.summary || "") === baseTitle);

    if (!mismos.length) {
      await calCreateEvent(token, cfg.id, fecha, baseTitle, desc, codigo);
      creados++;
    } else {
      await calPatchEvent(token, cfg.id, mismos[0].id, {
        description: desc,
        extendedProperties: { private: { codigo_producto: codigo } },
      });
      for (const extra of mismos.slice(1)) await calDeleteEvent(token, cfg.id, extra.id);
      actualizados++;
    }
  }
  logs.push(`  ${nombre} → ${clave}: +${creados} creados, ~${actualizados} actualizados`);
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verificar que es admin via JWT
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: supabaseKey },
    });
    const userData = await userRes.json();
    if (!userData?.id) throw new Error("No autenticado");

    // Verificar rol admin en tabla perfiles
    const perfilRes = await fetch(
      `${supabaseUrl}/rest/v1/perfiles?id=eq.${userData.id}&select=rol,tiendas(nombre)`,
      { headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey } }
    );
    const perfiles = await perfilRes.json();
    const perfil   = perfiles?.[0];
    const esAdmin  = perfil?.rol === "admin" || perfil?.tiendas?.nombre === "PRINCIPAL";
    if (!esAdmin) throw new Error("Sin permisos de administrador");

    // Obtener access token Google
    const gToken = await getAccessToken();
    const logs: string[] = ["== INICIO =="];

    // 1. Formatear manuales y limpiar duplicados en todos los calendarios
    logs.push("-- Formateando manuales y limpiando duplicados --");
    const calIds = [...new Set(Object.values(calendarMap).map(c => c.id))];
    for (const calId of calIds) {
      try {
        await formatearManualesYLimpiarDuplicados(gToken, calId, logs);
      } catch (e: any) {
        logs.push(`  ! Error en ${calId}: ${e.message}`);
      }
    }

    // 2. Escanear Gmail
    logs.push("-- Escaneando Gmail --");
    const QUERY = "in:inbox has:attachment (filename:xlsx OR filename:xls OR filename:xlsm) newer_than:7d";
    const mensajes = await gmailSearch(gToken, QUERY);
    logs.push(`Mensajes encontrados: ${mensajes.length}`);

    for (const m of mensajes) {
      const full  = await gmailGetMessage(gToken, m.id);
      const parts: any[] = [];
      const pila  = [...(full?.payload?.parts || [])];
      while (pila.length) {
        const p = pila.pop();
        if (p.parts) pila.push(...p.parts);
        parts.push(p);
      }

      for (const p of parts) {
        const filename = p.filename || "";
        const attId    = p.body?.attachmentId;
        if (!filename || !attId) continue;
        if (!/\.xls(x|m)?$/i.test(filename)) continue;

        const clave = detectarClavePorNombre(filename);
        if (!clave || !calendarMap[clave]) {
          logs.push(`  - Ignorado (sin clave): ${filename}`);
          continue;
        }

        try {
          const bytes = await gmailGetAttachment(gToken, full.id, attId);
          await procesarExcel(bytes, filename, clave, gToken, logs);
        } catch (e: any) {
          logs.push(`  ! Error con ${filename}: ${e.message}`);
        }
      }
    }

    logs.push("== FIN ==");

    return new Response(JSON.stringify({ ok: true, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
