import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // Solo aplicar redirecciones en producción
  if (process.env.NODE_ENV === 'production') {
    // Obtener el protocolo real (Render y otros proxies usan x-forwarded-proto)
    const proto = request.headers.get('x-forwarded-proto') || 'https';

    // Redirección HTTP a HTTPS
    if (proto === 'http') {
      url.protocol = 'https:';
      return NextResponse.redirect(url, 301);
    }

    // Redirección www a non-www (consistencia)
    if (host.startsWith('www.')) {
      const newHost = host.replace('www.', '');
      url.host = newHost;
      return NextResponse.redirect(url, 301);
    }
  }

  // Crear respuesta y agregar headers de seguridad
  const response = NextResponse.next();

  // Headers de seguridad adicionales
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Configurar en qué rutas se aplica el middleware
// Excluir archivos estáticos y API de socket para evitar interferencias
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api/socket (Socket.IO endpoint)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$|api/socket).*)',
  ],
};
