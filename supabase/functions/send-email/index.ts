import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import * as ExcelJS from 'https://esm.sh/exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { to, subject, tienda_nombre, numero_pedido, fecha, observaciones, lineas, todos_productos, es_palet, html_override,
            es_devolucion, devolucion_items, observaciones_devolucion, test_mode } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: 'Campo "to" es obligatorio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

    // ── Rama: email de DEVOLUCIÓN (completamente independiente del pedido) ──
    if (es_devolucion && devolucion_items) {
      console.log('[DEVOLUCION] Generando Excel — líneas:', (devolucion_items || []).length);
      let excelBase64: string | null = null;

      try {
        const wb  = new ExcelJS.Workbook();
        const ws  = wb.addWorksheet('Devolución');
        const fechaStr = new Date().toLocaleDateString('es-ES');

        // Cabecera de documento
        ws.mergeCells('A1:D1');
        ws.getCell('A1').value = 'HOJA DE DEVOLUCIÓN — SELOGAS';
        ws.getCell('A1').font  = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
        ws.getCell('A1').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00913F' } };
        ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 24;

        ws.mergeCells('A2:D2');
        ws.getCell('A2').value     = `Tienda: ${tienda_nombre || ''}   |   Fecha: ${fechaStr}`;
        ws.getCell('A2').font      = { size: 10 };
        ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getRow(2).height = 18;

        if (observaciones_devolucion) {
          ws.mergeCells('A3:D3');
          ws.getCell('A3').value     = `Observaciones: ${observaciones_devolucion}`;
          ws.getCell('A3').font      = { size: 9, italic: true, color: { argb: 'FF555555' } };
          ws.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
          ws.getRow(3).height = 14;
        }

        const headerRow = observaciones_devolucion ? 5 : 4;

        // Cabecera de tabla
        const hRow = ws.getRow(headerRow);
        hRow.values = ['', 'REF.', 'DESCRIPCIÓN', 'UDS.', 'OBSERVACIONES'];
        hRow.eachCell((cell, col) => {
          if (col < 2) return;
          cell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3D2B' } };
          cell.alignment = { horizontal: col === 4 ? 'center' : 'left', vertical: 'middle' };
          cell.border    = { bottom: { style: 'thin', color: { argb: 'FF00913F' } } };
        });
        hRow.height = 18;

        // Filas de datos
        (devolucion_items || []).forEach((item: any, idx: number) => {
          const row = ws.getRow(headerRow + 1 + idx);
          row.values = ['', item.producto_codigo || '', item.producto_nombre || '', item.cantidad || 1, item.observaciones || ''];
          row.eachCell((cell, col) => {
            if (col < 2) return;
            cell.font      = { size: 9 };
            cell.alignment = { horizontal: col === 4 ? 'center' : 'left', vertical: 'middle' };
            cell.border    = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
            if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF8' } };
          });
          row.height = 15;
        });

        // Anchos de columna
        ws.columns = [
          { width: 2 },   // margen
          { width: 14 },  // REF
          { width: 42 },  // DESCRIPCIÓN
          { width: 8 },   // UDS
          { width: 28 },  // OBSERVACIONES
        ];

        const buf = await wb.xlsx.writeBuffer() as ArrayBuffer;
        const bytes = new Uint8Array(buf);
        excelBase64 = uint8ArrayToBase64(bytes);
        console.log('[DEVOLUCION] Excel generado OK — tamaño bytes:', bytes.length);
      } catch (excelErr) {
        // El fallo en Excel NO bloquea el envío del email de devolución
        console.error('[DEVOLUCION] Error generando Excel:', (excelErr as Error).message);
      }

      const fechaStr2 = new Date().toLocaleDateString('es-ES');
      const prefijo   = test_mode ? '[TEST] ' : '';
      const htmlDev   =
        `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">` +
        `<div style="background:#00913f;color:white;padding:20px;border-radius:8px 8px 0 0;">` +
        `<h1 style="margin:0;">Hoja de Devolución${test_mode ? ' <span style="background:#f59e0b;color:#000;padding:2px 8px;border-radius:4px;font-size:14px;">TEST</span>' : ''}</h1>` +
        `<p style="margin:5px 0 0;opacity:0.85;">${tienda_nombre || ''} — ${fechaStr2}</p>` +
        `</div><div style="background:#f8f9fa;padding:20px;border:1px solid #dee2e6;border-radius:0 0 8px 8px;">` +
        `<table style="width:100%;border-collapse:collapse;">` +
        `<thead><tr style="background:#1a3d2b;color:white;">` +
        `<th style="padding:8px;text-align:left;font-size:12px;">REF.</th>` +
        `<th style="padding:8px;text-align:left;font-size:12px;">DESCRIPCIÓN</th>` +
        `<th style="padding:8px;text-align:center;font-size:12px;">UDS.</th>` +
        `<th style="padding:8px;text-align:left;font-size:12px;">OBSERVACIONES</th>` +
        `</tr></thead><tbody>` +
        (devolucion_items || []).map((it: any, i: number) =>
          `<tr style="background:${i%2===0?'#fff':'#f7faf8'};">` +
          `<td style="padding:6px 8px;font-family:monospace;font-size:11px;border-bottom:1px solid #eee;">${it.producto_codigo||''}</td>` +
          `<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;">${it.producto_nombre||''}</td>` +
          `<td style="padding:6px 8px;text-align:center;font-weight:bold;font-size:12px;border-bottom:1px solid #eee;">${it.cantidad||1}</td>` +
          `<td style="padding:6px 8px;font-size:11px;color:#666;border-bottom:1px solid #eee;">${it.observaciones||''}</td>` +
          `</tr>`
        ).join('') +
        `</tbody></table>` +
        (observaciones_devolucion ? `<p style="margin-top:12px;font-size:12px;color:#555;"><strong>Observaciones:</strong> ${observaciones_devolucion}</p>` : '') +
        `<p style="margin-top:16px;color:#888;font-size:11px;">Hoja de devolución adjunta en Excel.</p>` +
        `</div></div>`;

      const attachments: any[] = [];
      if (excelBase64) {
        attachments.push({
          filename: `devolucion_${(tienda_nombre||'selogas').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`,
          content:  excelBase64,
        });
      }

      const rResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:        'SELOGAS Pedidos <pedidos@megino.com>',
          to:          [to],
          subject:     body.subject || `${prefijo}Devolución — ${tienda_nombre||''} — ${fechaStr2}`,
          html:        htmlDev,
          attachments,
        }),
      });
      const rData = await rResp.json();
      if (!rResp.ok) throw new Error('[DEVOLUCION] Resend error: ' + JSON.stringify(rData));
      console.log('[DEVOLUCION] Email enviado OK — id:', rData.id);
      return new Response(JSON.stringify({ success: true, emailId: rData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Email palet sin PDF
    if (es_palet && html_override) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'SELOGAS Pedidos <pedidos@megino.com>', to: [to], subject: subject || 'Solicitud de Palet - SELOGAS', html: html_override }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error('Resend palet error: ' + JSON.stringify(d));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mapa pedido: codigo -> cantidad
    const pedidoMap: Record<string, number> = {};
    for (const l of (lineas || [])) {
      const key = (l.producto_codigo || '').toString().trim();
      if (key) pedidoMap[key] = l.cantidad;
    }

    const fechaStr = fecha ? new Date(fecha).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');

    // Agrupar por hoja -> 3 columnas
    // columna_excel: 1=izq, 2=centro, 3=dcha, 0=izq por defecto
    type Prod = Record<string, any>;
    const hojaMap: Record<string, { minOrden: number, cols: [Prod[], Prod[], Prod[]] }> = {};

    for (const p of (todos_productos || [])) {
      const hoja = ((p.hoja_excel || '').toString().trim()) || 'GENERAL';
      const col = parseInt(p.columna_excel) || 0;
      const orden = parseInt(p.orden_excel) || 0;
      const colIdx = col >= 1 && col <= 3 ? col - 1 : 0;

      if (!hojaMap[hoja]) hojaMap[hoja] = { minOrden: orden, cols: [[], [], []] };
      else if (orden < hojaMap[hoja].minOrden) hojaMap[hoja].minOrden = orden;

      hojaMap[hoja].cols[colIdx].push({ ...p, orden });
    }

    for (const h of Object.values(hojaMap))
      for (const col of h.cols)
        col.sort((a, b) => a.orden - b.orden);

    // Orden fijo de hojas igual que en el Excel original
    const ORDEN_HOJAS = [
      'BEBIDAS 1', 'BEBIDAS 2', 'HOJA 3', 'GOLOSINAS', 'CHOCOLATES Y GALLETAS',
      'SNACK', 'NUTRISPORT', 'VAPER', 'DROGUERIA', 'CONSUMIBLES',
      'CONGELADOS', 'PROMOCIONES y NOVEDADES', 'GENERAL'
    ];
    const hojas = [
      ...ORDEN_HOJAS.filter(h => hojaMap[h]),
      ...Object.keys(hojaMap).filter(h => !ORDEN_HOJAS.includes(h)).sort()
    ];

    // PDF config
    const pdfDoc = await PDFDocument.create();
    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PW = 841.89; const PH = 595.28;
    const mg = 20;
    const gapCols = 6;
    const totalW = PW - mg * 2;
    const colW = (totalW - gapCols * 2) / 3;
    const cCod = 52;
    const cPed = 24;
    const cNom = colW - cCod - cPed;
    const rH = 11;
    const hH = 13;

    let page: any = null;
    let y = 0;
    let pageNum = 0;

    const newPage = () => {
      pageNum++;
      page = pdfDoc.addPage([PW, PH]);
      y = PH - mg;
      page.drawText('SELOGAS - HOJA DE PEDIDO', { x: mg, y, size: 9, font: fontBold, color: rgb(0,0,0) });
      page.drawText('Tienda: ' + (tienda_nombre || ''), { x: mg + 195, y, size: 8, font, color: rgb(0,0,0) });
      page.drawText('Fecha: ' + fechaStr, { x: PW - mg - 88, y, size: 8, font, color: rgb(0,0,0) });
      y -= 10;
      page.drawText('Pedido: ' + (numero_pedido || ''), { x: mg, y, size: 7, font, color: rgb(0.45,0.45,0.45) });
      page.drawText('Pag. ' + pageNum, { x: PW - mg - 22, y, size: 7, font, color: rgb(0.45,0.45,0.45) });
      y -= 4;
      page.drawLine({ start: {x: mg, y}, end: {x: PW - mg, y}, thickness: 0.5, color: rgb(0,0,0) });
      y -= 7;
    };

    const ensure = (n: number) => { if (!page || y < mg + n) newPage(); };
    const xC = (c: number) => mg + c * (colW + gapCols);

    const drawColHeaders = () => {
      for (let c = 0; c < 3; c++) {
        const x = xC(c);
        page.drawRectangle({ x, y: y - rH, width: colW, height: rH, color: rgb(0.80, 0.80, 0.80) });
        page.drawText('CODIGO',   { x: x + 2,               y: y - rH + 2.5, size: 6, font: fontBold, color: rgb(0,0,0) });
        page.drawText('ARTICULO', { x: x + cCod + 2,        y: y - rH + 2.5, size: 6, font: fontBold, color: rgb(0,0,0) });
        page.drawText('PED',      { x: x + cCod + cNom + 2, y: y - rH + 2.5, size: 6, font: fontBold, color: rgb(0,0,0) });
      }
      y -= rH;
    };

    const drawProd = (prod: Prod | undefined, c: number) => {
      const x = xC(c);
      const ry = y - rH;
      page.drawLine({ start: {x, y: ry}, end: {x: x + colW, y: ry}, thickness: 0.15, color: rgb(0.78,0.78,0.78) });
      if (!prod) return;
      const codigoKey = (prod.codigo || prod.referencia || '').toString().trim();
      const qty = codigoKey ? (pedidoMap[codigoKey] || 0) : 0;
      if (qty > 0) page.drawRectangle({ x, y: ry, width: colW, height: rH, color: rgb(0.68, 0.92, 0.68) });
      page.drawLine({ start: {x: x+cCod, y: ry},        end: {x: x+cCod,       y: ry+rH}, thickness: 0.15, color: rgb(0.78,0.78,0.78) });
      page.drawLine({ start: {x: x+cCod+cNom, y: ry},   end: {x: x+cCod+cNom,  y: ry+rH}, thickness: 0.15, color: rgb(0.78,0.78,0.78) });
      page.drawText(codigoKey.substring(0, 10),           { x: x + 1.5,             y: ry + 2.5, size: 7,                font,            color: rgb(0,0,0) });
      page.drawText((prod.nombre||'').substring(0, 33),   { x: x + cCod + 1.5,      y: ry + 2.5, size: qty > 0 ? 7 : 6.5, font: qty > 0 ? fontBold : font, color: rgb(0,0,0) });
      if (qty > 0) page.drawText(qty.toString(),          { x: x + cCod + cNom + 2, y: ry + 2.5, size: 7.5, font: fontBold, color: rgb(0,0.38,0) });
    };

    newPage();

    for (const hojaKey of hojas) {
      const { cols } = hojaMap[hojaKey];
      const maxRows = Math.max(cols[0].length, cols[1].length, cols[2].length);
      if (maxRows === 0) continue;

      // Altura total de esta categoría: título + cabecera + filas + margen inferior
      const categoriaH = hH + 1 + rH + maxRows * rH + 6;
      // Si no cabe entera en el espacio restante, forzar nueva página antes de empezar
      if (page && y - mg < categoriaH) newPage();
      else ensure(hH + rH * 3);
      page.drawRectangle({ x: mg, y: y - hH, width: totalW, height: hH, color: rgb(1, 0.92, 0) });
      page.drawText(hojaKey, { x: mg + 5, y: y - hH + 3.5, size: 8.5, font: fontBold, color: rgb(0,0,0) });
      y -= hH + 1;
      drawColHeaders();

      const secActual: [string, string, string] = ['', '', ''];

      for (let row = 0; row < maxRows; row++) {
        ensure(rH + 1);

        // Detectar cambio de sección por columna independientemente
        const secFila: [string, string, string] = [
          ((cols[0][row]?.seccion_excel) || '').toString().trim(),
          ((cols[1][row]?.seccion_excel) || '').toString().trim(),
          ((cols[2][row]?.seccion_excel) || '').toString().trim(),
        ];

        const cambio0 = secFila[0] && secFila[0] !== secActual[0];
        const cambio1 = secFila[1] && secFila[1] !== secActual[1];
        const cambio2 = secFila[2] && secFila[2] !== secActual[2];

        if (cambio0) secActual[0] = secFila[0];
        if (cambio1) secActual[1] = secFila[1];
        if (cambio2) secActual[2] = secFila[2];

        if (cambio0 || cambio1 || cambio2) {
          const secH = 11;
          ensure(secH + rH);
          // Dibujar cabecera solo en las columnas que cambian
          for (let c = 0; c < 3; c++) {
            if (![cambio0, cambio1, cambio2][c]) continue;
            const x = xC(c);
            const txt = secFila[c];
            page.drawRectangle({ x, y: y - secH, width: colW, height: secH, color: rgb(1, 0.95, 0.2) });
            const tw = fontBold.widthOfTextAtSize(txt, 7);
            const tx = x + Math.max(2, (colW - tw) / 2);
            page.drawText(txt, { x: tx, y: y - secH + 2.5, size: 7, font: fontBold, color: rgb(0,0,0) });
          }
          y -= secH;
        }

        drawProd(cols[0][row], 0);
        drawProd(cols[1][row], 1);
        drawProd(cols[2][row], 2);
        y -= rH;
      }
      y -= 6;
    }

    // Pagina resumen
    if (lineas && lineas.length > 0) {
      newPage();
      page.drawText('RESUMEN DEL PEDIDO - ' + (tienda_nombre||'') + ' - ' + fechaStr, { x: mg, y, size: 9, font: fontBold, color: rgb(0,0,0.55) });
      y -= 14;
      page.drawLine({ start: {x: mg, y}, end: {x: PW-mg, y}, thickness: 0.5, color: rgb(0,0,0) });
      y -= 9;
      for (const l of lineas) {
        ensure(11);
        page.drawText((l.producto_codigo||'').toString().substring(0,12), { x: mg,     y, size: 7.5, font,           color: rgb(0,0,0) });
        page.drawText((l.producto_nombre||'').substring(0,60),            { x: mg+85,  y, size: 7.5, font,           color: rgb(0,0,0) });
        page.drawText(l.cantidad.toString(),                               { x: mg+510, y, size: 8,   font: fontBold, color: rgb(0,0.38,0) });
        y -= 11;
      }
    }

    const pdfBase64 = uint8ArrayToBase64(await pdfDoc.save());

    const linesHtml = (lineas||[]).map((l: any) =>
      '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px;">'+(l.producto_codigo||'')+'</td>'+
      '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;">'+(l.producto_nombre||'')+'</td>'+
      '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:#166534;">'+l.cantidad+'</td></tr>'
    ).join('');

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:750px;margin:0 auto;">'+
      '<div style="background:#00913f;color:white;padding:20px;border-radius:8px 8px 0 0;">'+
      '<h1 style="margin:0;">Nuevo Pedido SELOGAS</h1>'+
      '<p style="margin:5px 0 0;opacity:0.85;">'+(tienda_nombre||'')+' - '+fechaStr+'</p>'+
      '</div><div style="background:#f8f9fa;padding:20px;border:1px solid #dee2e6;border-radius:0 0 8px 8px;">'+
      '<p><strong>Pedido:</strong> '+(numero_pedido||'')+'</p>'+
      (observaciones ? '<p><strong>Observaciones:</strong> '+observaciones+'</p>' : '')+
      '<h3>Productos pedidos ('+(lineas||[]).length+'):</h3>'+
      '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#00913f;color:white;">'+
      '<th style="padding:8px;text-align:left;">Codigo</th><th style="padding:8px;text-align:left;">Articulo</th><th style="padding:8px;text-align:center;">Cantidad</th>'+
      '</tr></thead><tbody>'+linesHtml+'</tbody></table>'+
      '<p style="margin-top:20px;color:#666;font-size:12px;">Hoja de pedido completa adjunta en PDF.</p>'+
      '</div></div>';

    const rResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SELOGAS Pedidos <pedidos@megino.com>',
        to: [to],
        subject: subject || ('Nuevo pedido - '+(tienda_nombre||'')+' - '+fechaStr),
        html: htmlBody,
        attachments: [{ filename: 'pedido_'+(numero_pedido||'selogas')+'.pdf', content: pdfBase64 }],
      }),
    });
    const rData = await rResp.json();
    if (!rResp.ok) throw new Error('Resend error: ' + JSON.stringify(rData));

    return new Response(JSON.stringify({ success: true, emailId: rData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-email error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
