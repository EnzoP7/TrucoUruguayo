import { NextRequest, NextResponse } from 'next/server';
import { enviarEmailContacto } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, email, asunto, mensaje } = body;

    // Validaciones
    if (!nombre || !email || !asunto || !mensaje) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email invalido' },
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

    // Enviar email
    const result = await enviarEmailContacto({ nombre, email, asunto, mensaje });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Mensaje enviado correctamente' });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al enviar el mensaje' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error en API contacto:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
