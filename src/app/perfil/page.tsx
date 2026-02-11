'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';

interface Stats {
  partidas_jugadas: number;
  partidas_ganadas: number;
  partidas_perdidas: number;
  racha_actual: number;
  mejor_racha: number;
  elo: number;
  apodo: string;
}

interface Partida {
  id: number;
  modo: string;
  equipo_ganador: number;
  puntaje_eq1: number;
  puntaje_eq2: number;
  mi_equipo: number;
  jugada_en: string;
  duracion_seg: number | null;
}

interface Amigo {
  id: number;
  apodo: string;
  elo: number;
  partidas_ganadas: number;
  partidas_jugadas: number;
  online: boolean;
}

export default function PerfilPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [historial, setHistorial] = useState<Partida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<{ id: number; apodo: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [tab, setTab] = useState<'stats' | 'historial' | 'amigos'>('stats');

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        await socketService.connect();

        // Re-autenticar
        const savedUsuario = sessionStorage.getItem('truco_usuario');
        const savedPw = sessionStorage.getItem('truco_auth');
        if (savedUsuario && savedPw) {
          const u = JSON.parse(savedUsuario);
          await socketService.login(u.apodo, savedPw);
        }

        const result = await socketService.obtenerPerfil();
        if (result.success) {
          setStats(result.stats);
          setHistorial(result.historial);
        }

        const amigosResult = await socketService.obtenerAmigos();
        if (amigosResult.success) {
          setAmigos(amigosResult.amigos);
        }
      } catch (err) {
        console.error('Error cargando perfil:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarPerfil();
  }, []);

  const handleBuscar = async () => {
    if (!busqueda.trim()) return;
    setBuscando(true);
    try {
      const result = await socketService.buscarUsuarios(busqueda.trim());
      if (result.success) {
        setResultadosBusqueda(result.usuarios);
      }
    } catch {
      /* ignorar */
    } finally {
      setBuscando(false);
    }
  };

  const handleAgregarAmigo = async (amigoId: number) => {
    const result = await socketService.agregarAmigo(amigoId);
    if (result.success) {
      // Recargar amigos
      const amigosResult = await socketService.obtenerAmigos();
      if (amigosResult.success) setAmigos(amigosResult.amigos);
      setResultadosBusqueda([]);
      setBusqueda('');
    }
  };

  const handleEliminarAmigo = async (amigoId: number) => {
    const result = await socketService.eliminarAmigo(amigoId);
    if (result.success) {
      setAmigos(prev => prev.filter(a => Number(a.id) !== amigoId));
    }
  };

  const winRate = stats && Number(stats.partidas_jugadas) > 0
    ? Math.round((Number(stats.partidas_ganadas) / Number(stats.partidas_jugadas)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-gold-400/60 text-lg">Cargando perfil...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <p className="text-gold-300/50 text-lg mb-4">Necesitás iniciar sesión para ver tu perfil</p>
          <Link href="/lobby" className="text-gold-400 hover:text-gold-300 underline">Ir al lobby</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl font-bold text-gold-400 mb-2">
            Mi Perfil
          </h1>
        </header>

        <Link href="/lobby" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm mb-6 transition-colors">
          ← Volver al lobby
        </Link>

        {/* Card de perfil */}
        <div className="glass rounded-2xl p-6 mb-6 border border-gold-800/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold text-2xl">
              {stats.apodo[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-gold-300 font-bold text-2xl">{stats.apodo}</h2>
              <div className="text-gold-500/50 text-sm">ELO: <span className="text-gold-400 font-bold">{stats.elo}</span></div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-900/20 rounded-xl p-3 text-center border border-blue-500/10">
              <div className="text-2xl font-bold text-blue-400">{stats.partidas_jugadas}</div>
              <div className="text-blue-300/50 text-xs">Jugadas</div>
            </div>
            <div className="bg-green-900/20 rounded-xl p-3 text-center border border-green-500/10">
              <div className="text-2xl font-bold text-green-400">{stats.partidas_ganadas}</div>
              <div className="text-green-300/50 text-xs">Ganadas</div>
            </div>
            <div className="bg-red-900/20 rounded-xl p-3 text-center border border-red-500/10">
              <div className="text-2xl font-bold text-red-400">{stats.partidas_perdidas}</div>
              <div className="text-red-300/50 text-xs">Perdidas</div>
            </div>
            <div className="bg-yellow-900/20 rounded-xl p-3 text-center border border-yellow-500/10">
              <div className="text-2xl font-bold text-yellow-400">{winRate}%</div>
              <div className="text-yellow-300/50 text-xs">Victoria</div>
            </div>
          </div>

          {/* Rachas */}
          <div className="flex gap-4 mt-4">
            <div className="text-sm text-gold-400/60">
              Racha actual: <span className="text-yellow-400 font-bold">{stats.racha_actual} 🔥</span>
            </div>
            <div className="text-sm text-gold-400/60">
              Mejor racha: <span className="text-gold-300 font-bold">{stats.mejor_racha} 🏆</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['stats', 'historial', 'amigos'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              {t === 'stats' ? 'Resumen' : t === 'historial' ? 'Historial' : 'Amigos'}
            </button>
          ))}
        </div>

        {/* Historial */}
        {tab === 'historial' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Últimas partidas</h3>
            {historial.length === 0 ? (
              <p className="text-gold-500/40 text-sm text-center py-8">Aún no jugaste partidas</p>
            ) : (
              <div className="space-y-2">
                {historial.map((p) => {
                  const gane = Number(p.mi_equipo) === Number(p.equipo_ganador);
                  const fecha = new Date(p.jugada_en).toLocaleDateString('es-UY', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      gane ? 'bg-green-900/15 border border-green-500/10' : 'bg-red-900/15 border border-red-500/10'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${gane ? 'text-green-400' : 'text-red-400'}`}>
                          {gane ? 'Victoria' : 'Derrota'}
                        </span>
                        <span className="text-gold-500/40 text-xs">{p.modo}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-white text-sm font-medium">
                          {p.puntaje_eq1} - {p.puntaje_eq2}
                        </span>
                        <span className="text-gold-500/40 text-xs">{fecha}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Amigos */}
        {tab === 'amigos' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Amigos</h3>

            {/* Buscar */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input-glass flex-1 px-3 py-2 rounded-lg text-sm"
                placeholder="Buscar jugador por apodo..."
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              />
              <button
                onClick={handleBuscar}
                disabled={buscando || !busqueda.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-gold-600/30 text-gold-300 hover:bg-gold-600/40 transition-all disabled:opacity-40"
              >
                {buscando ? '...' : 'Buscar'}
              </button>
            </div>

            {/* Resultados de búsqueda */}
            {resultadosBusqueda.length > 0 && (
              <div className="mb-4 space-y-1">
                {resultadosBusqueda.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-blue-900/20 rounded-lg px-3 py-2">
                    <span className="text-white text-sm">{u.apodo}</span>
                    <button
                      onClick={() => handleAgregarAmigo(u.id)}
                      className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded hover:bg-green-600/40 transition-all"
                    >
                      + Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de amigos */}
            {amigos.length === 0 ? (
              <p className="text-gold-500/40 text-sm text-center py-8">Aún no tenés amigos agregados</p>
            ) : (
              <div className="space-y-2">
                {amigos.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3 bg-white/5 border border-gold-700/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${a.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-white font-medium">{a.apodo}</span>
                      <span className="text-gold-500/40 text-xs">ELO: {a.elo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold-500/40 text-xs">
                        {a.partidas_ganadas}/{a.partidas_jugadas}
                      </span>
                      <button
                        onClick={() => handleEliminarAmigo(Number(a.id))}
                        className="text-xs px-2 py-1 text-red-400/60 hover:text-red-300 hover:bg-red-900/20 rounded transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resumen (tab stats) */}
        {tab === 'stats' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Resumen</h3>
            <div className="text-gold-400/60 text-sm space-y-2">
              <p>Tu ELO sube +25 por victoria y baja -15 por derrota.</p>
              <p>Todos los jugadores comienzan con 1000 ELO.</p>
              <p>Jugá partidas para subir en el ranking.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
