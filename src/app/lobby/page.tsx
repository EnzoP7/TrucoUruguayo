'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import socketService from '@/lib/socket';
import audioManager from '@/lib/audioManager';
import { AdBanner, RewardedAd } from '@/components/ads';
import { useShowAds, useUserPremium } from '@/hooks/useUserPremium';
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
  esRankeada?: boolean;
}

function LobbyPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { showAds } = useShowAds();
  const { isPremium, premiumExpiry } = useUserPremium();
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
  const [recompensaPorVideo, setRecompensaPorVideo] = useState(20);
  const [cargandoPremium, setCargandoPremium] = useState(false);
  const [usuariosOnline, setUsuariosOnline] = useState(0);
  const [buscandoPartida, setBuscandoPartida] = useState(false);
  const [mesaBuscando, setMesaBuscando] = useState<string | null>(null);

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
  const [menuOpen, setMenuOpen] = useState(false);

  // Estado para partidas privadas
  const [mostrarModalPrivada, setMostrarModalPrivada] = useState(false);
  const [tipoPrivada, setTipoPrivada] = useState<'password' | 'aprobacion'>('password');
  const [passwordPrivada, setPasswordPrivada] = useState('');
  const [codigoSalaCreada, setCodigoSalaCreada] = useState<string | null>(null);
  const [mesaIdSalaCreada, setMesaIdSalaCreada] = useState<string | null>(null);

  // Estado para unirse con código
  const [mostrarModalCodigo, setMostrarModalCodigo] = useState(false);
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [passwordIngresada, setPasswordIngresada] = useState('');
  const [esperandoAprobacion, setEsperandoAprobacion] = useState(false);

  // Estado para matchmaking rankeado
  const [buscandoRankeada, setBuscandoRankeada] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_posicionCola, setPosicionCola] = useState(0);
  const [tiempoEspera, setTiempoEspera] = useState(0);
  const [jugadoresEnCola, setJugadoresEnCola] = useState(0);
  const [jugadoresNecesarios, setJugadoresNecesarios] = useState(0);
  const [faltanJugadores, setFaltanJugadores] = useState(0);
  const [matchListo, setMatchListo] = useState(false);

  // Solicitudes pendientes (para host de partida con aprobación)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<Array<{ socketId: string; nombre: string; timestamp: number }>>([]);

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

        socketService.onUsuariosOnline((count) => {
          setUsuariosOnline(count);
        });

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

        // Listeners para matchmaking rankeado
        socketService.onEnCola((data: { posicion: number; tiempoEspera: number; jugadoresEnCola?: number; jugadoresNecesarios?: number; faltan?: number; matchListo?: boolean }) => {
          setPosicionCola(data.posicion);
          setTiempoEspera(data.tiempoEspera);
          if (data.jugadoresEnCola !== undefined) setJugadoresEnCola(data.jugadoresEnCola);
          if (data.jugadoresNecesarios !== undefined) setJugadoresNecesarios(data.jugadoresNecesarios);
          if (data.faltan !== undefined) setFaltanJugadores(data.faltan);
          if (data.matchListo) setMatchListo(true);
        });

        socketService.onMatchEncontrado((data) => {
          setBuscandoRankeada(false);
          setMatchListo(false);
          if (monedas !== null) setMonedas(monedas - 25);
          navigateToGame(data.mesaId);
        });

        socketService.onBusquedaCancelada(() => {
          setBuscandoRankeada(false);
          setPosicionCola(0);
          setTiempoEspera(0);
          setJugadoresEnCola(0);
          setJugadoresNecesarios(0);
          setFaltanJugadores(0);
          setMatchListo(false);
        });

        // Listeners para partidas privadas
        socketService.onSolicitudRecibida((data) => {
          setSolicitudesPendientes(prev => [...prev, data]);
          audioManager.play('notification');
        });

        socketService.onSolicitudRespondida((data) => {
          setEsperandoAprobacion(false);
          setMostrarModalCodigo(false);
          if (data.aceptado && data.mesaId) {
            navigateToGame(data.mesaId);
          } else {
            showAlert('info', 'Solicitud rechazada', data.mensaje);
          }
        });

        await socketService.joinLobby();

        // Re-autenticar el socket si ya tenemos sesión guardada
        if (savedUsuario) {
          try {
            const u = JSON.parse(savedUsuario);
            const savedPw = sessionStorage.getItem('truco_auth');
            let loginResult = null;

            if (savedPw) {
              // Usuario con password - login normal
              loginResult = await socketService.login(u.apodo, savedPw);
            } else if (u.google_id || u.auth_provider === 'google') {
              // Usuario de Google sin password - intentar re-auth con Google
              // Necesita que NextAuth tenga sesión activa (se maneja en otro useEffect)
              // Por ahora solo restauramos el estado visual, la autenticación real
              // se hará cuando el useEffect de Google detecte la sesión
              setMonedas(u.monedas ?? 0);
            }

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
                if (estadoVideos.recompensaPorVideo) {
                  setRecompensaPorVideo(estadoVideos.recompensaPorVideo);
                }
                if (estadoVideos.cooldownRestante && estadoVideos.cooldownRestante > 0) {
                  setVideoCooldown(estadoVideos.cooldownRestante);
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

    // Verificar si el usuario guardado es de Google y necesita re-autenticación
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    let isGoogleUser = false;
    if (savedUsuario) {
      try {
        const u = JSON.parse(savedUsuario);
        isGoogleUser = u.google_id || u.auth_provider === 'google';
      } catch { /* ignorar */ }
    }

    // Sincronizar si:
    // 1. Viene de Google auth (fromGoogle) y tiene sesión NextAuth
    // 2. O si es usuario de Google guardado, tiene sesión NextAuth, pero no está autenticado en socket
    const needsGoogleSync = (fromGoogle || isGoogleUser) && session?.user && conectado && !googleAuthPending;

    // Solo sincronizar si no tenemos usuario O si el usuario actual no tiene socket autenticado
    const shouldSync = needsGoogleSync && (!usuario || (isGoogleUser && !sessionStorage.getItem('truco_auth')));

    if (shouldSync) {
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
              setMonedas(result.usuario.monedas ?? 0);
              sessionStorage.setItem('truco_usuario', JSON.stringify(result.usuario));
              sessionStorage.setItem('truco_nombre', result.usuario.apodo);
              // No guardamos password para usuarios de Google
              sessionStorage.removeItem('truco_auth');

              if (result.partidasActivas) {
                setMisPartidas(result.partidasActivas);
              }

              // Verificar recompensa diaria
              if (result.recompensaDiaria && !result.recompensaDiaria.yaReclamado) {
                setRecompensaDiaria(result.recompensaDiaria);
                setMostrarModalDiario(true);
              }

              // Obtener estado de videos rewarded
              const estadoVideos = await socketService.obtenerEstadoVideos();
              if (estadoVideos.success) {
                setVideosRestantes(estadoVideos.videosRestantes ?? 0);
                if (estadoVideos.recompensaPorVideo) {
                  setRecompensaPorVideo(estadoVideos.recompensaPorVideo);
                }
                if (estadoVideos.cooldownRestante && estadoVideos.cooldownRestante > 0) {
                  setVideoCooldown(estadoVideos.cooldownRestante);
                }
              }

              // Limpiar el query param si existe
              if (fromGoogle) {
                window.history.replaceState({}, '', '/lobby');
              }
            } else {
              console.error('[Google Auth] Error:', result.error);
              // Si falla la autenticación de Google, limpiar sesión corrupta
              sessionStorage.removeItem('truco_usuario');
              sessionStorage.removeItem('truco_nombre');
              setUsuario(null);
              setNombre('');
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
    window.location.href = `/game-v2?mesaId=${mesaId}`;
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

  const handleBuscarPartida = async () => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }
    setBuscandoPartida(true);
    try {
      const result = await socketService.buscarPartida(nombre.trim(), tamañoSala, esRankeada);
      if (result.success && result.mesaId) {
        if (esRankeada && monedas !== null) setMonedas(monedas - 25);
        if (result.accion === 'unido') {
          // Encontró partida existente con espacio — entrar directo
          navigateToGame(result.mesaId);
        } else {
          // Creó partida nueva — quedarse en lobby esperando que alguien se una
          setMesaBuscando(result.mesaId);
          // Escuchar cuando alguien se une a nuestra partida
          socketService.onJugadorUnido(() => {
            navigateToGame(result.mesaId!);
          });
        }
      } else {
        setBuscandoPartida(false);
        showAlert('error', 'Error', result.error || 'Error al buscar partida');
      }
    } catch (error) {
      console.error('Error searching game:', error);
      setBuscandoPartida(false);
      showAlert('error', 'Error', 'Error al buscar partida');
    }
  };

  const handleCancelarBusqueda = async () => {
    if (mesaBuscando) {
      await socketService.eliminarPartida(mesaBuscando, nombre.trim());
    }
    setMesaBuscando(null);
    setBuscandoPartida(false);
  };

  // === PARTIDAS PRIVADAS ===
  const handleCrearPartidaPrivada = async () => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }

    if (tipoPrivada === 'password' && passwordPrivada.length < 4) {
      showAlert('warning', 'Contraseña muy corta', 'La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      const result = await socketService.crearPartidaPrivada(
        nombre.trim(),
        tamañoSala,
        tipoPrivada,
        tipoPrivada === 'password' ? passwordPrivada : undefined,
        modoAlternado
      );

      if (result.success && result.data) {
        setCodigoSalaCreada(result.data.codigoSala);
        setMesaIdSalaCreada(result.data.mesaId);
        setMostrarModalPrivada(false);
      } else {
        showAlert('error', 'Error', 'Error al crear la partida privada');
      }
    } catch (error) {
      console.error('Error creating private game:', error);
      showAlert('error', 'Error', 'Error al crear la partida privada');
    } finally {
      setLoading(false);
    }
  };

  const handleUnirseConCodigo = async () => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }

    if (!codigoIngresado.trim()) {
      showAlert('warning', 'Código requerido', 'Por favor ingresa el código de la sala');
      return;
    }

    setLoading(true);
    try {
      const result = await socketService.unirseConCodigo(
        codigoIngresado.trim().toUpperCase(),
        nombre.trim(),
        passwordIngresada || undefined
      );

      if (result.success) {
        if (result.message?.includes('Esperando')) {
          // Partida con aprobación, esperando al host
          setEsperandoAprobacion(true);
          showAlert('info', 'Solicitud enviada', result.message);
        } else {
          // Unión directa - navegar a la sala
          setMostrarModalCodigo(false);
          if (result.mesaId) {
            navigateToGame(result.mesaId);
          }
        }
      } else {
        showAlert('error', 'Error', result.message || 'Error al unirse');
      }
    } catch (error) {
      console.error('Error joining with code:', error);
      showAlert('error', 'Error', 'Error al unirse con código');
    } finally {
      setLoading(false);
    }
  };

  const handleResponderSolicitud = async (solicitanteId: string, aceptar: boolean) => {
    try {
      const mesaId = sessionStorage.getItem('truco_mesaId');
      if (!mesaId) return;

      const result = await socketService.responderSolicitud(mesaId, solicitanteId, aceptar);
      if (result.success) {
        setSolicitudesPendientes(prev => prev.filter(s => s.socketId !== solicitanteId));
      }
    } catch (error) {
      console.error('Error responding to request:', error);
    }
  };

  // === MATCHMAKING RANKEADO ===
  const handleBuscarRankeada = async () => {
    if (!nombre.trim()) {
      showAlert('warning', 'Nombre requerido', 'Por favor ingresa tu nombre');
      return;
    }

    if (!usuario) {
      showAlert('warning', 'Cuenta requerida', 'Necesitás una cuenta para jugar partidas rankeadas');
      return;
    }

    if ((monedas ?? 0) < 25) {
      showAlert('warning', 'Monedas insuficientes', 'Necesitás al menos 25 monedas para jugar rankeada');
      return;
    }

    setBuscandoRankeada(true);
    setTiempoEspera(0);
    const maxJ = tamañoSala === '1v1' ? 2 : tamañoSala === '3v3' ? 6 : 4;
    setJugadoresEnCola(1);
    setJugadoresNecesarios(maxJ);
    setFaltanJugadores(maxJ - 1);
    setMatchListo(false);

    try {
      const result = await socketService.buscarRankeada(nombre.trim(), tamañoSala);
      if (!result.success) {
        setBuscandoRankeada(false);
        showAlert('error', 'Error', result.message || 'Error al buscar partida rankeada');
      }
      // Si es exitoso, esperamos los eventos de socket
    } catch (error) {
      console.error('Error searching ranked:', error);
      setBuscandoRankeada(false);
      showAlert('error', 'Error', 'Error al buscar partida rankeada');
    }
  };

  const handleCancelarBusquedaRankeada = async () => {
    try {
      await socketService.cancelarBusqueda();
    } catch (error) {
      console.error('Error canceling search:', error);
    }
    setBuscandoRankeada(false);
    setPosicionCola(0);
    setTiempoEspera(0);
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
          {conectado && usuariosOnline > 0 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-green-400/80 text-sm font-medium">{usuariosOnline} {usuariosOnline === 1 ? 'jugador' : 'jugadores'} online</span>
            </div>
          )}
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
          <div className={`glass rounded-2xl mb-6 animate-slide-up overflow-hidden ${
            isPremium
              ? 'border-2 border-gold-400/70 shadow-lg shadow-gold-500/20'
              : 'border border-celeste-500/30'
          }`}>
            <div className={`h-0.5 bg-gradient-to-r ${
              isPremium
                ? 'from-transparent via-gold-400 to-transparent'
                : 'from-transparent via-celeste-400/60 to-transparent'
            }`} />
            <div className="p-4 flex items-center justify-between">
              {/* Avatar + nombre */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  {usuario.avatar_url ? (
                    <Image src={usuario.avatar_url} alt="" width={44} height={44} className={`w-11 h-11 rounded-full object-cover border-2 shadow-lg ${
                      isPremium
                        ? 'border-gold-400/70 shadow-gold-500/30'
                        : 'border-celeste-500/40 shadow-celeste-500/10'
                    }`} unoptimized />
                  ) : (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 shadow-lg ${
                      isPremium
                        ? 'bg-gradient-to-br from-gold-400 to-gold-600 border-gold-400/70 shadow-gold-500/30'
                        : 'bg-gradient-to-br from-celeste-400 to-celeste-700 border-celeste-500/40 shadow-celeste-500/10'
                    }`}>
                      {usuario.apodo[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#1a2a1a] shadow-sm shadow-green-500/50" />
                  {isPremium && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center border border-gold-300/50 shadow-lg shadow-gold-500/40">
                      <span className="text-[10px]">👑</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold truncate">{usuario.apodo}</span>
                    {isPremium && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded shadow-sm shadow-gold-500/30">
                        PRO
                      </span>
                    )}
                  </div>
                  <div className={`text-xs ${isPremium ? 'text-gold-400/70' : 'text-celeste-400/50'}`}>
                    {isPremium ? '⭐ Premium' : 'En linea'}
                  </div>
                </div>
                {monedas !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-500/15 border border-gold-500/30">
                    <span className="text-gold-400 text-sm">&#x1FA99;</span>
                    <span className="text-gold-300 font-bold text-sm">{monedas}</span>
                  </div>
                )}
                {usuario && showAds && videosRestantes !== null && videosRestantes > 0 && (
                  <button
                    onClick={() => setMostrarRewardedAd(true)}
                    disabled={videoCooldown > 0}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      videoCooldown > 0
                        ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:text-green-300'
                    }`}
                  >
                    <span>&#x1F4FA;</span>
                    {videoCooldown > 0
                      ? <span>{videoCooldown}s</span>
                      : <span>+{recompensaPorVideo}</span>
                    }
                  </button>
                )}
              </div>

              {/* Desktop: nav links estilizados */}
              <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                <Link href="/tutorial" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-green-500/10 transition-all">
                  <svg className="w-4 h-4 text-green-400/60 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-xs font-medium text-white/50 group-hover:text-green-300 transition-colors">Tutorial</span>
                </Link>
                <Link href="/perfil" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-celeste-500/10 transition-all">
                  <svg className="w-4 h-4 text-celeste-400/60 group-hover:text-celeste-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs font-medium text-white/50 group-hover:text-celeste-300 transition-colors">Mi Perfil</span>
                </Link>
                <Link href="/tienda" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gold-500/10 transition-all">
                  <svg className="w-4 h-4 text-gold-400/60 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span className="text-xs font-medium text-white/50 group-hover:text-gold-300 transition-colors">Tienda</span>
                </Link>
                <Link href="/ranking" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-purple-500/10 transition-all">
                  <svg className="w-4 h-4 text-purple-400/60 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-xs font-medium text-white/50 group-hover:text-purple-300 transition-colors">Ranking</span>
                </Link>
                <Link href="/settings" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-all">
                  <svg className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs font-medium text-white/40 group-hover:text-white/70 transition-colors">Config</span>
                </Link>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  onClick={handleCerrarSesion}
                  className="group flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-all"
                >
                  <svg className="w-4 h-4 text-red-400/40 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-xs font-medium text-white/40 group-hover:text-red-300 transition-colors">Salir</span>
                </button>
              </div>

              {/* Mobile: hamburger menu */}
              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:border-celeste-500/30 transition-all active:scale-95 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
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

        {/* Banner Premium CTA - solo para no-premium */}
        {usuario && showAds && (
          <button
            onClick={async () => {
              if (cargandoPremium) return;
              setCargandoPremium(true);
              try {
                const res = await fetch('/api/payments/premium', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: usuario.id }),
                });
                const data = await res.json();
                if (data.error) {
                  showAlert('error', 'Error de pago', data.error);
                  return;
                }
                if (data.init_point) {
                  window.location.href = data.init_point;
                }
              } catch (err) {
                console.error('Error creando pago:', err);
                showAlert('error', 'Error de conexión', 'Error al conectar con MercadoPago. Intenta de nuevo.');
              } finally {
                setCargandoPremium(false);
              }
            }}
            disabled={cargandoPremium}
            className="group block w-full mb-6 animate-slide-up text-left disabled:opacity-70"
          >
            <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-r from-gold-900/20 via-gold-800/10 to-gold-900/20 p-4 sm:p-5 transition-all hover:border-gold-400/50 hover:shadow-lg hover:shadow-gold-500/10">
              {/* Brillo decorativo */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-gold-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-radial from-celeste-400/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 flex items-center justify-center text-xl sm:text-2xl">
                    &#x1F451;
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gold-300 text-sm sm:text-base">Pase Premium</span>
                      <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-[10px] sm:text-xs font-semibold border border-gold-500/30">$1 USD</span>
                    </div>
                    <p className="text-white/50 text-[11px] sm:text-xs mt-0.5 leading-tight">
                      Sin anuncios · Cosmeticos premium gratis · Audios custom · Bonus x1.5
                    </p>
                  </div>
                </div>
                <div className="shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-gold-500/20 to-gold-600/20 border border-gold-500/30 text-gold-300 text-xs sm:text-sm font-semibold group-hover:from-gold-500/30 group-hover:to-gold-600/30 transition-all whitespace-nowrap">
                  {cargandoPremium ? 'Redirigiendo...' : 'Obtener'}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Aviso Premium por expirar */}
        {usuario && isPremium && premiumExpiry && (() => {
          const diasRestantes = Math.ceil((premiumExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (diasRestantes <= 3 && diasRestantes > 0) {
            return (
              <div className="mb-6 animate-slide-up rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-900/20 via-amber-800/10 to-amber-900/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">&#x26A0;&#xFE0F;</span>
                  <div>
                    <p className="text-amber-300 font-semibold text-sm">Tu Premium expira en {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}</p>
                    <p className="text-white/50 text-xs mt-0.5">Renová para seguir disfrutando sin anuncios y beneficios exclusivos</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (cargandoPremium) return;
                      setCargandoPremium(true);
                      try {
                        const res = await fetch('/api/payments/premium', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: usuario.id }),
                        });
                        const data = await res.json();
                        if (data.init_point) window.location.href = data.init_point;
                      } catch { showAlert('error', 'Error', 'Error al conectar con MercadoPago'); }
                      finally { setCargandoPremium(false); }
                    }}
                    className="ml-auto shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all"
                  >
                    Renovar
                  </button>
                </div>
              </div>
            );
          }
          if (diasRestantes <= 0) {
            return (
              <div className="mb-6 animate-slide-up rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-900/20 via-red-800/10 to-red-900/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">&#x274C;</span>
                  <div>
                    <p className="text-red-300 font-semibold text-sm">Tu Premium ha expirado</p>
                    <p className="text-white/50 text-xs mt-0.5">Renová ahora para recuperar tus beneficios</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (cargandoPremium) return;
                      setCargandoPremium(true);
                      try {
                        const res = await fetch('/api/payments/premium', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: usuario.id }),
                        });
                        const data = await res.json();
                        if (data.init_point) window.location.href = data.init_point;
                      } catch { showAlert('error', 'Error', 'Error al conectar con MercadoPago'); }
                      finally { setCargandoPremium(false); }
                    }}
                    className="ml-auto shrink-0 px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-all"
                  >
                    Renovar
                  </button>
                </div>
              </div>
            );
          }
          return null;
        })()}

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

                          {partida.esRankeada && (
                            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                              ⚔️ Rankeada
                            </span>
                          )}

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
                      {/* Botón eliminar partida (solo si está esperando) */}
                      {partida.estado === 'esperando' && (
                        <button
                          onClick={() => handleEliminarPartida(partida.mesaId)}
                          disabled={loading}
                          className="px-3 py-3 rounded-xl font-bold transition-all duration-300 bg-red-900/30 text-red-400 hover:bg-red-800/50 hover:text-red-300 border border-red-700/40 disabled:opacity-50"
                          title="Cancelar partida"
                        >
                          <TrashIcon className="w-5 h-5" />
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
                    Entrada: 25 monedas por jugador. Recompensa mayor al ganar.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Botón Buscar Partida (principal) */}
          <button
            onClick={esRankeada && usuario ? handleBuscarRankeada : handleBuscarPartida}
            disabled={buscandoPartida || buscandoRankeada || loading || !nombre.trim() || (esRankeada && (monedas ?? 0) < 25)}
            className={`w-full text-white text-lg py-4 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg font-bold ${
              esRankeada
                ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 shadow-gold-500/30'
                : 'bg-gradient-to-r from-celeste-500 to-celeste-600 hover:from-celeste-400 hover:to-celeste-500 shadow-celeste-600/30'
            }`}
          >
            {buscandoPartida || buscandoRankeada ? (
              <span className="flex items-center justify-center gap-2">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                Buscando partida...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                {esRankeada ? `🏆 Buscar Rankeada ${tamañoSala} (25 monedas)` : `Buscar Partida ${tamañoSala}`}
              </span>
            )}
          </button>

          {/* Botones secundarios */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Botón Crear Partida Privada */}
            <button
              onClick={() => setMostrarModalPrivada(true)}
              disabled={loading || buscandoPartida || !nombre.trim()}
              className="group py-3 px-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 to-emerald-800/15 hover:from-emerald-800/30 hover:to-emerald-700/25 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2 text-emerald-300/80 group-hover:text-emerald-200 transition-colors">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-semibold">Crear Privada</span>
              </span>
            </button>

            {/* Botón Unirse con Código */}
            <button
              onClick={() => setMostrarModalCodigo(true)}
              disabled={loading || buscandoPartida || !nombre.trim()}
              className="group py-3 px-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-purple-800/15 hover:from-purple-800/30 hover:to-purple-700/25 hover:border-purple-400/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2 text-purple-300/80 group-hover:text-purple-200 transition-colors">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-sm font-semibold">Unirse con Código</span>
              </span>
            </button>
          </div>

          {/* Botón Crear Partida Pública (terciario) */}
          <button
            onClick={handleCrearPartida}
            disabled={loading || buscandoPartida || !nombre.trim()}
            className="group w-full mt-3 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2 text-white/50 group-hover:text-white/70 transition-colors text-sm">
              <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Crear Partida Pública
            </span>
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
                            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                              ⚔️ Rankeada
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

          <div className="border-t border-celeste-600/20 pt-4">
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
          rewardAmount={recompensaPorVideo}
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
      {/* Overlay Buscando Partida */}
      {buscandoPartida && mesaBuscando && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            {/* Icono de búsqueda animado */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-celeste-500/30 border-t-celeste-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 text-celeste-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Buscando partida {tamañoSala}...</h3>
              <p className="text-celeste-300/70 text-sm">Esperando que otro jugador se una</p>
            </div>

            {/* Puntos animados */}
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 bg-celeste-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>

            {/* Botón cancelar */}
            <button
              onClick={handleCancelarBusqueda}
              className="mt-4 px-6 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 hover:border-red-400/40 transition-all"
            >
              Cancelar búsqueda
            </button>
          </div>
        </div>
      )}

      {/* Modal Menu de Usuario - solo mobile */}
      {menuOpen && usuario && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="glass rounded-2xl max-w-sm w-full border border-celeste-500/30 overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Gradient accent top */}
            <div className="h-1 bg-gradient-to-r from-celeste-500 via-gold-400 to-celeste-500" />

            {/* Header background with subtle pattern */}
            <div className="relative bg-gradient-to-b from-celeste-900/30 to-transparent pt-5 pb-6 px-6">
              {/* Decorative glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-gradient-radial from-celeste-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

              {/* Close button */}
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all active:scale-90"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Avatar */}
              <div className="relative flex flex-col items-center">
                <div className="relative mb-3">
                  {usuario.avatar_url ? (
                    <Image src={usuario.avatar_url} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover border-[3px] border-celeste-500/50 shadow-xl shadow-celeste-500/20" unoptimized />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-celeste-400 to-celeste-700 flex items-center justify-center text-white font-bold text-3xl border-[3px] border-celeste-500/50 shadow-xl shadow-celeste-500/20">
                      {usuario.apodo[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-[3px] border-[#1a2a1a] shadow-lg shadow-green-500/40" />
                </div>

                <h3 className="text-white font-bold text-xl">{usuario.apodo}</h3>
                <p className="text-celeste-400/50 text-sm mt-0.5">Jugador registrado</p>

                {/* Coins display */}
                {monedas !== null && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-500/15 border border-gold-500/30 mt-3">
                    <span className="text-gold-400 text-lg">&#x1FA99;</span>
                    <span className="text-gold-300 font-bold text-lg">{monedas}</span>
                    <span className="text-gold-400/40 text-sm">monedas</span>
                  </div>
                )}

                {/* Video reward button */}
                {showAds && videosRestantes !== null && videosRestantes > 0 && (
                  <button
                    onClick={() => { setMostrarRewardedAd(true); setMenuOpen(false); }}
                    disabled={videoCooldown > 0}
                    className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      videoCooldown > 0
                        ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:text-green-300'
                    }`}
                  >
                    <span>&#x1F4FA;</span>
                    {videoCooldown > 0
                      ? <span>Espera {videoCooldown}s</span>
                      : <span>Ver anuncio +{recompensaPorVideo} monedas</span>
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Navigation grid */}
            <div className="grid grid-cols-2 gap-3 px-5 pb-4">
              <Link
                href="/tutorial"
                onClick={() => setMenuOpen(false)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-green-500/10 hover:border-green-500/25 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center group-hover:bg-green-500/25 group-hover:scale-110 transition-all duration-200">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-sm text-white/60 group-hover:text-green-300 font-medium transition-colors">Tutorial</span>
              </Link>

              <Link
                href="/perfil"
                onClick={() => setMenuOpen(false)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-celeste-500/10 hover:border-celeste-500/25 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-celeste-500/15 flex items-center justify-center group-hover:bg-celeste-500/25 group-hover:scale-110 transition-all duration-200">
                  <svg className="w-6 h-6 text-celeste-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm text-white/60 group-hover:text-celeste-300 font-medium transition-colors">Mi Perfil</span>
              </Link>

              <Link
                href="/tienda"
                onClick={() => setMenuOpen(false)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-gold-500/10 hover:border-gold-500/25 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-gold-500/15 flex items-center justify-center group-hover:bg-gold-500/25 group-hover:scale-110 transition-all duration-200">
                  <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <span className="text-sm text-white/60 group-hover:text-gold-300 font-medium transition-colors">Tienda</span>
              </Link>

              <Link
                href="/ranking"
                onClick={() => setMenuOpen(false)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-purple-500/10 hover:border-purple-500/25 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center group-hover:bg-purple-500/25 group-hover:scale-110 transition-all duration-200">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm text-white/60 group-hover:text-purple-300 font-medium transition-colors">Ranking</span>
              </Link>

              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/15 group-hover:scale-110 transition-all duration-200">
                  <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm text-white/60 group-hover:text-white/80 font-medium transition-colors">Config</span>
              </Link>
            </div>

            {/* Feedback button */}
            <div className="px-5 pb-3">
              <button
                onClick={() => { setFeedbackOpen(true); setMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-emerald-400/70 bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Enviar Sugerencia
              </button>
            </div>

            {/* Logout */}
            <div className="px-5 pb-5">
              <button
                onClick={() => { handleCerrarSesion(); setMenuOpen(false); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-red-400/60 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-300 transition-all"
              >
                Cerrar Sesion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Partida Privada */}
      {mostrarModalPrivada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMostrarModalPrivada(false)}>
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-emerald-500/40 bg-gradient-to-b from-emerald-900/30 to-transparent" onClick={e => e.stopPropagation()}>
            <h3 className="font-[var(--font-cinzel)] text-2xl font-bold text-emerald-400 mb-4 text-center">
              🔒 Crear Partida Privada
            </h3>

            {/* Tipo de partida privada */}
            <div className="mb-4">
              <label className="text-white/70 text-sm mb-2 block">Tipo de acceso:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTipoPrivada('password')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    tipoPrivada === 'password'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  🔑 Con Contraseña
                </button>
                <button
                  onClick={() => setTipoPrivada('aprobacion')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    tipoPrivada === 'aprobacion'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  ✋ Con Aprobación
                </button>
              </div>
            </div>

            {/* Contraseña (solo si es tipo password) */}
            {tipoPrivada === 'password' && (
              <div className="mb-4">
                <label className="text-white/70 text-sm mb-2 block">Contraseña:</label>
                <input
                  type="password"
                  value={passwordPrivada}
                  onChange={(e) => setPasswordPrivada(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            )}

            {tipoPrivada === 'aprobacion' && (
              <p className="text-white/50 text-sm mb-4 text-center">
                Vos aprobarás o rechazarás cada solicitud de unión
              </p>
            )}

            {/* Tamaño de sala */}
            <div className="mb-4">
              <label className="text-white/70 text-sm mb-2 block">Tamaño de sala:</label>
              <div className="flex gap-2">
                {(['1v1', '2v2', '3v3'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setTamañoSala(size)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      tamañoSala === size
                        ? 'bg-celeste-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setMostrarModalPrivada(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearPartidaPrivada}
                disabled={loading || (tipoPrivada === 'password' && passwordPrivada.length < 4)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Sala'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unirse con Código */}
      {mostrarModalCodigo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !esperandoAprobacion && setMostrarModalCodigo(false)}>
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-purple-500/40 bg-gradient-to-b from-purple-900/30 to-transparent" onClick={e => e.stopPropagation()}>
            <h3 className="font-[var(--font-cinzel)] text-2xl font-bold text-purple-400 mb-4 text-center">
              🎟️ Unirse con Código
            </h3>

            {esperandoAprobacion ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-white/70">Esperando aprobación del anfitrión...</p>
                <button
                  onClick={() => {
                    setEsperandoAprobacion(false);
                    setMostrarModalCodigo(false);
                  }}
                  className="mt-4 px-6 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-all"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {/* Código de sala */}
                <div className="mb-4">
                  <label className="text-white/70 text-sm mb-2 block">Código de sala:</label>
                  <input
                    type="text"
                    value={codigoIngresado}
                    onChange={(e) => setCodigoIngresado(e.target.value.toUpperCase())}
                    placeholder="TRUCO-XXXXXX"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-xl font-mono tracking-wider placeholder-white/40 focus:outline-none focus:border-purple-500/50 uppercase"
                    maxLength={12}
                  />
                </div>

                {/* Contraseña (opcional) */}
                <div className="mb-4">
                  <label className="text-white/70 text-sm mb-2 block">Contraseña (si la sala tiene):</label>
                  <input
                    type="password"
                    value={passwordIngresada}
                    onChange={(e) => setPasswordIngresada(e.target.value)}
                    placeholder="Dejá vacío si no tiene"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setMostrarModalCodigo(false)}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUnirseConCodigo}
                    disabled={loading || !codigoIngresado.trim()}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold hover:from-purple-500 hover:to-purple-400 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Uniéndose...' : 'Unirse'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Buscando Rankeada */}
      {buscandoRankeada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gold-500/40 bg-gradient-to-b from-gold-900/30 to-transparent text-center">
            <h3 className="font-[var(--font-cinzel)] text-2xl font-bold text-gold-400 mb-4">
              Buscando Partida Rankeada
            </h3>

            {matchListo ? (
              <>
                <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-emerald-600/20 border-4 border-emerald-500">
                  <span className="text-4xl">&#10003;</span>
                </div>
                <p className="text-emerald-400 font-bold text-xl mb-2">Todos los jugadores listos</p>
                <p className="text-white/70 mb-6">La partida comenzara en instantes...</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-6 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />

                <p className="text-white/70 mb-3">Modo: <span className="text-gold-400 font-bold">{tamañoSala}</span> &middot; <span className="text-gold-400 font-bold">40 pts</span></p>

                {/* Indicador de jugadores */}
                <div className="mb-4">
                  <div className="flex justify-center gap-2 mb-3">
                    {Array.from({ length: jugadoresNecesarios || (tamañoSala === '1v1' ? 2 : tamañoSala === '3v3' ? 6 : 4) }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                          idx < jugadoresEnCola
                            ? 'bg-emerald-600/40 border-2 border-emerald-400 text-emerald-300 scale-110'
                            : 'bg-white/5 border-2 border-white/20 text-white/30'
                        }`}
                      >
                        {idx < jugadoresEnCola ? '&#10003;' : '?'}
                      </div>
                    ))}
                  </div>
                  <p className="text-gold-400 font-bold text-lg">
                    {faltanJugadores > 0
                      ? `Faltan ${faltanJugadores} jugador${faltanJugadores !== 1 ? 'es' : ''}`
                      : 'Todos listos'}
                  </p>
                  <p className="text-white/40 text-sm mt-1">
                    {jugadoresEnCola}/{jugadoresNecesarios || (tamañoSala === '1v1' ? 2 : tamañoSala === '3v3' ? 6 : 4)} jugadores encontrados
                  </p>
                </div>

                {tiempoEspera > 0 && (
                  <p className="text-white/40 text-xs mb-4">
                    Tiempo de espera: {tiempoEspera}s
                  </p>
                )}

                <button
                  onClick={handleCancelarBusquedaRankeada}
                  className="px-6 py-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-all"
                >
                  Cancelar búsqueda
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Solicitudes Pendientes (para host) */}
      {solicitudesPendientes.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 space-y-2">
          {solicitudesPendientes.map(solicitud => (
            <div key={solicitud.socketId} className="glass rounded-xl p-4 border border-emerald-500/40 bg-gradient-to-r from-emerald-900/50 to-transparent animate-slide-up">
              <p className="text-white text-sm mb-2">
                <span className="text-emerald-400 font-bold">{solicitud.nombre}</span> quiere unirse
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResponderSolicitud(solicitud.socketId, true)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-all"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => handleResponderSolicitud(solicitud.socketId, false)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-red-600/50 text-white text-sm hover:bg-red-500/50 transition-all"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Código de Sala Creada */}
      {codigoSalaCreada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-emerald-500/40 bg-gradient-to-b from-emerald-900/30 to-transparent text-center">
            <h3 className="font-[var(--font-cinzel)] text-2xl font-bold text-emerald-400 mb-4">
              Sala Creada
            </h3>
            <p className="text-white/70 mb-4">Compartí este código con tus amigos:</p>
            <div className="bg-black/30 rounded-xl p-4 mb-4">
              <p className="text-3xl font-mono font-bold text-white tracking-widest">{codigoSalaCreada}</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codigoSalaCreada);
                  showAlert('success', 'Copiado', 'Código copiado al portapapeles');
                }}
                className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all"
              >
                Copiar Código
              </button>
              <button
                onClick={() => {
                  if (mesaIdSalaCreada) {
                    navigateToGame(mesaIdSalaCreada);
                  }
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-700 text-wood-950 font-bold hover:from-gold-500 hover:to-gold-600 transition-all shadow-lg shadow-gold-600/20"
              >
                Ir a la Sala
              </button>
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
