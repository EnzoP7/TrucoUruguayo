'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import socketService from '@/lib/socket';
import audioManager from '@/lib/audioManager';
import { AdBanner, RewardedAd } from '@/components/ads';
import { useShowAds } from '@/hooks/useUserPremium';
import FeedbackModal from '@/components/FeedbackModal';
import TrucoLoader from '@/components/TrucoLoader';
import AlertModal, { useAlertModal } from '@/components/AlertModal';

interface Partida {
  mesaId: string;
  jugadores: number;
  maxJugadores: number;
  tamañoSala: '1v1' | '2v2' | '3v3';
  estado: string;
  creadorNombre?: string;
  creadorPremium?: boolean;
  jugadoresNombres?: string[];
  esRankeada?: boolean;
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
  const { showAds } = useShowAds();
  const { alertState, showAlert, showConfirm, closeAlert } = useAlertModal();

  const [nombre, setNombre] = useState('');
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tamañoSala, setTamañoSala] = useState<'1v1' | '2v2' | '3v3'>('2v2');
  const [modoAlternado, setModoAlternado] = useState(true);
  const [esRankeada, setEsRankeada] = useState(false);
  const [partidaGuardada, setPartidaGuardada] = useState<string | null>(null);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);
  const [monedas, setMonedas] = useState<number | null>(null);
  const [recompensaDiaria, setRecompensaDiaria] = useState<{ yaReclamado: boolean; monedas: number; diasConsecutivos: number } | null>(null);
  const [mostrarModalDiario, setMostrarModalDiario] = useState(false);
  const [mostrarRewardedAd, setMostrarRewardedAd] = useState(false);
  const [videosRestantes, setVideosRestantes] = useState<number | null>(null);
  const [videoCooldown, setVideoCooldown] = useState(0);

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
                  setMonedas(loginResult.usuario.monedas ?? 0);
                  sessionStorage.setItem('truco_usuario', JSON.stringify(loginResult.usuario));
                }
                if (loginResult.partidasActivas) {
                  setMisPartidas(loginResult.partidasActivas);
                }
                // Verificar recompensa diaria
                if (loginResult.recompensaDiaria && !loginResult.recompensaDiaria.yaReclamado) {
                  setRecompensaDiaria(loginResult.recompensaDiaria);
                  setMostrarModalDiario(true);
                }
                // Obtener estado de videos rewarded
                const estadoVideos = await socketService.obtenerEstadoVideos();
                if (estadoVideos.success) {
                  setVideosRestantes(estadoVideos.videosRestantes ?? 0);
                  if (estadoVideos.cooldownRestante && estadoVideos.cooldownRestante > 0) {
                    setVideoCooldown(estadoVideos.cooldownRestante);
                  }
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

  // Cooldown timer para rewarded ads
  useEffect(() => {
    if (videoCooldown <= 0) return;
    const timer = setInterval(() => {
      setVideoCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [videoCooldown]);

  // Reconectar a partida como usuario logueado (usa userId)
  const handleReconectarPartidaUsuario = async (mesaId: string) => {
    if (!usuario) return;
    setLoading(true);
    try {
      const success = await socketService.reconectarPartida(mesaId, usuario.apodo, usuario.id);
      if (success) {
        navigateToGame(mesaId);
      } else {
        showAlert('error', 'Error', 'Error al reconectar. La partida puede haber terminado.');
        fetchMisPartidas();
      }
    } catch {
      showAlert('error', 'Error', 'Error al reconectar a la partida');
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
      showAlert('error', 'Error', result.error || 'No se pudo invitar');
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
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const mesaId = await socketService.crearPartida(nombre.trim(), tamañoSala, modoAlternado, false, esRankeada);
      if (mesaId) {
        if (esRankeada && monedas !== null) setMonedas(monedas - 10);
        navigateToGame(mesaId);
      } else {
        showAlert('error', 'Error', 'Error al crear la partida. Verificá que tengas monedas suficientes.');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      showAlert('error', 'Error', 'Error al crear la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleUnirsePartida = async (mesaId: string) => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
    try {
      const success = await socketService.unirsePartida(mesaId, nombre.trim());
      if (success) {
        navigateToGame(mesaId);
      } else {
        showAlert('error', 'Error', 'Error al unirse a la partida');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      showAlert('error', 'Error', 'Error al unirse a la partida');
    } finally {
      setLoading(false);
    }
  };

  const handleReconectarPartida = async (mesaId: string) => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
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
          showAlert('info', 'Partida no encontrada', 'La partida ya no existe');
          sessionStorage.removeItem('truco_mesaId');
          setPartidaGuardada(null);
        }
      }
    } catch (error) {
      console.error('Error reconnecting:', error);
      showAlert('info', 'Partida no encontrada', 'La partida ya no existe');
      sessionStorage.removeItem('truco_mesaId');
      setPartidaGuardada(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarPartida = async (mesaId: string) => {
    const confirmed = await showConfirm('Eliminar partida', '¿Estás seguro de que querés eliminar esta partida?');
    if (!confirmed) return;

    setLoading(true);
    try {
      const success = await socketService.eliminarPartida(mesaId, nombre.trim());
      if (success) {
        // La partida se eliminará y el lobby se actualizará automáticamente
        setPartidas(prev => prev.filter(p => p.mesaId !== mesaId));
      } else {
        showAlert('error', 'Error', 'Error al eliminar la partida');
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      showAlert('error', 'Error', 'Error al eliminar la partida');
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
    return <TrucoLoader text="Conectando al servidor..." />;
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
        {/* Header con H1 SEO optimizado */}
        <header className="text-center mb-8 sm:mb-10">
          <Link href="/" className="inline-block group">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image src="/Images/SolDeMayo.png" alt="Sol de Mayo - Simbolo uruguayo" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 sun-glow" />
              <div className="font-[var(--font-cinzel)] text-3xl sm:text-4xl lg:text-5xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors">
                Truco Uruguayo
              </div>
              <Image src="/Images/SolDeMayo.png" alt="" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10 sun-glow" />
            </div>
          </Link>
          {/* H1 SEO optimizado - descriptivo y con keywords */}
          <h1 className="text-xl sm:text-2xl text-celeste-300 font-medium mt-2 mb-3">
            Jugar Truco Uruguayo Online Gratis con Amigos
          </h1>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-celeste-500/40" />
            <Image src="/Images/TermoYMate.png" alt="Mate uruguayo" width={20} height={20} className="w-5 h-5 opacity-50" />
            <p className="text-celeste-400/70 text-sm tracking-widest uppercase">Lobby de Partidas</p>
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
          <div className="glass rounded-2xl p-4 sm:p-5 mb-6 animate-slide-up border border-gold-500/40 bg-gold-900/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ReconnectIcon className="w-6 h-6 text-gold-400 animate-spin-slow flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Tenés una partida en curso</p>
                  <p className="text-white/60 text-sm">Podés volver a conectarte a tu partida anterior</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    sessionStorage.removeItem('truco_mesaId');
                    setPartidaGuardada(null);
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  Descartar
                </button>
                <button
                  onClick={() => handleReconectarPartida(partidaGuardada)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/30 disabled:opacity-50"
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
                  <Image src={usuario.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover border-2 border-celeste-500/50 shadow-lg shadow-celeste-500/10" unoptimized />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-celeste-500 to-celeste-700 flex items-center justify-center text-white font-bold text-lg">
                    {usuario.apodo[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-white font-bold">{usuario.apodo}</div>
                  <div className="text-celeste-400/60 text-xs">Jugador registrado</div>
                </div>
                {monedas !== null && (
                  <div className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-500/15 border border-gold-500/30">
                    <span className="text-gold-400 text-sm">&#x1FA99;</span>
                    <span className="text-gold-300 font-bold text-sm">{monedas}</span>
                  </div>
                )}
                {usuario && showAds && videosRestantes !== null && videosRestantes > 0 && (
                  <button
                    onClick={() => setMostrarRewardedAd(true)}
                    disabled={videoCooldown > 0}
                    className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      videoCooldown > 0
                        ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:text-green-300'
                    }`}
                  >
                    <span>&#x1F4FA;</span>
                    {videoCooldown > 0
                      ? <span>{videoCooldown}s</span>
                      : <span>+{75} monedas</span>
                    }
                  </button>
                )}
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
          <div className="glass rounded-2xl p-4 sm:p-5 mb-6 animate-slide-up border border-white/20 bg-white/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-celeste-900/50 border border-celeste-500/30 flex items-center justify-center text-celeste-300/70 text-lg">
                  ?
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-white/80 font-medium">Modo invitado</div>
                  <div className="text-white/50 text-xs">Sin estadísticas ni ranking</div>
                </div>
              </div>
              <Link
                href="/login"
                className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-celeste-500 to-celeste-600 text-white hover:from-celeste-400 hover:to-celeste-500 transition-all shadow-lg shadow-celeste-600/30"
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
        <section className="glass rounded-2xl p-6 sm:p-8 mb-6 animate-slide-up border border-celeste-500/30 bg-gradient-to-br from-celeste-900/20 to-transparent" aria-labelledby="crear-partida-heading">
          <h2 id="crear-partida-heading" className="sr-only">Crear Nueva Partida de Truco</h2>
          {/* Input nombre (solo para usuarios no registrados como fallback) */}
          {!usuario && (
            <div className="mb-6">
              <label className="block text-white/80 text-sm font-medium mb-2 tracking-wide">
                O jugá como invitado
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-lg bg-white/10 border border-celeste-500/30 text-white placeholder:text-white/40 focus:border-celeste-400 focus:ring-2 focus:ring-celeste-500/30 outline-none transition-all"
                placeholder="Nombre temporal (sin estadísticas)"
                maxLength={20}
              />
            </div>
          )}

          {/* Selector de tamaño */}
          <div className="mb-6">
            <label className="block text-white/80 text-sm font-medium mb-3 tracking-wide">
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
                        ? 'bg-gradient-to-br from-celeste-500 to-celeste-700 text-white shadow-lg shadow-celeste-600/30 border-2 border-celeste-400/50'
                        : 'glass text-white/70 hover:text-white hover:bg-white/10 border border-white/20'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl mb-1">{tamaño}</span>
                      <span className={`text-xs ${isSelected ? 'text-celeste-100' : 'opacity-60'}`}>
                        {jugadores} jugadores
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-400 rounded-full border-2 border-celeste-700 shadow-lg shadow-gold-400/50" />
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
                  <div className="w-11 h-6 bg-celeste-900/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-celeste-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-celeste-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium group-hover:text-celeste-200 transition-colors">
                    🐔 Pico a Pico
                  </span>
                  <span className="text-white/60 text-xs">
                    En malas: alterna rondas 3v3 y 1v1 (cada uno contra su rival de enfrente)
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Partida Rankeada (solo para usuarios registrados) */}
          {usuario && (
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={esRankeada}
                    onChange={(e) => setEsRankeada(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-celeste-900/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gold-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium group-hover:text-gold-200 transition-colors">
                    Partida Rankeada
                  </span>
                  <span className="text-white/60 text-xs">
                    Entrada: 10 monedas por jugador. Recompensa mayor al ganar.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Botón crear */}
          <button
            onClick={handleCrearPartida}
            disabled={loading || !nombre.trim() || (esRankeada && (monedas ?? 0) < 10)}
            className={`w-full text-white text-lg py-4 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg font-bold ${
              esRankeada
                ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 shadow-gold-500/30'
                : 'bg-gradient-to-r from-celeste-500 to-celeste-600 hover:from-celeste-400 hover:to-celeste-500 shadow-celeste-600/30'
            }`}
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
                {esRankeada ? `Crear Rankeada ${tamañoSala} (10 monedas)` : `Crear Partida ${tamañoSala}`}
                <ArrowIcon className="w-5 h-5" />
              </span>
            )}
          </button>
        </section>

        {/* Lista de partidas */}
        <section className="glass rounded-2xl p-6 sm:p-8 animate-slide-up border border-white/20 bg-gradient-to-br from-white/5 to-transparent" style={{ animationDelay: '0.15s' }} aria-labelledby="partidas-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="partidas-heading" className="font-[var(--font-cinzel)] text-2xl sm:text-3xl font-bold text-white">
              Partidas Disponibles de Truco Uruguayo
            </h2>
            <div className="flex items-center gap-2 text-celeste-300/70 text-sm">
              <div className="w-2 h-2 rounded-full bg-celeste-400 animate-pulse" />
              <span>{partidas.length} activas</span>
            </div>
          </div>

          {partidas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-celeste-500/10 rounded-full animate-pulse" />
                <TableIcon className="w-full h-full text-celeste-400/40 relative z-10 p-4" />
              </div>
              <p className="text-white/60 text-lg font-light mb-2">
                No hay partidas disponibles
              </p>
              <p className="text-white/40 text-sm">
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
                        ? 'border-celeste-400/50 bg-celeste-900/20'
                        : partida.creadorPremium
                          ? 'border-yellow-500/40 bg-yellow-900/5 hover:border-yellow-400/60 hover:bg-yellow-900/10'
                          : puedeUnirse
                            ? 'border-celeste-500/30 hover:border-celeste-400/50 hover:bg-celeste-900/10'
                            : 'border-white/10 opacity-60'
                    } animate-slide-up`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icono de mesa */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        soyJugador ? 'bg-celeste-500/30' : puedeUnirse ? 'bg-celeste-600/20' : 'bg-white/10'
                      }`}>
                        <span className="text-2xl font-bold text-white">
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
                          <div className="text-white/50 text-xs mb-1.5">
                            Creada por: <span className={partida.creadorPremium ? "text-yellow-300" : "text-celeste-300"}>{partida.creadorPremium ? '👑 ' : ''}{partida.creadorNombre}</span>
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
                                      ? 'bg-celeste-400'
                                      : 'bg-white/20'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-white/60 text-sm">
                              {partida.jugadores}/{partida.maxJugadores}
                            </span>
                          </div>

                          {/* Badge de tamaño */}
                          <span className="px-2.5 py-0.5 bg-celeste-600/30 text-celeste-300 rounded-full text-xs font-medium">
                            {partida.tamañoSala}
                          </span>
                          {partida.esRankeada && (
                            <span className="px-2.5 py-0.5 bg-gold-500/20 text-gold-300 rounded-full text-xs font-bold">
                              Rankeada
                            </span>
                          )}

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
        </section>

        {/* Banner de publicidad */}
        <div className="flex justify-center my-6">
          <AdBanner
            size="leaderboard"
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY}
            className="hidden sm:flex"
          />
          <AdBanner
            size="banner"
            adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY}
            className="flex sm:hidden"
          />
        </div>

        {/* Seccion SEO - Contenido informativo sobre el Truco Uruguayo */}
        <section className="glass rounded-2xl p-6 sm:p-8 mt-8 animate-fade-in border border-celeste-500/20" aria-labelledby="info-truco-heading">
          <h2 id="info-truco-heading" className="text-xl sm:text-2xl font-[var(--font-cinzel)] text-gold-400 mb-5 text-center">
            Como Jugar al Truco Uruguayo Online
          </h2>

          <div className="text-white/75 space-y-4 text-sm leading-relaxed">
            <p>
              Bienvenido al <strong>lobby de Truco Uruguayo Online</strong>, el lugar donde podes crear partidas o
              unirte a mesas existentes para disfrutar del <strong>juego de cartas mas popular de Uruguay</strong>.
              Nuestra plataforma te permite jugar <strong>truco gratis</strong> con amigos o con otros jugadores
              de cualquier parte del mundo, todo en tiempo real y sin necesidad de descargar nada.
            </p>

            <h3 className="text-lg text-celeste-300 font-semibold mt-5 mb-2">
              Modos de Juego Disponibles
            </h3>
            <p>
              Ofrecemos tres modalidades de juego para adaptarnos a tus preferencias. El modo <strong>1v1</strong>
              es ideal para duelos mano a mano donde tu estrategia individual es lo que cuenta. El modo
              <strong> 2v2</strong> te permite jugar en equipos de dos, donde la coordinacion con tu companero
              es fundamental. Y el modo <strong>3v3</strong> es la experiencia completa del truco uruguayo,
              con la opcion de activar el modo &quot;Pico a Pico&quot; para alternar entre rondas grupales e individuales
              cuando estan en malas.
            </p>

            <h3 className="text-lg text-celeste-300 font-semibold mt-5 mb-2">
              Crear o Unirse a una Partida
            </h3>
            <p>
              Para empezar a <strong>jugar truco online</strong>, simplemente ingresa tu nombre (o inicia sesion
              para guardar tus estadisticas), selecciona el tamano de sala que prefieras, y hace clic en
              &quot;Crear Partida&quot;. Tambien podes unirte a cualquiera de las partidas disponibles en la lista
              de abajo. Si ya tenes amigos registrados, podes invitarlos directamente a tu mesa con un solo clic.
            </p>

            <h3 className="text-lg text-celeste-300 font-semibold mt-5 mb-2">
              Partidas en Tiempo Real
            </h3>
            <p>
              Todas las partidas de <strong>Truco Uruguayo</strong> se juegan en tiempo real gracias a nuestra
              tecnologia de conexion instantanea. Esto significa que no hay demoras entre jugadas, y la experiencia
              es tan fluida como si estuvieras sentado en la misma mesa con tus amigos. El sistema detecta
              automaticamente si te desconectas y te permite volver a la partida sin perder tu lugar.
            </p>

            <h3 className="text-lg text-celeste-300 font-semibold mt-5 mb-2">
              Reglas del Truco Uruguayo
            </h3>
            <p>
              El <strong>truco uruguayo</strong> se juega con un mazo espanol de 40 cartas, sin los ochos ni nueves.
              Cada ronda es al mejor de tres manos, y el juego completo es a 30 puntos. Lo que distingue al truco
              de otros juegos de cartas son los cantos: el <strong>Envido</strong> para apostar puntos segun tus
              cartas del mismo palo, el <strong>Truco</strong> para aumentar el valor de la ronda, y la
              <strong> Flor</strong> cuando tenes tres cartas del mismo palo. Dominar el arte del farol y saber
              cuando cantar o cuando quedarse callado es lo que separa a los buenos jugadores de los expertos.
            </p>
          </div>
        </section>

        {/* Navegacion interna SEO-friendly */}
        <nav className="mt-6 w-full" aria-label="Enlaces utiles del sitio">
          <div className="glass rounded-xl p-5 border border-celeste-500/20">
            <h2 className="text-base font-[var(--font-cinzel)] text-gold-400 mb-3 text-center">
              Explora Truco Uruguayo Online
            </h2>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <li>
                <Link href="/" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Pagina Principal
                </Link>
              </li>
              <li>
                <Link href="/tutorial" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Tutorial: Como Jugar Truco
                </Link>
              </li>
              <li>
                <Link href="/practica" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Practicar contra la Computadora
                </Link>
              </li>
              <li>
                <Link href="/ranking" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Ranking de Jugadores
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-celeste-300 hover:text-celeste-100 transition-colors underline underline-offset-4">
                  Crear Cuenta Gratis
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* Enlaces externos de autoridad */}
        <aside className="mt-4 text-center">
          <p className="text-white/40 text-xs mb-2">Mas sobre el truco y la cultura uruguaya:</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a
              href="https://es.wikipedia.org/wiki/Truco_(juego_de_naipes)"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celeste-400/60 hover:text-celeste-300 transition-colors underline"
            >
              Historia del Truco en Wikipedia
            </a>
            <a
              href="https://www.gub.uy/ministerio-turismo/cultura"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celeste-400/60 hover:text-celeste-300 transition-colors underline"
            >
              Cultura Uruguaya - Ministerio de Turismo
            </a>
          </div>
        </aside>

        {/* Footer con caracteristicas */}
        <footer className="mt-10 text-center animate-fade-in">
          <div className="inline-flex items-center gap-6 text-gold-600/30 text-xs tracking-wider mb-6">
            <span className="flex items-center gap-1.5">
              <Image src="/Images/Pelota.png" alt="Truco en tiempo real" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Tiempo real
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <Image src="/Images/MonedaArtigas.png" alt="Truco clasico uruguayo" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Clasico
            </span>
            <span className="w-1 h-1 rounded-full bg-gold-700/30" />
            <span className="flex items-center gap-1.5">
              <Image src="/Images/MapaUruguayBandera.png" alt="Truco Uruguayo" width={18} height={18} className="w-[18px] h-[18px] opacity-40" /> Uruguayo
            </span>
          </div>

          {/* Creditos del desarrollador */}
          <div className="border-t border-celeste-600/20 pt-4">
            <p className="text-gold-400/70 text-sm mb-2">
              Desarrollado por <span className="font-semibold text-gold-400">Enzo Pontet</span>
            </p>
            <p className="text-white/40 text-xs mb-4">
              Queres colaborar o sugerir mejoras?
            </p>

            {/* Boton de sugerencias destacado */}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-600/30 hover:scale-105 active:scale-95 mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Enviar Sugerencia
            </button>

            <p className="text-white/30 text-xs">
              o escribinos a{' '}
              <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400/70 hover:text-celeste-300 transition-colors">
                enzopch2022@gmail.com
              </a>
            </p>
          </div>
        </footer>
      </div>

      {/* Modal de feedback */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Modal de recompensa diaria */}
      {mostrarModalDiario && recompensaDiaria && !recompensaDiaria.yaReclamado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMostrarModalDiario(false)}>
          <div className="glass rounded-2xl p-8 max-w-sm w-full border border-gold-500/30 bg-gradient-to-b from-gold-900/20 to-transparent text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-4">&#x1FA99;</div>
            <h3 className="font-[var(--font-cinzel)] text-2xl font-bold text-gold-400 mb-2">Recompensa Diaria</h3>
            <p className="text-white/70 text-sm mb-1">
              Racha: {recompensaDiaria.diasConsecutivos} {recompensaDiaria.diasConsecutivos === 1 ? 'dia' : 'dias'} consecutivos
            </p>
            <div className="flex items-center justify-center gap-2 my-4">
              {[1,2,3,4,5,6,7].map(dia => (
                <div key={dia} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  dia <= recompensaDiaria.diasConsecutivos
                    ? 'bg-gold-500 text-black'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {dia}
                </div>
              ))}
            </div>
            <p className="text-gold-300 text-3xl font-bold mb-6">+{recompensaDiaria.monedas} monedas</p>
            <button
              onClick={async () => {
                const result = await socketService.reclamarRecompensaDiaria();
                if (result.success) {
                  setMonedas(result.balance);
                  setRecompensaDiaria({ ...recompensaDiaria, yaReclamado: true });
                }
                setMostrarModalDiario(false);
              }}
              className="w-full py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/30"
            >
              Reclamar
            </button>
          </div>
        </div>
      )}

      {/* Modal Rewarded Ad */}
      {mostrarRewardedAd && (
        <RewardedAd
          rewardAmount={75}
          onRewardEarned={async () => {
            const result = await socketService.reclamarRecompensaVideo();
            if (result.success) {
              setMonedas(result.balance ?? monedas);
              setVideosRestantes(result.videosRestantes ?? 0);
              setVideoCooldown(30);
            }
            setMostrarRewardedAd(false);
          }}
          onCancel={() => setMostrarRewardedAd(false)}
        />
      )}

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
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-600/10 flex items-center justify-center">
                  <UsersIcon className="w-8 h-8 text-gold-500/40" />
                </div>
                <p className="text-gold-300 font-medium mb-1">No hay amigos conectados</p>
                <p className="text-gold-500/50 text-sm mb-4">Tus amigos no están online en este momento</p>
                <Link
                  href="/ranking"
                  onClick={() => setInviteModalMesaId(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-celeste-600/20 text-celeste-300 hover:bg-celeste-600/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Buscar amigos en el ranking
                </Link>
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
      <AlertModal {...alertState} onClose={closeAlert} />
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
