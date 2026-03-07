import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Política de cookies de Truco Uruguayo Online. Conocé qué cookies utilizamos y cómo gestionarlas.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-table-wood">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-celeste-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </Link>
          <h1 className="font-[var(--font-cinzel)] text-3xl sm:text-4xl font-bold text-gold-400 mb-2">
            Política de Cookies
          </h1>
          <p className="text-gold-300/60 text-sm">Última actualización: Marzo 2026</p>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">1. ¿Qué son las Cookies?</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Las cookies son pequeños archivos de texto que los sitios web almacenan en tu navegador.
              Se utilizan para recordar tus preferencias, mantener tu sesión activa, analizar cómo
              usás el sitio y personalizar tu experiencia, incluyendo los anuncios que ves.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">2. Tipos de Cookies que Utilizamos</h2>
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-green-900/20 border border-green-500/20">
                <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Cookies Esenciales
                </h3>
                <p className="text-gold-300/70 text-sm mb-2">
                  Necesarias para el funcionamiento básico del sitio. No se pueden desactivar.
                </p>
                <ul className="text-sm text-gold-300/60 space-y-1 ml-4">
                  <li>• Sesión de usuario y autenticación</li>
                  <li>• Preferencias de idioma</li>
                  <li>• Consentimiento de cookies</li>
                  <li>• Seguridad y prevención de fraude</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-500/20">
                <h3 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Cookies de Rendimiento y Analíticas
                </h3>
                <p className="text-gold-300/70 text-sm mb-2">
                  Nos ayudan a entender cómo los usuarios interactúan con el sitio.
                </p>
                <ul className="text-sm text-gold-300/60 space-y-1 ml-4">
                  <li>• <strong>Google Analytics:</strong> Análisis de tráfico y comportamiento</li>
                  <li>• Métricas de rendimiento del sitio</li>
                  <li>• Detección de errores y problemas técnicos</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-500/20">
                <h3 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  Cookies de Publicidad
                </h3>
                <p className="text-gold-300/70 text-sm mb-2">
                  Utilizadas para mostrar anuncios relevantes y medir su efectividad.
                </p>
                <ul className="text-sm text-gold-300/60 space-y-1 ml-4">
                  <li>• <strong>Google AdSense:</strong> Publicidad personalizada</li>
                  <li>• DoubleClick (Google): Seguimiento de anuncios</li>
                  <li>• Medición de conversiones publicitarias</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/20">
                <h3 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Cookies Funcionales
                </h3>
                <p className="text-gold-300/70 text-sm mb-2">
                  Mejoran la funcionalidad y personalización del sitio.
                </p>
                <ul className="text-sm text-gold-300/60 space-y-1 ml-4">
                  <li>• Preferencias de juego (volumen, tema)</li>
                  <li>• Progreso en el tutorial</li>
                  <li>• Configuraciones de la interfaz</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">3. Cookies de Terceros</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>Utilizamos servicios de terceros que pueden establecer sus propias cookies:</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold-700/30">
                      <th className="text-left py-2 text-gold-400">Proveedor</th>
                      <th className="text-left py-2 text-gold-400">Propósito</th>
                      <th className="text-left py-2 text-gold-400">Más Info</th>
                    </tr>
                  </thead>
                  <tbody className="text-gold-300/70">
                    <tr className="border-b border-gold-700/20">
                      <td className="py-2">Google Analytics</td>
                      <td className="py-2">Análisis de tráfico</td>
                      <td className="py-2">
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">Política</a>
                      </td>
                    </tr>
                    <tr className="border-b border-gold-700/20">
                      <td className="py-2">Google AdSense</td>
                      <td className="py-2">Publicidad</td>
                      <td className="py-2">
                        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">Política</a>
                      </td>
                    </tr>
                    <tr className="border-b border-gold-700/20">
                      <td className="py-2">Google OAuth</td>
                      <td className="py-2">Autenticación</td>
                      <td className="py-2">
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">Política</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">4. Cómo Gestionar las Cookies</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>Podés controlar y/o eliminar las cookies como desees:</p>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-black/20">
                  <h4 className="font-semibold text-gold-400 mb-1">Desde tu navegador</h4>
                  <p className="text-sm text-gold-300/70">
                    La mayoría de los navegadores permiten bloquear o eliminar cookies desde la configuración.
                    Consultá la ayuda de tu navegador para más información.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-black/20">
                  <h4 className="font-semibold text-gold-400 mb-1">Publicidad personalizada de Google</h4>
                  <p className="text-sm text-gold-300/70">
                    Podés optar por no recibir publicidad personalizada en{' '}
                    <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">
                      Configuración de Anuncios de Google
                    </a>
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-black/20">
                  <h4 className="font-semibold text-gold-400 mb-1">Your Online Choices</h4>
                  <p className="text-sm text-gold-300/70">
                    Visitá{' '}
                    <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">
                      www.youronlinechoices.eu
                    </a>
                    {' '}para gestionar cookies de múltiples empresas publicitarias.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">5. Duración de las Cookies</h2>
            <div className="space-y-2 text-gold-300/80">
              <p><strong className="text-gold-400">Cookies de sesión:</strong> Se eliminan al cerrar el navegador.</p>
              <p><strong className="text-gold-400">Cookies persistentes:</strong> Permanecen por un período determinado (desde días hasta años, según el propósito).</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">6. Actualizaciones</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Podemos actualizar esta política periódicamente para reflejar cambios en las cookies que
              utilizamos o por otras razones operativas, legales o regulatorias. Te recomendamos
              revisar esta página regularmente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">7. Contacto</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Si tenés preguntas sobre nuestra política de cookies, contactanos:
            </p>
            <ul className="mt-3 space-y-2 text-gold-300/80">
              <li><span className="text-gold-400">Email:</span> <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300">enzopch2022@gmail.com</a></li>
            </ul>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacidad" className="text-gold-400/60 hover:text-gold-300 transition-colors">Privacidad</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/terminos" className="text-gold-400/60 hover:text-gold-300 transition-colors">Términos</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/aviso-legal" className="text-gold-400/60 hover:text-gold-300 transition-colors">Aviso Legal</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/contacto" className="text-gold-400/60 hover:text-gold-300 transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
}
