export interface Carta {
  palo: "oro" | "copa" | "espada" | "basto";
  valor: number;
  poder: number;
}

export interface Jugador {
  id: string;
  nombre: string;
  equipo: number;
  cartas: Carta[];
  esMano?: boolean;
  modoAyuda?: boolean;
  seVaAlMazo?: boolean;
  avatarUrl?: string | null;
  isBot?: boolean;
  participaRonda?: boolean; // false si el jugador no participa en esta ronda (ej: pico a pico 3v3)
}

export interface GritoActivo {
  tipo: string;
  equipoQueGrita: number;
  jugadorQueGrita: string;
  puntosEnJuego: number;
  puntosSiNoQuiere: number;
}

export interface EnvidoActivo {
  tipos: string[];
  equipoQueCanta: number;
  jugadorQueCanta: string;
  puntosAcumulados: number;
  puntosSiNoQuiere: number;
}

export interface EnvidoDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
  sonBuenas: boolean;
}

export interface EnvidoDeclaracionState {
  puntosAcumulados: number;
  declaraciones: EnvidoDeclaracion[];
  turnoDeclarar: number;
  equipoMano: number;
  fase: "declarando" | "resuelto";
  mejorPuntajeDeclarado: number | null;
  equipoMejorPuntaje: number | null;
}

export interface Equipo {
  id: number;
  jugadores: Jugador[];
  puntaje: number;
}

export interface Mesa {
  id: string;
  jugadores: Jugador[];
  equipos: [Equipo, Equipo];
  puntosLimite: number;
  tamañoSala?: "1v1" | "2v2" | "3v3";
  estado: string;
  fase: string;
  turnoActual: number;
  cartasMesa: { jugadorId: string; carta: Carta }[];
  manoActual: number;
  maxManos: number;
  ganadoresManos: (number | null)[];
  indiceMano: number;
  muestra: Carta | null;
  esperandoCorte: boolean;
  indiceJugadorCorta: number;
  corteRealizado: boolean;
  posicionCorte: number | null;
  gritoActivo: GritoActivo | null;
  nivelGritoAceptado: string | null;
  puntosEnJuego: number;
  envidoActivo: EnvidoActivo | null;
  envidoYaCantado: boolean;
  envidoDeclaracion: EnvidoDeclaracionState | null;
  primeraCartaJugada: boolean;
  winnerRonda: number | null;
  winnerJuego: number | null;
  mensajeRonda: string | null;
  cartaGanadoraMano: {
    jugadorId: string;
    carta: Carta;
    indexEnMesa: number;
    manoNumero: number;
  } | null;
  // Flor system
  jugadoresConFlor: string[];
  floresCantadas: FlorDeclaracion[];
  florYaCantada: boolean;
  esperandoRespuestaFlor?: boolean;
  florPendiente?: { equipoQueCanta: number; equipoQueResponde: number } | null;
  // Sistema de alternancia de gritos
  equipoQueCantoUltimo: number | null; // equipo que cantó el último grito aceptado
  // Sistema de perros
  perrosActivos?: boolean;
  perrosConfig?: {
    contraFlor: boolean;
    faltaEnvido: boolean;
    truco: boolean;
  } | null;
  // Respuestas grupales envido
  respuestasEnvido?: Record<string, boolean>;
  esperandoRespuestasGrupales?: boolean;
  // Pico a Pico y Modo Ayuda
  modoAlternadoHabilitado?: boolean;
  modoRondaActual?: "normal" | "1v1";
  modoAyudaHabilitado?: boolean;
  // Sistema pico a pico (3v3 en malas)
  modoPicoAPico: boolean;
  rondaNumero: number;
  turnosPicoAPico?: { jugadorActual: number; oponenteEnfrente: number } | null;
  // Índice donde empieza la mano actual en cartasMesa
  inicioManoActual?: number;
  // Sub-marcador de cruces pico a pico (equipo ganador de cada cruce)
  ganadoresCrucesPicoAPico?: number[];
  duellosPicoAPicoJugados?: number;
  // Cosméticos de jugadores premium
  cosmeticosJugadores?: Record<string, Record<string, string>>;
}

export interface FlorDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
}

export type PlayerSlot =
  | "top"
  | "left"
  | "right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "side-left"
  | "side-right";
