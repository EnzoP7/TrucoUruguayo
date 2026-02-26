'use client';

import { useEffect, useState } from 'react';
import { useUserPremium } from '@/hooks/useUserPremium';

interface RewardedAdProps {
  adSlot?: string;
  rewardAmount: number;
  onRewardEarned: () => void;
  onCancel: () => void;
  testMode?: boolean;
}

export default function RewardedAd({
  adSlot,
  rewardAmount,
  onRewardEarned,
  onCancel,
  testMode = process.env.NODE_ENV === 'development',
}: RewardedAdProps) {
  const [countdown, setCountdown] = useState(15);
  const [completed, setCompleted] = useState(false);
  const { isPremium, isLoading } = useUserPremium();

  useEffect(() => {
    if (isPremium && !isLoading) {
      onCancel();
      return;
    }

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCompleted(true);
    }
  }, [countdown, isPremium, isLoading, onCancel]);

  if (isPremium || isLoading) return null;

  const progressPercent = ((15 - countdown) / 15) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="relative bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Anuncio Recompensado</span>
            <span className="text-gold-400 text-sm font-bold">+{rewardAmount} &#x1FA99;</span>
          </div>
          {completed ? (
            <button
              onClick={onRewardEarned}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-bold hover:from-gold-400 hover:to-gold-500 transition-all animate-pulse"
            >
              Reclamar +{rewardAmount}
            </button>
          ) : (
            <span className="text-white/40 text-sm">
              Espera {countdown}s
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Ad Content */}
        <div className="p-4">
          {testMode ? (
            <div className="flex items-center justify-center bg-gray-800/50 border border-dashed border-gray-600 rounded-lg h-64">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-2">&#x1F4FA;</div>
                <div className="text-sm">Anuncio Recompensado</div>
                <div className="text-xs opacity-60 mt-1">300x250</div>
                {!completed && (
                  <div className="mt-3 text-gold-400 text-lg font-bold">{countdown}s</div>
                )}
              </div>
            </div>
          ) : (
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: 300, height: 250 }}
              data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
              data-ad-slot={adSlot}
              data-ad-format="auto"
            />
          )}
        </div>

        {/* Reward info / Cancel */}
        <div className="p-4 border-t border-gray-700">
          {completed ? (
            <div className="text-center">
              <p className="text-gold-400 font-bold text-lg mb-2">&#x1FA99; Anuncio completado</p>
              <p className="text-white/60 text-sm">Clickea &quot;Reclamar&quot; para recibir tus monedas</p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/70 text-sm">Al completar ganas <span className="text-gold-400 font-bold">+{rewardAmount} monedas</span></div>
                <div className="text-white/40 text-xs mt-0.5">No cierres el anuncio para recibir la recompensa</div>
              </div>
              <button
                onClick={onCancel}
                className="text-white/30 hover:text-white/60 text-xs underline transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
