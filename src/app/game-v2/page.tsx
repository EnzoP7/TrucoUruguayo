"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import socketService from "@/lib/socket";
import audioManager from "@/lib/audioManager";
import TrucoLoader from "@/components/TrucoLoader";
import { RewardedAd, AdBanner } from "@/components/ads";
import AlertModal, { useAlertModal } from "@/components/AlertModal";

// Extracted modules
import { Jugador, PlayerSlot } from "../game/types";
import { getCartaImageUrl, getNombreGrito, getNombreEnvido } from "../game/utils";
import { useGameState } from "../game/hooks/useGameState";
import { useCosmetics } from "../game/hooks/useCosmetics";
import { useGameHelpers } from "../game/hooks/useGameHelpers";
import { useGameHandlers } from "../game/hooks/useGameHandlers";
import { useGameSocket } from "../game/hooks/useGameSocket";

// Extracted components
import PanelAyuda from "../game/components/PanelAyuda";
import PerrosResponseModal from "../game/components/PerrosResponseModal";
import CartaImg from "../game/components/CartaImg";
import ScoreBoard from "../game/components/ScoreBoard";
import MonedaMano from "../game/components/MonedaMano";
import MazoCorte from "../game/components/MazoCorte";
import PlayerIndicator from "../game/components/PlayerIndicator";

export default function GamePageWrapper() {
  return (
    <Suspense fallback={<TrucoLoader text="Cargando mesa..." size="lg" />}>
      <GamePage />
    </Suspense>
  );
}

function GamePage() {
  const searchParams = useSearchParams();
  const mesaId = searchParams?.get("mesaId") ?? null;
  const { alertState, showAlert, showConfirm, closeAlert } = useAlertModal();

  // === ALL STATE ===
  const state = useGameState();
  const {
    mesa, socketId, conectado, loading, mensaje,
    monedasGanadas, setMonedasGanadas,
    mostrarRewardedPostGame, setMostrarRewardedPostGame,
    yaDuplico, setYaDuplico,
    esperandoInicio,
    envidoDeclaraciones, envidoResultado,
    dealingCards, isDealing,
    florResultado,
    reyesAnimacion, reyesAnimStep, reyesAnimDone,
    rondaBanner,
    mostrarEnvidoCargado, setMostrarEnvidoCargado,
    puntosEnvidoCargado, setPuntosEnvidoCargado,
    perrosActivos, equipoPerros,
    florPendiente,
    jugadorDesconectado, setJugadorDesconectado,
    speechBubbles,
    chatAbierto, setChatAbierto,
    chatTab, setChatTab,
    mensajesChat,
    inputChat, setInputChat,
    enviadoChat,
    mensajesNoLeidos, setMensajesNoLeidos,
    agregandoBot,
    amigosConectados,
    cargandoAmigos,
    invitandoAmigo,
    mostrarAmigos, setMostrarAmigos,
    muted, setMuted,
    volume, setVolume,
    showVolumeSlider, setShowVolumeSlider,
    mostrarMensaje, setLoading,
  } = state;

  // === COSMETICS ===
  const { getTemaActivo, getCardBackStyle, getMarcoForPlayer, getMesaFeltStyle } = useCosmetics(mesa, socketId);

  // === GAME HELPERS ===
  const {
    miJugador, miEquipo, meFuiAlMazo,
    esMiTurno, misCartas,
    esAnfitrion,
    puedoCantarTruco, puedoCantarRetruco, puedoCantarVale4,
    puedoCantarEnvido,
    deboResponderGrito, deboResponderEnvido,
    esMiTurnoDeCortar, tengoFlor, puedeEcharPerros,
  } = useGameHelpers(mesa, socketId, florPendiente, isDealing, dealingCards);

  // === HANDLERS ===
  const {
    handleIniciarPartida, handleJugarCarta,
    handleCantarTruco, handleResponderTruco,
    handleCantarEnvido, handleCantarEnvidoCargado,
    handleResponderEnvido, handleResponderFlor,
    handleIrseAlMazo, handleRealizarCorte,
    handleCambiarEquipo, handleTirarReyes,
    handleConfigurarPuntos, handleEnviarMensaje,
    handleAgregarBot, handleQuitarBot, handleLlenarConBots,
    cargarAmigosConectados, handleInvitarAmigo,
    handleRevancha, handleTerminarPartida,
    handleEcharPerros, handleCancelarPerros, handleResponderPerros,
  } = useGameHandlers({
    esMiTurno, setLoading, showAlert, showConfirm, mostrarMensaje,
    setFlorPendiente: state.setFlorPendiente,
    setEnvidoDeclaraciones: state.setEnvidoDeclaraciones,
    setEnvidoResultado: state.setEnvidoResultado,
    setMostrarEnvidoCargado,
    setAgregandoBot: state.setAgregandoBot,
    setInvitandoAmigo: state.setInvitandoAmigo,
    setCargandoAmigos: state.setCargandoAmigos,
    setAmigosConectados: state.setAmigosConectados,
    puntosEnvidoCargado, inputChat, chatTab, setInputChat,
    enviadoChat, setEnviadoChat: state.setEnviadoChat,
    mesaId, socketId, mesa: mesa ? { esperandoCorte: !!mesa.esperandoCorte } : null,
  });

  // === SOCKET CONNECTION ===
  useGameSocket(mesaId, state);

  // === SCREENS ===

  // Loading screen
  if (!conectado) {
    return <TrucoLoader text="Conectando al servidor..." size="lg" />;
  }

  // Waiting/Lobby screen
  if (!mesa || (mesa.estado === "esperando" && esperandoInicio)) {
    const getMaxJugadores = () => {
      if (mesa?.tamañoSala === "1v1") return 2;
      if (mesa?.tamañoSala === "2v2") return 4;
      if (mesa?.tamañoSala === "3v3") return 6;
      if (mesa && mesa.jugadores.length > 4) return 6;
      if (mesa && mesa.jugadores.length > 2) return 4;
      return 2;
    };
    const maxJugadores = getMaxJugadores();
    const maxPorEquipo = maxJugadores / 2;

    const equiposBalanceados = mesa
      ? (() => {
          const eq1 = mesa.jugadores.filter((j) => j.equipo === 1).length;
          const eq2 = mesa.jugadores.filter((j) => j.equipo === 2).length;
          return eq1 === maxPorEquipo && eq2 === maxPorEquipo;
        })()
      : false;

    return (
      <div className="min-h-screen bg-table-wood p-4 sm:p-8">
        {/* Tirar Reyes Animation Overlay */}
        {reyesAnimacion && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Tirando Reyes">
            <div className="glass rounded-2xl p-6 sm:p-8 max-w-2xl w-full border border-gold-600/40 animate-slide-up">
              <h2 className="text-2xl sm:text-3xl font-bold text-gold-400 text-center mb-2">
                Tirando Reyes
              </h2>
              <p className="text-gold-500/60 text-center text-sm mb-6">
                Los que sacan un Rey van al Equipo 1
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {reyesAnimacion.map((item, i) => {
                  const revealed = reyesAnimStep > i;
                  const paloArch: Record<string, string> = {
                    oro: "oros", copa: "copas", espada: "espadas", basto: "bastos",
                  };

                  return (
                    <div key={item.jugadorId} className="flex flex-col items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          revealed
                            ? item.esRey ? "text-celeste-300" : "text-red-300"
                            : "text-gold-400/70"
                        }`}
                      >
                        {item.jugadorNombre}
                      </span>

                      <div
                        className={`relative w-16 h-24 sm:w-20 sm:h-[7.5rem] transition-all duration-700 ${revealed ? "scale-110" : ""}`}
                        style={{ perspective: "600px" }}
                      >
                        <div
                          className="w-full h-full transition-all duration-700 relative"
                          style={{
                            transformStyle: "preserve-3d",
                            transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
                          }}
                        >
                          <div
                            className="absolute inset-0 card-back rounded-lg"
                            style={{ backfaceVisibility: "hidden", ...getCardBackStyle() }}
                          />
                          <div
                            className="absolute inset-0 rounded-lg overflow-hidden"
                            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                          >
                            <Image
                              src={`/Cartasimg/${item.carta.valor.toString().padStart(2, "0")}-${paloArch[item.carta.palo] || item.carta.palo}.png`}
                              alt={`${item.carta.valor} de ${item.carta.palo}`}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        </div>

                        {revealed && item.esRey && (
                          <div className="absolute -top-3 -right-2 text-xl animate-bounce">
                            👑
                          </div>
                        )}
                      </div>

                      {revealed && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full animate-slide-up ${
                            item.esRey
                              ? "bg-celeste-600/40 text-celeste-300 border border-celeste-500/40"
                              : "bg-red-600/40 text-red-300 border border-red-500/40"
                          }`}
                        >
                          Equipo {item.equipo}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {reyesAnimDone && (
                <div className="text-center animate-slide-up">
                  <p className="text-gold-300 font-bold text-lg mb-2">
                    ¡Equipos formados!
                  </p>
                  <div className="flex justify-center gap-6">
                    <div>
                      <span className="text-celeste-400 font-medium text-sm">Equipo 1: </span>
                      <span className="text-white text-sm">
                        {reyesAnimacion.filter((a) => a.equipo === 1).map((a) => a.jugadorNombre).join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-red-400 font-medium text-sm">Equipo 2: </span>
                      <span className="text-white text-sm">
                        {reyesAnimacion.filter((a) => a.equipo === 2).map((a) => a.jugadorNombre).join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/30">
            <h1 className="text-2xl sm:text-3xl font-bold text-gold-400 text-center mb-2">
              Mesa de Truco
            </h1>

            {mesa && (
              <>
                <p className="text-gold-300/60 text-center mb-6">
                  {mesa.jugadores.length} jugador{mesa.jugadores.length !== 1 ? "es" : ""} en la mesa
                </p>

                {/* Point Limit Selector */}
                {esAnfitrion() && (
                  <div className="mb-6">
                    <label className="block text-gold-400/80 text-sm font-medium mb-3 uppercase tracking-wider">
                      Puntos para ganar
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[30, 40].map((pts) => (
                        <button
                          key={pts}
                          onClick={() => handleConfigurarPuntos(pts)}
                          disabled={loading}
                          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                            mesa.puntosLimite === pts
                              ? "bg-gradient-to-br from-gold-600 to-gold-700 text-wood-950 shadow-lg shadow-gold-600/20 border-2 border-gold-400/50"
                              : "glass text-gold-300/70 hover:text-gold-200 hover:bg-white/5 border border-gold-800/30"
                          }`}
                        >
                          {pts} pts
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-gold-600/40 text-[10px] uppercase tracking-wider mr-1">Test:</span>
                        {[10, 15, 20].map((pts) => (
                          <button
                            key={pts}
                            onClick={() => handleConfigurarPuntos(pts)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              mesa.puntosLimite === pts
                                ? "bg-amber-700/50 text-amber-300 border border-amber-500/50"
                                : "glass text-gold-500/50 hover:text-gold-400 border border-gold-800/20"
                            }`}
                          >
                            {pts}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-gold-500/40 text-xs">
                      Malos: 0-{Math.floor(mesa.puntosLimite / 2)} | Buenos: {Math.floor(mesa.puntosLimite / 2)}-{mesa.puntosLimite}
                    </div>
                  </div>
                )}
                {!esAnfitrion() && (
                  <div className="mb-4 text-center">
                    <span className="text-gold-500/60 text-sm">
                      Partida a <span className="text-gold-400 font-bold">{mesa.puntosLimite} puntos</span>
                    </span>
                  </div>
                )}

                {/* Team configuration for 2v2 and 3v3 */}
                {mesa.jugadores.length > 2 ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-gold-400/80 font-medium text-sm uppercase tracking-wider">Configurar Equipos</h2>
                      {esAnfitrion() && (
                        <button
                          onClick={handleTirarReyes}
                          disabled={loading || mesa.jugadores.length < 4}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-700 to-amber-600 text-white text-sm font-bold hover:from-amber-600 hover:to-amber-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-800/30"
                          title="Asignar equipos al azar con animación de Reyes"
                        >
                          👑 Tirar Reyes
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Equipo 1 */}
                      <div className="rounded-xl border-2 border-celeste-600/40 bg-celeste-950/20 p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-celeste-500" />
                          <span className="text-celeste-400 font-bold text-sm uppercase tracking-wider">Equipo 1</span>
                          <span className="text-celeste-400/50 text-xs ml-auto">
                            {mesa.jugadores.filter((j) => j.equipo === 1).length} jugadores
                          </span>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {mesa.jugadores.filter((j) => j.equipo === 1).map((j, i) => (
                            <div key={j.id || `eq1-${i}`} className="glass rounded-lg p-2.5 flex items-center justify-between border border-celeste-700/30 group">
                              <div className="flex items-center gap-2">
                                {j.isBot && <span className="text-sm">🤖</span>}
                                <span className="text-white text-sm font-medium">{j.nombre}</span>
                                {j.id === socketId && <span className="text-gold-400 text-[10px]">(tú)</span>}
                                {j.id === mesa.jugadores[0]?.id && (
                                  <span className="text-[10px] bg-gold-600/30 text-gold-400 px-1.5 py-0.5 rounded">Host</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {j.isBot && esAnfitrion() && (
                                  <button onClick={() => handleQuitarBot(j.id)} className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all" title="Quitar bot">✕</button>
                                )}
                                {j.id === socketId ? (
                                  <button
                                    onClick={() => socketService.toggleAyuda(!j.modoAyuda)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                                    title="Activar/desactivar modo ayuda"
                                  >
                                    📚 Ayuda
                                  </button>
                                ) : (
                                  j.modoAyuda && <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">📚</span>
                                )}
                                {esAnfitrion() && !j.isBot && (
                                  <button
                                    onClick={() => handleCambiarEquipo(j.id, 2)}
                                    disabled={loading}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded bg-red-900/30 hover:bg-red-800/40 transition-all"
                                    title="Mover al Equipo 2"
                                  >
                                    → Eq.2
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {mesa.jugadores.filter((j) => j.equipo === 1).length === 0 && (
                            <div className="text-celeste-500/30 text-xs text-center py-3 italic">Sin jugadores</div>
                          )}
                        </div>
                      </div>

                      {/* Equipo 2 */}
                      <div className="rounded-xl border-2 border-red-600/40 bg-red-950/20 p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-red-400 font-bold text-sm uppercase tracking-wider">Equipo 2</span>
                          <span className="text-red-400/50 text-xs ml-auto">
                            {mesa.jugadores.filter((j) => j.equipo === 2).length} jugadores
                          </span>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {mesa.jugadores.filter((j) => j.equipo === 2).map((j, i) => (
                            <div key={j.id || `eq2-${i}`} className="glass rounded-lg p-2.5 flex items-center justify-between border border-red-700/30 group">
                              <div className="flex items-center gap-2">
                                {j.isBot && <span className="text-sm">🤖</span>}
                                <span className="text-white text-sm font-medium">{j.nombre}</span>
                                {j.id === socketId && <span className="text-gold-400 text-[10px]">(tú)</span>}
                                {j.id === mesa.jugadores[0]?.id && (
                                  <span className="text-[10px] bg-gold-600/30 text-gold-400 px-1.5 py-0.5 rounded">Host</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {j.isBot && esAnfitrion() && (
                                  <button onClick={() => handleQuitarBot(j.id)} className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all" title="Quitar bot">✕</button>
                                )}
                                {j.id === socketId ? (
                                  <button
                                    onClick={() => socketService.toggleAyuda(!j.modoAyuda)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                                    title="Activar/desactivar modo ayuda"
                                  >
                                    📚 Ayuda
                                  </button>
                                ) : (
                                  j.modoAyuda && <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">📚</span>
                                )}
                                {esAnfitrion() && !j.isBot && (
                                  <button
                                    onClick={() => handleCambiarEquipo(j.id, 1)}
                                    disabled={loading}
                                    className="opacity-0 group-hover:opacity-100 text-celeste-400 hover:text-celeste-300 text-xs px-2 py-1 rounded bg-celeste-900/30 hover:bg-celeste-800/40 transition-all"
                                    title="Mover al Equipo 1"
                                  >
                                    → Eq.1
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {mesa.jugadores.filter((j) => j.equipo === 2).length === 0 && (
                            <div className="text-red-500/30 text-xs text-center py-3 italic">Sin jugadores</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {!equiposBalanceados && mesa.jugadores.length >= 2 && (
                      <div className="mt-3 text-center text-amber-400/70 text-xs flex items-center justify-center gap-1.5">
                        <span>⚠️</span> Los equipos deben estar balanceados para iniciar
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6 space-y-2">
                    {mesa.jugadores.map((j, i) => (
                      <div key={j.id || i} className="glass rounded-lg p-3 flex justify-between items-center border border-gold-800/20">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${j.equipo === 1 ? "bg-celeste-500" : "bg-red-500"}`} />
                          <span className="text-white font-medium flex items-center gap-1.5">
                            {j.isBot && <span className="text-lg">🤖</span>}
                            {j.nombre}
                            {j.id === socketId && <span className="text-gold-400 ml-2">(tú)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {j.isBot && esAnfitrion() && (
                            <button onClick={() => handleQuitarBot(j.id)} className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all" title="Quitar bot">✕</button>
                          )}
                          {j.id === socketId ? (
                            <button
                              onClick={() => socketService.toggleAyuda(!j.modoAyuda)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                              title="Activar/desactivar modo ayuda"
                            >
                              📚 Ayuda
                            </button>
                          ) : (
                            j.modoAyuda && <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">📚</span>
                          )}
                          {i === 0 && <span className="text-xs bg-gold-600/30 text-gold-400 px-2 py-1 rounded">Anfitrión</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar bots */}
                {esAnfitrion() &&
                  (() => {
                    const eq1Count = mesa.jugadores.filter((j) => j.equipo === 1).length;
                    const eq2Count = mesa.jugadores.filter((j) => j.equipo === 2).length;
                    const hayEspacioEq1 = eq1Count < maxPorEquipo;
                    const hayEspacioEq2 = eq2Count < maxPorEquipo;
                    const hayEspacio = mesa.jugadores.length < maxJugadores;

                    if (!hayEspacio) return null;

                    if (maxJugadores === 2) {
                      return (
                        <div className="mb-4 p-3 glass rounded-xl border border-celeste-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-celeste-300 text-sm font-medium flex items-center gap-1.5">
                              <span className="text-lg">🤖</span> Agregar Bot Oponente
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => handleAgregarBot("facil", 2)} disabled={agregandoBot} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 border border-green-500/20 disabled:opacity-50 transition-all">Fácil</button>
                            <button onClick={() => handleAgregarBot("medio", 2)} disabled={agregandoBot} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 border border-yellow-500/20 disabled:opacity-50 transition-all">Medio</button>
                            <button onClick={() => handleAgregarBot("dificil", 2)} disabled={agregandoBot} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 border border-red-500/20 disabled:opacity-50 transition-all">Difícil</button>
                          </div>
                          {agregandoBot && <p className="text-celeste-400/50 text-xs mt-2 text-center">Agregando...</p>}
                        </div>
                      );
                    }

                    return (
                      <div className="mb-4 p-3 glass rounded-xl border border-celeste-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-celeste-300 text-sm font-medium flex items-center gap-1.5">
                            <span className="text-lg">🤖</span> Agregar Bot
                          </span>
                          <span className="text-celeste-500/50 text-xs">({mesa.jugadores.length}/{maxJugadores})</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className={`rounded-lg p-2 border ${hayEspacioEq1 ? "border-celeste-600/40 bg-celeste-950/30" : "border-gray-700/30 bg-gray-900/30 opacity-50"}`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full bg-celeste-500" />
                              <span className="text-celeste-400 text-xs font-medium">Equipo 1</span>
                              <span className="text-celeste-500/50 text-[10px] ml-auto">{eq1Count}/{maxPorEquipo}</span>
                            </div>
                            {hayEspacioEq1 ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleAgregarBot("facil", 1)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 disabled:opacity-50 transition-all" title="Bot Fácil">🟢</button>
                                <button onClick={() => handleAgregarBot("medio", 1)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 disabled:opacity-50 transition-all" title="Bot Medio">🟡</button>
                                <button onClick={() => handleAgregarBot("dificil", 1)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 transition-all" title="Bot Difícil">🔴</button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[10px]">Equipo lleno</span>
                            )}
                          </div>

                          <div className={`rounded-lg p-2 border ${hayEspacioEq2 ? "border-red-600/40 bg-red-950/30" : "border-gray-700/30 bg-gray-900/30 opacity-50"}`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-400 text-xs font-medium">Equipo 2</span>
                              <span className="text-red-500/50 text-[10px] ml-auto">{eq2Count}/{maxPorEquipo}</span>
                            </div>
                            {hayEspacioEq2 ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleAgregarBot("facil", 2)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 disabled:opacity-50 transition-all" title="Bot Fácil">🟢</button>
                                <button onClick={() => handleAgregarBot("medio", 2)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 disabled:opacity-50 transition-all" title="Bot Medio">🟡</button>
                                <button onClick={() => handleAgregarBot("dificil", 2)} disabled={agregandoBot} className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 transition-all" title="Bot Difícil">🔴</button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[10px]">Equipo lleno</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-gray-500">
                          <span>🟢 Fácil</span><span>🟡 Medio</span><span>🔴 Difícil</span>
                        </div>

                        <button
                          onClick={() => handleLlenarConBots("dificil")}
                          disabled={agregandoBot}
                          className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600/40 to-purple-500/40 text-purple-200 hover:from-purple-600/60 hover:to-purple-500/60 border border-purple-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          <span>⚡</span> Llenar con Bots
                        </button>

                        {agregandoBot && <p className="text-celeste-400/50 text-xs mt-2 text-center">Agregando...</p>}
                      </div>
                    );
                  })()}

                {/* Invitar Amigos */}
                {esAnfitrion() && mesa.jugadores.length < maxJugadores && (
                  <div className="mb-4 p-3 glass rounded-xl border border-green-500/20">
                    <button
                      onClick={() => {
                        setMostrarAmigos(!mostrarAmigos);
                        if (!mostrarAmigos) cargarAmigosConectados();
                      }}
                      className="w-full flex items-center justify-between text-green-300 text-sm font-medium"
                    >
                      <span className="flex items-center gap-1.5"><span className="text-lg">👥</span> Invitar Amigos</span>
                      <span className={`transition-transform ${mostrarAmigos ? "rotate-180" : ""}`}>▼</span>
                    </button>

                    {mostrarAmigos && (
                      <div className="mt-3 space-y-2">
                        {cargandoAmigos ? (
                          <p className="text-green-400/50 text-xs text-center">Cargando amigos...</p>
                        ) : amigosConectados.length === 0 ? (
                          <p className="text-green-400/50 text-xs text-center italic">No hay amigos conectados</p>
                        ) : (
                          amigosConectados.map((amigo) => (
                            <div key={amigo.id} className="flex items-center justify-between p-2 rounded-lg bg-green-950/30 border border-green-700/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-white text-sm">{amigo.apodo}</span>
                              </div>
                              <button
                                onClick={() => handleInvitarAmigo(amigo.id)}
                                disabled={invitandoAmigo === amigo.id}
                                className="px-3 py-1 text-xs font-medium rounded-lg bg-green-600/40 text-green-200 hover:bg-green-600/60 border border-green-500/30 disabled:opacity-50 transition-all"
                              >
                                {invitandoAmigo === amigo.id ? "..." : "Invitar"}
                              </button>
                            </div>
                          ))
                        )}
                        <button onClick={cargarAmigosConectados} disabled={cargandoAmigos} className="w-full text-xs text-green-500/60 hover:text-green-400 transition-colors">
                          🔄 Actualizar lista
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {esAnfitrion() ? (
                  <button
                    onClick={handleIniciarPartida}
                    disabled={loading || mesa.jugadores.length < 2 || (mesa.jugadores.length > 2 && !equiposBalanceados)}
                    className="btn-primary w-full text-white py-4 rounded-xl text-lg disabled:opacity-40"
                  >
                    {loading ? "Iniciando..." : `Iniciar Partida (${mesa.jugadores.length} jugadores)`}
                  </button>
                ) : (
                  <p className="text-gold-500/50 text-center italic">Esperando al anfitrión...</p>
                )}
              </>
            )}

            {!mesa && (
              <div className="text-gold-500/50 text-center">
                <div className="loading-dots mx-auto"><span></span><span></span><span></span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === MAIN GAME ===
  const inicioMano = mesa.inicioManoActual || 0;
  const cartasManoActual = mesa.cartasMesa.slice(inicioMano);
  const jugadorDelTurno = mesa.jugadores[mesa.turnoActual];

  const cartasJugadasPorJugador = (jugadorId: string) => {
    return cartasManoActual.filter((c) => c.jugadorId === jugadorId).map((c) => c.carta);
  };
  const yaJugueEnEstaMano = cartasManoActual.some((c) => c.jugadorId === socketId);

  // === SLOT-BASED PLAYER POSITIONING ===
  const miIndex = mesa.jugadores.findIndex((j) => j.id === socketId);

  const playerSlotMap = (() => {
    const map = new Map<string, PlayerSlot>();
    const numJugadores = mesa.jugadores.length;

    mesa.jugadores.forEach((j, jugadorIndex) => {
      if (j.id === socketId) return;
      const posRel = (jugadorIndex - miIndex + numJugadores) % numJugadores;

      let slot: PlayerSlot | null = null;
      if (numJugadores === 2) slot = "top";
      else if (numJugadores === 4) {
        if (posRel === 1) slot = "right";
        else if (posRel === 2) slot = "top";
        else if (posRel === 3) slot = "left";
      } else if (numJugadores === 6) {
        if (posRel === 1) slot = "side-right";
        else if (posRel === 2) slot = "top-right";
        else if (posRel === 3) slot = "top-center";
        else if (posRel === 4) slot = "top-left";
        else if (posRel === 5) slot = "side-left";
      }
      if (slot) map.set(j.id, slot);
    });
    return map;
  })();

  const getSlotForPlayer = (jugadorId: string): PlayerSlot | null => {
    return playerSlotMap.get(jugadorId) || null;
  };

  const { topRowPlayers, leftSidePlayer, rightSidePlayer } = (() => {
    const order: Record<string, number> = {
      "top-left": 0, top: 1, "top-center": 1, "top-right": 2,
    };
    const top = mesa.jugadores
      .filter((j) => {
        const slot = playerSlotMap.get(j.id);
        return slot && (slot === "top" || slot.startsWith("top-"));
      })
      .sort((a, b) =>
        (order[playerSlotMap.get(a.id) || ""] ?? 1) - (order[playerSlotMap.get(b.id) || ""] ?? 1)
      );

    const left = mesa.jugadores.find((j) => {
      const slot = playerSlotMap.get(j.id);
      return slot === "left" || slot === "side-left";
    }) || null;

    const right = mesa.jugadores.find((j) => {
      const slot = playerSlotMap.get(j.id);
      return slot === "right" || slot === "side-right";
    }) || null;

    return { topRowPlayers: top, leftSidePlayer: left, rightSidePlayer: right };
  })();

  // Helper to render a player indicator using the extracted component
  const renderPlayerIndicator = (j: (typeof mesa.jugadores)[0], compact: boolean = false) => {
    return (
      <PlayerIndicator
        key={j.id}
        jugador={j}
        compact={compact}
        esSuTurno={jugadorDelTurno?.id === j.id}
        esCompanero={j.equipo === miEquipo}
        bubble={speechBubbles.find((b) => b.jugadorId === j.id)}
        cartasJugadas={cartasJugadasPorJugador(j.id)}
        getMarcoForPlayer={getMarcoForPlayer}
        getCardBackStyle={getCardBackStyle}
      />
    );
  };

  const temaActivo = getTemaActivo();

  return (
    <div
      className={`min-h-screen p-2 sm:p-4 overflow-hidden ${!temaActivo ? "bg-table-wood" : ""}`}
      style={
        temaActivo
          ? { background: `linear-gradient(to bottom right, ${temaActivo.colors[0]}, ${temaActivo.colors[1]}, ${temaActivo.colors[2]})` }
          : undefined
      }
    >
      {/* Textura sutil para temas premium */}
      {temaActivo && (
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      )}

      {/* Iluminación de pulpería */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${temaActivo ? temaActivo.accent + "26" : "rgba(245, 158, 11, 0.1)"} 0%, transparent 70%)` }}
        />
      </div>

      {/* Toast de mensaje */}
      {mensaje && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 toast px-6 py-3 rounded-xl animate-slide-down">
          <span className="text-gold-300 font-bold text-lg">{mensaje}</span>
        </div>
      )}

      {/* Notificación de monedas ganadas */}
      {monedasGanadas && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl animate-slide-down bg-gradient-to-r from-gold-600/90 to-gold-500/90 backdrop-blur-sm border border-gold-400/50 shadow-lg shadow-gold-500/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#x1FA99;</span>
            <div>
              <span className="text-black font-bold text-lg">+{monedasGanadas.cantidad} monedas</span>
              <span className="text-black/60 text-sm ml-2">Balance: {monedasGanadas.balance}</span>
            </div>
            {!yaDuplico && (
              <button
                onClick={() => setMostrarRewardedPostGame(true)}
                className="ml-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                &#x1F4FA; Duplicar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rewarded Ad post-game */}
      {mostrarRewardedPostGame && monedasGanadas && (
        <RewardedAd
          rewardAmount={monedasGanadas.cantidad}
          onRewardEarned={async () => {
            const result = await socketService.reclamarRecompensaVideo();
            if (result.success && result.balance) {
              setMonedasGanadas({ ...monedasGanadas, cantidad: monedasGanadas.cantidad * 2, balance: result.balance });
            }
            setMostrarRewardedPostGame(false);
            setYaDuplico(true);
          }}
          onCancel={() => setMostrarRewardedPostGame(false)}
        />
      )}

      {/* Notificación de jugador desconectado */}
      {jugadorDesconectado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Jugador desconectado">
          <div className="glass rounded-2xl p-6 max-w-sm w-full border border-red-600/50 animate-slide-up text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-red-300 mb-2">{jugadorDesconectado.nombre} se desconectó</h3>
            <p className="text-sm text-gold-400/70 mb-4">
              {jugadorDesconectado.esAnfitrion ? "El anfitrión abandonó la partida." : "Un jugador abandonó la partida."} Podés esperar a que se reconecte o abandonar.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setJugadorDesconectado(null)} className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500 transition-all shadow-lg">Esperar</button>
              <button onClick={() => { setJugadorDesconectado(null); handleTerminarPartida(); }} className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500 transition-all shadow-lg">Abandonar</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de ayuda */}
      {mesa.estado === "jugando" && misCartas().length > 0 && (
        <PanelAyuda cartas={misCartas()} muestra={mesa.muestra} envidoYaCantado={mesa.envidoYaCantado} florYaCantada={!!mesa.florYaCantada} />
      )}

      {/* Chat en partida */}
      {mesa.estado === "jugando" && (
        <>
          {!chatAbierto && (
            <button
              onClick={() => { setChatAbierto(true); setMensajesNoLeidos(0); }}
              className="fixed bottom-24 right-3 z-40 glass rounded-full w-12 h-12 flex items-center justify-center border border-celeste-500/30 bg-celeste-950/60 shadow-lg hover:bg-celeste-900/70 transition-all"
              title="Abrir chat"
            >
              <span className="text-xl">💬</span>
              {mensajesNoLeidos > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {mensajesNoLeidos > 9 ? "9+" : mensajesNoLeidos}
                </span>
              )}
            </button>
          )}
          {chatAbierto && (
            <div className="fixed bottom-24 right-3 z-40 w-72 sm:w-80 max-h-80 glass rounded-xl border border-celeste-500/30 bg-celeste-950/80 shadow-xl flex flex-col overflow-hidden animate-slide-up">
              <div className="flex items-center justify-between px-3 py-2 border-b border-celeste-500/20 bg-celeste-900/40">
                <div className="flex gap-1">
                  <button onClick={() => setChatTab("general")} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chatTab === "general" ? "bg-celeste-600 text-white" : "text-celeste-400 hover:bg-celeste-800/50"}`}>General</button>
                  <button onClick={() => setChatTab("equipo")} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chatTab === "equipo" ? "bg-green-600 text-white" : "text-celeste-400 hover:bg-celeste-800/50"}`}>Mi Equipo</button>
                </div>
                <button onClick={() => setChatAbierto(false)} className="text-celeste-400/60 hover:text-celeste-300 text-sm px-2 py-1 rounded hover:bg-celeste-800/30 transition-all" title="Cerrar chat">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-48 scrollbar-thin scrollbar-thumb-celeste-700 scrollbar-track-transparent">
                {mensajesChat.filter((m) => chatTab === "general" ? m.tipo === "general" : m.tipo === "equipo").map((m, i) => {
                  const esMio = m.jugadorId === socketId;
                  const colorEquipo = m.equipo === 1 ? "text-blue-300" : "text-orange-300";
                  return (
                    <div key={i} className={`text-xs ${esMio ? "text-right" : ""}`}>
                      <span className={`font-medium ${esMio ? "text-celeste-300" : colorEquipo}`}>{esMio ? "Vos" : m.jugadorNombre}:</span>{" "}
                      <span className="text-white/90">{m.mensaje}</span>
                    </div>
                  );
                })}
                {mensajesChat.filter((m) => chatTab === "general" ? m.tipo === "general" : m.tipo === "equipo").length === 0 && (
                  <div className="text-celeste-500/50 text-xs text-center py-4">
                    {chatTab === "equipo" ? "Chat privado con tu equipo" : "Sin mensajes aún"}
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-celeste-500/20 flex gap-2">
                <label htmlFor="chat-input" className="sr-only">Mensaje de chat</label>
                <input
                  id="chat-input"
                  type="text"
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnviarMensaje()}
                  placeholder={chatTab === "equipo" ? "Mensaje al equipo..." : "Escribí un mensaje..."}
                  className="flex-1 bg-celeste-900/50 border border-celeste-600/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder-celeste-500/50 focus:outline-none focus:border-celeste-500/50"
                  maxLength={200}
                />
                <button onClick={handleEnviarMensaje} disabled={!inputChat.trim() || enviadoChat} aria-label="Enviar mensaje" className="px-3 py-1.5 rounded-lg bg-celeste-600 hover:bg-celeste-500 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all">➤</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Banner de Pico a Pico */}
      {mesa.modoRondaActual === "1v1" && mesa.modoAlternadoHabilitado && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="glass rounded-xl px-4 py-2 border border-yellow-500/40 bg-yellow-950/40">
            <span className="text-yellow-300 font-bold text-sm flex items-center gap-2">
              🐔 Pico a Pico
              <span className="text-yellow-400/60 text-xs font-normal">(1v1 en malas)</span>
            </span>
          </div>
        </div>
      )}

      {/* Resultado de FLOR - solo resultado, el anuncio individual sale como speech bubble sobre el avatar */}
      {florResultado && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce-in">
          <div className="bg-gradient-to-r from-pink-700/90 to-purple-600/90 backdrop-blur-md rounded-xl px-6 py-3 shadow-lg shadow-pink-500/30 border border-pink-400/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆🌸</span>
              <div className="text-lg font-bold text-white">¡Equipo {florResultado.ganador} gana +{florResultado.puntosGanados}!</div>
            </div>
          </div>
        </div>
      )}

      {/* Declaraciones de Envido */}
      {envidoDeclaraciones.length > 0 && !envidoResultado && (
        <div className="fixed top-20 right-4 z-30 pointer-events-none animate-slide-down">
          <div className="bg-gradient-to-br from-purple-800/90 to-purple-900/90 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg shadow-purple-500/20 border border-purple-500/40 max-w-xs">
            <div className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2"><span>🎯</span> Declarando Envido</div>
            <div className="space-y-1">
              {envidoDeclaraciones.slice(-3).map((decl, i) => (
                <div key={i} className={`text-xs py-1 px-2 rounded ${decl.equipo === 1 ? "bg-celeste-900/40 text-celeste-200" : "bg-red-900/40 text-red-200"}`}>
                  <span className="font-medium">{decl.jugadorNombre}:</span>
                  <span className="ml-1 text-white">{decl.sonBuenas ? '"Son buenas..."' : `"${decl.puntos}"`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resultado del Envido */}
      {envidoResultado && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce-in">
          <div className="bg-gradient-to-r from-green-700/90 to-emerald-600/90 backdrop-blur-md rounded-xl px-6 py-3 shadow-lg shadow-green-500/30 border border-green-400/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆🎯</span>
              <div>
                <div className="text-lg font-bold text-white">¡Equipo {envidoResultado.ganador} gana el envido!</div>
                <div className="text-sm text-green-200">+{envidoResultado.puntosGanados} puntos</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner de fin de ronda */}
      {rondaBanner && !mesa.winnerJuego && (
        <div className="fixed top-16 left-1/2 z-40 banner-flotante pointer-events-none">
          <div className={`rounded-2xl px-10 py-5 backdrop-blur-md border-2 shadow-2xl text-center boliche-panel esquina-decorativa ${rondaBanner.equipo === 1 ? "border-celeste-500/50 shadow-celeste-500/30" : "border-red-500/50 shadow-red-500/30"}`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-wood-900 border border-gold-600/40">
              <span className="text-gold-400 text-xs font-bold uppercase tracking-wider">Ronda</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mb-2 titulo-rustico mt-2">{rondaBanner.mensaje}</div>
            <div className="separador-uy mb-2" />
            <div className={`text-lg font-bold ${rondaBanner.equipo === 1 ? "text-celeste-300" : "text-red-300"}`}>
              +{rondaBanner.puntos} puntos 🧉
            </div>

            {rondaBanner.muestra && ((rondaBanner.cartasFlor?.length ?? 0) > 0 || (rondaBanner.cartasEnvido?.length ?? 0) > 0) && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-yellow-400/70 text-xs font-medium">Muestra:</span>
                <div className="w-10 h-[3.75rem] rounded-lg overflow-hidden shadow-lg border border-yellow-500/50 relative">
                  <Image src={getCartaImageUrl(rondaBanner.muestra)} alt="Muestra" fill sizes="40px" className="object-cover" />
                </div>
              </div>
            )}

            {rondaBanner.cartasFlor && rondaBanner.cartasFlor.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gold-600/30">
                <div className="text-pink-400 text-sm font-bold mb-2">🌸 FLOR:</div>
                <div className="flex flex-col gap-3">
                  {rondaBanner.cartasFlor.map((florInfo, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-gold-300 text-xs font-semibold">{florInfo.jugadorNombre}</span>
                      <div className="flex gap-1.5 justify-center">
                        {florInfo.cartas.map((carta, cIdx) => (
                          <div key={cIdx} className="w-12 h-[4.5rem] rounded-lg overflow-hidden shadow-lg border border-gold-600/30 relative">
                            <Image src={getCartaImageUrl(carta)} alt={`${carta.valor} de ${carta.palo}`} fill sizes="48px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rondaBanner.cartasEnvido && rondaBanner.cartasEnvido.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gold-600/30">
                <div className="text-purple-400 text-sm font-bold mb-2">🎯 ENVIDO:</div>
                <div className="flex flex-col gap-3">
                  {rondaBanner.cartasEnvido.map((envidoInfo, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-gold-300 text-xs font-semibold">{envidoInfo.jugadorNombre} ({envidoInfo.puntos} pts)</span>
                      <div className="flex gap-1.5 justify-center">
                        {envidoInfo.cartas.map((carta, cIdx) => (
                          <div key={cIdx} className="w-12 h-[4.5rem] rounded-lg overflow-hidden shadow-lg border border-gold-600/30 relative">
                            <Image src={getCartaImageUrl(carta)} alt={`${carta.valor} de ${carta.palo}`} fill sizes="48px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-game panel (game over) */}
      {mesa.winnerJuego && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="boliche-panel rounded-2xl p-8 shadow-2xl text-center max-w-md animate-slide-up border-2 border-gold-600/50 esquina-decorativa luz-lampara">
            <div className="relative mb-4">
              <div className="text-5xl brillo-dorado">🏆</div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl animate-pulse">☀️</div>
            </div>
            <p className="text-3xl font-bold text-gold-300 mb-2 titulo-rustico">¡Equipo {mesa.winnerJuego} gana!</p>
            <div className="separador-uy my-4" />
            <div className="flex justify-center gap-6 mb-6">
              <div className={`px-4 py-2 rounded-lg ${mesa.winnerJuego === 1 ? "bg-celeste-600/30 border border-celeste-500/50" : "bg-wood-800/50 border border-gold-800/30"}`}>
                <div className="text-xs text-gold-500/60 uppercase">Equipo 1</div>
                <div className={`text-2xl font-bold ${mesa.winnerJuego === 1 ? "text-celeste-300" : "text-gold-400/70"}`}>{mesa.equipos[0].puntaje}</div>
              </div>
              <div className="text-gold-600/50 self-center text-xl">vs</div>
              <div className={`px-4 py-2 rounded-lg ${mesa.winnerJuego === 2 ? "bg-red-600/30 border border-red-500/50" : "bg-wood-800/50 border border-gold-800/30"}`}>
                <div className="text-xs text-gold-500/60 uppercase">Equipo 2</div>
                <div className={`text-2xl font-bold ${mesa.winnerJuego === 2 ? "text-red-300" : "text-gold-400/70"}`}>{mesa.equipos[1].puntaje}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {esAnfitrion() && (
                <>
                  <button onClick={handleRevancha} disabled={loading} className="btn-primary btn-campo text-white py-3 px-8 rounded-xl text-lg font-bold w-full">🔄 Revancha Directa</button>
                  <button onClick={handleTirarReyes} disabled={loading} className="flex items-center justify-center gap-2 py-3 px-8 rounded-xl font-bold bg-gradient-to-r from-amber-700 to-amber-600 text-white hover:from-amber-600 hover:to-amber-500 transition-all w-full btn-campo">👑 Tirar Reyes (mezclar equipos)</button>
                </>
              )}
              {!esAnfitrion() && <p className="text-gold-500/60 text-sm italic mb-2">🧉 Esperando al anfitrión...</p>}
              <button onClick={() => (window.location.href = "/lobby")} className="py-3 px-8 rounded-xl font-medium glass text-gold-300/70 hover:text-gold-200 hover:bg-white/5 border border-gold-800/30 w-full btn-campo">🚪 Salir al Lobby</button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col">
        {/* Header: Marcadores */}
        <div className="flex justify-between items-stretch gap-2 sm:gap-3 mb-1 sm:mb-2">
          <ScoreBoard equipo={1} puntos={mesa.equipos[0].puntaje} isMyTeam={miEquipo === 1} />

          {/* Info central */}
          <div className="flex-1 flex flex-col items-center justify-center boliche-panel rounded-xl px-2 sm:px-3 py-1.5 border-gold-700/30 relative">
            {/* Control de audio */}
            <div className="absolute -top-1 -left-1 flex items-center gap-1 z-20">
              <button
                onClick={() => { const m = !muted; audioManager.setMuted(m); setMuted(m); }}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="text-[13px] opacity-50 hover:opacity-90 transition-opacity px-1 py-0.5"
                title={muted ? "Activar sonido" : "Silenciar todo"}
              >
                {muted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-400/60">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-400/80">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
              {showVolumeSlider && !muted && (
                <div className="flex items-center gap-1 bg-wood-900/90 border border-gold-700/30 rounded-lg px-2 py-1 shadow-lg" onMouseLeave={() => setShowVolumeSlider(false)}>
                  <input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(e) => { const v = parseInt(e.target.value) / 100; audioManager.setVolume(v); setVolume(v); }} className="w-20 h-1 accent-gold-500 cursor-pointer" title={`Volumen: ${Math.round(volume * 100)}%`} />
                  <span className="text-[9px] text-gold-400/60 min-w-[24px] text-right">{Math.round(volume * 100)}%</span>
                </div>
              )}
            </div>

            {/* Botón abandonar partida */}
            {mesa.estado === "jugando" && (
              <button
                onClick={handleTerminarPartida}
                disabled={loading}
                className="absolute -top-1 -right-1 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-red-900/80 hover:bg-red-700 border border-red-500/50 text-red-300 hover:text-white transition-all disabled:opacity-50 shadow-lg"
                title="Abandonar partida (tu equipo pierde)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}

            <div className="text-gold-400/70 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Mano {mesa.manoActual}/3</div>
            {mesa.puntosEnJuego > 1 && (
              <div className="text-gold-300 font-bold text-xs sm:text-sm titulo-rustico">
                {mesa.nivelGritoAceptado ? getNombreGrito(mesa.nivelGritoAceptado) : ""} ({mesa.puntosEnJuego} pts)
              </div>
            )}
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((m) => {
                const ganador = mesa.ganadoresManos[m - 1];
                return (
                  <div key={m} className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                    ganador === null ? "bg-gray-500/80 border-gray-400/60 shadow-inner"
                      : ganador === 1 ? "bg-celeste-500 border-celeste-400 shadow-lg shadow-celeste-500/40"
                        : ganador === 2 ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/40"
                          : "border-gold-700/40 bg-wood-800/50"
                  }`} />
                );
              })}
            </div>
          </div>

          <ScoreBoard equipo={2} puntos={mesa.equipos[1].puntaje} isMyTeam={miEquipo === 2} />
        </div>

        {/* Sub-marcador Pico a Pico */}
        {mesa.modoRondaActual === "1v1" && (
          <div className="flex justify-center mb-1">
            <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1 flex items-center gap-2 border border-gold-600/30">
              <span className="text-[10px] text-gold-400 uppercase tracking-wider font-medium">Pico a Pico</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((cruceIndex) => {
                  const ganador = mesa.ganadoresCrucesPicoAPico?.[cruceIndex];
                  const esCruceActual = (mesa.duellosPicoAPicoJugados || 0) === cruceIndex;
                  return (
                    <div key={cruceIndex} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      ganador === 1 ? "bg-celeste-500 text-white"
                        : ganador === 2 ? "bg-red-500 text-white"
                          : esCruceActual ? "bg-gold-500/50 text-gold-200 ring-2 ring-gold-400 animate-pulse"
                            : "bg-gray-600/50 text-gray-400"
                    }`} title={`Cruce ${cruceIndex + 1}${ganador ? ` - Ganó Equipo ${ganador}` : esCruceActual ? " (En curso)" : ""}`}>
                      {ganador ? ganador : cruceIndex + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mesa de juego */}
        <div className="flex-1 flex flex-col">
          {/* Top row players */}
          <div className="flex justify-center gap-3 sm:gap-6 mb-1 sm:mb-2">
            {topRowPlayers.map((j) => renderPlayerIndicator(j))}
          </div>
          {/* Mesa with optional side players */}
          <div className="flex-1 flex flex-row items-stretch gap-1 sm:gap-2">
            {leftSidePlayer && (
              <div className="flex flex-col items-center justify-center w-16 sm:w-24">
                {renderPlayerIndicator(leftSidePlayer)}
              </div>
            )}

            {/* Mesa central */}
            <div
              className="flex-1 mesa-flat wood-border rounded-[2rem] sm:rounded-[3rem] p-3 sm:p-4 relative flex flex-col justify-center items-center min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"
              style={getMesaFeltStyle()}
            >
              <div className="lampara-glow" />
              <div className="pulperia-light rounded-[2rem] sm:rounded-[3rem]" />
              {/* Highlight del fieltro según tema */}
              {temaActivo?.feltLight && (
                <div
                  className="absolute inset-0 rounded-[2rem] sm:rounded-[3rem] pointer-events-none z-0"
                  style={{ background: `radial-gradient(ellipse at 50% 50%, ${temaActivo.feltLight} 0%, transparent 70%)` }}
                />
              )}

              {/* Muestra y Mazo */}
              {mesa.muestra && mesa.fase !== "cortando" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5 flex flex-row items-center gap-2 sm:gap-4">
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] sm:text-[10px] lg:text-xs text-gold-400/40 font-medium mb-1 uppercase tracking-wider">Mazo</div>
                    <div className="relative">
                      <div className="w-10 h-[3.75rem] sm:w-14 sm:h-[5.25rem] lg:w-16 lg:h-24 card-back rounded-lg shadow-lg" style={getCardBackStyle()} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] sm:text-[10px] lg:text-[11px] text-gold-400/60 font-medium mb-1 uppercase tracking-wider">Muestra</div>
                    <div className="relative muestra-highlight">
                      <div className="absolute -inset-1.5 sm:-inset-2 bg-gold-500/30 rounded-xl blur-lg animate-pulse" />
                      <div className="absolute -inset-1 sm:-inset-1 border-2 border-gold-400/40 rounded-lg" />
                      <CartaImg carta={mesa.muestra} size="normal" />
                    </div>
                  </div>
                </div>
              )}

              {/* Phase: Repartiendo */}
              {(mesa.fase === "repartiendo" || isDealing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20" style={{ perspective: "1200px" }}>
                  <div className="text-gold-400 font-bold text-lg sm:text-xl mb-4 animate-pulse drop-shadow-lg">🃏 Repartiendo cartas... 🃏</div>
                  <div className="relative" style={{ transformStyle: "preserve-3d" }}>
                    <div className="absolute -top-2 -left-1 w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg opacity-50" style={{ transform: "translateZ(-6px)", ...getCardBackStyle() }} />
                    <div className="absolute -top-1 -left-0.5 w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg opacity-70" style={{ transform: "translateZ(-3px)", ...getCardBackStyle() }} />
                    <div className={`relative w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg shadow-2xl ${dealingCards.length > 0 ? "mazo-dealing" : ""}`} style={getCardBackStyle()} />

                    {dealingCards.map((deal, idx) => {
                      const jugadorIndex = deal.jugadorIndex;
                      const myIndex = mesa.jugadores.findIndex((j) => j.id === socketId);
                      const isMe = jugadorIndex === myIndex;

                      let targetX = 0, targetY = 0, rotation = 0, spinY = 0;
                      const scaleMid = 0.95;
                      let scaleEnd = 0.75;

                      if (isMe) {
                        targetY = 320; targetX = (deal.cartaIndex - 1) * 60;
                        rotation = (deal.cartaIndex - 1) * 3; spinY = -5; scaleEnd = 0.7;
                      } else {
                        const oponentesOrdenados = mesa.jugadores.filter((_, i) => i !== myIndex);
                        const oponenteIndex = oponentesOrdenados.findIndex((j) => {
                          const realIndex = mesa.jugadores.findIndex((p) => p.id === j.id);
                          return realIndex === jugadorIndex;
                        });
                        const numOponentes = oponentesOrdenados.length;

                        if (numOponentes === 1) {
                          targetX = (deal.cartaIndex - 1) * 50; targetY = -300;
                          rotation = (deal.cartaIndex - 1) * -2; spinY = 5; scaleEnd = 0.6;
                        } else {
                          const angle = (oponenteIndex / (numOponentes - 1) - 0.5) * Math.PI * 0.9;
                          targetX = Math.sin(angle) * 350 + (deal.cartaIndex - 1) * 35;
                          targetY = -Math.cos(angle) * 280 - 60;
                          rotation = angle * 15 + (deal.cartaIndex - 1) * 2;
                          spinY = Math.sin(angle) * 10; scaleEnd = 0.55;
                        }
                      }

                      const duration = 0.85;
                      const delay = idx * 150;

                      return (
                        <div
                          key={`deal-${idx}`}
                          className="absolute top-0 left-0 w-14 h-20 sm:w-16 sm:h-24 card-back rounded-lg shadow-xl animate-deal-card dealing-card"
                          style={{
                            ...getCardBackStyle(),
                            "--deal-x": `${targetX}px`, "--deal-y": `${targetY}px`,
                            "--deal-rotation": `${rotation}deg`, "--deal-spin": `${spinY}deg`,
                            "--deal-scale-mid": scaleMid, "--deal-scale-end": scaleEnd,
                            "--deal-duration": `${duration}s`, "--deal-delay": `${delay}ms`,
                          } as React.CSSProperties}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="text-gold-500/70 text-xs font-medium">
                      Vuelta {Math.floor(dealingCards.length / mesa.jugadores.length) + 1} de 3
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((v) => (
                        <div key={v} className={`w-4 h-4 rounded-full transition-all duration-500 ${
                          Math.floor(dealingCards.length / mesa.jugadores.length) >= v
                            ? "bg-gradient-to-br from-gold-300 to-gold-500 shadow-lg shadow-gold-500/50 scale-110"
                            : "bg-gold-900/40 border border-gold-700/30"
                        }`} />
                      ))}
                    </div>
                    <div className="text-gold-600/40 text-xs">{dealingCards.length} / {mesa.jugadores.length * 3} cartas</div>
                  </div>
                </div>
              )}

              {/* Phase: Cortando */}
              {mesa.fase === "cortando" && mesa.esperandoCorte && (
                <div className="relative z-10">
                  <MazoCorte
                    onCorte={handleRealizarCorte}
                    esperandoCorte={true}
                    esMiTurnoCorte={esMiTurnoDeCortar()}
                    cutAnimating={state.cutAnimating}
                    cutPosition={state.cutPosition}
                    setCutPosition={state.setCutPosition}
                    setCutAnimating={state.setCutAnimating}
                    getCardBackStyle={getCardBackStyle}
                  />
                  {puedeEcharPerros() && (
                    <div className="mt-6 flex justify-center">
                      <button onClick={handleEcharPerros} disabled={loading} className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-700 to-red-700 text-white hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 flex items-center gap-2" title="Contra Flor al Resto + Falta Envido + Truco">
                        🐕 Echar los Perros
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Modal de responder a los Perros */}
              {perrosActivos && equipoPerros !== miEquipo && mesa?.fase === "esperando_respuesta_perros" && (
                <PerrosResponseModal tengoFlor={tengoFlor()} loading={loading} onResponder={handleResponderPerros} misCartas={misCartas()} muestra={mesa?.muestra || null} />
              )}

              {/* Indicador de que echaste los perros */}
              {perrosActivos && equipoPerros === miEquipo && mesa?.fase === "esperando_respuesta_perros" && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-pulse">
                  <div className="glass rounded-xl px-6 py-3 border border-orange-500/50 flex items-center gap-3">
                    <span className="text-2xl">🐕</span>
                    <span className="text-orange-300 font-bold">¡Echaste los Perros!</span>
                    <span className="text-gold-400/70 text-sm">Esperando respuesta...</span>
                  </div>
                </div>
              )}

              {/* Indicador de perros echados */}
              {perrosActivos && mesa?.fase === "cortando" && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-pulse">
                  <div className="glass rounded-xl px-6 py-3 border border-orange-500/50 flex items-center gap-3">
                    <span className="text-2xl">🐕</span>
                    <span className="text-orange-300 font-bold">¡Perros echados!</span>
                    <span className="text-gold-400/70 text-sm">Esperando corte y reparto...</span>
                    {equipoPerros === miEquipo && (
                      <button onClick={handleCancelarPerros} disabled={loading} className="ml-2 px-3 py-1 rounded-lg text-sm font-bold bg-red-600/80 text-white hover:bg-red-500 transition-all">Cancelar</button>
                    )}
                  </div>
                </div>
              )}

              {/* Phase: Jugando - cartas jugadas */}
              {mesa.fase !== "cortando" && (
                <>
                  {cartasManoActual.map((jugada, i) => {
                    const esMiCarta = jugada.jugadorId === socketId;
                    const realIndex = inicioMano + i;
                    const numParticipantesActuales = mesa.jugadores.filter((j: Jugador) => j.participaRonda !== false && !j.seVaAlMazo).length;
                    const esCartaGanadora = mesa.cartaGanadoraMano && mesa.cartaGanadoraMano.indexEnMesa === realIndex && cartasManoActual.length === numParticipantesActuales;

                    let posicionStyle: React.CSSProperties = {};

                    if (esMiCarta) {
                      posicionStyle = { position: "absolute", bottom: "5%", left: "46.5%", transform: "translateX(-50%)", zIndex: esCartaGanadora ? 50 : 15 + i };
                    } else {
                      const slot = getSlotForPlayer(jugada.jugadorId);
                      const z = esCartaGanadora ? 50 : 15 + i;
                      switch (slot) {
                        case "top": posicionStyle = { position: "absolute", top: "5%", left: "46.5%", transform: "translateX(-50%)", zIndex: z }; break;
                        case "left": posicionStyle = { position: "absolute", top: "40%", left: "27%", transform: "translate(-50%, -50%)", zIndex: z }; break;
                        case "right": posicionStyle = { position: "absolute", top: "40%", right: "27%", transform: "translate(50%, -50%)", zIndex: z }; break;
                        case "side-left": posicionStyle = { position: "absolute", top: "43%", left: "8%", transform: "translateY(-50%)", zIndex: z }; break;
                        case "top-left": posicionStyle = { position: "absolute", top: "10%", left: "20%", zIndex: z }; break;
                        case "top-center": posicionStyle = { position: "absolute", top: "10%", left: "47%", transform: "translateX(-50%)", zIndex: z }; break;
                        case "top-right": posicionStyle = { position: "absolute", top: "10%", right: "20%", zIndex: z }; break;
                        case "side-right": posicionStyle = { position: "absolute", top: "43%", right: "8%", transform: "translateY(-50%)", zIndex: z }; break;
                      }
                    }

                    return (
                      <div key={i} className={`text-center card-played-anim ${esCartaGanadora ? "card-winner card-winner-glow" : ""}`} style={{ ...posicionStyle, animationDelay: `${i * 0.1}s` }}>
                        <CartaImg carta={jugada.carta} size="normal" showGlow={!!esCartaGanadora} />
                        {esCartaGanadora && <div className="text-[10px] sm:text-xs mt-1 font-bold text-yellow-400">🏆</div>}
                      </div>
                    );
                  })}
                  {cartasManoActual.length === 0 && mesa.estado === "jugando" && mesa.fase === "jugando" && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="text-green-300/40 text-sm">Esperando cartas...</div>
                    </div>
                  )}
                </>
              )}

              {/* Indicador de turno */}
              {mesa.estado === "jugando" && mesa.fase === "jugando" && !mesa.gritoActivo && !mesa.envidoActivo && (
                <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20">
                  <div className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full ${esMiTurno() ? "bg-gold-500 text-wood-950 turn-indicator" : "bg-black/40 text-white/70"}`}>
                    {esMiTurno() ? "¡Tu turno!" : `Turno: ${jugadorDelTurno?.nombre}`}
                  </div>
                </div>
              )}
            </div>

            {rightSidePlayer && (
              <div className="flex flex-col items-center justify-center w-16 sm:w-24">
                {renderPlayerIndicator(rightSidePlayer)}
              </div>
            )}
          </div>{" "}

          {/* Paneles de respuesta */}
          <div className="fixed inset-x-0 bottom-[155px] z-30 px-3 sm:static sm:inset-auto sm:bottom-auto sm:z-auto sm:px-0">
            {/* Preview de mis cartas */}
            {((deboResponderGrito() && mesa.gritoActivo) || (deboResponderEnvido() && mesa.envidoActivo) || (florPendiente && miEquipo === florPendiente.equipoQueResponde && tengoFlor())) && misCartas().length > 0 && (
              <div className="flex justify-center items-center gap-1.5 sm:gap-2 mb-1.5">
                <span className="text-gold-500/50 text-xs hidden sm:inline">Tus cartas:</span>
                {misCartas().map((carta, index) => (
                  <CartaImg key={`preview-${carta.palo}-${carta.valor}-${index}`} carta={carta} size="small" />
                ))}
              </div>
            )}

            {/* Panel respuesta Truco */}
            {deboResponderGrito() && mesa.gritoActivo && (
              <div className="glass-gold rounded-xl p-3 my-1.5 text-center border border-gold-600/40 animate-slide-up">
                <p className="text-base font-bold text-gold-300 mb-2">
                  {mesa.jugadores.find((j) => j.id === mesa.gritoActivo!.jugadorQueGrita)?.nombre} cantó {getNombreGrito(mesa.gritoActivo.tipo)}
                </p>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button onClick={() => handleResponderTruco(true)} disabled={loading} className="btn-quiero text-white">¡QUIERO!</button>
                  <button onClick={() => handleResponderTruco(false)} disabled={loading} className="btn-no-quiero text-white">NO QUIERO</button>
                  {mesa.gritoActivo.tipo === "truco" && <button onClick={() => handleResponderTruco(true, "retruco")} disabled={loading} className="btn-truco text-white">QUIERO RETRUCO</button>}
                  {mesa.gritoActivo.tipo === "retruco" && <button onClick={() => handleResponderTruco(true, "vale4")} disabled={loading} className="btn-truco text-white">QUIERO VALE 4</button>}
                </div>
              </div>
            )}

            {/* Panel respuesta Envido */}
            {deboResponderEnvido() && mesa.envidoActivo && (() => {
              const compañeroYaAcepto = mesa.respuestasEnvido && Object.entries(mesa.respuestasEnvido).some(
                ([id, resp]) => resp === true && id !== socketId && mesa.jugadores.find((j) => j.id === id)?.equipo === miEquipo,
              );
              const ultimoTipo = mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1];
              const tieneRealEnvido = mesa.envidoActivo.tipos.includes("real_envido");
              const tieneFaltaEnvido = mesa.envidoActivo.tipos.includes("falta_envido");
              const tieneEnvidoCargado = mesa.envidoActivo.tipos.some((t: string) => t.startsWith("cargado_"));
              const mostrarEnvido = ultimoTipo === "envido" && !tieneRealEnvido && !tieneFaltaEnvido && !tieneEnvidoCargado;
              const mostrarRealEnvido = !tieneRealEnvido && !tieneFaltaEnvido && !tieneEnvidoCargado;
              const mostrarFaltaEnvido = !tieneFaltaEnvido;

              return (
                <div className="glass rounded-xl p-3 my-1.5 text-center border border-purple-600/40 animate-slide-up">
                  <p className="text-base font-bold text-purple-300 mb-1">
                    {mesa.jugadores.find((j) => j.id === mesa.envidoActivo!.jugadorQueCanta)?.nombre} cantó {getNombreEnvido(mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1])}
                  </p>
                  <p className="text-sm text-purple-400/70 mb-3">En juego: {mesa.envidoActivo.puntosAcumulados} pts</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    <button onClick={() => handleResponderEnvido(true)} disabled={loading} className="btn-quiero text-white">¡QUIERO!</button>
                    {!compañeroYaAcepto && <button onClick={() => handleResponderEnvido(false)} disabled={loading} className="btn-no-quiero text-white">NO QUIERO</button>}
                    {mostrarEnvido && <button onClick={() => handleCantarEnvido("envido")} disabled={loading} className="btn-envido text-white">Envido</button>}
                    {mostrarRealEnvido && <button onClick={() => handleCantarEnvido("real_envido")} disabled={loading} className="btn-envido text-white">Real Envido</button>}
                    {mostrarFaltaEnvido && <button onClick={() => handleCantarEnvido("falta_envido")} disabled={loading} className="btn-envido text-white">Falta Envido</button>}
                  </div>
                </div>
              );
            })()}

            {/* Panel respuesta Flor */}
            {florPendiente && miEquipo === florPendiente.equipoQueResponde && tengoFlor() && (() => {
              const ultimo = florPendiente.ultimoTipo;
              const esContraFlor = ultimo === "contra_flor";
              const esConFlorEnvido = ultimo === "con_flor_envido";
              const titulo = esContraFlor
                ? `${florPendiente.jugadorNombre || "El rival"} cantó CONTRA FLOR AL RESTO`
                : esConFlorEnvido
                  ? `${florPendiente.jugadorNombre || "El rival"} cantó CON FLOR ENVIDO`
                  : "El equipo rival cantó FLOR";
              const subtitulo = esContraFlor
                ? "¿Querés aceptar la contra flor al resto?"
                : esConFlorEnvido
                  ? "¿Qué querés hacer?"
                  : "¡Vos también tenés flor! ¿Qué querés hacer?";

              return (
                <div className="glass rounded-xl p-3 my-1.5 text-center border border-pink-600/40 animate-slide-up">
                  <p className="text-base font-bold text-pink-300 mb-1">{titulo}</p>
                  <p className="text-sm text-pink-400/70 mb-3">{subtitulo}</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    <button onClick={() => handleResponderFlor("quiero")} disabled={loading} className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 transition-all shadow-lg">
                      {esContraFlor || esConFlorEnvido ? "¡QUIERO!" : "FLOR (Achicarse)"}
                    </button>
                    <button onClick={() => handleResponderFlor("no_quiero")} disabled={loading} className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-gray-600 to-gray-500 text-white hover:from-gray-500 hover:to-gray-400 transition-all shadow-lg">NO QUIERO</button>
                    {!esContraFlor && (
                      <>
                        {!esConFlorEnvido && (
                          <button onClick={() => handleResponderFlor("con_flor_envido")} disabled={loading} className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-purple-600 to-celeste-500 text-white hover:from-purple-500 hover:to-celeste-400 transition-all shadow-lg">CON FLOR ENVIDO</button>
                        )}
                        <button onClick={() => handleResponderFlor("contra_flor")} disabled={loading} className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-pink-600 to-red-600 text-white hover:from-pink-500 hover:to-red-500 transition-all shadow-lg">CONTRA FLOR AL RESTO</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>{" "}

          {/* Modal Envido Cargado */}
          {mostrarEnvidoCargado && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass rounded-2xl p-6 max-w-sm w-full border border-purple-600/50 animate-slide-up">
                <h3 className="text-xl font-bold text-purple-300 text-center mb-2">🎯 Envido Cargado</h3>
                <p className="text-gold-400/70 text-sm text-center mb-4">¿Cuántos puntos querés apostar?</p>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <button onClick={() => setPuntosEnvidoCargado(Math.max(1, puntosEnvidoCargado - 1))} className="w-12 h-12 rounded-full bg-purple-800/50 text-purple-300 text-2xl font-bold hover:bg-purple-700/50 transition-all">-</button>
                  <div className="w-20 h-16 flex items-center justify-center rounded-xl bg-purple-900/50 border-2 border-purple-500/50">
                    <span className="text-3xl font-bold text-white">{puntosEnvidoCargado}</span>
                  </div>
                  <button onClick={() => setPuntosEnvidoCargado(Math.min(99, puntosEnvidoCargado + 1))} className="w-12 h-12 rounded-full bg-purple-800/50 text-purple-300 text-2xl font-bold hover:bg-purple-700/50 transition-all">+</button>
                </div>
                <div className="flex justify-center gap-2 mb-6">
                  {[5, 10, 15, 20].map((pts) => (
                    <button key={pts} onClick={() => setPuntosEnvidoCargado(pts)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${puntosEnvidoCargado === pts ? "bg-purple-600 text-white" : "bg-purple-900/30 text-purple-300 hover:bg-purple-800/40"}`}>{pts}</button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setMostrarEnvidoCargado(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all">Cancelar</button>
                  <button onClick={handleCantarEnvidoCargado} disabled={loading} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-400 transition-all disabled:opacity-50">¡Apostar {puntosEnvidoCargado} puntos!</button>
                </div>
              </div>
            </div>
          )}

          {/* Mis cartas y controles */}
          <div className="glass rounded-xl p-2 sm:p-3 mt-1 relative z-10 border border-gold-800/20">
            {meFuiAlMazo && mesa.estado === "jugando" && (
              <div className="flex items-center justify-center gap-2 py-4 text-gold-500/60">
                <span className="text-lg">👀</span>
                <span className="text-sm font-medium">Te fuiste al mazo — mirando la ronda</span>
              </div>
            )}

            {/* Bocadillo de diálogo para mí */}
            {socketId && speechBubbles.find((b) => b.jugadorId === socketId) && (() => {
              const bubble = speechBubbles.find((b) => b.jugadorId === socketId)!;
              return (
                <div className={`absolute -top-14 left-1/2 z-50 speech-bubble speech-bubble-up ${
                  bubble.tipo === "envido" ? "speech-bubble-envido"
                    : bubble.tipo === "flor" ? "speech-bubble-flor"
                      : bubble.tipo === "truco" ? "speech-bubble-truco"
                        : bubble.tipo === "quiero" ? "speech-bubble-quiero"
                          : bubble.tipo === "no-quiero" ? "speech-bubble-no-quiero" : ""
                }`}>
                  {bubble.puntos !== undefined && bubble.puntos !== null && bubble.tipo !== "flor" ? (
                    <span className="bubble-number text-2xl font-bold">{bubble.puntos}</span>
                  ) : (
                    <span className="font-bold text-sm whitespace-nowrap">{bubble.texto}</span>
                  )}
                </div>
              );
            })()}

            {/* Barra superior con info y botones de cantos */}
            {!meFuiAlMazo && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                <div className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${miEquipo === 1 ? "equipo-1 text-white" : "equipo-2 text-white"}`}>
                  {miJugador?.avatarUrl ? (
                    <Image src={miJugador.avatarUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover border border-gold-600/50" unoptimized />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold text-[10px]">{miJugador?.nombre[0]?.toUpperCase()}</span>
                  )}
                  {miJugador?.nombre}
                  {miJugador?.esMano && <MonedaMano isActive={true} />}
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  {tengoFlor() && !mesa.florYaCantada && (
                    <div className="btn-flor text-white text-xs sm:text-sm animate-pulse cursor-default" title="¡Tenés FLOR! Se cantará automáticamente si alguien dice envido">🌸 FLOR</div>
                  )}
                  {puedoCantarEnvido() && !mesa.envidoActivo && !mesa.florYaCantada && (
                    <>
                      <button onClick={() => handleCantarEnvido("envido")} disabled={loading || !esMiTurno()} className={`btn-envido text-white text-xs sm:text-sm ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Envido"}>Envido</button>
                      <button onClick={() => handleCantarEnvido("real_envido")} disabled={loading || !esMiTurno()} className={`btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Real Envido"}>Real Envido</button>
                      <button onClick={() => handleCantarEnvido("falta_envido")} disabled={loading || !esMiTurno()} className={`btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Falta Envido"}>Falta Envido</button>
                      <button onClick={() => setMostrarEnvidoCargado(true)} disabled={loading || !esMiTurno()} className={`btn-envido text-white text-xs sm:text-sm bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Envido Cargado - Elegí cuántos puntos apostar"}>
                        <span className="hidden sm:inline">Envido Cargado</span><span className="sm:hidden">E. Cargado</span>
                      </button>
                    </>
                  )}
                  {puedoCantarTruco() && <button onClick={() => handleCantarTruco("truco")} disabled={loading || !esMiTurno()} className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Truco"}>Truco</button>}
                  {puedoCantarRetruco() && <button onClick={() => handleCantarTruco("retruco")} disabled={loading || !esMiTurno()} className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Retruco"}>Retruco</button>}
                  {puedoCantarVale4() && <button onClick={() => handleCantarTruco("vale4")} disabled={loading || !esMiTurno()} className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`} title={!esMiTurno() ? "Esperá tu turno" : "Cantar Vale 4"}>Vale 4</button>}
                  {mesa.estado === "jugando" && mesa.fase === "jugando" && !miJugador?.seVaAlMazo && (
                    <button onClick={handleIrseAlMazo} disabled={loading} className="btn-mazo text-white">Mazo</button>
                  )}
                </div>
              </div>
            )}

            {/* Mis cartas */}
            {!meFuiAlMazo && (
              <div className="flex justify-center items-center gap-2 sm:gap-3">
                {misCartas().map((carta, index) => (
                  <div key={`${carta.palo}-${carta.valor}-${index}`} className={`transition-all duration-300 ${yaJugueEnEstaMano ? "opacity-40 grayscale scale-95" : ""}`}>
                    <CartaImg
                      carta={carta}
                      size="large"
                      onClick={esMiTurno() && !yaJugueEnEstaMano ? () => handleJugarCarta(carta) : undefined}
                      disabled={!esMiTurno() || loading || yaJugueEnEstaMano}
                      showGlow={esMiTurno() && !yaJugueEnEstaMano}
                    />
                  </div>
                ))}
                {misCartas().length === 0 && mesa.estado === "jugando" && (
                  <div className="text-gold-500/40 text-sm py-8">Sin cartas</div>
                )}
                {yaJugueEnEstaMano && misCartas().length > 0 && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gold-500/60 whitespace-nowrap">Esperando a los demás...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner publicitario */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <AdBanner adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME} size="banner" className="opacity-80 hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <AlertModal {...alertState} onClose={closeAlert} />
    </div>
  );
}
