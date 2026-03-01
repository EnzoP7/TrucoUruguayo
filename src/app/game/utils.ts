import { Carta } from "./types";
import { paloAArchivo, VALORES_PIEZA_CLIENT } from "./constants";

export function getCartaImageUrl(carta: Carta): string {
  const valorStr = carta.valor.toString().padStart(2, "0");
  const paloStr = paloAArchivo[carta.palo] || carta.palo;
  return `/Cartasimg/${valorStr}-${paloStr}.png`;
}

export function getNombreGrito(tipo: string): string {
  const nombres: Record<string, string> = {
    truco: "TRUCO",
    retruco: "RETRUCO",
    vale4: "VALE 4",
  };
  return nombres[tipo] || tipo;
}

export function getNombreEnvido(tipo: string): string {
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
export function getValorEnvidoCarta(carta: Carta): number {
  // 10, 11, 12 valen 0 para envido
  if (carta.valor >= 10) return 0;
  return carta.valor;
}

// Calcular puntos de envido de un conjunto de cartas
export function calcularEnvido(cartas: Carta[]): {
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
export function ordenarCartasPorPoder(cartas: Carta[]): Carta[] {
  return [...cartas].sort((a, b) => b.poder - a.poder);
}

// Obtener nombre legible del poder de una carta
export function getNombrePoderCarta(carta: Carta): string {
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

export function esPiezaClient(carta: Carta, muestra: Carta | null): boolean {
  if (!muestra) return false;
  if (carta.palo !== muestra.palo) return false;
  if (VALORES_PIEZA_CLIENT.includes(carta.valor)) return true;
  if (carta.valor === 12 && VALORES_PIEZA_CLIENT.includes(muestra.valor))
    return true;
  return false;
}

// Detectar flor con reglas completas (mismo palo, piezas)
export function tieneFlor_client(cartas: Carta[], muestra: Carta | null): boolean {
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
export function calcularFlor_client(
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
