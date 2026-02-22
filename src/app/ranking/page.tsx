'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import socketService from '@/lib/socket';

interface RankingEntry {
  id: number;
  apodo: string;
  elo: number;
  partidas_jugadas: number;
  partidas_ganadas: number;
  partidas_perdidas: number;
  mejor_racha: number;
  avatar_url?: string | null;
}

interface Amigo {
  id: number;
  apodo: string;
}

// Icono de persona agregada
function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

// Icono de check
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Icono de trofeo
function TrophyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C13.1 2 14 2.9 14 4H19C19.55 4 20 4.45 20 5V8C20 10.21 18.21 12 16 12C15.76 12 15.53 11.97 15.3 11.93C14.74 13.13 13.78 14.11 12.58 14.67L13 17H16C16.55 17 17 17.45 17 18V21C17 21.55 16.55 22 16 22H8C7.45 22 7 21.55 7 21V18C7 17.45 7.45 17 8 17H11L11.42 14.67C10.22 14.11 9.26 13.13 8.7 11.93C8.47 11.97 8.24 12 8 12C5.79 12 4 10.21 4 8V5C4 4.45 4.45 4 5 4H10C10 2.9 10.9 2 12 2ZM6 6V8C6 9.1 6.9 10 8 10C8.07 10 8.14 10 8.2 9.99C8.07 9.36 8 8.69 8 8V6H6ZM16 6H16V8C16 8.69 15.93 9.36 15.8 9.99C15.86 10 15.93 10 16 10C17.1 10 18 9.1 18 8V6H16Z"/>
    </svg>
  );
}

// Icono de fuego
function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 23C10.14 23 8.36 22.36 6.95 21.12C5.54 19.88 4.68 18.2 4.53 16.36C4.38 14.52 4.93 12.7 6.07 11.22C6.61 10.47 7.26 9.82 8 9.28V7L10 9L8 11V12.08C8.63 11.44 9.33 10.89 10.12 10.5C11.58 9.7 13.04 9.57 14.42 10.11C15.8 10.66 16.75 11.68 17.32 12.96C18.27 15.18 17.87 17.83 16.25 19.68C14.94 21.19 13.22 22.47 11.24 22.92C11.5 22.97 11.75 23 12 23M12 2C12.74 3.76 12.26 5.93 10.84 7.26C10.13 7.91 9.27 8.37 8.36 8.6C8.78 8.09 9.27 7.64 9.82 7.26C10.53 6.79 11.05 6.06 11.21 5.22C11.28 4.8 11.25 4.36 11.13 3.95C10.64 4.47 10.23 5.07 9.93 5.73C9.04 7.48 7.46 8.74 5.58 9.15C5.04 9.28 4.5 9.32 3.96 9.28C4.5 8.55 5.15 7.91 5.88 7.37C7.72 6.03 9.07 4.18 9.72 2.05L10 1.29C10.64 1.68 11.35 1.93 12 2Z"/>
    </svg>
  );
}

// Icono de corona
function CrownIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.55 18.55 20 18 20H6C5.45 20 5 19.55 5 19V18H19V19Z"/>
    </svg>
  );
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [miApodo, setMiApodo] = useState<string | null>(null);
  const [miId, setMiId] = useState<number | null>(null);
  const [amigosIds, setAmigosIds] = useState<Set<number>>(new Set());
  const [agregando, setAgregando] = useState<number | null>(null);
  const [agregados, setAgregados] = useState<Set<number>>(new Set());

  useEffect(() => {
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    if (savedUsuario) {
      try {
        const usuario = JSON.parse(savedUsuario);
        setMiApodo(usuario.apodo);
        setMiId(usuario.id);
      } catch { /* ignorar */ }
    }

    const cargarDatos = async () => {
      try {
        await socketService.connect();

        // Cargar ranking y amigos en paralelo
        const [rankingResult, amigosResult] = await Promise.all([
          socketService.obtenerRanking(),
          socketService.obtenerAmigos()
        ]);

        if (rankingResult.success) {
          setRanking(rankingResult.ranking);
        }

        if (amigosResult.success && amigosResult.amigos) {
          const idsAmigos = new Set<number>(amigosResult.amigos.map((a: Amigo) => Number(a.id)));
          setAmigosIds(idsAmigos);
        }
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  const handleAgregarAmigo = async (userId: number) => {
    if (agregando) return;
    setAgregando(userId);

    try {
      const result = await socketService.agregarAmigo(userId);
      if (result.success) {
        setAmigosIds(prev => new Set(prev).add(userId));
        setAgregados(prev => new Set(prev).add(userId));
      }
    } catch (err) {
      console.error('Error agregando amigo:', err);
    } finally {
      setAgregando(null);
    }
  };

  const getWinRate = (entry: RankingEntry) => {
    return entry.partidas_jugadas > 0
      ? Math.round((Number(entry.partidas_ganadas) / Number(entry.partidas_jugadas)) * 100)
      : 0;
  };

  const getRankTier = (elo: number) => {
    if (elo >= 2000) return { name: 'Leyenda', color: 'from-yellow-400 to-amber-600', textColor: 'text-yellow-400' };
    if (elo >= 1700) return { name: 'Diamante', color: 'from-cyan-400 to-blue-600', textColor: 'text-cyan-400' };
    if (elo >= 1500) return { name: 'Platino', color: 'from-slate-300 to-slate-500', textColor: 'text-slate-300' };
    if (elo >= 1300) return { name: 'Oro', color: 'from-yellow-500 to-yellow-700', textColor: 'text-yellow-500' };
    if (elo >= 1100) return { name: 'Plata', color: 'from-gray-300 to-gray-500', textColor: 'text-gray-300' };
    return { name: 'Bronce', color: 'from-amber-700 to-amber-900', textColor: 'text-amber-600' };
  };

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      {/* Efectos de luz ambiente */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-yellow-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-gradient-radial from-celeste-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-0 w-[300px] h-[400px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Decoraciones flotantes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-10 opacity-10 hidden lg:block">
          <TrophyIcon className="w-32 h-32 text-yellow-500 animate-float" />
        </div>
        <div className="absolute bottom-20 left-10 opacity-10 hidden lg:block">
          <CrownIcon className="w-24 h-24 text-yellow-600 animate-float" style={{ animationDelay: '1s' }} />
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header mejorado */}
        <header className="text-center mb-10">
          <Link href="/lobby" className="inline-block group">
            <div className="flex items-center justify-center gap-4 mb-3">
              <TrophyIcon className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
              <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                Ranking
              </h1>
              <TrophyIcon className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />
            </div>
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/50" />
            <Image src="/Images/SolDeMayo.png" alt="" width={24} height={24} className="w-6 h-6 opacity-60" />
            <p className="text-gold-400/70 text-sm tracking-[0.2em] uppercase font-medium">Los Mejores del Truco</p>
            <Image src="/Images/SolDeMayo.png" alt="" width={24} height={24} className="w-6 h-6 opacity-60" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/50" />
          </div>
        </header>

        {/* Navegación */}
        <Link
          href="/lobby"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-gold-400/70 hover:text-gold-300 hover:bg-gold-500/10 text-sm mb-8 transition-all group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Volver al lobby
        </Link>

        {/* Contenido principal */}
        {loading ? (
          <div className="glass rounded-3xl p-12 border border-gold-500/20 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
              <TrophyIcon className="absolute inset-0 m-auto w-8 h-8 text-gold-500/50" />
            </div>
            <p className="text-gold-400/60 text-lg font-light">Cargando ranking...</p>
          </div>
        ) : ranking.length === 0 ? (
          <div className="glass rounded-3xl p-12 border border-gold-500/20 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/10 flex items-center justify-center">
              <TrophyIcon className="w-12 h-12 text-gold-500/50" />
            </div>
            <p className="text-gold-300/70 text-xl font-medium mb-2">Aún no hay jugadores en el ranking</p>
            <p className="text-gold-500/40 text-sm">Jugá una partida para aparecer acá</p>
            <Link
              href="/lobby"
              className="inline-block mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 text-black font-semibold hover:from-gold-500 hover:to-gold-400 transition-all shadow-lg shadow-gold-600/20"
            >
              Ir a jugar
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Podio - Top 3 */}
            {ranking.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-8">
                {/* Segundo lugar */}
                <div className="order-1 mt-8">
                  <div className="glass rounded-2xl p-4 border border-gray-400/30 bg-gradient-to-b from-gray-500/10 to-transparent text-center transform hover:scale-105 transition-all">
                    <div className="text-4xl mb-2">🥈</div>
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-2xl font-bold text-gray-800 shadow-lg">
                      {ranking[1].avatar_url ? (
                        <Image src={ranking[1].avatar_url} alt="" width={64} height={64} className="w-full h-full rounded-full object-cover" unoptimized />
                      ) : (
                        ranking[1].apodo[0].toUpperCase()
                      )}
                    </div>
                    <p className="text-white font-bold text-sm truncate">{ranking[1].apodo}</p>
                    <p className="text-gray-300 font-bold text-xl">{ranking[1].elo}</p>
                    <p className="text-gray-400/60 text-xs">{getWinRate(ranking[1])}% victorias</p>
                    {/* Botón agregar amigo */}
                    {miId && ranking[1].id !== miId && (
                      <div className="mt-2">
                        {amigosIds.has(ranking[1].id) ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Amigos
                          </span>
                        ) : agregados.has(ranking[1].id) ? (
                          <span className="inline-flex items-center gap-1 text-celeste-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Enviada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAgregarAmigo(ranking[1].id)}
                            disabled={agregando === ranking[1].id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-celeste-600/20 hover:bg-celeste-600/40 text-celeste-300 text-xs transition-all disabled:opacity-50"
                          >
                            {agregando === ranking[1].id ? (
                              <span className="w-3 h-3 border border-celeste-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <UserPlusIcon className="w-3 h-3" />
                            )}
                            Agregar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primer lugar */}
                <div className="order-2">
                  <div className="glass rounded-2xl p-5 border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/20 to-transparent text-center transform hover:scale-105 transition-all relative overflow-hidden">
                    {/* Efecto de brillo */}
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-yellow-500/5 to-yellow-500/10 pointer-events-none" />
                    <CrownIcon className="w-8 h-8 text-yellow-500 mx-auto mb-1 animate-bounce" style={{ animationDuration: '2s' }} />
                    <div className="text-5xl mb-2">🥇</div>
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-3xl font-bold text-yellow-900 shadow-xl shadow-yellow-500/30 ring-4 ring-yellow-500/30">
                      {ranking[0].avatar_url ? (
                        <Image src={ranking[0].avatar_url} alt="" width={80} height={80} className="w-full h-full rounded-full object-cover" unoptimized />
                      ) : (
                        ranking[0].apodo[0].toUpperCase()
                      )}
                    </div>
                    <p className="text-yellow-300 font-bold truncate">{ranking[0].apodo}</p>
                    <p className="text-yellow-400 font-bold text-2xl">{ranking[0].elo}</p>
                    <div className="flex items-center justify-center gap-1 text-yellow-500/70 text-xs">
                      <FireIcon className="w-3 h-3" />
                      <span>{ranking[0].mejor_racha} racha</span>
                    </div>
                    {/* Botón agregar amigo */}
                    {miId && ranking[0].id !== miId && (
                      <div className="mt-2 relative z-10">
                        {amigosIds.has(ranking[0].id) ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Amigos
                          </span>
                        ) : agregados.has(ranking[0].id) ? (
                          <span className="inline-flex items-center gap-1 text-celeste-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Enviada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAgregarAmigo(ranking[0].id)}
                            disabled={agregando === ranking[0].id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-celeste-600/20 hover:bg-celeste-600/40 text-celeste-300 text-xs transition-all disabled:opacity-50"
                          >
                            {agregando === ranking[0].id ? (
                              <span className="w-3 h-3 border border-celeste-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <UserPlusIcon className="w-3 h-3" />
                            )}
                            Agregar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tercer lugar */}
                <div className="order-3 mt-12">
                  <div className="glass rounded-2xl p-4 border border-amber-700/30 bg-gradient-to-b from-amber-700/10 to-transparent text-center transform hover:scale-105 transition-all">
                    <div className="text-4xl mb-2">🥉</div>
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-xl font-bold text-amber-200 shadow-lg">
                      {ranking[2].avatar_url ? (
                        <Image src={ranking[2].avatar_url} alt="" width={56} height={56} className="w-full h-full rounded-full object-cover" unoptimized />
                      ) : (
                        ranking[2].apodo[0].toUpperCase()
                      )}
                    </div>
                    <p className="text-white font-bold text-sm truncate">{ranking[2].apodo}</p>
                    <p className="text-amber-400 font-bold text-lg">{ranking[2].elo}</p>
                    <p className="text-amber-500/60 text-xs">{getWinRate(ranking[2])}% victorias</p>
                    {/* Botón agregar amigo */}
                    {miId && ranking[2].id !== miId && (
                      <div className="mt-2">
                        {amigosIds.has(ranking[2].id) ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Amigos
                          </span>
                        ) : agregados.has(ranking[2].id) ? (
                          <span className="inline-flex items-center gap-1 text-celeste-400 text-xs">
                            <CheckIcon className="w-3 h-3" /> Enviada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAgregarAmigo(ranking[2].id)}
                            disabled={agregando === ranking[2].id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-celeste-600/20 hover:bg-celeste-600/40 text-celeste-300 text-xs transition-all disabled:opacity-50"
                          >
                            {agregando === ranking[2].id ? (
                              <span className="w-3 h-3 border border-celeste-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <UserPlusIcon className="w-3 h-3" />
                            )}
                            Agregar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Lista del resto */}
            <div className="glass rounded-2xl border border-gold-800/20 overflow-hidden">
              {/* Header de la tabla */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gold-900/20 border-b border-gold-800/20">
                <div className="col-span-1 text-gold-500/60 text-xs font-semibold uppercase tracking-wider">#</div>
                <div className="col-span-3 text-gold-500/60 text-xs font-semibold uppercase tracking-wider">Jugador</div>
                <div className="col-span-2 text-center text-gold-500/60 text-xs font-semibold uppercase tracking-wider">ELO</div>
                <div className="col-span-2 text-center text-gold-500/60 text-xs font-semibold uppercase tracking-wider hidden sm:block">Tier</div>
                <div className="col-span-2 text-center text-gold-500/60 text-xs font-semibold uppercase tracking-wider">V/D</div>
                <div className="col-span-1 text-center text-gold-500/60 text-xs font-semibold uppercase tracking-wider">%</div>
                <div className="col-span-1 text-center text-gold-500/60 text-xs font-semibold uppercase tracking-wider"></div>
              </div>

              {/* Filas */}
              <div className="divide-y divide-gold-800/10">
                {ranking.slice(3).map((entry, idx) => {
                  const realIdx = idx + 3;
                  const esSoyYo = miApodo && entry.apodo === miApodo;
                  const winRate = getWinRate(entry);
                  const tier = getRankTier(entry.elo);

                  return (
                    <div
                      key={entry.apodo}
                      className={`grid grid-cols-12 gap-2 px-4 py-4 items-center transition-all duration-300 ${
                        esSoyYo
                          ? 'bg-gradient-to-r from-celeste-600/20 via-celeste-500/10 to-transparent border-l-4 border-celeste-500'
                          : 'hover:bg-white/5'
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Posición */}
                      <div className="col-span-1">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                          realIdx < 10 ? 'bg-gold-600/20 text-gold-400' : 'text-gold-500/50'
                        }`}>
                          {realIdx + 1}
                        </span>
                      </div>

                      {/* Jugador */}
                      <div className="col-span-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${tier.color} ${
                          entry.avatar_url ? '' : 'text-white shadow-lg'
                        }`}>
                          {entry.avatar_url ? (
                            <Image src={entry.avatar_url} alt="" width={40} height={40} className="w-full h-full rounded-full object-cover" unoptimized />
                          ) : (
                            entry.apodo[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className={`font-medium block ${esSoyYo ? 'text-celeste-300' : 'text-white'}`}>
                            {entry.apodo}
                          </span>
                          {esSoyYo && <span className="text-celeste-400/60 text-xs">Tu posición</span>}
                        </div>
                      </div>

                      {/* ELO */}
                      <div className="col-span-2 text-center">
                        <span className={`font-bold text-lg ${tier.textColor}`}>{entry.elo}</span>
                      </div>

                      {/* Tier */}
                      <div className="col-span-2 text-center hidden sm:block">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${tier.color} text-white/90`}>
                          {tier.name}
                        </span>
                      </div>

                      {/* V/D */}
                      <div className="col-span-2 text-center">
                        <span className="text-green-400 font-medium">{entry.partidas_ganadas}</span>
                        <span className="text-gold-600/40 mx-1">/</span>
                        <span className="text-red-400 font-medium">{entry.partidas_perdidas}</span>
                      </div>

                      {/* Winrate */}
                      <div className="col-span-1 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          winRate >= 60 ? 'bg-green-500/20 text-green-400' :
                          winRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {winRate}%
                        </div>
                      </div>

                      {/* Botón agregar amigo */}
                      <div className="col-span-1 text-center">
                        {miId && entry.id !== miId && (
                          <>
                            {amigosIds.has(entry.id) ? (
                              <span className="inline-flex items-center justify-center" title="Ya son amigos">
                                <CheckIcon className="w-4 h-4 text-green-400" />
                              </span>
                            ) : agregados.has(entry.id) ? (
                              <span className="inline-flex items-center justify-center" title="Solicitud enviada">
                                <CheckIcon className="w-4 h-4 text-celeste-400" />
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAgregarAmigo(entry.id)}
                                disabled={agregando === entry.id}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-celeste-600/20 hover:bg-celeste-600/40 text-celeste-300 transition-all disabled:opacity-50"
                                title="Agregar amigo"
                              >
                                {agregando === entry.id ? (
                                  <span className="w-3 h-3 border border-celeste-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <UserPlusIcon className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leyenda de Tiers */}
            <div className="glass rounded-xl p-4 border border-gold-800/20 mt-6">
              <h3 className="text-gold-400/70 text-xs font-semibold uppercase tracking-wider mb-3 text-center">Rangos por ELO</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { name: 'Bronce', color: 'from-amber-700 to-amber-900', elo: '< 1100' },
                  { name: 'Plata', color: 'from-gray-300 to-gray-500', elo: '1100+' },
                  { name: 'Oro', color: 'from-yellow-500 to-yellow-700', elo: '1300+' },
                  { name: 'Platino', color: 'from-slate-300 to-slate-500', elo: '1500+' },
                  { name: 'Diamante', color: 'from-cyan-400 to-blue-600', elo: '1700+' },
                  { name: 'Leyenda', color: 'from-yellow-400 to-amber-600', elo: '2000+' },
                ].map((tier) => (
                  <div key={tier.name} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${tier.color}`} />
                    <span className="text-gold-300/70 text-xs">{tier.name}</span>
                    <span className="text-gold-500/40 text-xs">({tier.elo})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <p className="text-gold-500/30 text-xs">
            El ranking se actualiza en tiempo real
          </p>
        </footer>
      </div>
    </div>
  );
}
