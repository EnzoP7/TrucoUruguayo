"use client";

import { useState, useRef, useCallback } from "react";
import { Mesa, Carta, EnvidoDeclaracion } from "../types";

export function useGameState() {
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [monedasGanadas, setMonedasGanadas] = useState<{ cantidad: number; balance: number; motivo: string } | null>(null);
  const [mostrarRewardedPostGame, setMostrarRewardedPostGame] = useState(false);
  const [yaDuplico, setYaDuplico] = useState(false);
  const [esperandoInicio, setEsperandoInicio] = useState(true);
  const [cutAnimating, setCutAnimating] = useState(false);
  const [cutPosition, setCutPosition] = useState<number | null>(null);
  const [envidoDeclaraciones, setEnvidoDeclaraciones] = useState<EnvidoDeclaracion[]>([]);
  const [envidoResultado, setEnvidoResultado] = useState<{
    ganador: number;
    puntosGanados: number;
    mejorPuntaje: number | null;
  } | null>(null);
  const [dealingCards, setDealingCards] = useState<
    { jugadorIndex: number; cartaIndex: number }[]
  >([]);
  const [isDealing, setIsDealing] = useState(false);
  const [florAnuncio, setFlorAnuncio] = useState<{
    jugadorNombre: string;
  } | null>(null);
  const [florResultado, setFlorResultado] = useState<{
    ganador: number;
    puntosGanados: number;
  } | null>(null);
  const [reyesAnimacion, setReyesAnimacion] = useState<
    | {
        jugadorId: string;
        jugadorNombre: string;
        carta: { palo: string; valor: number };
        esRey: boolean;
        equipo: number;
      }[]
    | null
  >(null);
  const [reyesAnimStep, setReyesAnimStep] = useState(0);
  const [reyesAnimDone, setReyesAnimDone] = useState(false);
  const [rondaBanner, setRondaBanner] = useState<{
    mensaje: string;
    puntos: number;
    equipo: number;
    cartasFlor?: { jugadorNombre: string; cartas: Carta[] }[];
    cartasEnvido?: { jugadorNombre: string; puntos: number; cartas: Carta[] }[];
    muestra?: Carta | null;
  } | null>(null);
  // Envido Cargado
  const [mostrarEnvidoCargado, setMostrarEnvidoCargado] = useState(false);
  const [puntosEnvidoCargado, setPuntosEnvidoCargado] = useState(5);
  // Echar los Perros
  const [perrosActivos, setPerrosActivos] = useState(false);
  const [equipoPerros, setEquipoPerros] = useState<number | null>(null);
  // Contra Flor al Resto
  const [florPendiente, setFlorPendiente] = useState<{
    equipoQueCanta: number;
    equipoQueResponde: number;
    ultimoTipo?: string;
    jugadorNombre?: string;
  } | null>(null);
  // Notificación de jugador desconectado
  const [jugadorDesconectado, setJugadorDesconectado] = useState<{
    nombre: string;
    esAnfitrion: boolean;
  } | null>(null);
  // Bocadillos de diálogo (speech bubbles)
  const [speechBubbles, setSpeechBubbles] = useState<
    {
      id: string;
      jugadorId: string;
      tipo: "envido" | "flor" | "truco" | "quiero" | "no-quiero";
      texto: string;
      puntos?: number;
    }[]
  >([]);
  // Chat en partida
  const [chatAbierto, setChatAbierto] = useState(false);
  const [chatTab, setChatTab] = useState<"general" | "equipo">("general");
  const [mensajesChat, setMensajesChat] = useState<
    {
      jugadorId: string;
      jugadorNombre: string;
      equipo: number;
      mensaje: string;
      tipo: "general" | "equipo";
      timestamp: number;
    }[]
  >([]);
  const [inputChat, setInputChat] = useState("");
  const [enviadoChat, setEnviadoChat] = useState(false);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  // Bots
  const [agregandoBot, setAgregandoBot] = useState(false);
  // Amigos (para invitaciones)
  const [amigosConectados, setAmigosConectados] = useState<
    { id: number; apodo: string; online: boolean }[]
  >([]);
  const [cargandoAmigos, setCargandoAmigos] = useState(false);
  const [invitandoAmigo, setInvitandoAmigo] = useState<number | null>(null);
  const [mostrarAmigos, setMostrarAmigos] = useState(false);

  // Audio state
  const [prevTurno, setPrevTurno] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const mensajeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarMensaje = useCallback((msg: string, duracion = 3000) => {
    setMensaje(msg);
    if (mensajeTimerRef.current) clearTimeout(mensajeTimerRef.current);
    mensajeTimerRef.current = setTimeout(() => setMensaje(null), duracion);
  }, []);

  return {
    mesa, setMesa,
    socketId, setSocketId,
    conectado, setConectado,
    loading, setLoading,
    mensaje, setMensaje,
    monedasGanadas, setMonedasGanadas,
    mostrarRewardedPostGame, setMostrarRewardedPostGame,
    yaDuplico, setYaDuplico,
    esperandoInicio, setEsperandoInicio,
    cutAnimating, setCutAnimating,
    cutPosition, setCutPosition,
    envidoDeclaraciones, setEnvidoDeclaraciones,
    envidoResultado, setEnvidoResultado,
    dealingCards, setDealingCards,
    isDealing, setIsDealing,
    florAnuncio, setFlorAnuncio,
    florResultado, setFlorResultado,
    reyesAnimacion, setReyesAnimacion,
    reyesAnimStep, setReyesAnimStep,
    reyesAnimDone, setReyesAnimDone,
    rondaBanner, setRondaBanner,
    mostrarEnvidoCargado, setMostrarEnvidoCargado,
    puntosEnvidoCargado, setPuntosEnvidoCargado,
    perrosActivos, setPerrosActivos,
    equipoPerros, setEquipoPerros,
    florPendiente, setFlorPendiente,
    jugadorDesconectado, setJugadorDesconectado,
    speechBubbles, setSpeechBubbles,
    chatAbierto, setChatAbierto,
    chatTab, setChatTab,
    mensajesChat, setMensajesChat,
    inputChat, setInputChat,
    enviadoChat, setEnviadoChat,
    mensajesNoLeidos, setMensajesNoLeidos,
    agregandoBot, setAgregandoBot,
    amigosConectados, setAmigosConectados,
    cargandoAmigos, setCargandoAmigos,
    invitandoAmigo, setInvitandoAmigo,
    mostrarAmigos, setMostrarAmigos,
    prevTurno, setPrevTurno,
    muted, setMuted,
    volume, setVolume,
    showVolumeSlider, setShowVolumeSlider,
    mensajeTimerRef,
    mostrarMensaje,
  };
}

export type GameState = ReturnType<typeof useGameState>;
