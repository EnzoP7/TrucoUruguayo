'use client';

import Image from 'next/image';

interface FooterProps {
  className?: string;
  minimal?: boolean;
}

export default function Footer({ className = '', minimal = false }: FooterProps) {
  if (minimal) {
    return (
      <footer className={`text-center py-4 ${className}`}>
        <p className="text-gold-400/50 text-xs">
          Desarrollado por <span className="text-gold-400/70">Enzo Pontet</span>
        </p>
      </footer>
    );
  }

  return (
    <footer className={`text-center w-full max-w-4xl mx-auto ${className}`}>
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
        <p className="text-white/40 text-xs mb-3">
          Queres colaborar o sugerir mejoras?
        </p>
        <a
          href="mailto:enzopch2022@gmail.com"
          className="inline-flex items-center gap-2 text-celeste-400/80 hover:text-celeste-300 text-sm transition-colors group"
        >
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          enzopch2022@gmail.com
        </a>
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
  );
}
