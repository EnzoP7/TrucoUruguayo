// Modelo base de carta para el Truco Uruguayo
export interface Carta {
  palo: 'oro' | 'copa' | 'espada' | 'basto';
  valor: number; // 1-12
  poder: number; // jerarquía en el truco
}

// Modelo de jugador genérico
export interface Jugador {
  id: string;
  nombre: string;
  equipo: number; // 1 o 2
  cartas: Carta[];
  esMano?: boolean;
}

// Modelo de equipo
export interface Equipo {
  id: number;
  jugadores: Jugador[];
  puntaje: number;
}

// Estados del juego
export type EstadoJuego = 'esperando' | 'jugando' | 'terminado';

// Fases de una ronda
export type FaseRonda = 'esperando_cantos' | 'cortando' | 'jugando' | 'esperando_respuesta' | 'finalizada';

// Tipos de gritos (truco)
export type GritoTipo = 'truco' | 'retruco' | 'vale4';

// Tipos de envido
export type EnvidoTipo = 'envido' | 'real_envido' | 'falta_envido' | 'envido_cargado';

// Estado de un grito activo
export interface GritoActivo {
  tipo: GritoTipo;
  equipoQueGrita: number;
  jugadorQueGrita: string;
  puntosEnJuego: number; // 2, 3, o 4
  puntosSiNoQuiere: number; // 1, 2, o 3
}

// Estado de un envido activo
export interface EnvidoActivo {
  tipos: EnvidoTipo[]; // cadena de envidos cantados
  equipoQueCanta: number;
  jugadorQueCanta: string;
  puntosAcumulados: number;
  puntosSiNoQuiere: number;
}

// Resultado de envido
export interface EnvidoResultado {
  equipo1Puntos: number;
  equipo2Puntos: number;
  ganador: number;
  puntosGanados: number;
}

// Estado de la mesa
export interface Mesa {
  id: string;
  jugadores: Jugador[];
  equipos: [Equipo, Equipo];
  estado: EstadoJuego;
  fase: FaseRonda;
  turnoActual: number;
  cartasMesa: { jugadorId: string; carta: Carta }[];
  manoActual: number; // 1, 2 o 3 (mano dentro de la ronda)
  maxManos: number;
  ganadoresManos: (number | null)[]; // equipo ganador de cada mano (null = empate)
  indiceMano: number; // indice del jugador que es "mano" (rota entre rondas)
  muestra: Carta | null; // carta de muestra boca arriba
  // Sistema de corte
  esperandoCorte: boolean; // true cuando se debe esperar el corte
  indiceJugadorCorta: number; // indice del jugador que debe cortar
  corteRealizado: boolean; // true cuando el corte fue realizado
  posicionCorte: number | null; // posición donde se cortó el mazo
  // Gritos (Truco/Retruco/Vale4)
  gritoActivo: GritoActivo | null;
  nivelGritoAceptado: GritoTipo | null; // último grito aceptado
  equipoQueCantoUltimo: number | null; // equipo que cantó el último grito aceptado (la palabra la tiene el contrario)
  puntosEnJuego: number; // puntos que vale ganar esta ronda (default 1)
  // Envido
  envidoActivo: EnvidoActivo | null;
  envidoYaCantado: boolean; // no se puede cantar envido dos veces
  primeraCartaJugada: boolean; // envido solo antes de primera carta
  // Resultado
  winnerRonda: number | null;
  winnerJuego: number | null;
  mensajeRonda: string | null; // mensaje temporal para mostrar resultado
  // Sistema de perros
  perrosActivos?: boolean; // Si está activo el modo "echar los perros"
  perrosConfig?: { contraFlor: boolean; faltaEnvido: boolean; truco: boolean } | null;
}
