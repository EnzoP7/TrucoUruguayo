'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Verificar si ya aceptó las cookies
    const cookieConsent = localStorage.getItem('cookie_consent');
    if (!cookieConsent) {
      // Pequeño delay para no mostrar inmediatamente
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setShowBanner(false);
  };

  const rejectCookies = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setShowBanner(false);
    // Aquí podrías deshabilitar cookies no esenciales si fuera necesario
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto glass rounded-2xl border border-gold-700/30 p-4 sm:p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🍪</span>
              <h3 className="font-bold text-gold-400">Usamos Cookies</h3>
            </div>
            <p className="text-sm text-gold-300/70 leading-relaxed">
              Utilizamos cookies propias y de terceros para mejorar tu experiencia,
              analizar el tráfico y mostrar publicidad personalizada.
              Al hacer clic en &quot;Aceptar&quot;, consentís el uso de todas las cookies.{' '}
              <Link href="/cookies" className="text-celeste-400 hover:text-celeste-300 underline">
                Más información
              </Link>
            </p>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={rejectCookies}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              Rechazar
            </button>
            <button
              onClick={acceptCookies}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 transition-all shadow-lg shadow-celeste-600/20"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
