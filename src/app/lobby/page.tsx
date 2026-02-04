'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';

interface Partida {
  mesaId: string;
  jugadores: number;
  maxJugadores: number;
  tamañoSala: '1v1' | '2v2' | '3v3';
  estado: string;
}

// Icono de usuarios
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  );
}

// Icono de mesa/cartas
function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

// Icono de flecha
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

export default function LobbyPage() {
  const [nombre, setNombre] = useState('');
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tamañoSala, setTamañoSala] = useState<'1v1' | '2v2' | '3v3'>('2v2');

  useEffect(() => {
    const savedNombre = sessionStorage.getItem('truco_nombre');
    if (savedNombre) setNombre(savedNombre);

    const connectToServer = async () => {
      try {
        await socketService.connect();
        setConectado(true);

        // Register listeners BEFORE joining lobby so we don't miss the response
        socketService.onPartidasDisponibles((partidasData) => {
          setPartidas(partidasData);
        });

        socketService.onPartidaNueva((partidaNueva) => {
          setPartidas(prev => {
            if (prev.find(p => p.mesaId === partidaNueva.mesaId)) return prev;
            return [...prev, partidaNueva];
          });
        });

        await socketService.joinLobby();
      } catch (error) {
        console.error('Failed to connect:', error);
        setConectado(false);
      }
    };

    connectToServer();

    return () => {
      // Only remove listeners, don't disconnect - socket is a singleton
      // and React strict mode will remount causing double connect/disconnect
      socketService.off('partidas-disponibles');
      socketService.off('partida-nueva');
    };
  }, []);

  const navigateToGame = (mesaId: string) => {
    sessionStorage.setItem('truco_nombre', nombre.trim());
    sessionStorage.setItem('truco_mesaId', mesaId);
    socketService.setNavigating(true);
    window.location.href = `/game?mesaId=${mesaId}`;
  };

  const handleCrearPartida = async () => {
    if (!nombre.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const mesaId = await socketService.crearPartida(nombre.trim(), tamañoSala);
      if (mesaId) {
        navigateToGame(mesaId);
      } else {
        alert('Error al crear la partida');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Error al crear la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleUnirsePartida = async (mesaId: string) => {
    if (!nombre.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const success = await socketService.unirsePartida(mesaId, nombre.trim());
      if (success) {
        navigateToGame(mesaId);
      } else {
        alert('Error al unirse a la partida');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Error al unirse a la partida');
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga
  if (!conectado) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl font-light tracking-wide">Conectando al servidor...</div>
          <div className="text-gold-600/40 text-sm mt-2">Preparando la pulpería</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      {/* Efectos de luz */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10">
          <Link href="/" className="inline-block group">
            <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl lg:text-6xl font-bold text-gold-400 mb-2 group-hover:text-gold-300 transition-colors">
              Truco Uruguayo
            </h1>
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gold-700/40" />
            <p className="text-gold-500/60 text-sm tracking-widest uppercase">Lobby</p>
            <div className="h-px w-8 bg-gold-700/40" />
          </div>
        </header>

        {/* Panel de crear partida */}
        <div className="glass rounded-2xl p-6 sm:p-8 mb-6 animate-slide-up border border-gold-800/20">
          {/* Input nombre */}
          <div className="mb-6">
            <label className="block text-gold-400/80 text-sm font-medium mb-2 tracking-wide">
              Tu nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input-glass w-full px-4 py-3.5 rounded-xl text-lg"
              placeholder="Ingresa tu nombre para jugar"
              maxLength={20}
            />
          </div>

          {/* Selector de tamaño */}
          <div className="mb-6">
            <label className="block text-gold-400/80 text-sm font-medium mb-3 tracking-wide">
              Tamaño de la sala
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['1v1', '2v2', '3v3'] as const).map((tamaño) => {
                const isSelected = tamañoSala === tamaño;
                const jugadores = tamaño === '1v1' ? 2 : tamaño === '2v2' ? 4 : 6;

                return (
                  <button
                    key={tamaño}
                    onClick={() => setTamañoSala(tamaño)}
                    className={`relative px-4 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-[1.02] ${
                      isSelected
                        ? 'bg-gradient-to-br from-gold-600 to-gold-700 text-wood-950 shadow-lg shadow-gold-600/20 border-2 border-gold-400/50'
                        : 'glass text-gold-300/70 hover:text-gold-200 hover:bg-white/5 border border-gold-800/30'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl mb-1">{tamaño}</span>
                      <span className={`text-xs ${isSelected ? 'text-wood-800' : 'opacity-60'}`}>
                        {jugadores} jugadores
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-wood-950" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón crear */}
          <button
            onClick={handleCrearPartida}
            disabled={loading || !nombre.trim()}
            className="btn-primary w-full text-white text-lg py-4 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Crear Partida {tamañoSala}
                <ArrowIcon className="w-5 h-5" />
              </span>
            )}
          </button>
        </div>

        {/* Lista de partidas */}
        <div className="glass rounded-2xl p-6 sm:p-8 animate-slide-up border border-gold-800/20" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl font-bold text-gold-400">
              Partidas Disponibles
            </h2>
            <div className="flex items-center gap-2 text-gold-500/50 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{partidas.length} activas</span>
            </div>
          </div>

          {partidas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gold-500/5 rounded-full animate-pulse" />
                <TableIcon className="w-full h-full text-gold-600/30 relative z-10 p-4" />
              </div>
              <p className="text-gold-300/50 text-lg font-light mb-2">
                No hay partidas disponibles
              </p>
              <p className="text-gold-500/30 text-sm">
                Crea una nueva partida para empezar a jugar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {partidas.map((partida, index) => {
                const estaEsperando = partida.estado === 'esperando';
                const puedeUnirse = estaEsperando && partida.jugadores < partida.maxJugadores;

                return (
                  <div
                    key={partida.mesaId}
                    className={`glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 border ${
                      puedeUnirse
                        ? 'border-green-600/30 hover:border-green-500/50 hover:bg-green-900/10'
                        : 'border-gold-800/20 opacity-60'
                    } animate-slide-up`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icono de mesa */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        puedeUnirse ? 'bg-green-600/20' : 'bg-gold-600/10'
                      }`}>
                        <span className="text-2xl font-bold text-gold-400">
                          {partida.mesaId.split('_')[1]?.slice(0, 2) || '#'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-lg text-white mb-1">
                          Mesa {partida.mesaId.split('_')[1]?.slice(0, 6) || partida.mesaId.slice(0, 6)}
                        </h3>

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Indicador de jugadores */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: partida.maxJugadores }, (_, i) => (
                                <div
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                    i < partida.jugadores
                                      ? 'bg-gold-400'
                                      : 'bg-gold-800/40'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-gold-400/60 text-sm">
                              {partida.jugadores}/{partida.maxJugadores}
                            </span>
                          </div>

                          {/* Badge de tamaño */}
                          <span className="px-2.5 py-0.5 bg-gold-600/20 text-gold-400 rounded-full text-xs font-medium">
                            {partida.tamañoSala}
                          </span>

                          {/* Estado */}
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                            estaEsperando
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-amber-600/20 text-amber-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              estaEsperando ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
                            }`} />
                            {estaEsperando ? 'Esperando' : 'En juego'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón unirse */}
                    <button
                      onClick={() => handleUnirsePartida(partida.mesaId)}
                      disabled={loading || !puedeUnirse}
                      className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 ${
                        puedeUnirse
                          ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 hover:scale-105 shadow-lg shadow-green-600/20 active:scale-95'
                          : 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {puedeUnirse ? (
                        <>
                          <UsersIcon className="w-5 h-5" />
                          Unirse
                        </>
                      ) : (
                        <span>Llena</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center animate-fade-in">
          <div className="inline-flex items-center gap-6 text-gold-600/30 text-xs tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="text-base">⚡</span> Tiempo real
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">🎯</span> Fácil
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">🏆</span> Competitivo
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
