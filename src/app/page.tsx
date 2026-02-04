'use client';

import Link from 'next/link';

// Componente SVG del Sol de Mayo
function SolDeMayo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="currentColor"
    >
      {/* Rayos del sol */}
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i * 360) / 32;
        const isLong = i % 2 === 0;
        const length = isLong ? 95 : 75;
        const width = isLong ? 3 : 2;
        return (
          <rect
            key={i}
            x={100 - width / 2}
            y={5}
            width={width}
            height={length - 50}
            transform={`rotate(${angle} 100 100)`}
            rx={1}
          />
        );
      })}
      {/* Círculo central */}
      <circle cx="100" cy="100" r="35" />
      {/* Cara del sol */}
      <circle cx="90" cy="95" r="4" fill="#1a0f0a" />
      <circle cx="110" cy="95" r="4" fill="#1a0f0a" />
      <path
        d="M 85 108 Q 100 120 115 108"
        fill="none"
        stroke="#1a0f0a"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Componente de Mate decorativo
function MateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor">
      <path d="M32 8c-8 0-14 2-14 6v4c0 2 2 4 4 5l2 25c0 8 4 12 8 12s8-4 8-12l2-25c2-1 4-3 4-5v-4c0-4-6-6-14-6zm0 4c6 0 10 1 10 2s-4 2-10 2-10-1-10-2 4-2 10-2z" />
      <path d="M44 16c4 0 8 4 8 10s-4 10-8 10" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-table-wood overflow-hidden relative">
      {/* Efectos de luz ambiente de pulpería */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Luz cálida superior (lámpara de queroseno) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-amber-500/10 via-amber-600/5 to-transparent rounded-full blur-3xl" />
        {/* Reflejos de madera */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-wood-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-wood-600/10 rounded-full blur-3xl" />
        {/* Resplandor del fieltro */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-felt-800/20 rounded-full blur-3xl" />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">

        {/* Sol de Mayo decorativo de fondo */}
        <div className="absolute top-8 right-8 opacity-10 pointer-events-none hidden lg:block">
          <SolDeMayo className="w-48 h-48 text-gold-500 animate-rotate-slow" />
        </div>

        {/* Hero Section */}
        <div className="text-center mb-8 animate-fade-in">
          {/* Sol de Mayo arriba del título */}
          <div className="flex justify-center mb-4">
            <SolDeMayo className="w-20 h-20 md:w-28 md:h-28 text-gold-500 sun-glow" />
          </div>

          <h1 className="font-[var(--font-cinzel)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-gold-400 mb-4 tracking-wider">
            <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              Truco Uruguayo
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gold-200/70 font-light tracking-widest uppercase">
            La tradición oriental en tiempo real
          </p>

          {/* Línea decorativa */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent to-gold-600/50" />
            <MateIcon className="w-6 h-6 text-gold-600/60" />
            <div className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent to-gold-600/50" />
          </div>
        </div>

        {/* Cartas decorativas en abanico */}
        <div className="relative w-80 md:w-96 h-48 md:h-56 mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {/* Carta izquierda */}
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{
              left: '10%',
              top: '20px',
              transform: 'rotate(-20deg)',
              animationDelay: '0s'
            }}
          />

          {/* Carta central */}
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{
              left: '50%',
              marginLeft: '-56px',
              top: '0',
              transform: 'rotate(0deg)',
              animationDelay: '0.3s',
              zIndex: 2
            }}
          />

          {/* Carta derecha */}
          <div
            className="card-back absolute w-28 md:w-32 h-40 md:h-48 rounded-lg animate-float shadow-card-hover"
            style={{
              right: '10%',
              top: '20px',
              transform: 'rotate(20deg)',
              animationDelay: '0.6s'
            }}
          />
        </div>

        {/* Botón CTA principal */}
        <div className="mb-16 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Link href="/lobby" className="group relative inline-block">
            {/* Glow effect */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 rounded-2xl opacity-60 group-hover:opacity-100 blur-md animate-pulse-glow transition-opacity duration-300" />

            <button className="relative px-12 md:px-16 py-5 md:py-6 bg-gradient-to-br from-gold-700 via-gold-600 to-gold-500 text-wood-950 text-xl md:text-2xl font-[var(--font-cinzel)] font-bold rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 active:scale-95 border-2 border-gold-400/30">
              <span className="relative z-10 drop-shadow-sm">Jugar Ahora</span>
            </button>
          </Link>
        </div>

        {/* Modos de Juego */}
        <div className="w-full max-w-4xl animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="text-center text-xl md:text-2xl font-[var(--font-cinzel)] text-gold-300/80 mb-8 tracking-widest uppercase">
            Modos de Juego
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-4">
            {/* 1v1 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-white/10 transition-all duration-300 group cursor-pointer border border-gold-700/20 hover:border-gold-600/40">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-gold-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  1v1
                </div>
                <div className="text-sm text-gold-200/50 tracking-wide">
                  Mano a mano
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gold-500/60" />
                  <div className="w-2 h-2 rounded-full bg-gold-500/30" />
                </div>
              </div>
            </div>

            {/* 2v2 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-white/10 transition-all duration-300 group cursor-pointer border border-gold-700/20 hover:border-gold-600/40">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-gold-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  2v2
                </div>
                <div className="text-sm text-gold-200/50 tracking-wide">
                  Equipos de dos
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="w-1 h-4 bg-gold-600/30 mx-1" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                </div>
              </div>
            </div>

            {/* 3v3 */}
            <div className="glass relative rounded-xl p-6 md:p-8 hover:bg-white/10 transition-all duration-300 group cursor-pointer border border-gold-700/20 hover:border-gold-600/40">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-[var(--font-cinzel)] font-bold text-gold-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  3v3
                </div>
                <div className="text-sm text-gold-200/50 tracking-wide">
                  Equipos de tres
                </div>
                <div className="mt-4 flex justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="w-1 h-4 bg-gold-600/30 mx-1" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Características */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <div className="text-center">
            <div className="text-2xl mb-2 text-gold-500">30</div>
            <div className="text-xs text-gold-200/40 uppercase tracking-wider">Puntos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2 text-gold-500">40</div>
            <div className="text-xs text-gold-200/40 uppercase tracking-wider">Cartas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2 text-gold-500">3</div>
            <div className="text-xs text-gold-200/40 uppercase tracking-wider">Manos</div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center animate-fade-in" style={{ animationDelay: '1s' }}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-12 bg-gold-700/30" />
            <span className="text-gold-600/40 text-xs">TRUCO URUGUAYO ONLINE</span>
            <div className="h-px w-12 bg-gold-700/30" />
          </div>
          <p className="text-gold-200/20 text-xs tracking-widest">
            La tradición del campo oriental
          </p>
        </footer>
      </div>
    </div>
  );
}
