'use client';

import Script from 'next/script';

interface AdSenseScriptProps {
  clientId?: string;
}

export default function AdSenseScript({ clientId }: AdSenseScriptProps) {
  const adsenseClientId = clientId || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  // No cargar en desarrollo si no hay client ID
  if (!adsenseClientId || process.env.NODE_ENV === 'development') {
    return null;
  }

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  );
}
