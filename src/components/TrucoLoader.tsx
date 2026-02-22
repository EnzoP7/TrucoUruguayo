'use client';

import Image from 'next/image';

interface TrucoLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function TrucoLoader({ text = 'Cargando...', size = 'md', fullScreen = true }: TrucoLoaderProps) {
  const sizeClasses = {
    sm: {
      container: 'gap-3',
      sun: 'w-12 h-12',
      card: 'w-10 h-14',
      text: 'text-sm',
    },
    md: {
      container: 'gap-4',
      sun: 'w-16 h-16',
      card: 'w-14 h-20',
      text: 'text-base',
    },
    lg: {
      container: 'gap-6',
      sun: 'w-24 h-24',
      card: 'w-16 h-24',
      text: 'text-lg',
    },
  };

  const s = sizeClasses[size];

  const containerClass = fullScreen
    ? "flex flex-col items-center justify-center min-h-screen bg-table-wood"
    : "flex flex-col items-center justify-center py-12";

  return (
    <div className={containerClass}>
      {/* Efectos de luz ambiente */}
      {fullScreen && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-celeste-500/10 via-celeste-600/5 to-transparent rounded-full blur-3xl" />
        </div>
      )}

      <div className={`relative flex flex-col items-center ${s.container} z-10`}>
        {/* Contenedor de cartas y sol */}
        <div className="relative flex items-center justify-center h-32">
          {/* Carta izquierda */}
          <div
            className={`${s.card} card-back rounded-lg shadow-xl animate-card-left absolute`}
            style={{ transformOrigin: 'center bottom' }}
          />

          {/* Sol de Mayo central */}
          <div className="relative z-10 animate-sun-pulse">
            <Image
              src="/Images/SolDeMayo.png"
              alt="Cargando Truco Uruguayo"
              width={96}
              height={96}
              className={`${s.sun} drop-shadow-[0_0_30px_rgba(252,209,22,0.6)]`}
              priority
            />
          </div>

          {/* Carta derecha */}
          <div
            className={`${s.card} card-back rounded-lg shadow-xl animate-card-right absolute`}
            style={{ transformOrigin: 'center bottom' }}
          />
        </div>

        {/* Texto de carga */}
        <p className={`${s.text} text-gold-400 font-medium tracking-wider animate-pulse mt-6`}>
          {text}
        </p>

        {/* Puntos animados */}
        <div className="flex gap-2 mt-2">
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
