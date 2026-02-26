import { Jugador, Carta, Mesa, GritoTipo, EnvidoTipo, EnvidoResultado } from '@/types/truco';

// Eventos del cliente al servidor
export interface ClientToServerEvents {
  // Lobby
  'join-lobby': (callback: (success: boolean, message?: string) => void) => void;

  // Partidas
  'crear-partida': (data: { nombre: string; tamañoSala?: '1v1' | '2v2' | '3v3'; modoAlternado?: boolean; modoAyuda?: boolean; esPractica?: boolean; esRankeada?: boolean }, callback: (success: boolean, mesaId?: string) => void) => void;
  'unirse-partida': (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => void;
  'iniciar-partida': (callback: (success: boolean, message?: string) => void) => void;
  'reconectar-partida': (data: { mesaId: string; nombre: string; userId?: number }, callback: (success: boolean, message?: string) => void) => void;
  'eliminar-partida': (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => void;

  // Juego
  'jugar-carta': (data: { carta: Carta }, callback: (success: boolean, message?: string) => void) => void;
  'cantar-truco': (data: { tipo: GritoTipo }, callback: (success: boolean, message?: string) => void) => void;
  'responder-truco': (data: { acepta: boolean; escalar?: string | null }, callback: (success: boolean, message?: string) => void) => void;
  'cantar-envido': (data: { tipo: EnvidoTipo; puntosCustom?: number }, callback: (success: boolean, message?: string) => void) => void;
  'responder-envido': (data: { acepta: boolean }, callback: (success: boolean, message?: string) => void) => void;
  'irse-al-mazo': (callback: (success: boolean, message?: string) => void) => void;
  'realizar-corte': (data: { posicion: number }, callback: (success: boolean, message?: string) => void) => void;
  'declarar-envido': (data: { puntos: number; sonBuenas: boolean }, callback: (success: boolean, message?: string) => void) => void;
  'cantar-flor': (callback: (success: boolean, message?: string) => void) => void;
  'responder-flor': (data: { tipoRespuesta: 'quiero' | 'no_quiero' | 'contra_flor' | 'con_flor_envido' }, callback: (success: boolean, message?: string) => void) => void;
  'cambiar-equipo': (data: { jugadorId: string; nuevoEquipo: number }, callback: (success: boolean, message?: string) => void) => void;
  'tirar-reyes': (callback: (success: boolean, message?: string) => void) => void;
  'configurar-puntos': (data: { puntosLimite: number }, callback: (success: boolean, message?: string) => void) => void;
  'revancha': (callback: (success: boolean, message?: string) => void) => void;
  // Echar los perros
  'echar-perros': (data: Record<string, never>, callback: (success: boolean, message?: string) => void) => void;
  'cancelar-perros': (callback: (success: boolean, message?: string) => void) => void;
  'responder-perros': (data: { quiereContraFlor: boolean; quiereFaltaEnvido: boolean; quiereTruco: boolean }, callback: (success: boolean, message?: string) => void) => void;
  'solicitar-estado': (callback: (success: boolean) => void) => void;
  'toggle-ayuda': (data: { modoAyuda: boolean }, callback: (success: boolean) => void) => void;
  'terminar-partida': (callback: (success: boolean, message?: string) => void) => void;
  // Rewarded Ads
  'reclamar-recompensa-video': (callback: (result: { success: boolean; balance?: number; videosRestantes?: number; error?: string }) => void) => void;
  'obtener-estado-videos': (callback: (result: { success: boolean; videosVistos?: number; videosRestantes?: number; cooldownRestante?: number }) => void) => void;
  'invitar-amigo': (data: { amigoId: number; mesaId: string }, callback: (result: { success: boolean; error?: string }) => void) => void;
  // Chat
  'enviar-mensaje': (data: { mensaje: string; tipo: 'general' | 'equipo' }, callback: (success: boolean) => void) => void;
}

// Eventos del servidor al cliente
export interface ServerToClientEvents {
  // Lobby
  'partidas-disponibles': (partidas: Array<{ mesaId: string; jugadores: number; maxJugadores: number; tamañoSala: '1v1' | '2v2' | '3v3'; estado: string; creadorNombre?: string; jugadoresNombres?: string[]; modoAlternado?: boolean; modoAyuda?: boolean }>) => void;
  'partida-nueva': (data: { mesaId: string; jugadores: number; maxJugadores: number; tamañoSala: '1v1' | '2v2' | '3v3'; estado: string; creadorNombre?: string; jugadoresNombres?: string[]; modoAlternado?: boolean; modoAyuda?: boolean }) => void;
  'partida-eliminada': (data: { mesaId: string; mensaje: string }) => void;

  // Partidas
  'partida-creada': (data: { mesaId: string; jugador: Jugador }) => void;
  'unido-partida': (data: { mesaId: string; jugador: Jugador; estado: Mesa }) => void;
  'jugador-unido': (data: { jugador: Jugador; totalJugadores: number }) => void;
  'partida-iniciada': (estado: Mesa) => void;
  'reconectado': (data: { jugador: Jugador; estado: Mesa }) => void;

  // Juego
  'estado-actualizado': (estado: Mesa) => void;
  'carta-jugada': (data: { jugadorId: string; carta: Carta; estado: Mesa }) => void;
  'turno-cambiado': (data: { jugadorId: string; estado: Mesa }) => void;
  'mano-finalizada': (data: { ganadorEquipo: number | null; manoNumero: number; estado: Mesa }) => void;  // Emitted when a mano ends, before the 3.5s delay
  'ronda-finalizada': (data: { ganadorEquipo: number; puntosGanados: number; cartasFlorReveladas?: CartaFlorRevelada[]; estado: Mesa }) => void;
  'juego-finalizado': (data: { ganadorEquipo: number; estado: Mesa }) => void;

  // Cantos
  'truco-cantado': (data: { jugadorId: string; tipo: GritoTipo; estado: Mesa }) => void;
  'truco-respondido': (data: { jugadorId: string; acepta: boolean; estado: Mesa }) => void;
  'truco-respuesta-parcial': (data: { jugadorId: string; acepta: boolean; faltanResponder: string[]; estado: Mesa }) => void;
  'envido-cantado': (data: { jugadorId: string; tipo: EnvidoTipo; estado: Mesa }) => void;
  'envido-respondido': (data: { jugadorId: string; acepta: boolean; resultado?: EnvidoResultado; estado: Mesa }) => void;
  'envido-respuesta-parcial': (data: { jugadorId: string; acepta: boolean; faltanResponder: string[]; estado: Mesa }) => void;
  'jugador-al-mazo': (data: { jugadorId: string; equipoQueSeVa: number; estado: Mesa }) => void;
  'corte-solicitado': (data: { jugadorId: string; estado: Mesa }) => void;
  'corte-realizado': (data: { jugadorId: string; posicion: number; estado: Mesa }) => void;
  'carta-repartida': (data: { jugadorIndex: number; cartaIndex: number; vuelta: number; total: number; actual: number }) => void;
  'envido-declarado': (data: { jugadorId: string; declaracion: EnvidoDeclaracion; turnoDeclarar: number; estado: Mesa }) => void;
  'envido-resuelto': (data: { resultado: EnvidoResultadoFinal; estado: Mesa }) => void;
  'flor-cantada': (data: { jugadorId: string; declaracion: FlorDeclaracion; estado: Mesa }) => void;
  'flor-resuelta': (data: { resultado: FlorResultadoFinal; estado: Mesa }) => void;
  'flor-pendiente': (data: { equipoQueCanta: number; equipoQueResponde: number; estado: Mesa }) => void;
  'tirar-reyes-resultado': (data: { animacion: TirarReyesAnimacion[]; estado: Mesa }) => void;
  // Echar los perros
  'perros-echados': (data: { equipoQueEcha: number; estado: Mesa }) => void;
  'perros-cancelados': (data: { estado: Mesa }) => void;
  'perros-respondidos': (data: { respuesta: string; equipoGanador?: number; puntosGanados?: number; floresDelEchador?: number; quiereContraFlor?: boolean; quiereFaltaEnvido?: boolean; quiereTruco?: boolean; estado: Mesa }) => void;
  'perros-pendientes': (data: { equipoQueEcha: number; debeResponder: boolean; estado: Mesa }) => void;
  'anfitrion-desconectado': (data: { nombre: string }) => void;
  'jugador-desconectado': (data: { nombre: string; esAnfitrion: boolean; jugadorId: string }) => void;
  'invitacion-recibida': (data: { de: string; deUserId: number; mesaId: string; tamañoSala: string }) => void;
  // Chat
  'mensaje-recibido': (data: { jugadorId: string; jugadorNombre: string; equipo: number; mensaje: string; tipo: 'general' | 'equipo'; timestamp: number }) => void;
  // Monedas
  'monedas-ganadas': (data: { cantidad: number; balance: number; motivo: string }) => void;
}

// Types for step-by-step envido
export interface EnvidoDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
  sonBuenas: boolean;
}

export interface EnvidoResultadoFinal {
  ganador: number;
  puntosGanados: number;
  declaraciones: EnvidoDeclaracion[];
  mejorPuntaje: number | null;
}

// Types for flor
export interface FlorDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
}

// Type for revealed flor cards at end of round
export interface CartaFlorRevelada {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  cartas: Carta[];
}

export interface FlorResultadoFinal {
  ganador: number;
  puntosGanados: number;
  floresCantadas: FlorDeclaracion[];
  mejorFlor: null;
}

// Type for Tirar Reyes animation
export interface TirarReyesAnimacion {
  jugadorId: string;
  jugadorNombre: string;
  carta: { palo: string; valor: number };
  esRey: boolean;
  equipo: number;
}

// Tipos para datos de conexión
export interface SocketData {
  userId: string;
  mesaId?: string;
}
