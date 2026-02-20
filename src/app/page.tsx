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

          <h1 className="font-[var(--font-cinzel)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-gold-400 mb-4 tracking-wider">
            <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              Truco Uruguayo
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gold-200/70 font-light tracking-widest uppercase">
            La tradicion oriental en tiempo real
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

          {/* Texto SEO oculto visualmente pero legible por bots */}
          <div className="sr-only">
            <h2>Truco Uruguayo Online - El mejor juego de cartas uruguayo</h2>
            <p>
              Juga al Truco Uruguayo gratis online con amigos. El autentico juego de cartas tradicional
              de Uruguay ahora disponible en tu navegador. Modos de juego: 1v1 mano a mano, 2v2 equipos
              de dos, 3v3 equipos de tres. Incluye todas las reglas del truco uruguayo: Envido, Real Envido,
              Falta Envido, Truco, Retruco, Vale Cuatro, Flor y Contraflor. Mazo espanol de 40 cartas.
              Juego a 30 puntos. Multijugador en tiempo real con Socket.IO.
            </p>
          </div>
        </footer>
      </div>

      {/* Modal de feedback */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
