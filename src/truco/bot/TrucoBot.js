/**
 * TrucoBot - Inteligencia Artificial Avanzada para Truco Uruguayo
 *
 * Características:
 * - Juega estratégicamente sin desperdiciar cartas buenas
 * - Canta envido y truco de forma realista
 * - Tiene personalidad variable (a veces mentiroso, a veces conservador)
 * - Considera el contexto del juego (puntos, manos ganadas, etc.)
 * - Responde rápido para no hacer esperar
 */

const PODER_CARTAS = {
  // Matas (cartas especiales)
  'espada-1': 14, 'basto-1': 13, 'espada-7': 12, 'oro-7': 11,
  // Treses
  'oro-3': 10, 'copa-3': 10, 'espada-3': 10, 'basto-3': 10,
  // Doses
  'oro-2': 9, 'copa-2': 9, 'espada-2': 9, 'basto-2': 9,
  // Ases (no matas)
  'oro-1': 8, 'copa-1': 8,
  // Doces
  'oro-12': 7, 'copa-12': 7, 'espada-12': 7, 'basto-12': 7,
  // Onces
  'oro-11': 6, 'copa-11': 6, 'espada-11': 6, 'basto-11': 6,
  // Dieces
  'oro-10': 5, 'copa-10': 5, 'espada-10': 5, 'basto-10': 5,
  // Sietes (no matas)
  'copa-7': 4, 'basto-7': 4,
  // Seises
  'oro-6': 3, 'copa-6': 3, 'espada-6': 3, 'basto-6': 3,
  // Cincos
  'oro-5': 2, 'copa-5': 2, 'espada-5': 2, 'basto-5': 2,
  // Cuatros
  'oro-4': 1, 'copa-4': 1, 'espada-4': 1, 'basto-4': 1,
};

const VALOR_ENVIDO = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
  10: 0, 11: 0, 12: 0,
};

// Umbrales para clasificar cartas
const CARTA_ALTA = 10;    // 3s o mejor
const CARTA_MEDIA = 7;    // 12s o mejor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CARTA_BAJA = 4;     // 7s falsos o peor (reservado para futuras mejoras)

class TrucoBot {
  constructor(nombre, dificultad = 'dificil') {
    this.nombre = nombre;
    this.dificultad = dificultad;
    this.cartas = [];
    this.cartasOriginales = []; // Para recordar con qué empezamos
    this.equipo = 1;
    this.id = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estado del juego
    this.manosGanadas = [0, 0]; // [miEquipo, oponente]
    this.puntosJuego = [0, 0];
    this.cartasJugadasEnRonda = [];

    // Personalidad para esta ronda (se regenera cada ronda)
    this.personalidad = this.generarPersonalidad();

    // Configuración según dificultad
    this.config = this.getConfig();
  }

  generarPersonalidad() {
    // Genera una personalidad aleatoria para esta ronda
    return {
      agresividad: 0.3 + Math.random() * 0.5,      // 0.3-0.8: qué tan probable es que cante
      mentiroso: Math.random() * 0.4,               // 0-0.4: probabilidad de farolear
      conservador: 0.2 + Math.random() * 0.4,       // 0.2-0.6: qué tanto cuida las cartas buenas
      impulsivo: Math.random() < 0.3,               // 30% de ser impulsivo (decide rápido)
    };
  }

  getConfig() {
    // Tiempos más rápidos para mejor experiencia
    return {
      tiempoRespuestaMin: 400,  // Mínimo 400ms
      tiempoRespuestaMax: 1200, // Máximo 1.2s
      tiempoCantoMin: 600,      // Para cantos un poco más
      tiempoCantoMax: 1500,
    };
  }

  // Establecer las cartas del bot
  setCartas(cartas) {
    this.cartas = [...cartas];
    if (this.cartasOriginales.length === 0 || cartas.length === 3) {
      this.cartasOriginales = [...cartas];
      // Nueva ronda, nueva personalidad
      this.personalidad = this.generarPersonalidad();
    }
  }

  // Calcular el poder de una carta
  getPoderCarta(carta) {
    if (!carta) return 0;
    const key = `${carta.palo}-${carta.valor}`;
    return PODER_CARTAS[key] || carta.poder || 0;
  }

  // Ordenar cartas por poder (mayor a menor)
  ordenarCartasPorPoder(cartas = null) {
    const lista = cartas || this.cartas;
    return [...lista].sort((a, b) => this.getPoderCarta(b) - this.getPoderCarta(a));
  }

  // Clasificar la mano
  clasificarMano() {
    const ordenadas = this.ordenarCartasPorPoder();
    let matas = 0, altas = 0, medias = 0, bajas = 0;

    ordenadas.forEach(c => {
      const poder = this.getPoderCarta(c);
      if (poder >= 11) matas++;
      else if (poder >= CARTA_ALTA) altas++;
      else if (poder >= CARTA_MEDIA) medias++;
      else bajas++;
    });

    return { matas, altas, medias, bajas, ordenadas };
  }

  // Calcular puntos de envido
  calcularEnvido() {
    if (this.cartas.length === 0) return 0;

    const porPalo = {};
    this.cartas.forEach(c => {
      if (!porPalo[c.palo]) porPalo[c.palo] = [];
      porPalo[c.palo].push(c);
    });

    let mejorEnvido = 0;
    for (const [, cartasPalo] of Object.entries(porPalo)) {
      if (cartasPalo.length >= 2) {
        const valores = cartasPalo
          .map(c => VALOR_ENVIDO[c.valor] || 0)
          .sort((a, b) => b - a);
        const envido = 20 + valores[0] + valores[1];
        mejorEnvido = Math.max(mejorEnvido, envido);
      } else if (cartasPalo.length === 1) {
        const valor = VALOR_ENVIDO[cartasPalo[0].valor] || 0;
        mejorEnvido = Math.max(mejorEnvido, valor);
      }
    }
    return mejorEnvido;
  }

  // Evaluar fuerza de la mano para truco (0-100)
  evaluarFuerzaMano() {
    const { matas, altas, ordenadas } = this.clasificarMano();
    let puntuacion = 0;

    // Puntos base por cartas
    ordenadas.forEach((carta, idx) => {
      const poder = this.getPoderCarta(carta);
      const peso = idx === 0 ? 3 : idx === 1 ? 2 : 1;
      puntuacion += poder * peso;
    });

    // Bonus por matas
    if (matas >= 2) puntuacion += 25;
    else if (matas === 1) puntuacion += 12;

    // Bonus por combinación de cartas altas
    if (altas >= 2) puntuacion += 10;
    if (matas >= 1 && altas >= 1) puntuacion += 8;

    // Normalizar a 0-100
    return Math.min(100, Math.max(0, puntuacion));
  }

  // ============================================
  // DECISIÓN DE CARTA - LÓGICA INTELIGENTE
  // ============================================

  decidirCarta(cartasMesa, manoActual, esPrimeraMano) {
    return new Promise((resolve) => {
      const tiempo = this.personalidad.impulsivo
        ? this.config.tiempoRespuestaMin
        : this.config.tiempoRespuestaMin + Math.random() * (this.config.tiempoRespuestaMax - this.config.tiempoRespuestaMin);

      setTimeout(() => {
        const carta = this._elegirCartaInteligente(cartasMesa, manoActual, esPrimeraMano);
        resolve(carta);
      }, tiempo);
    });
  }

  _elegirCartaInteligente(cartasMesa, manoActual, esPrimeraMano) {
    if (this.cartas.length === 0) return null;

    const ordenadas = this.ordenarCartasPorPoder();
    const { matas, altas } = this.clasificarMano();

    // Encontrar la carta del oponente en esta mano (si la hay)
    const cartaOponenteActual = this._getCartaOponenteEnManoActual(cartasMesa, manoActual);

    // === CASO 1: SOY EL PRIMERO EN TIRAR ===
    if (!cartaOponenteActual) {
      return this._elegirCartaComoMano(ordenadas, manoActual, esPrimeraMano, matas, altas);
    }

    // === CASO 2: DEBO RESPONDER A UNA CARTA ===
    return this._elegirCartaComoRespuesta(ordenadas, cartaOponenteActual);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _getCartaOponenteEnManoActual(cartasMesa, _manoActual) {
    // Las cartas de la mano actual están al final del array
    // Cada mano tiene N cartas donde N = cantidad de jugadores
    const cartasEstaMano = cartasMesa.filter(c => {
      // Buscar cartas que no sean mías en esta mano
      return c.jugadorId !== this.id;
    });

    // La última carta del oponente es la que debo responder
    if (cartasEstaMano.length > 0) {
      const ultima = cartasEstaMano[cartasEstaMano.length - 1];
      return ultima?.carta || null;
    }
    return null;
  }

  _elegirCartaComoMano(ordenadas, manoActual, esPrimeraMano, matas, altas) {
    const conservador = this.personalidad.conservador;

    // Primera mano: estrategia de apertura
    if (esPrimeraMano || manoActual === 1) {
      // Si tengo muy buenas cartas, puedo tirar la mejor para presionar
      if (matas >= 2 || (matas === 1 && altas >= 1)) {
        // Tirar la segunda mejor para guardar la mata
        return ordenadas.length >= 2 ? ordenadas[1] : ordenadas[0];
      }

      // Si tengo cartas mediocres, tirar la del medio
      if (ordenadas.length >= 2) {
        return ordenadas[1]; // Segunda mejor
      }
      return ordenadas[0];
    }

    // Segunda o tercera mano
    if (this.manosGanadas[0] > this.manosGanadas[1]) {
      // Voy ganando: puedo tirar la peor para ahorrar
      return ordenadas[ordenadas.length - 1];
    } else if (this.manosGanadas[0] < this.manosGanadas[1]) {
      // Voy perdiendo: necesito ganar esta
      return ordenadas[0]; // Tirar la mejor
    } else {
      // Empatados: depende de si soy conservador
      if (Math.random() < conservador) {
        return ordenadas.length >= 2 ? ordenadas[1] : ordenadas[0];
      }
      return ordenadas[0];
    }
  }

  _elegirCartaComoRespuesta(ordenadas, cartaOponente) {
    const poderOponente = this.getPoderCarta(cartaOponente);

    // Buscar cartas que le ganen
    const cartasQueGanan = ordenadas.filter(c => this.getPoderCarta(c) > poderOponente);
    // Buscar cartas que empaten
    const cartasQueEmpatan = ordenadas.filter(c => this.getPoderCarta(c) === poderOponente);

    // === LÓGICA INTELIGENTE: NO DESPERDICIAR CARTAS ===

    if (cartasQueGanan.length > 0) {
      // Tengo cartas que ganan

      // ¿Vale la pena ganar esta mano?
      const diferenciaPoder = this.getPoderCarta(cartasQueGanan[cartasQueGanan.length - 1]) - poderOponente;
      const cartaMasBajaQueGana = cartasQueGanan[cartasQueGanan.length - 1];
      const poderCartaMasBaja = this.getPoderCarta(cartaMasBajaQueGana);

      // Si la carta del oponente es muy baja (4, 5, 6) y mi carta más baja que gana es alta (3, 2, 1)
      // evaluar si vale la pena
      if (poderOponente <= 3 && poderCartaMasBaja >= CARTA_ALTA) {
        // El oponente tiró basura

        // Si voy ganando la ronda, no desperdiciar
        if (this.manosGanadas[0] > this.manosGanadas[1]) {
          // Tirar mi peor carta, perder esta mano no importa
          return ordenadas[ordenadas.length - 1];
        }

        // Si es primera mano y tengo buenas cartas, considerar perder para guardarlas
        if (manoActual === 1 && this.cartas.length === 3) {
          const { matas, altas } = this.clasificarMano();
          if (matas >= 1 || altas >= 2) {
            // Tengo buenas cartas, mejor perder esta con basura
            const cartasQuePierden = ordenadas.filter(c => this.getPoderCarta(c) <= poderOponente);
            if (cartasQuePierden.length > 0) {
              return cartasQuePierden[cartasQuePierden.length - 1];
            }
          }
        }
      }

      // Si la diferencia de poder es razonable (no estoy desperdiciando mucho)
      // o si necesito ganar esta mano, usar la carta más baja que gane
      if (diferenciaPoder <= 3 || this.manosGanadas[0] <= this.manosGanadas[1]) {
        return cartaMasBajaQueGana;
      }

      // Si la diferencia es grande, evaluar si tengo algo intermedio
      // Buscar una carta que gane sin desperdiciar tanto
      for (let i = cartasQueGanan.length - 1; i >= 0; i--) {
        const carta = cartasQueGanan[i];
        const diff = this.getPoderCarta(carta) - poderOponente;
        if (diff <= 4) {
          return carta; // Esta carta no desperdicia tanto
        }
      }

      // No hay opción intermedia, usar la más baja que gane
      return cartaMasBajaQueGana;
    }

    if (cartasQueEmpatan.length > 0) {
      // Puedo empatar - a veces conviene
      // Si voy ganando la ronda, empatar me sirve
      if (this.manosGanadas[0] > this.manosGanadas[1]) {
        return cartasQueEmpatan[0];
      }
    }

    // No puedo ganar ni empatar - tirar la peor
    return ordenadas[ordenadas.length - 1];
  }

  // ============================================
  // DECISIONES DE CANTOS
  // ============================================

  decidirCantarEnvido(envidoYaCantado, puntosEquipo1, puntosEquipo2) {
    return new Promise((resolve) => {
      if (envidoYaCantado) {
        resolve({ cantar: false });
        return;
      }

      const tiempo = this.config.tiempoCantoMin +
        Math.random() * (this.config.tiempoCantoMax - this.config.tiempoCantoMin);

      setTimeout(() => {
        const envido = this.calcularEnvido();
        const agresividad = this.personalidad.agresividad;
        const mentiroso = this.personalidad.mentiroso;

        let probabilidad = 0;

        // Probabilidad base según puntos de envido
        if (envido >= 31) probabilidad = 0.95;
        else if (envido >= 29) probabilidad = 0.85;
        else if (envido >= 27) probabilidad = 0.70;
        else if (envido >= 25) probabilidad = 0.50;
        else if (envido >= 23) probabilidad = 0.30;
        else if (envido >= 20) probabilidad = 0.15 + mentiroso * 0.3; // Farol
        else probabilidad = mentiroso * 0.2; // Solo si soy mentiroso

        // Ajustar por agresividad
        probabilidad *= (0.7 + agresividad * 0.6);

        // Ajustar por situación del juego
        const misPuntos = this.equipo === 1 ? puntosEquipo1 : puntosEquipo2;
        const susPuntos = this.equipo === 1 ? puntosEquipo2 : puntosEquipo1;

        if (susPuntos > misPuntos + 10) {
          // Voy perdiendo, ser más agresivo
          probabilidad *= 1.2;
        }

        const cantar = Math.random() < Math.min(0.95, probabilidad);

        if (cantar) {
          // Decidir qué tipo de envido
          let tipo = 'envido';
          if (envido >= 31 && Math.random() < 0.4) tipo = 'real_envido';
          if (envido >= 33 && Math.random() < 0.3) tipo = 'falta_envido';
          // Farol con falta envido
          if (envido < 25 && mentiroso > 0.3 && Math.random() < mentiroso * 0.3) {
            tipo = 'falta_envido';
          }

          resolve({ cantar: true, tipo });
        } else {
          resolve({ cantar: false });
        }
      }, tiempo);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decidirResponderEnvido(tipoEnvido, _puntosEnJuego = 2) {
    return new Promise((resolve) => {
      const tiempo = this.config.tiempoCantoMin +
        Math.random() * (this.config.tiempoCantoMax - this.config.tiempoCantoMin);

      setTimeout(() => {
        const envido = this.calcularEnvido();
        const mentiroso = this.personalidad.mentiroso;
        let probabilidad = 0;

        // Probabilidad según mis puntos
        if (envido >= 30) probabilidad = 0.95;
        else if (envido >= 28) probabilidad = 0.85;
        else if (envido >= 26) probabilidad = 0.70;
        else if (envido >= 24) probabilidad = 0.55;
        else if (envido >= 22) probabilidad = 0.40;
        else if (envido >= 20) probabilidad = 0.25;
        else probabilidad = 0.10 + mentiroso * 0.25; // Farolear aceptando con envido malo

        // Reducir si es falta envido
        if (tipoEnvido === 'falta_envido') {
          probabilidad *= 0.7;
          if (envido < 27) probabilidad *= 0.5;
        }

        // Reducir si es real envido
        if (tipoEnvido === 'real_envido') {
          probabilidad *= 0.85;
        }

        const acepta = Math.random() < probabilidad;

        // Considerar subir (incluso de farol)
        let escalar = null;
        if (acepta && envido >= 29 && tipoEnvido === 'envido' && Math.random() < 0.4) {
          escalar = 'real_envido';
        }
        if (acepta && envido >= 31 && Math.random() < 0.3) {
          escalar = 'falta_envido';
        }
        // Farol: subir con envido malo para asustar
        if (acepta && envido < 25 && mentiroso > 0.25 && Math.random() < mentiroso * 0.4) {
          escalar = tipoEnvido === 'envido' ? 'real_envido' : 'falta_envido';
        }

        resolve({ acepta, escalar });
      }, tiempo);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decidirCantarTruco(nivelActual, _puntosEquipo1, _puntosEquipo2) {
    return new Promise((resolve) => {
      const tiempo = this.config.tiempoCantoMin +
        Math.random() * (this.config.tiempoCantoMax - this.config.tiempoCantoMin);

      setTimeout(() => {
        const fuerza = this.evaluarFuerzaMano();
        const agresividad = this.personalidad.agresividad;
        const mentiroso = this.personalidad.mentiroso;

        let probabilidad = 0;

        // Probabilidad base según fuerza
        if (fuerza >= 70) probabilidad = 0.90;
        else if (fuerza >= 55) probabilidad = 0.70;
        else if (fuerza >= 40) probabilidad = 0.45;
        else if (fuerza >= 30) probabilidad = 0.25;
        else probabilidad = mentiroso * 0.35; // Solo farol

        // Ajustar por agresividad
        probabilidad *= (0.6 + agresividad * 0.8);

        // Si voy ganando las manos, más probable
        if (this.manosGanadas[0] > this.manosGanadas[1]) {
          probabilidad *= 1.3;
        }

        // Reducir si ya hay truco/retruco
        if (nivelActual === 'truco') probabilidad *= 0.6;
        if (nivelActual === 'retruco') probabilidad *= 0.4;

        const cantar = Math.random() < Math.min(0.90, probabilidad);

        if (cantar) {
          let tipo = 'truco';
          if (nivelActual === 'truco') tipo = 'retruco';
          if (nivelActual === 'retruco') tipo = 'vale_cuatro';
          resolve({ cantar: true, tipo });
        } else {
          resolve({ cantar: false });
        }
      }, tiempo);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decidirResponderTruco(tipoTruco, _puntosEnJuego = 2) {
    return new Promise((resolve) => {
      const tiempo = this.config.tiempoCantoMin +
        Math.random() * (this.config.tiempoCantoMax - this.config.tiempoCantoMin);

      setTimeout(() => {
        const fuerza = this.evaluarFuerzaMano();
        const mentiroso = this.personalidad.mentiroso;
        let probabilidad = 0;

        // Probabilidad según fuerza
        if (fuerza >= 65) probabilidad = 0.95;
        else if (fuerza >= 50) probabilidad = 0.80;
        else if (fuerza >= 40) probabilidad = 0.60;
        else if (fuerza >= 30) probabilidad = 0.40;
        else if (fuerza >= 20) probabilidad = 0.25;
        else probabilidad = 0.10 + mentiroso * 0.3; // Farolear aceptando con mano mala

        // Reducir para niveles más altos
        if (tipoTruco === 'retruco') probabilidad *= 0.80;
        if (tipoTruco === 'vale_cuatro' || tipoTruco === 'vale4') probabilidad *= 0.65;

        // Si voy ganando las manos, más probable aceptar
        if (this.manosGanadas[0] > this.manosGanadas[1]) {
          probabilidad *= 1.2;
        } else if (this.manosGanadas[0] < this.manosGanadas[1]) {
          probabilidad *= 0.8;
        }

        const acepta = Math.random() < probabilidad;

        // Considerar subir (re-truco, vale 4)
        let escalar = null;
        if (acepta && fuerza >= 55) {
          if (tipoTruco === 'truco' && Math.random() < 0.35) {
            escalar = 'retruco';
          } else if (tipoTruco === 'retruco' && Math.random() < 0.25) {
            escalar = 'vale_cuatro';
          }
        }
        // Farol: subir con mano mala para asustar al rival
        if (acepta && fuerza < 40 && mentiroso > 0.2 && Math.random() < mentiroso * 0.5) {
          if (tipoTruco === 'truco') {
            escalar = 'retruco';
          } else if (tipoTruco === 'retruco') {
            escalar = 'vale_cuatro';
          }
        }

        resolve({ acepta, escalar });
      }, tiempo);
    });
  }

  // ============================================
  // UTILIDADES
  // ============================================

  registrarResultadoMano(ganador) {
    if (ganador === this.equipo) {
      this.manosGanadas[0]++;
    } else if (ganador !== null) {
      this.manosGanadas[1]++;
    }
  }

  resetearRonda() {
    this.cartasJugadasEnRonda = [];
    this.manosGanadas = [0, 0];
    this.cartasOriginales = [];
    // Nueva personalidad para la próxima ronda
    this.personalidad = this.generarPersonalidad();
  }

  quitarCarta(carta) {
    const idx = this.cartas.findIndex(c => c.palo === carta.palo && c.valor === carta.valor);
    if (idx !== -1) {
      this.cartas.splice(idx, 1);
    }
  }
}

module.exports = TrucoBot;
