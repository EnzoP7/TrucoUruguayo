'use client';

import { useEffect, useState } from 'react';
import { useUserPremium } from '@/hooks/useUserPremium';

interface AdInterstitialProps {
  // Slot de AdSense para intersticial
  adSlot?: string;
  // Callback cuando se cierra el anuncio
  onClose: () => void;
  // Tiempo mínimo antes de poder cerrar (segundos)
  minWaitTime?: number;
  // Modo test
  testMode?: boolean;
}

export default function AdInterstitial({
  adSlot,
  onClose,
  minWaitTime = 5,
  testMode = process.env.NODE_ENV === 'development',
}: AdInterstitialProps) {
  const [countdown, setCountdown] = useState(minWaitTime);
  const [canClose, setCanClose] = useState(false);
  const { isPremium, isLoading } = useUserPremium();

  useEffect(() => {
    // Usuarios premium: cerrar inmediatamente
    if (isPremium && !isLoading) {
      onClose();
      return;
    }

    // Countdown para poder cerrar
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanClose(true);
    }
  }, [countdown, isPremium, isLoading, onClose]);

  // No mostrar si es premium
  if (isPremium || isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="relative bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <span className="text-white/60 text-sm">Publicidad</span>
          {canClose ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-celeste-600 hover:bg-celeste-500 text-white text-sm font-medium transition-colors"
            >
              Continuar
            </button>
          ) : (
            <span className="text-white/40 text-sm">
              Continuar en {countdown}s
            </span>
          )}
        </div>

        {/* Ad Content */}
        <div className="p-4">
          {testMode ? (
            // Placeholder en desarrollo
            <div className="flex items-center justify-center bg-gray-800/50 border border-dashed border-gray-600 rounded-lg h-64">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-2">📺</div>
                <div className="text-sm">Anuncio Intersticial</div>
                <div className="text-xs opacity-60 mt-1">300x250</div>
              </div>
            </div>
          ) : (
            // AdSense real
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: 300, height: 250 }}
              data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
              data-ad-slot={adSlot}
              data-ad-format="auto"
            />
          )}
        </div>

        {/* Premium upsell */}
        <div className="p-4 bg-gradient-to-r from-gold-900/30 to-gold-800/20 border-t border-gold-600/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gold-400 font-medium text-sm">¿Sin anuncios?</div>
              <div className="text-white/50 text-xs">Hazte Premium y juega sin interrupciones</div>
            </div>
            <button
              onClick={() => {
                onClose();
                window.location.href = '/premium';
              }}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-black text-xs font-bold hover:from-gold-400 hover:to-gold-500 transition-all"
            >
              Ver planes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
