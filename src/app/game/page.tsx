'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import socketService from '@/lib/socket';

interface Carta {
  palo: 'oro' | 'copa' | 'espada' | 'basto';
  valor: number;
  poder: number;
}

interface Jugador {
  id: string;
  nombre: string;
  equipo: number;
  cartas: Carta[];
  esMano?: boolean;
}

interface GritoActivo {
  tipo: string;
  equipoQueGrita: number;
  jugadorQueGrita: string;
  puntosEnJuego: number;
  puntosSiNoQuiere: number;
}

interface EnvidoActivo {
  tipos: string[];
  equipoQueCanta: number;
  jugadorQueCanta: string;
  puntosAcumulados: number;
  puntosSiNoQuiere: number;
}

interface Equipo {
  id: number;
  jugadores: Jugador[];
  puntaje: number;
}

interface Mesa {
  id: string;
  jugadores: Jugador[];
  equipos: [Equipo, Equipo];
  estado: string;
  fase: string;
  turnoActual: number;
  cartasMesa: { jugadorId: string; carta: Carta }[];
  manoActual: number;
  maxManos: number;
  ganadoresManos: (number | null)[];
  indiceMano: number;
  gritoActivo: GritoActivo | null;
  nivelGritoAceptado: string | null;
  puntosEnJuego: number;
  envidoActivo: EnvidoActivo | null;
  envidoYaCantado: boolean;
  primeraCartaJugada: boolean;
  winnerRonda: number | null;
  winnerJuego: number | null;
  mensajeRonda: string | null;
  muestra: Carta | null;
}

// Mapeo palo del modelo -> nombre en archivo de imagen
const paloAArchivo: Record<string, string> = {
  'oro': 'oros',
  'copa': 'copas',
  'espada': 'espadas',
  'basto': 'bastos',
};

function getCartaImageUrl(carta: Carta): string {
  const valorStr = carta.valor.toString().padStart(2, '0');
  const paloStr = paloAArchivo[carta.palo] || carta.palo;
  return `/Cartasimg/${valorStr}-${paloStr}.png`;
}

function getNombreGrito(tipo: string): string {
  const nombres: Record<string, string> = {
    'truco': 'TRUCO',
    'retruco': 'RETRUCO',
    'vale4': 'VALE 4',
  };
  return nombres[tipo] || tipo;
}

function getNombreEnvido(tipo: string): string {
  const nombres: Record<string, string> = {
    'envido': 'ENVIDO',
    'real_envido': 'REAL ENVIDO',
    'falta_envido': 'FALTA ENVIDO',
  };
  return nombres[tipo] || tipo;
}

export default function GamePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl">Cargando mesa...</div>
        </div>
      </div>
    }>
      <GamePage />
    </Suspense>
  );
}

function GamePage() {
  const searchParams = useSearchParams();
  const mesaId = searchParams?.get('mesaId') ?? null;

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [esperandoInicio, setEsperandoInicio] = useState(true);

  const mostrarMensaje = useCallback((msg: string, duracion = 3000) => {
    setMensaje(msg);
    setTimeout(() => setMensaje(null), duracion);
  }, []);

  useEffect(() => {
    if (!mesaId) {
      window.location.href = '/lobby';
      return;
    }

    const nombre = sessionStorage.getItem('truco_nombre');
    if (!nombre) {
      window.location.href = '/lobby';
      return;
    }

    let mounted = true;

    const connectToGame = async () => {
      try {
        await socketService.connect();
        if (!mounted) return;

        setConectado(true);
        setSocketId(socketService.getSocketId());

        // Register ALL listeners BEFORE calling reconectar
        socketService.onReconectado((data) => {
          if (!mounted) return;
          setSocketId(socketService.getSocketId());
          setMesa(data.estado);
          if (data.estado.estado === 'jugando') {
            setEsperandoInicio(false);
          }
        });

        socketService.onUnidoPartida((data) => {
          if (!mounted) return;
          setSocketId(socketService.getSocketId());
          setMesa(data.estado);
        });

        socketService.onJugadorUnido((data) => {
          if (!mounted) return;
          setMensaje(`${data.jugador.nombre} se unió`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 3000);
        });

        socketService.onPartidaIniciada((estado) => {
          if (!mounted) return;
          setMesa(estado);
          setEsperandoInicio(false);
          setSocketId(socketService.getSocketId());
        });

        socketService.onEstadoActualizado((estado) => {
          if (!mounted) return;
          setMesa(estado);
        });

        socketService.onCartaJugada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
        });

        socketService.onTrucoCantado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find((j: Jugador) => j.id === data.jugadorId);
          setMensaje(`${jugador?.nombre}: ¡${getNombreGrito(data.tipo)}!`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 4000);
        });

        socketService.onTrucoRespondido((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find((j: Jugador) => j.id === data.jugadorId);
          setMensaje(`${jugador?.nombre}: ${data.acepta ? '¡QUIERO!' : '¡NO QUIERO!'}`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 3000);
        });

        socketService.onEnvidoCantado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find((j: Jugador) => j.id === data.jugadorId);
          setMensaje(`${jugador?.nombre}: ¡${getNombreEnvido(data.tipo)}!`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 4000);
        });

        socketService.onEnvidoRespondido((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find((j: Jugador) => j.id === data.jugadorId);
          if (data.acepta && data.resultado) {
            setMensaje(`Envido: Eq.1: ${data.resultado.equipo1Puntos} vs Eq.2: ${data.resultado.equipo2Puntos} → Equipo ${data.resultado.ganador} +${data.resultado.puntosGanados}`);
            setTimeout(() => { if (mounted) setMensaje(null); }, 5000);
          } else {
            setMensaje(`${jugador?.nombre}: ¡NO QUIERO!`);
            setTimeout(() => { if (mounted) setMensaje(null); }, 3000);
          }
        });

        socketService.onRondaFinalizada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setMensaje(`Equipo ${data.ganadorEquipo} gana la ronda (+${data.puntosGanados})`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 3000);
        });

        socketService.onJuegoFinalizado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setMensaje(`¡JUEGO TERMINADO! Equipo ${data.ganadorEquipo} gana`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 10000);
        });

        socketService.onJugadorAlMazo((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find((j: Jugador) => j.id === data.jugadorId);
          setMensaje(`${jugador?.nombre} se fue al mazo`);
          setTimeout(() => { if (mounted) setMensaje(null); }, 3000);
        });

        // NOW call reconectar after listeners are ready
        const success = await socketService.reconectarPartida(mesaId, nombre);
        if (!success && mounted) {
          console.error('Failed to reconnect to game');
          // Don't redirect immediately - could be a timing issue
        }

      } catch (error) {
        console.error('Failed to connect:', error);
        if (mounted) setConectado(false);
      }
    };

    connectToGame();

    return () => {
      mounted = false;
      socketService.removeAllListeners();
    };
  }, [mesaId]);

  // === HELPERS ===
  const miJugador = mesa?.jugadores.find(j => j.id === socketId);
  const miEquipo = miJugador?.equipo;

  const esMiTurno = (): boolean => {
    if (!mesa || !socketId || mesa.estado !== 'jugando') return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.fase === 'finalizada') return false;
    return mesa.jugadores[mesa.turnoActual]?.id === socketId;
  };

  const misCartas = (): Carta[] => {
    if (!mesa || !socketId) return [];
    const jugador = mesa.jugadores.find(j => j.id === socketId);
    return jugador?.cartas.filter(c => c.valor !== 0) || [];
  };

  const esAnfitrion = (): boolean => {
    if (!mesa || !socketId) return false;
    return mesa.jugadores[0]?.id === socketId;
  };

  const puedoCantarTruco = (): boolean => {
    if (!mesa || !socketId || mesa.estado !== 'jugando') return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.fase === 'finalizada') return false;
    if (!miEquipo) return false;
    if (mesa.nivelGritoAceptado === null) return true;
    return false;
  };

  const puedoCantarRetruco = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    return mesa.nivelGritoAceptado === 'truco';
  };

  const puedoCantarVale4 = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    return mesa.nivelGritoAceptado === 'retruco';
  };

  const puedoCantarEnvido = (): boolean => {
    if (!mesa || !socketId || mesa.estado !== 'jugando') return false;
    if (mesa.primeraCartaJugada) return false;
    if (mesa.envidoYaCantado && !mesa.envidoActivo) return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo && mesa.envidoActivo.equipoQueCanta === miEquipo) return false;
    return true;
  };

  const deboResponderGrito = (): boolean => {
    if (!mesa || !miEquipo || !mesa.gritoActivo) return false;
    return mesa.gritoActivo.equipoQueGrita !== miEquipo;
  };

  const deboResponderEnvido = (): boolean => {
    if (!mesa || !miEquipo || !mesa.envidoActivo) return false;
    return mesa.envidoActivo.equipoQueCanta !== miEquipo;
  };

  // === HANDLERS ===
  const handleIniciarPartida = async () => {
    setLoading(true);
    try {
      const success = await socketService.iniciarPartida();
      if (!success) alert('Error al iniciar la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleJugarCarta = async (carta: Carta) => {
    if (!esMiTurno()) return;
    setLoading(true);
    try {
      const success = await socketService.jugarCarta(carta);
      if (!success) alert('No se pudo jugar la carta');
    } finally {
      setLoading(false);
    }
  };

  const handleCantarTruco = async (tipo: 'truco' | 'retruco' | 'vale4') => {
    setLoading(true);
    try {
      await socketService.cantarTruco(tipo);
    } finally {
      setLoading(false);
    }
  };

  const handleResponderTruco = async (acepta: boolean) => {
    setLoading(true);
    try {
      await socketService.responderTruco(acepta);
    } finally {
      setLoading(false);
    }
  };

  const handleCantarEnvido = async (tipo: 'envido' | 'real_envido' | 'falta_envido') => {
    setLoading(true);
    try {
      await socketService.cantarEnvido(tipo);
    } finally {
      setLoading(false);
    }
  };

  const handleResponderEnvido = async (acepta: boolean) => {
    setLoading(true);
    try {
      await socketService.responderEnvido(acepta);
    } finally {
      setLoading(false);
    }
  };

  const handleIrseAlMazo = async () => {
    setLoading(true);
    try {
      await socketService.irseAlMazo();
    } finally {
      setLoading(false);
    }
  };

  // === COMPONENTES ===

  // Componente de carta
  const CartaImg = ({ carta, size = 'normal', onClick, disabled, showGlow }: {
    carta: Carta;
    size?: 'small' | 'normal' | 'large';
    onClick?: () => void;
    disabled?: boolean;
    showGlow?: boolean;
  }) => {
    const isOculta = carta.valor === 0;
    const sizeClasses = {
      small: 'w-12 h-[4.5rem] sm:w-14 sm:h-20',
      normal: 'w-16 h-24 sm:w-20 sm:h-[7.5rem]',
      large: 'w-20 h-[7.5rem] sm:w-24 sm:h-36',
    };

    if (isOculta) {
      return (
        <div className={`${sizeClasses[size]} card-back rounded-lg`} />
      );
    }

    return (
      <button
        onClick={onClick}
        disabled={disabled || !onClick}
        className={`${sizeClasses[size]} rounded-lg overflow-hidden transition-all duration-300 relative
          ${onClick && !disabled ? 'card-interactive cursor-pointer' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${showGlow ? 'ring-2 ring-gold-400 shadow-gold-glow' : 'shadow-card'}
        `}
      >
        <img
          src={getCartaImageUrl(carta)}
          alt={`${carta.valor} de ${carta.palo}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </button>
    );
  };

  // Marcador con fósforos
  const ScoreBoard = ({ equipo, puntos, isMyTeam }: { equipo: number; puntos: number; isMyTeam: boolean }) => {
    const grupos = Math.floor(puntos / 5);
    const resto = puntos % 5;

    return (
      <div className={`score-panel rounded-xl p-3 sm:p-4 ${isMyTeam ? 'ring-2 ring-gold-500/50' : ''}`}>
        <div className="text-center mb-2">
          <span className={`text-xs uppercase tracking-wider ${equipo === 1 ? 'text-blue-400' : 'text-red-400'}`}>
            Equipo {equipo}
          </span>
          {isMyTeam && <span className="ml-2 text-gold-500 text-xs">(Tú)</span>}
        </div>
        <div className="text-3xl sm:text-4xl font-bold text-center text-white mb-2">{puntos}</div>
        <div className="flex flex-wrap justify-center gap-1">
          {Array.from({ length: grupos }).map((_, i) => (
            <div key={`g-${i}`} className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="matchstick w-4 sm:w-5" />
              ))}
            </div>
          ))}
          {Array.from({ length: resto }).map((_, i) => (
            <div key={`r-${i}`} className="matchstick w-4 sm:w-5" />
          ))}
        </div>
      </div>
    );
  };

  // === PANTALLAS ===

  // Pantalla de carga
  if (!conectado) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl">Conectando...</div>
        </div>
      </div>
    );
  }

  // Pantalla de espera
  if (!mesa || (mesa.estado === 'esperando' && esperandoInicio)) {
    return (
      <div className="min-h-screen bg-table-wood p-4 sm:p-8">
        <div className="max-w-lg mx-auto">
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/30">
            <h1 className="text-2xl sm:text-3xl font-bold text-gold-400 text-center mb-6">
              Mesa de Truco
            </h1>

            {mesa && (
              <>
                <div className="mb-6">
                  <p className="text-gold-300/60 text-center mb-4">
                    {mesa.jugadores.length} jugador{mesa.jugadores.length !== 1 ? 'es' : ''} en la mesa
                  </p>
                  <div className="space-y-2">
                    {mesa.jugadores.map((j, i) => (
                      <div
                        key={j.id || i}
                        className="glass rounded-lg p-3 flex justify-between items-center border border-gold-800/20"
                      >
                        <span className="text-white font-medium">
                          {j.nombre}
                          {j.id === socketId && <span className="text-gold-400 ml-2">(tú)</span>}
                        </span>
                        {i === 0 && (
                          <span className="text-xs bg-gold-600/30 text-gold-400 px-2 py-1 rounded">
                            Anfitrión
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {esAnfitrion() ? (
                  <button
                    onClick={handleIniciarPartida}
                    disabled={loading || mesa.jugadores.length < 2}
                    className="btn-primary w-full text-white py-4 rounded-xl text-lg disabled:opacity-40"
                  >
                    {loading ? 'Iniciando...' : `Iniciar Partida (${mesa.jugadores.length} jugadores)`}
                  </button>
                ) : (
                  <p className="text-gold-500/50 text-center italic">
                    Esperando al anfitrión...
                  </p>
                )}
              </>
            )}

            {!mesa && (
              <div className="text-gold-500/50 text-center">
                <div className="loading-dots mx-auto">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === JUEGO PRINCIPAL ===
  const cartasManoActual = mesa.cartasMesa.slice((mesa.manoActual - 1) * mesa.jugadores.length);
  const jugadorDelTurno = mesa.jugadores[mesa.turnoActual];
  const oponentes = mesa.jugadores.filter(j => j.id !== socketId);

  return (
    <div className="min-h-screen bg-table-wood p-2 sm:p-4 overflow-hidden">
      {/* Iluminación de pulpería */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-amber-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Toast de mensaje */}
      {mensaje && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 toast px-6 py-3 rounded-xl animate-slide-down">
          <span className="text-gold-300 font-bold text-lg">{mensaje}</span>
        </div>
      )}

      {/* Modal de fin de ronda/juego */}
      {mesa.mensajeRonda && mesa.fase === 'finalizada' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="glass-light rounded-2xl p-8 shadow-2xl text-center max-w-md animate-slide-up">
            <p className="text-2xl font-bold text-wood-900 mb-2">{mesa.mensajeRonda}</p>
            {!mesa.winnerJuego && (
              <p className="text-wood-600 text-sm">Siguiente ronda en unos segundos...</p>
            )}
            {mesa.winnerJuego && (
              <button
                onClick={() => window.location.href = '/lobby'}
                className="mt-4 btn-primary text-white py-3 px-8 rounded-xl"
              >
                Volver al Lobby
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex flex-col">
        {/* Header: Marcadores */}
        <div className="flex justify-between items-stretch gap-2 sm:gap-4 mb-2 sm:mb-4">
          <ScoreBoard equipo={1} puntos={mesa.equipos[0].puntaje} isMyTeam={miEquipo === 1} />

          {/* Info central */}
          <div className="flex-1 flex flex-col items-center justify-center glass rounded-xl px-2 sm:px-4 py-2 border border-gold-800/20">
            <div className="text-gold-400/60 text-xs sm:text-sm">Mano {mesa.manoActual}/3</div>
            {mesa.puntosEnJuego > 1 && (
              <div className="text-gold-300 font-bold text-sm sm:text-base">
                {mesa.nivelGritoAceptado ? getNombreGrito(mesa.nivelGritoAceptado) : ''} ({mesa.puntosEnJuego} pts)
              </div>
            )}
            {/* Indicadores de manos ganadas */}
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map(m => {
                const ganador = mesa.ganadoresManos[m - 1];
                return (
                  <div
                    key={m}
                    className={`w-3 h-3 rounded-full border-2 ${
                      ganador === null ? 'bg-gray-500 border-gray-400' :
                      ganador === 1 ? 'bg-blue-500 border-blue-400' :
                      ganador === 2 ? 'bg-red-500 border-red-400' :
                      'border-gold-700/50 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <ScoreBoard equipo={2} puntos={mesa.equipos[1].puntaje} isMyTeam={miEquipo === 2} />
        </div>

        {/* Mesa de juego */}
        <div className="flex-1 flex flex-col">
          {/* Oponentes */}
          <div className="flex justify-center gap-4 sm:gap-8 mb-2 sm:mb-4">
            {oponentes.map(j => {
              const esSuTurno = jugadorDelTurno?.id === j.id;
              return (
                <div key={j.id} className="text-center">
                  <div className={`inline-block px-3 py-1 rounded-lg text-sm font-medium mb-2 ${
                    j.equipo === 1 ? 'equipo-1-light text-blue-300' : 'equipo-2-light text-red-300'
                  } ${esSuTurno ? 'turn-glow' : ''}`}>
                    {j.nombre} {j.esMano && '(M)'}
                  </div>
                  <div className="flex gap-1 justify-center">
                    {j.cartas.map((_, i) => (
                      <div key={i} className="w-8 h-12 sm:w-10 sm:h-14 card-back rounded" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mesa central con fieltro */}
          <div className="flex-1 mesa-flat wood-border rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-6 relative flex flex-col justify-center items-center min-h-[200px]">
            {/* Luz de lámpara */}
            <div className="lampara-glow" />
            <div className="pulperia-light rounded-[2rem] sm:rounded-[3rem]" />

            {/* Muestra - carta boca arriba en el centro */}
            {mesa.muestra && (
              <div className="absolute top-3 right-4 sm:top-4 sm:right-6 z-20 flex flex-col items-center">
                <div className="text-[10px] sm:text-xs text-gold-400/70 font-medium mb-1 uppercase tracking-wider">Muestra</div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-gold-500/20 rounded-lg blur-sm" />
                  <CartaImg carta={mesa.muestra} size="small" />
                </div>
              </div>
            )}

            {/* Cartas jugadas en el centro */}
            <div className="relative z-10 flex flex-wrap justify-center items-end gap-2 sm:gap-4">
              {cartasManoActual.map((jugada, i) => {
                const jugador = mesa.jugadores.find(j => j.id === jugada.jugadorId);
                const esEquipo1 = jugador?.equipo === 1;
                return (
                  <div key={i} className="text-center card-played-anim" style={{ animationDelay: `${i * 0.1}s` }}>
                    <CartaImg carta={jugada.carta} size="normal" />
                    <div className={`text-xs mt-1 font-medium ${esEquipo1 ? 'text-blue-300' : 'text-red-300'}`}>
                      {jugador?.nombre}
                    </div>
                  </div>
                );
              })}
              {cartasManoActual.length === 0 && mesa.estado === 'jugando' && (
                <div className="text-green-300/40 text-sm">Esperando cartas...</div>
              )}
            </div>

            {/* Indicador de turno */}
            {mesa.estado === 'jugando' && mesa.fase !== 'finalizada' && !mesa.gritoActivo && !mesa.envidoActivo && (
              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20">
                <div className={`text-sm font-bold px-4 py-2 rounded-full ${
                  esMiTurno()
                    ? 'bg-gold-500 text-wood-950 turn-indicator'
                    : 'bg-black/40 text-white/70'
                }`}>
                  {esMiTurno() ? '¡Tu turno!' : `Turno: ${jugadorDelTurno?.nombre}`}
                </div>
              </div>
            )}
          </div>

          {/* Panel de respuesta a Truco */}
          {deboResponderGrito() && mesa.gritoActivo && (
            <div className="glass-gold rounded-xl p-4 my-3 text-center border border-gold-600/40 animate-slide-up">
              <p className="text-lg font-bold text-gold-300 mb-3">
                {mesa.jugadores.find(j => j.id === mesa.gritoActivo!.jugadorQueGrita)?.nombre} cantó {getNombreGrito(mesa.gritoActivo.tipo)}
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => handleResponderTruco(true)} disabled={loading} className="btn-quiero text-white">
                  ¡QUIERO!
                </button>
                <button onClick={() => handleResponderTruco(false)} disabled={loading} className="btn-no-quiero text-white">
                  NO QUIERO
                </button>
              </div>
            </div>
          )}

          {/* Panel de respuesta a Envido */}
          {deboResponderEnvido() && mesa.envidoActivo && (
            <div className="glass rounded-xl p-4 my-3 text-center border border-purple-600/40 animate-slide-up">
              <p className="text-lg font-bold text-purple-300 mb-1">
                {mesa.jugadores.find(j => j.id === mesa.envidoActivo!.jugadorQueCanta)?.nombre} cantó {getNombreEnvido(mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1])}
              </p>
              <p className="text-sm text-purple-400/70 mb-3">En juego: {mesa.envidoActivo.puntosAcumulados} pts</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <button onClick={() => handleResponderEnvido(true)} disabled={loading} className="btn-quiero text-white">
                  ¡QUIERO!
                </button>
                <button onClick={() => handleResponderEnvido(false)} disabled={loading} className="btn-no-quiero text-white">
                  NO QUIERO
                </button>
                {!mesa.envidoActivo.tipos.includes('falta_envido') && (
                  <>
                    <button onClick={() => handleCantarEnvido('real_envido')} disabled={loading} className="btn-envido text-white">
                      Real Envido
                    </button>
                    <button onClick={() => handleCantarEnvido('falta_envido')} disabled={loading} className="btn-envido text-white">
                      Falta Envido
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mis cartas y controles */}
          <div className="glass rounded-xl p-3 sm:p-4 mt-2 sm:mt-4 border border-gold-800/20">
            {/* Barra superior con info y botones de cantos */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className={`px-3 py-1.5 rounded-lg font-medium text-sm ${
                miEquipo === 1 ? 'equipo-1 text-white' : 'equipo-2 text-white'
              }`}>
                {miJugador?.nombre} {miJugador?.esMano && '(Mano)'}
              </div>

              {/* Botones de cantos */}
              <div className="flex gap-2 flex-wrap">
                {puedoCantarEnvido() && !mesa.envidoActivo && (
                  <>
                    <button onClick={() => handleCantarEnvido('envido')} disabled={loading} className="btn-envido text-white text-xs sm:text-sm">
                      Envido
                    </button>
                    <button onClick={() => handleCantarEnvido('real_envido')} disabled={loading} className="btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex">
                      Real Envido
                    </button>
                    <button onClick={() => handleCantarEnvido('falta_envido')} disabled={loading} className="btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex">
                      Falta Envido
                    </button>
                  </>
                )}
                {puedoCantarTruco() && (
                  <button onClick={() => handleCantarTruco('truco')} disabled={loading} className="btn-truco text-white">
                    Truco
                  </button>
                )}
                {puedoCantarRetruco() && (
                  <button onClick={() => handleCantarTruco('retruco')} disabled={loading} className="btn-truco text-white">
                    Retruco
                  </button>
                )}
                {puedoCantarVale4() && (
                  <button onClick={() => handleCantarTruco('vale4')} disabled={loading} className="btn-truco text-white">
                    Vale 4
                  </button>
                )}
                {mesa.estado === 'jugando' && mesa.fase !== 'finalizada' && (
                  <button onClick={handleIrseAlMazo} disabled={loading} className="btn-mazo text-white">
                    Mazo
                  </button>
                )}
              </div>
            </div>

            {/* Mis cartas */}
            <div className="flex justify-center gap-2 sm:gap-4">
              {misCartas().map((carta, index) => (
                <CartaImg
                  key={`${carta.palo}-${carta.valor}-${index}`}
                  carta={carta}
                  size="large"
                  onClick={esMiTurno() ? () => handleJugarCarta(carta) : undefined}
                  disabled={!esMiTurno() || loading}
                  showGlow={esMiTurno()}
                />
              ))}
              {misCartas().length === 0 && mesa.estado === 'jugando' && (
                <div className="text-gold-500/40 text-sm py-8">Sin cartas</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
