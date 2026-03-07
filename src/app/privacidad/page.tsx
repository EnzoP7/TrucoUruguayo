import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de Truco Uruguayo Online. Conocé cómo protegemos tus datos y tu información personal.',
};

export default function PrivacidadPage() {
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
            Política de Privacidad
          </h1>
          <p className="text-gold-300/60 text-sm">Última actualización: Marzo 2026</p>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">1. Introducción</h2>
            <p className="text-gold-300/80 leading-relaxed">
              En Truco Uruguayo Online, desarrollado por Enzo Pontet, nos comprometemos a proteger tu privacidad.
              Esta política describe cómo recopilamos, usamos y protegemos tu información cuando usás nuestra
              plataforma de juego en línea.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">2. Información que Recopilamos</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <div>
                <h3 className="font-semibold text-gold-400 mb-2">2.1 Información de cuenta</h3>
                <p>Si te registrás con Google, recopilamos tu nombre, correo electrónico y foto de perfil proporcionados por Google.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gold-400 mb-2">2.2 Datos de juego</h3>
                <p>Almacenamos estadísticas de partidas, puntuaciones, rankings y preferencias de juego para mejorar tu experiencia.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gold-400 mb-2">2.3 Información técnica</h3>
                <p>Recopilamos datos anónimos como tipo de navegador, sistema operativo y dirección IP para mejorar el rendimiento del sitio.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">3. Cómo Usamos tu Información</h2>
            <ul className="list-disc list-inside space-y-2 text-gold-300/80 leading-relaxed">
              <li>Proporcionar y mantener el servicio de juego</li>
              <li>Gestionar tu cuenta y perfil de jugador</li>
              <li>Mostrar rankings y estadísticas</li>
              <li>Mejorar la experiencia de usuario</li>
              <li>Enviar notificaciones relacionadas con el servicio</li>
              <li>Prevenir fraudes y abusos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">4. Publicidad y Terceros</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                Utilizamos Google AdSense para mostrar anuncios. Google puede usar cookies y tecnologías
                similares para mostrar anuncios basados en tus visitas a este y otros sitios web.
              </p>
              <p>
                Podés optar por no recibir publicidad personalizada visitando la
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300 underline ml-1">
                  configuración de anuncios de Google
                </a>.
              </p>
              <p>
                También utilizamos Google Analytics para analizar el uso del sitio. Esta información nos
                ayuda a entender cómo los usuarios interactúan con nuestra plataforma.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">5. Cookies</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Utilizamos cookies para mantener tu sesión, recordar tus preferencias y analizar el tráfico.
              Podés configurar tu navegador para rechazar cookies, aunque esto puede afectar algunas
              funcionalidades del sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">6. Seguridad de los Datos</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Implementamos medidas de seguridad técnicas y organizativas para proteger tu información
              contra acceso no autorizado, alteración, divulgación o destrucción. Sin embargo, ningún
              método de transmisión por Internet es 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">7. Tus Derechos</h2>
            <ul className="list-disc list-inside space-y-2 text-gold-300/80 leading-relaxed">
              <li>Acceder a tus datos personales</li>
              <li>Solicitar la corrección de datos inexactos</li>
              <li>Solicitar la eliminación de tu cuenta y datos</li>
              <li>Oponerte al procesamiento de tus datos</li>
              <li>Retirar tu consentimiento en cualquier momento</li>
            </ul>
            <p className="text-gold-300/80 mt-4">
              Para ejercer estos derechos, contactanos a:
              <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300 ml-1">enzopch2022@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">8. Menores de Edad</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Nuestro servicio no está dirigido a menores de 13 años. No recopilamos intencionalmente
              información de niños menores de 13 años. Si sos padre y creés que tu hijo nos ha
              proporcionado información, contactanos para eliminarla.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">9. Cambios en esta Política</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Podemos actualizar esta política periódicamente. Te notificaremos sobre cambios significativos
              publicando la nueva política en esta página con una nueva fecha de actualización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">10. Contacto</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Si tenés preguntas sobre esta política de privacidad, podés contactarnos:
            </p>
            <ul className="mt-3 space-y-2 text-gold-300/80">
              <li><span className="text-gold-400">Email:</span> <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300">enzopch2022@gmail.com</a></li>
              <li><span className="text-gold-400">Desarrollador:</span> Enzo Pontet</li>
              <li><span className="text-gold-400">Ubicación:</span> Uruguay</li>
            </ul>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/terminos" className="text-gold-400/60 hover:text-gold-300 transition-colors">Términos de Servicio</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/sobre-nosotros" className="text-gold-400/60 hover:text-gold-300 transition-colors">Sobre Nosotros</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/contacto" className="text-gold-400/60 hover:text-gold-300 transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
}
