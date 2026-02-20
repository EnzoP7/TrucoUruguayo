import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { Carta, GritoTipo, EnvidoTipo } from '@/types/truco';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnected = false;
  private navigating = false;
  private connectPromise: Promise<void> | null = null;
  private reconnectCallback: (() => void) | null = null;
  private hasConnectedOnce = false;

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
        // On automatic reconnect (not first connect), re-run the callback
        if (this.hasConnectedOnce && this.reconnectCallback) {
          console.log('[SocketService] Auto-reconnected, re-running reconnect callback');
          this.reconnectCallback();
        }
        this.hasConnectedOnce = true;
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

  // Register a callback that runs every time the socket auto-reconnects
  onAutoReconnect(callback: () => void): void {
    this.reconnectCallback = callback;
  }

  clearAutoReconnect(): void {
    this.reconnectCallback = null;
  }

  disconnect(): void {
    if (this.navigating) return;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectPromise = null;
      this.hasConnectedOnce = false;
      this.reconnectCallback = null;
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

  async crearPartida(nombre: string, tamañoSala?: '1v1' | '2v2' | '3v3', modoAlternado?: boolean, modoAyuda?: boolean): Promise<string | null> {
    if (!this.socket) return null;
    return new Promise((resolve) => {
      this.socket!.emit('crear-partida', { nombre, tamañoSala, modoAlternado, modoAyuda }, (success, mesaId) => {
        resolve(success ? mesaId || null : null);
      });
    });
  }

  // Crear partida de práctica 1v1 contra bot (no cuenta estadísticas)
  async crearPartidaPractica(nombre: string): Promise<string | null> {
    if (!this.socket) return null;
    return new Promise((resolve) => {
      this.socket!.emit('crear-partida', { nombre, tamañoSala: '1v1', esPractica: true }, (success, mesaId) => {
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

  async reconectarPartida(mesaId: string, nombre: string, userId?: number): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('reconectar-partida', { mesaId, nombre, userId }, (success) => resolve(success));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async obtenerMisPartidas(): Promise<{ success: boolean; partidas?: any[]; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.socket!.emit('obtener-mis-partidas' as any, (result: { success: boolean; partidas?: any[]; error?: string }) => resolve(result));
    });
  }

  async terminarPartida(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('terminar-partida', (success) => resolve(success));
    });
  }

  async eliminarPartida(mesaId: string, nombre: string): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('eliminar-partida', { mesaId, nombre }, (success) => resolve(success));
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

  async responderTruco(acepta: boolean, escalar?: string): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('responder-truco', { acepta, escalar: escalar || null }, (success) => resolve(success));
    });
  }

  async cantarEnvido(tipo: EnvidoTipo, puntosCustom?: number): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cantar-envido', { tipo, puntosCustom }, (success) => resolve(success));
    });
  }

  async cantarEnvidoCargado(puntos: number): Promise<boolean> {
    return this.cantarEnvido('envido_cargado' as EnvidoTipo, puntos);
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

  async realizarCorte(posicion: number): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('realizar-corte', { posicion }, (success) => resolve(success));
    });
  }

  async declararEnvido(sonBuenas: boolean = false): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('declarar-envido', { puntos: 0, sonBuenas }, (success) => resolve(success));
    });
  }

  async toggleAyuda(modoAyuda: boolean): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('toggle-ayuda', { modoAyuda }, (success) => resolve(success));
    });
  }

  async cantarFlor(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cantar-flor', (success) => resolve(success));
    });
  }

  async responderFlor(tipoRespuesta: 'quiero' | 'no_quiero' | 'contra_flor' | 'con_flor_envido'): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('responder-flor', { tipoRespuesta }, (success) => resolve(success));
    });
  }

  async cambiarEquipo(jugadorId: string, nuevoEquipo: number): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cambiar-equipo', { jugadorId, nuevoEquipo }, (success) => resolve(success));
    });
  }

  async tirarReyes(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('tirar-reyes', (success) => resolve(success));
    });
  }

  async configurarPuntos(puntosLimite: number): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('configurar-puntos', { puntosLimite }, (success) => resolve(success));
    });
  }

  async revancha(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('revancha', (success) => resolve(success));
    });
  }

  // === CHAT ===

  async enviarMensaje(mensaje: string, tipo: 'general' | 'equipo'): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('enviar-mensaje', { mensaje, tipo }, (success: boolean) => resolve(success));
    });
  }

  onMensajeRecibido(callback: (data: { jugadorId: string; jugadorNombre: string; equipo: number; mensaje: string; tipo: 'general' | 'equipo'; timestamp: number }) => void): void {
    this.socket?.on('mensaje-recibido', callback);
  }

  // === AUTH ===

  /* eslint-disable @typescript-eslint/no-explicit-any */
  async registrar(apodo: string, password: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('registrar' as any, { apodo, password }, (result: any) => resolve(result));
    });
  }

  async login(apodo: string, password: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('login' as any, { apodo, password }, (result: any) => resolve(result));
    });
  }

  async loginConGoogle(googleId: string, email: string, nombre: string, avatarUrl?: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('login-google' as any, { googleId, email, nombre, avatarUrl }, (result: any) => resolve(result));
    });
  }

  async vincularGoogle(googleId: string, email: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('vincular-google' as any, { googleId, email }, (result: any) => resolve(result));
    });
  }

  async agregarPasswordACuenta(password: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('agregar-password' as any, { password }, (result: any) => resolve(result));
    });
  }

  async obtenerPerfil(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-perfil' as any, (result: any) => resolve(result));
    });
  }

  async obtenerRanking(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-ranking' as any, (result: any) => resolve(result));
    });
  }

  async obtenerAmigos(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-amigos' as any, (result: any) => resolve(result));
    });
  }

  async buscarUsuarios(termino: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('buscar-usuarios' as any, { termino }, (result: any) => resolve(result));
    });
  }

  async agregarAmigo(amigoId: number): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('agregar-amigo' as any, { amigoId }, (result: any) => resolve(result));
    });
  }

  async eliminarAmigo(amigoId: number): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('eliminar-amigo' as any, { amigoId }, (result: any) => resolve(result));
    });
  }

  async invitarAmigo(amigoId: number, mesaId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('invitar-amigo' as any, { amigoId, mesaId }, (result: any) => resolve(result));
    });
  }

  onInvitacionRecibida(callback: (data: { de: string; deUserId: number; mesaId: string; tamañoSala: string }) => void): void {
    this.socket?.on('invitacion-recibida' as any, callback);
  }

  // === PREMIUM ===

  async togglePremium(): Promise<{ success: boolean; es_premium?: boolean; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('toggle-premium' as any, (result: any) => resolve(result));
    });
  }

  async eliminarAudioCustom(audioId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('eliminar-audio-custom' as any, { audioId }, (result: any) => resolve(result));
    });
  }

  async actualizarPersonalizacion(temaMesa: string, reversoCartas: string): Promise<{ success: boolean; temaMesa?: string; reversoCartas?: string; error?: string }> {
    console.log('[Socket] actualizarPersonalizacion:', { temaMesa, reversoCartas, connected: this.socket?.connected, socketId: this.socket?.id });
    if (!this.socket) {
      console.log('[Socket] No hay socket!');
      return { success: false, error: 'Sin conexión' };
    }
    if (!this.socket.connected) {
      console.log('[Socket] Socket no está conectado!');
      return { success: false, error: 'Socket desconectado' };
    }
    return new Promise((resolve) => {
      this.socket!.emit('actualizar-personalizacion' as any, { temaMesa, reversoCartas }, (result: any) => {
        console.log('[Socket] Respuesta de actualizar-personalizacion:', result);
        resolve(result);
      });
    });
  }

  async obtenerPersonalizacion(): Promise<{ success: boolean; tema_mesa?: string; reverso_cartas?: string; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-personalizacion' as any, (result: any) => resolve(result));
    });
  }

  // === LOGROS Y PROGRESIÓN ===

  async obtenerLogros(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-logros' as any, (result: any) => resolve(result));
    });
  }

  async obtenerEstadisticasDetalladas(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-estadisticas-detalladas' as any, (result: any) => resolve(result));
    });
  }

  // === COSMÉTICOS ===

  async obtenerCosmeticos(): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('obtener-cosmeticos' as any, (result: any) => resolve(result));
    });
  }

  async comprarCosmetico(cosmeticoId: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('comprar-cosmetico' as any, { cosmeticoId }, (result: any) => resolve(result));
    });
  }

  async equiparCosmetico(cosmeticoId: string): Promise<any> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('equipar-cosmetico' as any, { cosmeticoId }, (result: any) => resolve(result));
    });
  }

  onLogrosDesbloqueados(callback: (data: any) => void): void {
    this.socket?.on('logros-desbloqueados' as any, callback);
  }

  // === BOTS ===
  async agregarBot(dificultad: 'facil' | 'medio' | 'dificil' = 'medio', equipo?: 1 | 2): Promise<{ success: boolean; botNombre?: string; dificultad?: string; equipo?: number; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('agregar-bot' as any, { dificultad, equipo }, (result: any) => resolve(result));
    });
  }

  async quitarBot(botId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.socket) return { success: false, error: 'Sin conexión' };
    return new Promise((resolve) => {
      this.socket!.emit('quitar-bot' as any, { botId }, (result: any) => resolve(result));
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // === SOLICITAR ESTADO ===

  async solicitarEstado(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('solicitar-estado', (success: boolean) => resolve(success));
    });
  }

  // === ECHAR LOS PERROS ===

  async echarPerros(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('echar-perros', {}, (success) => resolve(success));
    });
  }

  async cancelarPerros(): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('cancelar-perros', (success) => resolve(success));
    });
  }

  async responderPerros(quiereContraFlor: boolean, quiereFaltaEnvido: boolean, quiereTruco: boolean): Promise<boolean> {
    if (!this.socket) return false;
    return new Promise((resolve) => {
      this.socket!.emit('responder-perros', { quiereContraFlor, quiereFaltaEnvido, quiereTruco }, (success) => resolve(success));
    });
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // === EVENT LISTENERS ===
  // Event data types are dynamic from server, using any for flexibility

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

  onAnfitrionDesconectado(callback: (data: { nombre: string }) => void): void {
    this.socket?.on('anfitrion-desconectado', callback);
  }

  onJugadorDesconectado(callback: (data: { nombre: string; esAnfitrion: boolean; jugadorId: string }) => void): void {
    this.socket?.on('jugador-desconectado', callback);
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

  onTrucoRespuestaParcial(callback: (data: any) => void): void {
    this.socket?.on('truco-respuesta-parcial', callback);
  }

  onEnvidoCantado(callback: (data: any) => void): void {
    this.socket?.on('envido-cantado', callback);
  }

  onEnvidoRespondido(callback: (data: any) => void): void {
    this.socket?.on('envido-respondido', callback);
  }

  onEnvidoRespuestaParcial(callback: (data: any) => void): void {
    this.socket?.on('envido-respuesta-parcial', callback);
  }

  onManoFinalizada(callback: (data: any) => void): void {
    this.socket?.on('mano-finalizada', callback);
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

  onCorteSolicitado(callback: (data: any) => void): void {
    this.socket?.on('corte-solicitado', callback);
  }

  onCorteRealizado(callback: (data: any) => void): void {
    this.socket?.on('corte-realizado', callback);
  }

  onCartaRepartida(callback: (data: any) => void): void {
    this.socket?.on('carta-repartida', callback);
  }

  onEnvidoDeclarado(callback: (data: any) => void): void {
    this.socket?.on('envido-declarado', callback);
  }

  onEnvidoResuelto(callback: (data: any) => void): void {
    this.socket?.on('envido-resuelto', callback);
  }

  onFlorCantada(callback: (data: any) => void): void {
    this.socket?.on('flor-cantada', callback);
  }

  onFlorResuelta(callback: (data: any) => void): void {
    this.socket?.on('flor-resuelta', callback);
  }

  onFlorPendiente(callback: (data: { equipoQueCanta: number; equipoQueResponde: number; estado: any }) => void): void {
    this.socket?.on('flor-pendiente', callback);
  }

  onTirarReyesResultado(callback: (data: any) => void): void {
    this.socket?.on('tirar-reyes-resultado', callback);
  }

  onPerrosEchados(callback: (data: any) => void): void {
    this.socket?.on('perros-echados', callback);
  }

  onPerrosCancelados(callback: (data: any) => void): void {
    this.socket?.on('perros-cancelados', callback);
  }

  onPerrosRespondidos(callback: (data: any) => void): void {
    this.socket?.on('perros-respondidos', callback);
  }

  onPerrosPendientes(callback: (data: any) => void): void {
    this.socket?.on('perros-pendientes', callback);
  }

  onPartidaEliminada(callback: (data: any) => void): void {
    this.socket?.on('partida-eliminada', callback);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  off(event: keyof ServerToClientEvents): void {
    this.socket?.off(event);
  }

  removeAllListeners(): void {
    const events: (keyof ServerToClientEvents)[] = [
      'partidas-disponibles', 'partida-nueva', 'partida-creada',
      'unido-partida', 'jugador-unido', 'partida-iniciada', 'reconectado',
      'estado-actualizado', 'carta-jugada', 'mano-finalizada',
      'ronda-finalizada', 'juego-finalizado',
      'truco-cantado', 'truco-respondido', 'truco-respuesta-parcial',
      'envido-cantado', 'envido-respondido', 'envido-respuesta-parcial', 'jugador-al-mazo',
      'corte-solicitado', 'corte-realizado', 'carta-repartida',
      'envido-declarado', 'envido-resuelto',
      'flor-cantada', 'flor-resuelta',
      'tirar-reyes-resultado',
      'perros-echados', 'perros-cancelados', 'perros-respondidos',
      'mensaje-recibido'
    ];
    events.forEach(e => this.socket?.off(e));
  }
}

const socketService = new SocketService();
export default socketService;
