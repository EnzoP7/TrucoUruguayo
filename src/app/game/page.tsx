"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import socketService from "@/lib/socket";
import audioManager from "@/lib/audioManager";
import TrucoLoader from "@/components/TrucoLoader";
import { RewardedAd, AdBanner } from "@/components/ads";
import AlertModal, { useAlertModal } from "@/components/AlertModal";

interface Carta {
  palo: "oro" | "copa" | "espada" | "basto";
  valor: number;
  poder: number;
}

interface Jugador {
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

interface EnvidoDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
  sonBuenas: boolean;
}

interface EnvidoDeclaracionState {
  puntosAcumulados: number;
  declaraciones: EnvidoDeclaracion[];
  turnoDeclarar: number;
  equipoMano: number;
  fase: "declarando" | "resuelto";
  mejorPuntajeDeclarado: number | null;
  equipoMejorPuntaje: number | null;
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

interface FlorDeclaracion {
  jugadorId: string;
  jugadorNombre: string;
  equipo: number;
  puntos: number | null;
}

// Mapeo palo del modelo -> nombre en archivo de imagen
const paloAArchivo: Record<string, string> = {
  oro: "oros",
  copa: "copas",
  espada: "espadas",
  basto: "bastos",
};

// Configuración de temas de mesa para usuarios premium
// Usar colores CSS directos en lugar de clases Tailwind dinámicas
const TEMAS_MESA: Record<
  string,
  { colors: [string, string, string]; accent: string; name: string; felt: string; feltLight: string }
> = {
  mesa_clasico: {
    colors: ["#1a3d1a", "#0d2e0d", "#0a2a0a"],
    accent: "#10b981",
    name: "Clásico",
    felt: "#064e3b",
    feltLight: "rgba(30, 120, 60, 0.4)",
  },
  mesa_noche: {
    colors: ["#1a2744", "#0d1a2e", "#0a1525"],
    accent: "#3b82f6",
    name: "Noche",
    felt: "#0f1d3d",
    feltLight: "rgba(30, 60, 150, 0.4)",
  },
  mesa_rojo: {
    colors: ["#4a1a1a", "#2e0d0d", "#250a0a"],
    accent: "#ef4444",
    name: "Casino",
    felt: "#3d1010",
    feltLight: "rgba(150, 30, 30, 0.4)",
  },
  mesa_dorado: {
    colors: ["#3d3010", "#2a200a", "#1a1505"],
    accent: "#f59e0b",
    name: "Dorado",
    felt: "#3d3010",
    feltLight: "rgba(150, 120, 30, 0.4)",
  },
  mesa_cuero: {
    colors: ["#4a2c17", "#3b2010", "#2a1508"],
    accent: "#d97706",
    name: "Cuero",
    felt: "#3d2510",
    feltLight: "rgba(150, 90, 30, 0.4)",
  },
  mesa_marmol: {
    colors: ["#374151", "#1f2937", "#111827"],
    accent: "#9ca3af",
    name: "Mármol",
    felt: "#1f2937",
    feltLight: "rgba(100, 100, 120, 0.3)",
  },
  mesa_neon: {
    colors: ["#2e1065", "#1e1b4b", "#0f0a2e"],
    accent: "#a855f7",
    name: "Neón",
    felt: "#1a0a3d",
    feltLight: "rgba(120, 50, 200, 0.4)",
  },
  mesa_medianoche: {
    colors: ["#0a0a0a", "#0d0d0d", "#050505"],
    accent: "#6366f1",
    name: "Medianoche",
    felt: "#0a0a15",
    feltLight: "rgba(60, 60, 120, 0.3)",
  },
};

// Configuración de reversos de cartas para usuarios premium (colores CSS directos)
const REVERSOS_CARTAS: Record<
  string,
  { colors: [string, string]; name: string }
> = {
  reverso_clasico: { colors: ["#1e3a5f", "#172554"], name: "Clásico" },
  reverso_azul: { colors: ["#1d4ed8", "#1e3a8a"], name: "Azul Elegante" },
  reverso_rojo: { colors: ["#991b1b", "#450a0a"], name: "Rojo Fuego" },
  reverso_dorado: { colors: ["#b45309", "#78350f"], name: "Dorado Real" },
  reverso_verde: { colors: ["#166534", "#14532d"], name: "Verde Bosque" },
  reverso_purpura: { colors: ["#7e22ce", "#581c87"], name: "Púrpura" },
  reverso_negro: { colors: ["#1c1c1c", "#0a0a0a"], name: "Obsidiana" },
  reverso_arcoiris: { colors: ["#ec4899", "#8b5cf6"], name: "Arcoíris" },
};

const MARCOS_AVATAR: Record<string, { border: string; shadow: string; ring: string }> = {
  marco_ninguno: { border: "border-gold-600/50", shadow: "", ring: "" },
  marco_bronce: { border: "border-amber-700", shadow: "shadow-lg shadow-amber-700/30", ring: "ring-1 ring-amber-600/40" },
  marco_plata: { border: "border-gray-300", shadow: "shadow-lg shadow-gray-300/30", ring: "ring-1 ring-gray-300/40" },
  marco_oro: { border: "border-yellow-400", shadow: "shadow-lg shadow-yellow-400/40", ring: "ring-2 ring-yellow-400/50" },
  marco_diamante: { border: "border-cyan-300", shadow: "shadow-lg shadow-cyan-300/50", ring: "ring-2 ring-cyan-300/60" },
};

function getCartaImageUrl(carta: Carta): string {
  const valorStr = carta.valor.toString().padStart(2, "0");
  const paloStr = paloAArchivo[carta.palo] || carta.palo;
  return `/Cartasimg/${valorStr}-${paloStr}.png`;
}

function getNombreGrito(tipo: string): string {
  const nombres: Record<string, string> = {
    truco: "TRUCO",
    retruco: "RETRUCO",
    vale4: "VALE 4",
  };
  return nombres[tipo] || tipo;
}

function getNombreEnvido(tipo: string): string {
  const nombres: Record<string, string> = {
    envido: "ENVIDO",
    real_envido: "REAL ENVIDO",
    falta_envido: "FALTA ENVIDO",
    envido_cargado: "ENVIDO CARGADO",
  };
  // Manejar tipos de envido cargado con cantidad específica (ej: "cargado_15")
  if (tipo.startsWith("cargado_")) {
    const puntos = tipo.split("_")[1];
    return `ENVIDO CARGADO (${puntos} pts)`;
  }
  return nombres[tipo] || tipo;
}

// === FUNCIONES DE AYUDA PARA PRINCIPIANTES ===

// Obtener el valor de envido de una carta
function getValorEnvidoCarta(carta: Carta): number {
  // 10, 11, 12 valen 0 para envido
  if (carta.valor >= 10) return 0;
  return carta.valor;
}

// Calcular puntos de envido de un conjunto de cartas
function calcularEnvido(cartas: Carta[]): {
  puntos: number;
  explicacion: string;
  cartasUsadas: Carta[];
} {
  if (!cartas || cartas.length === 0) {
    return { puntos: 0, explicacion: "Sin cartas", cartasUsadas: [] };
  }

  // Agrupar cartas por palo
  const porPalo: Record<string, Carta[]> = {};
  cartas.forEach((c) => {
    if (!porPalo[c.palo]) porPalo[c.palo] = [];
    porPalo[c.palo].push(c);
  });

  let mejorPuntos = 0;
  let mejorExplicacion = "";
  let mejorCartas: Carta[] = [];

  // Buscar el mejor envido
  for (const [palo, cartasPalo] of Object.entries(porPalo)) {
    if (cartasPalo.length >= 2) {
      // Dos o más cartas del mismo palo: 20 + suma de los dos mejores valores
      const valores = cartasPalo
        .map((c) => getValorEnvidoCarta(c))
        .sort((a, b) => b - a);
      const puntos = 20 + valores[0] + valores[1];
      if (puntos > mejorPuntos) {
        mejorPuntos = puntos;
        const cartasOrdenadas = [...cartasPalo].sort(
          (a, b) => getValorEnvidoCarta(b) - getValorEnvidoCarta(a),
        );
        mejorCartas = cartasOrdenadas.slice(0, 2);
        mejorExplicacion = `20 base + ${valores[0]} + ${valores[1]} = ${puntos} (${palo})`;
      }
    } else if (cartasPalo.length === 1) {
      // Una sola carta de ese palo
      const puntos = getValorEnvidoCarta(cartasPalo[0]);
      if (puntos > mejorPuntos) {
        mejorPuntos = puntos;
        mejorCartas = [cartasPalo[0]];
        mejorExplicacion = `Carta suelta: ${puntos} puntos`;
      }
    }
  }

  // Si no hay cartas del mismo palo, tomar la carta más alta
  if (mejorPuntos === 0 && cartas.length > 0) {
    const cartaOrdenadas = [...cartas].sort(
      (a, b) => getValorEnvidoCarta(b) - getValorEnvidoCarta(a),
    );
    mejorPuntos = getValorEnvidoCarta(cartaOrdenadas[0]);
    mejorCartas = [cartaOrdenadas[0]];
    mejorExplicacion = `Carta más alta: ${mejorPuntos} puntos`;
  }

  return {
    puntos: mejorPuntos,
    explicacion: mejorExplicacion,
    cartasUsadas: mejorCartas,
  };
}

// Ordenar cartas por poder (de mayor a menor)
function ordenarCartasPorPoder(cartas: Carta[]): Carta[] {
  return [...cartas].sort((a, b) => b.poder - a.poder);
}

// Obtener nombre legible del poder de una carta
function getNombrePoderCarta(carta: Carta): string {
  // Piezas (cartas del palo de la muestra) tienen poder 15-19
  if (carta.poder >= 15) {
    const posiciones: Record<number, string> = {
      15: "Pieza (10)",
      16: "Pieza (11)",
      17: "Pieza (5)",
      18: "Pieza (4)",
      19: "Pieza (2)",
    };
    return posiciones[carta.poder] || `Pieza especial`;
  }
  const poderes: Record<number, string> = {
    14: "Mata (Espada 1)",
    13: "Mata (Basto 1)",
    12: "Mata (Espada 7)",
    11: "Mata (Oro 7)",
    10: "Tres",
    9: "Dos",
    8: "As (Oro/Copa)",
    7: "Doce",
    6: "Once",
    5: "Diez",
    4: "Siete (Copa/Basto)",
    3: "Seis",
    2: "Cinco",
    1: "Cuatro",
  };
  return poderes[carta.poder] || `Poder ${carta.poder}`;
}

// Valores que son pieza del palo de la muestra
const VALORES_PIEZA_CLIENT = [2, 4, 5, 10, 11];

function esPiezaClient(carta: Carta, muestra: Carta | null): boolean {
  if (!muestra) return false;
  if (carta.palo !== muestra.palo) return false;
  if (VALORES_PIEZA_CLIENT.includes(carta.valor)) return true;
  if (carta.valor === 12 && VALORES_PIEZA_CLIENT.includes(muestra.valor))
    return true;
  return false;
}

// Detectar flor con reglas completas (mismo palo, piezas)
function tieneFlor_client(cartas: Carta[], muestra: Carta | null): boolean {
  if (cartas.length !== 3) return false;
  // Regla 1: 3 cartas del mismo palo
  if (cartas.every((c) => c.palo === cartas[0].palo)) return true;
  // Regla 2: 2+ piezas
  const piezas = cartas.filter((c) => esPiezaClient(c, muestra));
  if (piezas.length >= 2) return true;
  // Regla 3: 1 pieza + 2 del mismo palo
  if (piezas.length === 1) {
    const noPiezas = cartas.filter((c) => !esPiezaClient(c, muestra));
    if (noPiezas.length === 2 && noPiezas[0].palo === noPiezas[1].palo)
      return true;
  }
  return false;
}

// Calcular puntos de flor
function calcularFlor_client(
  cartas: Carta[],
  muestra: Carta | null,
): { puntos: number; explicacion: string } {
  if (!tieneFlor_client(cartas, muestra)) return { puntos: 0, explicacion: "" };

  const getValorEnvidoLocal = (c: Carta): number => {
    if (muestra && c.palo === muestra.palo) {
      switch (c.valor) {
        case 2:
          return 30;
        case 4:
          return 29;
        case 5:
          return 28;
        case 10:
          return 27;
        case 11:
          return 27;
        case 12:
          if (VALORES_PIEZA_CLIENT.includes(muestra.valor)) {
            switch (muestra.valor) {
              case 2:
                return 30;
              case 4:
                return 29;
              case 5:
                return 28;
              case 10:
                return 27;
              case 11:
                return 27;
              default:
                return 0;
            }
          }
          return 0;
        default:
          return c.valor;
      }
    }
    return c.valor >= 10 ? 0 : c.valor;
  };

  const piezas = cartas.filter((c) => esPiezaClient(c, muestra));

  if (piezas.length === 0) {
    let suma = 0;
    cartas.forEach((c) => {
      suma += c.valor >= 10 ? 0 : c.valor;
    });
    return {
      puntos: suma + 20,
      explicacion: `20 + ${cartas.map((c) => (c.valor >= 10 ? 0 : c.valor)).join(" + ")} = ${suma + 20}`,
    };
  }

  if (piezas.length === 1) {
    const valorPieza = getValorEnvidoLocal(piezas[0]);
    const noPiezas = cartas.filter(
      (c) => !(c.palo === piezas[0].palo && c.valor === piezas[0].valor),
    );
    let sumaOtras = 0;
    noPiezas.forEach((c) => {
      sumaOtras += c.valor >= 10 ? 0 : c.valor;
    });
    return {
      puntos: valorPieza + sumaOtras,
      explicacion: `Pieza(${valorPieza}) + ${sumaOtras} = ${valorPieza + sumaOtras}`,
    };
  }

  // 2+ piezas
  const piezasConValor = piezas
    .map((p) => ({ carta: p, v: getValorEnvidoLocal(p) }))
    .sort((a, b) => b.v - a.v);
  let total = piezasConValor[0].v;
  for (let i = 1; i < piezasConValor.length; i++) {
    total += piezasConValor[i].v - 20;
  }
  const noPiezas = cartas.filter((c) => !esPiezaClient(c, muestra));
  noPiezas.forEach((c) => {
    total += c.valor >= 10 ? 0 : c.valor;
  });
  return { puntos: total, explicacion: `Piezas: ${total} pts` };
}

// Componente del panel de ayuda
function PanelAyuda({
  cartas,
  muestra,
  envidoYaCantado,
  florYaCantada,
}: {
  cartas: Carta[];
  muestra: Carta | null;
  envidoYaCantado: boolean;
  florYaCantada: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const cartasOrdenadas = ordenarCartasPorPoder(cartas);
  const envido = calcularEnvido(cartas);
  const cartaMasAlta = cartasOrdenadas[0];

  // Verificar flor con reglas completas (incluye piezas)
  const tieneFlor = tieneFlor_client(cartas, muestra);
  const florInfo = tieneFlor ? calcularFlor_client(cartas, muestra) : null;

  // Minimizado: solo el boton
  if (!abierto) {
    return (
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setAbierto(true)}
          className="glass rounded-xl p-2.5 border border-celeste-500/30 bg-celeste-950/40 shadow-lg hover:bg-celeste-900/50 transition-all flex items-center gap-2"
          title="Abrir ayuda"
        >
          <span className="text-lg">📚</span>
          <span className="hidden md:inline text-celeste-300 text-sm font-medium">
            Ayuda
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40 w-48 sm:w-56">
      <div className="glass rounded-xl p-3 border border-celeste-500/30 bg-celeste-950/40 shadow-lg">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-celeste-500/20">
          <span className="text-lg">📚</span>
          <h3 className="text-celeste-300 font-bold text-sm flex-1">Ayuda</h3>
          <button
            onClick={() => setAbierto(false)}
            className="text-celeste-400/60 hover:text-celeste-300 text-xs px-1.5 py-0.5 rounded hover:bg-celeste-800/30 transition-all"
            title="Minimizar"
          >
            X
          </button>
        </div>

        {/* Carta mas alta */}
        {cartaMasAlta && (
          <div className="mb-3">
            <div className="text-celeste-400/70 text-xs font-medium mb-1">
              Tu carta mas fuerte:
            </div>
            <div className="flex items-center gap-2 bg-celeste-900/30 rounded-lg p-2">
              <Image
                src={getCartaImageUrl(cartaMasAlta)}
                alt={`${cartaMasAlta.valor} de ${cartaMasAlta.palo}`}
                width={32}
                height={48}
                className="w-8 h-12 rounded shadow"
              />
              <div className="text-xs">
                <div className="text-white font-medium">
                  {cartaMasAlta.valor} de {cartaMasAlta.palo}
                </div>
                <div
                  className={`${cartaMasAlta.poder >= 15 ? "text-yellow-400" : "text-celeste-300/60"}`}
                >
                  {getNombrePoderCarta(cartaMasAlta)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Envido - ocultar si ya se resolvio */}
        {!envidoYaCantado && (
          <div className="mb-3">
            <div className="text-celeste-400/70 text-xs font-medium mb-1">
              Tu envido:
            </div>
            <div className="bg-celeste-900/30 rounded-lg p-2">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {envido.puntos}
              </div>
              <div className="text-celeste-300/60 text-[10px] leading-tight">
                {envido.explicacion}
              </div>
            </div>
          </div>
        )}

        {/* Flor - con puntos calculados */}
        {tieneFlor && !florYaCantada && florInfo && (
          <div className="mb-3">
            <div className="text-pink-400/70 text-xs font-medium mb-1">
              Tenes FLOR!
            </div>
            <div className="bg-pink-900/30 rounded-lg p-2">
              <div className="text-2xl font-bold text-pink-300 mb-1">
                {florInfo.puntos}
              </div>
              <div className="text-pink-300/60 text-[10px] leading-tight">
                {florInfo.explicacion}
              </div>
            </div>
          </div>
        )}

        {/* Orden de cartas */}
        <div className="mb-2">
          <div className="text-celeste-400/70 text-xs font-medium mb-1">
            Tus cartas (de + a -):
          </div>
          <div className="space-y-1">
            {cartasOrdenadas.map((carta, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-[10px] rounded px-2 py-1 ${
                  carta.poder >= 15
                    ? "bg-yellow-900/30 border border-yellow-500/20"
                    : "bg-celeste-900/20"
                }`}
              >
                <span className="text-celeste-300 font-bold">{idx + 1}.</span>
                <span className="text-white">
                  {carta.valor} {carta.palo}
                </span>
                <span
                  className={`ml-auto text-[9px] ${carta.poder >= 15 ? "text-yellow-400" : "text-celeste-400/50"}`}
                >
                  {getNombrePoderCarta(carta)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Muestra */}
        {muestra && (
          <div className="pt-2 border-t border-celeste-500/20">
            <div className="text-yellow-400/70 text-xs font-medium mb-1">
              Muestra: {muestra.valor} de {muestra.palo}
            </div>
            <div className="text-[10px] text-yellow-300/50">
              Las cartas de {muestra.palo} son piezas (mas fuertes)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para responder a los perros con opciones separadas
function PerrosResponseModal({
  tengoFlor,
  loading,
  onResponder,
  misCartas,
  muestra,
}: {
  tengoFlor: boolean;
  loading: boolean;
  onResponder: (
    quiereContraFlor: boolean,
    quiereFaltaEnvido: boolean,
    quiereTruco: boolean,
  ) => void;
  misCartas: { palo: string; valor: number; poder: number }[];
  muestra: { palo: string; valor: number; poder: number } | null;
}) {
  const [quiereEnvidoFlor, setQuiereEnvidoFlor] = useState<boolean | null>(
    null,
  );
  const [quiereTruco, setQuiereTruco] = useState<boolean | null>(null);

  const puedeConfirmar = quiereEnvidoFlor !== null && quiereTruco !== null;
  const seVaAlMazo = quiereEnvidoFlor === false && quiereTruco === false;

  const handleConfirmar = () => {
    if (!puedeConfirmar) return;
    onResponder(
      tengoFlor ? quiereEnvidoFlor || false : false,
      !tengoFlor ? quiereEnvidoFlor || false : false,
      quiereTruco || false,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Te echaron los Perros">
      <div className="glass rounded-2xl p-6 max-w-lg w-full border-2 border-orange-600/50 animate-slide-up">
        <div className="text-center mb-4">
          <span className="text-4xl">🐕</span>
          <h3 className="text-xl font-bold text-orange-300 mt-2">
            ¡Te echaron los Perros!
          </h3>
          <p className="text-gold-400/60 text-xs mt-1">
            {tengoFlor ? "En Ley (tenés Flor)" : "A Punto (sin Flor)"}
          </p>
        </div>

        {/* Muestra y Cartas del jugador */}
        <div className="mb-4 p-3 bg-black/30 rounded-xl border border-gold-700/30">
          {/* Muestra */}
          {muestra && muestra.valor !== 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-gold-400/70 text-xs font-medium">
                Muestra:
              </span>
              <div className="relative">
                <Image
                  src={`/Cartasimg/${muestra.valor.toString().padStart(2, "0")}-${muestra.palo === "oro" ? "oros" : muestra.palo === "copa" ? "copas" : muestra.palo === "espada" ? "espadas" : muestra.palo === "basto" ? "bastos" : muestra.palo}.png`}
                  alt={`${muestra.valor} de ${muestra.palo}`}
                  width={56}
                  height={84}
                  className="w-10 h-[3.75rem] sm:w-14 sm:h-[5.25rem] rounded shadow-lg ring-2 ring-yellow-500/60"
                />
              </div>
            </div>
          )}

          {/* Mis cartas */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-gold-400/70 text-xs font-medium">
              Tus cartas:
            </span>
            <div className="flex gap-2 sm:gap-3 justify-center">
              {misCartas.filter((c) => c.valor !== 0).length > 0 ? (
                misCartas
                  .filter((c) => c.valor !== 0)
                  .map((carta, idx) => {
                    const paloStr =
                      carta.palo === "oro"
                        ? "oros"
                        : carta.palo === "copa"
                          ? "copas"
                          : carta.palo === "espada"
                            ? "espadas"
                            : carta.palo === "basto"
                              ? "bastos"
                              : carta.palo;
                    const valorStr = carta.valor.toString().padStart(2, "0");
                    return (
                      <div key={idx} className="relative">
                        <Image
                          src={`/Cartasimg/${valorStr}-${paloStr}.png`}
                          alt={`${carta.valor} de ${carta.palo}`}
                          width={64}
                          height={96}
                          className={`w-12 h-[4.5rem] sm:w-16 sm:h-24 rounded shadow-lg transition-all ${
                            muestra && carta.palo === muestra.palo
                              ? "ring-2 ring-yellow-400/70"
                              : ""
                          }`}
                        />
                        {muestra && carta.palo === muestra.palo && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px]">⭐</span>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <span className="text-gold-500/50 text-sm italic">
                  Cargando cartas...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Opción 1: Contra Flor al Resto o Falta Envido */}
        <div className="mb-4">
          <p className="text-gold-400/80 text-sm font-medium mb-2">
            {tengoFlor ? "🌸 Contra Flor al Resto" : "🎯 Falta Envido"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setQuiereEnvidoFlor(true)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereEnvidoFlor === true
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-green-900/30 text-green-400 border border-green-700/40 hover:bg-green-800/40"
              }`}
            >
              Quiero
            </button>
            <button
              onClick={() => setQuiereEnvidoFlor(false)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereEnvidoFlor === false
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-red-900/30 text-red-400 border border-red-700/40 hover:bg-red-800/40"
              }`}
            >
              Paso
            </button>
          </div>
        </div>

        {/* Opción 2: Truco */}
        <div className="mb-5">
          <p className="text-gold-400/80 text-sm font-medium mb-2">⚔️ Truco</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setQuiereTruco(true)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereTruco === true
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-green-900/30 text-green-400 border border-green-700/40 hover:bg-green-800/40"
              }`}
            >
              Quiero
            </button>
            <button
              onClick={() => setQuiereTruco(false)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereTruco === false
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-red-900/30 text-red-400 border border-red-700/40 hover:bg-red-800/40"
              }`}
            >
              Paso
            </button>
          </div>
        </div>

        {/* Confirmar */}
        {seVaAlMazo && puedeConfirmar && (
          <p className="text-red-400/80 text-xs text-center mb-2">
            Si pasás todo, te vas al mazo.
          </p>
        )}
        <button
          onClick={handleConfirmar}
          disabled={!puedeConfirmar || loading}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            !puedeConfirmar
              ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              : seVaAlMazo
                ? "bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
                : "bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400"
          }`}
        >
          {!puedeConfirmar
            ? "Elegí para cada uno"
            : seVaAlMazo
              ? "Me voy al mazo"
              : `Confirmar${quiereEnvidoFlor && quiereTruco ? " (todo)" : ""}`}
        </button>
      </div>
    </div>
  );
}

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
  const [envidoDeclaraciones, setEnvidoDeclaraciones] = useState<
    EnvidoDeclaracion[]
  >([]);
  const [envidoResultado, setEnvidoResultado] = useState<{
    ganador: number;
    puntosGanados: number;
    mejorPuntaje: number | null;
  } | null>(null);
  const [dealingCards, setDealingCards] = useState<
    { jugadorIndex: number; cartaIndex: number }[]
  >([]);
  const [isDealing, setIsDealing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_florAnuncio, setFlorAnuncio] = useState<{
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

  // Mapeo de nombre corto a ID de cosmético para fallback
  const MAPEO_TEMAS: Record<string, string> = {
    clasico: "mesa_clasico", azul: "mesa_noche", rojo: "mesa_rojo", dorado: "mesa_dorado",
    cuero: "mesa_cuero", marmol: "mesa_marmol", neon: "mesa_neon", medianoche: "mesa_medianoche",
  };

  // Obtener tema de mesa activo (solo del jugador actual - cada premium ve su propio tema)
  const getTemaActivo = useCallback((): {
    colors: [string, string, string];
    accent: string;
    felt: string;
    feltLight: string;
  } | null => {
    // 1. Intentar desde cosméticos del server
    if (mesa?.cosmeticosJugadores && socketId) {
      const misCosmetics = mesa.cosmeticosJugadores[socketId];
      if (misCosmetics?.tema_mesa && TEMAS_MESA[misCosmetics.tema_mesa]) {
        return TEMAS_MESA[misCosmetics.tema_mesa];
      }
    }
    // 2. Fallback: leer de sessionStorage
    try {
      const saved = sessionStorage.getItem("truco_usuario");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.tema_mesa && u.tema_mesa !== "clasico") {
          const cosmeticoId = MAPEO_TEMAS[u.tema_mesa];
          if (cosmeticoId && TEMAS_MESA[cosmeticoId]) {
            return TEMAS_MESA[cosmeticoId];
          }
        }
      }
    } catch { /* ignore */ }
    return null;
  }, [mesa?.cosmeticosJugadores, socketId]);

  // Obtener reverso de cartas activo (solo del jugador actual - cada premium ve su propio reverso)
  const getReversoActivo = useCallback((): [string, string] | null => {
    if (!mesa?.cosmeticosJugadores || !socketId) return null;
    const misCosmetics = mesa.cosmeticosJugadores[socketId];
    if (
      misCosmetics?.reverso_cartas &&
      REVERSOS_CARTAS[misCosmetics.reverso_cartas]
    ) {
      return REVERSOS_CARTAS[misCosmetics.reverso_cartas].colors;
    }
    return null;
  }, [mesa?.cosmeticosJugadores, socketId]);

  // Helper: inline style para overridear .card-back con reverso custom
  const getCardBackStyle = useCallback((): React.CSSProperties | undefined => {
    const colors = getReversoActivo();
    if (!colors) return undefined;
    return {
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
      borderColor: `${colors[0]}cc`,
    };
  }, [getReversoActivo]);

  // Helper: obtener marco de avatar para un jugador
  const getMarcoForPlayer = useCallback((playerId: string) => {
    if (!mesa?.cosmeticosJugadores) return MARCOS_AVATAR.marco_ninguno;
    const cosmetics = mesa.cosmeticosJugadores[playerId];
    if (cosmetics?.marco_avatar && MARCOS_AVATAR[cosmetics.marco_avatar]) {
      return MARCOS_AVATAR[cosmetics.marco_avatar];
    }
    return MARCOS_AVATAR.marco_ninguno;
  }, [mesa?.cosmeticosJugadores]);

  const mensajeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarMensaje = useCallback((msg: string, duracion = 3000) => {
    setMensaje(msg);
    if (mensajeTimerRef.current) clearTimeout(mensajeTimerRef.current);
    mensajeTimerRef.current = setTimeout(() => setMensaje(null), duracion);
  }, []);

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

        socketService.onAnfitrionDesconectado((data) => {
          if (!mounted) return;
          audioManager.play("notification");
          mostrarMensaje(
            `El anfitrión (${data.nombre}) se ha desconectado`,
            5000,
          );
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
        // Nota: el sonido de ronda ganada/perdida se reproduce en onRondaFinalizada

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
          // Include flor/envido cards if any were revealed
          setRondaBanner({
            mensaje: `Equipo ${data.ganadorEquipo} gana la ronda`,
            puntos: data.puntosGanados,
            equipo: data.ganadorEquipo,
            cartasFlor: data.cartasFlorReveladas || [],
            cartasEnvido: data.cartasEnvidoReveladas || [],
            muestra: data.muestra || null,
          });
          // Longer timeout if flor/envido cards are shown (2s with cards, 2s without)
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
          setReyesAnimacion(data.animacion);
          setReyesAnimStep(0);
          setReyesAnimDone(false);
          // Animate step by step
          data.animacion.forEach((_: unknown, index: number) => {
            setTimeout(
              () => {
                if (mounted) setReyesAnimStep(index + 1);
              },
              (index + 1) * 1200,
            );
          });
          // After all reveals, show final state and update mesa
          setTimeout(
            () => {
              if (mounted) {
                setReyesAnimDone(true);
                setMesa(data.estado);
                // If the game was reset to waiting (post-game tirar reyes), show waiting room
                if (data.estado.estado === "esperando") {
                  setEsperandoInicio(true);
                }
              }
            },
            (data.animacion.length + 1) * 1200,
          );
          // Clear animation after a bit
          setTimeout(
            () => {
              if (mounted) {
                setReyesAnimacion(null);
                setReyesAnimStep(0);
                setReyesAnimDone(false);
              }
            },
            (data.animacion.length + 3) * 1200,
          );
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
            // Al mazo - show points and score
            const eq1 = data.estado.equipos[0]?.puntaje ?? 0;
            const eq2 = data.estado.equipos[1]?.puntaje ?? 0;
            setMensaje(
              `🐕 ¡Al mazo! Equipo ${data.equipoGanador} gana ${data.puntosGanados} pts\n📊 Marcador: Equipo 1: ${eq1} - Equipo 2: ${eq2}`,
            );
          } else {
            // Partial acceptance - show response and score
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
          // Don't redirect immediately - could be a timing issue
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
  }, [mesaId, mostrarMensaje]);

  // Poll for state while in waiting room to catch missed events
  useEffect(() => {
    if (!esperandoInicio || !conectado) return;
    const interval = setInterval(() => {
      socketService.solicitarEstado();
    }, 3000);
    return () => clearInterval(interval);
  }, [esperandoInicio, conectado]);

  // Sonido de "tu turno" cuando cambia el turno a mí
  const [prevTurno, setPrevTurno] = useState<string | null>(null);
  useEffect(() => {
    if (!mesa || !socketId || mesa.estado !== "jugando") return;
    const turnoActualId = mesa.jugadores[mesa.turnoActual]?.id;
    if (turnoActualId === socketId && prevTurno !== socketId) {
      audioManager.play("your-turn");
    }
    setPrevTurno(turnoActualId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.turnoActual, socketId]);

  // Iniciar música cuando empieza el juego
  useEffect(() => {
    if (mesa?.estado === "jugando" && !esperandoInicio) {
      audioManager.startMusic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.estado, esperandoInicio]);

  // Estado de audio para la UI
  const [muted, setMuted] = useState(audioManager.isMuted());
  const [volume, setVolume] = useState(audioManager.getVolume());
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

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

  // === HELPERS ===
  const miJugador = useMemo(() => mesa?.jugadores.find((j) => j.id === socketId), [mesa?.jugadores, socketId]);
  const miEquipo = miJugador?.equipo;
  const meFuiAlMazo = miJugador?.seVaAlMazo === true;

  const esMiTurno = useCallback((): boolean => {
    if (!mesa || !socketId || mesa.estado !== "jugando") return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.fase !== "jugando") return false;
    // No se puede jugar carta si hay flor pendiente de respuesta
    if (mesa.esperandoRespuestaFlor || florPendiente) return false;
    return mesa.jugadores[mesa.turnoActual]?.id === socketId;
  }, [mesa, socketId, florPendiente]);

  const misCartasMemo = useMemo((): Carta[] => {
    if (!mesa || !socketId) return [];
    const jugador = mesa.jugadores.find((j) => j.id === socketId);
    const cartas = jugador?.cartas.filter((c) => c.valor !== 0) || [];

    // Durante la animación de repartición, mostrar solo las cartas que ya "llegaron"
    if (isDealing && dealingCards.length > 0) {
      const miIndex = mesa.jugadores.findIndex((j) => j.id === socketId);
      const cartasQueMeLlegaron = dealingCards.filter(
        (d) => d.jugadorIndex === miIndex,
      ).length;
      const cartasVisibles = cartas.slice(0, cartasQueMeLlegaron);
      if (jugador?.modoAyuda) {
        return ordenarCartasPorPoder(cartasVisibles);
      }
      return cartasVisibles;
    }

    if (jugador?.modoAyuda) {
      return ordenarCartasPorPoder(cartas);
    }
    return cartas;
  }, [mesa, socketId, isDealing, dealingCards]);
  const misCartas = useCallback(() => misCartasMemo, [misCartasMemo]);

  const esAnfitrion = useCallback((): boolean => {
    if (!mesa || !socketId) return false;
    return mesa.jugadores[0]?.id === socketId;
  }, [mesa, socketId]);

  const puedoCantarTruco = (): boolean => {
    if (!mesa || !socketId || mesa.estado !== "jugando") return false;
    if (meFuiAlMazo) return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.fase !== "jugando") return false;
    if (!miEquipo) return false;
    // No se puede cantar truco si hay flor pendiente
    if (mesa.esperandoRespuestaFlor || florPendiente) return false;
    if (mesa.nivelGritoAceptado === null) return true;
    return false;
  };

  const puedoCantarRetruco = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (meFuiAlMazo) return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.nivelGritoAceptado !== "truco") return false;
    // Solo el equipo que ACEPTÓ el truco tiene la palabra para retruco
    // Es decir, el equipo contrario al que cantó el truco
    if (mesa.equipoQueCantoUltimo === miEquipo) return false;
    return true;
  };

  const puedoCantarVale4 = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (meFuiAlMazo) return false;
    if (mesa.gritoActivo || mesa.envidoActivo) return false;
    if (mesa.nivelGritoAceptado !== "retruco") return false;
    // Solo el equipo que ACEPTÓ el retruco tiene la palabra para vale4
    // Es decir, el equipo contrario al que cantó el retruco
    if (mesa.equipoQueCantoUltimo === miEquipo) return false;
    return true;
  };

  const puedoCantarEnvido = (): boolean => {
    if (!mesa || !socketId || mesa.estado !== "jugando") return false;
    if (meFuiAlMazo) return false;
    if (mesa.fase !== "jugando") return false;
    // El envido solo se puede cantar en la primera mano
    if (mesa.manoActual !== 1) return false;
    // Si hay flor sin resolver en la mesa (propia o de compañero), no se puede cantar envido
    if (mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0 && !mesa.florYaCantada) return false;
    // Verificar si YO ya jugué mi carta en esta mano
    // Usar número de participantes activos para pico a pico
    const numParticipantesEnvido = mesa.jugadores.filter(
      (j: Jugador) => j.participaRonda !== false && !j.seVaAlMazo,
    ).length;
    const cartasManoActual = mesa.cartasMesa.slice(0, numParticipantesEnvido);
    const yaJugueMiCarta = cartasManoActual.some(
      (c) => c.jugadorId === socketId,
    );
    if (yaJugueMiCarta) return false;
    if (mesa.envidoYaCantado && !mesa.envidoActivo) return false;
    if (mesa.gritoActivo) return false;
    if (mesa.envidoActivo && mesa.envidoActivo.equipoQueCanta === miEquipo)
      return false;
    // No se puede cantar si hay flor pendiente de respuesta
    if (mesa.esperandoRespuestaFlor || florPendiente) return false;
    return true;
  };

  const deboResponderGrito = (): boolean => {
    if (!mesa || !miEquipo || !mesa.gritoActivo || !socketId) return false;
    if (meFuiAlMazo) return false;
    // En modo pico a pico, solo los jugadores que participan pueden responder
    const miJugador = mesa.jugadores.find((j: Jugador) => j.id === socketId);
    if (miJugador?.participaRonda === false) return false;
    return mesa.gritoActivo.equipoQueGrita !== miEquipo;
  };

  const deboResponderEnvido = (): boolean => {
    if (!mesa || !miEquipo || !mesa.envidoActivo || !socketId) return false;
    if (meFuiAlMazo) return false;
    // Si hay flor sin resolver, el envido se anula - no mostrar panel de respuesta
    if (mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0 && !mesa.florYaCantada) return false;
    // En modo pico a pico, solo los jugadores que participan pueden responder
    const miJugador = mesa.jugadores.find((j: Jugador) => j.id === socketId);
    if (miJugador?.participaRonda === false) return false;
    return mesa.envidoActivo.equipoQueCanta !== miEquipo;
  };

  const esMiTurnoDeCortar = (): boolean => {
    if (!mesa || !socketId) return false;
    if (mesa.fase !== "cortando" || !mesa.esperandoCorte || mesa.corteRealizado)
      return false;
    return mesa.jugadores[mesa.indiceJugadorCorta]?.id === socketId;
  };

  // Envido declarations are now automatic - no manual turn needed

  // Flor helper - La flor ahora se canta automáticamente
  const tengoFlor = (): boolean => {
    if (!mesa || !socketId) return false;
    return mesa.jugadoresConFlor?.includes(socketId) || false;
  };

  // Echar los Perros helper - solo el equipo que va perdiendo, cuando el rival está en buenas
  const puedeEcharPerros = (): boolean => {
    if (!mesa || !miEquipo) return false;
    if (mesa.fase !== "cortando") return false;
    if (mesa.perrosActivos) return false;
    const mitadPuntos = mesa.puntosLimite / 2;
    const equipoRival = miEquipo === 1 ? 2 : 1;
    const puntajeRival =
      mesa.equipos.find((e) => e.id === equipoRival)?.puntaje || 0;
    const puntajeMio =
      mesa.equipos.find((e) => e.id === miEquipo)?.puntaje || 0;
    return puntajeRival >= mitadPuntos && puntajeMio < puntajeRival;
  };

  // === HANDLERS ===
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

  // Envido declaration is now automatic - no manual handler needed

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

  // === COMPONENTES ===

  // Componente de moneda dorada para identificar al jugador mano
  const MonedaMano = ({ isActive = false }: { isActive?: boolean }) => (
    <div
      className={`relative inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-500 ${
        isActive
          ? "animate-coin-flip shadow-lg shadow-yellow-500/40"
          : "opacity-40 grayscale"
      }`}
      title="Mano"
    >
      <Image
        src="/Images/MonedaArtigas.png"
        alt="Mano"
        width={32}
        height={32}
        className="w-full h-full rounded-full object-cover"
      />
    </div>
  );

  // Componente de mazo para el corte - abanico horizontal de cartas
  // Cuando es tu turno: cartas GRANDES y prominentes
  // Cuando no es tu turno: cartas más pequeñas
  const MazoCorte = ({
    onCorte,
    esperandoCorte,
    esMiTurnoCorte,
  }: {
    onCorte?: (posicion: number) => void;
    esperandoCorte: boolean;
    esMiTurnoCorte: boolean;
  }) => {
    if (!esperandoCorte) return null;

    const TOTAL_CARTAS = 40; // 40 cartas en el mazo

    const handleCartaClick = async (index: number) => {
      if (!esMiTurnoCorte || !onCorte || cutAnimating) return;
      const posicion = index + 1;
      setCutPosition(index);
      setCutAnimating(true);

      await new Promise((resolve) => setTimeout(resolve, 600));
      onCorte(posicion);
    };

    // Tamaños responsive para mobile/tablet/desktop
    // En mobile: cartas más pequeñas y menos spread
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const isTablet =
      typeof window !== "undefined" &&
      window.innerWidth >= 640 &&
      window.innerWidth < 1024;

    const cardWidth = esMiTurnoCorte
      ? "w-6 h-10 sm:w-10 sm:h-16 lg:w-14 lg:h-22"
      : "w-4 h-6 sm:w-6 sm:h-10";

    // Contenedor responsive - más pequeño en mobile
    const containerClasses = esMiTurnoCorte
      ? "w-[95vw] sm:w-[85vw] lg:w-[700px] h-[140px] sm:h-[180px] lg:h-[220px]"
      : "w-[80vw] sm:w-[400px] h-[100px] sm:h-[140px]";

    // Spread y arco responsive
    const getSpreadMultiplier = () => {
      if (!esMiTurnoCorte) return isMobile ? 5 : isTablet ? 8 : 11;
      return isMobile ? 5 : isTablet ? 10 : 15;
    };
    const getArcMultiplier = () => {
      if (!esMiTurnoCorte) return isMobile ? 6 : isTablet ? 9 : 12;
      return isMobile ? 10 : isTablet ? 15 : 20;
    };

    const spreadMultiplier = getSpreadMultiplier();
    const arcMultiplier = getArcMultiplier();

    return (
      <div
        className={`flex flex-col items-center z-30 transition-all duration-500 ${
          esMiTurnoCorte ? "scale-100" : "scale-90 opacity-70"
        }`}
      >
        <div
          className={`font-bold mb-2 sm:mb-4 uppercase tracking-wider ${
            esMiTurnoCorte
              ? "text-base sm:text-xl lg:text-2xl text-gold-400 animate-pulse drop-shadow-lg"
              : "text-xs sm:text-sm lg:text-base text-gold-500/60"
          }`}
        >
          {esMiTurnoCorte ? "¡CORTÁ EL MAZO!" : "Esperando corte..."}
        </div>

        {esMiTurnoCorte && !cutAnimating && (
          <div className="mb-2 sm:mb-4 text-gold-300/80 text-xs sm:text-sm lg:text-base font-medium animate-bounce">
            👇 Tocá una carta para cortar 👇
          </div>
        )}

        {/* Abanico horizontal de 40 cartas - responsive */}
        <div
          className={`relative ${cutAnimating ? "" : "deck-shuffle-anim"} ${containerClasses}`}
        >
          {Array.from({ length: TOTAL_CARTAS }).map((_, i) => {
            const isLeftPart = cutPosition !== null && i <= cutPosition;
            const isRightPart = cutPosition !== null && i > cutPosition;

            const spreadX = (i - TOTAL_CARTAS / 2) * spreadMultiplier;
            const arcY =
              Math.pow((i - TOTAL_CARTAS / 2) / (TOTAL_CARTAS / 2), 2) *
              arcMultiplier;

            return (
              <div
                key={i}
                onClick={() => handleCartaClick(i)}
                className={`absolute transition-all duration-500 ease-out origin-bottom
                  ${esMiTurnoCorte && !cutAnimating ? "cursor-pointer group" : "cursor-default"}
                `}
                style={{
                  left: "50%",
                  bottom: "10px",
                  zIndex: i + 1,
                  transform: cutAnimating
                    ? isLeftPart
                      ? `translateX(calc(-50% + ${spreadX - 40}px)) translateY(${-arcY - 30}px) rotate(${-15}deg)`
                      : isRightPart
                        ? `translateX(calc(-50% + ${spreadX + 40}px)) translateY(${-arcY}px) rotate(${12}deg)`
                        : `translateX(calc(-50% + ${spreadX}px)) translateY(${-arcY}px)`
                    : `translateX(calc(-50% + ${spreadX}px)) translateY(${-arcY}px)`,
                }}
              >
                <div
                  className={`${cardWidth} card-back rounded transition-all duration-200 border ${
                    esMiTurnoCorte
                      ? "border-gold-600/70 shadow-lg shadow-gold-500/20"
                      : "border-amber-900/50"
                  } ${
                    esMiTurnoCorte && !cutAnimating
                      ? "group-hover:-translate-y-4 sm:group-hover:-translate-y-6 group-hover:shadow-xl group-hover:shadow-gold-500/50 group-hover:scale-110 sm:group-hover:scale-125 group-hover:z-50 group-hover:border-gold-400"
                      : ""
                  }`}
                  style={{
                    ...getCardBackStyle(),
                    boxShadow: esMiTurnoCorte
                      ? `1px 2px 6px rgba(0,0,0,0.5), 0 0 10px rgba(202, 138, 4, 0.2)`
                      : `1px 2px 4px rgba(0,0,0,0.4)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {esMiTurnoCorte && !cutAnimating && (
          <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-gold-400/70 font-medium">
            Posición 1-40
          </div>
        )}

        {cutAnimating && cutPosition !== null && (
          <div className="mt-2 sm:mt-4 text-sm sm:text-lg text-gold-400 font-bold animate-pulse">
            ✂️ Cortando en posición {cutPosition + 1}...
          </div>
        )}
      </div>
    );
  };

  // Componente de carta
  const reversoActivo = getReversoActivo();

  const CartaImg = ({
    carta,
    size = "normal",
    onClick,
    disabled,
    showGlow,
  }: {
    carta: Carta;
    size?: "small" | "normal" | "large";
    onClick?: () => void;
    disabled?: boolean;
    showGlow?: boolean;
  }) => {
    const isOculta = carta.valor === 0;
    // Tamaños responsive: mobile / tablet / desktop
    const sizeClasses = {
      small: "w-8 h-12 sm:w-10 sm:h-[3.75rem] lg:w-12 lg:h-[4.5rem]",
      normal: "w-12 h-[4.5rem] sm:w-14 sm:h-[5.25rem] lg:w-16 lg:h-24",
      large:
        "w-[4.5rem] h-[6.75rem] sm:w-[4.5rem] sm:h-[6.75rem] lg:w-20 lg:h-[7.5rem]",
    };

    if (isOculta) {
      // Usar reverso personalizado si hay uno activo de un jugador premium
      if (reversoActivo) {
        return (
          <div
            className={`${sizeClasses[size]} rounded-lg border border-white/20 shadow-lg flex items-center justify-center`}
            style={{
              background: `linear-gradient(to bottom right, ${reversoActivo[0]}, ${reversoActivo[1]})`,
            }}
            aria-hidden="true"
          >
            <div className="w-2/3 h-2/3 rounded border border-white/10 bg-white/5" />
          </div>
        );
      }
      return <div className={`${sizeClasses[size]} card-back rounded-lg`} style={getCardBackStyle()} aria-hidden="true" />;
    }

    const cartaLabel = `Jugar ${carta.valor} de ${carta.palo}`;

    return (
      <button
        onClick={onClick}
        disabled={disabled || !onClick}
        aria-label={cartaLabel}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onClick && !disabled) {
            e.preventDefault();
            onClick();
          }
        }}
        className={`${sizeClasses[size]} rounded-lg overflow-hidden transition-all duration-300 relative
          ${onClick && !disabled ? "card-interactive cursor-pointer" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${showGlow ? "ring-2 ring-gold-400 shadow-gold-glow" : "shadow-card"}
        `}
      >
        <Image
          src={getCartaImageUrl(carta)}
          alt={`${carta.valor} de ${carta.palo}`}
          fill
          sizes="(max-width: 640px) 64px, 96px"
          className="object-cover"
          draggable={false}
        />
      </button>
    );
  };

  // Marcador compacto: solo números en todas las pantallas
  const ScoreBoard = ({
    equipo,
    puntos,
    isMyTeam,
  }: {
    equipo: number;
    puntos: number;
    isMyTeam: boolean;
  }) => {
    const limite = mesa?.puntosLimite || 30;
    const mitad = Math.floor(limite / 2);
    const enBuenas = puntos >= mitad;
    const buenos = Math.max(puntos - mitad, 0);
    const malos = Math.min(puntos, mitad);
    const label = isMyTeam ? "Nosotros" : "Ellos";

    return (
      <div
        className={`score-panel rounded-xl px-3 py-1.5 ${isMyTeam ? "ring-2 ring-gold-500/50" : ""}`}
      >
        <div className="text-center">
          <span
            className={`text-[10px] uppercase tracking-wider font-medium ${equipo === 1 ? "text-celeste-400" : "text-red-400"}`}
          >
            {label}
          </span>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-white">{puntos}</span>
        </div>
        <div className="text-center">
          {enBuenas ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-600/30 text-green-400 border border-green-500/40">
              BUENAS {buenos}/{mitad}
            </span>
          ) : (
            <span className="text-[9px] text-gold-500/50">
              Malos {malos}/{mitad}
            </span>
          )}
        </div>
      </div>
    );
  };

  // === PANTALLAS ===

  // Pantalla de carga
  if (!conectado) {
    return <TrucoLoader text="Conectando al servidor..." size="lg" />;
  }

  // Pantalla de espera
  if (!mesa || (mesa.estado === "esperando" && esperandoInicio)) {
    // Calcular máximo de jugadores según tamaño de sala
    const getMaxJugadores = () => {
      if (mesa?.tamañoSala === "1v1") return 2;
      if (mesa?.tamañoSala === "2v2") return 4;
      if (mesa?.tamañoSala === "3v3") return 6;
      // Fallback: inferir del número actual de jugadores
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
          // Para iniciar: ambos equipos deben tener exactamente maxPorEquipo jugadores
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
                  const paloArchivo: Record<string, string> = {
                    oro: "oros",
                    copa: "copas",
                    espada: "espadas",
                    basto: "bastos",
                  };

                  return (
                    <div
                      key={item.jugadorId}
                      className="flex flex-col items-center gap-2"
                    >
                      <span
                        className={`text-sm font-medium ${
                          revealed
                            ? item.esRey
                              ? "text-celeste-300"
                              : "text-red-300"
                            : "text-gold-400/70"
                        }`}
                      >
                        {item.jugadorNombre}
                      </span>

                      <div
                        className={`relative w-16 h-24 sm:w-20 sm:h-[7.5rem] transition-all duration-700 ${
                          revealed ? "scale-110" : ""
                        }`}
                        style={{ perspective: "600px" }}
                      >
                        <div
                          className={`w-full h-full transition-all duration-700 relative`}
                          style={{
                            transformStyle: "preserve-3d",
                            transform: revealed
                              ? "rotateY(180deg)"
                              : "rotateY(0deg)",
                          }}
                        >
                          {/* Back of card */}
                          <div
                            className="absolute inset-0 card-back rounded-lg"
                            style={{ backfaceVisibility: "hidden", ...getCardBackStyle() }}
                          />
                          {/* Front of card */}
                          <div
                            className="absolute inset-0 rounded-lg overflow-hidden"
                            style={{
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)",
                            }}
                          >
                            <Image
                              src={`/Cartasimg/${item.carta.valor.toString().padStart(2, "0")}-${paloArchivo[item.carta.palo] || item.carta.palo}.png`}
                              alt={`${item.carta.valor} de ${item.carta.palo}`}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        </div>

                        {/* King crown indicator */}
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
                      <span className="text-celeste-400 font-medium text-sm">
                        Equipo 1:{" "}
                      </span>
                      <span className="text-white text-sm">
                        {reyesAnimacion
                          .filter((a) => a.equipo === 1)
                          .map((a) => a.jugadorNombre)
                          .join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-red-400 font-medium text-sm">
                        Equipo 2:{" "}
                      </span>
                      <span className="text-white text-sm">
                        {reyesAnimacion
                          .filter((a) => a.equipo === 2)
                          .map((a) => a.jugadorNombre)
                          .join(", ")}
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
                  {mesa.jugadores.length} jugador
                  {mesa.jugadores.length !== 1 ? "es" : ""} en la mesa
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
                      {/* Debug/test mode options */}
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-gold-600/40 text-[10px] uppercase tracking-wider mr-1">
                          Test:
                        </span>
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
                      Malos: 0-{Math.floor(mesa.puntosLimite / 2)} | Buenos:{" "}
                      {Math.floor(mesa.puntosLimite / 2)}-{mesa.puntosLimite}
                    </div>
                  </div>
                )}
                {!esAnfitrion() && (
                  <div className="mb-4 text-center">
                    <span className="text-gold-500/60 text-sm">
                      Partida a{" "}
                      <span className="text-gold-400 font-bold">
                        {mesa.puntosLimite} puntos
                      </span>
                    </span>
                  </div>
                )}

                {/* Team configuration for 2v2 and 3v3 */}
                {mesa.jugadores.length > 2 ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-gold-400/80 font-medium text-sm uppercase tracking-wider">
                        Configurar Equipos
                      </h2>
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

                    {/* Two-column team layout */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Equipo 1 */}
                      <div className="rounded-xl border-2 border-celeste-600/40 bg-celeste-950/20 p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-celeste-500" />
                          <span className="text-celeste-400 font-bold text-sm uppercase tracking-wider">
                            Equipo 1
                          </span>
                          <span className="text-celeste-400/50 text-xs ml-auto">
                            {
                              mesa.jugadores.filter((j) => j.equipo === 1)
                                .length
                            }{" "}
                            jugadores
                          </span>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {mesa.jugadores
                            .filter((j) => j.equipo === 1)
                            .map((j, i) => (
                              <div
                                key={j.id || `eq1-${i}`}
                                className="glass rounded-lg p-2.5 flex items-center justify-between border border-celeste-700/30 group"
                              >
                                <div className="flex items-center gap-2">
                                  {j.isBot && (
                                    <span className="text-sm">🤖</span>
                                  )}
                                  <span className="text-white text-sm font-medium">
                                    {j.nombre}
                                  </span>
                                  {j.id === socketId && (
                                    <span className="text-gold-400 text-[10px]">
                                      (tú)
                                    </span>
                                  )}
                                  {j.id === mesa.jugadores[0]?.id && (
                                    <span className="text-[10px] bg-gold-600/30 text-gold-400 px-1.5 py-0.5 rounded">
                                      Host
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Botón para quitar bot (solo anfitrión) */}
                                  {j.isBot && esAnfitrion() && (
                                    <button
                                      onClick={() => handleQuitarBot(j.id)}
                                      className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all"
                                      title="Quitar bot"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  {j.id === socketId ? (
                                    <button
                                      onClick={() =>
                                        socketService.toggleAyuda(!j.modoAyuda)
                                      }
                                      className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                                      title="Activar/desactivar modo ayuda"
                                    >
                                      📚 Ayuda
                                    </button>
                                  ) : (
                                    j.modoAyuda && (
                                      <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">
                                        📚
                                      </span>
                                    )
                                  )}
                                  {esAnfitrion() && !j.isBot && (
                                    <button
                                      onClick={() =>
                                        handleCambiarEquipo(j.id, 2)
                                      }
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
                          {mesa.jugadores.filter((j) => j.equipo === 1)
                            .length === 0 && (
                            <div className="text-celeste-500/30 text-xs text-center py-3 italic">
                              Sin jugadores
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Equipo 2 */}
                      <div className="rounded-xl border-2 border-red-600/40 bg-red-950/20 p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-red-400 font-bold text-sm uppercase tracking-wider">
                            Equipo 2
                          </span>
                          <span className="text-red-400/50 text-xs ml-auto">
                            {
                              mesa.jugadores.filter((j) => j.equipo === 2)
                                .length
                            }{" "}
                            jugadores
                          </span>
                        </div>
                        <div className="space-y-2 min-h-[60px]">
                          {mesa.jugadores
                            .filter((j) => j.equipo === 2)
                            .map((j, i) => (
                              <div
                                key={j.id || `eq2-${i}`}
                                className="glass rounded-lg p-2.5 flex items-center justify-between border border-red-700/30 group"
                              >
                                <div className="flex items-center gap-2">
                                  {j.isBot && (
                                    <span className="text-sm">🤖</span>
                                  )}
                                  <span className="text-white text-sm font-medium">
                                    {j.nombre}
                                  </span>
                                  {j.id === socketId && (
                                    <span className="text-gold-400 text-[10px]">
                                      (tú)
                                    </span>
                                  )}
                                  {j.id === mesa.jugadores[0]?.id && (
                                    <span className="text-[10px] bg-gold-600/30 text-gold-400 px-1.5 py-0.5 rounded">
                                      Host
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Botón para quitar bot (solo anfitrión) */}
                                  {j.isBot && esAnfitrion() && (
                                    <button
                                      onClick={() => handleQuitarBot(j.id)}
                                      className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all"
                                      title="Quitar bot"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  {j.id === socketId ? (
                                    <button
                                      onClick={() =>
                                        socketService.toggleAyuda(!j.modoAyuda)
                                      }
                                      className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                                      title="Activar/desactivar modo ayuda"
                                    >
                                      📚 Ayuda
                                    </button>
                                  ) : (
                                    j.modoAyuda && (
                                      <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">
                                        📚
                                      </span>
                                    )
                                  )}
                                  {esAnfitrion() && !j.isBot && (
                                    <button
                                      onClick={() =>
                                        handleCambiarEquipo(j.id, 1)
                                      }
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
                          {mesa.jugadores.filter((j) => j.equipo === 2)
                            .length === 0 && (
                            <div className="text-red-500/30 text-xs text-center py-3 italic">
                              Sin jugadores
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Balance warning */}
                    {!equiposBalanceados && mesa.jugadores.length >= 2 && (
                      <div className="mt-3 text-center text-amber-400/70 text-xs flex items-center justify-center gap-1.5">
                        <span>⚠️</span> Los equipos deben estar balanceados para
                        iniciar
                      </div>
                    )}
                  </div>
                ) : (
                  /* Simple player list for 1v1 or less than 3 players */
                  <div className="mb-6 space-y-2">
                    {mesa.jugadores.map((j, i) => (
                      <div
                        key={j.id || i}
                        className="glass rounded-lg p-3 flex justify-between items-center border border-gold-800/20"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${j.equipo === 1 ? "bg-celeste-500" : "bg-red-500"}`}
                          />
                          <span className="text-white font-medium flex items-center gap-1.5">
                            {j.isBot && <span className="text-lg">🤖</span>}
                            {j.nombre}
                            {j.id === socketId && (
                              <span className="text-gold-400 ml-2">(tú)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Botón para quitar bot (solo anfitrión) */}
                          {j.isBot && esAnfitrion() && (
                            <button
                              onClick={() => handleQuitarBot(j.id)}
                              className="text-xs px-2 py-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-900/30 transition-all"
                              title="Quitar bot"
                            >
                              ✕
                            </button>
                          )}
                          {j.id === socketId ? (
                            <button
                              onClick={() =>
                                socketService.toggleAyuda(!j.modoAyuda)
                              }
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${j.modoAyuda ? "bg-celeste-600/40 text-celeste-300" : "bg-gray-700/30 text-gray-500 hover:text-gray-400"}`}
                              title="Activar/desactivar modo ayuda"
                            >
                              📚 Ayuda
                            </button>
                          ) : (
                            j.modoAyuda && (
                              <span className="text-[10px] bg-celeste-600/20 text-celeste-400/60 px-1.5 py-0.5 rounded">
                                📚
                              </span>
                            )
                          )}
                          {i === 0 && (
                            <span className="text-xs bg-gold-600/30 text-gold-400 px-2 py-1 rounded">
                              Anfitrión
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar bots (solo anfitrión, si hay espacio) */}
                {esAnfitrion() &&
                  (() => {
                    // Usar maxJugadores calculado arriba
                    const eq1Count = mesa.jugadores.filter(
                      (j) => j.equipo === 1,
                    ).length;
                    const eq2Count = mesa.jugadores.filter(
                      (j) => j.equipo === 2,
                    ).length;
                    const hayEspacioEq1 = eq1Count < maxPorEquipo;
                    const hayEspacioEq2 = eq2Count < maxPorEquipo;
                    const hayEspacio = mesa.jugadores.length < maxJugadores;

                    if (!hayEspacio) return null;

                    // Para 1v1: botón simple para agregar oponente
                    if (maxJugadores === 2) {
                      return (
                        <div className="mb-4 p-3 glass rounded-xl border border-celeste-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-celeste-300 text-sm font-medium flex items-center gap-1.5">
                              <span className="text-lg">🤖</span> Agregar Bot
                              Oponente
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleAgregarBot("facil", 2)}
                              disabled={agregandoBot}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 border border-green-500/20 disabled:opacity-50 transition-all"
                            >
                              Fácil
                            </button>
                            <button
                              onClick={() => handleAgregarBot("medio", 2)}
                              disabled={agregandoBot}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 border border-yellow-500/20 disabled:opacity-50 transition-all"
                            >
                              Medio
                            </button>
                            <button
                              onClick={() => handleAgregarBot("dificil", 2)}
                              disabled={agregandoBot}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 border border-red-500/20 disabled:opacity-50 transition-all"
                            >
                              Difícil
                            </button>
                          </div>
                          {agregandoBot && (
                            <p className="text-celeste-400/50 text-xs mt-2 text-center">
                              Agregando...
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Para 2v2/3v3: botones por equipo
                    return (
                      <div className="mb-4 p-3 glass rounded-xl border border-celeste-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-celeste-300 text-sm font-medium flex items-center gap-1.5">
                            <span className="text-lg">🤖</span> Agregar Bot
                          </span>
                          <span className="text-celeste-500/50 text-xs">
                            ({mesa.jugadores.length}/{maxJugadores})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Equipo 1 */}
                          <div
                            className={`rounded-lg p-2 border ${hayEspacioEq1 ? "border-celeste-600/40 bg-celeste-950/30" : "border-gray-700/30 bg-gray-900/30 opacity-50"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full bg-celeste-500" />
                              <span className="text-celeste-400 text-xs font-medium">
                                Equipo 1
                              </span>
                              <span className="text-celeste-500/50 text-[10px] ml-auto">
                                {eq1Count}/{maxPorEquipo}
                              </span>
                            </div>
                            {hayEspacioEq1 ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleAgregarBot("facil", 1)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Fácil"
                                >
                                  🟢
                                </button>
                                <button
                                  onClick={() => handleAgregarBot("medio", 1)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Medio"
                                >
                                  🟡
                                </button>
                                <button
                                  onClick={() => handleAgregarBot("dificil", 1)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Difícil"
                                >
                                  🔴
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[10px]">
                                Equipo lleno
                              </span>
                            )}
                          </div>

                          {/* Equipo 2 */}
                          <div
                            className={`rounded-lg p-2 border ${hayEspacioEq2 ? "border-red-600/40 bg-red-950/30" : "border-gray-700/30 bg-gray-900/30 opacity-50"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-400 text-xs font-medium">
                                Equipo 2
                              </span>
                              <span className="text-red-500/50 text-[10px] ml-auto">
                                {eq2Count}/{maxPorEquipo}
                              </span>
                            </div>
                            {hayEspacioEq2 ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleAgregarBot("facil", 2)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-green-600/30 text-green-300 hover:bg-green-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Fácil"
                                >
                                  🟢
                                </button>
                                <button
                                  onClick={() => handleAgregarBot("medio", 2)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Medio"
                                >
                                  🟡
                                </button>
                                <button
                                  onClick={() => handleAgregarBot("dificil", 2)}
                                  disabled={agregandoBot}
                                  className="flex-1 px-1 py-1 rounded text-[10px] font-medium bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 transition-all"
                                  title="Bot Difícil"
                                >
                                  🔴
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[10px]">
                                Equipo lleno
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-gray-500">
                          <span>🟢 Fácil</span>
                          <span>🟡 Medio</span>
                          <span>🔴 Difícil</span>
                        </div>

                        {/* Botón para llenar todos los espacios con bots */}
                        <button
                          onClick={() => handleLlenarConBots("dificil")}
                          disabled={agregandoBot}
                          className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600/40 to-purple-500/40 text-purple-200 hover:from-purple-600/60 hover:to-purple-500/60 border border-purple-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          <span>⚡</span>
                          Llenar con Bots
                        </button>

                        {agregandoBot && (
                          <p className="text-celeste-400/50 text-xs mt-2 text-center">
                            Agregando...
                          </p>
                        )}
                      </div>
                    );
                  })()}

                {/* Invitar Amigos (solo si hay espacio) */}
                {esAnfitrion() && mesa.jugadores.length < maxJugadores && (
                  <div className="mb-4 p-3 glass rounded-xl border border-green-500/20">
                    <button
                      onClick={() => {
                        setMostrarAmigos(!mostrarAmigos);
                        if (!mostrarAmigos) cargarAmigosConectados();
                      }}
                      className="w-full flex items-center justify-between text-green-300 text-sm font-medium"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-lg">👥</span> Invitar Amigos
                      </span>
                      <span
                        className={`transition-transform ${mostrarAmigos ? "rotate-180" : ""}`}
                      >
                        ▼
                      </span>
                    </button>

                    {mostrarAmigos && (
                      <div className="mt-3 space-y-2">
                        {cargandoAmigos ? (
                          <p className="text-green-400/50 text-xs text-center">
                            Cargando amigos...
                          </p>
                        ) : amigosConectados.length === 0 ? (
                          <p className="text-green-400/50 text-xs text-center italic">
                            No hay amigos conectados
                          </p>
                        ) : (
                          amigosConectados.map((amigo) => (
                            <div
                              key={amigo.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-green-950/30 border border-green-700/20"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-white text-sm">
                                  {amigo.apodo}
                                </span>
                              </div>
                              <button
                                onClick={() => handleInvitarAmigo(amigo.id)}
                                disabled={invitandoAmigo === amigo.id}
                                className="px-3 py-1 text-xs font-medium rounded-lg bg-green-600/40 text-green-200 hover:bg-green-600/60 border border-green-500/30 disabled:opacity-50 transition-all"
                              >
                                {invitandoAmigo === amigo.id
                                  ? "..."
                                  : "Invitar"}
                              </button>
                            </div>
                          ))
                        )}
                        <button
                          onClick={cargarAmigosConectados}
                          disabled={cargandoAmigos}
                          className="w-full text-xs text-green-500/60 hover:text-green-400 transition-colors"
                        >
                          🔄 Actualizar lista
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {esAnfitrion() ? (
                  <button
                    onClick={handleIniciarPartida}
                    disabled={
                      loading ||
                      mesa.jugadores.length < 2 ||
                      (mesa.jugadores.length > 2 && !equiposBalanceados)
                    }
                    className="btn-primary w-full text-white py-4 rounded-xl text-lg disabled:opacity-40"
                  >
                    {loading
                      ? "Iniciando..."
                      : `Iniciar Partida (${mesa.jugadores.length} jugadores)`}
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
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === JUEGO PRINCIPAL ===
  // Usar inicioManoActual del servidor (considera jugadores que se fueron al mazo)
  const inicioMano = mesa.inicioManoActual || 0;
  const cartasManoActual = mesa.cartasMesa.slice(inicioMano);
  const jugadorDelTurno = mesa.jugadores[mesa.turnoActual];

  // === DISTRIBUCIÓN VISUAL DE JUGADORES ===
  // Organizar jugadores según su posición en la mesa visual
  // - Yo siempre estoy abajo (centro en 3v3)
  // Cards that each teammate has played in the current mano
  const cartasJugadasPorJugador = (jugadorId: string) => {
    return cartasManoActual
      .filter((c) => c.jugadorId === jugadorId)
      .map((c) => c.carta);
  };
  // Check if I already played a card in this mano
  const yaJugueEnEstaMano = cartasManoActual.some((c) => c.jugadorId === socketId);

  // === SLOT-BASED PLAYER POSITIONING ===
  // Uses posicionRelativa (distance in array from me) so that from EVERY player's
  // perspective, the next player in turn order is always to their RIGHT (clockwise).
  // This ensures consistent visuals for all players.
  // 1v1: posRel 1 → top
  // 2v2: posRel 1 → right, posRel 2 → top, posRel 3 → left
  // 3v3: posRel 1 → side-right, posRel 2 → top-right, posRel 3 → top-center,
  //       posRel 4 → top-left, posRel 5 → side-left
  type PlayerSlot =
    | "top"
    | "left"
    | "right"
    | "top-left"
    | "top-center"
    | "top-right"
    | "side-left"
    | "side-right";

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

  // Players grouped by position area
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
        (order[playerSlotMap.get(a.id) || ""] ?? 1) -
        (order[playerSlotMap.get(b.id) || ""] ?? 1)
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

  // Helper to render a player indicator (name + cards)
  const renderPlayerIndicator = (
    j: (typeof mesa.jugadores)[0],
    compact: boolean = false,
  ) => {
    const esSuTurno = jugadorDelTurno?.id === j.id;
    const esCompanero = j.equipo === miEquipo;
    const bubble = speechBubbles.find((b) => b.jugadorId === j.id);
    const jugadas = cartasJugadasPorJugador(j.id);

    return (
      <div key={j.id} className="text-center relative">
        {bubble && (
          <div
            className={`absolute -top-14 left-1/2 -translate-x-1/2 z-50 speech-bubble ${
              bubble.tipo === "envido"
                ? "speech-bubble-envido"
                : bubble.tipo === "flor"
                  ? "speech-bubble-flor"
                  : bubble.tipo === "truco"
                    ? "speech-bubble-truco"
                    : bubble.tipo === "quiero"
                      ? "speech-bubble-quiero"
                      : bubble.tipo === "no-quiero"
                        ? "speech-bubble-no-quiero"
                        : ""
            }`}
          >
            {bubble.puntos !== undefined &&
            bubble.puntos !== null &&
            bubble.tipo !== "flor" ? (
              <span className="bubble-number text-2xl font-bold">
                {bubble.puntos}
              </span>
            ) : (
              <span className="font-bold text-sm whitespace-nowrap">
                {bubble.texto}
              </span>
            )}
          </div>
        )}
        <div
          className={`inline-flex items-center ${compact ? "gap-1 px-2" : "gap-1.5 px-2"} py-0.5 rounded-lg ${compact ? "text-xs" : "text-xs sm:text-sm"} font-medium ${compact ? "mb-0.5" : "mb-1"} ${
            j.equipo === 1
              ? "equipo-1-light text-celeste-300"
              : "equipo-2-light text-red-300"
          } ${esSuTurno ? "turn-glow" : ""}`}
        >
          {(() => {
            const marco = getMarcoForPlayer(j.id);
            return j.avatarUrl ? (
              <Image
                src={j.avatarUrl}
                alt=""
                width={24}
                height={24}
                className={`${compact ? "w-5 h-5" : "w-6 h-6"} rounded-full object-cover border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}
                unoptimized
              />
            ) : (
              <span
                className={`${compact ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]"} rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}
              >
                {j.nombre[0]?.toUpperCase()}
              </span>
            );
          })()}
          {j.nombre}
          {j.esMano && <MonedaMano isActive={true} />}
        </div>
        <div
          className={
            compact
              ? "flex flex-col gap-0.5 items-center"
              : "flex gap-1 justify-center"
          }
        >
          {esCompanero
            ? j.cartas
                .filter((c) => c.valor !== 0)
                .map((carta, ci) => {
                  const yaJugada = jugadas.some(
                    (cj) => cj.palo === carta.palo && cj.valor === carta.valor,
                  );
                  return (
                    <div
                      key={`${carta.palo}-${carta.valor}-${ci}`}
                      className={`transition-all duration-300 ${yaJugada ? "opacity-25 grayscale scale-90" : ""}`}
                    >
                      <CartaImg carta={carta} size="small" />
                    </div>
                  );
                })
            : j.cartas.map((_, i) => (
                <div
                  key={i}
                  className={
                    compact
                      ? "w-6 h-9 sm:w-7 sm:h-10 card-back rounded"
                      : "w-7 h-10 sm:w-8 sm:h-12 card-back rounded"
                  }
                  style={getCardBackStyle()}
                />
              ))}
        </div>
      </div>
    );
  };

  // Obtener tema activo para el fondo
  const temaActivo = getTemaActivo();

  // Debug: mostrar valores
  console.log(
    "[Game] RENDER - socketId:",
    socketId,
    "cosmeticosJugadores:",
    mesa?.cosmeticosJugadores,
    "temaActivo:",
    temaActivo,
  );

  return (
    <div
      className={`min-h-screen p-2 sm:p-4 overflow-hidden ${!temaActivo ? "bg-table-wood" : ""}`}
      style={
        temaActivo
          ? {
              background: `linear-gradient(to bottom right, ${temaActivo.colors[0]}, ${temaActivo.colors[1]}, ${temaActivo.colors[2]})`,
            }
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
          style={{
            background: `radial-gradient(circle, ${temaActivo ? temaActivo.accent + "26" : "rgba(245, 158, 11, 0.1)"} 0%, transparent 70%)`,
          }}
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
              setMonedasGanadas({
                ...monedasGanadas,
                cantidad: monedasGanadas.cantidad * 2,
                balance: result.balance,
              });
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
            <h3 className="text-lg font-bold text-red-300 mb-2">
              {jugadorDesconectado.nombre} se desconectó
            </h3>
            <p className="text-sm text-gold-400/70 mb-4">
              {jugadorDesconectado.esAnfitrion
                ? "El anfitrión abandonó la partida."
                : "Un jugador abandonó la partida."}{" "}
              Podés esperar a que se reconecte o abandonar.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setJugadorDesconectado(null)}
                className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-gray-700 to-gray-600 text-white hover:from-gray-600 hover:to-gray-500 transition-all shadow-lg"
              >
                Esperar
              </button>
              <button
                onClick={() => {
                  setJugadorDesconectado(null);
                  handleTerminarPartida();
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500 transition-all shadow-lg"
              >
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de ayuda - siempre disponible durante el juego */}
      {mesa.estado === "jugando" && misCartas().length > 0 && (
        <PanelAyuda
          cartas={misCartas()}
          muestra={mesa.muestra}
          envidoYaCantado={mesa.envidoYaCantado}
          florYaCantada={!!mesa.florYaCantada}
        />
      )}

      {/* Chat en partida */}
      {mesa.estado === "jugando" && (
        <>
          {/* Botón flotante para abrir chat */}
          {!chatAbierto && (
            <button
              onClick={() => {
                setChatAbierto(true);
                setMensajesNoLeidos(0);
              }}
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
          {/* Panel de chat */}
          {chatAbierto && (
            <div className="fixed bottom-24 right-3 z-40 w-72 sm:w-80 max-h-80 glass rounded-xl border border-celeste-500/30 bg-celeste-950/80 shadow-xl flex flex-col overflow-hidden animate-slide-up">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-celeste-500/20 bg-celeste-900/40">
                <div className="flex gap-1">
                  <button
                    onClick={() => setChatTab("general")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      chatTab === "general"
                        ? "bg-celeste-600 text-white"
                        : "text-celeste-400 hover:bg-celeste-800/50"
                    }`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setChatTab("equipo")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      chatTab === "equipo"
                        ? "bg-green-600 text-white"
                        : "text-celeste-400 hover:bg-celeste-800/50"
                    }`}
                  >
                    Mi Equipo
                  </button>
                </div>
                <button
                  onClick={() => setChatAbierto(false)}
                  className="text-celeste-400/60 hover:text-celeste-300 text-sm px-2 py-1 rounded hover:bg-celeste-800/30 transition-all"
                  title="Cerrar chat"
                >
                  ✕
                </button>
              </div>
              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-48 scrollbar-thin scrollbar-thumb-celeste-700 scrollbar-track-transparent">
                {mensajesChat
                  .filter((m) =>
                    chatTab === "general"
                      ? m.tipo === "general"
                      : m.tipo === "equipo",
                  )
                  .map((m, i) => {
                    const esMio = m.jugadorId === socketId;
                    const colorEquipo =
                      m.equipo === 1 ? "text-blue-300" : "text-orange-300";
                    return (
                      <div
                        key={i}
                        className={`text-xs ${esMio ? "text-right" : ""}`}
                      >
                        <span
                          className={`font-medium ${esMio ? "text-celeste-300" : colorEquipo}`}
                        >
                          {esMio ? "Vos" : m.jugadorNombre}:
                        </span>{" "}
                        <span className="text-white/90">{m.mensaje}</span>
                      </div>
                    );
                  })}
                {mensajesChat.filter((m) =>
                  chatTab === "general"
                    ? m.tipo === "general"
                    : m.tipo === "equipo",
                ).length === 0 && (
                  <div className="text-celeste-500/50 text-xs text-center py-4">
                    {chatTab === "equipo"
                      ? "Chat privado con tu equipo"
                      : "Sin mensajes aún"}
                  </div>
                )}
              </div>
              {/* Input */}
              <div className="p-2 border-t border-celeste-500/20 flex gap-2">
                <label htmlFor="chat-input" className="sr-only">Mensaje de chat</label>
                <input
                  id="chat-input"
                  type="text"
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnviarMensaje()}
                  placeholder={
                    chatTab === "equipo"
                      ? "Mensaje al equipo..."
                      : "Escribí un mensaje..."
                  }
                  className="flex-1 bg-celeste-900/50 border border-celeste-600/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder-celeste-500/50 focus:outline-none focus:border-celeste-500/50"
                  maxLength={200}
                />
                <button
                  onClick={handleEnviarMensaje}
                  disabled={!inputChat.trim() || enviadoChat}
                  aria-label="Enviar mensaje"
                  className="px-3 py-1.5 rounded-lg bg-celeste-600 hover:bg-celeste-500 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ➤
                </button>
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
              <span className="text-yellow-400/60 text-xs font-normal">
                (1v1 en malas)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Resultado de FLOR - Banner flotante (el anuncio individual sale como speech bubble sobre el avatar) */}
      {florResultado && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce-in">
          <div className="bg-gradient-to-r from-pink-700/90 to-purple-600/90 backdrop-blur-md rounded-xl px-6 py-3 shadow-lg shadow-pink-500/30 border border-pink-400/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆🌸</span>
              <div className="text-lg font-bold text-white">
                ¡Equipo {florResultado.ganador} gana +
                {florResultado.puntosGanados}!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Declaraciones de Envido - Banner flotante (no bloqueante) */}
      {envidoDeclaraciones.length > 0 && !envidoResultado && (
        <div className="fixed top-20 right-4 z-30 pointer-events-none animate-slide-down">
          <div className="bg-gradient-to-br from-purple-800/90 to-purple-900/90 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg shadow-purple-500/20 border border-purple-500/40 max-w-xs">
            <div className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2">
              <span>🎯</span> Declarando Envido
            </div>
            <div className="space-y-1">
              {envidoDeclaraciones.slice(-3).map((decl, i) => (
                <div
                  key={i}
                  className={`text-xs py-1 px-2 rounded ${
                    decl.equipo === 1
                      ? "bg-celeste-900/40 text-celeste-200"
                      : "bg-red-900/40 text-red-200"
                  }`}
                >
                  <span className="font-medium">{decl.jugadorNombre}:</span>
                  <span className="ml-1 text-white">
                    {decl.sonBuenas ? '"Son buenas..."' : `"${decl.puntos}"`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resultado del Envido - Banner flotante */}
      {envidoResultado && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce-in">
          <div className="bg-gradient-to-r from-green-700/90 to-emerald-600/90 backdrop-blur-md rounded-xl px-6 py-3 shadow-lg shadow-green-500/30 border border-green-400/40">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆🎯</span>
              <div>
                <div className="text-lg font-bold text-white">
                  ¡Equipo {envidoResultado.ganador} gana el envido!
                </div>
                <div className="text-sm text-green-200">
                  +{envidoResultado.puntosGanados} puntos
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating banner for end-of-round (non-blocking) - Estilo Rústico */}
      {rondaBanner && !mesa.winnerJuego && (
        <div className="fixed top-16 left-1/2 z-40 banner-flotante pointer-events-none">
          <div
            className={`rounded-2xl px-10 py-5 backdrop-blur-md border-2 shadow-2xl text-center boliche-panel esquina-decorativa ${
              rondaBanner.equipo === 1
                ? "border-celeste-500/50 shadow-celeste-500/30"
                : "border-red-500/50 shadow-red-500/30"
            }`}
          >
            {/* Decoración superior */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-wood-900 border border-gold-600/40">
              <span className="text-gold-400 text-xs font-bold uppercase tracking-wider">
                Ronda
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mb-2 titulo-rustico mt-2">
              {rondaBanner.mensaje}
            </div>
            <div className="separador-uy mb-2" />
            <div
              className={`text-lg font-bold ${
                rondaBanner.equipo === 1 ? "text-celeste-300" : "text-red-300"
              }`}
            >
              +{rondaBanner.puntos} puntos 🧉
            </div>

            {/* Muestra */}
            {rondaBanner.muestra &&
              ((rondaBanner.cartasFlor?.length ?? 0) > 0 ||
                (rondaBanner.cartasEnvido?.length ?? 0) > 0) && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-yellow-400/70 text-xs font-medium">
                    Muestra:
                  </span>
                  <div className="w-10 h-[3.75rem] rounded-lg overflow-hidden shadow-lg border border-yellow-500/50 relative">
                    <Image
                      src={getCartaImageUrl(rondaBanner.muestra)}
                      alt="Muestra"
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

            {/* Mostrar cartas de FLOR al final de la ronda */}
            {rondaBanner.cartasFlor && rondaBanner.cartasFlor.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gold-600/30">
                <div className="text-pink-400 text-sm font-bold mb-2">
                  🌸 FLOR:
                </div>
                <div className="flex flex-col gap-3">
                  {rondaBanner.cartasFlor.map((florInfo, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-gold-300 text-xs font-semibold">
                        {florInfo.jugadorNombre}
                      </span>
                      <div className="flex gap-1.5 justify-center">
                        {florInfo.cartas.map((carta, cIdx) => (
                          <div
                            key={cIdx}
                            className="w-12 h-[4.5rem] rounded-lg overflow-hidden shadow-lg border border-gold-600/30 relative"
                          >
                            <Image
                              src={getCartaImageUrl(carta)}
                              alt={`${carta.valor} de ${carta.palo}`}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mostrar cartas del ENVIDO ganador al final de la ronda */}
            {rondaBanner.cartasEnvido &&
              rondaBanner.cartasEnvido.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gold-600/30">
                  <div className="text-purple-400 text-sm font-bold mb-2">
                    🎯 ENVIDO:
                  </div>
                  <div className="flex flex-col gap-3">
                    {rondaBanner.cartasEnvido.map((envidoInfo, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-1"
                      >
                        <span className="text-gold-300 text-xs font-semibold">
                          {envidoInfo.jugadorNombre} ({envidoInfo.puntos} pts)
                        </span>
                        <div className="flex gap-1.5 justify-center">
                          {envidoInfo.cartas.map((carta, cIdx) => (
                            <div
                              key={cIdx}
                              className="w-12 h-[4.5rem] rounded-lg overflow-hidden shadow-lg border border-gold-600/30 relative"
                            >
                              <Image
                                src={getCartaImageUrl(carta)}
                                alt={`${carta.valor} de ${carta.palo}`}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
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
            {/* Corona de trofeo con Sol de Mayo */}
            <div className="relative mb-4">
              <div className="text-5xl brillo-dorado">🏆</div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl animate-pulse">
                ☀️
              </div>
            </div>

            <p className="text-3xl font-bold text-gold-300 mb-2 titulo-rustico">
              ¡Equipo {mesa.winnerJuego} gana!
            </p>

            <div className="separador-uy my-4" />

            <div className="flex justify-center gap-6 mb-6">
              <div
                className={`px-4 py-2 rounded-lg ${mesa.winnerJuego === 1 ? "bg-celeste-600/30 border border-celeste-500/50" : "bg-wood-800/50 border border-gold-800/30"}`}
              >
                <div className="text-xs text-gold-500/60 uppercase">
                  Equipo 1
                </div>
                <div
                  className={`text-2xl font-bold ${mesa.winnerJuego === 1 ? "text-celeste-300" : "text-gold-400/70"}`}
                >
                  {mesa.equipos[0].puntaje}
                </div>
              </div>
              <div className="text-gold-600/50 self-center text-xl">vs</div>
              <div
                className={`px-4 py-2 rounded-lg ${mesa.winnerJuego === 2 ? "bg-red-600/30 border border-red-500/50" : "bg-wood-800/50 border border-gold-800/30"}`}
              >
                <div className="text-xs text-gold-500/60 uppercase">
                  Equipo 2
                </div>
                <div
                  className={`text-2xl font-bold ${mesa.winnerJuego === 2 ? "text-red-300" : "text-gold-400/70"}`}
                >
                  {mesa.equipos[1].puntaje}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {esAnfitrion() && (
                <>
                  <button
                    onClick={handleRevancha}
                    disabled={loading}
                    className="btn-primary btn-campo text-white py-3 px-8 rounded-xl text-lg font-bold w-full"
                  >
                    🔄 Revancha Directa
                  </button>
                  <button
                    onClick={handleTirarReyes}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 py-3 px-8 rounded-xl font-bold bg-gradient-to-r from-amber-700 to-amber-600 text-white hover:from-amber-600 hover:to-amber-500 transition-all w-full btn-campo"
                  >
                    👑 Tirar Reyes (mezclar equipos)
                  </button>
                </>
              )}
              {!esAnfitrion() && (
                <p className="text-gold-500/60 text-sm italic mb-2">
                  🧉 Esperando al anfitrión...
                </p>
              )}
              <button
                onClick={() => (window.location.href = "/lobby")}
                className="py-3 px-8 rounded-xl font-medium glass text-gold-300/70 hover:text-gold-200 hover:bg-white/5 border border-gold-800/30 w-full btn-campo"
              >
                🚪 Salir al Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col">
        {/* Header: Marcadores - Estilo Rústico */}
        <div className="flex justify-between items-stretch gap-2 sm:gap-3 mb-1 sm:mb-2">
          <ScoreBoard
            equipo={1}
            puntos={mesa.equipos[0].puntaje}
            isMyTeam={miEquipo === 1}
          />

          {/* Info central - Panel Boliche */}
          <div className="flex-1 flex flex-col items-center justify-center boliche-panel rounded-xl px-2 sm:px-3 py-1.5 border-gold-700/30 relative">
            {/* Control de audio - esquina izquierda */}
            <div className="absolute -top-1 -left-1 flex items-center gap-1 z-20">
              <button
                onClick={() => {
                  const m = !muted;
                  audioManager.setMuted(m);
                  setMuted(m);
                }}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="text-[13px] opacity-50 hover:opacity-90 transition-opacity px-1 py-0.5"
                title={muted ? "Activar sonido" : "Silenciar todo"}
              >
                {muted ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold-400/60"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gold-400/80"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>
              {showVolumeSlider && !muted && (
                <div
                  className="flex items-center gap-1 bg-wood-900/90 border border-gold-700/30 rounded-lg px-2 py-1 shadow-lg"
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(volume * 100)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) / 100;
                      audioManager.setVolume(v);
                      setVolume(v);
                    }}
                    className="w-20 h-1 accent-gold-500 cursor-pointer"
                    title={`Volumen: ${Math.round(volume * 100)}%`}
                  />
                  <span className="text-[9px] text-gold-400/60 min-w-[24px] text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Botón abandonar partida - visible para todos */}
            {mesa.estado === "jugando" && (
              <button
                onClick={handleTerminarPartida}
                disabled={loading}
                className="absolute -top-1 -right-1 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-red-900/80 hover:bg-red-700 border border-red-500/50 text-red-300 hover:text-white transition-all disabled:opacity-50 shadow-lg"
                title="Abandonar partida (tu equipo pierde)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}

            <div className="text-gold-400/70 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
              Mano {mesa.manoActual}/3
            </div>
            {mesa.puntosEnJuego > 1 && (
              <div className="text-gold-300 font-bold text-xs sm:text-sm titulo-rustico">
                {mesa.nivelGritoAceptado
                  ? getNombreGrito(mesa.nivelGritoAceptado)
                  : ""}{" "}
                ({mesa.puntosEnJuego} pts)
              </div>
            )}
            {/* Indicadores de manos ganadas - Estilo fósforos */}
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((m) => {
                const ganador = mesa.ganadoresManos[m - 1];
                return (
                  <div
                    key={m}
                    className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                      ganador === null
                        ? "bg-gray-500/80 border-gray-400/60 shadow-inner"
                        : ganador === 1
                          ? "bg-celeste-500 border-celeste-400 shadow-lg shadow-celeste-500/40"
                          : ganador === 2
                            ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/40"
                            : "border-gold-700/40 bg-wood-800/50"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <ScoreBoard
            equipo={2}
            puntos={mesa.equipos[1].puntaje}
            isMyTeam={miEquipo === 2}
          />
        </div>

        {/* Sub-marcador Pico a Pico */}
        {mesa.modoRondaActual === "1v1" && (
          <div className="flex justify-center mb-1">
            <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1 flex items-center gap-2 border border-gold-600/30">
              <span className="text-[10px] text-gold-400 uppercase tracking-wider font-medium">
                Pico a Pico
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((cruceIndex) => {
                  const ganador = mesa.ganadoresCrucesPicoAPico?.[cruceIndex];
                  const esCruceActual =
                    (mesa.duellosPicoAPicoJugados || 0) === cruceIndex;
                  return (
                    <div
                      key={cruceIndex}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        ganador === 1
                          ? "bg-celeste-500 text-white"
                          : ganador === 2
                            ? "bg-red-500 text-white"
                            : esCruceActual
                              ? "bg-gold-500/50 text-gold-200 ring-2 ring-gold-400 animate-pulse"
                              : "bg-gray-600/50 text-gray-400"
                      }`}
                      title={`Cruce ${cruceIndex + 1}${ganador ? ` - Ganó Equipo ${ganador}` : esCruceActual ? " (En curso)" : ""}`}
                    >
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
          {/* Top row players (opponents in 1v1, teammate in 2v2, TL-TC-TR in 3v3) */}
          <div className="flex justify-center gap-3 sm:gap-6 mb-1 sm:mb-2">
            {topRowPlayers.map((j) => renderPlayerIndicator(j))}
          </div>
          {/* Mesa with optional side players */}
          <div className="flex-1 flex flex-row items-stretch gap-1 sm:gap-2">
            {/* Left side player (rival in 2v2/3v3) */}
            {leftSidePlayer && (
              <div className="flex flex-col items-center justify-center w-16 sm:w-24">
                {renderPlayerIndicator(leftSidePlayer)}
              </div>
            )}

            {/* Mesa central con fieltro */}
            <div
              className="flex-1 mesa-flat wood-border rounded-[2rem] sm:rounded-[3rem] p-3 sm:p-4 relative flex flex-col justify-center items-center min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"
              style={temaActivo?.felt ? { backgroundColor: temaActivo.felt } : undefined}
            >
              {/* Luz de lámpara */}
              <div className="lampara-glow" />
              <div className="pulperia-light rounded-[2rem] sm:rounded-[3rem]" />
              {/* Highlight del fieltro según tema */}
              {temaActivo?.feltLight && (
                <div
                  className="absolute inset-0 rounded-[2rem] sm:rounded-[3rem] pointer-events-none z-0"
                  style={{ background: `radial-gradient(ellipse at 50% 50%, ${temaActivo.feltLight} 0%, transparent 70%)` }}
                />
              )}

              {/* Muestra y Mazo - en el centro de la mesa (tamaño reducido en mobile) */}
              {mesa.muestra && mesa.fase !== "cortando" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5 flex flex-row items-center gap-2 sm:gap-4">
                  {/* Mazo (dorso) - a la izquierda */}
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] sm:text-[10px] lg:text-xs text-gold-400/40 font-medium mb-1 uppercase tracking-wider">
                      Mazo
                    </div>
                    <div className="relative">
                      <div className="w-10 h-[3.75rem] sm:w-14 sm:h-[5.25rem] lg:w-16 lg:h-24 card-back rounded-lg shadow-lg" style={getCardBackStyle()} />
                    </div>
                  </div>
                  {/* Muestra - a la derecha */}
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] sm:text-[10px] lg:text-[11px] text-gold-400/60 font-medium mb-1 uppercase tracking-wider">
                      Muestra
                    </div>
                    <div className="relative muestra-highlight">
                      <div className="absolute -inset-1.5 sm:-inset-2 bg-gold-500/30 rounded-xl blur-lg animate-pulse" />
                      <div className="absolute -inset-1 sm:-inset-1 border-2 border-gold-400/40 rounded-lg" />
                      <CartaImg carta={mesa.muestra} size="normal" />
                    </div>
                  </div>
                </div>
              )}

              {/* Phase: Repartiendo - show dealing animation */}
              {(mesa.fase === "repartiendo" || isDealing) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center z-20"
                  style={{ perspective: "1200px" }}
                >
                  <div className="text-gold-400 font-bold text-lg sm:text-xl mb-4 animate-pulse drop-shadow-lg">
                    🃏 Repartiendo cartas... 🃏
                  </div>

                  {/* Mazo central grande desde donde salen las cartas */}
                  <div
                    className="relative"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Stack effect - multiple backs con efecto 3D */}
                    <div
                      className="absolute -top-2 -left-1 w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg opacity-50"
                      style={{ transform: "translateZ(-6px)", ...getCardBackStyle() }}
                    />
                    <div
                      className="absolute -top-1 -left-0.5 w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg opacity-70"
                      style={{ transform: "translateZ(-3px)", ...getCardBackStyle() }}
                    />
                    <div
                      className={`relative w-16 h-24 sm:w-20 sm:h-32 card-back rounded-lg shadow-2xl ${dealingCards.length > 0 ? "mazo-dealing" : ""}`}
                      style={getCardBackStyle()}
                    />

                    {/* Cartas volando hacia cada jugador - trayectoria extendida con perspectiva */}
                    {dealingCards.map((deal, idx) => {
                      const jugadorIndex = deal.jugadorIndex;
                      const miIndex = mesa.jugadores.findIndex(
                        (j) => j.id === socketId,
                      );
                      const isMe = jugadorIndex === miIndex;

                      // Calcular destino extendido hacia el perímetro de la mesa
                      let targetX = 0;
                      let targetY = 0;
                      let rotation = 0;
                      let spinY = 0; // Rotación 3D en eje Y
                      const scaleMid = 0.95;
                      let scaleEnd = 0.75;

                      if (isMe) {
                        // Hacia abajo (mis cartas) - trayectoria larga hacia el borde inferior
                        targetY = 320; // Extendido
                        targetX = (deal.cartaIndex - 1) * 60;
                        rotation = (deal.cartaIndex - 1) * 3; // Ligera rotación por carta
                        spinY = -5;
                        scaleEnd = 0.7;
                      } else {
                        // Hacia arriba/lados (oponentes) - distribuir en arco amplio
                        const oponentesOrdenados = mesa.jugadores.filter(
                          (_, i) => i !== miIndex,
                        );
                        const oponenteIndex = oponentesOrdenados.findIndex(
                          (j) => {
                            const realIndex = mesa.jugadores.findIndex(
                              (p) => p.id === j.id,
                            );
                            return realIndex === jugadorIndex;
                          },
                        );
                        const numOponentes = oponentesOrdenados.length;

                        if (numOponentes === 1) {
                          // Solo un oponente - arriba centro con trayectoria extendida
                          targetX = (deal.cartaIndex - 1) * 50;
                          targetY = -300;
                          rotation = (deal.cartaIndex - 1) * -2;
                          spinY = 5;
                          scaleEnd = 0.6; // Más pequeño en la distancia
                        } else {
                          // Múltiples oponentes - distribuir en arco extendido
                          const angle =
                            (oponenteIndex / (numOponentes - 1) - 0.5) *
                            Math.PI *
                            0.9;
                          targetX =
                            Math.sin(angle) * 350 + (deal.cartaIndex - 1) * 35;
                          targetY = -Math.cos(angle) * 280 - 60;
                          rotation = angle * 15 + (deal.cartaIndex - 1) * 2;
                          spinY = Math.sin(angle) * 10;
                          scaleEnd = 0.55;
                        }
                      }

                      // Timing secuencial: 0.85s por carta con 150ms de delay entre cada una
                      const duration = 0.85; // segundos
                      const delay = idx * 150; // milisegundos entre cartas

                      return (
                        <div
                          key={`deal-${idx}`}
                          className="absolute top-0 left-0 w-14 h-20 sm:w-16 sm:h-24 card-back rounded-lg shadow-xl animate-deal-card dealing-card"
                          style={
                            {
                              ...getCardBackStyle(),
                              "--deal-x": `${targetX}px`,
                              "--deal-y": `${targetY}px`,
                              "--deal-rotation": `${rotation}deg`,
                              "--deal-spin": `${spinY}deg`,
                              "--deal-scale-mid": scaleMid,
                              "--deal-scale-end": scaleEnd,
                              "--deal-duration": `${duration}s`,
                              "--deal-delay": `${delay}ms`,
                            } as React.CSSProperties
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Indicador de progreso mejorado */}
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="text-gold-500/70 text-xs font-medium">
                      Vuelta{" "}
                      {Math.floor(dealingCards.length / mesa.jugadores.length) +
                        1}{" "}
                      de 3
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((v) => (
                        <div
                          key={v}
                          className={`w-4 h-4 rounded-full transition-all duration-500 ${
                            Math.floor(
                              dealingCards.length / mesa.jugadores.length,
                            ) >= v
                              ? "bg-gradient-to-br from-gold-300 to-gold-500 shadow-lg shadow-gold-500/50 scale-110"
                              : "bg-gold-900/40 border border-gold-700/30"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-gold-600/40 text-xs">
                      {dealingCards.length} / {mesa.jugadores.length * 3} cartas
                    </div>
                  </div>
                </div>
              )}

              {/* Phase: Cortando - show deck to cut */}
              {mesa.fase === "cortando" && mesa.esperandoCorte && (
                <div className="relative z-10">
                  <MazoCorte
                    onCorte={handleRealizarCorte}
                    esperandoCorte={true}
                    esMiTurnoCorte={esMiTurnoDeCortar()}
                  />

                  {/* Botón Echar los Perros - solo visible si cumple condiciones */}
                  {puedeEcharPerros() && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleEcharPerros}
                        disabled={loading}
                        className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-700 to-red-700 text-white hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 flex items-center gap-2"
                        title="Contra Flor al Resto + Falta Envido + Truco"
                      >
                        🐕 Echar los Perros
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Modal de responder a los Perros - solo después de repartir */}
              {perrosActivos &&
                equipoPerros !== miEquipo &&
                mesa?.fase === "esperando_respuesta_perros" && (
                  <PerrosResponseModal
                    tengoFlor={tengoFlor()}
                    loading={loading}
                    onResponder={handleResponderPerros}
                    misCartas={misCartas()}
                    muestra={mesa?.muestra || null}
                  />
                )}

              {/* Indicador de que echaste los perros - mientras se espera respuesta */}
              {perrosActivos &&
                equipoPerros === miEquipo &&
                mesa?.fase === "esperando_respuesta_perros" && (
                  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-pulse">
                    <div className="glass rounded-xl px-6 py-3 border border-orange-500/50 flex items-center gap-3">
                      <span className="text-2xl">🐕</span>
                      <span className="text-orange-300 font-bold">
                        ¡Echaste los Perros!
                      </span>
                      <span className="text-gold-400/70 text-sm">
                        Esperando respuesta...
                      </span>
                    </div>
                  </div>
                )}

              {/* Indicador de perros echados - antes de repartir */}
              {perrosActivos && mesa?.fase === "cortando" && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-pulse">
                  <div className="glass rounded-xl px-6 py-3 border border-orange-500/50 flex items-center gap-3">
                    <span className="text-2xl">🐕</span>
                    <span className="text-orange-300 font-bold">
                      ¡Perros echados!
                    </span>
                    <span className="text-gold-400/70 text-sm">
                      Esperando corte y reparto...
                    </span>
                    {equipoPerros === miEquipo && (
                      <button
                        onClick={handleCancelarPerros}
                        disabled={loading}
                        className="ml-2 px-3 py-1 rounded-lg text-sm font-bold bg-red-600/80 text-white hover:bg-red-500 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Phase: Jugando - show played cards near each player position */}
              {mesa.fase !== "cortando" && (
                <>
                  {/* Cartas jugadas - posicionadas cerca de cada jugador */}
                  {cartasManoActual.map((jugada, i) => {
                    const esMiCarta = jugada.jugadorId === socketId;

                    // Check if this card is the winner of the current mano
                    // Usar inicioMano del servidor
                    const realIndex = inicioMano + i;
                    const numParticipantesActuales = mesa.jugadores.filter(
                      (j: Jugador) => j.participaRonda !== false && !j.seVaAlMazo,
                    ).length;
                    const esCartaGanadora =
                      mesa.cartaGanadoraMano &&
                      mesa.cartaGanadoraMano.indexEnMesa === realIndex &&
                      cartasManoActual.length === numParticipantesActuales;

                    // Calcular posición basada en el slot del jugador
                    let posicionStyle: React.CSSProperties = {};

                    if (esMiCarta) {
                      // Mi carta: abajo, alineada a la izquierda del centro (cerca del mazo)
                      posicionStyle = {
                        position: "absolute",
                        bottom: "5%",
                        left: "46.5%",
                        transform: "translateX(-50%)",
                        zIndex: esCartaGanadora ? 50 : 15 + i,
                      };
                    } else {
                      // Cartas de otros jugadores - distribuidas alrededor del mazo sin pisarlo
                      const slot = getSlotForPlayer(jugada.jugadorId);
                      const z = esCartaGanadora ? 50 : 15 + i;

                      switch (slot) {
                        case "top": // 1v1 opponent or 2v2 teammate - arriba, alineada a la izquierda del centro
                          posicionStyle = {
                            position: "absolute",
                            top: "5%",
                            left: "46.5%",
                            transform: "translateX(-50%)",
                            zIndex: z,
                          };
                          break;
                        case "left": // 2v2 rival left - a la altura del mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "40%",
                            left: "27%",
                            transform: "translate(-50%, -50%)",
                            zIndex: z,
                          };
                          break;
                        case "right": // 2v2 rival right - a la altura del mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "40%",
                            right: "27%",
                            transform: "translate(50%, -50%)",
                            zIndex: z,
                          };
                          break;
                        case "side-left": // 3v3 rival at my left - a la altura del mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "43%",
                            left: "8%",
                            transform: "translateY(-50%)",
                            zIndex: z,
                          };
                          break;
                        case "top-left": // 3v3 teammate top-left - arriba sin pisar mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "10%",
                            left: "20%",
                            zIndex: z,
                          };
                          break;
                        case "top-center": // 3v3 rival top-center - arriba sin pisar mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "10%",
                            left: "47%",
                            transform: "translateX(-50%)",
                            zIndex: z,
                          };
                          break;
                        case "top-right": // 3v3 teammate top-right - arriba sin pisar mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "10%",
                            right: "20%",
                            zIndex: z,
                          };
                          break;
                        case "side-right": // 3v3 rival at my right - a la altura del mazo
                          posicionStyle = {
                            position: "absolute",
                            top: "43%",
                            right: "8%",
                            transform: "translateY(-50%)",
                            zIndex: z,
                          };
                          break;
                      }
                    }

                    return (
                      <div
                        key={i}
                        className={`text-center card-played-anim ${esCartaGanadora ? "card-winner card-winner-glow" : ""}`}
                        style={{
                          ...posicionStyle,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      >
                        <CartaImg
                          carta={jugada.carta}
                          size="normal"
                          showGlow={!!esCartaGanadora}
                        />
                        {esCartaGanadora && (
                          <div className="text-[10px] sm:text-xs mt-1 font-bold text-yellow-400">
                            🏆
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cartasManoActual.length === 0 &&
                    mesa.estado === "jugando" &&
                    mesa.fase === "jugando" && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-green-300/40 text-sm">
                          Esperando cartas...
                        </div>
                      </div>
                    )}
                </>
              )}

              {/* Indicador de turno */}
              {mesa.estado === "jugando" &&
                mesa.fase === "jugando" &&
                !mesa.gritoActivo &&
                !mesa.envidoActivo && (
                  <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20">
                    <div
                      className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full ${
                        esMiTurno()
                          ? "bg-gold-500 text-wood-950 turn-indicator"
                          : "bg-black/40 text-white/70"
                      }`}
                    >
                      {esMiTurno()
                        ? "¡Tu turno!"
                        : `Turno: ${jugadorDelTurno?.nombre}`}
                    </div>
                  </div>
                )}
            </div>

            {/* Right side player (rival in 2v2/3v3) */}
            {rightSidePlayer && (
              <div className="flex flex-col items-center justify-center w-16 sm:w-24">
                {renderPlayerIndicator(rightSidePlayer)}
              </div>
            )}
          </div>{" "}
          {/* close flex-row wrapper for side players */}
          {/* Wrapper para paneles de respuesta - flotan en mobile para no tapar las cartas */}
          <div className="fixed inset-x-0 bottom-[155px] z-30 px-3 sm:static sm:inset-auto sm:bottom-auto sm:z-auto sm:px-0">
            {/* Preview compacto de mis cartas cuando hay panel de respuesta activo */}
            {((deboResponderGrito() && mesa.gritoActivo) ||
              (deboResponderEnvido() && mesa.envidoActivo) ||
              (florPendiente && miEquipo === florPendiente.equipoQueResponde && tengoFlor())) &&
              misCartas().length > 0 && (
                <div className="flex justify-center items-center gap-1.5 sm:gap-2 mb-1.5">
                  <span className="text-gold-500/50 text-xs hidden sm:inline">Tus cartas:</span>
                  {misCartas().map((carta, index) => (
                    <CartaImg
                      key={`preview-${carta.palo}-${carta.valor}-${index}`}
                      carta={carta}
                      size="small"
                    />
                  ))}
                </div>
              )}
            {/* Panel de respuesta a Truco */}
            {deboResponderGrito() && mesa.gritoActivo && (
              <div className="glass-gold rounded-xl p-3 my-1.5 text-center border border-gold-600/40 animate-slide-up">
                <p className="text-base font-bold text-gold-300 mb-2">
                  {
                    mesa.jugadores.find(
                      (j) => j.id === mesa.gritoActivo!.jugadorQueGrita,
                    )?.nombre
                  }{" "}
                  cantó {getNombreGrito(mesa.gritoActivo.tipo)}
                </p>
                <div className="flex justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleResponderTruco(true)}
                    disabled={loading}
                    className="btn-quiero text-white"
                  >
                    ¡QUIERO!
                  </button>
                  <button
                    onClick={() => handleResponderTruco(false)}
                    disabled={loading}
                    className="btn-no-quiero text-white"
                  >
                    NO QUIERO
                  </button>
                  {mesa.gritoActivo.tipo === "truco" && (
                    <button
                      onClick={() => handleResponderTruco(true, "retruco")}
                      disabled={loading}
                      className="btn-truco text-white"
                    >
                      QUIERO RETRUCO
                    </button>
                  )}
                  {mesa.gritoActivo.tipo === "retruco" && (
                    <button
                      onClick={() => handleResponderTruco(true, "vale4")}
                      disabled={loading}
                      className="btn-truco text-white"
                    >
                      QUIERO VALE 4
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Panel de respuesta a Envido */}
            {deboResponderEnvido() &&
              mesa.envidoActivo &&
              (() => {
                // Verificar si algún compañero ya aceptó el envido
                const compañeroYaAcepto =
                  mesa.respuestasEnvido &&
                  Object.entries(mesa.respuestasEnvido).some(
                    ([id, resp]) =>
                      resp === true &&
                      id !== socketId &&
                      mesa.jugadores.find((j) => j.id === id)?.equipo ===
                        miEquipo,
                  );
                // Determinar nivel del último envido cantado para filtrar opciones
                const ultimoTipo =
                  mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1];
                const tieneRealEnvido =
                  mesa.envidoActivo.tipos.includes("real_envido");
                const tieneFaltaEnvido =
                  mesa.envidoActivo.tipos.includes("falta_envido");
                const tieneEnvidoCargado = mesa.envidoActivo.tipos.some(
                  (t: string) => t.startsWith("cargado_"),
                );
                // No mostrar opciones menores a lo ya cantado
                const mostrarEnvido =
                  ultimoTipo === "envido" &&
                  !tieneRealEnvido &&
                  !tieneFaltaEnvido &&
                  !tieneEnvidoCargado;
                const mostrarRealEnvido =
                  !tieneRealEnvido && !tieneFaltaEnvido && !tieneEnvidoCargado;
                const mostrarFaltaEnvido = !tieneFaltaEnvido;

                return (
                  <div className="glass rounded-xl p-3 my-1.5 text-center border border-purple-600/40 animate-slide-up">
                    <p className="text-base font-bold text-purple-300 mb-1">
                      {
                        mesa.jugadores.find(
                          (j) => j.id === mesa.envidoActivo!.jugadorQueCanta,
                        )?.nombre
                      }{" "}
                      cantó{" "}
                      {getNombreEnvido(
                        mesa.envidoActivo.tipos[
                          mesa.envidoActivo.tipos.length - 1
                        ],
                      )}
                    </p>
                    <p className="text-sm text-purple-400/70 mb-3">
                      En juego: {mesa.envidoActivo.puntosAcumulados} pts
                    </p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleResponderEnvido(true)}
                        disabled={loading}
                        className="btn-quiero text-white"
                      >
                        ¡QUIERO!
                      </button>
                      {/* Ocultar NO QUIERO si un compañero ya aceptó */}
                      {!compañeroYaAcepto && (
                        <button
                          onClick={() => handleResponderEnvido(false)}
                          disabled={loading}
                          className="btn-no-quiero text-white"
                        >
                          NO QUIERO
                        </button>
                      )}
                      {/* Opciones de escalación: solo mostrar las superiores a lo ya cantado */}
                      {mostrarEnvido && (
                        <button
                          onClick={() => handleCantarEnvido("envido")}
                          disabled={loading}
                          className="btn-envido text-white"
                        >
                          Envido
                        </button>
                      )}
                      {mostrarRealEnvido && (
                        <button
                          onClick={() => handleCantarEnvido("real_envido")}
                          disabled={loading}
                          className="btn-envido text-white"
                        >
                          Real Envido
                        </button>
                      )}
                      {mostrarFaltaEnvido && (
                        <button
                          onClick={() => handleCantarEnvido("falta_envido")}
                          disabled={loading}
                          className="btn-envido text-white"
                        >
                          Falta Envido
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Panel de respuesta a Flor */}
            {florPendiente &&
              miEquipo === florPendiente.equipoQueResponde &&
              tengoFlor() &&
              (() => {
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
                    <p className="text-base font-bold text-pink-300 mb-1">
                      {titulo}
                    </p>
                    <p className="text-sm text-pink-400/70 mb-3">{subtitulo}</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleResponderFlor("quiero")}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 transition-all shadow-lg"
                      >
                        {esContraFlor || esConFlorEnvido
                          ? "¡QUIERO!"
                          : "FLOR (Achicarse)"}
                      </button>
                      <button
                        onClick={() => handleResponderFlor("no_quiero")}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-gray-600 to-gray-500 text-white hover:from-gray-500 hover:to-gray-400 transition-all shadow-lg"
                      >
                        NO QUIERO
                      </button>
                      {/* Solo mostrar escalación si no es ya contra flor al resto */}
                      {!esContraFlor && (
                        <>
                          {!esConFlorEnvido && (
                            <button
                              onClick={() =>
                                handleResponderFlor("con_flor_envido")
                              }
                              disabled={loading}
                              className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-purple-600 to-celeste-500 text-white hover:from-purple-500 hover:to-celeste-400 transition-all shadow-lg"
                            >
                              CON FLOR ENVIDO
                            </button>
                          )}
                          <button
                            onClick={() => handleResponderFlor("contra_flor")}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-pink-600 to-red-600 text-white hover:from-pink-500 hover:to-red-500 transition-all shadow-lg"
                          >
                            CONTRA FLOR AL RESTO
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>{" "}
          {/* close wrapper paneles de respuesta */}
          {/* Las declaraciones de envido ahora se muestran como banner flotante arriba */}
          {/* Modal de Envido Cargado */}
          {mostrarEnvidoCargado && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass rounded-2xl p-6 max-w-sm w-full border border-purple-600/50 animate-slide-up">
                <h3 className="text-xl font-bold text-purple-300 text-center mb-2">
                  🎯 Envido Cargado
                </h3>
                <p className="text-gold-400/70 text-sm text-center mb-4">
                  ¿Cuántos puntos querés apostar?
                </p>

                <div className="flex items-center justify-center gap-4 mb-6">
                  <button
                    onClick={() =>
                      setPuntosEnvidoCargado(
                        Math.max(1, puntosEnvidoCargado - 1),
                      )
                    }
                    className="w-12 h-12 rounded-full bg-purple-800/50 text-purple-300 text-2xl font-bold hover:bg-purple-700/50 transition-all"
                  >
                    -
                  </button>
                  <div className="w-20 h-16 flex items-center justify-center rounded-xl bg-purple-900/50 border-2 border-purple-500/50">
                    <span className="text-3xl font-bold text-white">
                      {puntosEnvidoCargado}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setPuntosEnvidoCargado(
                        Math.min(99, puntosEnvidoCargado + 1),
                      )
                    }
                    className="w-12 h-12 rounded-full bg-purple-800/50 text-purple-300 text-2xl font-bold hover:bg-purple-700/50 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Presets rápidos */}
                <div className="flex justify-center gap-2 mb-6">
                  {[5, 10, 15, 20].map((pts) => (
                    <button
                      key={pts}
                      onClick={() => setPuntosEnvidoCargado(pts)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        puntosEnvidoCargado === pts
                          ? "bg-purple-600 text-white"
                          : "bg-purple-900/30 text-purple-300 hover:bg-purple-800/40"
                      }`}
                    >
                      {pts}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setMostrarEnvidoCargado(false)}
                    className="flex-1 py-3 rounded-xl font-bold bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCantarEnvidoCargado}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-400 transition-all disabled:opacity-50"
                  >
                    ¡Apostar {puntosEnvidoCargado} puntos!
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Mis cartas y controles */}
          <div className="glass rounded-xl p-2 sm:p-3 mt-1 relative z-10 border border-gold-800/20">
            {/* Modo espectador: se fue al mazo */}
            {meFuiAlMazo && mesa.estado === "jugando" && (
              <div className="flex items-center justify-center gap-2 py-4 text-gold-500/60">
                <span className="text-lg">👀</span>
                <span className="text-sm font-medium">Te fuiste al mazo — mirando la ronda</span>
              </div>
            )}

            {/* Bocadillo de diálogo para mí */}
            {socketId &&
              speechBubbles.find((b) => b.jugadorId === socketId) &&
              (() => {
                const bubble = speechBubbles.find(
                  (b) => b.jugadorId === socketId,
                )!;
                return (
                  <div
                    className={`absolute -top-14 left-1/2 z-50 speech-bubble speech-bubble-up ${
                      bubble.tipo === "envido"
                        ? "speech-bubble-envido"
                        : bubble.tipo === "flor"
                          ? "speech-bubble-flor"
                          : bubble.tipo === "truco"
                            ? "speech-bubble-truco"
                            : bubble.tipo === "quiero"
                              ? "speech-bubble-quiero"
                              : bubble.tipo === "no-quiero"
                                ? "speech-bubble-no-quiero"
                                : ""
                    }`}
                  >
                    {bubble.puntos !== undefined &&
                    bubble.puntos !== null &&
                    bubble.tipo !== "flor" ? (
                      <span className="bubble-number text-2xl font-bold">
                        {bubble.puntos}
                      </span>
                    ) : (
                      <span className="font-bold text-sm whitespace-nowrap">
                        {bubble.texto}
                      </span>
                    )}
                  </div>
                );
              })()}

            {/* Barra superior con info y botones de cantos */}
            {!meFuiAlMazo && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
              <div
                className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${
                  miEquipo === 1 ? "equipo-1 text-white" : "equipo-2 text-white"
                }`}
              >
                {miJugador?.avatarUrl ? (
                  <Image
                    src={miJugador.avatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full object-cover border border-gold-600/50"
                    unoptimized
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold text-[10px]">
                    {miJugador?.nombre[0]?.toUpperCase()}
                  </span>
                )}
                {miJugador?.nombre}
                {miJugador?.esMano && <MonedaMano isActive={true} />}
              </div>

              {/* Botones de cantos - Solo activos cuando es tu turno o puedes responder */}
              <div className="flex gap-2 flex-wrap items-center">
                {/* Indicador de FLOR - La flor se canta automáticamente cuando alguien dice envido */}
                {tengoFlor() && !mesa.florYaCantada && (
                  <div
                    className="btn-flor text-white text-xs sm:text-sm animate-pulse cursor-default"
                    title="¡Tenés FLOR! Se cantará automáticamente si alguien dice envido"
                  >
                    🌸 FLOR
                  </div>
                )}
                {puedoCantarEnvido() &&
                  !mesa.envidoActivo &&
                  !mesa.florYaCantada && (
                    <>
                      <button
                        onClick={() => handleCantarEnvido("envido")}
                        disabled={loading || !esMiTurno()}
                        className={`btn-envido text-white text-xs sm:text-sm ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={
                          !esMiTurno() ? "Esperá tu turno" : "Cantar Envido"
                        }
                      >
                        Envido
                      </button>
                      <button
                        onClick={() => handleCantarEnvido("real_envido")}
                        disabled={loading || !esMiTurno()}
                        className={`btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={
                          !esMiTurno()
                            ? "Esperá tu turno"
                            : "Cantar Real Envido"
                        }
                      >
                        Real Envido
                      </button>
                      <button
                        onClick={() => handleCantarEnvido("falta_envido")}
                        disabled={loading || !esMiTurno()}
                        className={`btn-envido text-white text-xs sm:text-sm hidden sm:inline-flex ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={
                          !esMiTurno()
                            ? "Esperá tu turno"
                            : "Cantar Falta Envido"
                        }
                      >
                        Falta Envido
                      </button>
                      {/* Botón para envido cargado personalizado */}
                      <button
                        onClick={() => setMostrarEnvidoCargado(true)}
                        disabled={loading || !esMiTurno()}
                        className={`btn-envido text-white text-xs sm:text-sm bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={
                          !esMiTurno()
                            ? "Esperá tu turno"
                            : "Envido Cargado - Elegí cuántos puntos apostar"
                        }
                      >
                        <span className="hidden sm:inline">Envido Cargado</span>
                        <span className="sm:hidden">E. Cargado</span>
                      </button>
                    </>
                  )}
                {puedoCantarTruco() && (
                  <button
                    onClick={() => handleCantarTruco("truco")}
                    disabled={loading || !esMiTurno()}
                    className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={!esMiTurno() ? "Esperá tu turno" : "Cantar Truco"}
                  >
                    Truco
                  </button>
                )}
                {puedoCantarRetruco() && (
                  <button
                    onClick={() => handleCantarTruco("retruco")}
                    disabled={loading || !esMiTurno()}
                    className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={!esMiTurno() ? "Esperá tu turno" : "Cantar Retruco"}
                  >
                    Retruco
                  </button>
                )}
                {puedoCantarVale4() && (
                  <button
                    onClick={() => handleCantarTruco("vale4")}
                    disabled={loading || !esMiTurno()}
                    className={`btn-truco text-white ${!esMiTurno() ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={!esMiTurno() ? "Esperá tu turno" : "Cantar Vale 4"}
                  >
                    Vale 4
                  </button>
                )}
                {mesa.estado === "jugando" &&
                  mesa.fase === "jugando" &&
                  !miJugador?.seVaAlMazo && (
                    <button
                      onClick={handleIrseAlMazo}
                      disabled={loading}
                      className="btn-mazo text-white"
                    >
                      Mazo
                    </button>
                  )}
              </div>
            </div>
            )}

            {/* Mis cartas */}
            {!meFuiAlMazo && (
            <div className="flex justify-center items-center gap-2 sm:gap-3">
              {misCartas().map((carta, index) => (
                <div
                  key={`${carta.palo}-${carta.valor}-${index}`}
                  className={`transition-all duration-300 ${yaJugueEnEstaMano ? "opacity-40 grayscale scale-95" : ""}`}
                >
                  <CartaImg
                    carta={carta}
                    size="large"
                    onClick={
                      esMiTurno() && !yaJugueEnEstaMano
                        ? () => handleJugarCarta(carta)
                        : undefined
                    }
                    disabled={!esMiTurno() || loading || yaJugueEnEstaMano}
                    showGlow={esMiTurno() && !yaJugueEnEstaMano}
                  />
                </div>
              ))}
              {misCartas().length === 0 && mesa.estado === "jugando" && (
                <div className="text-gold-500/40 text-sm py-8">Sin cartas</div>
              )}
              {yaJugueEnEstaMano && misCartas().length > 0 && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gold-500/60 whitespace-nowrap">
                  Esperando a los demás...
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
      {/* Banner publicitario pequeño (solo usuarios free) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <AdBanner
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GAME}
            size="banner"
            className="opacity-80 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      <AlertModal {...alertState} onClose={closeAlert} />
    </div>
  );
}
