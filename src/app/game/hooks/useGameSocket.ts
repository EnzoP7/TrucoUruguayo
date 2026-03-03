"use client";

import { useEffect } from "react";
import socketService from "@/lib/socket";
import audioManager from "@/lib/audioManager";
import { Jugador } from "../types";
import { getNombreGrito, getNombreEnvido } from "../utils";
import { GameState } from "./useGameState";

export function useGameSocket(
  mesaId: string | null,
  state: GameState,
) {
  const {
    setMesa, setSocketId, setConectado, setMensaje,
    setEsperandoInicio, setJugadorDesconectado,
    setSpeechBubbles, setEnvidoDeclaraciones, setEnvidoResultado,
    setRondaBanner, setMonedasGanadas,
    setCutAnimating, setCutPosition, setIsDealing, setDealingCards,
    setFlorAnuncio, setFlorResultado, setFlorPendiente,
    setReyesAnimacion, setReyesAnimStep, setReyesAnimDone,
    setPerrosActivos, setEquipoPerros,
    setMensajesChat, setChatAbierto, setMensajesNoLeidos,
    setLogrosDesbloqueados, setReconectando,
    setAfkSecondsLeft, afkIntervalRef,
    prevTurno, setPrevTurno,
    mesa, socketId, esperandoInicio, conectado,
  } = state;

  // Main socket connection and listeners
  useEffect(() => {
    if (!mesaId) {
      window.location.href = "/lobby";
      return;
    }

    const nombre = sessionStorage.getItem("truco_nombre");
    if (!nombre) {
      window.location.href = "/lobby";
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
          console.log(
            "[Game] reconectado received, jugadores:",
            data.estado.jugadores?.length,
            data.estado.jugadores?.map((j: Jugador) => j.nombre),
          );
          setSocketId(socketService.getSocketId());
          setMesa(data.estado);
          if (data.estado.estado === "jugando") {
            setEsperandoInicio(false);
          }
        });

        socketService.onJugadorDesconectado((data) => {
          if (!mounted) return;
          audioManager.play("notification");
          setJugadorDesconectado({
            nombre: data.nombre,
            esAnfitrion: data.esAnfitrion,
          });
        });

        socketService.onUnidoPartida((data) => {
          if (!mounted) return;
          console.log(
            "[Game] unido-partida received, jugadores:",
            data.estado.jugadores?.length,
          );
          setSocketId(socketService.getSocketId());
          setMesa(data.estado);
        });

        socketService.onJugadorUnido((data) => {
          if (!mounted) return;
          console.log("[Game] jugador-unido received:", data.jugador?.nombre);
          setMensaje(`${data.jugador.nombre} se unió`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        socketService.onPartidaIniciada((estado) => {
          if (!mounted) return;
          console.log(
            "[Game] partida-iniciada received, cosmeticosJugadores:",
            estado.cosmeticosJugadores,
            "socketId:",
            socketService.getSocketId(),
          );
          setMesa(estado);
          setEsperandoInicio(false);
          setSocketId(socketService.getSocketId());
        });

        socketService.onEstadoActualizado((estado) => {
          if (!mounted) return;
          const jugadorTurno = estado.jugadores?.[estado.turnoActual];
          console.log(
            "[Game] estado-actualizado received, turnoActual:",
            estado.turnoActual,
            "jugador:",
            jugadorTurno?.nombre,
            "manoActual:",
            estado.manoActual,
          );
          setMesa(estado);
        });

        socketService.onCartaJugada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.play("card-play");
        });

        socketService.onTrucoCantado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.playWithCustom("truco", data.audioCustomUrl);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          setMensaje(`${jugador?.nombre}: ¡${getNombreGrito(data.tipo)}!`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 4000);
        });

        socketService.onTrucoRespondido((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          setMensaje(
            `${jugador?.nombre}: ${data.acepta ? "¡QUIERO!" : "¡NO QUIERO!"}`,
          );
          audioManager.playWithCustom(
            data.acepta ? "quiero" : "no-quiero",
            data.audioCustomUrl,
          );
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        // Respuesta parcial de truco (en equipos, cuando falta la respuesta de compañeros)
        socketService.onTrucoRespuestaParcial((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          const faltanNombres = data.faltanResponder
            .map(
              (id: string) =>
                data.estado.jugadores.find((j: Jugador) => j.id === id)
                  ?.nombre || id,
            )
            .join(", ");
          setMensaje(
            `${jugador?.nombre}: ${data.acepta ? "Quiero" : "No quiero"} - Esperando: ${faltanNombres}`,
          );
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        socketService.onEnvidoCantado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.playWithCustom("envido", data.audioCustomUrl);
          // Mostrar bocadillo de envido
          const bubbleId = `envido-${Date.now()}`;
          setSpeechBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              jugadorId: data.jugadorId,
              tipo: "envido",
              texto: getNombreEnvido(data.tipo),
            },
          ]);
          setTimeout(() => {
            if (mounted)
              setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 3500);
        });

        socketService.onEnvidoRespondido((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.playWithCustom(
            data.acepta ? "quiero" : "no-quiero",
            data.audioCustomUrl,
          );
          // Mostrar bocadillo de quiero/no quiero
          const bubbleId = `envido-resp-${Date.now()}`;
          setSpeechBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              jugadorId: data.jugadorId,
              tipo: data.acepta ? "quiero" : "no-quiero",
              texto: data.acepta ? "¡QUIERO!" : "¡NO QUIERO!",
            },
          ]);
          setTimeout(() => {
            if (mounted)
              setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 3000);

          if (data.acepta) {
            setEnvidoDeclaraciones([]);
            setEnvidoResultado(null);
          }
        });

        // Respuesta parcial de envido (en equipos, cuando falta la respuesta de compañeros)
        socketService.onEnvidoRespuestaParcial((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          const faltanNombres = data.faltanResponder
            .map(
              (id: string) =>
                data.estado.jugadores.find((j: Jugador) => j.id === id)
                  ?.nombre || id,
            )
            .join(", ");
          // Mostrar bocadillo de respuesta parcial
          const bubbleId = `envido-parcial-${Date.now()}`;
          setSpeechBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              jugadorId: data.jugadorId,
              tipo: data.acepta ? "quiero" : "no-quiero",
              texto: data.acepta ? "Quiero..." : "No quiero...",
            },
          ]);
          setTimeout(() => {
            if (mounted)
              setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 3000);
          setMensaje(`Esperando: ${faltanNombres}`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        // Envido declaration step-by-step
        socketService.onEnvidoDeclarado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setEnvidoDeclaraciones((prev) => [...prev, data.declaracion]);
          // Mostrar bocadillo con los puntos
          const bubbleId = `decl-${Date.now()}`;
          setSpeechBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              jugadorId: data.declaracion.jugadorId,
              tipo: "envido",
              texto: data.declaracion.sonBuenas
                ? "Son buenas..."
                : `${data.declaracion.puntos}`,
              puntos: data.declaracion.sonBuenas
                ? undefined
                : data.declaracion.puntos,
            },
          ]);
          setTimeout(() => {
            if (mounted)
              setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 3500);
        });

        socketService.onEnvidoResuelto((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setEnvidoDeclaraciones(data.resultado.declaraciones);
          setEnvidoResultado({
            ganador: data.resultado.ganador,
            puntosGanados: data.resultado.puntosGanados,
            mejorPuntaje: data.resultado.mejorPuntaje,
          });
          setMensaje(
            `¡Equipo ${data.resultado.ganador} gana el envido! (+${data.resultado.puntosGanados} pts)`,
          );
          // Clear envido state after showing result (2 seconds)
          setTimeout(() => {
            if (mounted) {
              setMensaje(null);
              setEnvidoDeclaraciones([]);
              setEnvidoResultado(null);
            }
          }, 2000);
        });

        socketService.onManoFinalizada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          // Show message about who won the mano
          if (data.ganadorEquipo !== null) {
            setMensaje(
              `Mano ${data.manoNumero}: Equipo ${data.ganadorEquipo} gana`,
            );
          } else {
            setMensaje(`Mano ${data.manoNumero}: Empate (parda)`);
          }
          // Don't clear message - let the next state update handle it
        });

        socketService.onRondaFinalizada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          // Sonido según si mi equipo ganó o perdió la ronda
          const miJug = data.estado.jugadores?.find(
            (j: Jugador) => j.id === socketService.getSocketId(),
          );
          if (miJug) {
            audioManager.play(
              data.ganadorEquipo === miJug.equipo ? "round-won" : "round-lost",
            );
          }
          // Show floating banner instead of blocking modal
          setRondaBanner({
            mensaje: `Equipo ${data.ganadorEquipo} gana la ronda`,
            puntos: data.puntosGanados,
            equipo: data.ganadorEquipo,
            cartasFlor: data.cartasFlorReveladas || [],
            cartasEnvido: data.cartasEnvidoReveladas || [],
            muestra: data.muestra || null,
          });
          const tieneCartas =
            (data.cartasFlorReveladas?.length ?? 0) > 0 ||
            (data.cartasEnvidoReveladas?.length ?? 0) > 0;
          const timeout = tieneCartas ? 4000 : 2000;
          setTimeout(() => {
            if (mounted) setRondaBanner(null);
          }, timeout);
        });

        socketService.onJuegoFinalizado((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.stopMusic();
          const miJug = data.estado.jugadores?.find(
            (j: Jugador) => j.id === socketService.getSocketId(),
          );
          audioManager.play(
            miJug && data.ganadorEquipo === miJug.equipo
              ? "game-won"
              : "game-lost",
          );
          setMensaje(`¡JUEGO TERMINADO! Equipo ${data.ganadorEquipo} gana`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 10000);
        });

        socketService.onMonedasGanadas((data) => {
          if (!mounted) return;
          setMonedasGanadas(data);
          setTimeout(() => {
            if (mounted) setMonedasGanadas(null);
          }, 8000);
        });

        socketService.onJugadorAlMazo((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.playWithCustom("mazo", data.audioCustomUrl);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          setMensaje(`${jugador?.nombre} se fue al mazo`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        socketService.onCorteSolicitado((data) => {
          if (!mounted) return;
          audioManager.play("shuffle");
          setMesa(data.estado);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          setMensaje(`${jugador?.nombre} debe cortar el mazo`);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        socketService.onCorteRealizado((data) => {
          if (!mounted) return;
          audioManager.play("cut");
          setMesa(data.estado);
          // Reset cut animation states
          setCutAnimating(false);
          setCutPosition(null);
          const jugador = data.estado.jugadores.find(
            (j: Jugador) => j.id === data.jugadorId,
          );
          setMensaje(`${jugador?.nombre} cortó en posición ${data.posicion}`);
          setIsDealing(true);
          setDealingCards([]);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 2000);
        });

        socketService.onCartaRepartida((data) => {
          if (!mounted) return;
          setDealingCards((prev) => [
            ...prev,
            { jugadorIndex: data.jugadorIndex, cartaIndex: data.cartaIndex },
          ]);
          // When dealing is complete
          if (data.actual === data.total) {
            setTimeout(() => {
              if (mounted) {
                setIsDealing(false);
                setDealingCards([]);
              }
            }, 500);
          }
        });

        // Flor listeners
        socketService.onFlorCantada((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          audioManager.playWithCustom("flor", data.audioCustomUrl);
          setFlorAnuncio({
            jugadorNombre: data.declaracion.jugadorNombre,
          });
          // Mostrar bocadillo de flor
          const bubbleId = `flor-${Date.now()}`;
          setSpeechBubbles((prev) => [
            ...prev,
            {
              id: bubbleId,
              jugadorId: data.jugadorId,
              tipo: "flor",
              texto: "🌸 ¡FLOR!",
              puntos: data.declaracion.puntos,
            },
          ]);
          setTimeout(() => {
            if (mounted) {
              setFlorAnuncio(null);
              setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
            }
          }, 3500);
        });

        socketService.onFlorResuelta((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          if (data.audioCustomUrl)
            audioManager.playWithCustom("quiero", data.audioCustomUrl);
          setFlorPendiente(null); // Limpiar flor pendiente cuando se resuelve
          setFlorResultado({
            ganador: data.resultado.ganador,
            puntosGanados: data.resultado.puntosGanados,
          });
          const esContraFlor = data.resultado.esContraFlor;
          const esConFlorEnvido = data.resultado.esConFlorEnvido;
          const tipoMensaje = esContraFlor
            ? "CONTRA FLOR AL RESTO"
            : esConFlorEnvido
              ? "CON FLOR ENVIDO"
              : "la FLOR";
          setMensaje(`¡Equipo ${data.resultado.ganador} gana ${tipoMensaje}!`);
          setTimeout(() => {
            if (mounted) {
              setFlorResultado(null);
              setFlorAnuncio(null);
              setMensaje(null);
            }
          }, 2000);
        });

        // Flor pendiente - ambos equipos tienen flor, esperando respuesta
        socketService.onFlorPendiente((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setFlorPendiente({
            equipoQueCanta: data.equipoQueCanta,
            equipoQueResponde: data.equipoQueResponde,
            ultimoTipo: (data as Record<string, unknown>).ultimoTipo as
              | string
              | undefined,
            jugadorNombre: (data as Record<string, unknown>).jugadorNombre as
              | string
              | undefined,
          });
        });

        // Tirar Reyes listener
        socketService.onTirarReyesResultado((data) => {
          if (!mounted) return;
          const anim = data.animacion;
          setReyesAnimacion(anim);
          setReyesAnimStep(0);
          setReyesAnimDone(false);
          anim.forEach((_: unknown, i: number) => {
            setTimeout(() => { if (mounted) setReyesAnimStep(i + 1); }, (i + 1) * 700);
          });
          const revealTime = (anim.length + 1) * 700 + 800;
          setTimeout(() => {
            if (!mounted) return;
            setReyesAnimDone(true);
            setMesa(data.estado);
            if (data.estado.estado === "esperando") setEsperandoInicio(true);
          }, revealTime);
          setTimeout(() => {
            if (!mounted) return;
            setReyesAnimacion(null);
            setReyesAnimStep(0);
            setReyesAnimDone(false);
          }, revealTime + 4000);
        });

        // Echar los Perros listeners
        socketService.onPerrosEchados((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setPerrosActivos(true);
          setEquipoPerros(data.equipoQueEcha);
          setMensaje(`¡Equipo ${data.equipoQueEcha} echa los perros!`);
          audioManager.playWithCustom("perros", data.audioCustomUrl);
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 3000);
        });

        socketService.onPerrosCancelados((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setPerrosActivos(false);
          setEquipoPerros(null);
          setMensaje("Perros cancelados");
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 2000);
        });

        socketService.onPerrosRespondidos((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setPerrosActivos(false);
          setEquipoPerros(null);
          if (data.equipoGanador) {
            const eq1 = data.estado.equipos[0]?.puntaje ?? 0;
            const eq2 = data.estado.equipos[1]?.puntaje ?? 0;
            setMensaje(
              `🐕 ¡Al mazo! Equipo ${data.equipoGanador} gana ${data.puntosGanados} pts\n📊 Marcador: Equipo 1: ${eq1} - Equipo 2: ${eq2}`,
            );
          } else {
            const eq1 = data.estado.equipos[0]?.puntaje ?? 0;
            const eq2 = data.estado.equipos[1]?.puntaje ?? 0;
            setMensaje(
              `🐕 ${data.respuesta}\n📊 Marcador: Equipo 1: ${eq1} - Equipo 2: ${eq2}`,
            );
          }
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 5000);
        });

        // Perros pendientes - después de repartir, el receptor debe responder
        socketService.onPerrosPendientes((data) => {
          if (!mounted) return;
          setMesa(data.estado);
          setPerrosActivos(true);
          setEquipoPerros(data.equipoQueEcha);
          if (data.debeResponder) {
            setMensaje("🐕 Te echaron los perros - mirá tus cartas y decidí");
          } else {
            setMensaje("🐕 Perros echados - esperando respuesta del rival");
          }
          setTimeout(() => {
            if (mounted) setMensaje(null);
          }, 5000);
        });

        // Chat en partida
        socketService.onMensajeRecibido((data) => {
          if (!mounted) return;
          setMensajesChat((prev) => [...prev.slice(-99), data]); // Mantener últimos 100 mensajes
          // Si el chat está cerrado, incrementar contador de no leídos
          setChatAbierto((abierto) => {
            if (!abierto) {
              setMensajesNoLeidos((prev) => prev + 1);
            }
            return abierto;
          });
        });

        // Logros desbloqueados (in-game notifications)
        socketService.onLogrosDesbloqueados((data) => {
          if (!mounted) return;
          audioManager.play("notification");
          setLogrosDesbloqueados(data.logros || []);
        });

        // Reconnection indicator
        socketService.onSocketDisconnect(() => {
          if (!mounted) return;
          setReconectando(true);
        });
        socketService.onSocketReconnect(() => {
          if (!mounted) return;
          setReconectando(false);
        });

        // Obtener userId si está logueado
        let userId: number | undefined;
        try {
          const savedUsuario = sessionStorage.getItem("truco_usuario");
          if (savedUsuario) userId = JSON.parse(savedUsuario).id;
        } catch {
          /* ignorar */
        }

        // Register auto-reconnect: if socket drops and reconnects, re-join the game room
        socketService.onAutoReconnect(() => {
          if (!mounted) return;
          console.log("[Game] Auto-reconnected, re-joining game room");
          setSocketId(socketService.getSocketId());
          socketService.reconectarPartida(mesaId, nombre, userId);
        });

        // NOW call reconectar after listeners are ready
        const success = await socketService.reconectarPartida(
          mesaId,
          nombre,
          userId,
        );
        if (!success && mounted) {
          console.error("Failed to reconnect to game");
        }
      } catch (error) {
        console.error("Failed to connect:", error);
        if (mounted) setConectado(false);
      }
    };

    connectToGame();

    return () => {
      mounted = false;
      audioManager.stopMusic();
      socketService.clearAutoReconnect();
      socketService.removeAllListeners();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId]);

  // Poll for state while in waiting room to catch missed events
  useEffect(() => {
    if (!esperandoInicio || !conectado) return;
    const interval = setInterval(() => {
      socketService.solicitarEstado();
    }, 3000);
    return () => clearInterval(interval);
  }, [esperandoInicio, conectado]);

  // Sonido de "tu turno" cuando cambia el turno a mí
  useEffect(() => {
    if (!mesa || !socketId || mesa.estado !== "jugando") return;
    const turnoActualId = mesa.jugadores[mesa.turnoActual]?.id;
    if (turnoActualId === socketId && prevTurno !== socketId) {
      audioManager.play("your-turn");
    }
    setPrevTurno(turnoActualId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.turnoActual, socketId]);

  // AFK Timer: 60s countdown that resets on turn changes
  useEffect(() => {
    // Only run during active play phase
    if (!mesa || mesa.estado !== "jugando" || mesa.fase !== "jugando") {
      if (afkIntervalRef.current) {
        clearInterval(afkIntervalRef.current);
        afkIntervalRef.current = null;
      }
      setAfkSecondsLeft(60);
      return;
    }

    // Don't count when waiting for grito/envido/flor responses
    if (mesa.gritoActivo || mesa.envidoActivo || mesa.florPendiente) {
      return;
    }

    // Reset to 60 on turn change
    setAfkSecondsLeft(60);

    if (afkIntervalRef.current) {
      clearInterval(afkIntervalRef.current);
    }

    afkIntervalRef.current = setInterval(() => {
      setAfkSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (afkIntervalRef.current) {
        clearInterval(afkIntervalRef.current);
        afkIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.turnoActual, mesa?.estado, mesa?.fase, mesa?.manoActual, mesa?.gritoActivo, mesa?.envidoActivo, mesa?.florPendiente]);

  // Cargar pack de sonido equipado y iniciar música cuando empieza el juego
  useEffect(() => {
    if (mesa?.estado === "jugando" && !esperandoInicio) {
      if (mesa?.cosmeticosJugadores && socketId) {
        const misCosmetics = mesa.cosmeticosJugadores[socketId];
        if (misCosmetics?.pack_sonido) {
          audioManager.setMusicPack(misCosmetics.pack_sonido);
        }
      }
      audioManager.startMusic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.estado, esperandoInicio]);

  // Inicializar AudioContext desde un gesto del usuario (requerido en mobile)
  useEffect(() => {
    const unlock = () => {
      audioManager.initFromUserGesture();
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);
}
