const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================================
// Game State (in-memory)
// ============================================================

// Mazo uruguayo (40 cartas)
function crearMazo() {
  const palos = ['oro', 'copa', 'espada', 'basto'];
  const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  const jerarquia = {
    'espada-1': 14, 'basto-1': 13, 'espada-7': 12, 'oro-7': 11,
    'espada-3': 10, 'basto-3': 9, 'oro-3': 8, 'copa-3': 7,
    'espada-2': 6, 'basto-2': 5, 'oro-2': 4, 'copa-2': 3,
    'oro-1': 2, 'copa-1': 1,
  };
  const cartas = [];
  for (const palo of palos) {
    for (const valor of valores) {
      const clave = `${palo}-${valor}`;
      cartas.push({ palo, valor, poder: jerarquia[clave] || 0 });
    }
  }
  return cartas;
}

// Actualizar el poder de las cartas según la muestra
// Las piezas (del palo de la muestra) van por encima de las matas
// Jerarquía completa (de menor a mayor):
// Comunes: 4,5,6,7,10,11,12 (poder 0) -> 1 copa/oro (1-2) -> 2s (3-6) -> 3s (7-10)
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

function crearEstadoMesa(mesaId, jugadores, puntosLimite = 30) {
  const mitad = Math.ceil(jugadores.length / 2);
  const eq1 = jugadores.filter((_, i) => i < mitad);
  const eq2 = jugadores.filter((_, i) => i >= mitad);
  eq1.forEach(j => j.equipo = 1);
  eq2.forEach(j => j.equipo = 2);

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
    // Echar los perros system
    perrosActivos: false, // Si está activo el modo "echar los perros"
    perrosConfig: null, // { contraFlor: true, faltaEnvido: true, truco: true }
    // Alternancia de gritos (quién puede gritar qué)
    ultimoEquipoQueGrito: null, // Para validar alternancia de truco/retruco/vale4
  };
}

// Phase 1: Shuffle the deck and wait for cut
function iniciarRondaFase1(mesa) {
  mesa.estado = 'jugando';
  mesa.cartasMesa = [];
  mesa.ganadoresManos = [];
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
  mesa.ultimoEquipoQueGrito = null;
  // Mantener perrosActivos si está configurado (se resetea manualmente)

  // Shuffle the deck
  const mazo = barajar(crearMazo());
  mesa.mazoBarajado = mazo;

  // Who is mano this round
  mesa.jugadores.forEach((j, i) => {
    j.cartas = [];
    j.esMano = i === mesa.indiceMano;
  });

  // The player to the LEFT of mano cuts (next index)
  mesa.indiceJugadorCorta = (mesa.indiceMano + 1) % mesa.jugadores.length;
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

  const manos = repartir(mazo, mesa.jugadores.length);
  mesa.jugadores.forEach((j, i) => {
    j.cartas = manos[i];
  });

  // La muestra: la carta siguiente después de repartir (queda boca arriba)
  const cartasRepartidas = mesa.jugadores.length * 3;
  if (cartasRepartidas < mazo.length) {
    mesa.muestra = mazo[cartasRepartidas];
  } else {
    mesa.muestra = null;
  }

  // Actualizar el poder de las cartas de cada jugador según la muestra
  // Las piezas (2,4,5,10,11 del palo de la muestra) son más fuertes que las matas
  if (mesa.muestra) {
    mesa.jugadores.forEach(j => {
      actualizarPoderConMuestra(j.cartas, mesa.muestra);
    });
  }

  mesa.turnoActual = mesa.indiceMano;

  // Build the dealing order: 3 rounds, starting from mano, ending at dealer
  // Dealer is the player before mano (mano - 1)
  mesa.cartasRepartidas = [];
  const numJugadores = mesa.jugadores.length;
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (let offset = 0; offset < numJugadores; offset++) {
      const jugadorIndex = (mesa.indiceMano + offset) % numJugadores;
      mesa.cartasRepartidas.push({
        jugadorIndex,
        cartaIndex: vuelta, // which card (0, 1, or 2) for this player
        vuelta,
      });
    }
  }
}

// Complete dealing phase and start playing
function finalizarReparticion(mesa) {
  mesa.repartiendoCartas = false;
  mesa.cartasRepartidas = [];
  mesa.fase = 'jugando';

  // Detect who has flor
  mesa.jugadoresConFlor = [];
  mesa.floresCantadas = [];
  mesa.florYaCantada = false;
  mesa.jugadores.forEach(j => {
    if (tieneFlor(j, mesa.muestra)) {
      mesa.jugadoresConFlor.push(j.id);
    }
  });
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
  copia.jugadores = copia.jugadores.map(j => {
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
  return copia;
}

function jugarCarta(mesa, jugadorId, carta) {
  if (mesa.fase !== 'jugando') return false;
  if (mesa.gritoActivo || mesa.envidoActivo) return false;

  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return false;

  const jugadorIndex = mesa.jugadores.findIndex(j => j.id === jugadorId);
  if (jugadorIndex !== mesa.turnoActual) return false;

  const cartaIdx = jugador.cartas.findIndex(c => c.palo === carta.palo && c.valor === carta.valor);
  if (cartaIdx === -1) return false;

  jugador.cartas.splice(cartaIdx, 1);
  mesa.cartasMesa.push({ jugadorId, carta });

  if (!mesa.primeraCartaJugada) mesa.primeraCartaJugada = true;

  siguienteTurno(mesa);
  return true;
}

function siguienteTurno(mesa) {
  const inicio = (mesa.manoActual - 1) * mesa.jugadores.length;
  const cartasEnEstaMano = mesa.cartasMesa.length - inicio;

  if (cartasEnEstaMano >= mesa.jugadores.length) {
    determinarGanadorMano(mesa);
  } else {
    mesa.turnoActual = (mesa.turnoActual + 1) % mesa.jugadores.length;
  }
}

function determinarGanadorMano(mesa) {
  const inicio = (mesa.manoActual - 1) * mesa.jugadores.length;
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

  if (empate) {
    mesa.ganadoresManos.push(null);
    mesa.cartaGanadoraMano = null; // No winner - empate
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
  if (ganadorAnterior !== null) {
    const primerJugador = mesa.jugadores.findIndex(j => j.equipo === ganadorAnterior);
    mesa.turnoActual = primerJugador >= 0 ? primerJugador : mesa.indiceMano;
  } else {
    mesa.turnoActual = mesa.indiceMano;
  }
}

function iniciarSiguienteRonda(mesa) {
  if (mesa.estado === 'terminado') return;
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
  if (tipo === 'retruco' && mesa.ultimoEquipoQueGrito === jugador.equipo) {
    return false; // No puede subir su propio grito
  }
  if (tipo === 'vale4' && mesa.ultimoEquipoQueGrito === jugador.equipo) {
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

function responderTruco(mesa, jugadorId, acepta) {
  if (!mesa.gritoActivo) return false;
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || jugador.equipo === mesa.gritoActivo.equipoQueGrita) return false;

  if (acepta) {
    mesa.puntosEnJuego = mesa.gritoActivo.puntosEnJuego;
    mesa.nivelGritoAceptado = mesa.gritoActivo.tipo;
    // Guardar qué equipo gritó para validar alternancia
    mesa.ultimoEquipoQueGrito = mesa.gritoActivo.equipoQueGrita;
    mesa.gritoActivo = null;
  } else {
    const puntos = mesa.gritoActivo.puntosSiNoQuiere;
    const equipoGanador = mesa.gritoActivo.equipoQueGrita;
    mesa.gritoActivo = null;
    finalizarRonda(mesa, equipoGanador);
    const equipo = mesa.equipos.find(e => e.id === equipoGanador);
    if (equipo) {
      equipo.puntaje -= mesa.puntosEnJuego;
      equipo.puntaje += puntos;
    }
    mesa.mensajeRonda = `Equipo ${equipoGanador} ganó por no querer (+${puntos} pts)`;
    if (equipo && equipo.puntaje >= mesa.puntosLimite) {
      mesa.winnerJuego = equipoGanador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
    }
  }
  return true;
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

  // El envido solo se puede cantar en la primera mano (mano 1)
  if (mesa.manoActual !== 1) return false;

  // El jugador puede cantar envido antes de jugar SU propia carta en esta mano
  // Verificar si el jugador ya jugó una carta en la mano actual
  const cartasManoActual = mesa.cartasMesa.slice(0, mesa.jugadores.length); // Primera mano = primeras N cartas
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
function cantarFlorAutomatica(mesa) {
  if (mesa.florYaCantada) return { cantadas: [], resultado: null };
  if (mesa.jugadoresConFlor.length === 0) return { cantadas: [], resultado: null };

  const declaraciones = [];

  // Cantar flor para cada jugador que la tiene
  mesa.jugadoresConFlor.forEach(jugadorId => {
    const jugador = mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;

    const puntosFlor = calcularPuntosFlor(jugador, mesa.muestra);
    // Guardar las cartas para revelar al final de la ronda
    const cartasFlor = jugador.cartas.map(c => ({ ...c }));

    const declaracion = {
      jugadorId,
      jugadorNombre: jugador.nombre,
      equipo: jugador.equipo,
      puntos: puntosFlor,
      cartas: cartasFlor, // Guardar las cartas del jugador con flor
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

  // Resolver la flor
  const resultado = resolverFlor(mesa);

  return {
    cantadas: declaraciones,
    resultado: resultado.resultado,
  };
}

// Calcular envido de un jugador según las reglas:
// - Si tiene pieza: valor de la pieza + carta más alta de las otras 2
// - Si no tiene pieza y tiene 2 cartas del mismo palo: suma de las 2 + 20
// - Si las 3 cartas son de distinto palo: la carta más alta
// Envido máximo: 37 (2 de la muestra=30 + 7)
function calcularPuntosEnvidoJugador(jugador, muestra) {
  const cartas = jugador.cartas;
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

    // Buscar la carta más alta entre las otras 2 (no piezas)
    const otrasCartas = cartas.filter(c => !(c.palo === mejorPieza.carta.palo && c.valor === mejorPieza.carta.valor));

    let mejorOtra = 0;
    otrasCartas.forEach(c => {
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
  const cartas = jugador.cartas;
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
  const cartas = jugador.cartas;
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

  // Resto de piezas: solo último dígito
  for (let i = 1; i < piezasConValor.length; i++) {
    total += piezasConValor[i].valorEnvido % 10;
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
  if (!mesa.envidoActivo) return {};
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || jugador.equipo === mesa.envidoActivo.equipoQueCanta) return {};

  mesa.envidoYaCantado = true;

  if (acepta) {
    // Resolver el envido automáticamente - generar todas las declaraciones
    const puntosAcumulados = mesa.envidoActivo.puntosAcumulados;
    mesa.envidoActivo = null;

    const resultado = resolverEnvidoAutomatico(mesa, puntosAcumulados);
    return { inicioDeclaracion: true, automatico: true, resultado };
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
    return {};
  }
}

// Resolver envido automáticamente generando declaraciones en orden correcto
// Flujo: mano declara primero, luego el equipo contrario responde,
// compañeros solo intervienen si tienen más puntos que el mejor actual
function resolverEnvidoAutomatico(mesa, puntosAcumulados) {
  const equipoMano = mesa.jugadores[mesa.indiceMano]?.equipo || 1;
  const equipoContrario = equipoMano === 1 ? 2 : 1;

  // Calcular puntos de cada jugador
  const jugadoresConPuntos = mesa.jugadores.map(j => ({
    jugadorId: j.id,
    jugadorNombre: j.nombre,
    equipo: j.equipo,
    puntos: calcularPuntosEnvidoJugador(j, mesa.muestra),
  }));

  // Separar por equipo
  const equipoManoJugadores = jugadoresConPuntos
    .filter(j => j.equipo === equipoMano)
    .sort((a, b) => b.puntos - a.puntos); // Mayor a menor

  const equipoContrarioJugadores = jugadoresConPuntos
    .filter(j => j.equipo === equipoContrario)
    .sort((a, b) => b.puntos - a.puntos); // Mayor a menor

  const declaraciones = [];
  let mejorPuntajeDeclarado = null;
  let equipoMejorPuntaje = null;

  // Paso 1: El mano (el de más puntos del equipo mano) declara primero
  const manoDeclarante = equipoManoJugadores[0];
  declaraciones.push({
    jugadorId: manoDeclarante.jugadorId,
    jugadorNombre: manoDeclarante.jugadorNombre,
    equipo: manoDeclarante.equipo,
    puntos: manoDeclarante.puntos,
    sonBuenas: false,
  });
  mejorPuntajeDeclarado = manoDeclarante.puntos;
  equipoMejorPuntaje = manoDeclarante.equipo;

  // Paso 2: El equipo contrario responde
  // El de más puntos del equipo contrario compara contra el mejor declarado
  const contrarioDeclarante = equipoContrarioJugadores[0];

  if (contrarioDeclarante.puntos > mejorPuntajeDeclarado) {
    // Tiene más: declara sus puntos
    declaraciones.push({
      jugadorId: contrarioDeclarante.jugadorId,
      jugadorNombre: contrarioDeclarante.jugadorNombre,
      equipo: contrarioDeclarante.equipo,
      puntos: contrarioDeclarante.puntos,
      sonBuenas: false,
    });
    mejorPuntajeDeclarado = contrarioDeclarante.puntos;
    equipoMejorPuntaje = contrarioDeclarante.equipo;
  } else if (contrarioDeclarante.puntos === mejorPuntajeDeclarado) {
    // Empate: declara sus puntos (gana mano por ser primero)
    declaraciones.push({
      jugadorId: contrarioDeclarante.jugadorId,
      jugadorNombre: contrarioDeclarante.jugadorNombre,
      equipo: contrarioDeclarante.equipo,
      puntos: contrarioDeclarante.puntos,
      sonBuenas: false,
    });
    // En empate gana el equipo mano, no cambia equipoMejorPuntaje
  } else {
    // Tiene menos: dice "son buenas"
    declaraciones.push({
      jugadorId: contrarioDeclarante.jugadorId,
      jugadorNombre: contrarioDeclarante.jugadorNombre,
      equipo: contrarioDeclarante.equipo,
      puntos: null,
      sonBuenas: true,
    });
  }

  // Paso 3: En 2v2 / 3v3, los compañeros de cada equipo solo intervienen
  // si tienen más que el mejor puntaje declarado actualmente

  // Compañeros del equipo mano (si hay)
  for (let i = 1; i < equipoManoJugadores.length; i++) {
    const companero = equipoManoJugadores[i];
    if (companero.puntos > mejorPuntajeDeclarado) {
      declaraciones.push({
        jugadorId: companero.jugadorId,
        jugadorNombre: companero.jugadorNombre,
        equipo: companero.equipo,
        puntos: companero.puntos,
        sonBuenas: false,
      });
      mejorPuntajeDeclarado = companero.puntos;
      equipoMejorPuntaje = companero.equipo;
    }
    // Si no tiene más, no interviene (se omite, no dice nada)
  }

  // Compañeros del equipo contrario (si hay)
  for (let i = 1; i < equipoContrarioJugadores.length; i++) {
    const companero = equipoContrarioJugadores[i];
    if (companero.puntos > mejorPuntajeDeclarado) {
      declaraciones.push({
        jugadorId: companero.jugadorId,
        jugadorNombre: companero.jugadorNombre,
        equipo: companero.equipo,
        puntos: companero.puntos,
        sonBuenas: false,
      });
      mejorPuntajeDeclarado = companero.puntos;
      equipoMejorPuntaje = companero.equipo;
    }
    // Si no tiene más, no interviene
  }

  // Determinar ganador (en empate gana mano)
  let ganador = equipoMejorPuntaje;
  if (ganador === null) ganador = equipoMano;

  // Si empatan y el mejor fue del equipo contrario pero hay empate con mano, mano gana
  const mejorMano = equipoManoJugadores[0].puntos;
  const mejorContrario = equipoContrarioJugadores[0].puntos;
  if (mejorMano === mejorContrario) {
    ganador = equipoMano; // Empate gana mano
  }

  // Asignar puntos
  const equipo = mesa.equipos.find(e => e.id === ganador);
  if (equipo) equipo.puntaje += puntosAcumulados;

  // Check for game win
  if (equipo && equipo.puntaje >= mesa.puntosLimite) {
    mesa.winnerJuego = ganador;
    mesa.estado = 'terminado';
    mesa.mensajeRonda = `¡Equipo ${ganador} ganó el juego!`;
    mesa.fase = 'finalizada';
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
  const equipoContrario = jugador.equipo === 1 ? 2 : 1;
  finalizarRonda(mesa, equipoContrario);
  mesa.mensajeRonda = `Equipo ${jugador.equipo} se fue al mazo. Equipo ${equipoContrario} gana (+${mesa.puntosEnJuego} pts)`;
  return true;
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
  }, 3000);
}

// ============================================================
// Main
// ============================================================

app.prepare().then(() => {
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

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`);

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
        const { nombre, tamañoSala = '2v2' } = data;
        const mesaId = `mesa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const maxJugadores = getMaxJugadores(tamañoSala);

        const room = {
          mesaId,
          jugadores: [{ socketId: socket.id, nombre }],
          maxJugadores,
          tamañoSala,
          estado: 'esperando',
        };
        lobbyRooms.set(mesaId, room);

        const jugador = { id: socket.id, nombre, equipo: 1, cartas: [] };
        const mesa = crearEstadoMesa(mesaId, [jugador]);
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
        });
        broadcastLobby(io);

        callback(true, mesaId);
      } catch (err) {
        console.error('Error creating game:', err);
        callback(false, 'Error interno');
      }
    });

    // === UNIRSE A PARTIDA ===
    socket.on('unirse-partida', (data, callback) => {
      try {
        const { mesaId, nombre } = data;
        const room = lobbyRooms.get(mesaId);
        if (!room) { callback(false, 'Partida no encontrada'); return; }
        if (room.estado !== 'esperando') { callback(false, 'La partida ya comenzó'); return; }
        if (room.jugadores.length >= room.maxJugadores) { callback(false, 'La partida está llena'); return; }

        room.jugadores.push({ socketId: socket.id, nombre });

        const mesa = engines.get(mesaId);
        if (!mesa) { callback(false, 'Error interno'); return; }

        const halfPoint = Math.ceil(room.maxJugadores / 2);
        const equipo = (room.jugadores.length - 1) < halfPoint ? 1 : 2;
        const jugador = { id: socket.id, nombre, equipo, cartas: [] };

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
        const { mesaId, nombre } = data;
        const room = lobbyRooms.get(mesaId);
        if (!room) { console.log(`[Socket.IO] Room ${mesaId} not found`); callback(false, 'Partida no encontrada'); return; }

        const mesa = engines.get(mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        let isNewPlayer = false;
        const existingPlayer = room.jugadores.find(j => j.nombre === nombre);
        if (existingPlayer) {
          const oldSocketId = existingPlayer.socketId;
          console.log(`[Socket.IO] Updating socketId for ${nombre}: ${oldSocketId} -> ${socket.id}`);
          existingPlayer.socketId = socket.id;

          // Update in mesa
          const jugInMesa = mesa.jugadores.find(j => j.id === oldSocketId);
          if (jugInMesa) jugInMesa.id = socket.id;
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
            room.jugadores.push({ socketId: socket.id, nombre });
            const halfPoint = Math.ceil(room.maxJugadores / 2);
            const equipo = (room.jugadores.length - 1) < halfPoint ? 1 : 2;
            const jugador = { id: socket.id, nombre, equipo, cartas: [] };
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
    socket.on('iniciar-partida', (callback) => {
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
        iniciarRonda(mesa); // Phase 1: shuffle and wait for cut

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

        // === FLOR AUTOMÁTICA ===
        // Si es la primera mano y hay jugadores con flor que aún no la cantaron,
        // cantar la flor automáticamente ANTES de jugar la carta
        if (mesa.manoActual === 1 && !mesa.florYaCantada && mesa.jugadoresConFlor && mesa.jugadoresConFlor.length > 0) {
          const florResult = cantarFlorAutomatica(mesa);

          // Emitir las flores cantadas
          florResult.cantadas.forEach((declaracion, index) => {
            setTimeout(() => {
              room.jugadores.forEach(p => {
                const pJugador = mesa.jugadores.find(j => j.id === p.socketId);
                const mismoEquipo = pJugador && pJugador.equipo === declaracion.equipo;
                io.to(p.socketId).emit('flor-cantada', {
                  jugadorId: declaracion.jugadorId,
                  declaracion: {
                    ...declaracion,
                    puntos: mismoEquipo ? declaracion.puntos : null,
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            }, index * 1000);
          });

          // Emitir el resultado de la flor
          setTimeout(() => {
            if (florResult.resultado) {
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
                room.estado = 'terminado';
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
        }
        // === FIN FLOR AUTOMÁTICA ===

        const success = jugarCarta(mesa, socket.id, carta);
        if (!success) { callback(false, 'Movimiento inválido'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('carta-jugada', {
            jugadorId: socket.id,
            carta,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

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

          // Wait 3.5 seconds before continuing
          const DELAY_MANO = 3500;
          setTimeout(() => {
            const currentMesa = engines.get(room.mesaId);
            const currentRoom = lobbyRooms.get(room.mesaId);
            if (!currentMesa || !currentRoom) return;

            const resultado = continuarDespuesDeDelay(currentMesa);
            if (!resultado) return;

            if (resultado.tipo === 'ronda') {
              // Ronda finished - emit events with flor cards revealed
              currentRoom.jugadores.forEach(p => {
                io.to(p.socketId).emit('ronda-finalizada', {
                  ganadorEquipo: currentMesa.winnerRonda,
                  puntosGanados: currentMesa.puntosEnJuego,
                  cartasFlorReveladas: currentMesa.cartasFlorReveladas || [],
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

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('truco-cantado', {
            jugadorId: socket.id,
            tipo,
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

        const success = responderTruco(mesa, socket.id, acepta);
        if (!success) { callback(false, 'No se puede responder'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('truco-respondido', {
            jugadorId: socket.id,
            acepta,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (!acepta && mesa.fase === 'finalizada') {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('ronda-finalizada', {
              ganadorEquipo: mesa.winnerRonda,
              puntosGanados: mesa.puntosEnJuego,
              cartasFlorReveladas: mesa.cartasFlorReveladas || [],
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado';
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
                  declaracion: {
                    ...declaracion,
                    puntos: mismoEquipo ? declaracion.puntos : null, // Ocultar puntos al rival
                  },
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
            }, index * 1000); // 1 segundo entre cada flor
          });

          // Después de mostrar todas las flores, emitir el resultado (sin puntajes individuales)
          setTimeout(() => {
            if (florResult.resultado) {
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
                room.estado = 'terminado';
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

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-cantado', {
            jugadorId: socket.id,
            tipo: nombreEnvido,
            puntosCustom,
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

        const result = responderEnvido(mesa, socket.id, acepta);

        // Notificar respuesta
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-respondido', {
            jugadorId: socket.id,
            acepta,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (acepta && result.automatico && result.resultado) {
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

          // Después de todas las declaraciones, emitir resultado
          setTimeout(() => {
            room.jugadores.forEach(p => {
              io.to(p.socketId).emit('envido-resuelto', {
                resultado: result.resultado,
                estado: getEstadoParaJugador(mesa, p.socketId),
              });
            });

            if (mesa.winnerJuego !== null) {
              room.estado = 'terminado';
              room.jugadores.forEach(p => {
                io.to(p.socketId).emit('juego-finalizado', {
                  ganadorEquipo: mesa.winnerJuego,
                  estado: getEstadoParaJugador(mesa, p.socketId),
                });
              });
              broadcastLobby(io);
            }
          }, (declaraciones.length + 1) * 1500);
        } else if (!acepta) {
          // No quiero - check game end
          if (mesa.winnerJuego !== null) {
            room.estado = 'terminado';
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
            room.estado = 'terminado';
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
            room.estado = 'terminado';
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

    // === IRSE AL MAZO ===
    socket.on('irse-al-mazo', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en partida'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        const jugador = mesa.jugadores.find(j => j.id === socket.id);
        const success = irseAlMazo(mesa, socket.id);
        if (!success) { callback(false, 'No se puede ir al mazo'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('jugador-al-mazo', {
            jugadorId: socket.id,
            equipoQueSeVa: jugador?.equipo || 0,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('ronda-finalizada', {
            ganadorEquipo: mesa.winnerRonda,
            puntosGanados: mesa.puntosEnJuego,
            cartasFlorReveladas: mesa.cartasFlorReveladas || [],
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (mesa.winnerJuego !== null) {
          room.estado = 'terminado';
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
                console.log(`[Socket.IO] realizar-corte: repartición finalizada, enviando estado-actualizado a ${finalRoom.jugadores.length} jugadores`);
                finalRoom.jugadores.forEach(p => {
                  console.log(`[Socket.IO] Sending estado-actualizado to ${p.nombre} (${p.socketId})`);
                  io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(finalMesa, p.socketId));
                });
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
        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('perros-echados', {
            equipoQueEcha: miEquipo,
            estado: getEstadoParaJugador(mesa, p.socketId),
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
          // Irse al mazo - el equipo que echó los perros gana 1 punto
          const equipoGanador = mesa.perrosConfig.equipoQueEcha;
          mesa.equipos.find(e => e.id === equipoGanador).puntaje += 1;
          mesa.perrosActivos = false;
          mesa.perrosConfig = null;

          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('perros-respondidos', {
              respuesta: 'mazo',
              equipoGanador,
              puntosGanados: 1,
              estado: getEstadoParaJugador(mesa, p.socketId),
            });
          });

          // Check game end
          const eqGanador = mesa.equipos.find(e => e.id === equipoGanador);
          if (eqGanador && eqGanador.puntaje >= mesa.puntosLimite) {
            mesa.winnerJuego = equipoGanador;
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
          // Contra Flor al Resto accepted - will be resolved via flor system
          // The flor was already detected, just need to set up contra flor
          mesa.florYaCantada = false; // Reset so it triggers
        } else if (!tieneFlor && quiereFaltaEnvido) {
          // Falta Envido accepted - set up envido
          mesa.envidoYaCantado = true;
          mesa.envidoActivo = {
            tipos: ['falta_envido'],
            equipoQueCanta: mesa.perrosConfig.equipoQueEcha,
            jugadorQueCanta: socket.id,
            puntosAcumulados: mesa.puntosLimite, // Falta envido = all remaining points
            puntosSiNoQuiere: 1,
          };
        } else if (tieneFlor && !quiereContraFlor) {
          // Rejected contra flor - equipo que echó gana puntos de no querer
          // "se pasa" = no quiere la contra flor, equipo echador gana 4 pts (contra flor no querida)
        } else if (!tieneFlor && !quiereFaltaEnvido) {
          // Rejected falta envido - equipo que echó gana 1 punto
          const equipoEchador = mesa.perrosConfig.equipoQueEcha;
          mesa.equipos.find(e => e.id === equipoEchador).puntaje += 1;
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

        // Check game end after point assignments
        const maxPuntaje = Math.max(...mesa.equipos.map(e => e.puntaje));
        if (maxPuntaje >= mesa.puntosLimite) {
          mesa.winnerJuego = mesa.equipos.find(e => e.puntaje >= mesa.puntosLimite).id;
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
        console.error('Error responder perros:', err);
        callback(false, 'Error interno');
      }
    });

    // === DISCONNECT ===
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Disconnected: ${socket.id}`);
      socket.leave('lobby');
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO listening on path /api/socket/io`);
  });
});
