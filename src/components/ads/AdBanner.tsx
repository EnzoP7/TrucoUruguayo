'use client';

import { useEffect, useRef, useState } from 'react';
import { useUserPremium } from '@/hooks/useUserPremium';

// Tipos de anuncios soportados
type AdSize = 'banner' | 'rectangle' | 'leaderboard' | 'skyscraper';

interface AdBannerProps {
  // Slot de AdSense (obtenerlo de Google AdSense)
  adSlot?: string;
  // Tamaño del anuncio
  size?: AdSize;
  // Clase CSS adicional
  className?: string;
  // Si se muestra en modo test (desarrollo)
  testMode?: boolean;
}

// Dimensiones según el tipo
const AD_SIZES: Record<AdSize, { width: number; height: number }> = {
  banner: { width: 468, height: 60 },
  rectangle: { width: 300, height: 250 },
  leaderboard: { width: 728, height: 90 },
  skyscraper: { width: 160, height: 600 },
};

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export default function AdBanner({
  adSlot,
  size = 'banner',
  className = '',
  testMode = process.env.NODE_ENV === 'development',
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const { isPremium, isLoading } = useUserPremium();

  useEffect(() => {
    // No mostrar anuncios a usuarios premium
    if (isPremium || isLoading) return;

    // En modo test, no cargar AdSense real
    if (testMode) {
      setAdLoaded(true);
      return;
    }

    // Cargar AdSense si no está cargado
    if (!adSlot) return;

    try {
      // Push ad
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      setAdLoaded(true);
    } catch (err) {
      console.error('Error loading AdSense:', err);
    }
  }, [isPremium, isLoading, adSlot, testMode]);

  // No mostrar nada mientras carga
  if (isLoading) return null;

  // Usuarios premium: no mostrar anuncios
  if (isPremium) return null;

  const { width, height } = AD_SIZES[size];

  // Modo test: mostrar placeholder
  if (testMode) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800/50 border border-dashed border-gray-600 rounded-lg text-gray-400 text-sm ${className}`}
        style={{ width, height, maxWidth: '100%' }}
      >
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider mb-1 opacity-60">Publicidad</div>
          <div className="text-xs opacity-40">{width}x{height}</div>
        </div>
      </div>
    );
  }

  // Producción: mostrar anuncio real de AdSense
  return (
    <div className={`ad-container ${className}`} style={{ maxWidth: '100%' }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width,
          height,
          maxWidth: '100%',
        }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      {!adLoaded && (
        <div
          className="flex items-center justify-center bg-gray-900/30 animate-pulse"
          style={{ width, height, maxWidth: '100%' }}
        >
          <span className="text-gray-500 text-xs">Cargando...</span>
        </div>
      )}
    </div>
  );
}
