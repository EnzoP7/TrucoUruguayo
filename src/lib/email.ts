import nodemailer from 'nodemailer';

// Configuracion del transporter SMTP
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_PORT === '465', // true para 465, false para otros puertos
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

// Verificar conexion (opcional, para debugging)
export async function verificarConexionEmail(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('Conexion SMTP verificada correctamente');
    return true;
  } catch (error) {
    console.error('Error al verificar conexion SMTP:', error);
    return false;
  }
}

// Tipos para los emails
interface EmailContacto {
  nombre: string;
  email: string;
  asunto: string;
  mensaje: string;
}

interface EmailSugerencia {
  tipo: 'sugerencia' | 'bug' | 'otro';
  mensaje: string;
  email?: string;
  usuario?: string;
  pagina?: string;
}

// Template HTML base
function getBaseTemplate(contenido: string, titulo: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${titulo}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a5276 0%, #0f3460 100%); padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #d4af37; font-size: 24px; font-weight: bold;">
                    Truco Uruguayo Online
                  </h1>
                  <p style="margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px;">
                    ${titulo}
                  </p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  ${contenido}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #0f3460; padding: 20px 40px; text-align: center;">
                  <p style="margin: 0; color: rgba(255,255,255,0.5); font-size: 12px;">
                    Este email fue enviado desde Truco Uruguayo Online
                  </p>
                  <p style="margin: 8px 0 0; color: rgba(255,255,255,0.3); font-size: 11px;">
                    trucouruguayo.onrender.com
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Enviar email de contacto
export async function enviarEmailContacto(data: EmailContacto): Promise<{ success: boolean; error?: string }> {
  const { nombre, email, asunto, mensaje } = data;

  const asuntoMap: Record<string, string> = {
    general: 'Consulta General',
    bug: 'Reporte de Bug',
    sugerencia: 'Sugerencia',
    cuenta: 'Problema con Cuenta',
    privacidad: 'Privacidad / Datos',
    otro: 'Otro',
  };

  const tipoAsunto = asuntoMap[asunto] || asunto;

  const contenido = `
    <div style="color: #e0e0e0;">
      <div style="background-color: rgba(212, 175, 55, 0.1); border-left: 4px solid #d4af37; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #d4af37; font-weight: bold; font-size: 16px;">
          ${tipoAsunto}
        </p>
      </div>

      <table style="width: 100%; margin-bottom: 25px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #d4af37; font-weight: bold;">Nombre:</span>
            <span style="color: #fff; margin-left: 10px;">${nombre}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #d4af37; font-weight: bold;">Email:</span>
            <a href="mailto:${email}" style="color: #5dade2; margin-left: 10px; text-decoration: none;">${email}</a>
          </td>
        </tr>
      </table>

      <div style="background-color: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 10px; color: #d4af37; font-weight: bold; font-size: 14px;">Mensaje:</p>
        <p style="margin: 0; color: #fff; line-height: 1.6; white-space: pre-wrap;">${mensaje}</p>
      </div>

      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <a href="mailto:${email}?subject=Re: ${tipoAsunto}" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #b8960c 100%); color: #1a1a2e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
          Responder a ${nombre}
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: process.env.MAIL_USER,
      replyTo: email,
      subject: `[Contacto] ${tipoAsunto} - ${nombre}`,
      html: getBaseTemplate(contenido, 'Nuevo mensaje de contacto'),
    });

    return { success: true };
  } catch (error) {
    console.error('Error al enviar email de contacto:', error);
    return { success: false, error: 'Error al enviar el email' };
  }
}

// Enviar email de sugerencia/feedback
export async function enviarEmailSugerencia(data: EmailSugerencia): Promise<{ success: boolean; error?: string }> {
  const { tipo, mensaje, email, usuario, pagina } = data;

  const tipoLabel = {
    sugerencia: 'Sugerencia',
    bug: 'Reporte de Bug',
    otro: 'Otro',
  }[tipo];

  const tipoColor = {
    sugerencia: '#27ae60',
    bug: '#e74c3c',
    otro: '#3498db',
  }[tipo];

  const contenido = `
    <div style="color: #e0e0e0;">
      <div style="background-color: rgba(${tipo === 'bug' ? '231, 76, 60' : tipo === 'sugerencia' ? '39, 174, 96' : '52, 152, 219'}, 0.1); border-left: 4px solid ${tipoColor}; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: ${tipoColor}; font-weight: bold; font-size: 16px;">
          ${tipoLabel}
        </p>
      </div>

      ${usuario || email || pagina ? `
      <table style="width: 100%; margin-bottom: 25px;">
        ${usuario ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #d4af37; font-weight: bold;">Usuario:</span>
            <span style="color: #fff; margin-left: 10px;">${usuario}</span>
          </td>
        </tr>
        ` : ''}
        ${email ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #d4af37; font-weight: bold;">Email:</span>
            <a href="mailto:${email}" style="color: #5dade2; margin-left: 10px; text-decoration: none;">${email}</a>
          </td>
        </tr>
        ` : ''}
        ${pagina ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #d4af37; font-weight: bold;">Pagina:</span>
            <span style="color: #fff; margin-left: 10px;">${pagina}</span>
          </td>
        </tr>
        ` : ''}
      </table>
      ` : ''}

      <div style="background-color: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
        <p style="margin: 0 0 10px; color: #d4af37; font-weight: bold; font-size: 14px;">Mensaje:</p>
        <p style="margin: 0; color: #fff; line-height: 1.6; white-space: pre-wrap;">${mensaje}</p>
      </div>

      ${email ? `
      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <a href="mailto:${email}?subject=Re: Tu ${tipoLabel.toLowerCase()} en Truco Uruguayo" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #b8960c 100%); color: #1a1a2e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
          Responder
        </a>
      </div>
      ` : ''}
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: process.env.MAIL_USER,
      replyTo: email || process.env.MAIL_USER,
      subject: `[${tipoLabel}] ${usuario ? `de ${usuario}` : 'Anonimo'} - Truco Uruguayo`,
      html: getBaseTemplate(contenido, `Nueva ${tipoLabel.toLowerCase()}`),
    });

    return { success: true };
  } catch (error) {
    console.error('Error al enviar email de sugerencia:', error);
    return { success: false, error: 'Error al enviar el email' };
  }
}

export default transporter;
