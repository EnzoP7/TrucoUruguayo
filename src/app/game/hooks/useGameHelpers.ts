"use client";

import { useMemo, useCallback } from "react";
import { Carta, Jugador, Mesa } from "../types";
import { tieneFlor_client } from "../utils";

export function useGameHelpers(
  mesa: Mesa | null,
  socketId: string | null,
  florPendiente: { equipoQueCanta: number; equipoQueResponde: number; ultimoTipo?: string; jugadorNombre?: string } | null,
  isDealing: boolean,
  dealingCards: { jugadorIndex: number; cartaIndex: number }[],
) {
  const miJugador = useMemo(() => mesa?.jugadores.find((j) => j.id === socketId), [mesa?.jugadores, socketId]);
  const miEquipo = miJugador?.equipo;
  const meFuiAlMazo = miJugador?.seVaAlMazo === true;

  const esMiTurno = useCallback((): boolean => {
    if (!mesa || !socketId) return false;
    if (florPendiente) return false;
    if (mesa.esperandoRespuestaFlor) return false;
    if (mesa.fase === "cortando") return false;
    if (mesa.fase === "repartiendo") return false;
    return mesa.jugadores[mesa.turnoActual]?.id === socketId;
  }, [mesa, socketId, florPendiente]);

  const misCartasMemo = useMemo((): Carta[] => {
    if (!mesa || !socketId) return [];
    const jugador = mesa.jugadores.find((j) => j.id === socketId);
    const cartas = jugador?.cartas.filter((c) => c.valor !== 0) || [];

    if (isDealing) {
      const miIndex = mesa.jugadores.findIndex((j) => j.id === socketId);
      const cartasQueMeLlegaron = dealingCards.filter(
        (d) => d.jugadorIndex === miIndex,
      ).length;
      const cartasVisibles = cartas.slice(0, cartasQueMeLlegaron);
      if (cartasVisibles.length < cartas.length) {
        return cartasVisibles;
      }
    }

    return cartas;
  }, [mesa, socketId, isDealing, dealingCards]);

  const misCartas = useCallback(() => misCartasMemo, [misCartasMemo]);

  const esAnfitrion = useCallback((): boolean => {
    if (!mesa || !socketId) return false;
    return mesa.jugadores[0]?.id === socketId;
  }, [mesa, socketId]);

  const puedoCantarTruco = (): boolean => {
    if (!mesa || !socketId || !miEquipo) return false;
    if (mesa.fase !== "jugando") return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo) return false;
    if (mesa.nivelGritoAceptado === null) return true;
    if (mesa.nivelGritoAceptado === "truco") return false;
    return false;
  };

  const puedoCantarRetruco = (): boolean => {
    if (!mesa || !socketId || !miEquipo) return false;
    if (mesa.fase !== "jugando") return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo) return false;
    if (mesa.equipoQueCantoUltimo === miEquipo) return false;
    if (mesa.nivelGritoAceptado === "truco") return true;
    return false;
  };

  const puedoCantarVale4 = (): boolean => {
    if (!mesa || !socketId || !miEquipo) return false;
    if (mesa.fase !== "jugando") return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo) return false;
    if (mesa.equipoQueCantoUltimo === miEquipo) return false;
    if (mesa.nivelGritoAceptado === "retruco") return true;
    return false;
  };

  const puedoCantarEnvido = (): boolean => {
    if (!mesa || !socketId || !miEquipo) return false;
    if (mesa.fase !== "jugando") return false;
    if (mesa.envidoYaCantado) return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo) return false;
    if (mesa.manoActual !== 1) return false;
    const numParticipantesEnvido = mesa.jugadores.filter(
      (j: Jugador) => j.participaRonda !== false && !j.seVaAlMazo,
    ).length;
    const cartasManoActual = mesa.cartasMesa.slice(0, numParticipantesEnvido);
    const yaJugueMiCarta = cartasManoActual.some(
      (c) => c.jugadorId === socketId,
    );
    if (yaJugueMiCarta) return false;
    if (mesa.primeraCartaJugada) return false;
    return true;
  };

  const deboResponderGrito = (): boolean => {
    if (!mesa || !socketId || !mesa.gritoActivo) return false;
    const miJugador = mesa.jugadores.find((j: Jugador) => j.id === socketId);
    if (miJugador?.participaRonda === false) return false;
    if (miJugador?.seVaAlMazo) return false;
    return mesa.gritoActivo.equipoQueGrita !== miEquipo;
  };

  const deboResponderEnvido = (): boolean => {
    if (!mesa || !socketId || !mesa.envidoActivo) return false;
    if (mesa.esperandoRespuestasGrupales) return false;
    const miJugador = mesa.jugadores.find((j: Jugador) => j.id === socketId);
    if (miJugador?.participaRonda === false) return false;
    if (miJugador?.seVaAlMazo) return false;
    return mesa.envidoActivo.equipoQueCanta !== miEquipo;
  };

  const esMiTurnoDeCortar = (): boolean => {
    if (!mesa || !socketId) return false;
    if (!mesa.esperandoCorte) return false;
    return mesa.jugadores[mesa.indiceJugadorCorta]?.id === socketId;
  };

  const tengoFlor = (): boolean => {
    if (!misCartasMemo || misCartasMemo.length !== 3) return false;
    return tieneFlor_client(misCartasMemo, mesa?.muestra || null);
  };

  const puedeEcharPerros = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (mesa.fase !== "cortando") return false;
    const mitadPuntos = mesa.puntosLimite / 2;
    const equipoRival = miEquipo === 1 ? 2 : 1;
    const puntajeRival =
      mesa.equipos.find((e) => e.id === equipoRival)?.puntaje || 0;
    const puntajeMio =
      mesa.equipos.find((e) => e.id === miEquipo)?.puntaje || 0;
    return puntajeRival >= mitadPuntos && puntajeMio < mitadPuntos;
  };

  return {
    miJugador,
    miEquipo,
    meFuiAlMazo,
    esMiTurno,
    misCartas,
    misCartasMemo,
    esAnfitrion,
    puedoCantarTruco,
    puedoCantarRetruco,
    puedoCantarVale4,
    puedoCantarEnvido,
    deboResponderGrito,
    deboResponderEnvido,
    esMiTurnoDeCortar,
    tengoFlor,
    puedeEcharPerros,
  };
}
