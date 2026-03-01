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
      logo: 'w-36 h-36',
      text: 'text-sm',
    },
    md: {
      container: 'gap-4',
      logo: 'w-52 h-52',
      text: 'text-base',
    },
    lg: {
      container: 'gap-6',
      logo: 'w-64 h-64',
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
        {/* Logo oficial con animacion de pulso */}
        <div className="relative animate-logo-pulse">
          <Image
            src="/Images/LogoFinalTrucouruguayo.png"
            alt="Cargando Truco Uruguayo"
            width={256}
            height={256}
            className={`${s.logo} drop-shadow-[0_0_30px_rgba(252,209,22,0.4)]`}
            priority
          />
          {/* Brillo giratorio detras del logo */}
          <div className="absolute inset-0 -z-10 animate-spin-slow">
            <div className="absolute inset-[-8px] rounded-full bg-gradient-conic from-gold-400/20 via-transparent to-gold-400/20 blur-md" />
          </div>
        </div>

        {/* Texto de carga */}
        <p className={`${s.text} text-gold-400 font-medium tracking-wider animate-pulse mt-4`}>
          {text}
        </p>

        {/* Puntos animados */}
        <div className="flex gap-2 mt-2">
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      {/* Estilos de animacion */}
      <style jsx>{`
        @keyframes logo-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-logo-pulse {
          animation: logo-pulse 2s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
