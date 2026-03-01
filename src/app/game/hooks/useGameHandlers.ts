"use client";

import socketService from "@/lib/socket";
import { Carta } from "../types";

export function useGameHandlers(
  deps: {
    esMiTurno: () => boolean;
    setLoading: (v: boolean) => void;
    showAlert: (type: "success" | "error" | "warning" | "info" | "confirm", title: string, message: string) => void;
    showConfirm: (title: string, message: string) => Promise<boolean>;
    mostrarMensaje: (msg: string, duracion?: number) => void;
    setFlorPendiente: (v: null) => void;
    setEnvidoDeclaraciones: (v: never[]) => void;
    setEnvidoResultado: (v: null) => void;
    setMostrarEnvidoCargado: (v: boolean) => void;
    setAgregandoBot: (v: boolean) => void;
    setInvitandoAmigo: (v: number | null) => void;
    setCargandoAmigos: (v: boolean) => void;
    setAmigosConectados: (v: { id: number; apodo: string; online: boolean }[]) => void;
    puntosEnvidoCargado: number;
    inputChat: string;
    chatTab: "general" | "equipo";
    setInputChat: (v: string) => void;
    enviadoChat: boolean;
    setEnviadoChat: (v: boolean) => void;
    mesaId: string | null;
    socketId: string | null;
    mesa: { esperandoCorte: boolean } | null;
  },
) {
  const {
    esMiTurno, setLoading, showAlert, showConfirm, mostrarMensaje,
    setFlorPendiente, setEnvidoDeclaraciones, setEnvidoResultado,
    setMostrarEnvidoCargado, setAgregandoBot, setInvitandoAmigo,
    setCargandoAmigos, setAmigosConectados,
    puntosEnvidoCargado, inputChat, chatTab, setInputChat,
    enviadoChat, setEnviadoChat, mesaId, socketId, mesa,
  } = deps;

  const handleIniciarPartida = async () => {
    setLoading(true);
    try {
      const success = await socketService.iniciarPartida();
      if (!success) showAlert("error", "Error", "Error al iniciar la partida");
    } finally {
      setLoading(false);
    }
  };

  const handleJugarCarta = async (carta: Carta) => {
    if (!esMiTurno()) return;
    setLoading(true);
    try {
      const success = await socketService.jugarCarta(carta);
      if (!success) showAlert("error", "Error", "No se pudo jugar la carta");
    } finally {
      setLoading(false);
    }
  };

  const handleCantarTruco = async (tipo: "truco" | "retruco" | "vale4") => {
    setLoading(true);
    try {
      await socketService.cantarTruco(tipo);
    } finally {
      setLoading(false);
    }
  };

  const handleResponderTruco = async (acepta: boolean, escalar?: string) => {
    setLoading(true);
    try {
      await socketService.responderTruco(acepta, escalar);
    } finally {
      setLoading(false);
    }
  };

  const handleCantarEnvido = async (
    tipo: "envido" | "real_envido" | "falta_envido",
  ) => {
    setLoading(true);
    try {
      await socketService.cantarEnvido(tipo);
    } finally {
      setLoading(false);
    }
  };

  const handleCantarEnvidoCargado = async () => {
    setLoading(true);
    try {
      await socketService.cantarEnvidoCargado(puntosEnvidoCargado);
      setMostrarEnvidoCargado(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResponderEnvido = async (acepta: boolean) => {
    setLoading(true);
    try {
      if (acepta) {
        setEnvidoDeclaraciones([]);
        setEnvidoResultado(null);
      }
      await socketService.responderEnvido(acepta);
    } finally {
      setLoading(false);
    }
  };

  const handleResponderFlor = async (
    tipoRespuesta: "quiero" | "no_quiero" | "contra_flor" | "con_flor_envido",
  ) => {
    setLoading(true);
    try {
      await socketService.responderFlor(tipoRespuesta);
      setFlorPendiente(null);
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

  const handleRealizarCorte = async (posicion: number) => {
    if (!mesa?.esperandoCorte || !socketId) return;
    setLoading(true);
    try {
      await socketService.realizarCorte(posicion);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEquipo = async (
    jugadorId: string,
    nuevoEquipo: number,
  ) => {
    setLoading(true);
    try {
      await socketService.cambiarEquipo(jugadorId, nuevoEquipo);
    } finally {
      setLoading(false);
    }
  };

  const handleTirarReyes = async () => {
    setLoading(true);
    try {
      await socketService.tirarReyes();
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurarPuntos = async (puntosLimite: number) => {
    setLoading(true);
    try {
      await socketService.configurarPuntos(puntosLimite);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarMensaje = async () => {
    if (!inputChat.trim() || enviadoChat) return;
    setEnviadoChat(true);
    const success = await socketService.enviarMensaje(
      inputChat.trim(),
      chatTab,
    );
    if (success) {
      setInputChat("");
    }
    setEnviadoChat(false);
  };

  const handleAgregarBot = async (
    dificultad: "facil" | "medio" | "dificil",
    equipo?: 1 | 2,
  ) => {
    setAgregandoBot(true);
    try {
      const result = await socketService.agregarBot(dificultad, equipo);
      if (result.success) {
        const equipoMsg = result.equipo ? ` - Equipo ${result.equipo}` : "";
        mostrarMensaje(
          `Bot ${result.botNombre} agregado (${dificultad})${equipoMsg}`,
        );
      } else {
        mostrarMensaje(result.error || "Error al agregar bot");
      }
    } finally {
      setAgregandoBot(false);
    }
  };

  const handleQuitarBot = async (botId: string) => {
    const result = await socketService.quitarBot(botId);
    if (!result.success) {
      mostrarMensaje(result.error || "Error al quitar bot");
    }
  };

  const handleLlenarConBots = async (
    dificultad: "facil" | "medio" | "dificil" = "medio",
  ) => {
    setAgregandoBot(true);
    try {
      const result = await socketService.llenarConBots(dificultad);
      if (result.success && result.botsAgregados) {
        mostrarMensaje(`${result.botsAgregados.length} bot(s) agregados`);
      } else {
        mostrarMensaje(result.error || "Error al llenar con bots");
      }
    } finally {
      setAgregandoBot(false);
    }
  };

  // === INVITACIONES A AMIGOS ===
  const cargarAmigosConectados = async () => {
    setCargandoAmigos(true);
    try {
      const result = await socketService.obtenerAmigos();
      if (result.success && result.amigos) {
        // Filtrar solo los amigos conectados (online)
        const conectados = result.amigos.filter(
          (a: { online: boolean }) => a.online,
        );
        setAmigosConectados(conectados);
      }
    } finally {
      setCargandoAmigos(false);
    }
  };

  const handleInvitarAmigo = async (amigoId: number) => {
    if (!mesaId) return;
    setInvitandoAmigo(amigoId);
    try {
      const result = await socketService.invitarAmigo(amigoId, mesaId);
      if (result.success) {
        mostrarMensaje("Invitación enviada");
      } else {
        mostrarMensaje(result.error || "Error al invitar");
      }
    } finally {
      setInvitandoAmigo(null);
    }
  };

  const handleRevancha = async () => {
    setLoading(true);
    try {
      const success = await socketService.revancha();
      if (!success) mostrarMensaje("Error al iniciar revancha");
    } finally {
      setLoading(false);
    }
  };

  const handleTerminarPartida = async () => {
    const confirmed = await showConfirm("Abandonar partida", "¿Abandonar la partida? Tu equipo pierde.");
    if (!confirmed) return;
    setLoading(true);
    try {
      const success = await socketService.terminarPartida();
      if (!success) mostrarMensaje("Error al terminar la partida");
    } finally {
      setLoading(false);
    }
  };

  // === ECHAR LOS PERROS ===
  const handleEcharPerros = async () => {
    setLoading(true);
    try {
      await socketService.echarPerros();
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarPerros = async () => {
    setLoading(true);
    try {
      await socketService.cancelarPerros();
    } finally {
      setLoading(false);
    }
  };

  const handleResponderPerros = async (
    quiereContraFlor: boolean,
    quiereFaltaEnvido: boolean,
    quiereTruco: boolean,
  ) => {
    setLoading(true);
    try {
      await socketService.responderPerros(
        quiereContraFlor,
        quiereFaltaEnvido,
        quiereTruco,
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    handleIniciarPartida,
    handleJugarCarta,
    handleCantarTruco,
    handleResponderTruco,
    handleCantarEnvido,
    handleCantarEnvidoCargado,
    handleResponderEnvido,
    handleResponderFlor,
    handleIrseAlMazo,
    handleRealizarCorte,
    handleCambiarEquipo,
    handleTirarReyes,
    handleConfigurarPuntos,
    handleEnviarMensaje,
    handleAgregarBot,
    handleQuitarBot,
    handleLlenarConBots,
    cargarAmigosConectados,
    handleInvitarAmigo,
    handleRevancha,
    handleTerminarPartida,
    handleEcharPerros,
    handleCancelarPerros,
    handleResponderPerros,
  };
}
