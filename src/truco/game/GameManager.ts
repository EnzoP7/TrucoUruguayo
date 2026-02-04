import { TrucoEngine } from '../engine/TrucoEngine';
import { Mesa, Jugador } from '@/types/truco';

// Gestor de partidas que maneja múltiples juegos simultáneos
export class GameManager {
  private partidas: Map<string, TrucoEngine> = new Map();
  private jugadoresEnPartida: Map<string, string> = new Map(); // playerId -> gameId
  private tamañosSala: Map<string, '1v1' | '2v2' | '3v3'> = new Map(); // mesaId -> tamaño

  // Crear nueva partida
  crearPartida(mesaId: string, jugadores: Jugador[], tamañoSala: '1v1' | '2v2' | '3v3' = '2v2'): TrucoEngine {
    if (this.partidas.has(mesaId)) {
      throw new Error(`La partida ${mesaId} ya existe`);
    }

    const engine = new TrucoEngine(mesaId, jugadores);
    this.partidas.set(mesaId, engine);
    this.tamañosSala.set(mesaId, tamañoSala);

    // Registrar jugadores en la partida
    jugadores.forEach((jugador: Jugador) => {
      this.jugadoresEnPartida.set(jugador.id, mesaId);
    });

    return engine;
  }

  // Obtener tamaño de sala
  getTamañoSala(mesaId: string): '1v1' | '2v2' | '3v3' {
    return this.tamañosSala.get(mesaId) || '2v2';
  }

  // Obtener número máximo de jugadores para un tamaño de sala
  getMaxJugadores(mesaId: string): number {
    const tamaño = this.getTamañoSala(mesaId);
    switch (tamaño) {
      case '1v1': return 2;
      case '2v2': return 4;
      case '3v3': return 6;
      default: return 6;
    }
  }

  // Obtener partida por ID
  getPartida(mesaId: string): TrucoEngine | null {
    return this.partidas.get(mesaId) || null;
  }

  // Obtener partida de un jugador
  getPartidaDeJugador(jugadorId: string): TrucoEngine | null {
    const mesaId = this.jugadoresEnPartida.get(jugadorId);
    return mesaId ? this.getPartida(mesaId) : null;
  }

  // Eliminar partida
  eliminarPartida(mesaId: string): void {
    const engine = this.partidas.get(mesaId);
    if (engine) {
      // Desregistrar jugadores
      const estado = engine.getEstado();
      estado.jugadores.forEach(jugador => {
        this.jugadoresEnPartida.delete(jugador.id);
      });
      
      this.partidas.delete(mesaId);
    }
  }

  // Obtener todas las partidas activas
  getPartidasActivas(): Array<{ mesaId: string; engine: TrucoEngine }> {
    return Array.from(this.partidas.entries()).map(([mesaId, engine]) => ({
      mesaId,
      engine
    }));
  }

  // Registrar jugador manualmente (para unirse después de crear)
  registrarJugador(jugadorId: string, mesaId: string): void {
    this.jugadoresEnPartida.set(jugadorId, mesaId);
  }

  // Verificar si un jugador está en partida
  jugadorEnPartida(jugadorId: string): boolean {
    return this.jugadoresEnPartida.has(jugadorId);
  }

  // Remover jugador de su partida
  removerJugador(jugadorId: string): void {
    const mesaId = this.jugadoresEnPartida.get(jugadorId);
    if (mesaId) {
      this.jugadoresEnPartida.delete(jugadorId);
      
      // Si la partida queda sin jugadores, eliminarla
      const engine = this.partidas.get(mesaId);
      if (engine) {
        const estado = engine.getEstado();
      const jugadoresRestantes = estado.jugadores.filter((j: Jugador) => 
        this.jugadoresEnPartida.has(j.id)
      );
        
        if (jugadoresRestantes.length === 0) {
          this.partidas.delete(mesaId);
        }
      }
    }
  }
}