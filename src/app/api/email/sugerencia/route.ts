import { NextRequest, NextResponse } from 'next/server';
import { enviarEmailSugerencia } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tipo, mensaje, email, usuario, pagina } = body;

    // Validaciones
    if (!tipo || !mensaje) {
      return NextResponse.json(
        { success: false, error: 'El tipo y mensaje son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!['sugerencia', 'bug', 'otro'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'Tipo invalido' },
        { status: 400 }
      );
    }

    // Validar longitud del mensaje
    if (mensaje.length < 10) {
      return NextResponse.json(
        { success: false, error: 'El mensaje debe tener al menos 10 caracteres' },
        { status: 400 }
      );
    }

    if (mensaje.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'El mensaje es demasiado largo (max 5000 caracteres)' },
        { status: 400 }
      );
    }

    // Validar email si se proporciona
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Email invalido' },
          { status: 400 }
        );
      }
    }

    // Enviar email
    const result = await enviarEmailSugerencia({ tipo, mensaje, email, usuario, pagina });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Sugerencia enviada correctamente' });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al enviar la sugerencia' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error en API sugerencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
