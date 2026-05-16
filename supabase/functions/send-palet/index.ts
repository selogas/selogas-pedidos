const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Escapa caracteres HTML para prevenir XSS en el cuerpo del email */
function escapeHtml(str: string | null | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      to,
      nombre_producto,
      nombre_tienda,
      nombre_usuario,
      email_tienda,
      observaciones,
    } = body;

    // Validar campos obligatorios
    if (!to) {
      return new Response(JSON.stringify({ error: 'Campo "to" es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

    // Escapar todos los campos que van al HTML para prevenir XSS
    const sProd    = escapeHtml(nombre_producto);
    const sTienda  = escapeHtml(nombre_tienda);
    const sUsuario = escapeHtml(nombre_usuario) || '—';
    const sEmail   = escapeHtml(email_tienda)   || '—';
    const sObs     = escapeHtml(observaciones);

    const fechaStr = new Date().toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
      '<div style="background:#00913f;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">' +
      '<h1 style="margin:0;font-size:20px;">📦 Solicitud de Palet — SELOGAS</h1>' +
      '<p style="margin:6px 0 0;opacity:0.85;font-size:14px;">' + fechaStr + '</p>' +
      '</div>' +
      '<div style="background:#f8f9fa;padding:24px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:8px;font-weight:bold;width:160px;vertical-align:top;">Producto</td>' +
      '<td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-size:15px;font-weight:600;color:#00913f;">' + sProd + '</td></tr>' +
      '<tr><td colspan="2" style="padding:4px;"></td></tr>' +
      '<tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;vertical-align:top;">Estación / Tienda</td>' +
      '<td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">' + sTienda + '</td></tr>' +
      '<tr><td colspan="2" style="padding:4px;"></td></tr>' +
      '<tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;vertical-align:top;">Usuario</td>' +
      '<td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">' + sUsuario + '</td></tr>' +
      '<tr><td colspan="2" style="padding:4px;"></td></tr>' +
      '<tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;vertical-align:top;">Email tienda</td>' +
      '<td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">' + sEmail + '</td></tr>' +
      (sObs ? (
        '<tr><td colspan="2" style="padding:4px;"></td></tr>' +
        '<tr><td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;font-weight:bold;vertical-align:top;">Observaciones</td>' +
        '<td style="padding:10px 12px;background:#fff;border:1px solid #e0e0e0;">' + sObs + '</td></tr>'
      ) : '') +
      '</table>' +
      '<p style="margin-top:20px;color:#888;font-size:12px;">Esta solicitud fue enviada automáticamente desde la app SELOGAS Pedidos.</p>' +
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
        subject: '📦 Solicitud de Palet: ' + sProd + ' — ' + sTienda,
        html: htmlBody,
      }),
    });

    const resendData = await resendResp.json();
    if (!resendResp.ok) throw new Error('Resend error: ' + JSON.stringify(resendData));

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-palet error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
