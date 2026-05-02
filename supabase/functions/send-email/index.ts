import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      to,
      subject,
      tienda_nombre,
      numero_pedido,
      fecha,
      observaciones,
      lineas,
      todos_productos,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

    const fechaStr = fecha ? new Date(fecha).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');

    const pedidoMap = {};
    if (lineas) {
      for (const l of lineas) {
        pedidoMap[l.producto_codigo || l.producto_nombre] = l.cantidad;
      }
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const margin = 25;
    const colW1 = 60, colW2 = 140, colW3 = 30;
    const colBlockWidth = colW1 + colW2 + colW3;
    const gap = 8;
    const numCols = 3;
    const totalW = numCols * colBlockWidth + (numCols - 1) * gap;
    const rowH = 10;

    const hojas = {};
    if (todos_productos && todos_productos.length > 0) {
      for (const p of todos_productos) {
        const h = p.hoja_excel || 'GENERAL';
        if (!hojas[h]) hojas[h] = [];
        hojas[h].push(p);
      }
    }

    let page = null;
    let y = 0;

    function newPage() {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page.drawText('SELOGAS - HOJA DE PEDIDO', { x: margin, y, size: 11, font: fontBold, color: rgb(0,0,0) });
      page.drawText('Tienda: ' + (tienda_nombre || ''), { x: margin + 220, y, size: 9, font, color: rgb(0,0,0) });
      page.drawText('Fecha: ' + fechaStr, { x: margin + 520, y, size: 9, font, color: rgb(0,0,0) });
      y -= 12;
      page.drawText('N Pedido: ' + (numero_pedido || ''), { x: margin, y, size: 8, font, color: rgb(0.4,0.4,0.4) });
      y -= 6;
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0,0,0) });
      y -= 8;
    }

    function ensureSpace(n) {
      if (!page || y < margin + n) newPage();
    }

    newPage();

    for (const hoja of Object.keys(hojas)) {
      const prods = hojas[hoja];
      ensureSpace(rowH * 3 + 10);

      page.drawRectangle({ x: margin, y: y - rowH, width: totalW, height: rowH, color: rgb(1,0.95,0) });
      page.drawText(hoja, { x: margin + 3, y: y - rowH + 3, size: 8, font: fontBold, color: rgb(0,0,0) });
      y -= rowH;

      for (let c = 0; c < numCols; c++) {
        const xb = margin + c * (colBlockWidth + gap);
        page.drawRectangle({ x: xb, y: y - rowH, width: colBlockWidth, height: rowH, color: rgb(0.85,0.85,0.85) });
        page.drawText('CODIGO', { x: xb + 2, y: y - rowH + 3, size: 6.5, font: fontBold, color: rgb(0,0,0) });
        page.drawText('ARTICULO', { x: xb + colW1 + 2, y: y - rowH + 3, size: 6.5, font: fontBold, color: rgb(0,0,0) });
        page.drawText('PED', { x: xb + colW1 + colW2 + 2, y: y - rowH + 3, size: 6.5, font: fontBold, color: rgb(0,0,0) });
      }
      y -= rowH;

      const perCol = Math.ceil(prods.length / 3);
      const cols = [prods.slice(0, perCol), prods.slice(perCol, perCol*2), prods.slice(perCol*2)];
      const maxRows = Math.max(cols[0].length, cols[1].length, cols[2].length);

      for (let row = 0; row < maxRows; row++) {
        ensureSpace(rowH + 2);
        const rowY = y - rowH;
        for (let c = 0; c < numCols; c++) {
          const prod = cols[c][row];
          if (!prod) continue;
          const xb = margin + c * (colBlockWidth + gap);
          const qty = pedidoMap[prod.codigo] || pedidoMap[prod.nombre] || 0;
          if (qty > 0) {
            page.drawRectangle({ x: xb, y: rowY, width: colBlockWidth, height: rowH, color: rgb(0.8,0.95,0.8) });
          }
          page.drawLine({ start: { x: xb, y: rowY }, end: { x: xb + colBlockWidth, y: rowY }, thickness: 0.2, color: rgb(0.7,0.7,0.7) });
          page.drawText((prod.codigo || prod.referencia || '').toString().substring(0,9), { x: xb+1, y: rowY+2.5, size: 6, font, color: rgb(0,0,0) });
          page.drawText((prod.nombre||'').substring(0,25), { x: xb+colW1+1, y: rowY+2.5, size: qty>0?6.5:6, font: qty>0?fontBold:font, color: rgb(0,0,0) });
          if (qty > 0) page.drawText(qty.toString(), { x: xb+colW1+colW2+3, y: rowY+2.5, size: 7, font: fontBold, color: rgb(0,0.5,0) });
        }
        y -= rowH;
      }
      y -= 4;
    }

    if (lineas && lineas.length > 0) {
      newPage();
      page.drawText('RESUMEN DEL PEDIDO - ' + (tienda_nombre||'') + ' - ' + fechaStr, { x: margin, y, size: 11, font: fontBold, color: rgb(0,0,0.6) });
      y -= 16;
      page.drawLine({ start:{x:margin,y}, end:{x:pageWidth-margin,y}, thickness:0.5, color:rgb(0,0,0) });
      y -= 12;
      for (const l of lineas) {
        ensureSpace(12);
        page.drawText((l.producto_codigo||'').toString().substring(0,12), { x: margin, y, size: 8, font, color: rgb(0,0,0) });
        page.drawText((l.producto_nombre||'').substring(0,50), { x: margin+90, y, size: 8, font, color: rgb(0,0,0) });
        page.drawText(l.cantidad.toString(), { x: margin+500, y, size: 9, font: fontBold, color: rgb(0,0.5,0) });
        y -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    const linesHtml = (lineas||[]).map(l =>
      '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px;">'+(l.producto_codigo||'')+'</td>'+
      '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;">'+l.producto_nombre+'</td>'+
      '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:#166534;">'+l.cantidad+'</td></tr>'
    ).join('');

    const htmlBody = '<div style="font-family:Arial,sans-serif;max-width:750px;margin:0 auto;">'+
      '<div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0;">'+
      '<h1 style="margin:0;">Nuevo Pedido SELOGAS</h1>'+
      '<p style="margin:5px 0 0;opacity:0.8;">'+(tienda_nombre||'')+' - '+fechaStr+'</p>'+
      '</div><div style="background:#f8f9fa;padding:20px;border:1px solid #dee2e6;">'+
      '<p><strong>N Pedido:</strong> '+(numero_pedido||'')+'</p>'+
      '<p><strong>Tienda:</strong> '+(tienda_nombre||'')+'</p>'+
      '<p><strong>Fecha:</strong> '+fechaStr+'</p>'+
      (observaciones?'<p><strong>Obs:</strong> '+observaciones+'</p>':'')+
      '<h3>Productos ('+(lineas||[]).length+'):</h3>'+
      '<table style="width:100%;border-collapse:collapse;">'+
      '<thead><tr style="background:#1e3a5f;color:white;">'+
      '<th style="padding:8px;text-align:left;">Codigo</th>'+
      '<th style="padding:8px;text-align:left;">Articulo</th>'+
      '<th style="padding:8px;text-align:center;">Cantidad</th>'+
      '</tr></thead><tbody>'+linesHtml+'</tbody></table>'+
      '<p style="margin-top:20px;color:#666;font-size:12px;">PDF adjunto con hoja de pedido completa.</p>'+
      '</div></div>';

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SELOGAS Pedidos <pedidos@megino.com>',
        to: [to],
        subject: subject || ('Nuevo pedido - '+(tienda_nombre||'')+' - '+fechaStr),
        html: htmlBody,
        attachments: [{ filename: 'pedido_'+(numero_pedido||'selogas')+'.pdf', content: pdfBase64 }],
      }),
    });

    const resendData = await resendResp.json();
    if (!resendResp.ok) throw new Error('Resend error: ' + JSON.stringify(resendData));

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
