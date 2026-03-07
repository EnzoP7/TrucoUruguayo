import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Sobre Nosotros',
  description: 'Conocé la historia de Truco Uruguayo Online. Una plataforma creada con pasión para preservar y compartir el tradicional juego de cartas uruguayo.',
};

export default function SobreNosotrosPage() {
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
            Sobre Nosotros
          </h1>
          <p className="text-gold-300/60 text-sm">La historia detrás de Truco Uruguayo Online</p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Hero section */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gold-600/30 shrink-0">
                <Image
                  src="/Images/LogoFinalTrucouruguayo.png"
                  alt="Truco Uruguayo Online"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold text-celeste-400 mb-2">Truco Uruguayo Online</h2>
                <p className="text-gold-300/80 leading-relaxed">
                  La plataforma definitiva para jugar al truco uruguayo en línea. Conectando jugadores
                  de todo el mundo con la tradición del juego de cartas más querido de Uruguay.
                </p>
              </div>
            </div>
          </div>

          {/* Sobre Mi - Enzo Pontet */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-celeste-500/30 bg-gradient-to-br from-celeste-900/20 to-transparent">
            <h2 className="text-xl font-bold text-celeste-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">👋</span> Sobre Mí
            </h2>
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-celeste-500/30 shrink-0 shadow-xl shadow-celeste-600/30">
                <Image
                  src="https://media.licdn.com/dms/image/v2/D4D03AQEBPcn8kcYXhg/profile-displayphoto-shrink_100_100/B4DZOt0Yt4HgAU-/0/1733788012225?e=1774483200&v=beta&t=aXSdNRjR88o4h7Vn-V2X7_xMWwRaMz1WkkvfFeiLIvU"
                  alt="Enzo Pontet"
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center sm:text-left flex-1">
                <h3 className="text-xl font-bold text-gold-400 mb-1">Enzo Pontet</h3>
                <p className="text-celeste-400/80 text-sm mb-3">Desarrollador de Software - Uruguay</p>
                <div className="space-y-3 text-gold-300/80 leading-relaxed">
                  <p>
                    Soy un desarrollador uruguayo apasionado por crear soluciones digitales que marquen
                    una diferencia. Actualmente estoy trabajando en varios proyectos personales, y
                    Truco Uruguayo Online es uno de los que más me entusiasma.
                  </p>
                  <p>
                    La idea de este proyecto nació con un objetivo simple pero importante: que la gente
                    pueda jugar al truco uruguayo <strong className="text-gold-400">libremente y de forma gratuita</strong>,
                    sin importar dónde esté. El truco es parte de nuestra cultura y quiero que cualquiera
                    pueda disfrutarlo.
                  </p>
                  <p>
                    Para quienes quieran apoyar el proyecto o acceder a funciones adicionales, existen
                    opciones premium disponibles. Además, los anuncios que ves en el sitio ayudan a
                    <strong className="text-gold-400"> costear los servidores</strong> y mantener la plataforma
                    funcionando para todos.
                  </p>
                </div>

                {/* Links */}
                <div className="mt-5 flex flex-wrap gap-3 justify-center sm:justify-start">
                  <a
                    href="https://www.linkedin.com/in/enzo-pontet/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0077B5]/20 border border-[#0077B5]/40 text-[#0077B5] hover:bg-[#0077B5]/30 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <a
                    href="mailto:enzopch2022@gmail.com"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-600/20 border border-gold-500/40 text-gold-400 hover:bg-gold-600/30 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                </div>

                {/* Tech Stack */}
                <div className="mt-5 pt-5 border-t border-gold-700/20">
                  <p className="text-gold-400/60 text-xs mb-2">Tecnologías que uso:</p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">Next.js</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">TypeScript</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">React</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">Socket.IO</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">Node.js</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-celeste-600/20 text-celeste-400 border border-celeste-500/30">Tailwind CSS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mission */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20">
            <h2 className="text-xl font-bold text-celeste-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎯</span> La Misión del Proyecto
            </h2>
            <p className="text-gold-300/80 leading-relaxed">
              Preservar y difundir el truco uruguayo, ese juego de cartas que ha sido parte fundamental
              de la cultura de Uruguay durante generaciones. Queremos que cualquier persona, sin importar
              dónde esté en el mundo, pueda disfrutar de una partida de truco con amigos, familia o
              nuevos rivales, exactamente como se juega en los bares y hogares de Uruguay.
            </p>
          </div>

          {/* Por que gratis + anuncios */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20">
            <h2 className="text-xl font-bold text-celeste-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span> ¿Por qué es Gratis?
            </h2>
            <div className="space-y-4 text-gold-300/80 leading-relaxed">
              <p>
                Creo firmemente que el truco debe ser accesible para todos. Por eso, el juego es y
                siempre será <strong className="text-gold-400">100% gratuito</strong> en su modalidad básica.
                Podés crear partidas, jugar con amigos, participar en el ranking y disfrutar de todas
                las reglas del truco uruguayo sin pagar nada.
              </p>
              <p>
                Para mantener los servidores funcionando y seguir mejorando la plataforma, el sitio
                muestra anuncios publicitarios. Esta es una forma de que el proyecto sea sustentable
                sin cobrarle a los jugadores. Si preferís una experiencia sin anuncios, podés acceder
                a las opciones premium.
              </p>
              <p>
                Las funcionalidades premium son completamente opcionales y no afectan la jugabilidad.
                Son para quienes quieran apoyar el proyecto y obtener algunas ventajas cosméticas
                o de comodidad.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20">
            <h2 className="text-xl font-bold text-celeste-400 mb-6 flex items-center gap-2">
              <span className="text-2xl">✨</span> ¿Qué Hace Especial a Esta Plataforma?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gold-900/20 border border-gold-700/20">
                <h3 className="font-bold text-gold-400 mb-2">Reglas Auténticas</h3>
                <p className="text-gold-300/70 text-sm">
                  Implementamos todas las reglas del truco uruguayo: piezas, bravos, envido con piezas,
                  flor, y todos los cantos tradicionales.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gold-900/20 border border-gold-700/20">
                <h3 className="font-bold text-gold-400 mb-2">Tiempo Real</h3>
                <p className="text-gold-300/70 text-sm">
                  Jugá sin delays ni esperas. Nuestra tecnología de sockets permite partidas
                  fluidas y rápidas como si estuvieras en la misma mesa.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gold-900/20 border border-gold-700/20">
                <h3 className="font-bold text-gold-400 mb-2">Múltiples Modos</h3>
                <p className="text-gold-300/70 text-sm">
                  1v1 para duelos intensos, 2v2 para jugar con tu compañero, o 3v3 para la
                  experiencia completa de truco en equipo.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gold-900/20 border border-gold-700/20">
                <h3 className="font-bold text-gold-400 mb-2">Hecho en Uruguay</h3>
                <p className="text-gold-300/70 text-sm">
                  Desarrollado por un uruguayo, para uruguayos y amantes del truco de todo el mundo.
                  Con orgullo celeste.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="glass rounded-2xl p-6 sm:p-8 border border-celeste-500/30 bg-gradient-to-r from-celeste-900/20 to-celeste-800/10 text-center">
            <h2 className="text-xl font-bold text-white mb-3">¿Listo para jugar?</h2>
            <p className="text-gold-300/70 mb-6">
              Unite a miles de jugadores y disfrutá del mejor truco uruguayo online.
            </p>
            <Link
              href="/lobby"
              className="inline-block px-8 py-3 bg-gradient-to-r from-gold-600 to-gold-500 text-wood-950 font-bold rounded-xl hover:from-gold-500 hover:to-gold-400 transition-all shadow-lg shadow-gold-600/20"
            >
              Jugar Ahora
            </Link>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacidad" className="text-gold-400/60 hover:text-gold-300 transition-colors">Privacidad</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/terminos" className="text-gold-400/60 hover:text-gold-300 transition-colors">Términos</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/cookies" className="text-gold-400/60 hover:text-gold-300 transition-colors">Cookies</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/aviso-legal" className="text-gold-400/60 hover:text-gold-300 transition-colors">Aviso Legal</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/contacto" className="text-gold-400/60 hover:text-gold-300 transition-colors">Contacto</Link>
        </div>
      </div>
    </div>
  );
}
