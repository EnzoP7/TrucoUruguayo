'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FeedbackModal from '@/components/FeedbackModal';

export default function HomePage() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="min-h-screen bg-table-wood overflow-hidden relative">
      {/* Efectos de luz ambiente uruguayos - celeste y dorado */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-celeste-500/15 via-celeste-600/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-celeste-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-celeste-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-celeste-900/20 rounded-full blur-3xl" />
      </div>

      {/* Imagenes decorativas flotantes de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Tero arriba izquierda */}
        <div className="absolute top-16 left-8 opacity-[0.25] hidden lg:block">
          <Image src="/Images/Tero.png" alt="Tero - Ave nacional de Uruguay" width={120} height={120} className="animate-float" style={{ animationDelay: '1s' }} />
        </div>
        {/* Vaca abajo derecha */}
        <div className="absolute bottom-12 right-8 opacity-[0.22] hidden lg:block">
          <Image src="/Images/Vaca.png" alt="Vaca - Simbolo ganadero uruguayo" width={140} height={100} className="animate-float" style={{ animationDelay: '2s' }} />
        </div>
        {/* Tambor abajo izquierda */}
        <div className="absolute bottom-20 left-12 opacity-[0.22] hidden xl:block">
          <Image src="/Images/Tambor.png" alt="Tambor de candombe uruguayo" width={80} height={100} className="animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        {/* Faro arriba derecha */}
        <div className="absolute top-20 right-16 opacity-[0.22] hidden xl:block">
          <Image src="/Images/Faro.png" alt="Faro de Punta del Este" width={90} height={110} className="animate-float" style={{ animationDelay: '1.5s' }} />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">

        {/* Hero Section */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Sol de Mayo real */}
          <div className="flex justify-center mb-4">
            <Image
              src="/Images/SolDeMayo.png"
              alt="Sol de Mayo"
              width={112}
              height={112}
              className="w-20 h-20 md:w-28 md:h-28 sun-glow drop-shadow-[0_0_20px_rgba(252,209,22,0.5)]"
              priority
            />
          </div>

          <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gold-400 mb-4 tracking-wider">
            <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              Truco Uruguayo Online
            </span>
            <span className="block text-2xl sm:text-3xl md:text-4xl text-celeste-300 mt-2 font-normal">
              Juga Gratis con Amigos
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gold-200/70 font-light tracking-widest uppercase">
            El autentico juego de cartas uruguayo en tiempo real
          </p>

          {/* Linea decorativa con mate real */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent to-gold-600/50" />
            <Image src="/Images/TermoYMate.png" alt="Mate uruguayo - Tradicion oriental" width={32} height={32} className="w-7 h-7 opacity-60" />
            <div className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent to-gold-600/50" />
          </div>
        </div>

        {/* Cartas decorativas en abanico */}
        <div className="relative w-80 md:w-96 h-48 md:h-56 mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{ left: '10%', top: '20px', transform: 'rotate(-20deg)', animationDelay: '0s' }}
          />
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{ left: '50%', marginLeft: '-56px', top: '0', transform: 'rotate(0deg)', animationDelay: '0.3s', zIndex: 2 }}
          />
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{ right: '10%', top: '20px', transform: 'rotate(20deg)', animationDelay: '0.6s' }}
          />
        </div>

        {/* Botones CTA */}
        <div className="mb-16 animate-slide-up flex flex-col sm:flex-row gap-4 items-center" style={{ animationDelay: '0.4s' }}>
          <Link href="/lobby" className="group relative inline-block">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 rounded-2xl opacity-60 group-hover:opacity-100 blur-md animate-pulse-glow transition-opacity duration-300" />
            <button className="relative px-12 md:px-16 py-5 md:py-6 bg-gradient-to-br from-gold-700 via-gold-600 to-gold-500 text-wood-950 text-xl md:text-2xl font-[var(--font-cinzel)] font-bold rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 active:scale-95 border-2 border-gold-400/30">
              <span className="relative z-10 drop-shadow-sm">Jugar Ahora</span>
            </button>
          </Link>
          <Link href="/tutorial" className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl text-gold-400/80 hover:text-gold-300 hover:bg-white/5 transition-all border border-gold-700/30 hover:border-gold-500/50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="font-medium">Tutorial</span>
          </Link>
        </div>

        {/* Modos de Juego */}
        <div className="w-full max-w-4xl animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="text-center text-xl md:text-2xl font-[var(--font-cinzel)] text-celeste-300 mb-8 tracking-widest uppercase">
            Modos de Juego
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-4">
            {/* 1v1 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Image src="/Images/Vaca.png" alt="Modo 1v1 Truco Uruguayo" width={48} height={48} className="w-10 h-10 opacity-50 group-hover:opacity-80 transition-opacity" />
                </div>
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  1v1
                </div>
                <div className="text-sm text-white/60 tracking-wide">
                  Mano a mano
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold-500/60" />
                  <div className="w-2 h-2 rounded-full bg-gold-500/30" />
                </div>
              </div>
            </div>

            {/* 2v2 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Image src="/Images/TermoYMate.png" alt="Modo 2v2 Truco Uruguayo en equipo" width={48} height={48} className="w-10 h-10 opacity-50 group-hover:opacity-80 transition-opacity" />
                </div>
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  2v2
                </div>
                <div className="text-sm text-white/60 tracking-wide">
                  Equipos de dos
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-celeste-500/60" />
                  <div className="w-2 h-2 rounded-full bg-celeste-500/60" />
                  <div className="w-1 h-4 bg-gold-600/30 mx-1" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                </div>
              </div>
            </div>

            {/* 3v3 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Image src="/Images/Tambor.png" alt="Modo 3v3 Truco Uruguayo equipos de tres" width={48} height={48} className="w-10 h-10 opacity-50 group-hover:opacity-80 transition-opacity" />
                </div>
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  3v3
                </div>
                <div className="text-sm text-white/60 tracking-wide">
                  Equipos de tres
                </div>
                <div className="mt-4 flex justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-celeste-500/60" />
                  <div className="w-2 h-2 rounded-full bg-celeste-500/60" />
                  <div className="w-2 h-2 rounded-full bg-celeste-500/60" />
                  <div className="w-1 h-4 bg-gold-600/30 mx-1" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Caracteristicas con iconos uruguayos */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Image src="/Images/Vaca.png" alt="Truco Uruguayo a 30 puntos" width={36} height={36} className="w-9 h-9 opacity-70" />
            </div>
            <div className="text-2xl mb-1 text-celeste-400 font-bold">30</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Puntos</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Image src="/Images/MapaUruguayBandera.png" alt="Uruguay - Mazo de 40 cartas espanolas" width={36} height={36} className="w-9 h-9 opacity-70" />
            </div>
            <div className="text-2xl mb-1 text-celeste-400 font-bold">40</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Cartas</div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Image src="/Images/DulceDeLeche.png" alt="Truco Uruguayo mejor de 3 manos" width={36} height={36} className="w-9 h-9 opacity-70" />
            </div>
            <div className="text-2xl mb-1 text-celeste-400 font-bold">3</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Manos</div>
          </div>
        </div>

        {/* Seccion SEO - Contenido informativo */}
        <section className="mt-20 w-full max-w-4xl px-4 animate-fade-in" style={{ animationDelay: '1s' }}>
          <div className="glass rounded-2xl p-8 border border-celeste-600/20">
            <h2 className="text-2xl md:text-3xl font-[var(--font-cinzel)] text-gold-400 mb-6 text-center">
              Que es el Truco Uruguayo y Por Que Jugarlo Online
            </h2>

            <div className="text-white/80 space-y-4 text-sm md:text-base leading-relaxed">
              <p>
                El <strong>Truco Uruguayo</strong> es mucho mas que un simple juego de cartas: es parte fundamental de la
                identidad cultural de Uruguay. Desde las reuniones familiares en el campo hasta los bares de Montevideo,
                el truco ha sido durante generaciones el pasatiempo favorito de los orientales. Ahora, con nuestra
                plataforma de <strong>Truco Uruguayo online gratis</strong>, podes disfrutar de esta tradicion desde
                cualquier lugar del mundo.
              </p>

              <h3 className="text-xl font-[var(--font-cinzel)] text-celeste-300 mt-6 mb-3">
                Reglas del Truco Uruguayo: Lo Esencial
              </h3>
              <p>
                El truco se juega con un <strong>mazo espanol de 40 cartas</strong>, sin los ochos ni los nueves.
                Cada partida es al mejor de tres manos por ronda, y el objetivo es llegar a <strong>30 puntos</strong>.
                Lo que hace unico al truco uruguayo es el sistema de cantos: el <strong>Envido</strong> (donde se
                apuestan puntos segun las cartas del mismo palo), el <strong>Truco</strong> (que aumenta el valor de
                la ronda), y la <strong>Flor</strong> (tres cartas del mismo palo). Cada canto puede ser aceptado,
                rechazado o subido, creando una dinamica de farol y estrategia que hace al juego tan emocionante.
              </p>

              <h3 className="text-xl font-[var(--font-cinzel)] text-celeste-300 mt-6 mb-3">
                Modos de Juego Disponibles
              </h3>
              <p>
                En nuestra plataforma podes jugar en tres modalidades: <strong>1v1</strong> (mano a mano, el clasico
                duelo de ingenio), <strong>2v2</strong> (equipos de dos, donde la comunicacion con tu companero es
                clave), y <strong>3v3</strong> (equipos de tres, la modalidad mas popular en los torneos). Cada modo
                tiene su propia estrategia y nivel de complejidad, permitiendote elegir segun tu experiencia o la
                cantidad de amigos que quieran jugar.
              </p>

              <h3 className="text-xl font-[var(--font-cinzel)] text-celeste-300 mt-6 mb-3">
                Jerarquia de Cartas en el Truco
              </h3>
              <p>
                Conocer el valor de las cartas es fundamental. Las cartas mas poderosas son: el <strong>Ancho de
                Espadas</strong> (1 de espada), el <strong>Ancho de Bastos</strong> (1 de basto), el <strong>Siete
                de Espadas</strong> y el <strong>Siete de Oros</strong>. Luego siguen los treses, los doses, los
                ases de copa y oro, los reyes, caballos, sotas, y finalmente los sietes de copa y basto, los seis,
                cincos y cuatros. Dominar esta jerarquia te dara una ventaja importante en cada mano.
              </p>

              <h3 className="text-xl font-[var(--font-cinzel)] text-celeste-300 mt-6 mb-3">
                Por Que Elegir Nuestra Plataforma
              </h3>
              <p>
                Desarrollamos este <strong>juego de truco online</strong> pensando en los uruguayos que viven en el
                exterior y extranan las partidas con amigos, pero tambien para quienes quieren aprender o simplemente
                disfrutar de una buena partida sin salir de casa. Nuestra plataforma es <strong>100% gratis</strong>,
                no requiere descargas, y funciona en cualquier navegador. Ademas, las partidas son en tiempo real con
                tecnologia Socket.IO, garantizando una experiencia fluida y sin demoras.
              </p>
            </div>
          </div>
        </section>

        {/* Navegacion interna SEO-friendly */}
        <nav className="mt-12 w-full max-w-4xl px-4" aria-label="Navegacion principal del sitio">
          <div className="glass rounded-xl p-6 border border-celeste-600/20">
            <h2 className="text-lg font-[var(--font-cinzel)] text-gold-400 mb-4 text-center">
              Explora Truco Uruguayo Online
            </h2>
            <ul className="flex flex-wrap justify-center gap-4 text-sm">
              <li>
                <Link href="/lobby" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Crear o Unirse a Partida
                </Link>
              </li>
              <li>
                <Link href="/tutorial" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Tutorial de Truco Uruguayo
                </Link>
              </li>
              <li>
                <Link href="/practica" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Practicar contra la Computadora
                </Link>
              </li>
              <li>
                <Link href="/ranking" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Ranking de Jugadores
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* Enlaces externos de autoridad */}
        <aside className="mt-8 w-full max-w-4xl px-4 text-center">
          <p className="text-white/50 text-xs mb-2">Mas informacion sobre el truco:</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a
              href="https://es.wikipedia.org/wiki/Truco_(juego_de_naipes)"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celeste-400/70 hover:text-celeste-300 transition-colors underline"
            >
              Historia del Truco en Wikipedia
            </a>
            <a
              href="https://www.gub.uy/ministerio-turismo/cultura"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celeste-400/70 hover:text-celeste-300 transition-colors underline"
            >
              Cultura Uruguaya - Ministerio de Turismo
            </a>
          </div>
        </aside>

        {/* Footer */}
        <footer className="mt-16 text-center animate-fade-in w-full max-w-4xl" style={{ animationDelay: '1s' }}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-12 bg-celeste-600/30" />
            <Image src="/Images/SolDeMayo.png" alt="Sol de Mayo - Simbolo uruguayo" width={20} height={20} className="w-5 h-5 opacity-30" />
            <span className="text-celeste-400/60 text-xs">TRUCO URUGUAYO ONLINE</span>
            <Image src="/Images/SolDeMayo.png" alt="Sol de Mayo - Simbolo uruguayo" width={20} height={20} className="w-5 h-5 opacity-30" />
            <div className="h-px w-12 bg-celeste-600/30" />
          </div>
          <p className="text-white/40 text-xs tracking-widest mb-3">
            La tradicion del campo oriental
          </p>

          {/* Creditos del desarrollador */}
          <div className="border-t border-celeste-600/20 pt-4 mt-4">
            <p className="text-gold-400/70 text-sm mb-2">
              Desarrollado por <span className="font-semibold text-gold-400">Enzo Pontet</span>
            </p>
            <p className="text-white/40 text-xs mb-4">
              Queres colaborar o sugerir mejoras?
            </p>

            {/* Boton de sugerencias destacado */}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-600/30 hover:scale-105 active:scale-95 mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Enviar Sugerencia
            </button>

            <p className="text-white/30 text-xs">
              o escribinos a{' '}
              <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400/70 hover:text-celeste-300 transition-colors">
                enzopch2022@gmail.com
              </a>
            </p>
          </div>
        </footer>
      </div>

      {/* Modal de feedback */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
