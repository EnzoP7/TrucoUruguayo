'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import socketService from '@/lib/socket';
import audioManager from '@/lib/audioManager';

interface Partida {
  mesaId: string;
  jugadores: number;
  maxJugadores: number;
  tamañoSala: '1v1' | '2v2' | '3v3';
  estado: string;
  creadorNombre?: string;
  jugadoresNombres?: string[];
}

// Icono de basura/eliminar
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// Icono de reconexión
function ReconnectIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// Icono de usuarios
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  );
}

// Icono de mesa/cartas
function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

// Icono de flecha
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

interface Usuario {
  id: number;
  apodo: string;
  avatar_url?: string | null;
}

interface MiPartida {
  mesaId: string;
  estado: 'esperando' | 'jugando';
  tamañoSala: '1v1' | '2v2' | '3v3';
  jugadores: string[];
  jugadoresCount: number;
  maxJugadores: number;
  puntaje?: { equipo1: number; equipo2: number; limite: number };
  miEquipo?: number;
}

function LobbyPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [nombre, setNombre] = useState('');
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tamañoSala, setTamañoSala] = useState<'1v1' | '2v2' | '3v3'>('2v2');
  const [modoAlternado, setModoAlternado] = useState(true);
  const [partidaGuardada, setPartidaGuardada] = useState<string | null>(null);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);

  // Auth state
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [misPartidas, setMisPartidas] = useState<MiPartida[]>([]);

  // Invite state
  const [inviteModalMesaId, setInviteModalMesaId] = useState<string | null>(null);
  const [amigosOnline, setAmigosOnline] = useState<{ id: number; apodo: string; online: boolean }[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState<Set<number>>(new Set());
  const [invitacion, setInvitacion] = useState<{ de: string; mesaId: string; tamañoSala: string } | null>(null);
  const [notificacionesPermitidas, setNotificacionesPermitidas] = useState<boolean | null>(null);

  useEffect(() => {
    // Restaurar sesión guardada
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    if (savedUsuario) {
      try {
        const u = JSON.parse(savedUsuario);
        setUsuario(u);
        setNombre(u.apodo);
      } catch { /* ignorar */ }
    } else {
      const savedNombre = sessionStorage.getItem('truco_nombre');
      if (savedNombre) setNombre(savedNombre);
    }

    const savedMesaId = sessionStorage.getItem('truco_mesaId');
    const savedNombre = sessionStorage.getItem('truco_nombre');
    if (savedMesaId && savedNombre) {
      setPartidaGuardada(savedMesaId);
    }

    const connectToServer = async () => {
      try {
        await socketService.connect();
        setConectado(true);

        socketService.onPartidasDisponibles((partidasData) => {
          setPartidas(partidasData);
        });

        socketService.onPartidaNueva((partidaNueva) => {
          setPartidas(prev => {
            if (prev.find(p => p.mesaId === partidaNueva.mesaId)) return prev;
            return [...prev, partidaNueva];
          });
        });

        // Listener de invitaciones con notificaciones mejoradas
        socketService.onInvitacionRecibida((data) => {
          setInvitacion(data);
          // Reproducir sonido de notificación
          audioManager.play('notification');
          // Notificación del navegador si está permitido
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Truco Uruguayo - Invitación', {
              body: `${data.de} te invitó a una partida ${data.tamañoSala}`,
              icon: '/icon-192.png',
              tag: 'invitacion-' + data.mesaId,
            });
          }
          setTimeout(() => setInvitacion(null), 20000);
        });

        await socketService.joinLobby();

        // Re-autenticar el socket si ya tenemos sesión
        if (savedUsuario) {
          try {
            const u = JSON.parse(savedUsuario);
            const savedPw = sessionStorage.getItem('truco_auth');
            if (savedPw) {
              const loginResult = await socketService.login(u.apodo, savedPw);
              if (loginResult?.success) {
                // Actualizar usuario con datos frescos del servidor (avatar_url, etc.)
                if (loginResult.usuario) {
                  setUsuario(loginResult.usuario);
                  sessionStorage.setItem('truco_usuario', JSON.stringify(loginResult.usuario));
                }
                if (loginResult.partidasActivas) {
                  setMisPartidas(loginResult.partidasActivas);
                }
              }
            }
          } catch { /* ignorar */ }
        }
      } catch (error) {
        console.error('Failed to connect:', error);
        setConectado(false);
      }
    };

    connectToServer();

    return () => {
      socketService.off('partidas-disponibles');
      socketService.off('partida-nueva');
      socketService.off('invitacion-recibida');
    };
  }, []);

  // Verificar permisos de notificaciones
  useEffect(() => {
    if ('Notification' in window) {
      setNotificacionesPermitidas(Notification.permission === 'granted');
    }
  }, []);

  // Sincronizar sesión de Google con Socket.IO
  useEffect(() => {
    const fromGoogle = searchParams?.get('from') === 'google';

    // Si viene de Google auth y tiene sesión de NextAuth pero no está autenticado en Socket.IO
    if (fromGoogle && session?.user && !usuario && conectado && !googleAuthPending) {
      setGoogleAuthPending(true);

      const syncGoogleAuth = async () => {
        try {
          const googleId = session.user.googleId;
          const email = session.user.email;
          const nombre = session.user.name;
          const avatarUrl = session.user.image;

          if (googleId && email && nombre) {
            const result = await socketService.loginConGoogle(googleId, email, nombre, avatarUrl || undefined);

            if (result.success) {
              setUsuario(result.usuario);
              setNombre(result.usuario.apodo);
              sessionStorage.setItem('truco_usuario', JSON.stringify(result.usuario));
              sessionStorage.setItem('truco_nombre', result.usuario.apodo);
              // No guardamos password para usuarios de Google
              sessionStorage.removeItem('truco_auth');

              if (result.partidasActivas) {
                setMisPartidas(result.partidasActivas);
              }

              // Limpiar el query param
              window.history.replaceState({}, '', '/lobby');
            } else {
              console.error('[Google Auth] Error:', result.error);
            }
          }
        } catch (error) {
          console.error('[Google Auth] Error sincronizando:', error);
        } finally {
          setGoogleAuthPending(false);
        }
      };

      syncGoogleAuth();
    }
  }, [session, usuario, conectado, searchParams, googleAuthPending]);

  const solicitarPermisosNotificacion = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificacionesPermitidas(permission === 'granted');
    }
  }, []);

  const handleCerrarSesion = async () => {
    setUsuario(null);
    setNombre('');
    setMisPartidas([]);
    sessionStorage.removeItem('truco_usuario');
    sessionStorage.removeItem('truco_auth');
    sessionStorage.removeItem('truco_nombre');

    // Si tiene sesión de Google, cerrarla también
    if (session) {
      await signOut({ redirect: false });
    }
  };

  // Obtener partidas del usuario logueado
  const fetchMisPartidas = async () => {
    if (!usuario) return;
    const result = await socketService.obtenerMisPartidas();
    if (result.success) {
      setMisPartidas(result.partidas || []);
    }
  };

  // Auto-refresh de mis partidas cada 10 segundos
  useEffect(() => {
    if (!usuario || !conectado) return;
    const interval = setInterval(fetchMisPartidas, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, conectado]);

  // Reconectar a partida como usuario logueado (usa userId)
  const handleReconectarPartidaUsuario = async (mesaId: string) => {
    if (!usuario) return;
    setLoading(true);
    try {
      const success = await socketService.reconectarPartida(mesaId, usuario.apodo, usuario.id);
      if (success) {
        navigateToGame(mesaId);
      } else {
        alert('Error al reconectar. La partida puede haber terminado.');
        fetchMisPartidas();
      }
    } catch {
      alert('Error al reconectar a la partida');
      fetchMisPartidas();
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de invitar amigos
  const handleOpenInvite = async (mesaId: string) => {
    setInviteModalMesaId(mesaId);
    setInviteSent(new Set());
    setInviteLoading(true);
    try {
      const result = await socketService.obtenerAmigos();
      if (result.success) {
        setAmigosOnline(result.amigos?.filter((a: { online: boolean }) => a.online) || []);
      }
    } catch { /* ignorar */ }
    setInviteLoading(false);
  };

  const handleInvitarAmigo = async (amigoId: number) => {
    if (!inviteModalMesaId) return;
    const result = await socketService.invitarAmigo(amigoId, inviteModalMesaId);
    if (result.success) {
      setInviteSent(prev => new Set(prev).add(amigoId));
    } else {
      alert(result.error || 'No se pudo invitar');
    }
  };

  const navigateToGame = (mesaId: string) => {
    sessionStorage.setItem('truco_nombre', nombre.trim());
    sessionStorage.setItem('truco_mesaId', mesaId);
    socketService.setNavigating(true);
    window.location.href = `/game?mesaId=${mesaId}`;
  };

  const handleCrearPartida = async () => {
    if (!nombre.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const mesaId = await socketService.crearPartida(nombre.trim(), tamañoSala, modoAlternado, false);
      if (mesaId) {
        navigateToGame(mesaId);
      } else {
        alert('Error al crear la partida');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Error al crear la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleUnirsePartida = async (mesaId: string) => {
    if (!nombre.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const success = await socketService.unirsePartida(mesaId, nombre.trim());
      if (success) {
        navigateToGame(mesaId);
      } else {
        alert('Error al unirse a la partida');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Error al unirse a la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleReconectarPartida = async (mesaId: string) => {
    if (!nombre.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const success = await socketService.reconectarPartida(mesaId, nombre.trim());
      if (success) {
        navigateToGame(mesaId);
      } else {
        // Si falla reconectar, intentar unirse normal
        const joinSuccess = await socketService.unirsePartida(mesaId, nombre.trim());
        if (joinSuccess) {
          navigateToGame(mesaId);
        } else {
          alert('La partida ya no existe');
          sessionStorage.removeItem('truco_mesaId');
          setPartidaGuardada(null);
        }
      }
    } catch (error) {
      console.error('Error reconnecting:', error);
      alert('La partida ya no existe');
      sessionStorage.removeItem('truco_mesaId');
      setPartidaGuardada(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarPartida = async (mesaId: string) => {
    if (!confirm('¿Estás seguro de que querés eliminar esta partida?')) {
      return;
    }

    setLoading(true);
    try {
      const success = await socketService.eliminarPartida(mesaId, nombre.trim());
      if (success) {
        // La partida se eliminará y el lobby se actualizará automáticamente
        setPartidas(prev => prev.filter(p => p.mesaId !== mesaId));
      } else {
        alert('Error al eliminar la partida');
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Error al eliminar la partida');
    } finally {
      setLoading(false);
    }
  };

  // Verificar si el usuario actual es parte de una partida (por nombre)
  const esJugadorEnPartida = (partida: Partida): boolean => {
    if (!nombre.trim()) return false;
    return partida.jugadoresNombres?.includes(nombre.trim()) || false;
  };

  // Verificar si el usuario es el creador
  const esCreador = (partida: Partida): boolean => {
    if (!nombre.trim()) return false;
    return partida.creadorNombre === nombre.trim();
  };

  // Pantalla de carga
  if (!conectado) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl font-light tracking-wide">Conectando al servidor...</div>
          <div className="text-gold-600/40 text-sm mt-2">Preparando la pulpería</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      {/* Efectos de luz */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-celeste-500/8 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-gradient-radial from-celeste-600/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[400px] bg-gradient-radial from-celeste-500/4 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Decoraciones de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-24 left-6 opacity-[0.18] hidden xl:block">
          <Image src="/Images/Tero.png" alt="" width={100} height={100} className="animate-float" style={{ animationDelay: '1s' }} />
        </div>
        <div className="absolute bottom-16 right-6 opacity-[0.15] hidden xl:block">
          <Image src="/Images/LuisSuarez.png" alt="" width={90} height={90} className="animate-float" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10">
          <Link href="/" className="inline-block group">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image src="/Images/SolDeMayo.png" alt="Sol de Mayo" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 sun-glow" />
              <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl lg:text-6xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors">
                Truco Uruguayo
              </h1>
              <Image src="/Images/SolDeMayo.png" alt="" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 sun-glow" />
            </div>
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-celeste-500/40" />
            <Image src="/Images/TermoYMate.png" alt="" width={20} height={20} className="w-5 h-5 opacity-50" />
            <p className="text-celeste-400/70 text-sm tracking-widest uppercase">Lobby</p>
            <Image src="/Images/TermoYMate.png" alt="" width={20} height={20} className="w-5 h-5 opacity-50 -scale-x-100" />
            <div className="h-px w-8 bg-celeste-500/40" />
          </div>
        </header>

        {/* Banner de notificaciones */}
        {notificacionesPermitidas === false && 'Notification' in (typeof window !== 'undefined' ? window : {}) && (
          <div className="glass rounded-xl p-3 mb-4 animate-slide-up border border-celeste-500/30 bg-celeste-900/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <p className="text-celeste-300 text-sm">Activá las notificaciones para recibir invitaciones de amigos</p>
              </div>
              <button
                onClick={solicitarPermisosNotificacion}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-celeste-600 hover:bg-celeste-500 text-white transition-all flex-shrink-0"
              >
                Activar
              </button>
            </div>
          </div>
        )}

        {/* Banner de reconexión (solo invitados) */}
        {!usuario && partidaGuardada && nombre.trim() && (
          <div className="glass rounded-2xl p-4 sm:p-5 mb-6 animate-slide-up border border-amber-500/30 bg-amber-900/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ReconnectIcon className="w-6 h-6 text-amber-400 animate-spin-slow flex-shrink-0" />
                <div>
                  <p className="text-gold-300 font-medium">Tenés una partida en curso</p>
                  <p className="text-gold-500/60 text-sm">Podés volver a conectarte a tu partida anterior</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    sessionStorage.removeItem('truco_mesaId');
                    setPartidaGuardada(null);
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-gold-500/60 hover:text-gold-400 hover:bg-white/5 transition-all"
                >
                  Descartar
                </button>
                <button
                  onClick={() => handleReconectarPartida(partidaGuardada)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
                >
                  {loading ? 'Reconectando...' : 'Volver a la partida'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra de usuario o invitado */}
        {usuario ? (
          <div className="glass rounded-2xl p-4 sm:p-5 mb-6 animate-slide-up border border-celeste-500/30 bg-celeste-900/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {usuario.avatar_url ? (
                  <img src={usuario.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-celeste-500/50 shadow-lg shadow-celeste-500/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-celeste-500 to-celeste-700 flex items-center justify-center text-white font-bold text-lg">
                    {usuario.apodo[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-white font-bold">{usuario.apodo}</div>
                  <div className="text-celeste-400/60 text-xs">Jugador registrado</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/tutorial" className="px-3 py-1.5 rounded-lg text-xs text-green-400/70 hover:text-green-300 hover:bg-green-500/10 transition-all">
                  Tutorial
                </Link>
                <Link href="/perfil" className="px-3 py-1.5 rounded-lg text-xs text-celeste-400/70 hover:text-celeste-300 hover:bg-celeste-500/10 transition-all">
                  Mi Perfil
                </Link>
                <Link href="/ranking" className="px-3 py-1.5 rounded-lg text-xs text-celeste-400/70 hover:text-celeste-300 hover:bg-celeste-500/10 transition-all">
                  Ranking
                </Link>
                <button
                  onClick={handleCerrarSesion}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400/70 hover:text-red-300 hover:bg-red-900/20 transition-all"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 sm:p-5 mb-6 animate-slide-up border border-gold-800/20">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-wood-800 flex items-center justify-center text-gold-500/50 text-lg">
                  ?
                </div>
                <div>
                  <div className="text-gold-400/70 font-medium">Modo invitado</div>
                  <div className="text-gold-500/40 text-xs">Sin estadísticas ni ranking</div>
                </div>
              </div>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold-600 to-gold-700 text-wood-950 hover:from-gold-500 hover:to-gold-600 transition-all shadow-lg shadow-gold-600/20"
              >
                Iniciar sesión / Registrarse
              </Link>
            </div>
          </div>
        )}

        {/* Tus Partidas - solo usuarios logueados */}
        {usuario && misPartidas.length > 0 && (
          <div className="glass rounded-2xl p-6 sm:p-8 mb-6 animate-slide-up border border-celeste-500/30 bg-celeste-900/10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl font-bold text-celeste-400">
                Tus Partidas
              </h2>
              <button
                onClick={fetchMisPartidas}
                className="text-sm text-celeste-400/70 hover:text-celeste-300 transition-colors flex items-center gap-1.5"
              >
                <ReconnectIcon className="w-4 h-4" />
                Actualizar
              </button>
            </div>

            <div className="space-y-3">
              {misPartidas.map((partida) => {
                const estaJugando = partida.estado === 'jugando';

                return (
                  <div
                    key={partida.mesaId}
                    className="glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-celeste-500/40 bg-celeste-900/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-celeste-600/30">
                        <span className="text-2xl font-bold text-celeste-400">
                          {partida.tamañoSala}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-white">
                            Mesa {partida.mesaId.split('_')[1]?.slice(0, 6) || partida.mesaId.slice(0, 6)}
                          </h3>
                          <span className="px-2 py-0.5 bg-celeste-600/30 text-celeste-300 rounded-full text-[10px] font-bold uppercase">
                            Tu partida
                          </span>
                        </div>

                        <div className="text-gold-500/60 text-xs mb-1.5">
                          Jugadores: <span className="text-gold-400">{partida.jugadores.join(', ')}</span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: partida.maxJugadores }, (_, i) => (
                                <div
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                    i < partida.jugadoresCount ? 'bg-celeste-400' : 'bg-gold-800/40'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-gold-400/60 text-sm">
                              {partida.jugadoresCount}/{partida.maxJugadores}
                            </span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                            estaJugando
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-amber-600/20 text-amber-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              estaJugando ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
                            }`} />
                            {estaJugando ? 'En juego' : 'Esperando'}
                          </span>

                          {estaJugando && partida.puntaje && (
                            <span className="px-2.5 py-0.5 bg-gold-600/20 text-gold-300 rounded-full text-xs font-medium">
                              {partida.puntaje.equipo1} - {partida.puntaje.equipo2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Invitar amigos (solo si esperando y hay espacio) */}
                      {partida.estado === 'esperando' && partida.jugadoresCount < partida.maxJugadores && (
                        <button
                          onClick={() => handleOpenInvite(partida.mesaId)}
                          disabled={loading}
                          className="px-4 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 hover:scale-105 shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50 text-sm"
                        >
                          <UsersIcon className="w-4 h-4" />
                          Invitar
                        </button>
                      )}
                      <button
                        onClick={() => handleReconectarPartidaUsuario(partida.mesaId)}
                        disabled={loading}
                        className="px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 hover:scale-105 shadow-lg shadow-celeste-600/20 active:scale-95 disabled:opacity-50"
                      >
                        <ReconnectIcon className="w-5 h-5" />
                        Volver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel de crear partida */}
        <div className="glass rounded-2xl p-6 sm:p-8 mb-6 animate-slide-up border border-gold-800/20">
          {/* Input nombre (solo para usuarios no registrados como fallback) */}
          {!usuario && (
            <div className="mb-6">
              <label className="block text-gold-400/80 text-sm font-medium mb-2 tracking-wide">
                O jugá como invitado
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input-glass w-full px-4 py-3.5 rounded-xl text-lg"
                placeholder="Nombre temporal (sin estadísticas)"
                maxLength={20}
              />
            </div>
          )}

          {/* Selector de tamaño */}
          <div className="mb-6">
            <label className="block text-gold-400/80 text-sm font-medium mb-3 tracking-wide">
              Tamaño de la sala
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['1v1', '2v2', '3v3'] as const).map((tamaño) => {
                const isSelected = tamañoSala === tamaño;
                const jugadores = tamaño === '1v1' ? 2 : tamaño === '2v2' ? 4 : 6;

                return (
                  <button
                    key={tamaño}
                    onClick={() => setTamañoSala(tamaño)}
                    className={`relative px-4 py-4 rounded-xl font-bold transition-all duration-300 transform hover:scale-[1.02] ${
                      isSelected
                        ? 'bg-gradient-to-br from-gold-600 to-gold-700 text-wood-950 shadow-lg shadow-gold-600/20 border-2 border-gold-400/50'
                        : 'glass text-gold-300/70 hover:text-gold-200 hover:bg-white/5 border border-gold-800/30'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl mb-1">{tamaño}</span>
                      <span className={`text-xs ${isSelected ? 'text-wood-800' : 'opacity-60'}`}>
                        {jugadores} jugadores
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-wood-950" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pico a Pico (solo visible para 3v3) */}
          {tamañoSala === '3v3' && (
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={modoAlternado}
                    onChange={(e) => setModoAlternado(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-wood-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gold-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-600"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-gold-300 font-medium group-hover:text-gold-200 transition-colors">
                    🐔 Pico a Pico
                  </span>
                  <span className="text-gold-400/60 text-xs">
                    En malas: alterna rondas 3v3 y 1v1 (cada uno contra su rival de enfrente)
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Botón crear */}
          <button
            onClick={handleCrearPartida}
            disabled={loading || !nombre.trim()}
            className="btn-primary w-full text-white text-lg py-4 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Crear Partida {tamañoSala}
                <ArrowIcon className="w-5 h-5" />
              </span>
            )}
          </button>
        </div>

        {/* Lista de partidas */}
        <div className="glass rounded-2xl p-6 sm:p-8 animate-slide-up border border-gold-800/20" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-[var(--font-cinzel)] text-2xl sm:text-3xl font-bold text-gold-400">
              Partidas Disponibles
            </h2>
            <div className="flex items-center gap-2 text-gold-500/50 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{partidas.length} activas</span>
            </div>
          </div>

          {partidas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-gold-500/5 rounded-full animate-pulse" />
                <TableIcon className="w-full h-full text-gold-600/30 relative z-10 p-4" />
              </div>
              <p className="text-gold-300/50 text-lg font-light mb-2">
                No hay partidas disponibles
              </p>
              <p className="text-gold-500/30 text-sm">
                Crea una nueva partida para empezar a jugar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {partidas.map((partida, index) => {
                const estaEsperando = partida.estado === 'esperando';
                const puedeUnirse = estaEsperando && partida.jugadores < partida.maxJugadores;
                const soyJugador = esJugadorEnPartida(partida);
                const soyCreador = esCreador(partida);
                const puedeReconectar = soyJugador && estaEsperando;

                return (
                  <div
                    key={partida.mesaId}
                    className={`glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 border ${
                      soyJugador
                        ? 'border-celeste-500/50 bg-celeste-900/10'
                        : puedeUnirse
                          ? 'border-green-600/30 hover:border-green-500/50 hover:bg-green-900/10'
                          : 'border-gold-800/20 opacity-60'
                    } animate-slide-up`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icono de mesa */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        soyJugador ? 'bg-celeste-600/20' : puedeUnirse ? 'bg-green-600/20' : 'bg-gold-600/10'
                      }`}>
                        <span className="text-2xl font-bold text-gold-400">
                          {partida.mesaId.split('_')[1]?.slice(0, 2) || '#'}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-white">
                            Mesa {partida.mesaId.split('_')[1]?.slice(0, 6) || partida.mesaId.slice(0, 6)}
                          </h3>
                          {soyCreador && (
                            <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded-full text-[10px] font-bold uppercase">
                              Tu mesa
                            </span>
                          )}
                          {soyJugador && !soyCreador && (
                            <span className="px-2 py-0.5 bg-celeste-600/30 text-celeste-300 rounded-full text-[10px] font-bold uppercase">
                              Estás aquí
                            </span>
                          )}
                        </div>

                        {/* Creador */}
                        {partida.creadorNombre && (
                          <div className="text-gold-500/60 text-xs mb-1.5">
                            Creada por: <span className="text-gold-400">{partida.creadorNombre}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Indicador de jugadores */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: partida.maxJugadores }, (_, i) => (
                                <div
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                    i < partida.jugadores
                                      ? 'bg-gold-400'
                                      : 'bg-gold-800/40'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-gold-400/60 text-sm">
                              {partida.jugadores}/{partida.maxJugadores}
                            </span>
                          </div>

                          {/* Badge de tamaño */}
                          <span className="px-2.5 py-0.5 bg-gold-600/20 text-gold-400 rounded-full text-xs font-medium">
                            {partida.tamañoSala}
                          </span>

                          {/* Estado */}
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                            estaEsperando
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-amber-600/20 text-amber-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              estaEsperando ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
                            }`} />
                            {estaEsperando ? 'Esperando' : 'En juego'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2">
                      {/* Botón eliminar (solo creador y partida esperando) */}
                      {soyCreador && estaEsperando && (
                        <button
                          onClick={() => handleEliminarPartida(partida.mesaId)}
                          disabled={loading}
                          className="px-3 py-3 rounded-xl font-bold transition-all duration-300 bg-red-900/30 text-red-400 hover:bg-red-800/50 hover:text-red-300 border border-red-700/40"
                          title="Eliminar partida"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}

                      {/* Botón reconectar (si soy jugador) */}
                      {puedeReconectar ? (
                        <button
                          onClick={() => handleReconectarPartida(partida.mesaId)}
                          disabled={loading}
                          className="px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 hover:scale-105 shadow-lg shadow-celeste-600/20 active:scale-95"
                        >
                          <ReconnectIcon className="w-5 h-5" />
                          Volver
                        </button>
                      ) : (
                        /* Botón unirse (si no soy jugador) */
                        <button
                          onClick={() => handleUnirsePartida(partida.mesaId)}
                          disabled={loading || !puedeUnirse}
                          className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 ${
                            puedeUnirse
                              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 hover:scale-105 shadow-lg shadow-green-600/20 active:scale-95'
                              : 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {puedeUnirse ? (
                            <>
                              <UsersIcon className="w-5 h-5" />
                              Unirse
                            </>
                          ) : (
                            <span>Llena</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center animate-fade-in">
          <div className="inline-flex items-center gap-6 text-gold-600/30 text-xs tracking-wider">
            <span className="flex items-center gap-1.5">
              <Image src="/Images/Pelota.png" alt="" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Tiempo real
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <Image src="/Images/MonedaArtigas.png" alt="" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Clasico
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <Image src="/Images/MapaUruguayBandera.png" alt="" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Uruguayo
            </span>
          </div>
        </footer>
      </div>

      {/* Modal invitar amigos */}
      {inviteModalMesaId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setInviteModalMesaId(null)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full border border-green-500/30 bg-green-900/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-green-400">Invitar Amigos</h3>
              <button onClick={() => setInviteModalMesaId(null)} className="text-gold-500/60 hover:text-gold-300 text-xl">&times;</button>
            </div>

            {inviteLoading ? (
              <div className="text-center py-8 text-gold-400/60">Cargando amigos...</div>
            ) : amigosOnline.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gold-400/60 mb-1">No hay amigos online</p>
                <p className="text-gold-500/40 text-sm">Agrega amigos desde tu perfil</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {amigosOnline.map(amigo => (
                  <div key={amigo.id} className="flex items-center justify-between glass rounded-lg p-3 border border-gold-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-gold-300 font-medium">{amigo.apodo}</span>
                    </div>
                    {inviteSent.has(amigo.id) ? (
                      <span className="text-green-400 text-sm">Enviada</span>
                    ) : (
                      <button
                        onClick={() => handleInvitarAmigo(amigo.id)}
                        className="px-3 py-1 rounded-lg text-sm font-semibold bg-green-600/30 text-green-300 hover:bg-green-600/50 transition-all"
                      >
                        Invitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast de invitación recibida - mejorado */}
      {invitacion && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down max-w-md w-full px-4">
          <div className="glass rounded-2xl overflow-hidden border-2 border-green-500/50 shadow-2xl shadow-green-600/20">
            {/* Barra de progreso */}
            <div className="h-1 bg-green-900/30">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-500 animate-shrink-width" style={{ animationDuration: '20s' }} />
            </div>
            <div className="p-4">
              <div className="flex items-start gap-4">
                {/* Icono animado */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center animate-pulse">
                  <span className="text-2xl">🎴</span>
                </div>
                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className="text-green-300 font-bold text-lg truncate">{invitacion.de}</p>
                  <p className="text-gold-300 text-sm">Te invita a una partida</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-green-600/30 text-green-300 text-xs font-medium">
                      {invitacion.tamañoSala}
                    </span>
                  </div>
                </div>
              </div>
              {/* Botones */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setInvitacion(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gold-400/70 hover:text-gold-300 bg-white/5 hover:bg-white/10 transition-all"
                >
                  Ignorar
                </button>
                <button
                  onClick={() => { handleUnirsePartida(invitacion.mesaId); setInvitacion(null); }}
                  disabled={loading || !nombre.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-600/30 disabled:opacity-50"
                >
                  ¡Unirse!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper con Suspense para useSearchParams
export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl font-light">Cargando...</div>
        </div>
      </div>
    }>
      <LobbyPageContent />
    </Suspense>
  );
}
