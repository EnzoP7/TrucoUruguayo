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

  decidirCarta(cartasMesa, manoActual, esPrimeraMano, jugadores = null, inicioManoActual = 0) {
    return new Promise((resolve) => {
      const tiempo = this.personalidad.impulsivo
        ? this.config.tiempoRespuestaMin
        : this.config.tiempoRespuestaMin + Math.random() * (this.config.tiempoRespuestaMax - this.config.tiempoRespuestaMin);

      setTimeout(() => {
        const carta = this._elegirCartaInteligente(cartasMesa, manoActual, esPrimeraMano, jugadores, inicioManoActual);
        resolve(carta);
      }, tiempo);
    });
  }

  _elegirCartaInteligente(cartasMesa, manoActual, esPrimeraMano, jugadores, inicioManoActual) {
    if (this.cartas.length === 0) return null;

    const ordenadas = this.ordenarCartasPorPoder();
    const { matas, altas } = this.clasificarMano();

    // Obtener cartas de la mano actual (usando inicioManoActual)
    const cartasManoActual = cartasMesa.slice(inicioManoActual);

    // Analizar contexto de equipo
    const contextoEquipo = this._analizarContextoEquipo(cartasManoActual, jugadores);

    // === CASO: MI EQUIPO YA VA GANANDO Y SOY EL ÚLTIMO ===
    if (contextoEquipo.equipoGanando && contextoEquipo.todosYaTiraron) {
      // Mi equipo tiene la carta más alta, tirar la peor
      return ordenadas[ordenadas.length - 1];
    }

    // Encontrar la carta más alta del rival en esta mano
    const cartaRivalMasAlta = this._getCartaRivalMasAlta(cartasManoActual, jugadores);

    // === CASO 1: SOY EL PRIMERO EN TIRAR ===
    if (!cartaRivalMasAlta) {
      return this._elegirCartaComoMano(ordenadas, manoActual, esPrimeraMano, matas, altas);
    }

    // === CASO 2: DEBO RESPONDER A UNA CARTA ===
    return this._elegirCartaComoRespuesta(ordenadas, cartaRivalMasAlta, manoActual);
  }

  // Analizar si el equipo del bot ya va ganando la mano actual
  _analizarContextoEquipo(cartasManoActual, jugadores) {
    if (!jugadores || cartasManoActual.length === 0) {
      return { equipoGanando: false, todosYaTiraron: false };
    }

    // Contar cuántos jugadores activos hay y cuántos ya tiraron
    const jugadoresActivos = jugadores.filter(j => j.participaRonda !== false && !j.seVaAlMazo);
    const totalActivos = jugadoresActivos.length;
    // El bot aún no tiró, así que las cartas en mesa son de otros
    const yaTiraron = cartasManoActual.length;
    // Si todos los demás ya tiraron, el bot es el último
    const todosYaTiraron = yaTiraron === totalActivos - 1;

    if (!todosYaTiraron || yaTiraron === 0) {
      return { equipoGanando: false, todosYaTiraron: false };
    }

    // Encontrar la carta más alta en la mesa
    let mejorPoder = -1;
    let equipoMejorCarta = null;

    cartasManoActual.forEach(cm => {
      const poder = this.getPoderCarta(cm.carta);
      const jugador = jugadores.find(j => j.id === cm.jugadorId);
      if (poder > mejorPoder) {
        mejorPoder = poder;
        equipoMejorCarta = jugador?.equipo;
      } else if (poder === mejorPoder && jugador?.equipo !== equipoMejorCarta) {
        // Empate entre equipos diferentes - no está claro quién gana
        equipoMejorCarta = null;
      }
    });

    return {
      equipoGanando: equipoMejorCarta === this.equipo,
      todosYaTiraron: true,
    };
  }

  // Obtener la carta más alta del rival en la mano actual
  _getCartaRivalMasAlta(cartasManoActual, jugadores) {
    if (!cartasManoActual || cartasManoActual.length === 0) return null;

    let mejorCartaRival = null;
    let mejorPoderRival = -1;

    cartasManoActual.forEach(cm => {
      const jugador = jugadores ? jugadores.find(j => j.id === cm.jugadorId) : null;
      const esRival = jugador ? jugador.equipo !== this.equipo : cm.jugadorId !== this.id;

      if (esRival) {
        const poder = this.getPoderCarta(cm.carta);
        if (poder > mejorPoderRival) {
          mejorPoderRival = poder;
          mejorCartaRival = cm.carta;
        }
      }
    });

    return mejorCartaRival;
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

  _elegirCartaComoRespuesta(ordenadas, cartaOponente, manoActual) {
    const poderOponente = this.getPoderCarta(cartaOponente);
    const voyPerdiendo = this.manosGanadas[0] < this.manosGanadas[1];
    const voyGanando = this.manosGanadas[0] > this.manosGanadas[1];

    // Buscar cartas que le ganen
    const cartasQueGanan = ordenadas.filter(c => this.getPoderCarta(c) > poderOponente);
    // Buscar cartas que empaten
    const cartasQueEmpatan = ordenadas.filter(c => this.getPoderCarta(c) === poderOponente);

    // === LÓGICA INTELIGENTE: NO DESPERDICIAR CARTAS ===

    if (cartasQueGanan.length > 0) {
      // Tengo cartas que ganan
      const cartaMasBajaQueGana = cartasQueGanan[cartasQueGanan.length - 1];
      const poderCartaMasBaja = this.getPoderCarta(cartaMasBajaQueGana);
      const diferenciaPoder = poderCartaMasBaja - poderOponente;

      // === SITUACIÓN CRÍTICA: VOY PERDIENDO, NECESITO GANAR ===
      // Si ya perdí una mano y debo ganar esta, SIEMPRE jugar para ganar
      if (voyPerdiendo) {
        return cartaMasBajaQueGana; // Usar la más baja que gane (eficiente pero segura)
      }

      // Si la carta del oponente es muy baja (4, 5, 6) y mi carta más baja que gana es alta (3, 2, 1)
      // evaluar si vale la pena
      if (poderOponente <= 3 && poderCartaMasBaja >= CARTA_ALTA) {
        // El oponente tiró basura

        // Si voy ganando la ronda, no desperdiciar
        if (voyGanando) {
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
      // o si estamos empatados, usar la carta más baja que gane
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
      // Si voy ganando la ronda o empatados, empatar me sirve
      if (this.manosGanadas[0] >= this.manosGanadas[1]) {
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

        // Probabilidad base según puntos de envido (más agresivo)
        if (envido >= 31) probabilidad = 0.98;
        else if (envido >= 29) probabilidad = 0.92;
        else if (envido >= 27) probabilidad = 0.85;
        else if (envido >= 25) probabilidad = 0.75;
        else if (envido >= 23) probabilidad = 0.60;
        else if (envido >= 20) probabilidad = 0.40 + mentiroso * 0.3; // Farol
        else probabilidad = 0.15 + mentiroso * 0.25; // Farol con envido malo

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
          // ===== MAXIMIZAR PUNTOS: Escalar envido con buenos puntos =====
          let tipo = 'envido';

          // Con envido excelente (33): ir directo a falta envido
          if (envido === 33) {
            if (Math.random() < 0.70) tipo = 'falta_envido';
            else if (Math.random() < 0.85) tipo = 'real_envido';
          }
          // Con envido muy bueno (31-32): alta chance de escalar
          else if (envido >= 31) {
            if (Math.random() < 0.50) tipo = 'falta_envido';
            else if (Math.random() < 0.70) tipo = 'real_envido';
          }
          // Con envido bueno (29-30): considerar real envido
          else if (envido >= 29) {
            if (Math.random() < 0.55) tipo = 'real_envido';
            else if (Math.random() < 0.25) tipo = 'falta_envido';
          }
          // Con envido decente (27-28): a veces real envido
          else if (envido >= 27) {
            if (Math.random() < 0.35) tipo = 'real_envido';
          }

          // ===== FAROLEO: Mentir con envido malo =====
          if (envido < 25 && mentiroso > 0.2) {
            const chanceFarol = mentiroso * 0.6;
            if (Math.random() < chanceFarol) {
              // Farol agresivo: real envido o falta envido
              tipo = Math.random() < 0.6 ? 'real_envido' : 'falta_envido';
            }
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

        // ===== MAXIMIZAR PUNTOS: Escalar cuando tengo buen envido =====
        let escalar = null;

        if (acepta) {
          // Envido excelente (33): ir a falta envido
          if (envido === 33) {
            if (tipoEnvido === 'envido' && Math.random() < 0.80) escalar = 'real_envido';
            if (tipoEnvido === 'real_envido' && Math.random() < 0.70) escalar = 'falta_envido';
            if (tipoEnvido === 'envido' && Math.random() < 0.50) escalar = 'falta_envido'; // Saltar directo
          }
          // Envido muy bueno (31-32)
          else if (envido >= 31) {
            if (tipoEnvido === 'envido' && Math.random() < 0.65) escalar = 'real_envido';
            if (tipoEnvido === 'real_envido' && Math.random() < 0.50) escalar = 'falta_envido';
          }
          // Envido bueno (29-30)
          else if (envido >= 29) {
            if (tipoEnvido === 'envido' && Math.random() < 0.50) escalar = 'real_envido';
            if (tipoEnvido === 'real_envido' && Math.random() < 0.30) escalar = 'falta_envido';
          }
          // Envido decente (27-28)
          else if (envido >= 27) {
            if (tipoEnvido === 'envido' && Math.random() < 0.35) escalar = 'real_envido';
          }

          // ===== FAROLEO: Escalar con envido malo para asustar =====
          if (envido < 25 && mentiroso > 0.15) {
            const chanceFarol = mentiroso * 0.7;
            if (Math.random() < chanceFarol) {
              escalar = tipoEnvido === 'envido' ? 'real_envido' : 'falta_envido';
            }
          }
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

        // ===== ESTRATEGIA: Cantar según fuerza de mano =====
        // Con mano fuerte: cantar para maximizar puntos
        if (fuerza >= 70) probabilidad = 0.95;      // Mano excelente, casi siempre cantar
        else if (fuerza >= 55) probabilidad = 0.80; // Mano muy buena
        else if (fuerza >= 40) probabilidad = 0.55; // Mano buena
        else if (fuerza >= 30) probabilidad = 0.30; // Mano regular
        else probabilidad = mentiroso * 0.50;       // Mano mala: farol según personalidad

        // Ajustar por agresividad
        probabilidad *= (0.6 + agresividad * 0.8);

        // Si voy ganando las manos, más probable (tengo ventaja)
        if (this.manosGanadas[0] > this.manosGanadas[1]) {
          probabilidad *= 1.4;
        }

        // ===== ESCALAR: Con buena mano, buscar retruco/vale4 =====
        if (nivelActual === 'truco') {
          // Para cantar retruco: solo si tengo buena mano
          if (fuerza >= 60) {
            probabilidad *= 0.95; // Casi no reduce, mano fuerte
          } else if (fuerza >= 45) {
            probabilidad *= 0.75; // Reduce un poco
          } else {
            // Mano mala pero soy mentiroso? Farol de retruco
            probabilidad = mentiroso * 0.6;
          }
        }
        if (nivelActual === 'retruco') {
          // Para cantar vale4: necesito mano muy fuerte o ser muy mentiroso
          if (fuerza >= 65) {
            probabilidad *= 0.90; // Casi no reduce
          } else if (fuerza >= 50) {
            probabilidad *= 0.65;
          } else {
            // Farol de vale4 con mano mala
            probabilidad = mentiroso * 0.45;
          }
        }

        const cantar = Math.random() < Math.min(0.95, probabilidad);

        if (cantar) {
          let tipo = 'truco';
          if (nivelActual === 'truco') tipo = 'retruco';
          if (nivelActual === 'retruco' || nivelActual === 'vale4') tipo = 'vale4';
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

        // ===== MAXIMIZAR PUNTOS: Escalar cuando tengo buena mano =====
        let escalar = null;

        // Con mano MUY fuerte (fuerza >= 65): SIEMPRE intentar sacar el máximo
        if (acepta && fuerza >= 65) {
          if (tipoTruco === 'truco') {
            // 85% chance de retruco con mano muy fuerte
            escalar = Math.random() < 0.85 ? 'retruco' : null;
          } else if (tipoTruco === 'retruco') {
            // 75% chance de vale4 con mano muy fuerte
            escalar = Math.random() < 0.75 ? 'vale4' : null;
          }
        }
        // Con mano fuerte (fuerza >= 50): Alta probabilidad de escalar
        else if (acepta && fuerza >= 50) {
          if (tipoTruco === 'truco' && Math.random() < 0.70) {
            escalar = 'retruco';
          } else if (tipoTruco === 'retruco' && Math.random() < 0.60) {
            escalar = 'vale4';
          }
        }
        // Con mano decente (fuerza >= 35): A veces escalar
        else if (acepta && fuerza >= 35) {
          if (tipoTruco === 'truco' && Math.random() < 0.40) {
            escalar = 'retruco';
          } else if (tipoTruco === 'retruco' && Math.random() < 0.30) {
            escalar = 'vale4';
          }
        }

        // ===== FAROLEO: Mentir con mano mala para asustar =====
        // Si tengo mano mala pero soy mentiroso, puedo escalar de farol
        if (acepta && fuerza < 35 && mentiroso > 0.1) {
          const chanceDefarol = mentiroso * 0.8; // Más mentiroso = más faroles
          if (Math.random() < chanceDefarol) {
            if (tipoTruco === 'truco') {
              escalar = 'retruco';
            } else if (tipoTruco === 'retruco') {
              escalar = 'vale4';
            }
          }
        }

        resolve({ acepta, escalar });
      }, tiempo);
    });
  }

  // ============================================
  // FLOR - Decisiones de canto y respuesta
  // ============================================

  /**
   * Verifica si el bot tiene flor (3 cartas del mismo palo)
   * Nota: Las reglas de piezas se manejan en el servidor
   */
  tieneFlor() {
    if (this.cartas.length !== 3) return false;
    const primerPalo = this.cartas[0].palo;
    return this.cartas.every(c => c.palo === primerPalo);
  }

  /**
   * Calcula los puntos de flor del bot
   * Para flor por palo: suma de valores + 20
   */
  calcularPuntosFlor() {
    if (!this.tieneFlor()) return 0;
    let suma = 0;
    this.cartas.forEach(c => {
      suma += (c.valor >= 10 ? 0 : c.valor);
    });
    return suma + 20;
  }

  /**
   * Decide si responder a una flor cantada por el oponente
   * @param {string} tipoFlor - 'flor', 'contra_flor', 'con_flor_envido', 'contra_flor_al_resto'
   * @param {number} misPuntosFlor - Puntos de flor del bot (si tiene)
   * @returns {Promise<{acepta: boolean, escalar: string|null}>}
   */
  decidirResponderFlor(tipoFlor, misPuntosFlor = null) {
    return new Promise((resolve) => {
      const tiempo = this.config.tiempoCantoMin +
        Math.random() * (this.config.tiempoCantoMax - this.config.tiempoCantoMin);

      setTimeout(() => {
        // Si no tengo flor, no puedo responder (el servidor maneja esto)
        const tengoFlor = this.tieneFlor();
        const puntosFlor = misPuntosFlor || this.calcularPuntosFlor();
        const mentiroso = this.personalidad.mentiroso;
        const agresividad = this.personalidad.agresividad;

        let probabilidad = 0;

        // === LÓGICA DE ACEPTACIÓN SEGÚN PUNTOS DE FLOR ===
        // Flor máxima posible: 38 (7+7+4 del mismo palo + 20)
        // Flor promedio buena: 30-34
        // Flor promedio normal: 25-29

        if (puntosFlor >= 36) probabilidad = 0.98;
        else if (puntosFlor >= 33) probabilidad = 0.90;
        else if (puntosFlor >= 30) probabilidad = 0.75;
        else if (puntosFlor >= 27) probabilidad = 0.55;
        else if (puntosFlor >= 24) probabilidad = 0.35;
        else if (puntosFlor >= 21) probabilidad = 0.20;
        else probabilidad = 0.05 + mentiroso * 0.15; // Farol

        // Ajustar por tipo de flor (más puntos en juego = más conservador)
        if (tipoFlor === 'contra_flor') {
          probabilidad *= 0.80;
        } else if (tipoFlor === 'con_flor_envido') {
          probabilidad *= 0.75;
        } else if (tipoFlor === 'contra_flor_al_resto') {
          probabilidad *= 0.50; // Muy arriesgado
          if (puntosFlor < 30) probabilidad *= 0.5;
        }

        const acepta = Math.random() < probabilidad;

        // === DECISIÓN DE ESCALAR ===
        let escalar = null;

        if (acepta && tengoFlor) {
          // Con flor excelente (35+): escalar agresivamente
          if (puntosFlor >= 35) {
            if (tipoFlor === 'flor' && Math.random() < 0.70) escalar = 'contra_flor';
            if (tipoFlor === 'contra_flor' && Math.random() < 0.60) escalar = 'contra_flor_al_resto';
          }
          // Con flor muy buena (32-34): considerar escalar
          else if (puntosFlor >= 32) {
            if (tipoFlor === 'flor' && Math.random() < 0.50) escalar = 'contra_flor';
            if (tipoFlor === 'contra_flor' && Math.random() < 0.35) escalar = 'contra_flor_al_resto';
          }
          // Con flor buena (29-31): a veces escalar
          else if (puntosFlor >= 29) {
            if (tipoFlor === 'flor' && Math.random() < 0.30 * agresividad) escalar = 'contra_flor';
          }

          // === FAROLEO ===
          if (puntosFlor < 27 && mentiroso > 0.2) {
            const chanceFarol = mentiroso * 0.5;
            if (Math.random() < chanceFarol) {
              if (tipoFlor === 'flor') escalar = 'contra_flor';
              else if (tipoFlor === 'contra_flor') escalar = 'contra_flor_al_resto';
            }
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
