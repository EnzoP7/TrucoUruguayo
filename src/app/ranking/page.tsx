'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';

interface RankingEntry {
  apodo: string;
  elo: number;
  partidas_jugadas: number;
  partidas_ganadas: number;
  partidas_perdidas: number;
  mejor_racha: number;
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [miApodo, setMiApodo] = useState<string | null>(null);

  useEffect(() => {
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    if (savedUsuario) {
      try {
        setMiApodo(JSON.parse(savedUsuario).apodo);
      } catch { /* ignorar */ }
    }

    const cargarRanking = async () => {
      try {
        await socketService.connect();
        const result = await socketService.obtenerRanking();
        if (result.success) {
          setRanking(result.ranking);
        }
      } catch (err) {
        console.error('Error cargando ranking:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarRanking();
  }, []);

  const getMedalla = (pos: number) => {
    if (pos === 0) return '🥇';
    if (pos === 1) return '🥈';
    if (pos === 2) return '🥉';
    return `${pos + 1}`;
  };

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <Link href="/lobby" className="inline-block group">
            <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl font-bold text-gold-400 mb-2 group-hover:text-gold-300 transition-colors">
              Ranking
            </h1>
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gold-700/40" />
            <p className="text-gold-500/60 text-sm tracking-widest uppercase">Mejores jugadores</p>
            <div className="h-px w-8 bg-gold-700/40" />
          </div>
        </header>

        {/* Volver */}
        <Link href="/lobby" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm mb-6 transition-colors">
          ← Volver al lobby
        </Link>

        {/* Tabla */}
        <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
          {loading ? (
            <div className="text-center py-16">
              <div className="text-gold-400/60 text-lg">Cargando ranking...</div>
            </div>
          ) : ranking.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🏆</div>
              <p className="text-gold-300/50 text-lg">Aún no hay jugadores en el ranking</p>
              <p className="text-gold-500/30 text-sm mt-2">Jugá una partida para aparecer acá</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header de la tabla */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-gold-500/50 text-xs font-medium uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Jugador</div>
                <div className="col-span-2 text-center">ELO</div>
                <div className="col-span-2 text-center">V/D</div>
                <div className="col-span-1 text-center">%</div>
                <div className="col-span-2 text-center">Racha</div>
              </div>

              {ranking.map((entry, idx) => {
                const esSoyYo = miApodo && entry.apodo === miApodo;
                const winRate = entry.partidas_jugadas > 0
                  ? Math.round((Number(entry.partidas_ganadas) / Number(entry.partidas_jugadas)) * 100)
                  : 0;

                return (
                  <div
                    key={entry.apodo}
                    className={`grid grid-cols-12 gap-2 px-3 py-3 rounded-xl items-center transition-all ${
                      esSoyYo
                        ? 'bg-gold-600/20 border border-gold-500/30'
                        : idx < 3
                        ? 'bg-white/5 border border-gold-700/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="col-span-1 text-center">
                      <span className={`font-bold ${idx < 3 ? 'text-xl' : 'text-gold-400/60 text-sm'}`}>
                        {getMedalla(idx)}
                      </span>
                    </div>
                    <div className="col-span-4">
                      <span className={`font-medium ${esSoyYo ? 'text-gold-300' : 'text-white'}`}>
                        {entry.apodo}
                      </span>
                      {esSoyYo && <span className="text-gold-500/60 text-xs ml-2">(vos)</span>}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-gold-400 font-bold">{entry.elo}</span>
                    </div>
                    <div className="col-span-2 text-center text-sm">
                      <span className="text-green-400">{entry.partidas_ganadas}</span>
                      <span className="text-gold-600/40 mx-1">/</span>
                      <span className="text-red-400">{entry.partidas_perdidas}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`text-sm font-medium ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {winRate}%
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-yellow-400/70 text-sm">{entry.mejor_racha} 🔥</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
