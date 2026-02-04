import { Jugador, Carta, Mesa, GritoTipo, EnvidoTipo, EnvidoResultado } from '@/types/truco';

// Eventos del cliente al servidor
export interface ClientToServerEvents {
  // Lobby
  'join-lobby': (callback: (success: boolean, message?: string) => void) => void;

  // Partidas
  'crear-partida': (data: { nombre: string; tamañoSala?: '1v1' | '2v2' | '3v3' }, callback: (success: boolean, mesaId?: string) => void) => void;
  'unirse-partida': (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => void;
  'iniciar-partida': (callback: (success: boolean, message?: string) => void) => void;
  'reconectar-partida': (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => void;

  // Juego
  'jugar-carta': (data: { carta: Carta }, callback: (success: boolean, message?: string) => void) => void;
  'cantar-truco': (data: { tipo: GritoTipo }, callback: (success: boolean, message?: string) => void) => void;
  'responder-truco': (data: { acepta: boolean }, callback: (success: boolean, message?: string) => void) => void;
  'cantar-envido': (data: { tipo: EnvidoTipo }, callback: (success: boolean, message?: string) => void) => void;
  'responder-envido': (data: { acepta: boolean }, callback: (success: boolean, message?: string) => void) => void;
  'irse-al-mazo': (callback: (success: boolean, message?: string) => void) => void;
}

// Eventos del servidor al cliente
export interface ServerToClientEvents {
  // Lobby
  'partidas-disponibles': (partidas: Array<{ mesaId: string; jugadores: number; maxJugadores: number; tamañoSala: '1v1' | '2v2' | '3v3'; estado: string }>) => void;
  'partida-nueva': (data: { mesaId: string; jugadores: number; maxJugadores: number; tamañoSala: '1v1' | '2v2' | '3v3'; estado: string }) => void;

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
  'mano-finalizada': (data: { ganadorEquipo: number | null; manoNumero: number; estado: Mesa }) => void;
  'ronda-finalizada': (data: { ganadorEquipo: number; puntosGanados: number; estado: Mesa }) => void;
  'juego-finalizado': (data: { ganadorEquipo: number; estado: Mesa }) => void;

  // Cantos
  'truco-cantado': (data: { jugadorId: string; tipo: GritoTipo; estado: Mesa }) => void;
  'truco-respondido': (data: { jugadorId: string; acepta: boolean; estado: Mesa }) => void;
  'envido-cantado': (data: { jugadorId: string; tipo: EnvidoTipo; estado: Mesa }) => void;
  'envido-respondido': (data: { jugadorId: string; acepta: boolean; resultado?: EnvidoResultado; estado: Mesa }) => void;
  'jugador-al-mazo': (data: { jugadorId: string; equipoQueSeVa: number; estado: Mesa }) => void;
}

// Tipos para datos de conexión
export interface SocketData {
  userId: string;
  mesaId?: string;
}
