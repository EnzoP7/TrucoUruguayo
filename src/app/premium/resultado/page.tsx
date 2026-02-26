'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const PACK_NOMBRES: Record<string, string> = {
  'pack_500': '500 monedas',
  'pack_1200': '1,200 monedas',
  'pack_3000': '3,000 monedas',
  'pack_7500': '7,500 monedas',
};

function ResultadoContent() {
  const searchParams = useSearchParams();
  const status = searchParams?.get('status');
  const type = searchParams?.get('type') || 'premium';
  const pack = searchParams?.get('pack') || '';

  const esMonedas = type === 'monedas';
  const packNombre = PACK_NOMBRES[pack] || 'monedas';

  const config = {
    approved: {
      emoji: '\u2705',
      titulo: esMonedas ? 'Compra exitosa!' : 'Pago exitoso!',
      mensaje: esMonedas
        ? `Tu pack de ${packNombre} fue acreditado a tu cuenta. Ya podes usarlas para desbloquear cosmeticos en la tienda.`
        : 'Tu Pase Premium esta activo por 30 dias. Disfruta de todas las ventajas: sin anuncios, audios custom, cosmeticos exclusivos y bonus x1.5 en monedas y XP.',
      color: 'green',
    },
    failure: {
      emoji: '\u274C',
      titulo: 'Pago no procesado',
      mensaje: 'Hubo un problema con tu pago. No se realizo ningun cobro. Podes intentar de nuevo desde tu perfil.',
      color: 'red',
    },
    pending: {
      emoji: '\u23F3',
      titulo: 'Pago pendiente',
      mensaje: esMonedas
        ? 'Tu pago esta siendo procesado. Las monedas se acreditaran automaticamente cuando se confirme.'
        : 'Tu pago esta siendo procesado. Una vez confirmado, tu premium se activara automaticamente. Esto puede tomar unos minutos.',
      color: 'yellow',
    },
  }[status || 'failure'] || {
    emoji: '\u2753',
    titulo: 'Estado desconocido',
    mensaje: 'No pudimos determinar el estado de tu pago. Si realizaste un pago, se procesara automaticamente cuando se confirme.',
    color: 'yellow',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full border border-gold-800/20 text-center">
        <div className="text-6xl mb-4">{config.emoji}</div>
        <h1 className={`text-2xl font-bold mb-3 ${
          config.color === 'green' ? 'text-green-400' :
          config.color === 'red' ? 'text-red-400' :
          'text-yellow-400'
        }`}>
          {config.titulo}
        </h1>
        <p className="text-white/70 text-sm mb-8 leading-relaxed">
          {config.mensaje}
        </p>

        {status === 'approved' && !esMonedas && (
          <div className="mb-6 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
            <div className="text-gold-400 font-bold mb-2">{'\u{1F451}'} Beneficios Premium</div>
            <ul className="text-white/60 text-sm space-y-1 text-left">
              <li>- Sin anuncios (banners ni interstitials)</li>
              <li>- Audios personalizados</li>
              <li>- Cosmeticos exclusivos</li>
              <li>- Bonus x1.5 en monedas y XP</li>
              <li>- Personalizacion de mesa</li>
            </ul>
          </div>
        )}

        {status === 'approved' && esMonedas && (
          <div className="mb-6 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
            <div className="text-gold-400 font-bold mb-2">{'\u{1FA99}'} {packNombre} acreditadas</div>
            <p className="text-white/60 text-sm">
              Visita la tienda en tu perfil para desbloquear temas de mesa, reversos de cartas y marcos de avatar.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/perfil"
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            {esMonedas ? 'Ir a la Tienda' : 'Ir a Mi Perfil'}
          </Link>
          <Link
            href="/lobby"
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-celeste-600/30 text-celeste-300 border border-celeste-500/30 hover:bg-celeste-600/40 transition-all"
          >
            Ir al Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white/50">Cargando...</div>
      </div>
    }>
      <ResultadoContent />
    </Suspense>
  );
}
