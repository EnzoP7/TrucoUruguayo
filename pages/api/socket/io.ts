import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO } from 'socket.io';
import { GameManager } from '@/truco/game/GameManager';
import { Jugador, Carta, GritoTipo, EnvidoTipo } from '@/types/truco';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Instancia global del game manager
const gameManager = new GameManager();

// Mapeo nombre -> mesaId para reconexión
const jugadorNombreAMesa: Map<string, { mesaId: string; nombre: string }> = new Map();

// Timers de desconexión pendiente (para cancelar si reconecta)
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

const SocketHandler = (req: NextApiRequest, res: NextApiResponse & { socket: any }) => {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  console.log('Setting up Socket.IO server...');
  const httpServer: NetServer = res.socket.server as any;
  const io = new ServerIO(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Helper: enviar estado a todos los jugadores de una partida (cada uno ve solo sus cartas)
    const emitirEstadoATodos = (mesaId: string, engine: any, evento: string, extraData?: any) => {
      const estado = engine.getEstado();
      estado.jugadores.forEach((j: Jugador) => {
        const estadoParaJugador = engine.getEstadoParaJugador(j.id);
        const data = extraData ? { ...extraData, estado: estadoParaJugador } : estadoParaJugador;
        io.to(j.id).emit(evento, data);
      });
    };

    // Helper: emitir estado actualizado a todos
    const actualizarEstado = (engine: any) => {
      const estado = engine.getEstado();
      estado.jugadores.forEach((j: Jugador) => {
        const estadoParaJugador = engine.getEstadoParaJugador(j.id);
        io.to(j.id).emit('estado-actualizado', estadoParaJugador);
      });
    };

    // Auto-iniciar siguiente ronda después de un delay
    const autoSiguienteRonda = (engine: any, mesaId: string) => {
      const estado = engine.getEstado();
      if (estado.estado === 'terminado') return;

      setTimeout(() => {
        engine.iniciarSiguienteRonda();
        const nuevoEstado = engine.getEstado();
        nuevoEstado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = engine.getEstadoParaJugador(j.id);
          io.to(j.id).emit('partida-iniciada', estadoParaJugador);
        });
      }, 3000);
    };

    // === LOBBY ===

    socket.on('join-lobby', (callback: (success: boolean, message?: string) => void) => {
      try {
        socket.join('lobby');
        callback(true, 'Joined lobby successfully');

        const partidas = gameManager.getPartidasActivas();
        socket.emit('partidas-disponibles', partidas.map(p => ({
          mesaId: p.mesaId,
          jugadores: p.engine.getEstado().jugadores.length,
          estado: p.engine.getEstado().estado
        })));
      } catch (error) {
        callback(false, 'Failed to join lobby');
      }
    });

    // === CREAR PARTIDA ===

    socket.on('crear-partida', (data: { nombre: string; tamañoSala?: '1v1' | '2v2' | '3v3' }, callback: (success: boolean, mesaId?: string) => void) => {
      try {
        const mesaId = `mesa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const jugador: Jugador = {
          id: socket.id,
          nombre: data.nombre || `Player_${socket.id.substr(0, 4)}`,
          equipo: 1,
          cartas: []
        };

        // Guardar información del tamaño de sala en el GameManager
        gameManager.crearPartida(mesaId, [jugador], data.tamañoSala || '2v2');

        // Guardar mapeo para reconexión
        jugadorNombreAMesa.set(`${data.nombre}_${mesaId}`, { mesaId, nombre: data.nombre });

        socket.join(mesaId);
        socket.emit('partida-creada', { mesaId, jugador });
        callback(true, mesaId);

        io.to('lobby').emit('partida-nueva', {
          mesaId,
          jugadores: 1,
          maxJugadores: gameManager.getMaxJugadores(mesaId),
          tamañoSala: data.tamañoSala || '2v2',
          estado: 'esperando'
        });
      } catch (error) {
        callback(false);
      }
    });

    // === UNIRSE A PARTIDA ===

    socket.on('unirse-partida', (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => {
      try {
        const engine = gameManager.getPartida(data.mesaId);
        if (!engine) {
          callback(false, 'Partida no encontrada');
          return;
        }

        const estado = engine.getEstado();
        const maxJugadores = gameManager.getMaxJugadores(data.mesaId);
        if (estado.jugadores.length >= maxJugadores) {
          callback(false, `Partida llena (${maxJugadores} jugadores máximo)`);
          return;
        }

        if (estado.estado !== 'esperando') {
          callback(false, 'Partida ya iniciada');
          return;
        }

        const nuevoJugador: Jugador = {
          id: socket.id,
          nombre: data.nombre,
          equipo: 0,
          cartas: []
        };

        estado.jugadores.push(nuevoJugador);
        gameManager.registrarJugador(socket.id, data.mesaId);

        // Guardar mapeo para reconexión
        jugadorNombreAMesa.set(`${data.nombre}_${data.mesaId}`, { mesaId: data.mesaId, nombre: data.nombre });

        socket.join(data.mesaId);
        socket.emit('unido-partida', { mesaId: data.mesaId, jugador: nuevoJugador, estado });

        io.to(data.mesaId).emit('jugador-unido', {
          jugador: nuevoJugador,
          totalJugadores: estado.jugadores.length
        });

        callback(true, 'Unido a la partida');
      } catch (error) {
        callback(false, 'Error al unirse a la partida');
      }
    });

    // === RECONECTAR A PARTIDA (después de navegación) ===

    socket.on('reconectar-partida', (data: { mesaId: string; nombre: string }, callback: (success: boolean, message?: string) => void) => {
      try {
        const engine = gameManager.getPartida(data.mesaId);
        if (!engine) {
          callback(false, 'Partida no encontrada');
          return;
        }

        const estado = engine.getEstado();
        // Buscar jugador por nombre
        const jugadorExistente = estado.jugadores.find(j => j.nombre === data.nombre);

        if (jugadorExistente) {
          // Cancelar timer de desconexión del socket viejo
          const oldId = jugadorExistente.id;
          const pendingTimer = disconnectTimers.get(oldId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            disconnectTimers.delete(oldId);
          }

          // Reemplazar el socket id viejo por el nuevo
          engine.reemplazarJugadorId(oldId, socket.id);
          gameManager.registrarJugador(socket.id, data.mesaId);
          gameManager.removerJugador(oldId);

          socket.join(data.mesaId);
          const estadoParaJugador = engine.getEstadoParaJugador(socket.id);
          socket.emit('reconectado', { jugador: { ...jugadorExistente, id: socket.id }, estado: estadoParaJugador });
          callback(true, 'Reconectado');
        } else if (estado.estado === 'esperando') {
          // Es nuevo jugador uniéndose
          const nuevoJugador: Jugador = {
            id: socket.id,
            nombre: data.nombre,
            equipo: 0,
            cartas: []
          };
          estado.jugadores.push(nuevoJugador);
          gameManager.registrarJugador(socket.id, data.mesaId);

          socket.join(data.mesaId);
          socket.emit('unido-partida', { mesaId: data.mesaId, jugador: nuevoJugador, estado });
          callback(true, 'Unido a la partida');
        } else {
          callback(false, 'No se puede reconectar');
        }
      } catch (error) {
        callback(false, 'Error al reconectar');
      }
    });

    // === INICIAR PARTIDA ===

    socket.on('iniciar-partida', (callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const estado = partida.getEstado();
        if (estado.jugadores.length < 2) {
          callback(false, 'Se necesitan al menos 2 jugadores');
          return;
        }

        if (estado.jugadores[0].id !== socket.id) {
          callback(false, 'Solo el anfitrión puede iniciar la partida');
          return;
        }

        partida.iniciarRonda();

        // Enviar a cada jugador su propio estado (con sus cartas visibles)
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('partida-iniciada', estadoParaJugador);
        });

        callback(true, 'Partida iniciada');
      } catch (error) {
        callback(false, 'Error al iniciar partida');
      }
    });

    // === JUGAR CARTA ===

    socket.on('jugar-carta', (data: { carta: Carta }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        if (!partida.esTurnoDe(socket.id)) {
          callback(false, 'No es tu turno');
          return;
        }

        const success = partida.jugarCarta(socket.id, data.carta);
        if (!success) {
          callback(false, 'No se pudo jugar la carta');
          return;
        }

        const estado = partida.getEstado();

        // Enviar carta jugada a todos
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('carta-jugada', {
            jugadorId: socket.id,
            carta: data.carta,
            estado: estadoParaJugador
          });
        });

        // Si la ronda terminó, notificar y auto-iniciar siguiente
        if (estado.fase === 'finalizada') {
          estado.jugadores.forEach((j: Jugador) => {
            const estadoParaJugador = partida.getEstadoParaJugador(j.id);
            if (estado.winnerJuego) {
              io.to(j.id).emit('juego-finalizado', {
                ganadorEquipo: estado.winnerJuego,
                estado: estadoParaJugador
              });
            } else {
              io.to(j.id).emit('ronda-finalizada', {
                ganadorEquipo: estado.winnerRonda!,
                puntosGanados: estado.puntosEnJuego,
                estado: estadoParaJugador
              });
            }
          });

          if (!estado.winnerJuego) {
            autoSiguienteRonda(partida, estado.id);
          }
        }

        callback(true, 'Carta jugada');
      } catch (error) {
        callback(false, 'Error al jugar carta');
      }
    });

    // === CANTAR TRUCO ===

    socket.on('cantar-truco', (data: { tipo: GritoTipo }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const success = partida.cantarTruco(socket.id, data.tipo);
        if (!success) {
          callback(false, 'No se puede cantar truco ahora');
          return;
        }

        const estado = partida.getEstado();
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('truco-cantado', {
            jugadorId: socket.id,
            tipo: data.tipo,
            estado: estadoParaJugador
          });
        });

        callback(true);
      } catch (error) {
        callback(false, 'Error al cantar truco');
      }
    });

    // === RESPONDER TRUCO ===

    socket.on('responder-truco', (data: { acepta: boolean }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const success = partida.responderTruco(socket.id, data.acepta);
        if (!success) {
          callback(false, 'No se puede responder ahora');
          return;
        }

        const estado = partida.getEstado();
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('truco-respondido', {
            jugadorId: socket.id,
            acepta: data.acepta,
            estado: estadoParaJugador
          });
        });

        // Si no quiso y la ronda terminó
        if (estado.fase === 'finalizada') {
          estado.jugadores.forEach((j: Jugador) => {
            const estadoParaJugador = partida.getEstadoParaJugador(j.id);
            if (estado.winnerJuego) {
              io.to(j.id).emit('juego-finalizado', {
                ganadorEquipo: estado.winnerJuego,
                estado: estadoParaJugador
              });
            } else {
              io.to(j.id).emit('ronda-finalizada', {
                ganadorEquipo: estado.winnerRonda!,
                puntosGanados: estado.puntosEnJuego,
                estado: estadoParaJugador
              });
            }
          });

          if (!estado.winnerJuego) {
            autoSiguienteRonda(partida, estado.id);
          }
        }

        callback(true);
      } catch (error) {
        callback(false, 'Error al responder');
      }
    });

    // === CANTAR ENVIDO ===

    socket.on('cantar-envido', (data: { tipo: EnvidoTipo }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const success = partida.cantarEnvido(socket.id, data.tipo);
        if (!success) {
          callback(false, 'No se puede cantar envido ahora');
          return;
        }

        const estado = partida.getEstado();
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('envido-cantado', {
            jugadorId: socket.id,
            tipo: data.tipo,
            estado: estadoParaJugador
          });
        });

        callback(true);
      } catch (error) {
        callback(false, 'Error al cantar envido');
      }
    });

    // === RESPONDER ENVIDO ===

    socket.on('responder-envido', (data: { acepta: boolean }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const { resultado } = partida.responderEnvido(socket.id, data.acepta);

        const estado = partida.getEstado();
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('envido-respondido', {
            jugadorId: socket.id,
            acepta: data.acepta,
            resultado,
            estado: estadoParaJugador
          });
        });

        // Si el envido terminó el juego
        if (estado.winnerJuego) {
          estado.jugadores.forEach((j: Jugador) => {
            const estadoParaJugador = partida.getEstadoParaJugador(j.id);
            io.to(j.id).emit('juego-finalizado', {
              ganadorEquipo: estado.winnerJuego!,
              estado: estadoParaJugador
            });
          });
        }

        callback(true);
      } catch (error) {
        callback(false, 'Error al responder envido');
      }
    });

    // === IRSE AL MAZO ===

    socket.on('irse-al-mazo', (callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const jugador = partida.getEstado().jugadores.find(j => j.id === socket.id);
        const success = partida.irseAlMazo(socket.id);
        if (!success) {
          callback(false, 'No se puede ir al mazo ahora');
          return;
        }

        const estado = partida.getEstado();
        estado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('jugador-al-mazo', {
            jugadorId: socket.id,
            equipoQueSeVa: jugador?.equipo || 0,
            estado: estadoParaJugador
          });

          if (estado.winnerJuego) {
            io.to(j.id).emit('juego-finalizado', {
              ganadorEquipo: estado.winnerJuego!,
              estado: estadoParaJugador
            });
          } else {
            io.to(j.id).emit('ronda-finalizada', {
              ganadorEquipo: estado.winnerRonda!,
              puntosGanados: estado.puntosEnJuego,
              estado: estadoParaJugador
            });
          }
        });

        if (!estado.winnerJuego) {
          autoSiguienteRonda(partida, estado.id);
        }

        callback(true);
      } catch (error) {
        callback(false, 'Error al irse al mazo');
      }
    });

    // === REALIZAR CORTE ===

    socket.on('realizar-corte', (data: { posicion: number }, callback: (success: boolean, message?: string) => void) => {
      try {
        const partida = gameManager.getPartidaDeJugador(socket.id);
        if (!partida) {
          callback(false, 'No estás en ninguna partida');
          return;
        }

        const estado = partida.getEstado();
        if (!estado.esperandoCorte) {
          callback(false, 'No se está esperando un corte');
          return;
        }

        if (estado.jugadores[estado.indiceJugadorCorta]?.id !== socket.id) {
          callback(false, 'No te toca cortar');
          return;
        }

        const success = partida.realizarCorte(socket.id, data.posicion);
        if (!success) {
          callback(false, 'No se pudo realizar el corte');
          return;
        }

        const nuevoEstado = partida.getEstado();
        
        // Notificar a todos que el corte fue realizado
        nuevoEstado.jugadores.forEach((j: Jugador) => {
          const estadoParaJugador = partida.getEstadoParaJugador(j.id);
          io.to(j.id).emit('corte-realizado', {
            jugadorId: socket.id,
            posicion: data.posicion,
            estado: estadoParaJugador
          });
        });

        callback(true, 'Corte realizado');
      } catch (error) {
        callback(false, 'Error al realizar corte');
      }
    });

    // === DESCONEXIÓN ===

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      const disconnectedId = socket.id;

      // Dar 5 segundos para reconectar (navegación lobby->game)
      const timer = setTimeout(() => {
        disconnectTimers.delete(disconnectedId);
        const partida = gameManager.getPartidaDeJugador(disconnectedId);
        if (partida) {
          const estado = partida.getEstado();
          if (estado.estado === 'esperando') {
            gameManager.removerJugador(disconnectedId);
          }
        }

        const partidas = gameManager.getPartidasActivas();
        io.to('lobby').emit('partidas-disponibles', partidas.map(p => ({
          mesaId: p.mesaId,
          jugadores: p.engine.getEstado().jugadores.length,
          maxJugadores: gameManager.getMaxJugadores(p.mesaId),
          tamañoSala: gameManager.getTamañoSala(p.mesaId),
          estado: p.engine.getEstado().estado
        })));
      }, 5000);

      disconnectTimers.set(disconnectedId, timer);
    });
  });

  res.socket.server.io = io;
  res.end();
};

export default SocketHandler;
