import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const calendarMap: Record<string, { id: string }> = {
  tormo:{id:"atalaya365megino@gmail.com"},atalayuela:{id:"atalayuelamegino@gmail.com"},
  nassica:{id:"bpnassica365@gmail.com"},corvo:{id:"bpriocorvo365@gmail.com"},
  cepsasanfernando:{id:"cepsasanfernando0@gmail.com"},sanfer:{id:"bpsanfernando365@gmail.com"},
  cabanillas:{id:"empleadoscabanillas@gmail.com"},europa:{id:"areaeuropa81@gmail.com"},
  guadalcanal:{id:"guadalcanal365@gmail.com"},lagavia:{id:"lagavia.megino@gmail.com"},
  laguna:{id:"lagunamegino532@gmail.com"},polvoranca:{id:"polvorancamegino247@gmail.com"},
  arenas:{id:"cepsalasarenas@gmail.com"},mayorazgo:{id:"bpmayorazgo@gmail.com"},
  urtinsa:{id:"urtinsamegino@gmail.com"},portillo:{id:"portillorepsol@gmail.com"},
  pozuelo:{id:"pozuelomegino26@gmail.com"},pinto:{id:"expendedoresrepsol@gmail.com"},
  sanpedro:{id:"sanpedromegino@gmail.com"},shellatalayuela:{id:"atalayuelashell@gmail.com"},
  taraza:{id:"tarazamegino@gmail.com"},puentearce:{id:"puentearcemegino@gmail.com"},
  elalamo:{id:"alamodualez@gmail.com"},altocampo:{id:"altocampo365@gmail.com"},
  selogas:{id:"selogascaducidades@gmail.com"},trigorico:{id:"selogascaducidades@gmail.com"},
  impulso:{id:"selogascaducidades@gmail.com"},qualianza:{id:"selogascaducidades@gmail.com"},
  saexma:{id:"selogascaducidades@gmail.com"},centro:{id:"meginoslbpcentro@gmail.com"},
};

const aliasMap: Record<string,string> = {
  riocorvo:"corvo",lasarenas:"arenas",cepsasanfer:"cepsasanfernando",ricardotormo:"tormo",
  atalaya:"tormo",bpsanfernando:"sanfer",sanfernando:"sanfer",sanpeter:"sanpedro",
  tormoi:"tormo",tormoii:"tormo",tormo1:"tormo",tormo2:"tormo",
  atalayuelai:"atalayuela",atalayuelaii:"atalayuela",nassicai:"nassica",nassicaii:"nassica",
  corvoi:"corvo",corvoii:"corvo",sanferi:"sanfer",sanferii:"sanfer",
  cabanillasi:"cabanillas",cabanillasii:"cabanillas",europai:"europa",europaii:"europa",
  guadalcanali:"guadalcanal",guadalcanalii:"guadalcanal",lagaviai:"lagavia",lagaviaii:"lagavia",
  lagunai:"laguna",lagunaii:"laguna",polvorancai:"polvoranca",polvorancaii:"polvoranca",
  arenasi:"arenas",arenasii:"arenas",mayorazgoi:"mayorazgo",mayorazgoii:"mayorazgo",
  urtinsai:"urtinsa",urtinsaii:"urtinsa",portilloi:"portillo",portilloii:"portillo",
  pozueloi:"pozuelo",pozueloii:"pozuelo",pintoi:"pinto",pintoii:"pinto",
  sanpedroi:"sanpedro",sanpedroii:"sanpedro",shellatalayuelai:"shellatalayuela",
  shellatalayuelaii:"shellatalayuela",tarazai:"taraza",tarazaii:"taraza",
  alamo:"elalamo",centroi:"centro",centroii:"centro",
};

const CATALOGO_URL="https://docs.google.com/spreadsheets/d/1L-8hN_jb2ranxU8Z_Pq3P8zmOQmEnXabxHMc7SLK4Yc/edit?gid=2143597533#gid=2143597533";
const COL_CODIGO=1,COL_PRODUCTO=3,COL_CADUCIDAD=6;

function normalizaProducto(t:string):string{
  let s=(t||"").toString().toUpperCase();
  s=s.replace(/[ÁÀÂÄ]/g,"A").replace(/[ÉÈÊË]/g,"E").replace(/[ÍÌÎÏ]/g,"I")
     .replace(/[ÓÒÔÖ]/g,"O").replace(/[ÚÙÛÜ]/g,"U").replace(/[^A-Z0-9 ]/g,"")
     .replace(/\s{2,}/g," ").trim();
  return s;
}
function canonProducto(t:string):string{
  let s=normalizaProducto(t);
  return s.replace(/(\d)\.(\d)/g,"$1,$2").replace(/\s+(CL|L)\b/g," $1").replace(/\s{2,}/g," ").trim();
}
function limpiarCodigo(v:any):string{
  if(v==null)return"";return v.toString().trim().replace(/\.0$/,"");
}
function detectarClave(nombre:string):string|null{
  const base=nombre.toLowerCase().replace(/\.[^.]+$/,"").replace(/[-_\s]+/g,"")
    .replace(/caducidades?/g,"").replace(/\d{4,}/g,"").trim();
  if(calendarMap[base])return base;
  if(aliasMap[base]&&calendarMap[aliasMap[base]])return aliasMap[base];
  for(const[a,c]of Object.entries(aliasMap))if(base.includes(a)&&calendarMap[c])return c;
  for(const k of Object.keys(calendarMap))if(base.includes(k))return k;
  return null;
}
function truncarFecha(v:any):string|null{
  if(!v)return null;
  if(v instanceof Date){if(isNaN(v.getTime()))return null;return v.toISOString().slice(0,10);}
  if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400000));if(isNaN(d.getTime()))return null;return d.toISOString().slice(0,10);}
  const s=v.toString().trim();
  const m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){const y=m[3].length===2?"20"+m[3]:m[3];return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return`${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}
function appendLink(d:string):string{
  return d.includes(CATALOGO_URL)?d:d+"\n\nCatálogo: "+CATALOGO_URL;
}

async function getToken():Promise<string>{
  const ci=Deno.env.get("GOOGLE_CLIENT_ID"),cs=Deno.env.get("GOOGLE_CLIENT_SECRET"),rt=Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if(!ci||!cs||!rt)throw new Error("SECRETS_MISSING: faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN");
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:ci,client_secret:cs,refresh_token:rt,grant_type:"refresh_token"})});
  const d=await r.json();
  if(!r.ok||!d.access_token)throw new Error("Error token: "+JSON.stringify(d));
  return d.access_token;
}

async function gFetch(token:string,url:string,opts:any={}):Promise<any>{
  const r=await fetch(url,{...opts,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(opts.headers||{})}});
  if(r.status===204)return{};
  return r.json();
}

async function calRange(token:string,calId:string,tMin:string,tMax:string,pt?:string):Promise<any>{
  let url=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${tMin}&timeMax=${tMax}&singleEvents=true&maxResults=2500`;
  if(pt)url+=`&pageToken=${pt}`;
  return gFetch(token,url);
}

async function calAllEvents(token:string,calId:string,tMin:string,tMax:string):Promise<any[]>{
  const all:any[]=[];let pt:string|undefined;
  do{const r=await calRange(token,calId,tMin,tMax,pt);all.push(...(r.items||[]));pt=r.nextPageToken;}while(pt);
  return all;
}

async function calCreate(token:string,calId:string,fecha:string,title:string,desc:string,codigo:string):Promise<void>{
  await gFetch(token,`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    {method:"POST",body:JSON.stringify({summary:title,description:desc,start:{date:fecha},end:{date:fecha},extendedProperties:{private:{codigo_producto:codigo}}})});
}
async function calPatch(token:string,calId:string,evId:string,fields:any):Promise<void>{
  await gFetch(token,`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${evId}`,{method:"PATCH",body:JSON.stringify(fields)});
}
async function calDel(token:string,calId:string,evId:string):Promise<void>{
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${evId}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
}

// ── MODO listar ───────────────────────────────────────────────────────────────
async function modoListar(token:string){
  const r=await gFetch(token,`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent("in:inbox has:attachment (filename:xlsx OR filename:xls OR filename:xlsm) newer_than:7d")}&maxResults=200`);
  const mensajes=r.messages||[];
  const adjuntos:any[]=[];
  for(const m of mensajes){
    const full=await gFetch(token,`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`);
    const pila=[...(full?.payload?.parts||[])];
    while(pila.length){
      const p=pila.pop()!;if(p.parts)pila.push(...p.parts);
      const fn=p.filename||"",aid=p.body?.attachmentId;
      if(!fn||!aid||!/\.xls(x|m)?$/i.test(fn))continue;
      const clave=detectarClave(fn);
      adjuntos.push({msg_id:full.id,att_id:aid,filename:fn,clave});
    }
  }
  return{adjuntos};
}

// ── MODO formatear ────────────────────────────────────────────────────────────
async function modoFormatear(token:string){
  const calIds=[...new Set(Object.values(calendarMap).map(c=>c.id))];
  const logs:string[]=[];
  await Promise.allSettled(calIds.map(async calId=>{
    const hoy=new Date();
    const events=await calAllEvents(token,calId,new Date(hoy.getTime()-400*86400000).toISOString(),new Date(hoy.getTime()+400*86400000).toISOString());
    let f=0,e=0;
    for(const ev of events){
      const t=(ev.summary||"").trim();
      if(!t.startsWith("⚠️ Caduca:")){await calPatch(token,calId,ev.id,{summary:`⚠️ Caduca: ${t||"(sin título)"}`,description:appendLink(ev.description||"")});f++;}
    }
    const bk:Record<string,any[]>={};
    for(const ev of events){const t=(ev.summary||"").trim();if(!t.startsWith("⚠️ Caduca:"))continue;const d=ev.start?.date||(ev.start?.dateTime||"").slice(0,10);if(!d)continue;(bk[`${d}||${t}`]=bk[`${d}||${t}`]||[]).push(ev);}
    for(const arr of Object.values(bk))for(const ex of arr.slice(1)){await calDel(token,calId,ex.id);e++;}
    if(f||e)logs.push(`  ${calId}: ${f} formateados, ${e} eliminados`);
  }));
  return{logs};
}

// ── MODO procesar ─────────────────────────────────────────────────────────────
async function modoProcesar(token:string,msgId:string,attId:string,filename:string,clave:string){
  const cfg=calendarMap[clave];
  const ar=await gFetch(token,`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`);
  const b64=(ar.data||"").replace(/-/g,"+").replace(/_/g,"/");
  const bytes=Uint8Array.from(atob(b64),(c:string)=>c.charCodeAt(0));

  const wb=XLSX.read(bytes,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows:any[][]=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const maxD=new Date(hoy.getTime()+365*86400000);

  type Item={codigo:string;fecha:string;baseTitle:string;desc:string};
  const items:Item[]=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];
    const codigo=limpiarCodigo(row[COL_CODIGO]);
    const prod=row[COL_PRODUCTO];const cadRaw=row[COL_CADUCIDAD];
    if(!prod||!cadRaw)continue;
    const pn=canonProducto(String(prod));
    const fecha=truncarFecha(cadRaw);if(!fecha)continue;
    const fd=new Date(fecha+"T00:00:00");if(fd<hoy||fd>maxD)continue;
    items.push({codigo,fecha,baseTitle:`⚠️ Caduca: ${pn}`,desc:appendLink(`Producto: ${pn}`)});
  }
  if(!items.length)return{log:`  ${filename} → ${clave}: sin productos válidos`};

  const fechas=items.map(it=>it.fecha).sort();
  const events=await calAllEvents(token,cfg.id,fechas[0]+"T00:00:00Z",fechas[fechas.length-1]+"T23:59:59Z");
  const idx:Record<string,Record<string,any[]>>={};
  for(const e of events){const day=e.start?.date||(e.start?.dateTime||"").slice(0,10);const t=(e.summary||"").trim();if(!day||!t)continue;if(!idx[day])idx[day]={};(idx[day][t]=idx[day][t]||[]).push(e);}

  let cr=0,ac=0;
  for(let i=0;i<items.length;i+=10){
    await Promise.all(items.slice(i,i+10).map(async({codigo,fecha,baseTitle,desc}:Item)=>{
      const ms=idx[fecha]?.[baseTitle]||[];
      if(!ms.length){await calCreate(token,cfg.id,fecha,baseTitle,desc,codigo);cr++;}
      else{await calPatch(token,cfg.id,ms[0].id,{description:desc,extendedProperties:{private:{codigo_producto:codigo}}});for(const ex of ms.slice(1))await calDel(token,cfg.id,ex.id);ac++;}
    }));
  }
  return{log:`  ${filename} → ${clave}: +${cr} creados, ~${ac} actualizados`};
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const ok=(d:any)=>new Response(JSON.stringify(d),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  const fail=(m:string,s=400)=>new Response(JSON.stringify({ok:false,error:m}),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}});
  try{
    const authH=req.headers.get("Authorization")||"";
    const sbUrl=Deno.env.get("SUPABASE_URL")!;
    const sbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uRes=await fetch(`${sbUrl}/auth/v1/user`,{headers:{Authorization:authH,apikey:sbKey}});
    const uData=await uRes.json();
    if(!uData?.id)return fail("No autenticado",401);
    const pRes=await fetch(`${sbUrl}/rest/v1/perfiles?id=eq.${uData.id}&select=rol,tiendas(nombre)`,{headers:{Authorization:`Bearer ${sbKey}`,apikey:sbKey}});
    const perfil=(await pRes.json())?.[0];
    if(!(perfil?.rol==="admin"||perfil?.tiendas?.nombre==="PRINCIPAL"))return fail("Sin permisos",403);

    const body=await req.json().catch(()=>({}));
    const gToken=await getToken();

    if(body.modo==="listar")return ok({ok:true,...await modoListar(gToken)});
    if(body.modo==="formatear")return ok({ok:true,...await modoFormatear(gToken)});
    if(body.modo==="procesar"){
      const{msg_id,att_id,filename,clave}=body;
      if(!msg_id||!att_id||!filename||!clave)return fail("Faltan parámetros");
      if(!calendarMap[clave])return fail(`Clave desconocida: ${clave}`);
      return ok({ok:true,...await modoProcesar(gToken,msg_id,att_id,filename,clave)});
    }
    return fail("Modo desconocido");
  }catch(e:any){return fail(e.message);}
});
