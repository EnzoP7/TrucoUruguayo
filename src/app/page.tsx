'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FeedbackModal from '@/components/FeedbackModal';

export default function HomePage() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="h-screen bg-table-wood overflow-hidden relative flex flex-col">
      {/* Efectos de luz ambiente */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-celeste-500/15 via-celeste-600/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-celeste-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-celeste-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-celeste-900/20 rounded-full blur-3xl" />
      </div>

      {/* Imagenes decorativas flotantes de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-16 left-8 opacity-[0.25] hidden lg:block">
          <Image src="/Images/Tero.png" alt="Tero - Ave nacional de Uruguay" width={120} height={120} className="animate-float" style={{ animationDelay: '1s' }} />
        </div>
        <div className="absolute bottom-12 right-8 opacity-[0.22] hidden lg:block">
          <Image src="/Images/Vaca.png" alt="Vaca - Simbolo ganadero uruguayo" width={140} height={100} className="animate-float" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute bottom-20 left-12 opacity-[0.22] hidden xl:block">
          <Image src="/Images/Tambor.png" alt="Tambor de candombe uruguayo" width={80} height={100} className="animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="absolute top-20 right-16 opacity-[0.22] hidden xl:block">
          <Image src="/Images/Faro.png" alt="Faro de Punta del Este" width={90} height={110} className="animate-float" style={{ animationDelay: '1.5s' }} />
        </div>
      </div>

      {/* Contenido principal - flex-1 para ocupar espacio disponible */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4">

        {/* Hero Section compacto */}
        <div className="text-center mb-4 md:mb-6 animate-fade-in">
          <div className="flex justify-center mb-2 md:mb-3">
            <Image
              src="/Images/LogoFinalTrucouruguayo.png"
              alt="Truco Uruguayo Online"
              width={280}
              height={280}
              className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
              priority
            />
          </div>

          <h1 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gold-400 mb-1.5 md:mb-2 tracking-wider">
            <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              Juga Gratis con Amigos
            </span>
          </h1>

          <p className="text-sm md:text-base lg:text-lg text-gold-200/70 font-light tracking-widest uppercase">
            El auténtico juego de cartas uruguayo en tiempo real
          </p>

          {/* Linea decorativa con mate */}
          <div className="flex items-center justify-center gap-4 mt-3 md:mt-4">
            <div className="h-px w-12 md:w-20 bg-gradient-to-r from-transparent to-gold-600/50" />
            <Image src="/Images/TermoYMate.png" alt="Mate uruguayo" width={28} height={28} className="w-5 h-5 md:w-6 md:h-6 opacity-60" />
            <div className="h-px w-12 md:w-20 bg-gradient-to-l from-transparent to-gold-600/50" />
          </div>
        </div>

        {/* Botones CTA */}
        <div className="mb-5 md:mb-8 animate-slide-up flex flex-col sm:flex-row gap-3 items-center" style={{ animationDelay: '0.2s' }}>
          <Link href="/lobby" className="group relative inline-block">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 rounded-2xl opacity-60 group-hover:opacity-100 blur-md animate-pulse-glow transition-opacity duration-300" />
            <button className="relative px-10 md:px-14 py-4 md:py-5 bg-gradient-to-br from-gold-700 via-gold-600 to-gold-500 text-wood-950 text-lg md:text-xl lg:text-2xl font-[var(--font-cinzel)] font-bold rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 active:scale-95 border-2 border-gold-400/30">
              <span className="relative z-10 drop-shadow-sm">Jugar Ahora</span>
            </button>
          </Link>
          <Link href="/tutorial" className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-gold-400/80 hover:text-gold-300 hover:bg-white/5 transition-all border border-gold-700/30 hover:border-gold-500/50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="font-medium text-sm">Tutorial</span>
          </Link>
        </div>

        {/* Modos de Juego - compactos en fila */}
        <div className="w-full max-w-3xl animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="grid grid-cols-3 gap-3 md:gap-5 px-2 md:px-4">
            {/* 1v1 */}
            <Link href="/lobby" className="glass relative rounded-xl p-3 md:p-5 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-1 group-hover:scale-110 transition-transform duration-300">
                  1v1
                </div>
                <div className="text-xs md:text-sm text-white/60 tracking-wide">
                  Mano a mano
                </div>
                <div className="mt-2 flex justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-500/30" />
                </div>
              </div>
            </Link>

            {/* 2v2 */}
            <Link href="/lobby" className="glass relative rounded-xl p-3 md:p-5 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-1 group-hover:scale-110 transition-transform duration-300">
                  2v2
                </div>
                <div className="text-xs md:text-sm text-white/60 tracking-wide">
                  Equipos de dos
                </div>
                <div className="mt-2 flex justify-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-celeste-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-celeste-500/60" />
                  <div className="w-0.5 h-3 bg-gold-600/30 mx-0.5" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                </div>
              </div>
            </Link>

            {/* 3v3 */}
            <Link href="/lobby" className="glass relative rounded-xl p-3 md:p-5 hover:bg-celeste-900/20 transition-all duration-300 group cursor-pointer border border-celeste-600/30 hover:border-celeste-500/50">
              <div className="text-center">
                <div className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-cinzel)] font-bold text-celeste-400 mb-1 group-hover:scale-110 transition-transform duration-300">
                  3v3
                </div>
                <div className="text-xs md:text-sm text-white/60 tracking-wide">
                  Equipos de tres
                </div>
                <div className="mt-2 flex justify-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-celeste-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-celeste-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-celeste-500/60" />
                  <div className="w-0.5 h-3 bg-gold-600/30 mx-0.5" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Stats inline */}
        <div className="mt-4 md:mt-6 flex items-center gap-6 md:gap-10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold text-celeste-400">30</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider">Puntos</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold text-celeste-400">40</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider">Cartas</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold text-celeste-400">3</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider">Manos</span>
          </div>
        </div>
      </div>

      {/* Footer compacto fijo al fondo */}
      <div className="relative z-10 pb-3 md:pb-4 pt-2">
        <div className="flex items-center justify-center gap-2 text-xs text-white/40">
          <Image src="/Images/SolDeMayo.png" alt="Sol de Mayo" width={14} height={14} className="w-3.5 h-3.5 opacity-30" />
          <span className="tracking-widest uppercase text-[10px]">Truco Uruguayo Online</span>
          <span className="text-white/20">·</span>
          <span>por <span className="text-gold-400/70 font-medium">Enzo Pontet</span></span>
          <span className="text-white/20">·</span>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="text-celeste-400/70 hover:text-celeste-300 transition-colors underline underline-offset-2"
          >
            Sugerencias
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Contenido SEO oculto visualmente - solo para buscadores */}
      {/* ============================================================= */}
      <div className="sr-only" aria-hidden="false">
        <section>
          <h2>Qué es el Truco Uruguayo y Por Qué Jugarlo Online</h2>
          <p>
            El Truco Uruguayo es mucho más que un simple juego de cartas: es parte fundamental de la
            identidad cultural de Uruguay. Desde las reuniones familiares en el campo hasta los bares de Montevideo,
            el truco ha sido durante generaciones el pasatiempo favorito de los orientales. Ahora, con nuestra
            plataforma de truco uruguayo online gratis, podés disfrutar de esta tradición desde
            cualquier lugar del mundo.
          </p>
          <p>
            El truco llegó a Uruguay durante la época colonial, probablemente traído por inmigrantes españoles e italianos.
            Con el tiempo, el juego fue adaptándose a las costumbres locales, desarrollando reglas y expresiones propias
            que lo diferencian del truco argentino o español. El truco uruguayo se caracteriza por su sistema de cantos
            único y por la importancia del farol y la picardía criolla en cada jugada.
          </p>

          <h3>Reglas del Truco Uruguayo: Lo Esencial</h3>
          <p>
            El truco se juega con un mazo español de 40 cartas, sin los ochos ni los nueves.
            Cada partida es al mejor de tres manos por ronda, y el objetivo es llegar a 30 puntos.
            Lo que hace único al truco uruguayo es el sistema de cantos: el Envido (donde se
            apuestan puntos según las cartas del mismo palo), el Truco (que aumenta el valor de
            la ronda), y la Flor (tres cartas del mismo palo). Cada canto puede ser aceptado,
            rechazado o subido, creando una dinámica de farol y estrategia que hace al juego tan emocionante.
          </p>
          <p>
            Las rondas se disputan al mejor de tres manos. En cada mano, los jugadores tiran una carta por turno
            y gana quien tenga la carta de mayor valor según la jerarquía del truco. Si hay empate (parda), la
            ventaja pasa al jugador que es mano en esa ronda. Dominar estos conceptos básicos es el primer paso
            para convertirse en un buen jugador de truco uruguayo online.
          </p>

          <h3>El Sistema de Cantos: Envido, Truco y Flor</h3>
          <p>
            El Envido se canta antes de jugar la primera carta y se basa en sumar los puntos de
            las dos cartas más altas del mismo palo. Las figuras (10, 11, 12) valen cero, y el resto vale su número.
            Si tenés tres cartas del mismo palo, podés cantar Flor, que vale más puntos. El envido básico vale 2 puntos,
            pero puede subirse a Real Envido (3 puntos) o Falta Envido (los puntos que faltan para ganar).
          </p>
          <p>
            El canto de Truco aumenta el valor de la ronda de 1 a 2 puntos. El rival puede aceptar (quiero),
            rechazar (no quiero, perdiendo 1 punto), o subir la apuesta cantando Retruco (3 puntos) o Vale Cuatro
            (4 puntos). Esta escalada de apuestas es donde el truco uruguayo muestra toda su intensidad psicológica.
          </p>

          <h3>Modos de Juego Disponibles</h3>
          <p>
            En nuestra plataforma podés jugar en tres modalidades: 1v1 (mano a mano, el clásico
            duelo de ingenio), 2v2 (equipos de dos, donde la comunicación con tu compañero es
            clave), y 3v3 (equipos de tres, la modalidad más popular en los torneos). Cada modo
            tiene su propia estrategia y nivel de complejidad, permitiéndote elegir según tu experiencia o la
            cantidad de amigos que quieran jugar.
          </p>
          <p>
            El modo 2v2 es especialmente interesante porque introduce las señas: gestos sutiles que los compañeros
            usan para comunicarse sin que los rivales se den cuenta. Levantar las cejas, fruncir los labios o mover
            los ojos de cierta manera puede indicar qué cartas tenés. Aprender y reconocer estas señas es parte
            fundamental del truco uruguayo en equipo.
          </p>

          <h3>Jerarquía de Cartas en el Truco Uruguayo</h3>
          <p>
            Conocer el valor de las cartas es fundamental para ganar. Las cartas más poderosas son: el Ancho de
            Espadas (1 de espada), el Ancho de Bastos (1 de basto), el Siete
            de Espadas y el Siete de Oros. Luego siguen los treses, los doses, los
            ases de copa y oro, los reyes, caballos, sotas, y finalmente los sietes de copa y basto, los seis,
            cincos y cuatros. Dominar esta jerarquía te dará una ventaja importante en cada mano.
          </p>

          <h3>Expresiones y Cultura del Truco</h3>
          <p>
            El truco uruguayo tiene su propio vocabulario: se dice quiero para aceptar, no quiero para rechazar,
            me voy al mazo cuando te retirás de la ronda, y son buenas cuando reconocés que el rival tiene mejor
            envido. Estas expresiones son parte del encanto del juego y las vas a escuchar (y usar) constantemente
            mientras jugás truco uruguayo online con amigos.
          </p>

          <h3>Consejos para Principiantes</h3>
          <p>
            Si recién empezás a jugar truco uruguayo online, te recomendamos comenzar con partidas 1v1 para
            aprender la mecánica básica sin la presión del equipo. Prestá atención a qué cartas ya se jugaron
            para calcular las probabilidades, y no tengas miedo de farolear: el engaño es parte legítima del juego.
          </p>
        </section>

        <nav aria-label="Navegación principal del sitio">
          <h2>Explorá Truco Uruguayo Online</h2>
          <ul>
            <li><Link href="/lobby">Crear o Unirse a Partida</Link></li>
            <li><Link href="/tutorial">Tutorial de Truco Uruguayo</Link></li>
            <li><Link href="/practica">Practicar contra la Computadora</Link></li>
            <li><Link href="/ranking">Ranking de Jugadores</Link></li>
            <li><Link href="/tutorial">Reglas Oficiales del Truco</Link></li>
            <li><Link href="/perfil">Mi Perfil de Jugador</Link></li>
            <li><Link href="/perfil">Estadísticas de Partidas</Link></li>
            <li><Link href="/lobby">Torneos de Truco</Link></li>
          </ul>
        </nav>

        <aside>
          <p>Más información sobre el truco y Uruguay:</p>
          <a href="https://es.wikipedia.org/wiki/Truco_(juego_de_naipes)" target="_blank" rel="noopener noreferrer">
            Historia del Truco en Wikipedia
          </a>
          <a href="https://www.gub.uy/ministerio-turismo/cultura" target="_blank" rel="noopener noreferrer">
            Cultura Uruguaya - Ministerio de Turismo
          </a>
          <a href="https://es.wikipedia.org/wiki/Baraja_espa%C3%B1ola" target="_blank" rel="noopener noreferrer">
            Baraja Española - Wikipedia
          </a>
          <a href="https://www.uruguaynatural.com/es/que-hacer/cultura" target="_blank" rel="noopener noreferrer">
            Uruguay Natural - Cultura
          </a>
        </aside>
      </div>

      {/* Modal de feedback */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
