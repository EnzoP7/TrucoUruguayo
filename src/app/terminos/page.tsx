import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Términos y condiciones de uso de Truco Uruguayo Online. Leé las reglas y condiciones para usar nuestra plataforma.',
};

export default function TerminosPage() {
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
            Términos de Servicio
          </h1>
          <p className="text-gold-300/60 text-sm">Última actualización: Marzo 2026</p>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">1. Aceptación de los Términos</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Al acceder y utilizar Truco Uruguayo Online, aceptás estar sujeto a estos términos de servicio.
              Si no estás de acuerdo con alguna parte de estos términos, no debés usar nuestro servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">2. Descripción del Servicio</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Truco Uruguayo Online es una plataforma gratuita de juego en línea que permite a los usuarios
              jugar al truco uruguayo en tiempo real con otros jugadores. El servicio incluye modos de juego
              1v1, 2v2 y 3v3, sistemas de ranking, torneos y funcionalidades sociales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">3. Registro y Cuenta</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                Podés jugar como invitado o registrarte con tu cuenta de Google para acceder a funciones
                adicionales como estadísticas, rankings y personalización.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Debés proporcionar información veraz y mantenerla actualizada</li>
                <li>Sos responsable de mantener la seguridad de tu cuenta</li>
                <li>No podés compartir tu cuenta con terceros</li>
                <li>Debés tener al menos 13 años para usar el servicio</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">4. Reglas de Conducta</h2>
            <p className="text-gold-300/80 leading-relaxed mb-4">
              Al usar Truco Uruguayo Online, te comprometés a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gold-300/80">
              <li>Tratar a otros jugadores con respeto</li>
              <li>No usar lenguaje ofensivo, discriminatorio o inapropiado</li>
              <li>No hacer trampa ni usar software de terceros para obtener ventajas</li>
              <li>No intentar hackear, explotar bugs o interferir con el servicio</li>
              <li>No crear múltiples cuentas para manipular rankings</li>
              <li>No acosar, intimidar o amenazar a otros usuarios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">5. Monedas Virtuales y Compras</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                El juego puede incluir monedas virtuales que se obtienen jugando o mediante compras opcionales.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Las monedas virtuales no tienen valor monetario real</li>
                <li>Las compras son finales y no reembolsables</li>
                <li>Nos reservamos el derecho de modificar precios y ofertas</li>
                <li>Las monedas pueden perderse si se cierra una cuenta por violación de términos</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">6. Propiedad Intelectual</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Todo el contenido del sitio, incluyendo pero no limitado a gráficos, diseño, código, logotipos
              y marcas, es propiedad de Truco Uruguayo Online o sus licenciantes y está protegido por leyes
              de propiedad intelectual. No podés copiar, modificar, distribuir o usar comercialmente
              ningún contenido sin autorización escrita.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">7. Contenido del Usuario</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                Al subir contenido (nombres de usuario, fotos de perfil, mensajes), garantizás que:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Tenés los derechos necesarios sobre ese contenido</li>
                <li>No infringe derechos de terceros</li>
                <li>No es ilegal, ofensivo o dañino</li>
              </ul>
              <p>
                Nos reservamos el derecho de eliminar cualquier contenido que viole estos términos.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">8. Limitación de Responsabilidad</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                El servicio se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos que:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>El servicio estará disponible ininterrumpidamente</li>
                <li>El servicio estará libre de errores</li>
                <li>Los resultados serán precisos o confiables</li>
              </ul>
              <p>
                En ningún caso seremos responsables por daños indirectos, incidentales, especiales o
                consecuentes derivados del uso del servicio.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">9. Suspensión y Terminación</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Nos reservamos el derecho de suspender o terminar tu acceso al servicio en cualquier momento,
              con o sin causa, incluyendo pero no limitado a violaciones de estos términos. Podés cancelar
              tu cuenta en cualquier momento contactándonos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">10. Modificaciones</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Podemos modificar estos términos en cualquier momento. Los cambios entrarán en vigor
              inmediatamente después de su publicación. El uso continuado del servicio después de
              cualquier modificación constituye tu aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">11. Ley Aplicable</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Estos términos se regirán e interpretarán de acuerdo con las leyes de la República Oriental
              del Uruguay, sin consideración a sus principios de conflicto de leyes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">12. Contacto</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Si tenés preguntas sobre estos términos de servicio, podés contactarnos:
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
          <Link href="/privacidad" className="text-gold-400/60 hover:text-gold-300 transition-colors">Política de Privacidad</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/sobre-nosotros" className="text-gold-400/60 hover:text-gold-300 transition-colors">Sobre Nosotros</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/contacto" className="text-gold-400/60 hover:text-gold-300 transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
}
