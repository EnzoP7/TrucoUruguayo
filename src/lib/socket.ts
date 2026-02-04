import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { Carta, GritoTipo, EnvidoTipo } from '@/types/truco';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnected = false;
  private navigating = false;
  private connectPromise: Promise<void> | null = null;

  connect(): Promise<void> {
    // If already connected, resolve immediately
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    // If there's a pending connection, return that promise
    if (this.connectPromise && this.socket) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      // If socket exists but disconnected, reconnect it
      if (this.socket) {
        this.socket.connect();
        const onConnect = () => {
          this.isConnected = true;
          this.socket?.off('connect', onConnect);
          this.socket?.off('connect_error', onError);
          this.connectPromise = null;
          resolve();
        };
        const onError = (error: Error) => {
          this.socket?.off('connect', onConnect);
          this.socket?.off('connect_error', onError);
          this.connectPromise = null;
          reject(error);
        };
        this.socket.on('connect', onConnect);
        this.socket.on('connect_error', onError);
        return;
      }

      // Create new socket
      this.socket = io({
        path: '/api/socket/io',
        addTrailingSlash: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.connectPromise = null;
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        this.connectPromise = null;
        reject(error);
      });
    });

    return this.connectPromise;
  }

  disconnect(): void {
    if (this.navigating) return;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectPromise = null;
    }
  }

  setNavigating(value: boolean): void {
    this.navigating = value;
  }

  connected(): boolean {
    return this.isConnected && (this.socket?.connected || false);
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  // === LOBBY ===

  async joinLobby(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('join-lobby', (success) => resolve(success));
    });
  }

  async crearPartida(nombre: string, tamañoSala?: '1v1' | '2v2' | '3v3'): Promise<string | null> {
    if (!this.socket) return null;
    return new Promise((resolve) => {
      this.socket!.emit('crear-partida', { nombre, tamañoSala }, (success, mesaId) => {
        resolve(success ? mesaId || null : null);
      });
    });
  }

  async unirsePartida(mesaId: string, nombre: string): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('unirse-partida', { mesaId, nombre }, (success) => resolve(success));
    });
  }

  async reconectarPartida(mesaId: string, nombre: string): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('reconectar-partida', { mesaId, nombre }, (success) => resolve(success));
    });
  }

  // === JUEGO ===

  async iniciarPartida(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('iniciar-partida', (success) => resolve(success));
    });
  }

  async jugarCarta(carta: Carta): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('jugar-carta', { carta }, (success) => resolve(success));
    });
  }

  async cantarTruco(tipo: GritoTipo): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cantar-truco', { tipo }, (success) => resolve(success));
    });
  }

  async responderTruco(acepta: boolean): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('responder-truco', { acepta }, (success) => resolve(success));
    });
  }

  async cantarEnvido(tipo: EnvidoTipo): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cantar-envido', { tipo }, (success) => resolve(success));
    });
  }

  async responderEnvido(acepta: boolean): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('responder-envido', { acepta }, (success) => resolve(success));
    });
  }

  async irseAlMazo(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('irse-al-mazo', (success) => resolve(success));
    });
  }

  // === EVENT LISTENERS ===

  onPartidasDisponibles(callback: (partidas: any[]) => void): void {
    this.socket?.on('partidas-disponibles', callback);
  }

  onPartidaCreada(callback: (data: any) => void): void {
    this.socket?.on('partida-creada', callback);
  }

  onUnidoPartida(callback: (data: any) => void): void {
    this.socket?.on('unido-partida', callback);
  }

  onJugadorUnido(callback: (data: any) => void): void {
    this.socket?.on('jugador-unido', callback);
  }

  onPartidaNueva(callback: (data: any) => void): void {
    this.socket?.on('partida-nueva', callback);
  }

  onPartidaIniciada(callback: (estado: any) => void): void {
    this.socket?.on('partida-iniciada', callback);
  }

  onReconectado(callback: (data: any) => void): void {
    this.socket?.on('reconectado', callback);
  }

  onEstadoActualizado(callback: (estado: any) => void): void {
    this.socket?.on('estado-actualizado', callback);
  }

  onCartaJugada(callback: (data: any) => void): void {
    this.socket?.on('carta-jugada', callback);
  }

  onTrucoCantado(callback: (data: any) => void): void {
    this.socket?.on('truco-cantado', callback);
  }

  onTrucoRespondido(callback: (data: any) => void): void {
    this.socket?.on('truco-respondido', callback);
  }

  onEnvidoCantado(callback: (data: any) => void): void {
    this.socket?.on('envido-cantado', callback);
  }

  onEnvidoRespondido(callback: (data: any) => void): void {
    this.socket?.on('envido-respondido', callback);
  }

  onRondaFinalizada(callback: (data: any) => void): void {
    this.socket?.on('ronda-finalizada', callback);
  }

  onJuegoFinalizado(callback: (data: any) => void): void {
    this.socket?.on('juego-finalizado', callback);
  }

  onJugadorAlMazo(callback: (data: any) => void): void {
    this.socket?.on('jugador-al-mazo', callback);
  }

  off(event: keyof ServerToClientEvents): void {
    this.socket?.off(event);
  }

  removeAllListeners(): void {
    const events: (keyof ServerToClientEvents)[] = [
      'partidas-disponibles', 'partida-nueva', 'partida-creada',
      'unido-partida', 'jugador-unido', 'partida-iniciada', 'reconectado',
      'estado-actualizado', 'carta-jugada',
      'ronda-finalizada', 'juego-finalizado',
      'truco-cantado', 'truco-respondido',
      'envido-cantado', 'envido-respondido', 'jugador-al-mazo'
    ];
    events.forEach(e => this.socket?.off(e));
  }
}

const socketService = new SocketService();
export default socketService;
