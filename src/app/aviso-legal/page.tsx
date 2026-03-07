import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso Legal',
  description: 'Aviso legal e información del titular de Truco Uruguayo Online. Datos de identificación y responsabilidades.',
};

export default function AvisoLegalPage() {
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
            Aviso Legal
          </h1>
          <p className="text-gold-300/60 text-sm">Información legal del sitio web</p>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">1. Datos Identificativos</h2>
            <div className="p-4 rounded-xl bg-gold-900/20 border border-gold-700/20 space-y-3">
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">Titular:</span> Enzo Pontet</p>
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">Nombre del sitio:</span> Truco Uruguayo Online</p>
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">Dominio:</span> trucouruguayo.onrender.com</p>
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">Email de contacto:</span> <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300">enzopch2022@gmail.com</a></p>
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">País:</span> Uruguay</p>
              <p className="text-gold-300/80"><span className="text-gold-400 font-semibold">Actividad:</span> Plataforma de juego online gratuito</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">2. Objeto del Sitio</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Truco Uruguayo Online es una plataforma web de entretenimiento que permite a los usuarios
              jugar al truco uruguayo de forma gratuita a través de Internet. El sitio no es un casino
              ni ofrece juegos de azar con dinero real. Las monedas virtuales del juego no tienen
              valor monetario real y no pueden canjearse por dinero.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">3. Propiedad Intelectual</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                Todos los contenidos del sitio web, incluyendo pero no limitándose a: textos, gráficos,
                imágenes, logotipos, iconos, software, código fuente, diseño y estructura de navegación,
                están protegidos por derechos de propiedad intelectual y son propiedad de Enzo Pontet
                o se utilizan bajo licencia.
              </p>
              <p>
                El truco es un juego tradicional de dominio público. Las reglas del truco uruguayo
                son patrimonio cultural y no están sujetas a derechos de autor.
              </p>
              <p>
                Queda prohibida la reproducción, distribución, comunicación pública, transformación
                o cualquier otra forma de explotación de los contenidos protegidos sin autorización
                expresa del titular.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">4. Exclusión de Garantías y Responsabilidad</h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                El titular no garantiza la disponibilidad continua ni la infalibilidad del servicio.
                El acceso puede verse interrumpido por mantenimiento, actualizaciones o causas ajenas
                a nuestro control.
              </p>
              <p>
                El titular no será responsable de:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Daños derivados del uso o imposibilidad de uso del servicio</li>
                <li>Pérdida de datos o información</li>
                <li>Contenido publicado por usuarios</li>
                <li>Conducta de otros usuarios</li>
                <li>Virus o software malicioso de terceros</li>
                <li>Enlaces a sitios web de terceros</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">5. Publicidad</h2>
            <p className="text-gold-300/80 leading-relaxed">
              El sitio web muestra publicidad proporcionada por Google AdSense. Los ingresos
              publicitarios contribuyen a costear los servidores y el mantenimiento de la plataforma,
              permitiendo que el juego siga siendo gratuito para todos los usuarios. El titular no
              controla el contenido de los anuncios mostrados por terceros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">6. Enlaces a Terceros</h2>
            <p className="text-gold-300/80 leading-relaxed">
              El sitio puede contener enlaces a páginas web de terceros. Estos enlaces se proporcionan
              únicamente para comodidad del usuario. El titular no tiene control sobre dichos sitios
              y no asume responsabilidad por sus contenidos ni por las políticas de privacidad de
              los mismos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">7. Modificaciones</h2>
            <p className="text-gold-300/80 leading-relaxed">
              El titular se reserva el derecho de modificar, actualizar o eliminar cualquier contenido
              del sitio web, así como las condiciones de uso, en cualquier momento y sin previo aviso.
              Es responsabilidad del usuario revisar periódicamente este aviso legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">8. Legislación Aplicable</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Este aviso legal se rige por la legislación de la República Oriental del Uruguay.
              Para cualquier controversia que pudiera derivarse del acceso o uso de este sitio web,
              las partes se someten a los tribunales competentes de Uruguay.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-celeste-400 mb-4">9. Contacto</h2>
            <p className="text-gold-300/80 leading-relaxed">
              Para cualquier consulta relacionada con este aviso legal, podés contactarnos:
            </p>
            <ul className="mt-3 space-y-2 text-gold-300/80">
              <li><span className="text-gold-400">Email:</span> <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300">enzopch2022@gmail.com</a></li>
              <li>
                <span className="text-gold-400">LinkedIn:</span>{' '}
                <a href="https://www.linkedin.com/in/enzo-pontet/" target="_blank" rel="noopener noreferrer" className="text-celeste-400 hover:text-celeste-300">
                  linkedin.com/in/enzo-pontet
                </a>
              </li>
            </ul>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacidad" className="text-gold-400/60 hover:text-gold-300 transition-colors">Privacidad</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/terminos" className="text-gold-400/60 hover:text-gold-300 transition-colors">Términos</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/cookies" className="text-gold-400/60 hover:text-gold-300 transition-colors">Cookies</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/contacto" className="text-gold-400/60 hover:text-gold-300 transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
}
