'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Tipos para el tutorial
interface Carta {
  valor: number;
  palo: 'espada' | 'basto' | 'oro' | 'copa';
  poder: number;
}

interface CartaIlustrativa {
  valor: number;
  palo: 'espada' | 'basto' | 'oro' | 'copa';
  etiqueta?: string; // Ej: "1°", "2°", "MATA"
}

interface LeccionPaso {
  titulo: string;
  descripcion: string;
  accion?: 'seleccionar-carta' | 'cantar' | 'responder' | 'siguiente';
  cartasResaltadas?: number[]; // indices de cartas a resaltar
  opcionesCantar?: string[];
  respuestaCorrecta?: number | string;
  respuestasAceptables?: string[]; // respuestas alternativas aceptables (para cantar)
  respuestaIncorrecta?: string; // mensaje cuando elige una opcion incorrecta
  explicacion?: string;
  cartaRivalJuega?: number; // indice de carta que juega el rival
  mostrarCartasRival?: boolean; // mostrar cartas del rival
  cartasIlustrativas?: CartaIlustrativa[]; // cartas para mostrar visualmente en explicaciones
  limpiarMesa?: boolean; // limpiar completamente la mesa (ocultar cartas y muestra)
  preservarCartasEnMesa?: boolean; // mantener cartas en mesa del paso anterior
}

interface Leccion {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  pasos: LeccionPaso[];
  cartasJugador?: Carta[];
  cartasRival?: Carta[];
  muestra?: Carta;
}

// Lecciones del tutorial - TRUCO URUGUAYO (PIEZAS son las mas fuertes!)
const LECCIONES: Leccion[] = [
  {
    id: 'basico',
    titulo: 'Lo Basico',
    descripcion: 'Aprende como se juega una mano de truco',
    icono: '1',
    cartasJugador: [
      { valor: 2, palo: 'oro', poder: 20 },    // PIEZA - 2 del palo de muestra (LA MAS FUERTE!)
      { valor: 5, palo: 'oro', poder: 17 },     // PIEZA - 5 del palo de muestra
      { valor: 4, palo: 'copa', poder: 0 },     // Carta comun
    ],
    cartasRival: [
      { valor: 3, palo: 'basto', poder: 10 },
      { valor: 1, palo: 'espada', poder: 14 }, // Mata
      { valor: 6, palo: 'copa', poder: 0 },
    ],
    muestra: { valor: 12, palo: 'oro', poder: 0 },
    pasos: [
      {
        titulo: 'Bienvenido al Truco Uruguayo',
        descripcion: 'El truco se juega con 40 cartas (mazo espanol sin 8 y 9). Cada jugador recibe 3 cartas y se da vuelta una carta llamada "muestra". El objetivo es ganar 2 de 3 manos para sumar puntos.',
        accion: 'siguiente',
      },
      {
        titulo: 'Las PIEZAS - Las Cartas Mas Fuertes!',
        descripcion: 'En el Truco Uruguayo, las cartas MAS FUERTES son las PIEZAS (cartas del palo de la muestra).\n\nLas PIEZAS le ganan a TODO, incluso a las matas!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'oro', etiqueta: '1°' },
          { valor: 4, palo: 'oro', etiqueta: '2°' },
          { valor: 5, palo: 'oro', etiqueta: '3°' },
          { valor: 11, palo: 'oro', etiqueta: '4°' },
          { valor: 10, palo: 'oro', etiqueta: '5°' },
        ],
      },
      {
        titulo: 'La Regla del 12 Pieza',
        descripcion: 'IMPORTANTE: Cuando la muestra es una PIEZA (2, 4, 5, 10 u 11), el 12 del mismo palo toma el valor de esa pieza!\n\nEjemplo: Si la muestra es el 4 de Oro, el 12 de Oro vale como si fuera el 4 de Oro (segunda pieza mas fuerte).',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 4, palo: 'oro', etiqueta: 'Muestra' },
          { valor: 12, palo: 'oro', etiqueta: '= 4 Oro' },
        ],
      },
      {
        titulo: 'Las MATAS - Despues de las Piezas',
        descripcion: 'Las MATAS son fuertes pero van DESPUES de las piezas.\n\nSi no hay piezas en juego, las matas son las mas fuertes!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 1, palo: 'espada', etiqueta: '1°' },
          { valor: 1, palo: 'basto', etiqueta: '2°' },
          { valor: 7, palo: 'espada', etiqueta: '3°' },
          { valor: 7, palo: 'oro', etiqueta: '4°' },
        ],
      },
      {
        titulo: 'Tus Cartas',
        descripcion: 'La muestra es ORO. Tienes el 2 de Oro (PIEZA mas fuerte!) y el 5 de Oro (otra PIEZA). El 4 de Copa es carta comun y debil.',
        accion: 'siguiente',
        cartasResaltadas: [0, 1],
      },
      {
        titulo: 'Tu Turno - Jugar Carta',
        descripcion: 'Es tu turno. Como tienes 2 PIEZAS muy fuertes, guardalas para despues. Tira el 4 de Copa (la mas debil) para ver que tiene el rival.',
        accion: 'seleccionar-carta',
        respuestaCorrecta: 2,
        explicacion: 'Correcto! Siempre es buena estrategia tirar las cartas debiles primero para ver que tiene el rival y guardar las fuertes.',
      },
      {
        titulo: 'El Rival Juega',
        descripcion: 'El rival tiro el 6 de Copa. Tu 4 pierde esta mano porque el 6 es mayor. Pero no te preocupes, aun tienes 2 PIEZAS!',
        accion: 'siguiente',
        cartaRivalJuega: 2,
        mostrarCartasRival: true,
      },
      {
        titulo: 'Segunda Mano - Turno del Rival',
        descripcion: 'Como el rival gano la primera mano, ahora tira el primero. Tiro el 3 de Basto (carta comun alta).',
        accion: 'siguiente',
        cartaRivalJuega: 0,
        mostrarCartasRival: true,
      },
      {
        titulo: 'Tu Respuesta',
        descripcion: 'El rival tiro un 3. Tira el 5 de Oro (PIEZA) para ganarle. Las PIEZAS le ganan a todo!',
        accion: 'seleccionar-carta',
        respuestaCorrecta: 1,
        explicacion: 'Excelente! El 5 de Oro es PIEZA y le gana al 3. Ganaste esta mano!',
      },
      {
        titulo: 'Tercera Mano - Turno Tuyo',
        descripcion: 'Ganaste la segunda mano, asi que arrancas vos. El rival solo tiene el 1 de Espada (MATA). Tira tu 2 de Oro (PIEZA) para ganar!',
        accion: 'seleccionar-carta',
        respuestaCorrecta: 0,
        explicacion: 'Perfecto! El 2 de Oro es la PIEZA mas poderosa. El rival ve que no puede ganar y se va al mazo!',
      },
      {
        titulo: 'Victoria!',
        descripcion: 'El rival vio tu 2 de Oro (la PIEZA mas fuerte) y se fue al mazo. No tiene sentido seguir jugando cuando no puede ganar.\n\nGanaste la ronda y sumas 1 punto!',
        accion: 'siguiente',
        limpiarMesa: true,
      },
      {
        titulo: 'Leccion Completada',
        descripcion: 'Aprendiste lo basico del Truco Uruguayo:',
        accion: 'siguiente',
        limpiarMesa: true,
        cartasIlustrativas: [
          { valor: 2, palo: 'oro', etiqueta: 'PIEZA 1°' },
          { valor: 4, palo: 'oro', etiqueta: 'PIEZA 2°' },
          { valor: 1, palo: 'espada', etiqueta: 'MATA 1°' },
          { valor: 3, palo: 'basto', etiqueta: 'COMUN' },
        ],
      },
    ],
  },
  {
    id: 'truco',
    titulo: 'El Truco',
    descripcion: 'Aprende a gritar truco y subir la apuesta',
    icono: '2',
    cartasJugador: [
      { valor: 1, palo: 'basto', poder: 13 },   // Mata
      { valor: 3, palo: 'espada', poder: 10 },  // 3 comun (carta alta)
      { valor: 12, palo: 'espada', poder: 0 },
    ],
    cartasRival: [
      { valor: 7, palo: 'espada', poder: 12 }, // Mata
      { valor: 2, palo: 'copa', poder: 9 },
      { valor: 6, palo: 'basto', poder: 0 },
    ],
    muestra: { valor: 12, palo: 'copa', poder: 0 }, // Copa es muestra, no hay piezas relevantes
    pasos: [
      {
        titulo: 'Que es el Truco?',
        descripcion: 'El truco es un "grito" o apuesta. Normalmente, ganar una ronda vale 1 punto. Pero si gritas "Truco" y el rival acepta, la ronda vale 2 puntos!',
        accion: 'siguiente',
      },
      {
        titulo: 'Escalar la Apuesta',
        descripcion: 'Si te gritan Truco, podes:\n- Quiero: aceptar (2 puntos en juego)\n- No Quiero: rendirte (rival gana 1 punto)\n- Retruco: subir a 3 puntos\n- Vale Cuatro: subir a 4 puntos\n\nIMPORTANTE: Los gritos se alternan! Si vos gritas Truco, no podes gritar Retruco. Te "guardas la palabra" y el rival es quien puede subir la apuesta.',
        accion: 'siguiente',
      },
      {
        titulo: 'Tienes Buenas Cartas',
        descripcion: 'La muestra es Copa (no tenes piezas). Pero tenes el 1 de Basto (MATA) y un 3. Tira el 12 primero para tantear al rival.',
        accion: 'seleccionar-carta',
        respuestaCorrecta: 2,
        explicacion: 'Bien! El 12 es carta comun pero te permite ver que juega el rival.',
      },
      {
        titulo: 'El Rival Grita Truco!',
        descripcion: 'Antes de tirar su carta, el rival grito "Truco"! Tienes el 1 de Basto que es MATA (no hay piezas en juego). Que haces?\n\nPista: Tienes buenas cartas, no te rindas!',
        accion: 'cantar',
        opcionesCantar: ['Quiero', 'No Quiero', 'Retruco'],
        respuestaCorrecta: 'Retruco',
        respuestasAceptables: ['Quiero'],
        respuestaIncorrecta: 'Tienes una MATA! No te rindas con cartas tan buenas. Intenta Quiero o Retruco.',
        explicacion: 'Excelente! Con una MATA como el 1 de Basto (y sin piezas del rival), podes escalar a Retruco (3 puntos).',
        mostrarCartasRival: true,
      },
      {
        titulo: 'El Rival Acepta y Responde',
        descripcion: 'El rival acepto el Retruco (ahora vale 3 puntos) y tiro el 6 de Basto. Tu 12 le gana! Ganaste la primera mano.',
        accion: 'siguiente',
        cartaRivalJuega: 2,
        mostrarCartasRival: true,
      },
      {
        titulo: 'Segunda Mano - Tu Turno',
        descripcion: 'Ganaste la primera mano, asi que arrancas vos. Tira el 3 (carta alta).',
        accion: 'seleccionar-carta',
        respuestaCorrecta: 1,
        explicacion: 'Perfecto! El 3 es la carta COMUN mas alta.',
        mostrarCartasRival: true,
      },
      {
        titulo: 'El Rival Responde',
        descripcion: 'El rival tiro el 2 de Copa. Tu 3 le gana! Ganaste la segunda mano y la ronda!',
        accion: 'siguiente',
        cartaRivalJuega: 1,
        mostrarCartasRival: true,
      },
      {
        titulo: 'Victoria con Retruco!',
        descripcion: 'Ganaste 2 de 3 manos. Con el Retruco aceptado, sumas 3 puntos en vez de 1!\n\nTu MATA (1 de Basto) ni siquiera fue necesaria.',
        accion: 'siguiente',
        limpiarMesa: true,
        cartasIlustrativas: [
          { valor: 3, palo: 'espada', etiqueta: 'Tu 3' },
          { valor: 2, palo: 'copa', etiqueta: 'Su 2' },
        ],
      },
      {
        titulo: 'Leccion Completada',
        descripcion: 'Aprendiste el Truco:\n- Truco = 2 puntos (1 si no quieren)\n- Retruco = 3 puntos (2 si no quieren)\n- Vale 4 = 4 puntos (3 si no quieren)\n\nRecorda: podes farolear aunque no tengas buenas cartas!',
        accion: 'siguiente',
        limpiarMesa: true,
      },
    ],
  },
  {
    id: 'envido',
    titulo: 'El Envido',
    descripcion: 'Aprende a tocar envido y calcular puntos',
    icono: '3',
    pasos: [
      {
        titulo: 'Que es el Envido?',
        descripcion: 'El envido es una apuesta sobre quien tiene mas "puntos de envido". Se toca ANTES de tirar la primera carta de la ronda.\n\nEs independiente de quien gana las manos!',
        accion: 'siguiente',
      },
      {
        titulo: 'Regla Basica: 2 Cartas + 20',
        descripcion: 'Para calcular tu envido:\n\n1. Busca 2 cartas del MISMO PALO\n2. Suma sus valores + 20\n\nEjemplo: 7 + 6 del mismo palo = 7 + 6 + 20 = 33 puntos!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'oro', etiqueta: '7' },
          { valor: 6, palo: 'oro', etiqueta: '+ 6' },
        ],
      },
      {
        titulo: 'Ejemplo: Envido de 33',
        descripcion: 'Con 7 y 6 de Oro tienes el MAXIMO envido sin piezas:\n\n7 + 6 + 20 = 33 puntos\n\nEste es un envido MUY fuerte!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'oro', etiqueta: '7' },
          { valor: 6, palo: 'oro', etiqueta: '6' },
          { valor: 4, palo: 'espada', etiqueta: 'No cuenta' },
        ],
      },
      {
        titulo: 'Ejemplo: Envido de 28',
        descripcion: 'Con 5 y 3 de Basto:\n\n5 + 3 + 20 = 28 puntos\n\nEs un buen envido, pero no el mejor.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 5, palo: 'basto', etiqueta: '5' },
          { valor: 3, palo: 'basto', etiqueta: '3' },
          { valor: 12, palo: 'copa', etiqueta: 'No cuenta' },
        ],
      },
      {
        titulo: 'Sin Cartas del Mismo Palo',
        descripcion: 'Si NO tienes 2 cartas del mismo palo, tu envido es el valor de tu carta mas alta.\n\nEjemplo: Con 3 palos distintos, si tu carta mas alta es un 7, tu envido es solo 7.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'oro', etiqueta: '= 7 pts' },
          { valor: 5, palo: 'basto', etiqueta: '' },
          { valor: 3, palo: 'copa', etiqueta: '' },
        ],
      },
      {
        titulo: 'Las PIEZAS y el Envido',
        descripcion: 'Las PIEZAS (cartas del palo de la muestra) tienen valores ESPECIALES de envido:\n\n- 2 de la muestra = 30 puntos\n- 4 de la muestra = 29 puntos\n- 5 de la muestra = 28 puntos\n- 10 u 11 de la muestra = 27 puntos',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: '30 pts' },
          { valor: 4, palo: 'copa', etiqueta: '29 pts' },
          { valor: 5, palo: 'copa', etiqueta: '28 pts' },
          { valor: 11, palo: 'copa', etiqueta: '27 pts' },
        ],
      },
      {
        titulo: 'Envido Maximo: 37 Puntos!',
        descripcion: 'El MAXIMO envido posible es 37:\n\n2 de la muestra (30) + cualquier 7 del mismo palo (7) = 37\n\nEsto es casi imposible de perder!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: '30' },
          { valor: 7, palo: 'copa', etiqueta: '+ 7 = 37' },
        ],
      },
      {
        titulo: 'Otro Ejemplo con Pieza',
        descripcion: 'Si la muestra es Copa y tienes:\n\n4 de Copa (pieza = 29) + 6 de Copa = 29 + 6 = 35 puntos!\n\nLas piezas son muy valiosas para el envido.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 4, palo: 'copa', etiqueta: '29 (Pieza)' },
          { valor: 6, palo: 'copa', etiqueta: '+ 6' },
        ],
      },
      {
        titulo: 'Tocar Envido - Opciones',
        descripcion: 'Cuando tocas envido, el rival puede:\n\n- "Quiero": Se comparan puntos\n- "No Quiero": Ganas 1 punto automatico\n- Subir la apuesta: Envido → Real Envido → Falta Envido',
        accion: 'siguiente',
      },
      {
        titulo: 'Valores del Envido',
        descripcion: 'Puntos en juego segun el canto:\n\n- Envido: 2 pts (1 si no quieren)\n- Real Envido: 3 pts (2 si no quieren)\n- Falta Envido: Lo que falta para ganar!\n\nSe pueden combinar: Envido + Real Envido = 5 pts',
        accion: 'siguiente',
      },
      {
        titulo: 'Cuando Tocar?',
        descripcion: 'Guia rapida:\n\n- 30+ puntos: Siempre toca!\n- 27-29: Toca con confianza\n- 24-26: Toca pero cuidado\n- 20-23: Solo si te animas a farolear\n- Menos de 20: Mejor no tocar',
        accion: 'siguiente',
      },
      {
        titulo: 'Leccion Completada',
        descripcion: 'Resumen del Envido:\n\n- 2 cartas mismo palo + 20\n- Piezas: 2=30, 4=29, 5=28, 10/11=27\n- Maximo: 37 (2 pieza + 7)\n- Con 27+ siempre toca!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'oro', etiqueta: '7+6+20=33' },
          { valor: 6, palo: 'oro', etiqueta: '' },
          { valor: 2, palo: 'copa', etiqueta: 'Pieza=30' },
        ],
      },
    ],
  },
  {
    id: 'flor',
    titulo: 'La Flor',
    descripcion: 'Aprende a cantar flor y cuando la tienes',
    icono: '4',
    pasos: [
      {
        titulo: 'Que es la Flor?',
        descripcion: 'Tienes FLOR cuando las 3 cartas son del MISMO PALO.\n\nLa FLOR es OBLIGATORIA cantarla! Si no la cantas y te descubren, perdes puntos.',
        accion: 'siguiente',
      },
      {
        titulo: 'Caso 1: Flor Simple',
        descripcion: 'Las 3 cartas del mismo palo = FLOR!\n\nEjemplo: 7, 4 y 2 de Espada.\nValor: 7 + 4 + 2 + 20 = 33 puntos de flor.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'espada', etiqueta: '7' },
          { valor: 4, palo: 'espada', etiqueta: '4' },
          { valor: 2, palo: 'espada', etiqueta: '2' },
        ],
      },
      {
        titulo: 'Caso 2: Flor con Piezas',
        descripcion: 'Si tenes 2 o mas PIEZAS (cartas del palo de la muestra) = FLOR!\n\nEjemplo: Si la muestra es Copa, tener 2 y 4 de Copa es FLOR aunque la tercera sea de otro palo.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: 'Pieza' },
          { valor: 4, palo: 'copa', etiqueta: 'Pieza' },
          { valor: 7, palo: 'espada', etiqueta: 'Otro palo' },
        ],
      },
      {
        titulo: 'Caso 3: Pieza + 2 del Mismo Palo',
        descripcion: 'Si tenes 1 PIEZA y las otras 2 cartas del mismo palo (cualquiera) = FLOR!\n\nEjemplo: 2 de Copa (pieza) + 7 y 5 de Oro.',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: 'Pieza' },
          { valor: 7, palo: 'oro', etiqueta: 'Mismo' },
          { valor: 5, palo: 'oro', etiqueta: 'palo' },
        ],
      },
      {
        titulo: 'NO es Flor',
        descripcion: 'Cuidado! Esto NO es flor:\n\n- 2 cartas del mismo palo + 1 de otro (sin piezas)\n- 1 pieza + 2 cartas de palos distintos',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'oro', etiqueta: '' },
          { valor: 5, palo: 'oro', etiqueta: '' },
          { valor: 3, palo: 'basto', etiqueta: 'NO FLOR' },
        ],
      },
      {
        titulo: 'Calcular Puntos de Flor',
        descripcion: 'Para calcular el valor de tu flor:\n\n- Suma los valores de las 3 cartas + 20\n- Las "negras" (10, 11, 12) valen 0\n- Las PIEZAS valen su valor especial (30, 29, 28, 27)',
        accion: 'siguiente',
      },
      {
        titulo: 'Ejemplo: Flor de 33',
        descripcion: 'Con 7, 4 y 2 de Espada (sin piezas):\n\n7 + 4 + 2 + 20 = 33 puntos\n\nEsta es una flor muy buena!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'espada', etiqueta: '7' },
          { valor: 4, palo: 'espada', etiqueta: '4' },
          { valor: 2, palo: 'espada', etiqueta: '2' },
        ],
      },
      {
        titulo: 'Flor Maxima: 47 Puntos!',
        descripcion: 'La FLOR maxima es 47:\n\n2 (pieza=30) + 4 (pieza=9) + 5 (pieza=8) del palo de la muestra.\n\n30 + 9 + 8 = 47 puntos!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: '30' },
          { valor: 4, palo: 'copa', etiqueta: '9' },
          { valor: 5, palo: 'copa', etiqueta: '8' },
        ],
      },
      {
        titulo: 'Flor Anula el Envido',
        descripcion: 'IMPORTANTE: Si hay FLOR en la mesa, NO se puede tocar envido.\n\nLa flor tiene prioridad absoluta sobre el envido.',
        accion: 'siguiente',
      },
      {
        titulo: 'Respuestas a la Flor',
        descripcion: 'Si cantas flor y el rival tambien tiene, puede responder:\n\n- "Con Flor": comparan valores (3 pts al ganador)\n- "Con Flor Quiero": acepta comparar\n- "Contra Flor al Resto": se juega todo lo que falta!',
        accion: 'siguiente',
      },
      {
        titulo: 'Puntos de la Flor',
        descripcion: 'Puntos segun la situacion:\n\n- Flor sin respuesta: 3 pts\n- Con Flor (ambos tienen): 3 pts al ganador\n- Contra Flor: 6 pts\n- Contra Flor al Resto: lo que falta para ganar!',
        accion: 'siguiente',
      },
      {
        titulo: 'Leccion Completada',
        descripcion: 'Resumen de la Flor:\n\n- 3 cartas mismo palo = FLOR\n- 2+ piezas = FLOR\n- 1 pieza + 2 mismo palo = FLOR\n- Es OBLIGATORIO cantarla\n- Anula el envido\n- Maximo: 47 puntos',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 7, palo: 'espada', etiqueta: 'Flor' },
          { valor: 4, palo: 'espada', etiqueta: 'mismo' },
          { valor: 2, palo: 'espada', etiqueta: 'palo' },
        ],
      },
    ],
  },
  {
    id: 'jerarquia',
    titulo: 'Jerarquia de Cartas',
    descripcion: 'Memoriza el orden de poder de las cartas',
    icono: '5',
    pasos: [
      {
        titulo: 'Las PIEZAS - LAS MAS FUERTES!',
        descripcion: 'En el Truco Uruguayo, las PIEZAS (cartas del palo de la muestra) son LAS MAS FUERTES!\n\nLas PIEZAS le ganan a TODO!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 2, palo: 'copa', etiqueta: '1°' },
          { valor: 4, palo: 'copa', etiqueta: '2°' },
          { valor: 5, palo: 'copa', etiqueta: '3°' },
          { valor: 11, palo: 'copa', etiqueta: '4°' },
          { valor: 10, palo: 'copa', etiqueta: '5°' },
        ],
      },
      {
        titulo: 'Las MATAS - Despues de las Piezas',
        descripcion: 'Las MATAS son fijas y van DESPUES de las piezas.\n\nSi no hay piezas en juego, las matas son las mas fuertes!',
        accion: 'siguiente',
        cartasIlustrativas: [
          { valor: 1, palo: 'espada', etiqueta: '6°' },
          { valor: 1, palo: 'basto', etiqueta: '7°' },
          { valor: 7, palo: 'espada', etiqueta: '8°' },
          { valor: 7, palo: 'oro', etiqueta: '9°' },
        ],
      },
      {
        titulo: 'Cartas COMUNES',
        descripcion: 'Despues de PIEZAS y MATAS, van las cartas comunes (de menor a mayor):\n\n4, 5, 6, 7, 10, 11, 12, 1, 2, 3\n\nEs decir, el 3 es la carta COMUN mas alta, y el 4 es la mas baja.',
        accion: 'siguiente',
      },
      {
        titulo: 'Ejemplo Practico',
        descripcion: 'Si la muestra es COPA:\n\nOrden completo:\n1. 2 Copa (PIEZA MAS FUERTE!)\n2. 4 Copa (PIEZA)\n3. 5 Copa (PIEZA)\n4. 11 Copa (PIEZA)\n5. 10 Copa (PIEZA)\n6. 1 Espada (MATA)\n7. 1 Basto (MATA)\n8. 7 Espada (MATA)\n9. 7 Oro (MATA)\n10. 3, 2, 1 falsos, 12, 11...',
        accion: 'siguiente',
      },
      {
        titulo: 'Regla del 12 Pieza',
        descripcion: 'Caso especial: Si la muestra es una pieza (2, 4, 5, 10 u 11), el 12 de ese palo toma el valor de esa pieza!\n\nEjemplo: Si la muestra es el 4 de Copa, el 12 de Copa vale como el 4 de Copa (29 puntos de envido).',
        accion: 'siguiente',
      },
      {
        titulo: 'Leccion Completada',
        descripcion: 'Resumen de jerarquia:\n\nPIEZAS (las mas fuertes!): 2 > 4 > 5 > 11 > 10 de la muestra\n\nMATAS: 1 Espada > 1 Basto > 7 Espada > 7 Oro\n\nCOMUNES: 3 > 2 > 1 falso > 12 > 11 > 10 > 7 falso > 6 > 5 > 4\n\nSiempre mira la muestra primero!',
        accion: 'siguiente',
      },
    ],
  },
  {
    id: 'estrategia',
    titulo: 'Estrategias Basicas',
    descripcion: 'Consejos para jugar mejor',
    icono: '6',
    pasos: [
      {
        titulo: 'Guardar las PIEZAS',
        descripcion: 'Si tienes una PIEZA, no la tires primero. Las piezas son tus cartas mas valiosas! Empieza con cartas comunes para ver que tiene el rival.',
        accion: 'siguiente',
      },
      {
        titulo: 'El Farol (Bluff)',
        descripcion: 'Podes cantar truco o envido aunque no tengas buenas cartas. Si el rival tiene miedo y dice "no quiero", ganas puntos gratis!\n\nPero cuidado: si te descubren, perderas mas puntos.',
        accion: 'siguiente',
      },
      {
        titulo: 'Leer al Rival',
        descripcion: 'Presta atencion:\n- Si canta rapido, probablemente tiene buenas cartas\n- Si duda mucho, puede estar faroleando\n- Mira que cartas ya tiraron para saber que les queda',
        accion: 'siguiente',
      },
      {
        titulo: 'El Envido Primero',
        descripcion: 'El envido solo se canta en la primera mano. Si tienes buen envido (27+), cantalo antes de tirar la segunda carta!\n\nRecorda: si hay FLOR, no hay envido.',
        accion: 'siguiente',
      },
      {
        titulo: 'Conocer las PIEZAS',
        descripcion: 'Siempre mira la muestra al empezar. Las PIEZAS cambian todo el juego!\n\nEjemplo: Un 10 comun es debil, pero un 10 del palo de la muestra es LA CARTA MAS FUERTE del juego!',
        accion: 'siguiente',
      },
      {
        titulo: 'Juego en Equipo',
        descripcion: 'En 2v2 o 3v3:\n- Si tu companero canta envido, apoyalo\n- La carta mas alta del equipo es la que cuenta\n- Coordinense para no desperdiciar piezas ni matas',
        accion: 'siguiente',
      },
      {
        titulo: 'Tutorial Completado!',
        descripcion: 'Felicitaciones! Ya conoces las reglas del Truco Uruguayo:\n\n- Las PIEZAS son las cartas mas fuertes\n- Las MATAS van despues de las piezas\n- Envido, Flor y Truco\n- Estrategias basicas\n\nAhora a practicar contra el bot o con amigos!',
        accion: 'siguiente',
      },
    ],
  },
];

// Mapeo de palos singular a plural para nombres de archivo
const PALO_PLURAL: Record<string, string> = {
  'espada': 'espadas',
  'basto': 'bastos',
  'oro': 'oros',
  'copa': 'copas',
};

// Componente de carta con animacion
function CartaTutorial({
  carta,
  resaltada,
  seleccionable,
  onClick,
  pequena,
  animarSalida,
}: {
  carta: Carta;
  resaltada?: boolean;
  seleccionable?: boolean;
  onClick?: () => void;
  pequena?: boolean;
  animarSalida?: boolean;
}) {
  // Formato correcto: 01-espadas.png, 07-oros.png, etc.
  const valorStr = carta.valor.toString().padStart(2, '0');
  const paloPlural = PALO_PLURAL[carta.palo] || carta.palo;
  const nombreCarta = `${valorStr}-${paloPlural}`;
  const size = pequena ? 'w-12 h-18' : 'w-20 h-28 sm:w-24 sm:h-36';

  return (
    <button
      onClick={onClick}
      disabled={!seleccionable}
      className={`${size} rounded-lg overflow-hidden shadow-lg transition-all duration-300 ${
        resaltada ? 'ring-4 ring-yellow-400 animate-pulse scale-110' : ''
      } ${seleccionable ? 'hover:scale-110 hover:-translate-y-2 cursor-pointer' : 'cursor-default'} ${
        !seleccionable && !resaltada ? 'opacity-70' : ''
      } ${animarSalida ? 'animate-[cartaJugada_0.5s_ease-out_forwards]' : ''}`}
    >
      <Image
        src={`/Cartasimg/${nombreCarta}.png`}
        alt={nombreCarta}
        width={pequena ? 48 : 96}
        height={pequena ? 72 : 144}
        className="w-full h-full object-cover"
      />
    </button>
  );
}

// Componente de carta oculta (reverso)
function CartaOculta({ pequena, animarSalida }: { pequena?: boolean; animarSalida?: boolean }) {
  const size = pequena ? 'w-12 h-18' : 'w-14 h-20';
  return (
    <div className={`${size} rounded-lg bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-700 flex items-center justify-center shadow-lg ${animarSalida ? 'animate-[cartaJugadaRival_0.5s_ease-out_forwards]' : ''}`}>
      <span className="text-blue-400/50 text-2xl">?</span>
    </div>
  );
}

// Componente para mostrar cartas ilustrativas con etiqueta
function CartaIlustrativaComponent({ carta }: { carta: CartaIlustrativa }) {
  const valorStr = carta.valor.toString().padStart(2, '0');
  const paloPlural = PALO_PLURAL[carta.palo] || carta.palo;
  const nombreCarta = `${valorStr}-${paloPlural}`;

  return (
    <div className="flex flex-col items-center gap-1">
      {carta.etiqueta && (
        <span className="text-xs font-bold text-gold-400 bg-gold-900/50 px-2 py-0.5 rounded-full">
          {carta.etiqueta}
        </span>
      )}
      <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden shadow-lg border-2 border-gold-600/30 hover:scale-105 transition-transform">
        <Image
          src={`/Cartasimg/${nombreCarta}.png`}
          alt={nombreCarta}
          width={64}
          height={96}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export default function TutorialPage() {
  const [leccionActual, setLeccionActual] = useState<number | null>(null);
  const [pasoActual, setPasoActual] = useState(0);
  const [cartasUsadas, setCartasUsadas] = useState<number[]>([]);
  const [cartasRivalUsadas, setCartasRivalUsadas] = useState<number[]>([]);
  const [mostrarExplicacion, setMostrarExplicacion] = useState(false);
  const [leccionesCompletadas, setLeccionesCompletadas] = useState<string[]>([]);
  const [cartaAnimando, setCartaAnimando] = useState<number | null>(null);
  const [cartaRivalAnimando, setCartaRivalAnimando] = useState<number | null>(null);
  const [cartasEnMesa, setCartasEnMesa] = useState<{jugador: Carta | null, rival: Carta | null}>({ jugador: null, rival: null });
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  // Historial para poder volver atras correctamente
  const [historialPasos, setHistorialPasos] = useState<{
    cartasUsadas: number[];
    cartasRivalUsadas: number[];
    cartasEnMesa: {jugador: Carta | null, rival: Carta | null};
  }[]>([]);

  // Cargar progreso
  useEffect(() => {
    const saved = localStorage.getItem('tutorial_completadas');
    if (saved) {
      try {
        setLeccionesCompletadas(JSON.parse(saved));
      } catch { /* ignorar */ }
    }
  }, []);

  // Guardar progreso
  const marcarCompletada = useCallback((leccionId: string) => {
    setLeccionesCompletadas(prev => {
      if (prev.includes(leccionId)) return prev;
      const nuevo = [...prev, leccionId];
      localStorage.setItem('tutorial_completadas', JSON.stringify(nuevo));
      return nuevo;
    });
  }, []);

  const leccion = leccionActual !== null ? LECCIONES[leccionActual] : null;
  const paso = leccion ? leccion.pasos[pasoActual] : null;

  // Efecto para mostrar carta del rival cuando corresponde
  useEffect(() => {
    if (paso?.cartaRivalJuega !== undefined && !cartasRivalUsadas.includes(paso.cartaRivalJuega) && leccion?.cartasRival) {
      // Delay para la animacion
      const timer = setTimeout(() => {
        setCartaRivalAnimando(paso.cartaRivalJuega!);
        // Mostrar carta en mesa despues de la animacion
        setTimeout(() => {
          setCartasEnMesa(prev => ({ ...prev, rival: leccion.cartasRival![paso.cartaRivalJuega!] }));
          setCartasRivalUsadas(prev => [...prev, paso.cartaRivalJuega!]);
          setCartaRivalAnimando(null);
        }, 500);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [paso, cartasRivalUsadas, leccion]);

  const handleSiguiente = () => {
    if (!leccion) return;

    const siguientePaso = leccion.pasos[pasoActual + 1];

    // Limpiar mensaje de error
    setMensajeError(null);

    // Guardar estado actual en historial antes de avanzar
    setHistorialPasos(prev => {
      const nuevoHistorial = [...prev];
      nuevoHistorial[pasoActual] = {
        cartasUsadas: [...cartasUsadas],
        cartasRivalUsadas: [...cartasRivalUsadas],
        cartasEnMesa: { ...cartasEnMesa },
      };
      return nuevoHistorial;
    });

    // Si el siguiente paso limpia la mesa, limpiarla
    if (siguientePaso?.limpiarMesa) {
      setCartasEnMesa({ jugador: null, rival: null });
    }

    if (pasoActual < leccion.pasos.length - 1) {
      setPasoActual(pasoActual + 1);
      setMostrarExplicacion(false);
    } else {
      // Fin de la leccion
      marcarCompletada(leccion.id);
      setLeccionActual(null);
      setPasoActual(0);
      setCartasUsadas([]);
      setCartasRivalUsadas([]);
      setCartasEnMesa({ jugador: null, rival: null });
      setHistorialPasos([]);
    }
  };

  const handleAtras = () => {
    if (pasoActual > 0) {
      const pasoAnterior = pasoActual - 1;
      const estadoAnterior = historialPasos[pasoAnterior];

      // Restaurar estado del paso anterior si existe
      if (estadoAnterior) {
        setCartasUsadas(estadoAnterior.cartasUsadas);
        setCartasRivalUsadas(estadoAnterior.cartasRivalUsadas);
        setCartasEnMesa(estadoAnterior.cartasEnMesa);
      } else {
        // Si no hay historial, limpiar
        setCartasEnMesa({ jugador: null, rival: null });
      }

      setMostrarExplicacion(false);
      setMensajeError(null);
      setPasoActual(pasoAnterior);
    }
  };

  const handleSeleccionarCarta = (index: number) => {
    if (!paso || paso.accion !== 'seleccionar-carta' || cartaAnimando !== null) return;
    if (!leccion?.cartasJugador) return;

    if (paso.respuestaCorrecta === index) {
      // Iniciar animacion
      setCartaAnimando(index);

      // Despues de la animacion, mostrar carta en mesa y mostrar explicacion
      setTimeout(() => {
        setCartasEnMesa(prev => ({ ...prev, jugador: leccion.cartasJugador![index] }));
        setCartasUsadas(prev => [...prev, index]);
        setCartaAnimando(null);
        setMostrarExplicacion(true);
      }, 500);
    }
  };

  const handleCantar = (opcion: string) => {
    if (!paso || paso.accion !== 'cantar') return;

    // Limpiar mensaje de error previo
    setMensajeError(null);

    // Respuesta correcta (mejor opcion)
    if (paso.respuestaCorrecta === opcion) {
      setMostrarExplicacion(true);
      return;
    }

    // Respuestas aceptables (no la mejor pero validas)
    if (paso.respuestasAceptables?.includes(opcion)) {
      setMostrarExplicacion(true);
      return;
    }

    // Respuesta incorrecta
    if (paso.respuestaIncorrecta) {
      setMensajeError(paso.respuestaIncorrecta);
    }
  };

  const iniciarLeccion = (index: number) => {
    setLeccionActual(index);
    setPasoActual(0);
    setCartasUsadas([]);
    setCartasRivalUsadas([]);
    setMostrarExplicacion(false);
    setCartaAnimando(null);
    setCartaRivalAnimando(null);
    setCartasEnMesa({ jugador: null, rival: null });
    setMensajeError(null);
    setHistorialPasos([]);
  };

  // Pantalla de seleccion de leccion
  if (leccionActual === null) {
    return (
      <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-celeste-500/8 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <header className="text-center mb-10">
            <Link href="/lobby" className="inline-block group">
              <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl lg:text-6xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors">
                Tutorial
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="h-px w-8 bg-celeste-500/40" />
              <p className="text-celeste-400/70 text-sm tracking-widest uppercase">Aprende Truco Uruguayo</p>
              <div className="h-px w-8 bg-celeste-500/40" />
            </div>
          </header>

          <Link href="/lobby" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm mb-6 transition-colors">
            ← Volver al lobby
          </Link>

          {/* Progreso */}
          <div className="glass rounded-xl p-4 mb-6 border border-gold-800/20">
            <div className="flex items-center justify-between">
              <span className="text-gold-400/70 text-sm">Tu progreso</span>
              <span className="text-gold-300 font-bold">{leccionesCompletadas.length} / {LECCIONES.length}</span>
            </div>
            <div className="mt-2 h-2 bg-gold-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${(leccionesCompletadas.length / LECCIONES.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Lista de lecciones */}
          <div className="grid gap-4 sm:grid-cols-2">
            {LECCIONES.map((l, idx) => {
              const completada = leccionesCompletadas.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => iniciarLeccion(idx)}
                  className={`glass rounded-2xl p-5 text-left transition-all duration-300 border ${
                    completada
                      ? 'border-green-500/30 bg-green-900/10 hover:border-green-500/50'
                      : 'border-gold-800/20 hover:border-gold-600/40 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
                      completada ? 'bg-green-600/30 text-green-400' : 'bg-gold-600/20 text-gold-400'
                    }`}>
                      {completada ? '✓' : l.icono}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-1">{l.titulo}</h3>
                      <p className="text-gold-500/60 text-sm">{l.descripcion}</p>
                      <div className="mt-2 text-xs text-gold-500/40">
                        {l.pasos.length} pasos
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Boton para jugar con bot */}
          <div className="mt-8 text-center">
            <Link
              href="/lobby"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 transition-all shadow-lg shadow-celeste-600/20"
            >
              Practicar contra Bot
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="text-gold-500/40 text-xs mt-2">Crea una partida y agrega un bot para practicar</p>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de leccion
  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6">
      {/* CSS para animaciones de cartas */}
      <style jsx global>{`
        @keyframes cartaJugada {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-40px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0.8); opacity: 0; }
        }
        @keyframes cartaJugadaRival {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(40px) scale(1.1); opacity: 1; }
          100% { transform: translateY(80px) scale(0.8); opacity: 0; }
        }
        @keyframes cartaAparece {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-celeste-500/8 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setLeccionActual(null);
              setPasoActual(0);
              setCartasUsadas([]);
              setCartasRivalUsadas([]);
              setCartasEnMesa({ jugador: null, rival: null });
            }}
            className="text-gold-400/60 hover:text-gold-300 text-sm transition-colors flex items-center gap-2"
          >
            ← Volver
          </button>
          <div className="text-gold-500/60 text-sm">
            Paso {pasoActual + 1} / {leccion?.pasos.length}
          </div>
        </div>

        {/* Titulo de la leccion */}
        <div className="text-center mb-6">
          <h2 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl font-bold text-gold-400">
            {leccion?.titulo}
          </h2>
          <div className="h-1 w-32 mx-auto mt-2 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent rounded-full" />
        </div>

        {/* Area de juego (si hay cartas y no se debe limpiar la mesa) */}
        {leccion?.cartasJugador && leccion?.muestra && !paso?.limpiarMesa && (
          <div className="glass rounded-2xl p-6 mb-6 border border-gold-800/20">
            {/* Muestra */}
            <div className="flex justify-center mb-4">
              <div className="text-center">
                <p className="text-gold-500/60 text-xs mb-2">MUESTRA</p>
                <CartaTutorial carta={leccion.muestra} pequena />
              </div>
            </div>

            {/* Cartas del rival */}
            {leccion.cartasRival && (
              <div className="flex justify-center gap-3 mb-4">
                <div className="text-center">
                  <p className="text-red-400/60 text-xs mb-2">RIVAL</p>
                  <div className="flex gap-2">
                    {leccion.cartasRival.map((c, i) => {
                      const yaUsada = cartasRivalUsadas.includes(i);
                      const animando = cartaRivalAnimando === i;

                      if (yaUsada && !animando) return <div key={i} className="w-14 h-20" />; // Espacio vacio

                      return paso?.mostrarCartasRival ? (
                        <CartaTutorial
                          key={i}
                          carta={c}
                          pequena
                          resaltada={paso?.cartaRivalJuega === i}
                          animarSalida={animando}
                        />
                      ) : (
                        <CartaOculta key={i} pequena animarSalida={animando} />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Mesa central - cartas jugadas */}
            <div className="flex justify-center items-center gap-8 h-24 mb-4">
              {/* Carta del rival en mesa */}
              <div className="w-14 h-20 flex items-center justify-center">
                {cartasEnMesa.rival && (
                  <div className="animate-[cartaAparece_0.3s_ease-out]">
                    <CartaTutorial carta={cartasEnMesa.rival} pequena />
                  </div>
                )}
              </div>

              {/* VS */}
              {(cartasEnMesa.jugador || cartasEnMesa.rival) && (
                <span className="text-gold-500/50 text-sm font-bold">VS</span>
              )}

              {/* Carta del jugador en mesa */}
              <div className="w-14 h-20 flex items-center justify-center">
                {cartasEnMesa.jugador && (
                  <div className="animate-[cartaAparece_0.3s_ease-out]">
                    <CartaTutorial carta={cartasEnMesa.jugador} pequena />
                  </div>
                )}
              </div>
            </div>

            {/* Tus cartas */}
            <div className="text-center">
              <p className="text-celeste-400/60 text-xs mb-2">TUS CARTAS</p>
              <div className="flex justify-center gap-4">
                {leccion.cartasJugador.map((carta, idx) => {
                  const yaUsada = cartasUsadas.includes(idx);
                  const animando = cartaAnimando === idx;

                  if (yaUsada && !animando) return <div key={idx} className="w-20 h-28 sm:w-24 sm:h-36" />; // Espacio vacio

                  return (
                    <CartaTutorial
                      key={idx}
                      carta={carta}
                      resaltada={paso?.cartasResaltadas?.includes(idx)}
                      seleccionable={
                        paso?.accion === 'seleccionar-carta' &&
                        !cartasUsadas.includes(idx) &&
                        !mostrarExplicacion &&
                        cartaAnimando === null
                      }
                      onClick={() => handleSeleccionarCarta(idx)}
                      animarSalida={animando}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Contenido del paso */}
        <div className="glass rounded-2xl p-6 border border-gold-800/20">
          <h3 className="text-celeste-400 font-bold text-xl mb-3">{paso?.titulo}</h3>
          <p className="text-gold-300/80 whitespace-pre-line mb-4">{paso?.descripcion}</p>

          {/* Cartas ilustrativas */}
          {paso?.cartasIlustrativas && paso.cartasIlustrativas.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-6 p-4 bg-black/20 rounded-xl">
              {paso.cartasIlustrativas.map((carta, idx) => (
                <CartaIlustrativaComponent key={idx} carta={carta} />
              ))}
            </div>
          )}

          {/* Explicacion (si acerto) */}
          {mostrarExplicacion && paso?.explicacion && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-6 animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <p className="text-green-300">{paso.explicacion}</p>
              </div>
            </div>
          )}

          {/* Mensaje de error */}
          {mensajeError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4 animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <p className="text-red-300">{mensajeError}</p>
              </div>
            </div>
          )}

          {/* Opciones de cantar */}
          {paso?.accion === 'cantar' && paso.opcionesCantar && !mostrarExplicacion && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {paso.opcionesCantar.map(opcion => (
                <button
                  key={opcion}
                  onClick={() => handleCantar(opcion)}
                  className="px-4 py-3 rounded-xl font-bold bg-gold-600/20 text-gold-300 hover:bg-gold-600/30 border border-gold-500/30 transition-all hover:scale-105"
                >
                  {opcion}
                </button>
              ))}
            </div>
          )}

          {/* Botones de navegacion */}
          {(paso?.accion === 'siguiente' || mostrarExplicacion) && (
            <div className="flex gap-3">
              {/* Boton Atras - solo si no es el primer paso */}
              {pasoActual > 0 && (
                <button
                  onClick={handleAtras}
                  className="px-6 py-4 rounded-xl font-bold bg-gold-900/30 text-gold-400 hover:bg-gold-900/50 border border-gold-700/30 hover:border-gold-600/50 transition-all"
                >
                  ← Atras
                </button>
              )}
              {/* Boton Siguiente */}
              <button
                onClick={handleSiguiente}
                className="flex-1 py-4 rounded-xl font-bold bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 transition-all shadow-lg shadow-celeste-600/20"
              >
                {pasoActual < (leccion?.pasos.length || 0) - 1 ? 'Siguiente →' : 'Finalizar Leccion'}
              </button>
            </div>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="mt-6 h-2 bg-gold-900/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-celeste-500 to-celeste-400 transition-all duration-500"
            style={{ width: `${((pasoActual + 1) / (leccion?.pasos.length || 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
