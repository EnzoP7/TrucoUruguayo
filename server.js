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

function crearEstadoMesa(mesaId, jugadores) {
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
    primeraCartaJugada: false,
    winnerRonda: null,
    winnerJuego: null,
    mensajeRonda: null,
    muestra: null,
  };
}

function iniciarRonda(mesa) {
  mesa.estado = 'jugando';
  const mazo = barajar(crearMazo());
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
  mesa.fase = 'jugando';

  const manos = repartir(mazo, mesa.jugadores.length);
  mesa.jugadores.forEach((j, i) => {
    j.cartas = manos[i];
    j.esMano = i === mesa.indiceMano;
  });

  // La muestra: la carta siguiente después de repartir (queda boca arriba)
  const cartasRepartidas = mesa.jugadores.length * 3;
  if (cartasRepartidas < mazo.length) {
    mesa.muestra = mazo[cartasRepartidas];
  } else {
    mesa.muestra = null;
  }
  mesa.turnoActual = mesa.indiceMano;
}

function getEstadoParaJugador(mesa, jugadorId) {
  const copia = JSON.parse(JSON.stringify(mesa));
  copia.jugadores = copia.jugadores.map(j => {
    if (j.id === jugadorId) return j;
    return { ...j, cartas: j.cartas.map(() => ({ palo: 'basto', valor: 0, poder: 0 })) };
  });
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
  let empate = false;
  for (let i = 1; i < cartasDeLaMano.length; i++) {
    if (cartasDeLaMano[i].carta.poder > cartaGanadora.carta.poder) {
      cartaGanadora = cartasDeLaMano[i];
      empate = false;
    } else if (cartasDeLaMano[i].carta.poder === cartaGanadora.carta.poder) {
      const jug1 = mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
      const jug2 = mesa.jugadores.find(j => j.id === cartasDeLaMano[i].jugadorId);
      if (jug1 && jug2 && jug1.equipo !== jug2.equipo) empate = true;
    }
  }

  if (empate) {
    mesa.ganadoresManos.push(null);
  } else {
    const jugadorGanador = mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
    mesa.ganadoresManos.push(jugadorGanador?.equipo || null);
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

  if (ganadorRonda !== null) {
    finalizarRonda(mesa, ganadorRonda);
  } else if (manoJugada < 3) {
    prepararSiguienteMano(mesa);
  } else {
    finalizarRonda(mesa, equipoMano);
  }
}

function finalizarRonda(mesa, equipoGanador) {
  mesa.winnerRonda = equipoGanador;
  mesa.fase = 'finalizada';
  const equipo = mesa.equipos.find(e => e.id === equipoGanador);
  if (equipo) equipo.puntaje += mesa.puntosEnJuego;
  mesa.mensajeRonda = `Equipo ${equipoGanador} ganó la ronda (+${mesa.puntosEnJuego} pts)`;
  if (equipo && equipo.puntaje >= 30) {
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
  iniciarRonda(mesa);
}

// Truco system
function cantarTruco(mesa, jugadorId, tipo) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || mesa.estado !== 'jugando' || mesa.gritoActivo || mesa.envidoActivo) return false;

  if (tipo === 'truco' && mesa.nivelGritoAceptado !== null) return false;
  if (tipo === 'retruco' && mesa.nivelGritoAceptado !== 'truco') return false;
  if (tipo === 'vale4' && mesa.nivelGritoAceptado !== 'retruco') return false;

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
    if (equipo && equipo.puntaje >= 30) {
      mesa.winnerJuego = equipoGanador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
    }
  }
  return true;
}

// Envido system
function calcularPuntosEnvidoTipo(mesa, tipo) {
  if (tipo === 'envido') return 2;
  if (tipo === 'real_envido') return 3;
  if (tipo === 'falta_envido') {
    const max1 = 30 - mesa.equipos[0].puntaje;
    const max2 = 30 - mesa.equipos[1].puntaje;
    return Math.min(max1, max2);
  }
  return 0;
}

function cantarEnvido(mesa, jugadorId, tipo) {
  const jugador = mesa.jugadores.find(j => j.id === jugadorId);
  if (!jugador || mesa.estado !== 'jugando' || mesa.primeraCartaJugada) return false;
  if (mesa.envidoYaCantado && !mesa.envidoActivo) return false;
  if (mesa.gritoActivo) return false;

  if (mesa.envidoActivo) {
    if (jugador.equipo === mesa.envidoActivo.equipoQueCanta) return false;
    const ultimoTipo = mesa.envidoActivo.tipos[mesa.envidoActivo.tipos.length - 1];
    if (tipo === 'envido' && ultimoTipo !== 'envido') return false;
    if (tipo === 'real_envido' && ultimoTipo === 'falta_envido') return false;

    const puntosNuevo = calcularPuntosEnvidoTipo(mesa, tipo);
    mesa.envidoActivo.tipos.push(tipo);
    mesa.envidoActivo.puntosSiNoQuiere = mesa.envidoActivo.puntosAcumulados;
    mesa.envidoActivo.puntosAcumulados += puntosNuevo;
    mesa.envidoActivo.equipoQueCanta = jugador.equipo;
    mesa.envidoActivo.jugadorQueCanta = jugadorId;
  } else {
    const puntos = calcularPuntosEnvidoTipo(mesa, tipo);
    mesa.envidoActivo = {
      tipos: [tipo],
      equipoQueCanta: jugador.equipo,
      jugadorQueCanta: jugadorId,
      puntosAcumulados: puntos,
      puntosSiNoQuiere: 1,
    };
  }
  return true;
}

function calcularPuntosEnvidoJugador(jugador) {
  const cartas = jugador.cartas;
  if (cartas.length === 0) return 0;

  const porPalo = {};
  cartas.forEach(c => {
    if (!porPalo[c.palo]) porPalo[c.palo] = [];
    const valorEnvido = c.valor >= 10 ? 0 : c.valor;
    porPalo[c.palo].push(valorEnvido);
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
      const valorEnvido = c.valor >= 10 ? 0 : c.valor;
      if (valorEnvido > mejorPuntaje) mejorPuntaje = valorEnvido;
    });
  }
  return mejorPuntaje;
}

function resolverEnvido(mesa) {
  let mejorEquipo1 = 0;
  let mejorEquipo2 = 0;

  mesa.jugadores.forEach(jugador => {
    const puntos = calcularPuntosEnvidoJugador(jugador);
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
    const resultado = resolverEnvido(mesa);
    const equipo = mesa.equipos.find(e => e.id === resultado.ganador);
    if (equipo) equipo.puntaje += resultado.puntosGanados;
    mesa.envidoActivo = null;
    if (equipo && equipo.puntaje >= 30) {
      mesa.winnerJuego = resultado.ganador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${resultado.ganador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
    return { resultado };
  } else {
    const puntos = mesa.envidoActivo.puntosSiNoQuiere;
    const equipoGanador = mesa.envidoActivo.equipoQueCanta;
    const equipo = mesa.equipos.find(e => e.id === equipoGanador);
    if (equipo) equipo.puntaje += puntos;
    mesa.envidoActivo = null;
    if (equipo && equipo.puntaje >= 30) {
      mesa.winnerJuego = equipoGanador;
      mesa.estado = 'terminado';
      mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
      mesa.fase = 'finalizada';
    }
    return {};
  }
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

        const existingPlayer = room.jugadores.find(j => j.nombre === nombre);
        if (existingPlayer) {
          const oldSocketId = existingPlayer.socketId;
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
        } else {
          if (room.estado === 'esperando' && room.jugadores.length < room.maxJugadores) {
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

        callback(true);
      } catch (err) {
        console.error('Error reconnecting:', err);
        callback(false, 'Error interno');
      }
    });

    // === INICIAR PARTIDA ===
    socket.on('iniciar-partida', (callback) => {
      try {
        const room = findRoomBySocket(socket.id);
        if (!room) { callback(false, 'No estás en ninguna partida'); return; }
        if (room.jugadores[0].socketId !== socket.id) { callback(false, 'Solo el anfitrión puede iniciar'); return; }
        if (room.jugadores.length < 2) { callback(false, 'Se necesitan al menos 2 jugadores'); return; }

        const mesa = engines.get(room.mesaId);
        if (!mesa) { callback(false, 'Motor no encontrado'); return; }

        room.estado = 'jugando';
        iniciarRonda(mesa);

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('partida-iniciada', getEstadoParaJugador(mesa, p.socketId));
        });

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

        const success = jugarCarta(mesa, socket.id, carta);
        if (!success) { callback(false, 'Movimiento inválido'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('carta-jugada', {
            jugadorId: socket.id,
            carta,
            estado: getEstadoParaJugador(mesa, p.socketId),
          });
        });

        if (mesa.fase === 'finalizada') {
          room.jugadores.forEach(p => {
            io.to(p.socketId).emit('ronda-finalizada', {
              ganadorEquipo: mesa.winnerRonda,
              puntosGanados: mesa.puntosEnJuego,
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
            const mesaId = room.mesaId;
            setTimeout(() => {
              const currentMesa = engines.get(mesaId);
              const currentRoom = lobbyRooms.get(mesaId);
              if (currentMesa && currentRoom) {
                iniciarSiguienteRonda(currentMesa);
                currentRoom.jugadores.forEach(p => {
                  io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
                });
              }
            }, 3000);
          }
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
            const mesaId = room.mesaId;
            setTimeout(() => {
              const currentMesa = engines.get(mesaId);
              const currentRoom = lobbyRooms.get(mesaId);
              if (currentMesa && currentRoom) {
                iniciarSiguienteRonda(currentMesa);
                currentRoom.jugadores.forEach(p => {
                  io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
                });
              }
            }, 3000);
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

        const success = cantarEnvido(mesa, socket.id, tipo);
        if (!success) { callback(false, 'No se puede cantar envido'); return; }

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-cantado', {
            jugadorId: socket.id,
            tipo,
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

        room.jugadores.forEach(p => {
          io.to(p.socketId).emit('envido-respondido', {
            jugadorId: socket.id,
            acepta,
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

        callback(true);
      } catch (err) {
        console.error('Error responder envido:', err);
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
          const mesaId = room.mesaId;
          setTimeout(() => {
            const currentMesa = engines.get(mesaId);
            const currentRoom = lobbyRooms.get(mesaId);
            if (currentMesa && currentRoom) {
              iniciarSiguienteRonda(currentMesa);
              currentRoom.jugadores.forEach(p => {
                io.to(p.socketId).emit('estado-actualizado', getEstadoParaJugador(currentMesa, p.socketId));
              });
            }
          }, 3000);
        }

        callback(true);
      } catch (err) {
        console.error('Error irse al mazo:', err);
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
