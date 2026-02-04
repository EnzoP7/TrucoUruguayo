import { Mesa, Jugador, Carta, Equipo, GritoTipo, EnvidoTipo, EnvidoActivo, EnvidoResultado, FaseRonda } from '@/types/truco';
import { Mazo } from '../models/Mazo';

// Motor de juego genérico que maneja cualquier configuración de equipos
export class TrucoEngine {
  private mesa: Mesa;
  private mazo: Mazo;

  constructor(mesaId: string, jugadores: Jugador[]) {
    this.mazo = new Mazo();
    this.mesa = this.crearMesa(mesaId, jugadores);
  }

  // Crear mesa inicial dividiendo jugadores en 2 equipos
  private crearMesa(mesaId: string, jugadores: Jugador[]): Mesa {
    const mitad = Math.ceil(jugadores.length / 2);
    const equipo1Jugadores = jugadores.slice(0, mitad);
    const equipo2Jugadores = jugadores.slice(mitad);

    const equipo1: Equipo = { id: 1, jugadores: equipo1Jugadores, puntaje: 0 };
    const equipo2: Equipo = { id: 2, jugadores: equipo2Jugadores, puntaje: 0 };

    equipo1Jugadores.forEach(j => j.equipo = 1);
    equipo2Jugadores.forEach(j => j.equipo = 2);

    return {
      id: mesaId,
      jugadores,
      equipos: [equipo1, equipo2],
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
    };
  }

  // Iniciar nueva ronda (reparte cartas, resetea estado de ronda)
  iniciarRonda(): void {
    this.mesa.estado = 'jugando';
    this.mazo.reiniciar();
    this.mazo.barajar();

    // Limpiar estado de ronda
    this.mesa.cartasMesa = [];
    this.mesa.ganadoresManos = [];
    this.mesa.manoActual = 1;
    this.mesa.winnerRonda = null;
    this.mesa.mensajeRonda = null;
    this.mesa.gritoActivo = null;
    this.mesa.nivelGritoAceptado = null;
    this.mesa.puntosEnJuego = 1;
    this.mesa.envidoActivo = null;
    this.mesa.envidoYaCantado = false;
    this.mesa.primeraCartaJugada = false;
    this.mesa.fase = 'jugando';

    // Repartir 3 cartas a cada jugador
    const manos = this.mazo.repartir(this.mesa.jugadores.length);
    this.mesa.jugadores.forEach((jugador, index) => {
      jugador.cartas = manos[index];
    });

    // Marcar quien es mano
    this.mesa.jugadores.forEach((jugador, index) => {
      jugador.esMano = index === this.mesa.indiceMano;
    });

    // El mano comienza
    this.mesa.turnoActual = this.mesa.indiceMano;
  }

  // Jugar una carta
  jugarCarta(jugadorId: string, carta: Carta): boolean {
    if (this.mesa.fase !== 'jugando') return false;
    if (this.mesa.gritoActivo || this.mesa.envidoActivo) return false;

    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return false;

    const jugadorIndex = this.mesa.jugadores.findIndex(j => j.id === jugadorId);
    if (jugadorIndex !== this.mesa.turnoActual) return false;

    const tieneCarta = jugador.cartas.some(c =>
      c.palo === carta.palo && c.valor === carta.valor
    );
    if (!tieneCarta) return false;

    // Remover carta del jugador y ponerla en mesa
    jugador.cartas = jugador.cartas.filter(c =>
      !(c.palo === carta.palo && c.valor === carta.valor)
    );
    this.mesa.cartasMesa.push({ jugadorId, carta });

    // Marcar que ya se jugó primera carta (no más envido)
    if (!this.mesa.primeraCartaJugada) {
      this.mesa.primeraCartaJugada = true;
    }

    this.siguienteTurno();
    return true;
  }

  // Pasar al siguiente turno dentro de la mano
  private siguienteTurno(): void {
    // Contar cuántas cartas se jugaron en esta mano
    const cartasEnEstaMano = this.cartasEnManoActual();

    if (cartasEnEstaMano >= this.mesa.jugadores.length) {
      // Todos jugaron en esta mano, determinar ganador
      this.determinarGanadorMano();
    } else {
      this.mesa.turnoActual = (this.mesa.turnoActual + 1) % this.mesa.jugadores.length;
    }
  }

  // Cartas jugadas en la mano actual
  private cartasEnManoActual(): number {
    const inicio = (this.mesa.manoActual - 1) * this.mesa.jugadores.length;
    return this.mesa.cartasMesa.length - inicio;
  }

  // Determinar ganador de la mano actual
  private determinarGanadorMano(): void {
    const inicio = (this.mesa.manoActual - 1) * this.mesa.jugadores.length;
    const cartasDeLaMano = this.mesa.cartasMesa.slice(inicio);

    if (cartasDeLaMano.length === 0) return;

    // Encontrar la carta más poderosa
    let cartaGanadora = cartasDeLaMano[0];
    let empate = false;
    for (let i = 1; i < cartasDeLaMano.length; i++) {
      if (cartasDeLaMano[i].carta.poder > cartaGanadora.carta.poder) {
        cartaGanadora = cartasDeLaMano[i];
        empate = false;
      } else if (cartasDeLaMano[i].carta.poder === cartaGanadora.carta.poder) {
        // Verificar si son de equipos diferentes (empate real)
        const jug1 = this.mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
        const jug2 = this.mesa.jugadores.find(j => j.id === cartasDeLaMano[i].jugadorId);
        if (jug1 && jug2 && jug1.equipo !== jug2.equipo) {
          empate = true;
        }
      }
    }

    if (empate) {
      this.mesa.ganadoresManos.push(null); // empate
    } else {
      const jugadorGanador = this.mesa.jugadores.find(j => j.id === cartaGanadora.jugadorId);
      this.mesa.ganadoresManos.push(jugadorGanador?.equipo || null);
    }

    // Evaluar si la ronda terminó
    this.evaluarEstadoRonda();
  }

  // Evaluar si la ronda terminó según reglas de mejor de 3
  private evaluarEstadoRonda(): void {
    const ganadores = this.mesa.ganadoresManos;
    const manoJugada = ganadores.length;

    // Contar victorias por equipo
    const victorias: Record<number, number> = { 1: 0, 2: 0 };
    let empates = 0;
    ganadores.forEach(g => {
      if (g === null) empates++;
      else victorias[g]++;
    });

    // Determinar quién es mano (para desempates)
    const equipoMano = this.mesa.jugadores[this.mesa.indiceMano]?.equipo || 1;

    let ganadorRonda: number | null = null;

    // Reglas de desempate del Truco Uruguayo:
    if (victorias[1] >= 2) {
      ganadorRonda = 1;
    } else if (victorias[2] >= 2) {
      ganadorRonda = 2;
    } else if (manoJugada >= 2) {
      // Mano 1 empatada, mano 2 define
      if (ganadores[0] === null && ganadores[1] !== null) {
        ganadorRonda = ganadores[1];
      }
      // Mano 1 ganada por alguien, mano 2 empatada => gana el de la mano 1
      else if (ganadores[0] !== null && ganadores[1] === null) {
        ganadorRonda = ganadores[0];
      }
      // Ambas empatadas => mano 3 define, o si ya jugaron 3 gana el mano
      else if (ganadores[0] === null && ganadores[1] === null) {
        if (manoJugada >= 3) {
          ganadorRonda = ganadores[2] !== null ? ganadores[2] : equipoMano;
        }
      }
      // Mano 3 (si aplica)
      else if (manoJugada >= 3) {
        if (ganadores[2] === null) {
          // Empate en mano 3: gana quien ganó la mano 1
          ganadorRonda = ganadores[0];
        } else {
          ganadorRonda = ganadores[2];
        }
      }
    }

    if (ganadorRonda !== null) {
      this.finalizarRonda(ganadorRonda);
    } else if (manoJugada < 3) {
      // Siguiente mano
      this.prepararSiguienteMano();
    } else {
      // Caso extremo: 3 manos jugadas sin ganador definido => gana el mano
      this.finalizarRonda(equipoMano);
    }
  }

  // Finalizar ronda: asignar puntos y preparar siguiente o terminar juego
  private finalizarRonda(equipoGanador: number): void {
    this.mesa.winnerRonda = equipoGanador;
    this.mesa.fase = 'finalizada';

    // Sumar puntos
    const equipo = this.mesa.equipos.find(e => e.id === equipoGanador);
    if (equipo) {
      equipo.puntaje += this.mesa.puntosEnJuego;
    }

    const nombreEquipo = `Equipo ${equipoGanador}`;
    this.mesa.mensajeRonda = `${nombreEquipo} ganó la ronda (+${this.mesa.puntosEnJuego} pts)`;

    // Verificar si terminó el juego (30 puntos)
    if (equipo && equipo.puntaje >= 30) {
      this.mesa.winnerJuego = equipoGanador;
      this.mesa.estado = 'terminado';
      this.mesa.mensajeRonda = `¡${nombreEquipo} ganó el juego!`;
    }
  }

  // Preparar siguiente mano dentro de la ronda
  private prepararSiguienteMano(): void {
    this.mesa.manoActual++;
    // El turno lo inicia el ganador de la mano anterior, o el mano si hubo empate
    const ganadorAnterior = this.mesa.ganadoresManos[this.mesa.ganadoresManos.length - 1];
    if (ganadorAnterior !== null) {
      // Buscar primer jugador del equipo ganador
      const primerJugador = this.mesa.jugadores.findIndex(j => j.equipo === ganadorAnterior);
      this.mesa.turnoActual = primerJugador >= 0 ? primerJugador : this.mesa.indiceMano;
    } else {
      this.mesa.turnoActual = this.mesa.indiceMano;
    }
  }

  // Iniciar siguiente ronda (llamado después de mostrar resultado)
  iniciarSiguienteRonda(): void {
    if (this.mesa.estado === 'terminado') return;

    // Rotar el mano
    this.mesa.indiceMano = (this.mesa.indiceMano + 1) % this.mesa.jugadores.length;
    this.iniciarRonda();
  }

  // === SISTEMA DE TRUCO/RETRUCO/VALE4 ===

  cantarTruco(jugadorId: string, tipo: GritoTipo): boolean {
    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return false;
    if (this.mesa.estado !== 'jugando') return false;
    if (this.mesa.gritoActivo) return false; // ya hay un grito pendiente
    if (this.mesa.envidoActivo) return false; // hay envido pendiente

    // Validar progresión: truco -> retruco -> vale4
    // Cada nivel solo puede ser cantado por el equipo contrario al que cantó el anterior
    if (tipo === 'truco') {
      if (this.mesa.nivelGritoAceptado !== null) return false; // ya se cantó truco
    } else if (tipo === 'retruco') {
      if (this.mesa.nivelGritoAceptado !== 'truco') return false;
      // Solo puede cantar retruco el equipo que ACEPTÓ el truco (el contrario al que lo cantó)
    } else if (tipo === 'vale4') {
      if (this.mesa.nivelGritoAceptado !== 'retruco') return false;
    }

    const puntosMap: Record<GritoTipo, { enJuego: number; siNoQuiere: number }> = {
      'truco': { enJuego: 2, siNoQuiere: 1 },
      'retruco': { enJuego: 3, siNoQuiere: 2 },
      'vale4': { enJuego: 4, siNoQuiere: 3 },
    };

    const config = puntosMap[tipo];
    this.mesa.gritoActivo = {
      tipo,
      equipoQueGrita: jugador.equipo,
      jugadorQueGrita: jugadorId,
      puntosEnJuego: config.enJuego,
      puntosSiNoQuiere: config.siNoQuiere,
    };

    return true;
  }

  responderTruco(jugadorId: string, acepta: boolean): boolean {
    if (!this.mesa.gritoActivo) return false;

    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return false;

    // Solo puede responder el equipo contrario
    if (jugador.equipo === this.mesa.gritoActivo.equipoQueGrita) return false;

    if (acepta) {
      this.mesa.puntosEnJuego = this.mesa.gritoActivo.puntosEnJuego;
      this.mesa.nivelGritoAceptado = this.mesa.gritoActivo.tipo;
      this.mesa.gritoActivo = null;
    } else {
      // No quiere: el equipo que gritó gana los puntos del nivel anterior
      const puntos = this.mesa.gritoActivo.puntosSiNoQuiere;
      const equipoGanador = this.mesa.gritoActivo.equipoQueGrita;
      this.mesa.gritoActivo = null;
      this.finalizarRonda(equipoGanador);
      // Ajustar puntos: finalizarRonda usa puntosEnJuego, pero aquí queremos dar puntosSiNoQuiere
      const equipo = this.mesa.equipos.find(e => e.id === equipoGanador);
      if (equipo) {
        equipo.puntaje -= this.mesa.puntosEnJuego; // revertir lo que sumó finalizarRonda
        equipo.puntaje += puntos; // sumar lo correcto
      }
      this.mesa.mensajeRonda = `Equipo ${equipoGanador} ganó por no querer (+${puntos} pts)`;
      // Verificar si ganó el juego
      if (equipo && equipo.puntaje >= 30) {
        this.mesa.winnerJuego = equipoGanador;
        this.mesa.estado = 'terminado';
        this.mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
      }
    }

    return true;
  }

  // === SISTEMA DE ENVIDO ===

  cantarEnvido(jugadorId: string, tipo: EnvidoTipo): boolean {
    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return false;
    if (this.mesa.estado !== 'jugando') return false;
    if (this.mesa.primeraCartaJugada) return false; // solo antes de primera carta
    if (this.mesa.envidoYaCantado && !this.mesa.envidoActivo) return false; // ya se resolvió
    if (this.mesa.gritoActivo) return false;

    if (this.mesa.envidoActivo) {
      // Revirar: solo el equipo contrario puede subir
      if (jugador.equipo === this.mesa.envidoActivo.equipoQueCanta) return false;

      // Validar progresión: no se puede bajar
      const ultimoTipo = this.mesa.envidoActivo.tipos[this.mesa.envidoActivo.tipos.length - 1];
      if (tipo === 'envido' && ultimoTipo !== 'envido') return false; // solo envido->envido
      if (tipo === 'real_envido' && ultimoTipo === 'falta_envido') return false;

      const puntosNuevo = this.calcularPuntosEnvido(tipo);
      this.mesa.envidoActivo.tipos.push(tipo);
      this.mesa.envidoActivo.puntosSiNoQuiere = this.mesa.envidoActivo.puntosAcumulados;
      this.mesa.envidoActivo.puntosAcumulados += puntosNuevo;
      this.mesa.envidoActivo.equipoQueCanta = jugador.equipo;
      this.mesa.envidoActivo.jugadorQueCanta = jugadorId;
    } else {
      // Primer envido
      const puntos = this.calcularPuntosEnvido(tipo);
      this.mesa.envidoActivo = {
        tipos: [tipo],
        equipoQueCanta: jugador.equipo,
        jugadorQueCanta: jugadorId,
        puntosAcumulados: puntos,
        puntosSiNoQuiere: 1, // si no quiere el primer envido, 1 punto
      };
    }

    return true;
  }

  private calcularPuntosEnvido(tipo: EnvidoTipo): number {
    if (tipo === 'envido') return 2;
    if (tipo === 'real_envido') return 3;
    if (tipo === 'falta_envido') {
      // Puntos que le faltan al equipo que va primero
      const max1 = 30 - this.mesa.equipos[0].puntaje;
      const max2 = 30 - this.mesa.equipos[1].puntaje;
      return Math.min(max1, max2);
    }
    return 0;
  }

  responderEnvido(jugadorId: string, acepta: boolean): { resultado?: EnvidoResultado } {
    if (!this.mesa.envidoActivo) return {};

    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return {};
    if (jugador.equipo === this.mesa.envidoActivo.equipoQueCanta) return {};

    this.mesa.envidoYaCantado = true;

    if (acepta) {
      // Calcular puntos de envido de cada equipo
      const resultado = this.resolverEnvido();
      const equipo = this.mesa.equipos.find(e => e.id === resultado.ganador);
      if (equipo) {
        equipo.puntaje += resultado.puntosGanados;
      }
      this.mesa.envidoActivo = null;

      // Verificar si ganó el juego
      if (equipo && equipo.puntaje >= 30) {
        this.mesa.winnerJuego = resultado.ganador;
        this.mesa.estado = 'terminado';
        this.mesa.mensajeRonda = `¡Equipo ${resultado.ganador} ganó el juego!`;
        this.mesa.fase = 'finalizada';
      }

      return { resultado };
    } else {
      // No quiere: puntos para el que cantó
      const puntos = this.mesa.envidoActivo.puntosSiNoQuiere;
      const equipoGanador = this.mesa.envidoActivo.equipoQueCanta;
      const equipo = this.mesa.equipos.find(e => e.id === equipoGanador);
      if (equipo) {
        equipo.puntaje += puntos;
      }
      this.mesa.envidoActivo = null;

      if (equipo && equipo.puntaje >= 30) {
        this.mesa.winnerJuego = equipoGanador;
        this.mesa.estado = 'terminado';
        this.mesa.mensajeRonda = `¡Equipo ${equipoGanador} ganó el juego!`;
        this.mesa.fase = 'finalizada';
      }

      return {};
    }
  }

  // Resolver envido: calcular puntos de cada equipo y determinar ganador
  private resolverEnvido(): EnvidoResultado {
    let mejorEquipo1 = 0;
    let mejorEquipo2 = 0;

    this.mesa.jugadores.forEach(jugador => {
      const puntos = this.calcularPuntosEnvidoJugador(jugador);
      if (jugador.equipo === 1 && puntos > mejorEquipo1) mejorEquipo1 = puntos;
      if (jugador.equipo === 2 && puntos > mejorEquipo2) mejorEquipo2 = puntos;
    });

    // En empate, gana el equipo que es mano
    const equipoMano = this.mesa.jugadores[this.mesa.indiceMano]?.equipo || 1;
    let ganador: number;
    if (mejorEquipo1 > mejorEquipo2) ganador = 1;
    else if (mejorEquipo2 > mejorEquipo1) ganador = 2;
    else ganador = equipoMano;

    return {
      equipo1Puntos: mejorEquipo1,
      equipo2Puntos: mejorEquipo2,
      ganador,
      puntosGanados: this.mesa.envidoActivo?.puntosAcumulados || 2,
    };
  }

  // Calcular puntos de envido de un jugador
  calcularPuntosEnvidoJugador(jugador: Jugador): number {
    const cartas = jugador.cartas;
    if (cartas.length === 0) return 0;

    // Agrupar cartas por palo
    const porPalo: Record<string, number[]> = {};
    cartas.forEach(c => {
      if (!porPalo[c.palo]) porPalo[c.palo] = [];
      // Valor para envido: 10, 11, 12 valen 0
      const valorEnvido = c.valor >= 10 ? 0 : c.valor;
      porPalo[c.palo].push(valorEnvido);
    });

    let mejorPuntaje = 0;

    // Para cada palo, si hay 2+ cartas, sumar las 2 más altas + 20
    for (const palo in porPalo) {
      const valores = porPalo[palo].sort((a, b) => b - a);
      if (valores.length >= 2) {
        const puntos = valores[0] + valores[1] + 20;
        if (puntos > mejorPuntaje) mejorPuntaje = puntos;
      }
    }

    // Si no hay 2 del mismo palo, la carta más alta (valor envido)
    if (mejorPuntaje === 0) {
      cartas.forEach(c => {
        const valorEnvido = c.valor >= 10 ? 0 : c.valor;
        if (valorEnvido > mejorPuntaje) mejorPuntaje = valorEnvido;
      });
    }

    return mejorPuntaje;
  }

  // === IRSE AL MAZO ===

  irseAlMazo(jugadorId: string): boolean {
    const jugador = this.mesa.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return false;
    if (this.mesa.estado !== 'jugando') return false;

    // El equipo del jugador se rinde, el equipo contrario gana la ronda
    const equipoContrario = jugador.equipo === 1 ? 2 : 1;
    this.finalizarRonda(equipoContrario);
    this.mesa.mensajeRonda = `Equipo ${jugador.equipo} se fue al mazo. Equipo ${equipoContrario} gana (+${this.mesa.puntosEnJuego} pts)`;

    return true;
  }

  // === GETTERS ===

  getEstado(): Mesa {
    return { ...this.mesa };
  }

  getEstadoParaJugador(jugadorId: string): Mesa {
    // Retorna el estado ocultando cartas de otros jugadores
    const estado = { ...this.mesa };
    estado.jugadores = this.mesa.jugadores.map(j => {
      if (j.id === jugadorId) {
        return { ...j, cartas: [...j.cartas] };
      }
      // Ocultar cartas de otros: enviar la cantidad pero no los datos
      return { ...j, cartas: j.cartas.map(() => ({ palo: 'basto' as const, valor: 0, poder: 0 })) };
    });
    return estado;
  }

  getJugadorActual(): Jugador | null {
    if (this.mesa.turnoActual >= this.mesa.jugadores.length) return null;
    return this.mesa.jugadores[this.mesa.turnoActual];
  }

  esTurnoDe(jugadorId: string): boolean {
    const jugadorActual = this.getJugadorActual();
    return jugadorActual?.id === jugadorId;
  }

  // Reemplazar socket id de un jugador (para reconexión)
  reemplazarJugadorId(oldId: string, newId: string): boolean {
    const jugador = this.mesa.jugadores.find(j => j.id === oldId);
    if (!jugador) return false;
    jugador.id = newId;

    // Actualizar en equipos también
    this.mesa.equipos.forEach(equipo => {
      const jEnEquipo = equipo.jugadores.find(j => j.id === oldId);
      if (jEnEquipo) jEnEquipo.id = newId;
    });

    // Actualizar cartas en mesa
    this.mesa.cartasMesa.forEach(cm => {
      if (cm.jugadorId === oldId) cm.jugadorId = newId;
    });

    return true;
  }
}
