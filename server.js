require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const { initDB, guardarPartida, obtenerEstadisticas, obtenerRanking, obtenerHistorial, obtenerAmigos, agregarAmigo, eliminarAmigo, buscarUsuarios, setPremium, obtenerAudiosCustom, eliminarAudioCustom, obtenerAudiosCustomMultiples } = require('./db');
const { registrar, login } = require('./auth');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================================
// Game State (in-memory)
// ============================================================

// Mazo uruguayo (40 cartas)
// Jerarquía completa del Truco Uruguayo (de menor a mayor poder):
// Cartas comunes (sin palo especial): 4 < 5 < 6 < 7 < 10 < 11 < 12
// Cartas especiales (todas iguales dentro de su valor): 1 copa/oro < 2s < 3s
// Matas (siempre las mismas, poder único por palo): 7 oro < 7 espada < 1 basto < 1 espada
// Si dos cartas del mismo valor (no piezas) se enfrentan → PARDA
function crearMazo() {
  const palos = ['oro', 'copa', 'espada', 'basto'];
  const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

  // Jerarquía de cartas especiales (las que tienen poder fijo alto)
  // Matas: tienen poder único por palo
  // 3s, 2s, 1-falsos: TODOS iguales dentro de su valor (parda si empatan)
  const jerarquiaEspecial = {
    'espada-1': 14, 'basto-1': 13, 'espada-7': 12, 'oro-7': 11,
    'espada-3': 10, 'basto-3': 10, 'oro-3': 10, 'copa-3': 10,
    'espada-2': 9, 'basto-2': 9, 'oro-2': 9, 'copa-2': 9,
    'oro-1': 8, 'copa-1': 8,
  };

  // Jerarquía de cartas comunes (las que NO tienen poder especial)
  // 4 < 5 < 6 < 7 (falso) < 10 (sota) < 11 (caballo) < 12 (rey)
  // Usamos valores negativos para que siempre pierdan contra las especiales
  const jerarquiaComunes = {
    4: -7,   // 4 es la más baja
    5: -6,
    6: -5,
    7: -4,   // 7 falso (el que no es mata)
    10: -3,  // sota
    11: -2,  // caballo
    12: -1,  // rey
  };

  const cartas = [];
  for (const palo of palos) {
    for (const valor of valores) {
      const clave = `${palo}-${valor}`;
      // Primero buscar si es carta especial, si no usar jerarquía de comunes
      const poder = jerarquiaEspecial[clave] !== undefined
        ? jerarquiaEspecial[clave]
        : (jerarquiaComunes[valor] || 0);
      cartas.push({ palo, valor, poder });
    }
  }
  return cartas;
}

// Actualizar el poder de las cartas según la muestra
// Las piezas (del palo de la muestra) van por encima de las matas
// Jerarquía completa (de menor a mayor):
// Comunes: 4(-7) < 5(-6) < 6(-5) < 7(-4) < 10(-3) < 11(-2) < 12(-1)
// Especiales: 1 copa/oro (8) -> 2s (9) -> 3s (10)
// Matas: 7 oro (11), 7 espada (12), 1 basto (13), 1 espada (14)
// Piezas del palo de la muestra: 10 (15), 11 (16), 5 (17), 4 (18), 2 (19)
function actualizarPoderConMuestra(cartas, muestra) {
  if (!muestra) return;

  const paloMuestra = muestra.palo;

  // Poder de las piezas (del palo de la muestra)
  const poderPiezas = {
    10: 15,
    11: 16,
    5: 17,
    4: 18,
    2: 19,
  };

  cartas.forEach(carta => {
    if (carta.palo !== paloMuestra) return;

    if (poderPiezas[carta.valor] !== undefined) {
      carta.poder = poderPiezas[carta.valor];
    }

    // El 12 del palo de la muestra toma el poder de la pieza que es la muestra
    // Ej: si muestra es 2 de espada (poder 19), el 12 de espada también vale 19
    if (carta.valor === 12 && VALORES_PIEZA.includes(muestra.valor)) {
      carta.poder = poderPiezas[muestra.valor];
    }
  });
}

function barajar(cartas) {
  const arr = [...cartas];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function repartir(cartas, numJugadores) {
  const manos = Array.from({ length: numJugadores }, () => []);
  let idx = 0;
  for (let ronda = 0; ronda < 3; ronda++) {
    for (let j = 0; j < numJugadores; j++) {
      if (idx < cartas.length) {
        manos[j].push(cartas[idx++]);
      }
    }
  }
  return manos;
}

// ============================================================
// Lobby & Game Manager
// ============================================================

const lobbyRooms = new Map(); // mesaId -> LobbyRoom
const engines = new Map();    // mesaId -> game state object

function getMaxJugadores(tamaño) {
  switch (tamaño) {
    case '1v1': return 2;
    case '2v2': return 4;
    case '3v3': return 6;
    default: return 4;
  }
}

function crearEstadoMesa(mesaId, jugadores, puntosLimite = 30, opciones = {}) {
  const mitad = Math.ceil(jugadores.length / 2);
  const eq1 = jugadores.filter((_, i) => i < mitad);
  const eq2 = jugadores.filter((_, i) => i >= mitad);
  eq1.forEach(j => j.equipo = 1);
  eq2.forEach(j => j.equipo = 2);

  // Opciones de juego con valores por defecto
  const modoAlternadoHabilitado = opciones.modoAlternado !== false; // true por defecto (Pico a Pico)
  const modoAyudaHabilitado = opciones.modoAyuda === true; // false por defecto

  return {
    id: mesaId,
    jugadores,
    equipos: [
      { id: 1, jugadores: eq1, puntaje: 0 },
      { id: 2, jugadores: eq2, puntaje: 0 },
    ],
    puntosLimite, // Configurable: 30, 40, or custom (10, 15, 20 for debug)
    estado: 'esperando',
    fase: 'esperando_cantos',
    turnoActual: 0,
    cartasMesa: [],
    manoActual: 1,
    maxManos: 3,
    ganadoresManos: [],
    indiceMano: 0,
    gritoActivo: null,
    nivelGritoAceptado: null,
    puntosEnJuego: 1,
    envidoActivo: null,
    envidoYaCantado: false,
    envidoDeclaracion: null, // For step-by-step envido declaration
    primeraCartaJugada: false,
    winnerRonda: null,
    winnerJuego: null,
    mensajeRonda: null,
    muestra: null,
    // Cut system
    esperandoCorte: false,
    indiceJugadorCorta: 0,
    // Deal animation
    repartiendoCartas: false,
    cartasRepartidas: [], // Tracks which cards have been dealt for animation
    // Winner card highlight
    cartaGanadoraMano: null, // { jugadorId, carta, indexEnMesa, manoNumero }
    manoGanadorJugadorId: null, // ID del jugador específico que ganó la mano
    corteRealizado: false,
    posicionCorte: null,
    mazoBarajado: null, // stored temporarily for cut
    // Flor system
    florActiva: null, // { jugadorId, equipoQueFlor, puntos }
    florYaCantada: false,
    floresCantadas: [], // Array of { jugadorId, jugadorNombre, equipo, puntos, cartas }
    esperandoFlor: false, // When waiting for flor declarations
    jugadoresConFlor: [], // List of player IDs who have flor
    cartasFlorReveladas: [], // Cartas de quienes tuvieron flor para mostrar al final de ronda
    cartasEnvidoReveladas: [], // Cartas del ganador del envido para mostrar al final de ronda
    // Contra Flor system - cuando ambos equipos tienen flor
    esperandoRespuestaFlor: false, // Esperando que el segundo equipo responda
    florPendiente: null, // { equipoQueCanta, tipoRespuesta: null | 'contra_flor' | 'con_flor_envido' }
    // Echar los perros system
    perrosActivos: false, // Si está activo el modo "echar los perros"
    perrosConfig: null, // { contraFlor: true, faltaEnvido: true, truco: true }
    // Alternancia de gritos (quién puede gritar qué)
    equipoQueCantoUltimo: null, // Para validar alternancia de truco/retruco/vale4
    // === MODO ALTERNADO 6 JUGADORES (3v3/1v1 en malas) ===
    modoAlternadoHabilitado, // Si está habilitado el Pico a Pico para 6 jugadores
    modoRondaActual: 'normal', // 'normal' (todos juegan) o '1v1' (solo 2 jugadores)
    indiceEnfrentamiento1v1: 0, // Qué par de jugadores se enfrentan en Pico a Pico (0, 1, 2)
    rondaAlternada: 0, // Contador de rondas para alternar (par=3v3, impar=1v1)
    // === MODO AYUDA (para principiantes) ===
    modoAyudaHabilitado, // Si está habilitado el modo ayuda para aprender
    // === RESPUESTAS GRUPALES (para equipos 2v2, 3v3) ===
    respuestasTruco: {}, // { jugadorId: true/false } - respuestas de cada jugador del equipo
    respuestasEnvido: {}, // { jugadorId: true/false } - respuestas de cada jugador del equipo
    esperandoRespuestasGrupales: false, // Si estamos esperando que todos respondan
    tipoRespuestaGrupal: null, // 'truco' o 'envido'
  };
}

// Phase 1: Shuffle the deck and wait for cut
function iniciarRondaFase1(mesa) {
  mesa.estado = 'jugando';
  mesa.cartasMesa = [];
  mesa.ganadoresManos = [];
  mesa.manoGanadorJugadorId = null;
  mesa.manoActual = 1;
  mesa.winnerRonda = null;
  mesa.mensajeRonda = null;
  mesa.gritoActivo = null;
  mesa.nivelGritoAceptado = null;
  mesa.puntosEnJuego = 1;
  mesa.envidoActivo = null;
  mesa.envidoYaCantado = false;
  mesa.primeraCartaJugada = false;
  mesa.muestra = null;
  mesa.fase = 'cortando'; // New phase: waiting for cut
  // Reset nuevos campos
  mesa.cartasFlorReveladas = [];
  mesa.cartasEnvidoReveladas = [];
  mesa.equipoQueCantoUltimo = null;
  // Mantener perrosActivos si está configurado (se resetea manualmente)

  // Reset respuestas grupales
  mesa.respuestasTruco = {};
  mesa.respuestasEnvido = {};
  mesa.esperandoRespuestasGrupales = false;
  mesa.tipoRespuestaGrupal = null;

  // === MODO ALTERNADO 6 JUGADORES ===
  // Determinar si esta ronda es 3v3 o 1v1
  if (mesa.jugadores.length === 6 && mesa.modoAlternadoHabilitado) {
    const mitadPuntos = mesa.puntosLimite / 2;
    const ambosEnMalas = mesa.equipos[0].puntaje < mitadPuntos && mesa.equipos[1].puntaje < mitadPuntos;

    if (ambosEnMalas) {
      // Alternar entre 3v3 (par) y 1v1 (impar)
      mesa.rondaAlternada = (mesa.rondaAlternada || 0) + 1;
      if (mesa.rondaAlternada % 2 === 0) {
        mesa.modoRondaActual = 'normal'; // 3v3
      } else {
        mesa.modoRondaActual = '1v1';
        // Rotar qué par de jugadores se enfrenta (0, 1, 2)
        mesa.indiceEnfrentamiento1v1 = (mesa.indiceEnfrentamiento1v1 || 0) % 3;
      }
    } else {
      // Al menos un equipo en buenas - jugar normal 3v3
      mesa.modoRondaActual = 'normal';
    }
  } else {
    mesa.modoRondaActual = 'normal';
  }

  // Shuffle the deck
  const mazo = barajar(crearMazo());
  mesa.mazoBarajado = mazo;

  // Who is mano this round
  mesa.jugadores.forEach((j, i) => {
    j.cartas = [];
    j.cartasOriginales = [];
    j.esMano = i === mesa.indiceMano;
    // En modo 1v1, marcar quién participa esta ronda
    j.participaRonda = true; // Por defecto todos participan
    j.seVaAlMazo = false; // Reset al inicio de cada ronda
  });

  // En modo Pico a Pico (1v1), solo 2 jugadores participan - cada uno contra su rival de enfrente
  if (mesa.modoRondaActual === '1v1') {
    const idx = mesa.indiceEnfrentamiento1v1;
    const jugadoresEq1 = mesa.jugadores.filter(j => j.equipo === 1);
    const jugadoresEq2 = mesa.jugadores.filter(j => j.equipo === 2);

    // En la mesa visual de 6 jugadores (3v3), los enfrentamientos "de enfrente" son:
    // - Eq1[0] vs Eq2[1] (posición abajo-centro vs arriba-centro)
    // - Eq1[1] vs Eq2[2] (posición izquierda-abajo vs derecha-arriba)
    // - Eq1[2] vs Eq2[0] (posición izquierda-arriba vs derecha-abajo)
    // Esto asegura que cada jugador siempre juega contra el mismo rival de enfrente
    const enfrentamientos = [
      [0, 1], // Eq1[0] vs Eq2[1]
      [1, 2], // Eq1[1] vs Eq2[2]
      [2, 0], // Eq1[2] vs Eq2[0]
    ];

    mesa.jugadores.forEach(j => {
      j.participaRonda = false;
    });

    const [idxEq1, idxEq2] = enfrentamientos[idx];
    if (jugadoresEq1[idxEq1]) jugadoresEq1[idxEq1].participaRonda = true;
    if (jugadoresEq2[idxEq2]) jugadoresEq2[idxEq2].participaRonda = true;

    // Incrementar para la próxima ronda Pico a Pico
    mesa.indiceEnfrentamiento1v1 = (idx + 1) % 3;
  }

  // The player to the LEFT of mano cuts (next participating player)
  let cortaIdx = (mesa.indiceMano + 1) % mesa.jugadores.length;
  // En pico a pico, saltar a un jugador que participe
  if (mesa.modoRondaActual === '1v1') {
    let intentos = 0;
    while (mesa.jugadores[cortaIdx].participaRonda === false && intentos < mesa.jugadores.length) {
      cortaIdx = (cortaIdx + 1) % mesa.jugadores.length;
      intentos++;
    }
  }
  mesa.indiceJugadorCorta = cortaIdx;
  mesa.esperandoCorte = true;
  mesa.corteRealizado = false;
  mesa.posicionCorte = null;
  mesa.turnoActual = mesa.indiceMano;
}

// Phase 2: After cut, deal cards and start playing
function iniciarRondaFase2(mesa, posicionCorte) {
  let mazo = mesa.mazoBarajado;
  if (!mazo) {
    mazo = barajar(crearMazo());
  }

  // Apply cut: split at posicionCorte and swap halves
  if (posicionCorte > 0 && posicionCorte < mazo.length) {
    const top = mazo.slice(0, posicionCorte);
    const bottom = mazo.slice(posicionCorte);
    mazo = [...bottom, ...top];
  }

  mesa.mazoBarajado = null;
  mesa.esperandoCorte = false;
  mesa.corteRealizado = true;
  mesa.posicionCorte = posicionCorte;
  mesa.fase = 'repartiendo'; // New phase for dealing animation
  mesa.repartiendoCartas = true;

  // En modo 1v1, solo repartir a los jugadores que participan
  const jugadoresQueParticipan = mesa.jugadores.filter(j => j.participaRonda !== false);
  const numJugadoresParticipan = jugadoresQueParticipan.length;

  const manos = repartir(mazo, numJugadoresParticipan);
  let manoIndex = 0;
  mesa.jugadores.forEach((j) => {
    if (j.participaRonda !== false) {
      j.cartas = manos[manoIndex];
      j.cartasOriginales = [...manos[manoIndex]]; // Guardar copia de las 3 cartas originales para envido/flor
      manoIndex++;
    } else {
      j.cartas = []; // Jugadores que no participan no tienen cartas
      j.cartasOriginales = [];
    }
  });

  // La muestra: la carta siguiente después de repartir (queda boca arriba)
  const cartasRepartidas = numJugadoresParticipan * 3;
  if (cartasRepartidas < mazo.length) {
    mesa.muestra = mazo[cartasRepartidas];
  } else {
    mesa.muestra = null;
  }

  // Actualizar el poder de las cartas de cada jugador según la muestra
  // Las piezas (2,4,5,10,11 del palo de la muestra) son más fuertes que las matas
  if (mesa.muestra) {
    mesa.jugadores.forEach(j => {
      if (j.participaRonda !== false) {
        actualizarPoderConMuestra(j.cartas, mesa.muestra);
        actualizarPoderConMuestra(j.cartasOriginales, mesa.muestra);
      }
    });
  }

  // En modo 1v1, el mano es el primer jugador que participa del equipo que le toca
  if (mesa.modoRondaActual === '1v1') {
    const primerParticipante = jugadoresQueParticipan.find(j => j.equipo === 1) || jugadoresQueParticipan[0];
    mesa.turnoActual = mesa.jugadores.findIndex(j => j.id === primerParticipante.id);
    mesa.indiceMano = mesa.turnoActual;
  } else {
    mesa.turnoActual = mesa.indiceMano;
  }

  // Build the dealing order: 3 rounds, starting from mano, ending at dealer
  // Solo para jugadores que participan
  mesa.cartasRepartidas = [];
  const indicesParticipan = mesa.jugadores
    .map((j, i) => j.participaRonda !== false ? i : -1)
    .filter(i => i !== -1);

  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const jugadorIndex of indicesParticipan) {
      mesa.cartasRepartidas.push({
        jugadorIndex,
        cartaIndex: vuelta,
        vuelta,
      });
    }
  }
}

// Complete dealing phase and start playing
function finalizarReparticion(mesa) {
  mesa.repartiendoCartas = false;
  mesa.cartasRepartidas = [];

  // Detect who has flor (solo jugadores que participan en la ronda)
  mesa.jugadoresConFlor = [];
  mesa.floresCantadas = [];
  mesa.florYaCantada = false;
  mesa.jugadores.forEach(j => {
    if (j.participaRonda !== false && tieneFlor(j, mesa.muestra)) {
      mesa.jugadoresConFlor.push(j.id);
    }
  });

  // Si hay perros activos, esperar respuesta antes de jugar
  if (mesa.perrosActivos) {
    mesa.fase = 'esperando_respuesta_perros';
  } else {
    mesa.fase = 'jugando';
  }
}

// Legacy wrapper for compatibility
function iniciarRonda(mesa) {
  iniciarRondaFase1(mesa);
}

function getEstadoParaJugador(mesa, jugadorId) {
  const copia = JSON.parse(JSON.stringify(mesa));
  // Don't expose the shuffled deck to clients
  delete copia.mazoBarajado;
  const miJugador = copia.jugadores.find(j => j.id === jugadorId);
  const miEquipo = miJugador?.equipo;

  // Si hay perros activos, el equipo que los echó NO puede ver sus cartas
  // hasta que el otro equipo responda (incluso durante la fase de repartición)
  const perrosEsperandoRespuesta = mesa.perrosActivos &&
    (mesa.fase === 'esperando_respuesta_perros' || mesa.fase === 'repartiendo');
  const equipoQueEchoPerros = mesa.perrosConfig?.equipoQueEcha;
  const miEquipoEchoPerros = perrosEsperandoRespuesta && miEquipo === equipoQueEchoPerros;

  copia.jugadores = copia.jugadores.map(j => {
    // Nunca enviar cartasOriginales al cliente (solo se usa server-side para envido/flor)
    delete j.cartasOriginales;
    // Si mi equipo echó los perros y estamos esperando respuesta, ocultar MIS cartas también
    if (miEquipoEchoPerros && j.equipo === miEquipo) {
      return { ...j, cartas: j.cartas.map(() => ({ palo: 'basto', valor: 0, poder: 0 })) };
    }
    if (j.id === jugadorId) return j;
    // Show teammate cards (same team), hide opponent cards
    if (j.equipo === miEquipo) return j;
    return { ...j, cartas: j.cartas.map(() => ({ palo: 'basto', valor: 0, poder: 0 })) };
  });
  // Strip flor points from mesa state - opponents shouldn't see flor values
  if (copia.floresCantadas && copia.floresCantadas.length > 0) {
    copia.floresCantadas = copia.floresCantadas.map(f => ({
      ...f,
      puntos: f.equipo === miEquipo ? f.puntos : null,
    }));
  }
  // Hide jugadoresConFlor from opponents - only reveal if the requesting player has flor
  // This prevents opponents from knowing about flor before it's declared
  if (copia.jugadoresConFlor && !copia.florYaCantada) {
    copia.jugadoresConFlor = copia.jugadoresConFlor.filter(id => id === jugadorId);
  }
  return copia;
}

function jugarCarta(mesa, jugadorId, carta) {
  if (mesa.fase !== 'jugando') return false;
  if (mesa.gritoActivo || mesa.envidoActivo) return false;
  // Bloquear si hay flor pendiente de respuesta
  if (mesa.esperandoRespuestaFlor) return false;

  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return false;

  const jugadorIndex = mesa.jugadores.findIndex(j => j.id === jugadorId);
  if (jugadorIndex !== mesa.turnoActual) return false;

  // Validar que el jugador no haya tirado ya en esta mano
  const inicio = (mesa.manoActual - 1) * mesa.jugadores.length;
  const cartasEnEstaMano = mesa.cartasMesa.slice(inicio);
  const yaJugoEnEstaMano = cartasEnEstaMano.some(c => c.jugadorId === jugadorId);
  if (yaJugoEnEstaMano) {
    console.log(`[jugarCarta] Jugador ${jugadorId} ya jugó en esta mano`);
    return false;
  }

  const cartaIdx = jugador.cartas.findIndex(c => c.palo === carta.palo && c.valor === carta.valor);
  if (cartaIdx === -1) return false;

  // IMPORTANTE: Usar la carta del servidor (con poder correcto) en lugar de la del cliente
  const cartaDelServidor = jugador.cartas[cartaIdx];
  jugador.cartas.splice(cartaIdx, 1);
  mesa.cartasMesa.push({ jugadorId, carta: cartaDelServidor });

  if (!mesa.primeraCartaJugada) mesa.primeraCartaJugada = true;

  siguienteTurno(mesa);
  return true;
}

function siguienteTurno(mesa) {
  const numParticipan = mesa.jugadores.filter(j => j.participaRonda !== false && !j.seVaAlMazo).length;
  const inicio = (mesa.manoActual - 1) * numParticipan;
  const cartasEnEstaMano = mesa.cartasMesa.length - inicio;

  if (cartasEnEstaMano >= numParticipan) {
    determinarGanadorMano(mesa);
  } else {
    // Avanzar al siguiente jugador que participa y no se fue al mazo
    let next = (mesa.turnoActual + 1) % mesa.jugadores.length;
    let intentos = 0;
    while ((mesa.jugadores[next].participaRonda === false || mesa.jugadores[next].seVaAlMazo) && intentos < mesa.jugadores.length) {
      next = (next + 1) % mesa.jugadores.length;
      intentos++;
    }
    mesa.turnoActual = next;
  }
}

function determinarGanadorMano(mesa) {
  const numParticipan = mesa.jugadores.filter(j => j.participaRonda !== false && !j.seVaAlMazo).length;
  const inicio = (mesa.manoActual - 1) * numParticipan;
  const cartasDeLaMano = mesa.cartasMesa.slice(inicio);
  if (cartasDeLaMano.length === 0) return;

  let cartaGanadora = cartasDeLaMano[0];
  let cartaGanadoraIndex = inicio; // Index in cartasMesa
  let empate = false;
  for (let i = 1; i < cartasDeLaMano.length; i++) {
    if (cartasDeLaMano[i].carta.poder > cartaGanadora.carta.poder) {
      cartaGanadora = cartasDeLaMano[i];
      cartaGanadoraIndex = inicio + i;
      empate = false;
    } else if (cartasDeLaMano[i].carta.poder === cartaGanadora.carta.poder) {
      const jug1 = mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
      const jug2 = mesa.jugadores.find(j => j.id === cartasDeLaMano[i].jugadorId);
      if (jug1 && jug2 && jug1.equipo !== jug2.equipo) empate = true;
    }
  }

  // Log para debug de empates
  console.log(`[Mano ${mesa.manoActual}] Cartas jugadas:`, cartasDeLaMano.map(c => {
    const j = mesa.jugadores.find(jj => jj.id === c.jugadorId);
    return `${j?.nombre}(E${j?.equipo}): ${c.carta.valor}-${c.carta.palo} poder=${c.carta.poder}`;
  }).join(' | '), empate ? '→ EMPATE' : `→ Gana ${mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId)?.nombre}(poder ${cartaGanadora.carta.poder})`);

  if (empate) {
    mesa.ganadoresManos.push(null);
    mesa.cartaGanadoraMano = null; // No winner - empate
    mesa.manoGanadorJugadorId = null;
  } else {
    const jugadorGanador = mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
    mesa.ganadoresManos.push(jugadorGanador?.equipo || null);
    // Store the winning card info
    mesa.cartaGanadoraMano = {
      jugadorId: cartaGanadora.jugadorId,
      carta: cartaGanadora.carta,
      indexEnMesa: cartaGanadoraIndex,
      manoNumero: mesa.manoActual,
    };
    // Store the specific winning player for next hand turn assignment
    mesa.manoGanadorJugadorId = cartaGanadora.jugadorId;
  }

  evaluarEstadoRonda(mesa);
}

function evaluarEstadoRonda(mesa) {
  const ganadores = mesa.ganadoresManos;
  const manoJugada = ganadores.length;
  const victorias = { 1: 0, 2: 0 };
  let empates = 0;
  ganadores.forEach(g => {
    if (g === null) empates++;
    else victorias[g]++;
  });

  const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
  let ganadorRonda = null;

  if (victorias[1] >= 2) ganadorRonda = 1;
  else if (victorias[2] >= 2) ganadorRonda = 2;
  else if (manoJugada >= 2) {
    if (ganadores[0] === null && ganadores[1] !== null) ganadorRonda = ganadores[1];
    else if (ganadores[0] !== null && ganadores[1] === null) ganadorRonda = ganadores[0];
    else if (ganadores[0] === null && ganadores[1] === null) {
      if (manoJugada >= 3) ganadorRonda = ganadores[2] !== null ? ganadores[2] : equipoMano;
    } else if (manoJugada >= 3) {
      ganadorRonda = ganadores[2] === null ? ganadores[0] : ganadores[2];
    }
  }

  // Store pending action for after delay
  mesa.manoTerminada = true;
  mesa.manoGanadorEquipo = ganadores[ganadores.length - 1];

  if (ganadorRonda !== null) {
    mesa.pendienteFinalizarRonda = ganadorRonda;
  } else if (manoJugada < 3) {
    mesa.pendienteSiguienteMano = true;
  } else {
    mesa.pendienteFinalizarRonda = equipoMano;
  }
}

// Called after the 3.5s delay to continue the game
function continuarDespuesDeDelay(mesa) {
  mesa.manoTerminada = false;
  mesa.cartaGanadoraMano = null; // Clear winner card

  if (mesa.pendienteFinalizarRonda !== undefined && mesa.pendienteFinalizarRonda !== null) {
    const ganadorRonda = mesa.pendienteFinalizarRonda;
    mesa.pendienteFinalizarRonda = null;
    finalizarRonda(mesa, ganadorRonda);
    return { tipo: 'ronda', ganador: ganadorRonda };
  } else if (mesa.pendienteSiguienteMano) {
    mesa.pendienteSiguienteMano = false;
    prepararSiguienteMano(mesa);
    return { tipo: 'mano' };
  }
  return null;
}

function finalizarRonda(mesa, equipoGanador) {
  mesa.winnerRonda = equipoGanador;
  mesa.fase = 'finalizada';
  const equipo = mesa.equipos.find(e => e.id === equipoGanador);
  if (equipo) equipo.puntaje += mesa.puntosEnJuego;
  mesa.mensajeRonda = `Equipo ${equipoGanador} ganó la ronda (+${mesa.puntosEnJuego} pts)`;
  if (equipo && equipo.puntaje >= mesa.puntosLimite) {
    mesa.winnerJuego = equipoGanador;
    mesa.estado = 'terminado';
    mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
  }
}

function prepararSiguienteMano(mesa) {
  mesa.manoActual++;
  const ganadorAnterior = mesa.ganadoresManos[mesa.ganadoresManos.length - 1];
  if (ganadorAnterior !== null && mesa.manoGanadorJugadorId) {
    // The specific player who won the hand starts next
    const jugadorIndex = mesa.jugadores.findIndex(j => j.id === mesa.manoGanadorJugadorId);
    let turno = jugadorIndex >= 0 ? jugadorIndex : mesa.indiceMano;
    // Si ese jugador se fue al mazo, buscar el siguiente activo
    let intentos = 0;
    while (mesa.jugadores[turno].seVaAlMazo && intentos < mesa.jugadores.length) {
      turno = (turno + 1) % mesa.jugadores.length;
      intentos++;
    }
    mesa.turnoActual = turno;
  } else {
    // Tie or no winner: mano player starts
    let turno = mesa.indiceMano;
    let intentos = 0;
    while (mesa.jugadores[turno].seVaAlMazo && intentos < mesa.jugadores.length) {
      turno = (turno + 1) % mesa.jugadores.length;
      intentos++;
    }
    mesa.turnoActual = turno;
  }
}

function iniciarSiguienteRonda(mesa) {
  if (mesa.estado === 'terminado') return;
  // Avanzar indiceMano al siguiente jugador (la fase1 determinará quién participa en pico a pico)
  mesa.indiceMano = (mesa.indiceMano + 1) % mesa.jugadores.length;
  iniciarRondaFase1(mesa); // Phase 1 only - wait for cut
}

// Truco system
function cantarTruco(mesa, jugadorId, tipo) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || mesa.estado !== 'jugando' || mesa.gritoActivo || mesa.envidoActivo) return false;

  if (tipo === 'truco' && mesa.nivelGritoAceptado !== null) return false;
  if (tipo === 'retruco' && mesa.nivelGritoAceptado !== 'truco') return false;
  if (tipo === 'vale4' && mesa.nivelGritoAceptado !== 'retruco') return false;

  // Validar alternancia: el equipo que cantó el último nivel aceptado no puede subir la apuesta
  // Truco: cualquiera puede cantarlo inicialmente
  // Retruco: solo puede cantarlo el equipo que ACEPTÓ el truco (no el que lo cantó)
  // Vale4: solo puede cantarlo el equipo que ACEPTÓ el retruco
  if (tipo === 'retruco' && mesa.equipoQueCantoUltimo === jugador.equipo) {
    return false; // No puede subir su propio grito
  }
  if (tipo === 'vale4' && mesa.equipoQueCantoUltimo === jugador.equipo) {
    return false; // No puede subir su propio grito
  }

  const puntosMap = {
    'truco': { enJuego: 2, siNoQuiere: 1 },
    'retruco': { enJuego: 3, siNoQuiere: 2 },
    'vale4': { enJuego: 4, siNoQuiere: 3 },
  };
  const config = puntosMap[tipo];
  mesa.gritoActivo = {
    tipo,
    equipoQueGrita: jugador.equipo,
    jugadorQueGrita: jugadorId,
    puntosEnJuego: config.enJuego,
    puntosSiNoQuiere: config.siNoQuiere,
  };
  return true;
}

// Obtener jugadores del equipo que deben responder (participan en la ronda)
function getJugadoresEquipoQueResponden(mesa, equipo) {
  return mesa.jugadores.filter(j =>
    j.equipo === equipo && j.participaRonda !== false
  );
}

// Verificar si necesita respuesta grupal (más de 1 jugador en el equipo que participa)
function necesitaRespuestaGrupal(mesa, equipoQueResponde) {
  const jugadoresEquipo = getJugadoresEquipoQueResponden(mesa, equipoQueResponde);
  return jugadoresEquipo.length > 1;
}

// Verificar si todos los jugadores del equipo han respondido
function todosRespondieron(mesa, tipo) {
  const respuestas = tipo === 'truco' ? mesa.respuestasTruco : mesa.respuestasEnvido;
  const equipoQueResponde = tipo === 'truco'
    ? (mesa.gritoActivo?.equipoQueGrita === 1 ? 2 : 1)
    : (mesa.envidoActivo?.equipoQueCanta === 1 ? 2 : 1);

  const jugadoresEquipo = getJugadoresEquipoQueResponden(mesa, equipoQueResponde);
  return jugadoresEquipo.every(j => respuestas[j.id] !== undefined);
}

// Obtener resultado final de respuesta grupal (si al menos uno quiere, se acepta)
function getResultadoRespuestaGrupal(mesa, tipo) {
  const respuestas = tipo === 'truco' ? mesa.respuestasTruco : mesa.respuestasEnvido;
  // Si al menos uno quiere, la respuesta final es "quiero"
  return Object.values(respuestas).some(r => r === true);
}

function responderTruco(mesa, jugadorId, acepta) {
  if (!mesa.gritoActivo) return { success: false, error: 'No hay grito activo' };
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || jugador.equipo === mesa.gritoActivo.equipoQueGrita) {
    return { success: false, error: 'No puedes responder a tu propio grito' };
  }

  const equipoQueResponde = jugador.equipo;
  const esGrupal = necesitaRespuestaGrupal(mesa, equipoQueResponde);

  if (esGrupal) {
    // Guardar respuesta individual
    mesa.respuestasTruco[jugadorId] = acepta;
    mesa.esperandoRespuestasGrupales = true;
    mesa.tipoRespuestaGrupal = 'truco';

    // Verificar si todos respondieron
    if (!todosRespondieron(mesa, 'truco')) {
      return {
        success: true,
        parcial: true,
        jugadorId,
        acepta,
        faltanResponder: getJugadoresEquipoQueResponden(mesa, equipoQueResponde)
          .filter(j => mesa.respuestasTruco[j.id] === undefined)
          .map(j => j.id)
      };
    }

    // Todos respondieron - obtener resultado final
    acepta = getResultadoRespuestaGrupal(mesa, 'truco');
    mesa.respuestasTruco = {};
    mesa.esperandoRespuestasGrupales = false;
    mesa.tipoRespuestaGrupal = null;
  }

  if (acepta) {
    mesa.puntosEnJuego = mesa.gritoActivo.puntosEnJuego;
    mesa.nivelGritoAceptado = mesa.gritoActivo.tipo;
    // Guardar qué equipo gritó para validar alternancia
    mesa.equipoQueCantoUltimo = mesa.gritoActivo.equipoQueGrita;
    mesa.gritoActivo = null;
  } else {
    const puntos = mesa.gritoActivo.puntosSiNoQuiere;
    const equipoGanador = mesa.gritoActivo.equipoQueGrita;
    mesa.gritoActivo = null;
    // No usar finalizarRonda (suma puntosEnJuego), sumar solo puntosSiNoQuiere
    mesa.winnerRonda = equipoGanador;
    mesa.fase = 'finalizada';
    const equipo = mesa.equipos.find(e => e.id === equipoGanador);
    if (equipo) equipo.puntaje += puntos;
    mesa.mensajeRonda = `Equipo ${equipoGanador} ganó por no querer (+${puntos} pts)`;
    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = equipoGanador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
    }
  }
  return { success: true, parcial: false, acepta };
}

// Envido system
function calcularPuntosEnvidoTipo(mesa, tipo, puntosCustom = null) {
  if (tipo === 'envido') return 2;
  if (tipo === 'real_envido') return 3;
  if (tipo === 'falta_envido') {
    const limite = mesa.puntosLimite || 30;
    const max1 = limite - mesa.equipos[0].puntaje;
    const max2 = limite - mesa.equipos[1].puntaje;
    return Math.min(max1, max2);
  }
  // Envido cargado: permite cargar una cantidad específica de puntos
  if (tipo === 'envido_cargado' && puntosCustom !== null) {
    return Math.max(1, Math.min(puntosCustom, 99)); // Mínimo 1, máximo 99
  }
  return 0;
}

function cantarEnvido(mesa, jugadorId, tipo, puntosCustom = null) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || mesa.estado !== 'jugando') return false;
  if (mesa.fase !== 'jugando') return false;

  // El envido solo se puede cantar en la primera mano (mano 1)
  if (mesa.manoActual !== 1) return false;

  // No se puede cantar envido si el equipo rival está todo al mazo
  const equipoRival = jugador.equipo === 1 ? 2 : 1;
  const rivalesActivos = mesa.jugadores.filter(
    j => j.equipo === equipoRival && j.participaRonda !== false && !j.seVaAlMazo
  );
  if (rivalesActivos.length === 0) return false;

  // El jugador puede cantar envido antes de jugar SU propia carta en esta mano
  // Verificar si el jugador ya jugó una carta en la mano actual
  const numParticipan = mesa.jugadores.filter(j => j.participaRonda !== false).length;
  const cartasManoActual = mesa.cartasMesa.slice(0, numParticipan); // Primera mano = primeras N cartas
  const yaJugueSuCarta = cartasManoActual.some(c => c.jugadorId === jugadorId);
  if (yaJugueSuCarta) return false;

  if (mesa.envidoYaCantado && !mesa.envidoActivo) return false;
  if (mesa.gritoActivo) return false;
  // Si ya se cantó flor, no se puede cantar envido
  if (mesa.florYaCantada) return false;

  if (mesa.envidoActivo) {
    if (jugador.equipo === mesa.envidoActivo.equipoQueCanta) return false;
    const ultimoTipo = mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1];
    // No se puede revirar con envido simple si ya se cantó algo superior
    if (tipo === 'envido' && ultimoTipo !== 'envido') return false;
    if (tipo === 'real_envido' && ultimoTipo === 'falta_envido') return false;
    // No se puede cargar menos que lo acumulado
    if (tipo === 'envido_cargado' && puntosCustom !== null && puntosCustom <= mesa.envidoActivo.puntosAcumulados) return false;

    const puntosNuevo = calcularPuntosEnvidoTipo(mesa, tipo, puntosCustom);
    mesa.envidoActivo.tipos.push(tipo === 'envido_cargado' ? `cargado_${puntosCustom}` : tipo);
    mesa.envidoActivo.puntosSiNoQuiere = mesa.envidoActivo.puntosAcumulados;
    mesa.envidoActivo.puntosAcumulados += puntosNuevo;
    mesa.envidoActivo.equipoQueCanta = jugador.equipo;
    mesa.envidoActivo.jugadorQueCanta = jugadorId;
  } else {
    const puntos = calcularPuntosEnvidoTipo(mesa, tipo, puntosCustom);
    mesa.envidoActivo = {
      tipos: [tipo === 'envido_cargado' ? `cargado_${puntosCustom}` : tipo],
      equipoQueCanta: jugador.equipo,
      jugadorQueCanta: jugadorId,
      puntosAcumulados: puntos,
      puntosSiNoQuiere: 1,
    };
  }
  return true;
}

// Función para cantar FLOR automáticamente para todos los que la tienen
// Retorna las declaraciones para emitir eventos
// Si ambos equipos tienen flor, espera respuesta (Contra Flor al Resto / Con Flor Envido)
// Cantar flor de TODOS los jugadores que aún no la cantaron (para envido/truco triggers)
function cantarFlorAutomatica(mesa) {
  if (mesa.florYaCantada) return { cantadas: [], resultado: null, esperandoRespuesta: false };
  if (mesa.jugadoresConFlor.length === 0) return { cantadas: [], resultado: null, esperandoRespuesta: false };

  const declaraciones = [];

  // Verificar si ambos equipos tienen flor (contando TODOS, ya declarados y nuevos)
  const equiposConFlor = new Set();
  mesa.jugadoresConFlor.forEach(jugadorId => {
    const jugador = mesa.jugadores.find(j => j.id === jugadorId);
    if (jugador) equiposConFlor.add(jugador.equipo);
  });
  const ambosEquiposTienenFlor = equiposConFlor.size === 2;

  // Cantar flor solo para jugadores que aún NO la cantaron
  mesa.jugadoresConFlor.forEach(jugadorId => {
    // Skip si ya fue declarada
    if (mesa.floresCantadas.some(f => f.jugadorId === jugadorId)) return;

    const jugador = mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;

    const puntosFlor = calcularPuntosFlor(jugador, mesa.muestra);
    const cartasFlor = (jugador.cartasOriginales && jugador.cartasOriginales.length === 3
      ? jugador.cartasOriginales
      : jugador.cartas).map(c => ({ ...c }));

    const declaracion = {
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      puntos: puntosFlor,
      cartas: cartasFlor,
    };

    mesa.floresCantadas.push(declaracion);
    mesa.cartasFlorReveladas.push({
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      cartas: cartasFlor,
    });
    declaraciones.push(declaracion);
  });

  // Si ambos equipos tienen flor, esperar respuesta del segundo equipo
  if (ambosEquiposTienenFlor) {
    const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
    const equipoNoMano = equipoMano === 1 ? 2 : 1;

    mesa.esperandoRespuestaFlor = true;
    mesa.florPendiente = {
      equipoQueCanta: equipoNoMano,
      equipoQueResponde: equipoMano,
      tipoRespuesta: null,
    };

    return {
      cantadas: declaraciones,
      resultado: null,
      esperandoRespuesta: true,
    };
  }

  // Solo un equipo tiene flor - resolver directamente
  const resultado = resolverFlor(mesa);

  return {
    cantadas: declaraciones,
    resultado: resultado.resultado,
    esperandoRespuesta: false,
  };
}

// Declarar flor de un solo jugador (cuando llega su turno)
// Returns: { declaracion, todosDeclararon, esperandoRespuesta, resultado } or null
function cantarFlorDeJugador(mesa, jugadorId) {
  if (mesa.florYaCantada) return null;
  if (!mesa.jugadoresConFlor || !mesa.jugadoresConFlor.includes(jugadorId)) return null;
  if (mesa.floresCantadas.some(f => f.jugadorId === jugadorId)) return null; // Ya la cantó

  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return null;

  const puntosFlor = calcularPuntosFlor(jugador, mesa.muestra);
  const cartasFlor = (jugador.cartasOriginales && jugador.cartasOriginales.length === 3
    ? jugador.cartasOriginales
    : jugador.cartas).map(c => ({ ...c }));

  const declaracion = {
    jugadorId,
    jugadorNombre: jugador.nombre,
    equipo: jugador.equipo,
    puntos: puntosFlor,
    cartas: cartasFlor,
  };

  mesa.floresCantadas.push(declaracion);
  mesa.cartasFlorReveladas.push({
    jugadorId,
    jugadorNombre: jugador.nombre,
    equipo: jugador.equipo,
    cartas: cartasFlor,
  });

  // Check if ALL flor players have now declared
  const todosDeclararon = mesa.jugadoresConFlor.every(
    id => mesa.floresCantadas.some(f => f.jugadorId === id)
  );

  let resultado = null;
  let esperandoRespuesta = false;

  if (todosDeclararon) {
    const equiposConFlor = new Set(mesa.floresCantadas.map(f => f.equipo));
    if (equiposConFlor.size === 2) {
      // Ambos equipos tienen flor - contienda
      const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
      const equipoNoMano = equipoMano === 1 ? 2 : 1;
      mesa.esperandoRespuestaFlor = true;
      mesa.florPendiente = {
        equipoQueCanta: equipoNoMano,
        equipoQueResponde: equipoMano,
        tipoRespuesta: null,
      };
      esperandoRespuesta = true;
    } else {
      // Solo un equipo tiene flor - resolver directamente
      const res = resolverFlor(mesa);
      resultado = res.resultado;
    }
  }

  return { declaracion, todosDeclararon, esperandoRespuesta, resultado };
}

// Emitir la declaración de flor de un jugador y manejar resolución si todos declararon
// Si el jugador declaró flor y hay oponentes con flor sin declarar, declararlos también
function emitirFlorDeJugador(io, room, mesa, florResult) {
  if (!florResult) return;

  // Emitir flor-cantada para este jugador
  room.jugadores.forEach(p => {
    const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
    const mismoEquipo = pJugador && pJugador.equipo === florResult.declaracion.equipo;
    io.to(p.socketId).emit('flor-cantada', {
      jugadorId: florResult.declaracion.jugadorId,
      audioCustomUrl: mesa.audiosCustom?.[florResult.declaracion.jugadorId]?.['flor'] || null,
      declaracion: {
        ...florResult.declaracion,
        puntos: mismoEquipo ? florResult.declaracion.puntos : null,
      },
      estado: getEstadoParaJugador(mesa, p.socketId),
    });
  });

  // Si NO todos declararon, verificar si hay otros jugadores con flor sin declarar
  // Si un oponente tiene flor, debe declarar inmediatamente (no esperar su turno)
  // Los compañeros también declaran inmediatamente para no revelar información
  if (!florResult.todosDeclararon && mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0) {
    const sinDeclarar = mesa.jugadoresConFlor.filter(id => {
      return id !== florResult.declaracion.jugadorId && !mesa.floresCantadas.some(f => f.jugadorId === id);
    });
    // Solo forzar declaración inmediata si hay al menos un oponente con flor
    const equipoDeclarante = florResult.declaracion.equipo;
    const hayOponenteConFlor = sinDeclarar.some(id => {
      const j = mesa.jugadores.find(jj => jj.id === id);
      return j && j.equipo !== equipoDeclarante;
    });
    const oponentesSinDeclarar = hayOponenteConFlor ? sinDeclarar : [];

    if (oponentesSinDeclarar.length > 0) {
      // Declarar flor de cada oponente con un pequeño delay entre cada uno
      oponentesSinDeclarar.forEach((opId, idx) => {
        setTimeout(() => {
          const currentMesa = engines.get(room.mesaId);
          const currentRoom = lobbyRooms.get(room.mesaId);
          if (!currentMesa || !currentRoom || currentMesa.florYaCantada) return;

          const opFlorResult = cantarFlorDeJugador(currentMesa, opId);
          if (opFlorResult) {
            // Emitir esta declaración
            currentRoom.jugadores.forEach(p => {
              const pJugador = currentMesa.jugadores.find(j => j.id === p.socketId);
              const mismoEquipo = pJugador && pJugador.equipo === opFlorResult.declaracion.equipo;
              io.to(p.socketId).emit('flor-cantada', {
                jugadorId: opFlorResult.declaracion.jugadorId,
                audioCustomUrl: currentMesa.audiosCustom?.[opFlorResult.declaracion.jugadorId]?.['flor'] || null,
                declaracion: {
                  ...opFlorResult.declaracion,
                  puntos: mismoEquipo ? opFlorResult.declaracion.puntos : null,
                },
                estado: getEstadoParaJugador(currentMesa, p.socketId),
              });
            });

            // Si ahora todos declararon, manejar resolución
            if (opFlorResult.todosDeclararon) {
              const delay = 1000;
              if (opFlorResult.esperandoRespuesta) {
                setTimeout(() => {
                  currentRoom.jugadores.forEach(p => {
                    io.to(p.socketId).emit('flor-pendiente', {
                      equipoQueCanta: currentMesa.florPendiente.equipoQueCanta,
                      equipoQueResponde: currentMesa.florPendiente.equipoQueResponde,
                      estado: getEstadoParaJugador(currentMesa, p.socketId),
                    });
                  });
                }, delay);
              } else if (opFlorResult.resultado) {
                setTimeout(() => {
                  currentRoom.jugadores.forEach(p => {
                    io.to(p.socketId).emit('flor-resuelta', {
                      resultado: {
                        ganador: opFlorResult.resultado.ganador,
                        puntosGanados: opFlorResult.resultado.puntosGanados,
                        floresCantadas: (opFlorResult.resultado.floresCantadas || []).map(f => ({
                          ...f,
                          puntos: null,
                        })),
                        mejorFlor: null,
                      },
                      estado: getEstadoParaJugador(currentMesa, p.socketId),
                    });
                  });

                  if (currentMesa.winnerJuego !== null) {
                    currentRoom.estado = 'terminado';
                    currentRoom.jugadores.forEach(p => {
                      io.to(p.socketId).emit('juego-finalizado', {
                        ganadorEquipo: currentMesa.winnerJuego,
                        estado: getEstadoParaJugador(currentMesa, p.socketId),
                      });
                    });
                    broadcastLobby(io);
                  }
                }, delay);
              }
            }
          }
        }, (idx + 1) * 800);
      });
      return; // La resolución se maneja dentro del chain de oponentes
    }
  }

  // Si todos declararon, emitir resolución o esperar respuesta
  if (florResult.todosDeclararon) {
    const delay = 1000;
    if (florResult.esperandoRespuesta) {
      setTimeout(() => {
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('flor-pendiente', {
            equipoQueCanta: mesa.florPendiente.equipoQueCanta,
            equipoQueResponde: mesa.florPendiente.equipoQueResponde,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });
      }, delay);
    } else if (florResult.resultado) {
      setTimeout(() => {
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('flor-resuelta', {
            resultado: {
              ganador: florResult.resultado.ganador,
              puntosGanados: florResult.resultado.puntosGanados,
              floresCantadas: (florResult.resultado.floresCantadas || []).map(f => ({
                ...f,
                puntos: null,
              })),
              mejorFlor: null,
            },
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (mesa.winnerJuego !== null) {
          room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('juego-finalizado', {
              ganadorEquipo: mesa.winnerJuego,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
          broadcastLobby(io);
        }
      }, delay);
    }
  }
}

// Calcular envido de un jugador según las reglas:
// - Si tiene pieza: valor de la pieza + carta más alta de las otras 2
// - Si no tiene pieza y tiene 2 cartas del mismo palo: suma de las 2 + 20
// - Si las 3 cartas son de distinto palo: la carta más alta
// Envido máximo: 37 (2 de la muestra=30 + 7)
function calcularPuntosEnvidoJugador(jugador, muestra) {
  // IMPORTANTE: Usar cartasOriginales (las 3 cartas repartidas) para el cálculo,
  // ya que el jugador puede haber tirado una carta antes de que se cante envido
  const cartas = jugador.cartasOriginales && jugador.cartasOriginales.length === 3
    ? jugador.cartasOriginales
    : jugador.cartas;
  if (cartas.length === 0) return 0;

  // Verificar si tiene piezas
  const piezas = cartas.filter(c => esPieza(c, muestra));

  if (piezas.length > 0) {
    // Tiene pieza(s): tomar la pieza de mayor valor
    const piezasConValor = piezas.map(p => ({
      carta: p,
      valorEnvido: getValorEnvido(p, muestra),
    })).sort((a, b) => b.valorEnvido - a.valorEnvido);

    const mejorPieza = piezasConValor[0];

    // Buscar la carta más alta entre las otras 2 (excluyendo solo la mejor pieza)
    // IMPORTANTE: Según las reglas, "la carta más alta" se refiere al valor numérico
    // de la carta (1-7 valen su número, 10-12 valen 0), NO al valor especial de pieza.
    // Ejemplo: 2 muestra (30) + 4 muestra = 30 + 4 = 34, NO 30 + 29 = 59
    // El envido máximo es 37 = 2 muestra (30) + 7 de cualquier palo
    const otrasCartas = cartas.filter(c => !(c.palo === mejorPieza.carta.palo && c.valor === mejorPieza.carta.valor));

    let mejorOtra = 0;
    otrasCartas.forEach(c => {
      // Usar el valor numérico de la carta: 1-7 valen su número, 10-12 valen 0
      const val = c.valor >= 10 ? 0 : c.valor;
      if (val > mejorOtra) mejorOtra = val;
    });

    return mejorPieza.valorEnvido + mejorOtra;
  }

  // Sin piezas: calcular envido normal (2 del mismo palo + 20, o carta más alta)
  return calcularEnvidoNormal(cartas);
}

// Calcular envido sin piezas (método normal: 2 cartas mismo palo + 20, o carta más alta)
function calcularEnvidoNormal(cartas) {
  const porPalo = {};
  cartas.forEach(c => {
    if (!porPalo[c.palo]) porPalo[c.palo] = [];
    const val = c.valor >= 10 ? 0 : c.valor;
    porPalo[c.palo].push(val);
  });

  let mejorPuntaje = 0;
  for (const palo in porPalo) {
    const valores = porPalo[palo].sort((a, b) => b - a);
    if (valores.length >= 2) {
      const puntos = valores[0] + valores[1] + 20;
      if (puntos > mejorPuntaje) mejorPuntaje = puntos;
    }
  }

  if (mejorPuntaje === 0) {
    cartas.forEach(c => {
      const val = c.valor >= 10 ? 0 : c.valor;
      if (val > mejorPuntaje) mejorPuntaje = val;
    });
  }
  return mejorPuntaje;
}

// === PIEZA SYSTEM ===
// Piezas son las cartas del palo de la muestra con valores: 2, 4, 5, 10, 11
// El 12 del palo de la muestra NO es pieza per se, pero toma el valor de envido
// de la pieza que está en la muestra (si la muestra es pieza).
// Las piezas tienen valores de envido especiales:
// 2 de muestra = 30, 4 de muestra = 29, 5 de muestra = 28, 10/11 de muestra = 27
const VALORES_PIEZA = [2, 4, 5, 10, 11];

function esPieza(carta, muestra) {
  if (!muestra) return false;
  if (carta.palo !== muestra.palo) return false;
  // Una pieza es una carta del palo de la muestra con valor 2, 4, 5, 10 u 11
  if (VALORES_PIEZA.includes(carta.valor)) return true;
  // El 12 del palo de la muestra TAMBIÉN es pieza si la muestra es pieza
  if (carta.valor === 12 && VALORES_PIEZA.includes(muestra.valor)) return true;
  return false;
}

function valorPiezaMuestra(muestra) {
  switch (muestra.valor) {
    case 2: return 30;
    case 4: return 29;
    case 5: return 28;
    case 10: return 27;
    case 11: return 27;
    default: return 0;
  }
}

function getValorEnvido(carta, muestra) {
  if (!muestra) {
    return carta.valor >= 10 ? 0 : carta.valor;
  }

  if (carta.palo === muestra.palo) {
    switch (carta.valor) {
      case 2: return 30;
      case 4: return 29;
      case 5: return 28;
      case 10: return 27;
      case 11: return 27;
      case 12:
        // El 12 toma el valor de la pieza de la muestra si la muestra es pieza
        if (VALORES_PIEZA.includes(muestra.valor)) {
          return valorPiezaMuestra(muestra);
        }
        return 0;
      default:
        return carta.valor;
    }
  }

  return carta.valor >= 10 ? 0 : carta.valor;
}

// === FLOR SYSTEM ===
// Reglas de FLOR en Truco Uruguayo:
// 1. 3 cartas del mismo palo = FLOR
// 2. Al menos 2 piezas (del palo de la muestra, valores 2,4,5,10,11) = FLOR
// 3. 1 pieza + 2 cartas del mismo palo = FLOR
function tieneFlor(jugador, muestra) {
  // IMPORTANTE: Usar cartasOriginales para el cálculo,
  // ya que el jugador puede haber tirado una carta
  const cartas = jugador.cartasOriginales && jugador.cartasOriginales.length === 3
    ? jugador.cartasOriginales
    : jugador.cartas;
  if (cartas.length !== 3) return false;

  // Regla 1: 3 cartas del mismo palo
  const primerPalo = cartas[0].palo;
  if (cartas.every(c => c.palo === primerPalo)) {
    return true;
  }

  // Contar piezas y no-piezas (basado en la muestra)
  const piezas = cartas.filter(c => esPieza(c, muestra));
  const noPiezas = cartas.filter(c => !esPieza(c, muestra));

  // Regla 2: 2 o más piezas = FLOR
  if (piezas.length >= 2) {
    return true;
  }

  // Regla 3: 1 pieza + 2 cartas del mismo palo
  if (piezas.length === 1 && noPiezas.length === 2) {
    if (noPiezas[0].palo === noPiezas[1].palo) {
      return true;
    }
  }

  return false;
}

// Calcular puntos de FLOR según las reglas:
// Se suman los valores de las 3 cartas.
// Si hay más de una pieza, se toma el valor completo de la más alta
// y del resto de piezas solo suma el último dígito.
// Las cartas no-pieza suman su número, excepto 10,11,12 de otro palo que suman 0.
// No se suma +20 base - los valores de pieza ya incluyen todo (30,29,28,27)
function calcularPuntosFlor(jugador, muestra) {
  // IMPORTANTE: Usar cartasOriginales para el cálculo,
  // ya que el jugador puede haber tirado una carta
  const cartas = jugador.cartasOriginales && jugador.cartasOriginales.length === 3
    ? jugador.cartasOriginales
    : jugador.cartas;
  if (!tieneFlor(jugador, muestra)) return 0;

  // Separar piezas y no-piezas
  const piezas = cartas.filter(c => esPieza(c, muestra));

  if (piezas.length === 0) {
    // Flor por 3 cartas del mismo palo, sin piezas
    // Suma valores + 20 (como envido normal de 2 cartas, pero con 3)
    let suma = 0;
    cartas.forEach(c => {
      suma += (c.valor >= 10 ? 0 : c.valor);
    });
    return suma + 20;
  }

  if (piezas.length === 1) {
    // 1 pieza: valor completo de la pieza + valores normales de las otras 2
    const pieza = piezas[0];
    const valorPieza = getValorEnvido(pieza, muestra);
    const noPiezas = cartas.filter(c => !(c.palo === pieza.palo && c.valor === pieza.valor));
    let sumaOtras = 0;
    noPiezas.forEach(c => {
      sumaOtras += (c.valor >= 10 ? 0 : c.valor);
    });
    return valorPieza + sumaOtras;
  }

  // 2 o más piezas: valor completo de la más alta + último dígito del resto
  // Ordenar piezas por valor de envido descendente
  const piezasConValor = piezas.map(p => ({
    carta: p,
    valorEnvido: getValorEnvido(p, muestra),
  })).sort((a, b) => b.valorEnvido - a.valorEnvido);

  let total = piezasConValor[0].valorEnvido; // Valor completo de la más alta

  // Resto de piezas: solo último dígito (valor - 20, ej: 30→10, 29→9, 28→8, 27→7)
  for (let i = 1; i < piezasConValor.length; i++) {
    total += piezasConValor[i].valorEnvido - 20;
  }

  // Sumar cartas que no son piezas (si hay alguna con 3 piezas)
  const noPiezas = cartas.filter(c => !esPieza(c, muestra));
  noPiezas.forEach(c => {
    total += (c.valor >= 10 ? 0 : c.valor);
  });

  return total;
}

function detectarJugadoresConFlor(mesa) {
  // Returns array of { jugadorId, jugadorNombre, equipo, puntos }
  const jugadoresConFlor = [];
  mesa.jugadores.forEach(j => {
    if (tieneFlor(j, mesa.muestra)) {
      jugadoresConFlor.push({
        jugadorId: j.id,
        jugadorNombre: j.nombre,
        equipo: j.equipo,
        puntos: calcularPuntosFlor(j, mesa.muestra),
      });
    }
  });
  return jugadoresConFlor;
}

function cantarFlor(mesa, jugadorId) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { success: false, error: 'Jugador no encontrado' };

  if (!tieneFlor(jugador, mesa.muestra)) {
    return { success: false, error: 'No tenés flor' };
  }

  // Check if this player already declared flor
  if (mesa.floresCantadas.some(f => f.jugadorId === jugadorId)) {
    return { success: false, error: 'Ya cantaste flor' };
  }

  const puntosFlor = calcularPuntosFlor(jugador, mesa.muestra);

  mesa.floresCantadas.push({
    jugadorId,
    jugadorNombre: jugador.nombre,
    equipo: jugador.equipo,
    puntos: puntosFlor,
  });

  // Check if all players with flor have declared
  const jugadoresConFlorRestantes = mesa.jugadoresConFlor.filter(
    id => !mesa.floresCantadas.some(f => f.jugadorId === id)
  );

  if (jugadoresConFlorRestantes.length === 0) {
    // All flor declarations done - resolve
    return resolverFlor(mesa);
  }

  return {
    success: true,
    continua: true,
    declaracion: {
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      puntos: puntosFlor,
    },
  };
}

function resolverFlor(mesa) {
  // Determine winner
  // If only one team has flor, they get 3 points per flor
  // If both teams have flor, the highest flor wins (all points)
  // In case of tie, mano team wins

  const floresEquipo1 = mesa.floresCantadas.filter(f => f.equipo === 1);
  const floresEquipo2 = mesa.floresCantadas.filter(f => f.equipo === 2);

  let ganador = null;
  let puntosGanados = 0;
  let mejorFlor = null;

  if (floresEquipo1.length > 0 && floresEquipo2.length === 0) {
    // Solo equipo 1 tiene flor
    ganador = 1;
    puntosGanados = 3 * floresEquipo1.length;
  } else if (floresEquipo2.length > 0 && floresEquipo1.length === 0) {
    // Solo equipo 2 tiene flor
    ganador = 2;
    puntosGanados = 3 * floresEquipo2.length;
  } else if (floresEquipo1.length > 0 && floresEquipo2.length > 0) {
    // Ambos equipos tienen flor - se comparan
    const mejorFlor1 = Math.max(...floresEquipo1.map(f => f.puntos));
    const mejorFlor2 = Math.max(...floresEquipo2.map(f => f.puntos));

    if (mejorFlor1 > mejorFlor2) {
      ganador = 1;
      mejorFlor = mejorFlor1;
    } else if (mejorFlor2 > mejorFlor1) {
      ganador = 2;
      mejorFlor = mejorFlor2;
    } else {
      // Empate - gana el equipo de la mano
      const manoEquipo = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
      ganador = manoEquipo;
      mejorFlor = mejorFlor1;
    }

    // Winner gets 3 points for each flor declared (from both teams)
    puntosGanados = 3 * (floresEquipo1.length + floresEquipo2.length);
  }

  if (ganador) {
    const equipo = mesa.equipos.find(e => e.id === ganador);
    if (equipo) equipo.puntaje += puntosGanados;

    // Flor anula el envido
    mesa.envidoYaCantado = true;
    mesa.envidoActivo = null;
    mesa.florYaCantada = true;

    // Check for game win
    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = ganador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
  }

  return {
    success: true,
    finalizado: true,
    resultado: {
      ganador,
      puntosGanados,
      floresCantadas: mesa.floresCantadas,
      mejorFlor,
    },
  };
}

// Responder a la flor cuando ambos equipos tienen flor
// tipoRespuesta: 'quiero' (comparar flores normal), 'contra_flor' (gana el partido), 'no_quiero' (pierde su flor)
function responderFlor(mesa, jugadorId, tipoRespuesta) {
  if (!mesa.esperandoRespuestaFlor || !mesa.florPendiente) {
    return { success: false, error: 'No hay flor pendiente de respuesta' };
  }

  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { success: false, error: 'Jugador no encontrado' };

  // Solo el equipo que debe responder puede hacerlo
  if (jugador.equipo !== mesa.florPendiente.equipoQueResponde) {
    return { success: false, error: 'No es tu turno de responder' };
  }

  // Si la respuesta es contra_flor o con_flor_envido, el otro equipo debe aceptar/rechazar
  if (tipoRespuesta === 'contra_flor' || tipoRespuesta === 'con_flor_envido') {
    const equipoAnteriorQueCanta = mesa.florPendiente.equipoQueCanta;
    const equipoAnteriorQueResponde = mesa.florPendiente.equipoQueResponde;
    mesa.florPendiente = {
      equipoQueCanta: equipoAnteriorQueResponde,
      equipoQueResponde: equipoAnteriorQueCanta,
      tipoRespuesta: null,
      ultimoTipo: tipoRespuesta, // Guardar qué se cantó para la UI
    };
    // Mantener esperandoRespuestaFlor = true
    return {
      success: true,
      pendiente: true, // Indica que hay nueva ronda de respuesta
      tipoRespuesta,
      jugadorNombre: jugador.nombre,
    };
  }

  // Determinar qué tipo de flor se está resolviendo (puede haber escalación previa)
  const ultimoTipoCantado = mesa.florPendiente.ultimoTipo || null;

  mesa.esperandoRespuestaFlor = false;
  mesa.florPendiente.tipoRespuesta = tipoRespuesta;

  const floresEquipo1 = mesa.floresCantadas.filter(f => f.equipo === 1);
  const floresEquipo2 = mesa.floresCantadas.filter(f => f.equipo === 2);
  const mejorFlor1 = Math.max(...floresEquipo1.map(f => f.puntos));
  const mejorFlor2 = Math.max(...floresEquipo2.map(f => f.puntos));
  const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;

  let ganador = null;
  let puntosGanados = 0;
  let mejorFlor = null;

  // Helper para determinar ganador por comparación de flores
  const compararFlores = () => {
    if (mejorFlor1 > mejorFlor2) {
      ganador = 1; mejorFlor = mejorFlor1;
    } else if (mejorFlor2 > mejorFlor1) {
      ganador = 2; mejorFlor = mejorFlor2;
    } else {
      ganador = equipoMano; mejorFlor = mejorFlor1;
    }
  };

  if (tipoRespuesta === 'no_quiero') {
    ganador = mesa.florPendiente.equipoQueCanta;
    if (ultimoTipoCantado === 'contra_flor') {
      // No quiso contra flor al resto → el que la cantó gana la partida (todos los puntos restantes)
      const puntajeActual = mesa.equipos.find(e => e.id === ganador)?.puntaje || 0;
      puntosGanados = mesa.puntosLimite - puntajeActual;
    } else if (ultimoTipoCantado === 'con_flor_envido') {
      // No quiso con flor envido → gana 3 pts por cada flor del equipo que cantó
      const floresDelGanador = ganador === 1 ? floresEquipo1 : floresEquipo2;
      puntosGanados = 3 * floresDelGanador.length;
    } else {
      // No quiso la flor base → 3 pts por cada flor del equipo que cantó
      const floresDelGanador = ganador === 1 ? floresEquipo1 : floresEquipo2;
      puntosGanados = 3 * floresDelGanador.length;
    }
  } else if (tipoRespuesta === 'quiero') {
    compararFlores();
    if (ultimoTipoCantado === 'contra_flor') {
      // Aceptó contra flor al resto → el ganador gana lo que falta para el partido
      const puntajeActual = mesa.equipos.find(e => e.id === ganador)?.puntaje || 0;
      puntosGanados = mesa.puntosLimite - puntajeActual;
    } else if (ultimoTipoCantado === 'con_flor_envido') {
      // Aceptó con flor envido → 3 por cada flor + 2 base
      const floresTotal = floresEquipo1.length + floresEquipo2.length;
      puntosGanados = 3 * floresTotal + 2;
    } else {
      // Aceptó flor base → 3 por cada flor declarada
      puntosGanados = 3 * (floresEquipo1.length + floresEquipo2.length);
    }
  } else if (tipoRespuesta === 'contra_flor') {
    // Contra Flor al Resto - el ganador gana el partido (todos los puntos que faltan)
    if (mejorFlor1 > mejorFlor2) {
      ganador = 1;
      mejorFlor = mejorFlor1;
    } else if (mejorFlor2 > mejorFlor1) {
      ganador = 2;
      mejorFlor = mejorFlor2;
    } else {
      // Empate - gana el mano
      ganador = equipoMano;
      mejorFlor = mejorFlor1;
    }
    // Puntos para ganar el partido
    const puntajeActual = mesa.equipos.find(e => e.id === ganador)?.puntaje || 0;
    puntosGanados = mesa.puntosLimite - puntajeActual;
  } else if (tipoRespuesta === 'con_flor_envido') {
    // Con Flor Envido - se comparan flores y envidos, puntos combinados
    // Primero calcular envido de cada equipo
    let mejorEnvido1 = 0;
    let mejorEnvido2 = 0;
    mesa.jugadores.forEach(j => {
      const puntos = calcularPuntosEnvidoJugador(j, mesa.muestra);
      if (j.equipo === 1 && puntos > mejorEnvido1) mejorEnvido1 = puntos;
      if (j.equipo === 2 && puntos > mejorEnvido2) mejorEnvido2 = puntos;
    });

    // Sumar flor + envido para cada equipo
    const totalEquipo1 = mejorFlor1 + mejorEnvido1;
    const totalEquipo2 = mejorFlor2 + mejorEnvido2;

    if (totalEquipo1 > totalEquipo2) {
      ganador = 1;
      mejorFlor = mejorFlor1;
    } else if (totalEquipo2 > totalEquipo1) {
      ganador = 2;
      mejorFlor = mejorFlor2;
    } else {
      // Empate total - gana el mano
      ganador = equipoMano;
      mejorFlor = equipoMano === 1 ? mejorFlor1 : mejorFlor2;
    }
    // Puntos: 3 por cada flor + puntos del envido que estaba en juego (o 2 si no había)
    const floresTotal = floresEquipo1.length + floresEquipo2.length;
    puntosGanados = 3 * floresTotal + 2; // 3 pts por flor + 2 pts de envido base
  }

  // Aplicar puntos
  if (ganador) {
    const equipo = mesa.equipos.find(e => e.id === ganador);
    if (equipo) equipo.puntaje += puntosGanados;

    mesa.envidoYaCantado = true;
    mesa.envidoActivo = null;
    mesa.florYaCantada = true;
    mesa.florPendiente = null;

    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = ganador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
  }

  return {
    success: true,
    tipoRespuesta,
    resultado: {
      ganador,
      puntosGanados,
      floresCantadas: mesa.floresCantadas,
      mejorFlor,
      esContraFlor: tipoRespuesta === 'contra_flor',
      esConFlorEnvido: tipoRespuesta === 'con_flor_envido',
    },
  };
}

function resolverEnvido(mesa) {
  let mejorEquipo1 = 0;
  let mejorEquipo2 = 0;

  mesa.jugadores.forEach(jugador => {
    const puntos = calcularPuntosEnvidoJugador(jugador, mesa.muestra);
    if (jugador.equipo === 1 && puntos > mejorEquipo1) mejorEquipo1 = puntos;
    if (jugador.equipo === 2 && puntos > mejorEquipo2) mejorEquipo2 = puntos;
  });

  const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
  let ganador;
  if (mejorEquipo1 > mejorEquipo2) ganador = 1;
  else if (mejorEquipo2 > mejorEquipo1) ganador = 2;
  else ganador = equipoMano;

  return {
    equipo1Puntos: mejorEquipo1,
    equipo2Puntos: mejorEquipo2,
    ganador,
    puntosGanados: mesa.envidoActivo?.puntosAcumulados || 2,
  };
}

function responderEnvido(mesa, jugadorId, acepta) {
  if (!mesa.envidoActivo) return { success: false, error: 'No hay envido activo' };
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || jugador.equipo === mesa.envidoActivo.equipoQueCanta) {
    return { success: false, error: 'No puedes responder a tu propio envido' };
  }

  const equipoQueResponde = jugador.equipo;
  const esGrupal = necesitaRespuestaGrupal(mesa, equipoQueResponde);

  if (esGrupal) {
    // Guardar respuesta individual
    mesa.respuestasEnvido[jugadorId] = acepta;
    mesa.esperandoRespuestasGrupales = true;
    mesa.tipoRespuestaGrupal = 'envido';

    // Verificar si todos respondieron
    if (!todosRespondieron(mesa, 'envido')) {
      return {
        success: true,
        parcial: true,
        jugadorId,
        acepta,
        faltanResponder: getJugadoresEquipoQueResponden(mesa, equipoQueResponde)
          .filter(j => mesa.respuestasEnvido[j.id] === undefined)
          .map(j => j.id)
      };
    }

    // Todos respondieron - obtener resultado final
    acepta = getResultadoRespuestaGrupal(mesa, 'envido');
    mesa.respuestasEnvido = {};
    mesa.esperandoRespuestasGrupales = false;
    mesa.tipoRespuestaGrupal = null;
  }

  mesa.envidoYaCantado = true;

  if (acepta) {
    // Resolver el envido automáticamente - generar todas las declaraciones
    // diferirPuntos=true para que no sume al marcador hasta después de las animaciones
    const puntosAcumulados = mesa.envidoActivo.puntosAcumulados;
    mesa.envidoActivo = null;

    const resultado = resolverEnvidoAutomatico(mesa, puntosAcumulados, true);
    return { success: true, parcial: false, acepta: true, inicioDeclaracion: true, automatico: true, resultado };
  } else {
    const puntos = mesa.envidoActivo.puntosSiNoQuiere;
    const equipoGanador = mesa.envidoActivo.equipoQueCanta;
    const equipo = mesa.equipos.find(e => e.id === equipoGanador);
    if (equipo) equipo.puntaje += puntos;
    mesa.envidoActivo = null;
    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = equipoGanador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
    return { success: true, parcial: false, acepta: false };
  }
}

// Resolver envido automáticamente generando declaraciones en orden correcto
// Flujo: mano declara primero, luego el equipo contrario responde,
// compañeros solo intervienen si tienen más puntos que el mejor actual
// diferirPuntos: si es true, NO suma los puntos al marcador (para sumarlos después de las animaciones)
function resolverEnvidoAutomatico(mesa, puntosAcumulados, diferirPuntos = false) {
  const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
  const equipoContrario = equipoMano === 1 ? 2 : 1;

  // Calcular puntos de cada jugador
  const jugadoresConPuntos = mesa.jugadores
    .filter(j => j.participaRonda !== false)
    .map(j => ({
      jugadorId: j.id,
      jugadorNombre: j.nombre,
      equipo: j.equipo,
      puntos: calcularPuntosEnvidoJugador(j, mesa.muestra),
    }));

  // Separar por equipo (mayor a menor)
  const equipoManoJugadores = jugadoresConPuntos
    .filter(j => j.equipo === equipoMano)
    .sort((a, b) => b.puntos - a.puntos);

  const equipoContrarioJugadores = jugadoresConPuntos
    .filter(j => j.equipo === equipoContrario)
    .sort((a, b) => b.puntos - a.puntos);

  const declaraciones = [];
  let mejorPuntajeDeclarado = null;
  let equipoMejorPuntaje = null;

  // Índices de avance por equipo (ya están ordenados de mayor a menor)
  let idxMano = 0;
  let idxContrario = 0;

  // Paso 1: El mejor del equipo mano declara primero (siempre dice sus puntos)
  const primerMano = equipoManoJugadores[idxMano];
  declaraciones.push({
    jugadorId: primerMano.jugadorId,
    jugadorNombre: primerMano.jugadorNombre,
    equipo: primerMano.equipo,
    puntos: primerMano.puntos,
    sonBuenas: false,
  });
  mejorPuntajeDeclarado = primerMano.puntos;
  equipoMejorPuntaje = primerMano.equipo;
  idxMano++;

  // Paso 2: Alternar entre equipos - el equipo contrario debe intentar superar
  // Turno del equipo contrario primero (responder al mano)
  let turnoEquipo = 'contrario'; // empieza respondiendo el contrario

  while (true) {
    if (turnoEquipo === 'contrario') {
      if (idxContrario >= equipoContrarioJugadores.length) break; // no quedan jugadores

      const jugador = equipoContrarioJugadores[idxContrario];
      idxContrario++;

      if (equipoMejorPuntaje === equipoContrario) {
        // Mi equipo ya lidera, no necesito revelar puntos
        break;
      }

      if (jugador.puntos > mejorPuntajeDeclarado) {
        // Supera al mejor: declara sus puntos
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: jugador.puntos,
          sonBuenas: false,
        });
        mejorPuntajeDeclarado = jugador.puntos;
        equipoMejorPuntaje = jugador.equipo;
        // Ahora el equipo mano debe responder
        turnoEquipo = 'mano';
      } else if (jugador.puntos === mejorPuntajeDeclarado) {
        // Empate: declara puntos pero mano gana el empate
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: jugador.puntos,
          sonBuenas: false,
        });
        // Empate: mano sigue ganando, ver si el contrario tiene más jugadores
        if (idxContrario < equipoContrarioJugadores.length) {
          // Siguiente del contrario intenta
          continue;
        } else {
          // No quedan más del contrario, mano gana
          break;
        }
      } else {
        // No puede superar: son buenas
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: null,
          sonBuenas: true,
        });
        // Ver si quedan más del equipo contrario que puedan superar
        if (idxContrario < equipoContrarioJugadores.length) {
          // El siguiente del contrario ya tiene puntos menores (están ordenados), no puede
          // Todos los restantes del contrario dicen son buenas implícitamente
          break;
        } else {
          break;
        }
      }
    } else {
      // turnoEquipo === 'mano'
      if (idxMano >= equipoManoJugadores.length) break; // no quedan jugadores

      const jugador = equipoManoJugadores[idxMano];
      idxMano++;

      if (equipoMejorPuntaje === equipoMano) {
        // Mi equipo ya lidera, no necesito revelar puntos
        break;
      }

      if (jugador.puntos > mejorPuntajeDeclarado) {
        // Supera al mejor: declara sus puntos
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: jugador.puntos,
          sonBuenas: false,
        });
        mejorPuntajeDeclarado = jugador.puntos;
        equipoMejorPuntaje = jugador.equipo;
        // Ahora el equipo contrario debe responder
        turnoEquipo = 'contrario';
      } else if (jugador.puntos === mejorPuntajeDeclarado) {
        // Empate: declara, pero como es mano gana el empate
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: jugador.puntos,
          sonBuenas: false,
        });
        mejorPuntajeDeclarado = jugador.puntos;
        equipoMejorPuntaje = jugador.equipo; // mano gana empate
        // Mano ahora lidera, contrario debe responder
        turnoEquipo = 'contrario';
      } else {
        // No puede superar: son buenas
        declaraciones.push({
          jugadorId: jugador.jugadorId,
          jugadorNombre: jugador.jugadorNombre,
          equipo: jugador.equipo,
          puntos: null,
          sonBuenas: true,
        });
        // Los restantes del mano tienen puntos menores (ordenados), no pueden
        break;
      }
    }
  }

  // Determinar ganador (en empate gana mano)
  let ganador = equipoMejorPuntaje;
  if (ganador === null) ganador = equipoMano;

  const mejorMano = equipoManoJugadores[0].puntos;
  const mejorContrario = equipoContrarioJugadores[0].puntos;
  if (mejorMano === mejorContrario) {
    ganador = equipoMano; // Empate gana mano
  }

  // Asignar puntos (solo si no se difieren)
  const equipo = mesa.equipos.find(e => e.id === ganador);
  if (!diferirPuntos) {
    if (equipo) equipo.puntaje += puntosAcumulados;

    // Check for game win
    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = ganador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
  }

  // Guardar cartas de TODOS los jugadores que declararon puntos para revelar al final
  for (const decl of declaraciones) {
    if (decl.sonBuenas) continue;
    const jugadorObj = mesa.jugadores.find(j => j.id === decl.jugadorId);
    if (jugadorObj) {
      mesa.cartasEnvidoReveladas.push({
        jugadorId: decl.jugadorId,
        jugadorNombre: decl.jugadorNombre,
        equipo: decl.equipo,
        puntos: decl.puntos,
        cartas: (jugadorObj.cartasOriginales && jugadorObj.cartasOriginales.length === 3
          ? jugadorObj.cartasOriginales
          : jugadorObj.cartas).map(c => ({ ...c })),
      });
    }
  }

  // Limpiar estado de envido
  mesa.envidoDeclaracion = null;

  return {
    declaraciones,
    ganador,
    puntosGanados: puntosAcumulados,
    mejorPuntaje: mejorPuntajeDeclarado,
  };
}

// Declare envido points (called by each player in turn)
function declararEnvido(mesa, jugadorId, puntos, sonBuenas = false) {
  if (!mesa.envidoDeclaracion || mesa.envidoDeclaracion.fase !== 'declarando') {
    return { success: false, error: 'No hay declaración de envido activa' };
  }

  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return { success: false, error: 'Jugador no encontrado' };

  const jugadorIndex = mesa.jugadores.findIndex(j => j.id === jugadorId);
  if (jugadorIndex !== mesa.envidoDeclaracion.turnoDeclarar) {
    return { success: false, error: 'No es tu turno de declarar' };
  }

  // Calculate actual envido points for validation
  const puntosReales = calcularPuntosEnvidoJugador(jugador, mesa.muestra);

  if (sonBuenas) {
    // Player can only say "son buenas" if they know they lost
    // (opponent's declared points are higher than theirs)
    if (mesa.envidoDeclaracion.mejorPuntajeDeclarado === null) {
      return { success: false, error: 'No puedes decir son buenas primero' };
    }
    if (puntosReales >= mesa.envidoDeclaracion.mejorPuntajeDeclarado) {
      return { success: false, error: 'Tienes puntos iguales o mayores, no puedes decir son buenas' };
    }

    mesa.envidoDeclaracion.declaraciones.push({
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      puntos: null, // Hidden (son buenas)
      sonBuenas: true,
    });
  } else {
    // Regular declaration
    // Note: we use the actual points, not what the player claims
    mesa.envidoDeclaracion.declaraciones.push({
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      puntos: puntosReales,
      sonBuenas: false,
    });

    // Update best score if this is higher
    if (mesa.envidoDeclaracion.mejorPuntajeDeclarado === null ||
        puntosReales > mesa.envidoDeclaracion.mejorPuntajeDeclarado) {
      mesa.envidoDeclaracion.mejorPuntajeDeclarado = puntosReales;
      mesa.envidoDeclaracion.equipoMejorPuntaje = jugador.equipo;
    } else if (puntosReales === mesa.envidoDeclaracion.mejorPuntajeDeclarado) {
      // Tie goes to mano
      if (jugador.equipo === mesa.envidoDeclaracion.equipoMano) {
        mesa.envidoDeclaracion.equipoMejorPuntaje = jugador.equipo;
      }
    }
  }

  // Check if all players have declared (or we have enough info)
  // For now, we'll use a simplified 2-team system: after both teams have a declaration, resolve
  const equiposDeclarados = new Set(mesa.envidoDeclaracion.declaraciones.map(d => d.equipo));

  if (equiposDeclarados.size >= 2 || mesa.envidoDeclaracion.declaraciones.length >= mesa.jugadores.length) {
    // All done - resolve envido
    return finalizarDeclaracionEnvido(mesa);
  }

  // Move to next player to declare
  mesa.envidoDeclaracion.turnoDeclarar = (mesa.envidoDeclaracion.turnoDeclarar + 1) % mesa.jugadores.length;

  // Skip to next team's player if needed
  const currentTeam = jugador.equipo;
  while (mesa.jugadores[mesa.envidoDeclaracion.turnoDeclarar]?.equipo === currentTeam) {
    // Check if the other team has already declared
    const otherTeamDeclarations = mesa.envidoDeclaracion.declaraciones.filter(
      d => d.equipo !== currentTeam
    );
    if (otherTeamDeclarations.length > 0) {
      // Other team already declared, resolve now
      return finalizarDeclaracionEnvido(mesa);
    }
    mesa.envidoDeclaracion.turnoDeclarar = (mesa.envidoDeclaracion.turnoDeclarar + 1) % mesa.jugadores.length;
  }

  return {
    success: true,
    continua: true,
    turnoDeclarar: mesa.envidoDeclaracion.turnoDeclarar,
    declaracion: mesa.envidoDeclaracion.declaraciones[mesa.envidoDeclaracion.declaraciones.length - 1],
  };
}

function finalizarDeclaracionEnvido(mesa) {
  const decl = mesa.envidoDeclaracion;
  decl.fase = 'resuelto';

  // Determine winner
  let ganador = decl.equipoMejorPuntaje;
  if (ganador === null) {
    // Everyone said "son buenas"? Shouldn't happen, but mano wins
    ganador = decl.equipoMano;
  }

  // Award points
  const equipo = mesa.equipos.find(e => e.id === ganador);
  if (equipo) equipo.puntaje += decl.puntosAcumulados;

  // Check for game win
  if (equipo && equipo.puntaje >= mesa.puntosLimite) {
    mesa.winnerJuego = ganador;
    mesa.estado = 'terminado';
    mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
    mesa.fase = 'finalizada';
  }

  // Build result summary
  const resultado = {
    ganador,
    puntosGanados: decl.puntosAcumulados,
    declaraciones: decl.declaraciones,
    mejorPuntaje: decl.mejorPuntajeDeclarado,
  };

  // Clean up
  mesa.envidoDeclaracion = null;

  return {
    success: true,
    finalizado: true,
    resultado,
  };
}

function irseAlMazo(mesa, jugadorId) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || mesa.estado !== 'jugando') return false;
  if (jugador.seVaAlMazo) return false; // Ya se fue

  // Marcar al jugador como fuera (se fue al mazo)
  jugador.seVaAlMazo = true;
  jugador.cartas = []; // Ya no tiene cartas

  const equipoContrario = jugador.equipo === 1 ? 2 : 1;

  // Verificar si TODOS los jugadores participantes de ese equipo se fueron al mazo
  const companerosActivos = mesa.jugadores.filter(
    j => j.equipo === jugador.equipo && j.participaRonda !== false && !j.seVaAlMazo
  );

  if (companerosActivos.length === 0) {
    // Antes de finalizar: resolver flor pendiente si existe
    if (!mesa.florYaCantada && mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0) {
      // Hay jugadores con flor que no se resolvió aún
      // El equipo que se va al mazo pierde su derecho a flor
      // Resolver: dar 3 puntos por cada jugador con flor del equipo que queda
      const equipoQueQueda = equipoContrario;
      const florDelEquipoQueQueda = mesa.jugadoresConFlor.filter(id => {
        const j = mesa.jugadores.find(jj => jj.id === id);
        return j && j.equipo === equipoQueQueda;
      });
      const florDelEquipoQueSeVa = mesa.jugadoresConFlor.filter(id => {
        const j = mesa.jugadores.find(jj => jj.id === id);
        return j && j.equipo === jugador.equipo;
      });

      if (florDelEquipoQueQueda.length > 0) {
        // El equipo que queda tiene flor: recibe 3 pts por flor (achicarse - no hay respuesta)
        const puntosFlor = 3;
        const equipo = mesa.equipos.find(e => e.id === equipoQueQueda);
        if (equipo) equipo.puntaje += puntosFlor;
        mesa.florYaCantada = true;
        mesa.envidoYaCantado = true;
        // Registrar las flores cantadas para el banner
        florDelEquipoQueQueda.forEach(id => {
          const jFlor = mesa.jugadores.find(jj => jj.id === id);
          if (jFlor) {
            mesa.floresCantadas.push({
              jugadorId: id,
              jugadorNombre: jFlor.nombre,
              equipo: jFlor.equipo,
              puntos: calcularPuntosFlor(jFlor, mesa.muestra),
            });
          }
        });
        // Guardar cartas de flor para mostrar en el banner de ronda
        mesa.cartasFlorReveladas = florDelEquipoQueQueda.map(id => {
          const jFlor = mesa.jugadores.find(jj => jj.id === id);
          return {
            jugadorId: id,
            jugadorNombre: jFlor?.nombre || '',
            equipo: jFlor?.equipo || 0,
            puntos: jFlor ? calcularPuntosFlor(jFlor, mesa.muestra) : 0,
            cartas: jFlor?.cartasOriginales || jFlor?.cartas || [],
          };
        });
      } else if (florDelEquipoQueSeVa.length > 0) {
        // Solo el equipo que se va tiene flor - no ganan nada (se fueron)
        mesa.florYaCantada = true;
        mesa.envidoYaCantado = true;
      }
    }

    // Si no se cantó envido y nadie lo resolvió, el equipo que se va pierde ese derecho también
    if (!mesa.envidoYaCantado) {
      mesa.envidoYaCantado = true;
    }

    // Todo el equipo se fue al mazo: finalizar la ronda
    finalizarRonda(mesa, equipoContrario);
    mesa.mensajeRonda = `Equipo ${jugador.equipo} se fue al mazo. Equipo ${equipoContrario} gana (+${mesa.puntosEnJuego} pts)`;
    return true;
  }

  // Aún quedan compañeros: el juego continúa
  // Si era el turno de este jugador, avanzar al siguiente
  const jugadorIndex = mesa.jugadores.findIndex(j => j.id === jugadorId);
  if (mesa.turnoActual === jugadorIndex) {
    let next = (mesa.turnoActual + 1) % mesa.jugadores.length;
    let intentos = 0;
    while ((mesa.jugadores[next].participaRonda === false || mesa.jugadores[next].seVaAlMazo) && intentos < mesa.jugadores.length) {
      next = (next + 1) % mesa.jugadores.length;
      intentos++;
    }
    mesa.turnoActual = next;
  }

  mesa.mensajeRonda = `${jugador.nombre} se fue al mazo`;
  // No finalizar la ronda - devolver un indicador especial
  return 'parcial';
}

// ============================================================
// Helper
// ============================================================

function findRoomBySocket(socketId) {
  for (const room of lobbyRooms.values()) {
    if (room.jugadores.some(j => j.socketId === socketId)) {
      return room;
    }
  }
  return null;
}

function broadcastLobby(io) {
  const partidas = Array.from(lobbyRooms.values())
    .filter(r => r.estado !== 'terminado')
    .map(room => ({
      mesaId: room.mesaId,
      jugadores: room.jugadores.length,
      maxJugadores: room.maxJugadores,
      tamañoSala: room.tamañoSala,
      estado: room.estado,
      creadorNombre: room.creadorNombre || null, // Nombre del creador
      jugadoresNombres: room.jugadores.map(j => j.nombre), // Lista de nombres para reconexión
      modoAlternado: room.modoAlternado, // Pico a Pico
      modoAyuda: room.modoAyuda, // Modo ayuda para principiantes
    }));
  io.to('lobby').emit('partidas-disponibles', partidas);
}

function broadcastToRoom(io, room, event, dataFn) {
  room.jugadores.forEach(p => {
    const mesa = engines.get(room.mesaId);
    if (mesa) {
      io.to(p.socketId).emit(event, typeof dataFn === 'function' ? dataFn(p.socketId, mesa) : dataFn);
    }
  });
}

// Helper: start next round with cut phase
function scheduleNextRound(io, room) {
  const mesaId = room.mesaId;
  setTimeout(() => {
    const currentMesa = engines.get(mesaId);
    const currentRoom = lobbyRooms.get(mesaId);
    if (currentMesa && currentRoom) {
      iniciarSiguienteRonda(currentMesa);
      // Send state update (shows shuffle animation)
      currentRoom.jugadores.forEach(p => {
        io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
      });
      // Notify who should cut
      const cortador = currentMesa.jugadores[currentMesa.indiceJugadorCorta];
      if (cortador) {
        currentRoom.jugadores.forEach(p => {
          io.to(p.socketId).emit('corte-solicitado', {
            jugadorId: cortador.id,
            estado: getEstadoParaJugador(currentMesa, p.socketId),
          });
        });
      }
    }
  }, 2000); // Reducido de 3000 a 2000ms
}

// ============================================================
// Main
// ============================================================

app.prepare().then(async () => {
  // Inicializar base de datos Turso
  await initDB();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Map socketId → userId para saber qué usuario está detrás de cada socket
  const socketUsuarios = new Map();

  // Helper: guardar partida en BD cuando termina el juego
  async function guardarResultadoPartida(room, mesa) {
    try {
      const duracionSeg = room.inicioPartida ? Math.round((Date.now() - room.inicioPartida) / 1000) : null;
      const jugadoresConUserId = mesa.jugadores.map(j => {
        const roomJugador = room.jugadores.find(rj => rj.socketId === j.id);
        return {
          userId: roomJugador?.userId || j.userId || null,
          equipo: j.equipo,
        };
      });
      // Solo guardar si al menos un jugador está registrado
      if (jugadoresConUserId.some(j => j.userId)) {
        await guardarPartida(
          room.tamañoSala,
          mesa.winnerJuego,
          mesa.equipos[0].puntaje,
          mesa.equipos[1].puntaje,
          duracionSeg,
          jugadoresConUserId
        );
        console.log(`[DB] Partida guardada: ${room.tamañoSala}, ganador equipo ${mesa.winnerJuego}`);
      }
    } catch (err) {
      console.error('[DB] Error guardando partida:', err);
    }
  }

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`);

    // === REGISTRO ===
    socket.on('registrar', async (data, callback) => {
      try {
        const result = await registrar(data.apodo, data.password);
        if (result.success) {
          socketUsuarios.set(socket.id, result.usuario);
        }
        callback(result);
      } catch (err) {
        console.error('[Auth] Error registro:', err);
        callback({ success: false, error: 'Error interno del servidor' });
      }
    });

    // === LOGIN ===
    socket.on('login', async (data, callback) => {
      try {
        const result = await login(data.apodo, data.password);
        if (result.success) {
          socketUsuarios.set(socket.id, result.usuario);

          // Buscar partidas activas del usuario
          const partidasActivas = [];
          for (const [mesaId, room] of lobbyRooms.entries()) {
            if (room.estado === 'terminado') continue;
            const jugadorEnRoom = room.jugadores.find(j => j.userId === result.usuario.id);
            if (!jugadorEnRoom) continue;

            const mesa = engines.get(mesaId);
            const partidaInfo = {
              mesaId: room.mesaId,
              estado: room.estado,
              tamañoSala: room.tamañoSala,
              jugadores: room.jugadores.map(j => j.nombre),
              jugadoresCount: room.jugadores.length,
              maxJugadores: room.maxJugadores,
            };
            if (room.estado === 'jugando' && mesa) {
              partidaInfo.puntaje = {
                equipo1: mesa.equipos[0].puntaje,
                equipo2: mesa.equipos[1].puntaje,
                limite: mesa.puntosLimite,
              };
              const jugadorEnMesa = mesa.jugadores.find(j => j.nombre === jugadorEnRoom.nombre);
              if (jugadorEnMesa) partidaInfo.miEquipo = jugadorEnMesa.equipo;
            }
            partidasActivas.push(partidaInfo);
          }
          result.partidasActivas = partidasActivas;
        }
        callback(result);
      } catch (err) {
        console.error('[Auth] Error login:', err);
        callback({ success: false, error: 'Error interno del servidor' });
      }
    });

    // === OBTENER PERFIL/ESTADÍSTICAS ===
    socket.on('obtener-perfil', async (callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        const stats = await obtenerEstadisticas(usuario.id);
        const historial = await obtenerHistorial(usuario.id, 10);
        const audiosCustom = await obtenerAudiosCustom(usuario.id);
        callback({
          success: true, stats, historial,
          es_premium: !!usuario.es_premium,
          avatar_url: usuario.avatar_url || null,
          audiosCustom,
        });
      } catch (err) {
        console.error('[DB] Error obtener perfil:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === PREMIUM ===
    socket.on('toggle-premium', async (callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        const newStatus = !usuario.es_premium;
        await setPremium(usuario.id, newStatus);
        usuario.es_premium = newStatus;
        callback({ success: true, es_premium: newStatus });
      } catch (err) {
        console.error('[DB] Error toggle premium:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    socket.on('eliminar-audio-custom', async (data, callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        await eliminarAudioCustom(data.audioId, usuario.id);
        callback({ success: true });
      } catch (err) {
        console.error('[DB] Error eliminar audio:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === RANKING ===
    socket.on('obtener-ranking', async (callback) => {
      try {
        const ranking = await obtenerRanking(50);
        callback({ success: true, ranking });
      } catch (err) {
        console.error('[DB] Error obtener ranking:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === AMIGOS ===
    socket.on('obtener-amigos', async (callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        const amigos = await obtenerAmigos(usuario.id);
        // Marcar cuáles están online
        const amigosConEstado = amigos.map(a => ({
          ...a,
          online: [...socketUsuarios.values()].some(u => u.id === Number(a.id)),
        }));
        callback({ success: true, amigos: amigosConEstado });
      } catch (err) {
        console.error('[DB] Error obtener amigos:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    socket.on('buscar-usuarios', async (data, callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        const usuarios = await buscarUsuarios(data.termino, usuario.id);
        callback({ success: true, usuarios });
      } catch (err) {
        console.error('[DB] Error buscar usuarios:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    socket.on('agregar-amigo', async (data, callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        await agregarAmigo(usuario.id, data.amigoId);
        callback({ success: true });
      } catch (err) {
        console.error('[DB] Error agregar amigo:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    socket.on('eliminar-amigo', async (data, callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }
        await eliminarAmigo(usuario.id, data.amigoId);
        callback({ success: true });
      } catch (err) {
        console.error('[DB] Error eliminar amigo:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === INVITAR AMIGO A PARTIDA ===
    socket.on('invitar-amigo', (data, callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }

        const { amigoId, mesaId } = data;
        const room = lobbyRooms.get(mesaId);
        if (!room) { callback({ success: false, error: 'Partida no encontrada' }); return; }
        if (room.estado !== 'esperando') { callback({ success: false, error: 'La partida ya comenzó' }); return; }
        if (room.jugadores.length >= room.maxJugadores) { callback({ success: false, error: 'La partida está llena' }); return; }

        // Buscar socketId del amigo
        let friendSocketId = null;
        for (const [sid, u] of socketUsuarios.entries()) {
          if (u.id === amigoId) {
            friendSocketId = sid;
            break;
          }
        }

        if (!friendSocketId) { callback({ success: false, error: 'Amigo no conectado' }); return; }

        io.to(friendSocketId).emit('invitacion-recibida', {
          de: usuario.apodo,
          deUserId: usuario.id,
          mesaId: room.mesaId,
          tamañoSala: room.tamañoSala,
        });

        callback({ success: true });
      } catch (err) {
        console.error('[Invite] Error invitar amigo:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === OBTENER MIS PARTIDAS (usuarios logueados) ===
    socket.on('obtener-mis-partidas', (callback) => {
      try {
        const usuario = socketUsuarios.get(socket.id);
        if (!usuario) { callback({ success: false, error: 'No autenticado' }); return; }

        const misPartidas = [];
        for (const [mesaId, room] of lobbyRooms.entries()) {
          if (room.estado === 'terminado') continue;
          const jugadorEnRoom = room.jugadores.find(j => j.userId === usuario.id);
          if (!jugadorEnRoom) continue;

          const mesa = engines.get(mesaId);
          const partidaInfo = {
            mesaId: room.mesaId,
            estado: room.estado,
            tamañoSala: room.tamañoSala,
            jugadores: room.jugadores.map(j => j.nombre),
            jugadoresCount: room.jugadores.length,
            maxJugadores: room.maxJugadores,
          };

          if (room.estado === 'jugando' && mesa) {
            partidaInfo.puntaje = {
              equipo1: mesa.equipos[0].puntaje,
              equipo2: mesa.equipos[1].puntaje,
              limite: mesa.puntosLimite,
            };
            const jugadorEnMesa = mesa.jugadores.find(j => j.nombre === jugadorEnRoom.nombre);
            if (jugadorEnMesa) {
              partidaInfo.miEquipo = jugadorEnMesa.equipo;
            }
          }

          misPartidas.push(partidaInfo);
        }

        callback({ success: true, partidas: misPartidas });
      } catch (err) {
        console.error('[obtener-mis-partidas] Error:', err);
        callback({ success: false, error: 'Error interno' });
      }
    });

    // === JOIN LOBBY ===
    socket.on('join-lobby', (callback) => {
      socket.join('lobby');
      const partidas = Array.from(lobbyRooms.values())
        .filter(r => r.estado !== 'terminado')
        .map(room => ({
          mesaId: room.mesaId,
          jugadores: room.jugadores.length,
          maxJugadores: room.maxJugadores,
          tamañoSala: room.tamañoSala,
          estado: room.estado,
        }));
      console.log(`[Socket.IO] ${socket.id} joined lobby, sending ${partidas.length} partidas:`, partidas.map(p => p.mesaId));
      socket.emit('partidas-disponibles', partidas);
      callback(true);
    });

    // === CREAR PARTIDA ===
    socket.on('crear-partida', (data, callback) => {
      console.log(`[Socket.IO] ${socket.id} crear-partida:`, data);
      try {
        const { nombre, tamañoSala = '2v2', modoAlternado = true, modoAyuda = false } = data;
        const mesaId = `mesa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const maxJugadores = getMaxJugadores(tamañoSala);

        const usuarioCreador = socketUsuarios.get(socket.id);
        const room = {
          mesaId,
          jugadores: [{ socketId: socket.id, nombre, userId: usuarioCreador?.id || null }],
          maxJugadores,
          tamañoSala,
          estado: 'esperando',
          creadorNombre: nombre,
          creadorSocketId: socket.id,
          modoAlternado,
          modoAyuda,
          inicioPartida: null, // timestamp para calcular duración
        };
        lobbyRooms.set(mesaId, room);

        const jugador = { id: socket.id, nombre, equipo: 1, cartas: [], modoAyuda: false, userId: usuarioCreador?.id || null };
        const mesa = crearEstadoMesa(mesaId, [jugador], 30, { modoAlternado, modoAyuda });
        engines.set(mesaId, mesa);

        socket.leave('lobby');
        socket.join(mesaId);

        socket.emit('partida-creada', { mesaId, jugador });
        socket.emit('unido-partida', { mesaId, jugador, estado: getEstadoParaJugador(mesa, socket.id) });

        io.to('lobby').emit('partida-nueva', {
          mesaId,
          jugadores: room.jugadores.length,
          maxJugadores: room.maxJugadores,
          tamañoSala: room.tamañoSala,
          estado: room.estado,
          creadorNombre: room.creadorNombre,
          jugadoresNombres: room.jugadores.map(j => j.nombre),
          modoAlternado: room.modoAlternado,
          modoAyuda: room.modoAyuda,
        });
        broadcastLobby(io);

        callback(true, mesaId);
      } catch (err) {
        console.error('Error creating game:', err);
        callback(false, 'Error interno');
      }
    });

    // === ELIMINAR/CANCELAR PARTIDA ===
    socket.on('eliminar-partida', (data, callback) => {
      console.log(`[Socket.IO] ${socket.id} eliminar-partida:`, data);
      try {
        const { mesaId, nombre } = data;
        const room = lobbyRooms.get(mesaId);

        if (!room) {
          callback(false, 'Partida no encontrada');
          return;
        }

        // Solo el creador puede eliminar la partida (verificar por nombre)
        if (room.creadorNombre !== nombre) {
          callback(false, 'Solo el creador puede eliminar la partida');
          return;
        }

        // Solo se puede eliminar si está en estado "esperando"
        if (room.estado !== 'esperando') {
          callback(false, 'No se puede eliminar una partida en curso');
          return;
        }

        // Notificar a todos los jugadores en la partida que fue cancelada
        io.to(mesaId).emit('partida-eliminada', {
          mesaId,
          mensaje: 'La partida fue cancelada por el creador'
        });

        // Mover a todos los jugadores de vuelta al lobby
        room.jugadores.forEach(p => {
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.leave(mesaId);
            playerSocket.join('lobby');
          }
        });

        // Eliminar la partida
        lobbyRooms.delete(mesaId);
        engines.delete(mesaId);

        // Actualizar el lobby
        broadcastLobby(io);

        console.log(`[Socket.IO] Partida ${mesaId} eliminada por ${nombre}`);
        callback(true, 'Partida eliminada');
      } catch (err) {
        console.error('Error deleting game:', err);
        callback(false, 'Error al eliminar la partida');
      }
    });

    // === UNIRSE A PARTIDA ===
    socket.on('unirse-partida', (data, callback) => {
      try {
        const { mesaId, nombre } = data;
        const room = lobbyRooms.get(mesaId);
        if (!room) { callback(false, 'Partida no encontrada'); return; }

        const mesa = engines.get(mesaId);
        if (!mesa) { callback(false, 'Error interno'); return; }

        // Verificar si es una reconexión (mismo nombre ya existe en la partida)
        const jugadorExistente = room.jugadores.find(j => j.nombre === nombre);
        if (jugadorExistente) {
          // Es una reconexión - actualizar socket ID
          const oldSocketId = jugadorExistente.socketId;
          console.log(`[Socket.IO] Reconexión detectada en unirse-partida: ${nombre} (${oldSocketId} -> ${socket.id})`);

          jugadorExistente.socketId = socket.id;

          // Actualizar en mesa
          const jugInMesa = mesa.jugadores.find(j => j.id === oldSocketId);
          if (jugInMesa) jugInMesa.id = socket.id;
          mesa.equipos.forEach(eq => {
            const jEq = eq.jugadores.find(j => j.id === oldSocketId);
            if (jEq) jEq.id = socket.id;
          });
          mesa.cartasMesa.forEach(cm => {
            if (cm.jugadorId === oldSocketId) cm.jugadorId = socket.id;
          });
          // Actualizar jugadoresConFlor si es necesario
          if (mesa.jugadoresConFlor) {
            const florIdx = mesa.jugadoresConFlor.indexOf(oldSocketId);
            if (florIdx !== -1) mesa.jugadoresConFlor[florIdx] = socket.id;
          }
          // Actualizar floresCantadas si es necesario
          if (mesa.floresCantadas) {
            mesa.floresCantadas.forEach(fc => {
              if (fc.jugadorId === oldSocketId) fc.jugadorId = socket.id;
            });
          }

          socket.leave('lobby');
          socket.join(mesaId);

          const jugadorInMesa = mesa.jugadores.find(j => j.id === socket.id);
          socket.emit('reconectado', {
            jugador: jugadorInMesa,
            estado: getEstadoParaJugador(mesa, socket.id),
          });

          // Notificar a todos los demás del estado actualizado
          room.jugadores.forEach(p => {
            if (p.socketId !== socket.id) {
              io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
            }
          });

          broadcastLobby(io);
          callback(true);
          return;
        }

        // No es reconexión - verificar si puede unirse normalmente
        if (room.estado !== 'esperando') { callback(false, 'La partida ya comenzó'); return; }
        if (room.jugadores.length >= room.maxJugadores) { callback(false, 'La partida está llena'); return; }

        const usuarioAuth = socketUsuarios.get(socket.id);
        room.jugadores.push({ socketId: socket.id, nombre, userId: usuarioAuth?.id || null });

        const halfPoint = Math.ceil(room.maxJugadores / 2);
        const equipo = (room.jugadores.length - 1) < halfPoint ? 1 : 2;
        const jugador = { id: socket.id, nombre, equipo, cartas: [], modoAyuda: false, userId: usuarioAuth?.id || null };

        mesa.jugadores.push(jugador);
        // Re-assign teams
        mesa.jugadores.forEach((j, idx) => {
          j.equipo = idx < halfPoint ? 1 : 2;
        });
        mesa.equipos[0].jugadores = mesa.jugadores.filter(j => j.equipo === 1);
        mesa.equipos[1].jugadores = mesa.jugadores.filter(j => j.equipo === 2);

        socket.leave('lobby');
        socket.join(mesaId);

        socket.emit('unido-partida', { mesaId, jugador, estado: getEstadoParaJugador(mesa, socket.id) });
        socket.to(mesaId).emit('jugador-unido', { jugador, totalJugadores: room.jugadores.length });

        // Send updated state to all
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
        });

        broadcastLobby(io);
        callback(true);
      } catch (err) {
        console.error('Error joining game:', err);
        callback(false, 'Error interno');
      }
    });

    // === RECONECTAR A PARTIDA ===
    socket.on('reconectar-partida', (data, callback) => {
      console.log(`[Socket.IO] ${socket.id} reconectar-partida:`, data);
      try {
        const { mesaId, nombre, userId } = data;
        const room = lobbyRooms.get(mesaId);
        if (!room) { console.log(`[Socket.IO] Room ${mesaId} not found`); callback(false, 'Partida no encontrada'); return; }

        const mesa = engines.get(mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        let isNewPlayer = false;
        // Priorizar búsqueda por userId si está disponible, fallback a nombre
        let existingPlayer;
        if (userId) {
          existingPlayer = room.jugadores.find(j => j.userId === userId);
        }
        if (!existingPlayer) {
          existingPlayer = room.jugadores.find(j => j.nombre === nombre);
        }
        if (existingPlayer) {
          const oldSocketId = existingPlayer.socketId;
          console.log(`[Socket.IO] Updating socketId for ${existingPlayer.nombre}: ${oldSocketId} -> ${socket.id}`);
          existingPlayer.socketId = socket.id;
          // Asegurar que el userId quede asociado
          if (userId && !existingPlayer.userId) existingPlayer.userId = userId;
          // Actualizar socketUsuarios si aplica
          if (userId) {
            const usuarioViejo = socketUsuarios.get(oldSocketId);
            if (usuarioViejo) {
              socketUsuarios.delete(oldSocketId);
              socketUsuarios.set(socket.id, usuarioViejo);
            } else {
              const usuarioNuevo = socketUsuarios.get(socket.id);
              if (!usuarioNuevo) {
                // Intentar restaurar desde el userId
                socketUsuarios.set(socket.id, { id: userId, apodo: existingPlayer.nombre });
              }
            }
          }

          // Update in mesa
          const jugInMesa = mesa.jugadores.find(j => j.id === oldSocketId || j.nombre === existingPlayer.nombre);
          if (jugInMesa) {
            jugInMesa.id = socket.id;
            jugInMesa.desconectado = false; // Marcar como reconectado
          }
          mesa.equipos.forEach(eq => {
            const jEq = eq.jugadores.find(j => j.id === oldSocketId);
            if (jEq) jEq.id = socket.id;
          });
          mesa.cartasMesa.forEach(cm => {
            if (cm.jugadorId === oldSocketId) cm.jugadorId = socket.id;
          });
          // Update jugadoresConFlor if needed
          if (mesa.jugadoresConFlor) {
            const florIdx = mesa.jugadoresConFlor.indexOf(oldSocketId);
            if (florIdx !== -1) mesa.jugadoresConFlor[florIdx] = socket.id;
          }
          // Update floresCantadas if needed
          if (mesa.floresCantadas) {
            mesa.floresCantadas.forEach(fc => {
              if (fc.jugadorId === oldSocketId) fc.jugadorId = socket.id;
            });
          }
        } else {
          if (room.estado === 'esperando' && room.jugadores.length < room.maxJugadores) {
            isNewPlayer = true;
            const usuarioAuth2 = socketUsuarios.get(socket.id);
            room.jugadores.push({ socketId: socket.id, nombre, userId: usuarioAuth2?.id || null });
            const halfPoint = Math.ceil(room.maxJugadores / 2);
            const equipo = (room.jugadores.length - 1) < halfPoint ? 1 : 2;
            const jugador = { id: socket.id, nombre, equipo, cartas: [], modoAyuda: false, userId: usuarioAuth2?.id || null };
            mesa.jugadores.push(jugador);
            mesa.jugadores.forEach((j, idx) => {
              j.equipo = idx < halfPoint ? 1 : 2;
            });
            mesa.equipos[0].jugadores = mesa.jugadores.filter(j => j.equipo === 1);
            mesa.equipos[1].jugadores = mesa.jugadores.filter(j => j.equipo === 2);
            console.log(`[Socket.IO] New player ${nombre} joined via reconectar, total: ${room.jugadores.length}`);
          } else {
            callback(false, 'No se puede reconectar');
            return;
          }
        }

        socket.join(mesaId);

        const jugadorInMesa = mesa.jugadores.find(j => j.id === socket.id);
        if (jugadorInMesa) {
          socket.emit('reconectado', {
            jugador: jugadorInMesa,
            estado: getEstadoParaJugador(mesa, socket.id),
          });
        }

        // IMPORTANT: Notify ALL players in the room about the updated state
        // This ensures everyone sees the current player list and game state
        room.jugadores.forEach(p => {
          if (p.socketId !== socket.id) {
            io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
          }
        });

        // If new player joined, also notify about the new player
        if (isNewPlayer && jugadorInMesa) {
          socket.to(mesaId).emit('jugador-unido', {
            jugador: jugadorInMesa,
            totalJugadores: room.jugadores.length
          });
          broadcastLobby(io);
        }

        console.log(`[Socket.IO] reconectar-partida done. Room has ${room.jugadores.length} players:`, room.jugadores.map(j => `${j.nombre}(${j.socketId})`));
        callback(true);
      } catch (err) {
        console.error('Error reconnecting:', err);
        callback(false, 'Error interno');
      }
    });

    // === SOLICITAR ESTADO (client can request current state at any time) ===
    socket.on('solicitar-estado', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false); return; }
        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false); return; }
        const estado = getEstadoParaJugador(mesa, socket.id);
        socket.emit('estado-actualizado', estado);
        callback(true);
      } catch (err) {
        callback(false);
      }
    });

    // === INICIAR PARTIDA ===
    socket.on('iniciar-partida', async (callback) => {
      try {
        console.log(`[Socket.IO] ${socket.id} iniciar-partida`);
        const room = findRoomBySocket(socket.id);
        if (!room) { console.log(`[Socket.IO] iniciar-partida: room not found for socket ${socket.id}`); callback(false, 'No estás en ninguna partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede iniciar'); return; }
        if (room.jugadores.length < 2) { callback(false, 'Se necesitan al menos 2 jugadores'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        console.log(`[Socket.IO] iniciar-partida: Starting game with ${room.jugadores.length} players:`, room.jugadores.map(j => `${j.nombre}(${j.socketId})`));

        room.estado = 'jugando';
        room.inicioPartida = Date.now();

        // Reorder players to alternate teams (pico a pico seating: E1,E2,E1,E2,...)
        // This ensures siguienteTurno correctly alternates between teams
        if (mesa.jugadores.length > 2) {
          const team1Players = mesa.jugadores.filter(j => j.equipo === 1);
          const team2Players = mesa.jugadores.filter(j => j.equipo === 2);
          const reordered = [];
          const maxLen = Math.max(team1Players.length, team2Players.length);
          for (let i = 0; i < maxLen; i++) {
            if (team1Players[i]) reordered.push(team1Players[i]);
            if (team2Players[i]) reordered.push(team2Players[i]);
          }
          mesa.jugadores = reordered;
          mesa.equipos[0].jugadores = mesa.jugadores.filter(j => j.equipo === 1);
          mesa.equipos[1].jugadores = mesa.jugadores.filter(j => j.equipo === 2);
        }

        iniciarRonda(mesa); // Phase 1: shuffle and wait for cut

        // Cache custom audios para esta partida
        try {
          const userIds = room.jugadores.filter(j => j.userId).map(j => j.userId);
          if (userIds.length > 0) {
            const allAudios = await obtenerAudiosCustomMultiples(userIds);
            mesa.audiosCustom = {};
            for (const audio of allAudios) {
              const jugador = room.jugadores.find(j => j.userId === Number(audio.usuario_id));
              if (jugador) {
                if (!mesa.audiosCustom[jugador.socketId]) mesa.audiosCustom[jugador.socketId] = {};
                mesa.audiosCustom[jugador.socketId][audio.tipo_audio] = audio.url_archivo;
              }
            }
          }
        } catch (err) {
          console.error('[DB] Error cargando audios custom:', err);
          mesa.audiosCustom = {};
        }

        // Send state to all (shows shuffle animation + cut phase)
        room.jugadores.forEach(p => {
          console.log(`[Socket.IO] iniciar-partida: Sending partida-iniciada to ${p.nombre} (${p.socketId})`);
          io.to(p.socketId).emit('partida-iniciada', getEstadoParaJugador(mesa, p.socketId));
        });

        // Notify who should cut
        const cortador = mesa.jugadores[mesa.indiceJugadorCorta];
        if (cortador) {
          console.log(`[Socket.IO] iniciar-partida: Cortador is ${cortador.nombre} (${cortador.id})`);
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('corte-solicitado', {
              jugadorId: cortador.id,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
        }

        broadcastLobby(io);
        callback(true);
      } catch (err) {
        console.error('Error starting game:', err);
        callback(false, 'Error interno');
      }
    });

    // === JUGAR CARTA ===
    socket.on('jugar-carta', (data, callback) => {
      try {
        const { carta } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        // === FLOR POR TURNO ===
        // Solo declarar la flor de ESTE jugador si la tiene y no la cantó aún
        if (mesa.manoActual === 1 && !mesa.florYaCantada && mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0) {
          const florResult = cantarFlorDeJugador(mesa, socket.id);
          if (florResult) {
            emitirFlorDeJugador(io, room, mesa, florResult);
            // Si hay contienda pendiente, no permitir jugar carta
            if (florResult.esperandoRespuesta) {
              callback(false, 'Hay flor pendiente de respuesta');
              return;
            }
          }
        }
        // === FIN FLOR POR TURNO ===

        // Bloquear jugar carta si hay flor pendiente de respuesta
        if (mesa.esperandoRespuestaFlor) {
          callback(false, 'Hay flor pendiente de respuesta');
          return;
        }

        const success = jugarCarta(mesa, socket.id, carta);
        if (!success) { callback(false, 'Movimiento inválido'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('carta-jugada', {
            jugadorId: socket.id,
            carta,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        // === FLOR DEL SIGUIENTE JUGADOR ===
        // Si el turno avanzó y el siguiente jugador tiene flor sin declarar, declararla
        if (!mesa.manoTerminada && mesa.manoActual === 1 && !mesa.florYaCantada &&
            mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0) {
          const nextPlayer = mesa.jugadores[mesa.turnoActual];
          if (nextPlayer) {
            const nextFlorResult = cantarFlorDeJugador(mesa, nextPlayer.id);
            if (nextFlorResult) {
              // Emitir con pequeño delay para que se vea después de la carta jugada
              setTimeout(() => {
                const currentMesa = engines.get(room.mesaId);
                const currentRoom = lobbyRooms.get(room.mesaId);
                if (currentMesa && currentRoom) {
                  emitirFlorDeJugador(io, currentRoom, currentMesa, nextFlorResult);
                }
              }, 800);
            }
          }
        }
        // === FIN FLOR DEL SIGUIENTE JUGADOR ===

        // Check if a mano just finished (manoTerminada flag set by evaluarEstadoRonda)
        if (mesa.manoTerminada) {
          // Emit mano-finalizada event
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('mano-finalizada', {
              ganadorEquipo: mesa.manoGanadorEquipo,
              manoNumero: mesa.manoActual,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          // Wait 2 seconds before continuing (máximo 2s para ver cartas del ganador)
          const DELAY_MANO = 2000;
          setTimeout(() => {
            const currentMesa = engines.get(room.mesaId);
            const currentRoom = lobbyRooms.get(room.mesaId);
            if (!currentMesa || !currentRoom) return;

            const resultado = continuarDespuesDeDelay(currentMesa);
            if (!resultado) return;

            if (resultado.tipo === 'ronda') {
              // Ronda finished - emit events with flor/envido cards revealed
              currentRoom.jugadores.forEach(p => {
                io.to(p.socketId).emit('ronda-finalizada', {
                  ganadorEquipo: currentMesa.winnerRonda,
                  puntosGanados: currentMesa.puntosEnJuego,
                  cartasFlorReveladas: currentMesa.cartasFlorReveladas || [],
                  cartasEnvidoReveladas: currentMesa.cartasEnvidoReveladas || [],
                  muestra: currentMesa.muestra,
                  estado: getEstadoParaJugador(currentMesa, p.socketId),
                });
              });

              if (currentMesa.winnerJuego !== null) {
                currentRoom.estado = 'terminado';
                currentRoom.jugadores.forEach(p => {
                  io.to(p.socketId).emit('juego-finalizado', {
                    ganadorEquipo: currentMesa.winnerJuego,
                    estado: getEstadoParaJugador(currentMesa, p.socketId),
                  });
                });
                broadcastLobby(io);
              } else {
                scheduleNextRound(io, currentRoom);
              }
            } else if (resultado.tipo === 'mano') {
              // Next mano - just send state update
              currentRoom.jugadores.forEach(p => {
                io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
              });
            }
          }, DELAY_MANO);
        }

        callback(true);
      } catch (err) {
        console.error('Error playing card:', err);
        callback(false, 'Error interno');
      }
    });

    // === CANTAR TRUCO ===
    socket.on('cantar-truco', (data, callback) => {
      try {
        const { tipo } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const success = cantarTruco(mesa, socket.id, tipo);
        if (!success) { callback(false, 'No se puede cantar'); return; }

        const audioTipo = tipo === 'vale_cuatro' ? 'vale4' : tipo;
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('truco-cantado', {
            jugadorId: socket.id,
            tipo,
            audioCustomUrl: mesa.audiosCustom?.[socket.id]?.[audioTipo] || null,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        callback(true);
      } catch (err) {
        console.error('Error cantar truco:', err);
        callback(false, 'Error interno');
      }
    });

    // === RESPONDER TRUCO ===
    socket.on('responder-truco', (data, callback) => {
      try {
        const { acepta } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const result = responderTruco(mesa, socket.id, acepta);
        if (!result.success) { callback(false, result.error || 'No se puede responder'); return; }

        // Si es respuesta parcial (esperando más compañeros)
        if (result.parcial) {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('truco-respuesta-parcial', {
              jugadorId: socket.id,
              acepta,
              faltanResponder: result.faltanResponder,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
          callback(true);
          return;
        }

        // Respuesta final (todos respondieron o es 1v1)
        const trucoRespAudioTipo = result.acepta ? 'quiero' : 'no-quiero';
        const trucoRespAudioUrl = mesa.audiosCustom?.[socket.id]?.[trucoRespAudioTipo] || null;
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('truco-respondido', {
            jugadorId: socket.id,
            acepta: result.acepta,
            audioCustomUrl: trucoRespAudioUrl,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (!result.acepta && mesa.fase === 'finalizada') {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('ronda-finalizada', {
              ganadorEquipo: mesa.winnerRonda,
              puntosGanados: mesa.puntosEnJuego,
              cartasFlorReveladas: mesa.cartasFlorReveladas || [],
              cartasEnvidoReveladas: mesa.cartasEnvidoReveladas || [],
              muestra: mesa.muestra,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          } else {
            scheduleNextRound(io, room);
          }
        }

        callback(true);
      } catch (err) {
        console.error('Error responder truco:', err);
        callback(false, 'Error interno');
      }
    });

    // === CANTAR ENVIDO ===
    socket.on('cantar-envido', (data, callback) => {
      try {
        const { tipo } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        // Si alguien tiene flor, se canta automáticamente y anula el envido
        if (mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0 && !mesa.florYaCantada) {
          const florResult = cantarFlorAutomatica(mesa);

          // Emitir las flores cantadas (sin mostrar puntos a rivales)
          florResult.cantadas.forEach((declaracion, index) => {
            setTimeout(() => {
              room.jugadores.forEach(p => {
                const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
                const mismoEquipo = pJugador && pJugador.equipo === declaracion.equipo;
                io.to(p.socketId).emit('flor-cantada', {
                  jugadorId: declaracion.jugadorId,
                  audioCustomUrl: mesa.audiosCustom?.[declaracion.jugadorId]?.['flor'] || null,
                  declaracion: {
                    ...declaracion,
                    puntos: mismoEquipo ? declaracion.puntos : null, // Ocultar puntos al rival
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            }, index * 1000); // 1 segundo entre cada flor
          });

          // Después de mostrar todas las flores, emitir el resultado O esperar respuesta
          setTimeout(() => {
            if (florResult.esperandoRespuesta) {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('flor-pendiente', {
                  equipoQueCanta: mesa.florPendiente.equipoQueCanta,
                  equipoQueResponde: mesa.florPendiente.equipoQueResponde,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            } else if (florResult.resultado) {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('flor-resuelta', {
                  resultado: {
                    ganador: florResult.resultado.ganador,
                    puntosGanados: florResult.resultado.puntosGanados,
                    floresCantadas: florResult.resultado.floresCantadas.map(f => ({
                      ...f,
                      puntos: null, // No revelar puntos a nadie en el resultado final
                    })),
                    mejorFlor: null, // No revelar el mejor puntaje
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });

              if (mesa.winnerJuego !== null) {
                room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
                room.jugadores.forEach(p => {
                  io.to(p.socketId).emit('juego-finalizado', {
                    ganadorEquipo: mesa.winnerJuego,
                    estado: getEstadoParaJugador(mesa, p.socketId),
                  });
                });
                broadcastLobby(io);
              }
            }
          }, florResult.cantadas.length * 1000 + 500);

          callback(true, 'Hay flor en la mesa');
          return;
        }

        // Soporte para envido cargado con puntos custom
        const puntosCustom = data.puntosCustom || null;
        const success = cantarEnvido(mesa, socket.id, tipo, puntosCustom);
        if (!success) { callback(false, 'No se puede cantar envido'); return; }

        // Nombre del envido para mostrar
        let nombreEnvido = tipo;
        if (tipo === 'envido_cargado' && puntosCustom) {
          nombreEnvido = `cargado (${puntosCustom} pts)`;
        }

        const envidoAudioTipo = tipo.replace('_', '-');
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-cantado', {
            jugadorId: socket.id,
            tipo: nombreEnvido,
            puntosCustom,
            audioCustomUrl: mesa.audiosCustom?.[socket.id]?.[envidoAudioTipo] || mesa.audiosCustom?.[socket.id]?.['envido'] || null,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        callback(true);
      } catch (err) {
        console.error('Error cantar envido:', err);
        callback(false, 'Error interno');
      }
    });

    // === RESPONDER ENVIDO ===
    socket.on('responder-envido', (data, callback) => {
      try {
        const { acepta } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        // FLOR siempre tiene prioridad - si hay flor pendiente, cantarla automáticamente
        if (mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0 && !mesa.florYaCantada) {
          const florResult = cantarFlorAutomatica(mesa);

          // Emitir las flores cantadas
          florResult.cantadas.forEach((declaracion, index) => {
            setTimeout(() => {
              room.jugadores.forEach(p => {
                const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
                const mismoEquipo = pJugador && pJugador.equipo === declaracion.equipo;
                io.to(p.socketId).emit('flor-cantada', {
                  jugadorId: declaracion.jugadorId,
                  audioCustomUrl: mesa.audiosCustom?.[declaracion.jugadorId]?.['flor'] || null,
                  declaracion: {
                    ...declaracion,
                    puntos: mismoEquipo ? declaracion.puntos : null,
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            }, index * 1000);
          });

          // Emitir resultado de flor O esperar respuesta
          setTimeout(() => {
            if (florResult.esperandoRespuesta) {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('flor-pendiente', {
                  equipoQueCanta: mesa.florPendiente.equipoQueCanta,
                  equipoQueResponde: mesa.florPendiente.equipoQueResponde,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            } else if (florResult.resultado) {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('flor-resuelta', {
                  resultado: {
                    ganador: florResult.resultado.ganador,
                    puntosGanados: florResult.resultado.puntosGanados,
                    floresCantadas: florResult.resultado.floresCantadas.map(f => ({
                      ...f,
                      puntos: null,
                    })),
                    mejorFlor: null,
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });

              if (mesa.winnerJuego !== null) {
                room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
                room.jugadores.forEach(p => {
                  io.to(p.socketId).emit('juego-finalizado', {
                    ganadorEquipo: mesa.winnerJuego,
                    estado: getEstadoParaJugador(mesa, p.socketId),
                  });
                });
                broadcastLobby(io);
              }
            }
          }, florResult.cantadas.length * 1000 + 500);

          callback(true, 'Hay flor en la mesa - envido anulado');
          return;
        }

        const result = responderEnvido(mesa, socket.id, acepta);

        if (!result.success) { callback(false, result.error || 'No se puede responder'); return; }

        // Si es respuesta parcial (esperando más compañeros)
        if (result.parcial) {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('envido-respuesta-parcial', {
              jugadorId: socket.id,
              acepta,
              faltanResponder: result.faltanResponder,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
          callback(true);
          return;
        }

        // Notificar respuesta final
        const envidoRespAudioTipo = result.acepta ? 'quiero' : 'no-quiero';
        const envidoRespAudioUrl = mesa.audiosCustom?.[socket.id]?.[envidoRespAudioTipo] || null;
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-respondido', {
            jugadorId: socket.id,
            acepta: result.acepta,
            audioCustomUrl: envidoRespAudioUrl,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (result.acepta && result.automatico && result.resultado) {
          // Envido automático: emitir declaraciones con delay y luego resultado
          const declaraciones = result.resultado.declaraciones;

          declaraciones.forEach((decl, index) => {
            setTimeout(() => {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('envido-declarado', {
                  jugadorId: decl.jugadorId,
                  declaracion: decl,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            }, (index + 1) * 1500); // 1.5s entre declaraciones
          });

          // Después de todas las declaraciones, sumar puntos y emitir resultado
          setTimeout(() => {
            // AHORA sí sumar los puntos al marcador (después de las animaciones)
            const ganador = result.resultado.ganador;
            const puntosGanados = result.resultado.puntosGanados;
            const equipo = mesa.equipos.find(e => e.id === ganador);
            if (equipo) {
              equipo.puntaje += puntosGanados;
              // Check for game win
              if (equipo.puntaje >= mesa.puntosLimite) {
                mesa.winnerJuego = ganador;
                mesa.estado = 'terminado';
                mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
                mesa.fase = 'finalizada';
              }
            }

            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('envido-resuelto', {
                resultado: result.resultado,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });

            if (mesa.winnerJuego !== null) {
              room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('juego-finalizado', {
                  ganadorEquipo: mesa.winnerJuego,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
              broadcastLobby(io);
            }
          }, (declaraciones.length + 1) * 1500);
        } else if (!result.acepta) {
          // No quiero - check game end
          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          }
        }

        callback(true);
      } catch (err) {
        console.error('Error responder envido:', err);
        callback(false, 'Error interno');
      }
    });

    // === DECLARAR ENVIDO (paso a paso) ===
    socket.on('declarar-envido', (data, callback) => {
      try {
        const { puntos, sonBuenas } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const result = declararEnvido(mesa, socket.id, puntos, sonBuenas);
        if (!result.success) { callback(false, result.error); return; }

        if (result.finalizado) {
          // Envido resolved - send final result to all
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('envido-resuelto', {
              resultado: result.resultado,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          }
        } else {
          // More declarations needed - notify about the declaration
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('envido-declarado', {
              jugadorId: socket.id,
              declaracion: result.declaracion,
              turnoDeclarar: result.turnoDeclarar,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
        }

        callback(true);
      } catch (err) {
        console.error('Error declarar envido:', err);
        callback(false, 'Error interno');
      }
    });

    // === CANTAR FLOR ===
    socket.on('cantar-flor', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const result = cantarFlor(mesa, socket.id);
        if (!result.success) { callback(false, result.error); return; }

        if (result.finalizado) {
          // Flor resolved - send final result without individual scores
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('flor-resuelta', {
              resultado: {
                ganador: result.resultado.ganador,
                puntosGanados: result.resultado.puntosGanados,
                floresCantadas: result.resultado.floresCantadas.map(f => ({
                  ...f,
                  puntos: null,
                })),
                mejorFlor: null,
              },
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          }
        } else {
          // More flor declarations needed - hide points from opponents
          room.jugadores.forEach(p => {
            const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
            const mismoEquipo = pJugador && pJugador.equipo === result.declaracion.equipo;
            io.to(p.socketId).emit('flor-cantada', {
              jugadorId: socket.id,
              audioCustomUrl: mesa.audiosCustom?.[socket.id]?.['flor'] || null,
              declaracion: {
                ...result.declaracion,
                puntos: mismoEquipo ? result.declaracion.puntos : null,
              },
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
        }

        callback(true);
      } catch (err) {
        console.error('Error cantar flor:', err);
        callback(false, 'Error interno');
      }
    });

    // === RESPONDER FLOR (Contra Flor al Resto) ===
    socket.on('responder-flor', (data, callback) => {
      try {
        const { tipoRespuesta } = data; // 'quiero', 'no_quiero', 'contra_flor'
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const result = responderFlor(mesa, socket.id, tipoRespuesta);
        if (!result.success) { callback(false, result.error); return; }

        // Si es escalación (contra_flor / con_flor_envido), el otro equipo debe responder
        if (result.pendiente) {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('flor-pendiente', {
              equipoQueCanta: mesa.florPendiente.equipoQueCanta,
              equipoQueResponde: mesa.florPendiente.equipoQueResponde,
              ultimoTipo: mesa.florPendiente.ultimoTipo,
              jugadorNombre: result.jugadorNombre,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
          callback(true);
          return;
        }

        // Emitir resultado de la flor
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('flor-resuelta', {
            resultado: {
              ganador: result.resultado.ganador,
              puntosGanados: result.resultado.puntosGanados,
              floresCantadas: result.resultado.floresCantadas.map(f => ({
                ...f,
                puntos: null, // No mostrar puntos específicos
              })),
              mejorFlor: null,
              esContraFlor: result.resultado.esContraFlor,
              esConFlorEnvido: result.resultado.esConFlorEnvido,
            },
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (mesa.winnerJuego !== null) {
          room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('juego-finalizado', {
              ganadorEquipo: mesa.winnerJuego,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
          broadcastLobby(io);
        }

        callback(true);
      } catch (err) {
        console.error('Error responder flor:', err);
        callback(false, 'Error interno');
      }
    });

    // === IRSE AL MAZO ===
    socket.on('irse-al-mazo', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const jugador = mesa.jugadores.find(j => j.id === socket.id);
        const result = irseAlMazo(mesa, socket.id);
        if (!result) { callback(false, 'No se puede ir al mazo'); return; }

        // Notificar que el jugador se fue al mazo
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('jugador-al-mazo', {
            jugadorId: socket.id,
            equipoQueSeVa: jugador?.equipo || 0,
            parcial: result === 'parcial', // true = el equipo sigue jugando
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (result === 'parcial') {
          // Solo un jugador se fue, el equipo sigue - actualizar estado
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
          });
        } else {
          // Todo el equipo se fue al mazo - finalizar ronda
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('ronda-finalizada', {
              ganadorEquipo: mesa.winnerRonda,
              puntosGanados: mesa.puntosEnJuego,
              cartasFlorReveladas: mesa.cartasFlorReveladas || [],
              cartasEnvidoReveladas: mesa.cartasEnvidoReveladas || [],
              muestra: mesa.muestra,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          } else {
            scheduleNextRound(io, room);
          }
        }

        callback(true);
      } catch (err) {
        console.error('Error irse al mazo:', err);
        callback(false, 'Error interno');
      }
    });

    // === REALIZAR CORTE ===
    socket.on('realizar-corte', (data, callback) => {
      try {
        const { posicion } = data;
        console.log(`[Socket.IO] ${socket.id} realizar-corte: posicion=${posicion}`);

        const room = findRoomBySocket(socket.id);
        if (!room) {
          console.log(`[Socket.IO] realizar-corte: room not found for socket ${socket.id}`);
          callback(false, 'No estás en partida');
          return;
        }

        const mesa = engines.get(room.mesaId);
        if (!mesa) {
          console.log(`[Socket.IO] realizar-corte: mesa not found`);
          callback(false, 'Motor no encontrado');
          return;
        }

        console.log(`[Socket.IO] realizar-corte: esperandoCorte=${mesa.esperandoCorte}, fase=${mesa.fase}, indiceCorta=${mesa.indiceJugadorCorta}`);
        console.log(`[Socket.IO] realizar-corte: jugadores en mesa:`, mesa.jugadores.map(j => `${j.nombre}(${j.id})`));
        console.log(`[Socket.IO] realizar-corte: jugadores en room:`, room.jugadores.map(j => `${j.nombre}(${j.socketId})`));

        if (!mesa.esperandoCorte) {
          console.log(`[Socket.IO] realizar-corte: no se espera corte`);
          callback(false, 'No se espera corte');
          return;
        }
        if (mesa.jugadores[mesa.indiceJugadorCorta]?.id !== socket.id) {
          console.log(`[Socket.IO] realizar-corte: no es tu turno. Esperando: ${mesa.jugadores[mesa.indiceJugadorCorta]?.id}, tu: ${socket.id}`);
          callback(false, 'No es tu turno de cortar');
          return;
        }

        // Apply the cut and deal
        iniciarRondaFase2(mesa, posicion);
        console.log(`[Socket.IO] realizar-corte: fase2 completada. fase=${mesa.fase}, muestra=${mesa.muestra?.valor}-${mesa.muestra?.palo}`);

        // Notify everyone about the cut
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('corte-realizado', {
            jugadorId: socket.id,
            posicion,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        // Send dealing animation events
        const dealDelay = 200; // ms between each card
        const numCartas = mesa.cartasRepartidas.length;
        const mesaId = room.mesaId; // Capture mesaId to look up fresh room reference

        mesa.cartasRepartidas.forEach((deal, index) => {
          setTimeout(() => {
            // Get fresh reference to room in case socketIds changed during dealing
            const currentRoom = lobbyRooms.get(mesaId);
            if (!currentRoom) return;

            currentRoom.jugadores.forEach(p => {
              io.to(p.socketId).emit('carta-repartida', {
                jugadorIndex: deal.jugadorIndex,
                cartaIndex: deal.cartaIndex,
                vuelta: deal.vuelta,
                total: numCartas,
                actual: index + 1,
              });
            });

            // After the last card, transition to playing phase
            if (index === numCartas - 1) {
              setTimeout(() => {
                const finalRoom = lobbyRooms.get(mesaId);
                const finalMesa = engines.get(mesaId);
                if (!finalRoom || !finalMesa) return;

                finalizarReparticion(finalMesa);
                console.log(`[Socket.IO] realizar-corte: repartición finalizada, fase=${finalMesa.fase}, perrosActivos=${finalMesa.perrosActivos}`);

                // Si hay perros activos, emitir evento especial para que el equipo receptor responda
                if (finalMesa.perrosActivos && finalMesa.perrosConfig) {
                  console.log(`[Socket.IO] Perros pendientes - equipo que echó: ${finalMesa.perrosConfig.equipoQueEcha}`);
                  finalRoom.jugadores.forEach(p => {
                    const pJugador = finalMesa.jugadores.find(j => j.id === p.socketId);
                    const debeResponder = pJugador && pJugador.equipo !== finalMesa.perrosConfig.equipoQueEcha;
                    io.to(p.socketId).emit('perros-pendientes', {
                      equipoQueEcha: finalMesa.perrosConfig.equipoQueEcha,
                      debeResponder,
                      estado: getEstadoParaJugador(finalMesa, p.socketId),
                    });
                  });
                } else {
                  finalRoom.jugadores.forEach(p => {
                    console.log(`[Socket.IO] Sending estado-actualizado to ${p.nombre} (${p.socketId})`);
                    io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(finalMesa, p.socketId));
                  });

                  // === FLOR POR TURNO AL INICIAR RONDA ===
                  // Solo declarar la flor del jugador mano (primer turno) - el resto se declara en su turno
                  if (finalMesa.manoActual === 1 && !finalMesa.florYaCantada && finalMesa.jugadoresConFlor && finalMesa.jugadoresConFlor.length > 0) {
                    setTimeout(() => {
                      const currentMesa = engines.get(mesaId);
                      const currentRoom = lobbyRooms.get(mesaId);
                      if (!currentMesa || !currentRoom || currentMesa.florYaCantada) return;

                      const manoJugador = currentMesa.jugadores[currentMesa.turnoActual];
                      if (manoJugador) {
                        const florResult = cantarFlorDeJugador(currentMesa, manoJugador.id);
                        if (florResult) {
                          emitirFlorDeJugador(io, currentRoom, currentMesa, florResult);
                        }
                      }
                    }, 1500);
                  }
                  // === FIN FLOR POR TURNO AL INICIAR RONDA ===
                }
              }, 500);
            }
          }, dealDelay * (index + 1));
        });

        callback(true);
      } catch (err) {
        console.error('Error realizar corte:', err);
        callback(false, 'Error interno');
      }
    });

    // === CAMBIAR EQUIPO (manual team assignment in waiting room) ===
    socket.on('cambiar-equipo', (data, callback) => {
      try {
        const { jugadorId, nuevoEquipo } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede cambiar equipos'); return; }
        if (room.estado !== 'esperando') { callback(false, 'La partida ya comenzó'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const jugador = mesa.jugadores.find(j => j.id === jugadorId);
        if (!jugador) { callback(false, 'Jugador no encontrado'); return; }
        if (nuevoEquipo !== 1 && nuevoEquipo !== 2) { callback(false, 'Equipo inválido'); return; }

        jugador.equipo = nuevoEquipo;
        mesa.equipos[0].jugadores = mesa.jugadores.filter(j => j.equipo === 1);
        mesa.equipos[1].jugadores = mesa.jugadores.filter(j => j.equipo === 2);

        // Broadcast updated state to all players
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
        });

        callback(true);
      } catch (err) {
        console.error('Error cambiar equipo:', err);
        callback(false, 'Error interno');
      }
    });

    // === TOGGLE AYUDA (per-player help mode) ===
    socket.on('toggle-ayuda', (data, callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const jugador = mesa.jugadores.find(j => j.id === socket.id);
        if (!jugador) { callback(false, 'Jugador no encontrado'); return; }

        jugador.modoAyuda = data.modoAyuda === true;

        // Broadcast updated state to all players
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
        });

        callback(true);
      } catch (err) {
        console.error('Error toggle ayuda:', err);
        callback(false, 'Error interno');
      }
    });

    // === TIRAR REYES (random team assignment) ===
    socket.on('tirar-reyes', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede tirar reyes'); return; }
        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        // Allow tirar reyes in waiting room OR after game ends
        if (room.estado !== 'esperando' && mesa.estado !== 'terminado') {
          callback(false, 'La partida ya comenzó');
          return;
        }

        const numJugadores = mesa.jugadores.length;
        if (numJugadores < 2) { callback(false, 'Se necesitan al menos 2 jugadores'); return; }

        // Create a mini deck with Kings (12s) and random cards for the animation
        const palos = ['oro', 'copa', 'espada', 'basto'];
        const reyes = palos.map(p => ({ palo: p, valor: 12 }));
        const otrasCartas = [];
        for (const palo of palos) {
          for (const valor of [1, 2, 3, 4, 5, 6, 7, 10, 11]) {
            otrasCartas.push({ palo, valor });
          }
        }

        // Shuffle other cards
        for (let i = otrasCartas.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [otrasCartas[i], otrasCartas[j]] = [otrasCartas[j], otrasCartas[i]];
        }

        // Each player draws cards until someone gets a King
        // The first half of Kings found determine Team 1, rest Team 2
        const jugadoresPerEquipo = Math.ceil(numJugadores / 2);

        // Shuffle players for random draw order
        const jugadoresBarajados = [...mesa.jugadores];
        for (let i = jugadoresBarajados.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [jugadoresBarajados[i], jugadoresBarajados[j]] = [jugadoresBarajados[j], jugadoresBarajados[i]];
        }

        // Generate the animation sequence: each player draws a card
        // We need to assign Kings to random players
        const reyesBarajados = [...reyes];
        for (let i = reyesBarajados.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [reyesBarajados[i], reyesBarajados[j]] = [reyesBarajados[j], reyesBarajados[i]];
        }

        // Assign: first `jugadoresPerEquipo` players get Kings (Team 1), rest get non-Kings (Team 2)
        const equipo1Jugadores = jugadoresBarajados.slice(0, jugadoresPerEquipo);
        const equipo2Jugadores = jugadoresBarajados.slice(jugadoresPerEquipo);

        // Build animation data: each player gets a card to show
        const animacion = [];
        let reyIdx = 0;
        let otraIdx = 0;

        jugadoresBarajados.forEach(j => {
          const esEquipo1 = equipo1Jugadores.some(e1 => e1.id === j.id);
          if (esEquipo1) {
            animacion.push({
              jugadorId: j.id,
              jugadorNombre: j.nombre,
              carta: reyesBarajados[reyIdx % reyesBarajados.length],
              esRey: true,
              equipo: 1,
            });
            reyIdx++;
          } else {
            animacion.push({
              jugadorId: j.id,
              jugadorNombre: j.nombre,
              carta: otrasCartas[otraIdx % otrasCartas.length],
              esRey: false,
              equipo: 2,
            });
            otraIdx++;
          }
        });

        // Actually assign teams
        equipo1Jugadores.forEach(j => { j.equipo = 1; });
        equipo2Jugadores.forEach(j => { j.equipo = 2; });
        mesa.equipos[0].jugadores = mesa.jugadores.filter(j => j.equipo === 1);
        mesa.equipos[1].jugadores = mesa.jugadores.filter(j => j.equipo === 2);

        // If game was finished, reset and start new game after animation
        if (mesa.estado === 'terminado') {
          const puntosLimite = mesa.puntosLimite;
          mesa.equipos[0].puntaje = 0;
          mesa.equipos[1].puntaje = 0;
          mesa.winnerJuego = null;
          mesa.winnerRonda = null;
          mesa.mensajeRonda = null;
          mesa.puntosLimite = puntosLimite;
          mesa.estado = 'esperando';
          mesa.fase = 'esperando_cantos';
          room.estado = 'esperando'; // Reset room state too
        }

        // Emit animation event to all players
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('tirar-reyes-resultado', {
            animacion,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        callback(true);
      } catch (err) {
        console.error('Error tirar reyes:', err);
        callback(false, 'Error interno');
      }
    });

    // === CONFIGURAR PUNTOS ===
    socket.on('configurar-puntos', (data, callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede configurar'); return; }
        if (room.estado !== 'esperando') { callback(false, 'La partida ya comenzó'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const { puntosLimite } = data;
        if (!puntosLimite || puntosLimite < 10 || puntosLimite > 100) {
          callback(false, 'Puntos debe ser entre 10 y 100');
          return;
        }

        mesa.puntosLimite = puntosLimite;

        // Broadcast updated state to all players
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
        });

        callback(true);
      } catch (err) {
        console.error('Error configurar puntos:', err);
        callback(false, 'Error interno');
      }
    });

    // === REVANCHA ===
    socket.on('revancha', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede iniciar revancha'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }
        if (mesa.estado !== 'terminado') { callback(false, 'El juego no ha terminado'); return; }

        // Reset scores but keep teams and puntosLimite
        const puntosLimite = mesa.puntosLimite;
        mesa.equipos[0].puntaje = 0;
        mesa.equipos[1].puntaje = 0;
        mesa.winnerJuego = null;
        mesa.winnerRonda = null;
        mesa.mensajeRonda = null;
        mesa.estado = 'jugando';
        mesa.puntosLimite = puntosLimite;

        // Reset room state and timer for new game
        room.estado = 'jugando';
        room.inicioPartida = Date.now();

        // Start new round
        mesa.indiceMano = 0;
        iniciarRondaFase1(mesa);

        // Broadcast state
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('partida-iniciada', getEstadoParaJugador(mesa, p.socketId));
        });

        // Notify who should cut
        const cortador = mesa.jugadores[mesa.indiceJugadorCorta];
        if (cortador) {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('corte-solicitado', {
              jugadorId: cortador.id,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
        }

        callback(true);
      } catch (err) {
        console.error('Error revancha:', err);
        callback(false, 'Error interno');
      }
    });

    // === TERMINAR PARTIDA (solo anfitrión) ===
    socket.on('terminar-partida', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede terminar la partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }
        if (mesa.estado !== 'jugando') { callback(false, 'La partida no está en curso'); return; }

        // El equipo del anfitrión pierde por abandono
        const jugadorAnfitrion = mesa.jugadores.find(j => j.id === socket.id);
        const equipoAnfitrion = jugadorAnfitrion ? jugadorAnfitrion.equipo : 1;
        const equipoGanador = equipoAnfitrion === 1 ? 2 : 1;

        mesa.winnerJuego = equipoGanador;
        mesa.estado = 'terminado';
        mesa.mensajeRonda = `El anfitrión terminó la partida. Equipo ${equipoGanador} gana por abandono.`;
        room.estado = 'terminado';
        guardarResultadoPartida(room, mesa);

        // Notificar a todos
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('juego-finalizado', {
            ganadorEquipo: equipoGanador,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        broadcastLobby(io);
        callback(true);
      } catch (err) {
        console.error('Error terminar-partida:', err);
        callback(false, 'Error interno');
      }
    });

    // === ECHAR LOS PERROS ===
    // Activar modo "echar los perros" antes de repartir
    socket.on('echar-perros', (data, callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        // Solo se puede echar los perros cuando va a empezar una nueva ronda
        // (después de que terminó la anterior y antes de repartir)
        if (mesa.estado !== 'jugando' || mesa.fase !== 'cortando') {
          callback(false, 'Solo se puede echar los perros antes de repartir');
          return;
        }

        const jugador = mesa.jugadores.find(j => j.id === socket.id);
        if (!jugador) { callback(false, 'Jugador no encontrado'); return; }

        const miEquipo = jugador.equipo;
        const equipoRival = miEquipo === 1 ? 2 : 1;

        // Solo el equipo que va perdiendo puede echar los perros
        // y solo cuando el rival ya pasó a "buenas" (más de la mitad de los puntos)
        const mitadPuntos = mesa.puntosLimite / 2;
        const puntajeRival = mesa.equipos.find(e => e.id === equipoRival)?.puntaje || 0;
        const puntajeMio = mesa.equipos.find(e => e.id === miEquipo)?.puntaje || 0;

        if (puntajeRival < mitadPuntos) {
          callback(false, 'Solo podés echar los perros cuando el rival está en buenas');
          return;
        }

        if (puntajeMio >= puntajeRival) {
          callback(false, 'Solo el equipo que va perdiendo puede echar los perros');
          return;
        }

        // Activar los perros
        mesa.perrosActivos = true;
        mesa.perrosConfig = {
          equipoQueEcha: miEquipo,
        };

        // Notificar a todos
        const perrosAudioUrl = mesa.audiosCustom?.[socket.id]?.['perros'] || null;
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('perros-echados', {
            equipoQueEcha: miEquipo,
            estado: getEstadoParaJugador(mesa, p.socketId),
            audioCustomUrl: perrosAudioUrl,
          });
        });

        callback(true);
      } catch (err) {
        console.error('Error echar perros:', err);
        callback(false, 'Error interno');
      }
    });

    // Cancelar perros
    socket.on('cancelar-perros', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        mesa.perrosActivos = false;
        mesa.perrosConfig = null;

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('perros-cancelados', {
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        callback(true);
      } catch (err) {
        console.error('Error cancelar perros:', err);
        callback(false, 'Error interno');
      }
    });

    // Responder a los perros (the receiving team responds after seeing their cards)
    // The response is separate: flor/envido decision + truco decision
    // - If has FLOR: decide on Contra Flor al Resto (quiereContraFlor)
    // - If no FLOR: decide on Falta Envido (quiereFaltaEnvido)
    // - Always: decide on Truco (quiereTruco)
    // - If rejects ALL → irse al mazo
    socket.on('responder-perros', (data, callback) => {
      try {
        const { quiereContraFlor, quiereFaltaEnvido, quiereTruco } = data;
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa || !mesa.perrosActivos) { callback(false, 'No hay perros activos'); return; }

        const jugador = mesa.jugadores.find(j => j.id === socket.id);
        if (!jugador || jugador.equipo === mesa.perrosConfig.equipoQueEcha) {
          callback(false, 'Solo el equipo contrario puede responder');
          return;
        }

        // Check if this player has flor
        const tieneFlor = mesa.jugadoresConFlor && mesa.jugadoresConFlor.includes(socket.id);

        // Determine what was accepted/rejected
        const aceptaEnvidoOFlor = tieneFlor ? quiereContraFlor : quiereFaltaEnvido;

        // If rejects both envido/flor AND truco → irse al mazo
        if (!aceptaEnvidoOFlor && !quiereTruco) {
          // Irse al mazo - el equipo que echó los perros gana 1 punto base
          const equipoGanador = mesa.perrosConfig.equipoQueEcha;
          let puntosGanados = 1;

          // Si el equipo que echó los perros tiene flor, suma 3 puntos por cada flor
          const jugadoresEquipoEchador = mesa.jugadores.filter(j => j.equipo === equipoGanador);
          const floresDelEquipoEchador = jugadoresEquipoEchador.filter(j =>
            mesa.jugadoresConFlor && mesa.jugadoresConFlor.includes(j.id)
          );

          if (floresDelEquipoEchador.length > 0) {
            // Sumar 3 puntos por cada flor del equipo que echó los perros
            puntosGanados += floresDelEquipoEchador.length * 3;
            // Guardar las cartas de flor para mostrar
            mesa.cartasFlorReveladas = floresDelEquipoEchador.map(j => ({
              jugadorNombre: j.nombre,
              cartas: (j.cartasOriginales && j.cartasOriginales.length === 3
                ? j.cartasOriginales
                : j.cartas).map(c => ({ ...c })),
            }));
          }

          mesa.equipos.find(e => e.id === equipoGanador).puntaje += puntosGanados;
          mesa.perrosActivos = false;
          const equipoQueEchoPerrosTemp = mesa.perrosConfig.equipoQueEcha;
          mesa.perrosConfig = null;

          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('perros-respondidos', {
              respuesta: 'mazo',
              equipoGanador,
              puntosGanados,
              floresDelEchador: floresDelEquipoEchador.length,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          // Check game end - delay to let players see the perros result
          const eqGanador = mesa.equipos.find(e => e.id === equipoGanador);
          if (eqGanador && eqGanador.puntaje >= mesa.puntosLimite) {
            mesa.winnerJuego = equipoGanador;
            mesa.estado = 'terminado';
            room.estado = 'terminado';
            guardarResultadoPartida(room, mesa);
            setTimeout(() => {
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('juego-finalizado', {
                  ganadorEquipo: mesa.winnerJuego,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
              broadcastLobby(io);
            }, 3000);
          } else {
            scheduleNextRound(io, room);
          }
          callback(true);
          return;
        }

        // Save the response and apply effects
        mesa.perrosRespuesta = {
          tieneFlor,
          quiereContraFlor: tieneFlor ? quiereContraFlor : false,
          quiereFaltaEnvido: !tieneFlor ? quiereFaltaEnvido : false,
          quiereTruco,
        };

        // Apply envido/flor effects immediately
        if (tieneFlor && quiereContraFlor) {
          // Contra Flor al Resto accepted - check if echador team also has flor
          const equipoEchador = mesa.perrosConfig.equipoQueEcha;
          const jugadoresEquipoEchador = mesa.jugadores.filter(j => j.equipo === equipoEchador);
          const floresDelEchador = jugadoresEquipoEchador.filter(j =>
            mesa.jugadoresConFlor && mesa.jugadoresConFlor.includes(j.id)
          );

          if (floresDelEchador.length > 0) {
            // Both teams have flor - auto-resolver contra flor al resto
            // En perros, el echador ya desafió implícitamente al tirar los perros
            // No necesita responder de nuevo - se resuelve automáticamente

            // Primero poblar floresCantadas para que resolverFlor funcione
            mesa.jugadoresConFlor.forEach(id => {
              const jFlor = mesa.jugadores.find(j => j.id === id);
              if (jFlor && !mesa.floresCantadas.some(f => f.jugadorId === id)) {
                mesa.floresCantadas.push({
                  jugadorId: id,
                  jugadorNombre: jFlor.nombre,
                  equipo: jFlor.equipo,
                  puntos: calcularPuntosFlor(jFlor, mesa.muestra),
                });
              }
            });

            // Comparar flores - ganador se lleva contra flor al resto (puntos para ganar)
            const floresEq1 = mesa.floresCantadas.filter(f => f.equipo === 1);
            const floresEq2 = mesa.floresCantadas.filter(f => f.equipo === 2);
            const mejorFlor1 = floresEq1.length > 0 ? Math.max(...floresEq1.map(f => f.puntos)) : 0;
            const mejorFlor2 = floresEq2.length > 0 ? Math.max(...floresEq2.map(f => f.puntos)) : 0;
            const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;

            let ganadorFlor;
            if (mejorFlor1 > mejorFlor2) ganadorFlor = 1;
            else if (mejorFlor2 > mejorFlor1) ganadorFlor = 2;
            else ganadorFlor = equipoMano; // Empate: gana mano

            // Contra flor al resto = puntos para ganar la partida
            const puntajeActual = mesa.equipos.find(e => e.id === ganadorFlor)?.puntaje || 0;
            const puntosFlor = mesa.puntosLimite - puntajeActual;
            mesa.equipos.find(e => e.id === ganadorFlor).puntaje += puntosFlor;

            mesa.florYaCantada = true;
            mesa.envidoYaCantado = true;
            mesa.esperandoRespuestaFlor = false;
            mesa.florPendiente = null;

            // Guardar cartas de flor para revelar
            mesa.cartasFlorReveladas = mesa.floresCantadas.map(f => {
              const jFlor = mesa.jugadores.find(j => j.id === f.jugadorId);
              return {
                jugadorNombre: f.jugadorNombre,
                puntos: f.puntos,
                cartas: jFlor?.cartasOriginales || jFlor?.cartas || [],
              };
            });

            // Check game end
            if (mesa.equipos.find(e => e.id === ganadorFlor).puntaje >= mesa.puntosLimite) {
              mesa.winnerJuego = ganadorFlor;
              mesa.estado = 'terminado';
              mesa.fase = 'finalizada';
            }
          } else {
            // Echador doesn't have flor - respondedor wins their flor automatically (3 pts per flor)
            const floresRespondedor = mesa.jugadores.filter(j =>
              j.equipo === jugador.equipo && mesa.jugadoresConFlor && mesa.jugadoresConFlor.includes(j.id)
            );
            const puntosFlor = floresRespondedor.length * 3;
            mesa.equipos.find(e => e.id === jugador.equipo).puntaje += puntosFlor;
            mesa.florYaCantada = true;
            mesa.envidoYaCantado = true;
          }
        } else if (!tieneFlor && quiereFaltaEnvido) {
          // Falta Envido accepted - resolver automáticamente (ya se aceptó en los perros)
          mesa.envidoYaCantado = true;

          // Calcular puntos de falta envido (lo que le falta al perdedor para llegar al límite)
          const puntajeEquipo1 = mesa.equipos.find(e => e.id === 1)?.puntaje || 0;
          const puntajeEquipo2 = mesa.equipos.find(e => e.id === 2)?.puntaje || 0;
          const puntosParaGanar = Math.max(
            mesa.puntosLimite - puntajeEquipo1,
            mesa.puntosLimite - puntajeEquipo2
          );

          // Resolver envido automáticamente (diferirPuntos=true para sumar después de animaciones)
          const resultadoEnvido = resolverEnvidoAutomatico(mesa, puntosParaGanar, true);

          // Emitir las declaraciones con delay
          if (resultadoEnvido && resultadoEnvido.declaraciones) {
            resultadoEnvido.declaraciones.forEach((decl, index) => {
              setTimeout(() => {
                room.jugadores.forEach(p => {
                  io.to(p.socketId).emit('envido-declarado', {
                    jugadorId: decl.jugadorId,
                    declaracion: decl,
                    estado: getEstadoParaJugador(mesa, p.socketId),
                  });
                });
              }, (index + 1) * 1500);
            });

            // Emitir resultado después de las declaraciones - AHORA sumar los puntos
            setTimeout(() => {
              // Sumar los puntos al marcador después de las animaciones
              const ganador = resultadoEnvido.ganador;
              const puntosGanados = resultadoEnvido.puntosGanados;
              const equipo = mesa.equipos.find(e => e.id === ganador);
              if (equipo) {
                equipo.puntaje += puntosGanados;
                if (equipo.puntaje >= mesa.puntosLimite) {
                  mesa.winnerJuego = ganador;
                  mesa.estado = 'terminado';
                  mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
                  mesa.fase = 'finalizada';
                }
              }

              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('envido-resuelto', {
                  resultado: resultadoEnvido,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });

              // Check game end after envido
              if (mesa.winnerJuego !== null) {
                room.estado = 'terminado'; guardarResultadoPartida(room, mesa);
                room.jugadores.forEach(p => {
                  io.to(p.socketId).emit('juego-finalizado', {
                    ganadorEquipo: mesa.winnerJuego,
                    estado: getEstadoParaJugador(mesa, p.socketId),
                  });
                });
                broadcastLobby(io);
              }
            }, (resultadoEnvido.declaraciones.length + 1) * 1500);
          }
        } else if (tieneFlor && !quiereContraFlor) {
          // Rejected contra flor - equipo que echó gana 3 puntos de su flor
          // "se pasa" = no quiere la contra flor, el que rechazó pierde su flor
          const equipoEchador = mesa.perrosConfig.equipoQueEcha;
          mesa.equipos.find(e => e.id === equipoEchador).puntaje += 3; // 3 pts por flor no querida
          mesa.envidoYaCantado = true; // Deshabilitar envido para esta ronda
          mesa.florYaCantada = true; // Flor también queda resuelta
        } else if (!tieneFlor && !quiereFaltaEnvido) {
          // Rejected falta envido - equipo que echó gana 1 punto y envido queda deshabilitado
          const equipoEchador = mesa.perrosConfig.equipoQueEcha;
          mesa.equipos.find(e => e.id === equipoEchador).puntaje += 1;
          mesa.envidoYaCantado = true; // Deshabilitar envido para esta ronda
        }

        // Apply truco effect
        if (quiereTruco) {
          mesa.puntosEnJuego = 2; // Truco accepted = 2 points
          mesa.nivelGritoAceptado = 'truco';
        } else {
          // Truco rejected - equipo que echó gana 1 punto
          const equipoEchador = mesa.perrosConfig.equipoQueEcha;
          mesa.equipos.find(e => e.id === equipoEchador).puntaje += 1;
        }

        mesa.perrosActivos = false;
        mesa.fase = 'jugando'; // Ahora sí se puede jugar

        // Build response description
        const partes = [];
        if (tieneFlor) {
          partes.push(quiereContraFlor ? 'En Ley se quiere' : 'En Ley se pasa');
        } else {
          partes.push(quiereFaltaEnvido ? 'A Punto se quiere' : 'A Punto se pasa');
        }
        partes.push(quiereTruco ? 'se quiere' : 'se pasa');

        // Notificar que se respondió
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('perros-respondidos', {
            respuesta: partes.join(' y '),
            tieneFlor,
            quiereContraFlor: tieneFlor ? quiereContraFlor : false,
            quiereFaltaEnvido: !tieneFlor ? quiereFaltaEnvido : false,
            quiereTruco,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        // If flor was auto-resolved in perros (contra flor al resto), emit result
        if (tieneFlor && quiereContraFlor && mesa.florYaCantada && mesa.cartasFlorReveladas) {
          setTimeout(() => {
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('flor-resuelta', {
                resultado: {
                  ganador: mesa.winnerJuego || mesa.equipos.reduce((best, e) => e.puntaje > (best?.puntaje || 0) ? e : best, mesa.equipos[0]).id,
                  puntosGanados: 0, // Already applied to scores
                  floresCantadas: mesa.floresCantadas || [],
                  esContraFlor: true,
                },
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
          }, 2000);
        }

        // If contra flor is pending (legacy path), emit flor-pendiente to the echador team
        if (mesa.esperandoRespuestaFlor && mesa.florPendiente) {
          room.jugadores.forEach(p => {
            const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
            io.to(p.socketId).emit('flor-pendiente', {
              equipoQueCanta: mesa.florPendiente.equipoQueCanta,
              equipoQueResponde: mesa.florPendiente.equipoQueResponde,
              debeResponder: pJugador && pJugador.equipo === mesa.florPendiente.equipoQueResponde,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });
        }

        // Check game end after point assignments - delay to let players see the perros result
        const maxPuntaje = Math.max(...mesa.equipos.map(e => e.puntaje));
        if (maxPuntaje >= mesa.puntosLimite) {
          mesa.winnerJuego = mesa.equipos.find(e => e.puntaje >= mesa.puntosLimite).id;
          mesa.estado = 'terminado';
          room.estado = 'terminado';
          guardarResultadoPartida(room, mesa);
          setTimeout(() => {
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('juego-finalizado', {
                ganadorEquipo: mesa.winnerJuego,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });
            broadcastLobby(io);
          }, 3000);
        }

        callback(true);
      } catch (err) {
        console.error('Error responder perros:', err);
        callback(false, 'Error interno');
      }
    });

    // === DISCONNECT ===
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Disconnected: ${socket.id}`);
      socketUsuarios.delete(socket.id);
      socket.leave('lobby');

      // Buscar si el jugador estaba en una partida
      const room = findRoomBySocket(socket.id);
      if (room) {
        const mesa = engines.get(room.mesaId);
        if (mesa) {
          const jugador = mesa.jugadores.find(j => j.id === socket.id);
          if (jugador) {
            jugador.desconectado = true;
            console.log(`[Socket.IO] Jugador ${jugador.nombre} marcado como desconectado en mesa ${room.mesaId}`);

            // Si el anfitrión se desconecta durante el juego, notificar especialmente
            const esAnfitrion = room.jugadores[0]?.socketId === socket.id;
            if (esAnfitrion && room.estado === 'jugando') {
              mesa.mensajeRonda = `El anfitrión (${jugador.nombre}) se ha desconectado`;
              room.jugadores.forEach(p => {
                if (p.socketId !== socket.id) {
                  io.to(p.socketId).emit('anfitrion-desconectado', { nombre: jugador.nombre });
                }
              });
            }

            // Notificar a los demás jugadores
            room.jugadores.forEach(p => {
              if (p.socketId !== socket.id) {
                io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(mesa, p.socketId));
              }
            });

            // Timeout: si no se reconecta en 2 minutos, limpiar
            setTimeout(() => {
              const currentMesa = engines.get(room.mesaId);
              if (!currentMesa) return;
              const jug = currentMesa.jugadores.find(j => j.nombre === jugador.nombre);
              if (jug && jug.desconectado) {
                console.log(`[Socket.IO] Timeout: removiendo jugador desconectado ${jugador.nombre}`);
                // Si la partida está en espera, remover al jugador
                if (room.estado === 'esperando') {
                  currentMesa.jugadores = currentMesa.jugadores.filter(j => j.nombre !== jugador.nombre);
                  room.jugadores = room.jugadores.filter(j => j.nombre !== jugador.nombre);
                  currentMesa.equipos[0].jugadores = currentMesa.jugadores.filter(j => j.equipo === 1);
                  currentMesa.equipos[1].jugadores = currentMesa.jugadores.filter(j => j.equipo === 2);
                  // Si la sala quedó vacía, eliminarla
                  if (room.jugadores.length === 0) {
                    lobbyRooms.delete(room.mesaId);
                    engines.delete(room.mesaId);
                  }
                  broadcastLobby(io);
                }
                // Si la partida está en juego, notificar que se fue
                room.jugadores.forEach(p => {
                  io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
                });
              }
            }, 120000); // 2 minutos
          }
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO listening on path /api/socket/io`);
  });
});
