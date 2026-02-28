'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import socketService from '@/lib/socket';
import { useUploadThing } from '@/lib/uploadthing';
import { RewardedAd } from '@/components/ads';
import AlertModal, { useAlertModal } from '@/components/AlertModal';

interface Stats {
  partidas_jugadas: number;
  partidas_ganadas: number;
  partidas_perdidas: number;
  racha_actual: number;
  mejor_racha: number;
  elo: number;
  apodo: string;
}

interface Partida {
  id: number;
  modo: string;
  equipo_ganador: number;
  puntaje_eq1: number;
  puntaje_eq2: number;
  mi_equipo: number;
  jugada_en: string;
  duracion_seg: number | null;
  rivales: string | null;
}

interface Amigo {
  id: number;
  apodo: string;
  elo: number;
  partidas_ganadas: number;
  partidas_jugadas: number;
  online: boolean;
}

interface AudioCustom {
  id: number;
  tipo_audio: string;
  url_archivo: string;
  file_key: string | null;
  creado_en: string;
}

interface Logro {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  categoria: string;
  puntos_exp: number;
  desbloqueado_en: string | null;
}

interface EstadisticasDetalladas {
  envidos_cantados: number;
  envidos_ganados: number;
  trucos_cantados: number;
  trucos_ganados: number;
  flores_cantadas: number;
  flores_ganadas: number;
  partidas_1v1: number;
  partidas_2v2: number;
  partidas_3v3: number;
  victorias_1v1: number;
  victorias_2v2: number;
  victorias_3v3: number;
  matas_jugadas: number;
  partidas_perfectas: number;
  idas_al_mazo: number;
  nivel: number;
  experiencia: number;
}

interface Cosmetico {
  id: string;
  tipo: string;
  nombre: string;
  descripcion: string;
  imagen_preview: string;
  precio_monedas: number;
  nivel_requerido: number;
  es_premium: number;
  desbloqueado: number;
  equipado: number;
}

const MARCOS_AVATAR: Record<string, { border: string; shadow: string; ring: string }> = {
  marco_ninguno: { border: "border-gold-600/50", shadow: "", ring: "" },
  marco_bronce: { border: "border-amber-700", shadow: "shadow-lg shadow-amber-700/30", ring: "ring-1 ring-amber-600/40" },
  marco_plata: { border: "border-gray-300", shadow: "shadow-lg shadow-gray-300/30", ring: "ring-1 ring-gray-300/40" },
  marco_oro: { border: "border-yellow-400", shadow: "shadow-lg shadow-yellow-400/40", ring: "ring-2 ring-yellow-400/50" },
  marco_diamante: { border: "border-cyan-300", shadow: "shadow-lg shadow-cyan-300/50", ring: "ring-2 ring-cyan-300/60" },
};

const FONDOS_PERFIL: Record<string, { gradient: string; name: string }> = {
  fondo_clasico: { gradient: '', name: 'Clásico' },
  fondo_celeste: { gradient: 'bg-gradient-to-br from-sky-900/30 via-cyan-900/20 to-blue-900/30', name: 'Celeste' },
  fondo_atardecer: { gradient: 'bg-gradient-to-br from-orange-900/30 via-rose-900/20 to-amber-900/30', name: 'Atardecer' },
  fondo_galaxia: { gradient: 'bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-violet-900/40', name: 'Galaxia' },
  fondo_fuego: { gradient: 'bg-gradient-to-br from-red-900/40 via-orange-900/30 to-yellow-900/20', name: 'Fuego' },
};

const TIPOS_AUDIO = [
  { key: 'truco', label: 'Truco' },
  { key: 'retruco', label: 'Retruco' },
  { key: 'vale4', label: 'Vale 4' },
  { key: 'envido', label: 'Envido' },
  { key: 'real-envido', label: 'Real Envido' },
  { key: 'falta-envido', label: 'Falta Envido' },
  { key: 'flor', label: 'Flor' },
  { key: 'contra-flor', label: 'Contra Flor' },
  { key: 'quiero', label: 'Quiero' },
  { key: 'no-quiero', label: 'No Quiero' },
  { key: 'me-voy-al-mazo', label: 'Me voy al mazo' },
  { key: 'perros', label: 'Echar los Perros' },
];

export default function PerfilPage() {
  const { alertState, showAlert, closeAlert } = useAlertModal();
  const [stats, setStats] = useState<Stats | null>(null);
  const [historial, setHistorial] = useState<Partida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<{ id: number; apodo: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [tab, setTab] = useState<'stats' | 'historial' | 'amigos' | 'audios' | 'mesa' | 'logros' | 'tienda'>('stats');

  // Premium state
  const [esPremium, setEsPremium] = useState(false);
  const [diasRestantesPremium, setDiasRestantesPremium] = useState(0);
  const [cargandoPago, setCargandoPago] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [audiosCustom, setAudiosCustom] = useState<AudioCustom[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTipoTarget, setUploadTipoTarget] = useState<string | null>(null);
  // Personalización de mesa (Premium)
  const [temaMesa, setTemaMesa] = useState('clasico');
  const [reversoCartas, setReversoCartas] = useState('clasico');
  const [guardandoPersonalizacion, setGuardandoPersonalizacion] = useState(false);

  // Logros y progresión
  const [logros, setLogros] = useState<Logro[]>([]);
  const [nivel, setNivel] = useState(1);
  const [experiencia, setExperiencia] = useState(0);
  const [expRequerida, setExpRequerida] = useState(100);
  const [estadisticasDetalladas, setEstadisticasDetalladas] = useState<EstadisticasDetalladas | null>(null);

  // Cosméticos/Tienda
  const [cosmeticos, setCosmeticos] = useState<Cosmetico[]>([]);
  const [comprando, setComprando] = useState<string | null>(null);
  const [equipando, setEquipando] = useState<string | null>(null);
  const [monedas, setMonedas] = useState<number | null>(null);
  const [mostrarRewardedAd, setMostrarRewardedAd] = useState(false);
  const [videosRestantes, setVideosRestantes] = useState<number | null>(null);
  const [videoCooldown, setVideoCooldown] = useState(0);
  const [comprandoPack, setComprandoPack] = useState<string | null>(null);

  // Refs for dynamic headers in UploadThing hooks
  const uploadTipoRef = useRef<string>('');
  const userIdRef = useRef<string>('');

  const getUserId = (): number | null => {
    const saved = sessionStorage.getItem('truco_usuario');
    if (!saved) return null;
    try {
      return JSON.parse(saved).id;
    } catch {
      return null;
    }
  };

  // UploadThing hooks
  const { startUpload: startAudioUpload } = useUploadThing("audioUploader", {
    headers: useCallback(() => ({
      "x-user-id": userIdRef.current,
      "x-tipo-audio": uploadTipoRef.current,
    }), []),
    onUploadProgress: useCallback((p: number) => {
      setUploadProgress(p);
    }, []),
    onClientUploadComplete: useCallback(async () => {
      // Refresh audios from server
      try {
        const result = await socketService.obtenerPerfil();
        if (result.success) {
          setAudiosCustom(result.audiosCustom || []);
        }
      } catch { /* ignore */ }
      setUploading(null);
      setUploadProgress(0);
      setUploadError(null);
    }, []),
    onUploadError: useCallback((error: Error) => {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Error al subir audio');
      setUploading(null);
      setUploadProgress(0);
    }, []),
  });

  const { startUpload: startAvatarUpload } = useUploadThing("avatarUploader", {
    headers: useCallback(() => ({
      "x-user-id": userIdRef.current,
    }), []),
    onClientUploadComplete: useCallback(async () => {
      try {
        const result = await socketService.obtenerPerfil();
        if (result.success) {
          setAvatarUrl(result.avatar_url || null);
        }
      } catch { /* ignore */ }
      setUploadingAvatar(false);
    }, []),
    onUploadError: useCallback((error: Error) => {
      console.error('Avatar upload error:', error);
      setUploadError(error.message || 'Error al subir avatar');
      setUploadingAvatar(false);
    }, []),
  });

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        await socketService.connect();

        const savedUsuario = sessionStorage.getItem('truco_usuario');
        const savedPw = sessionStorage.getItem('truco_auth');
        if (savedUsuario && savedPw) {
          const u = JSON.parse(savedUsuario);
          await socketService.login(u.apodo, savedPw);
        }

        const result = await socketService.obtenerPerfil();
        if (result.success) {
          setStats(result.stats);
          setHistorial(result.historial);
          setEsPremium(!!result.es_premium);
          setAvatarUrl(result.avatar_url || null);
          setAudiosCustom(result.audiosCustom || []);
        }

        // Cargar estado premium con expiracion
        const premiumResult = await socketService.obtenerEstadoPremium();
        if (premiumResult.success) {
          setEsPremium(!!premiumResult.es_premium);
          setDiasRestantesPremium(premiumResult.dias_restantes || 0);
        }

        const amigosResult = await socketService.obtenerAmigos();
        if (amigosResult.success) {
          setAmigos(amigosResult.amigos);
        }

        // Cargar personalización de mesa
        const persResult = await socketService.obtenerPersonalizacion();
        if (persResult.success) {
          setTemaMesa(persResult.tema_mesa || 'clasico');
          setReversoCartas(persResult.reverso_cartas || 'clasico');
        }

        // Cargar logros y nivel
        const logrosResult = await socketService.obtenerLogros();
        if (logrosResult.success) {
          setLogros(logrosResult.logros || []);
          setNivel(logrosResult.nivel || 1);
          setExperiencia(logrosResult.experiencia || 0);
          setExpRequerida(logrosResult.expRequerida || 100);
        }

        // Cargar estadísticas detalladas
        const statsDetResult = await socketService.obtenerEstadisticasDetalladas();
        if (statsDetResult.success) {
          setEstadisticasDetalladas(statsDetResult.estadisticas);
        }

        // Cargar cosméticos
        const cosmeticosResult = await socketService.obtenerCosmeticos();
        if (cosmeticosResult.success) {
          setCosmeticos(cosmeticosResult.cosmeticos || []);
        }

        // Cargar monedas y estado de videos
        const monedasResult = await socketService.obtenerMonedas();
        if (monedasResult.success) {
          setMonedas(monedasResult.monedas ?? 0);
        }
        const videosResult = await socketService.obtenerEstadoVideos();
        if (videosResult.success) {
          setVideosRestantes(videosResult.videosRestantes ?? 0);
          if (videosResult.cooldownRestante && videosResult.cooldownRestante > 0) {
            setVideoCooldown(videosResult.cooldownRestante);
          }
        }
      } catch (err) {
        console.error('Error cargando perfil:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarPerfil();
  }, []);

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

  const handleBuscar = async () => {
    if (!busqueda.trim()) return;
    setBuscando(true);
    try {
      const result = await socketService.buscarUsuarios(busqueda.trim());
      if (result.success) {
        setResultadosBusqueda(result.usuarios);
      }
    } catch {
      /* ignorar */
    } finally {
      setBuscando(false);
    }
  };

  const handleAgregarAmigo = async (amigoId: number) => {
    const result = await socketService.agregarAmigo(amigoId);
    if (result.success) {
      const amigosResult = await socketService.obtenerAmigos();
      if (amigosResult.success) setAmigos(amigosResult.amigos);
      setResultadosBusqueda([]);
      setBusqueda('');
    }
  };

  const handleEliminarAmigo = async (amigoId: number) => {
    const result = await socketService.eliminarAmigo(amigoId);
    if (result.success) {
      setAmigos(prev => prev.filter(a => Number(a.id) !== amigoId));
    }
  };

  const handleTogglePremium = async () => {
    try {
      await socketService.togglePremium();
      const newVal = !esPremium;
      setEsPremium(newVal);
      // Update sessionStorage
      const saved = sessionStorage.getItem('truco_usuario');
      if (saved) {
        const u = JSON.parse(saved);
        u.es_premium = newVal;
        sessionStorage.setItem('truco_usuario', JSON.stringify(u));
      }
    } catch (err) {
      console.error('Error toggling premium:', err);
    }
  };

  const handleComprarPremium = async () => {
    const userId = getUserId();
    if (!userId) return showAlert('warning', 'Sesión requerida', 'Debes estar logueado para comprar premium');
    setCargandoPago(true);
    try {
      const res = await fetch('/api/payments/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
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
      setCargandoPago(false);
    }
  };

  const handleComprarPack = async (packId: string) => {
    const userId = getUserId();
    if (!userId) return showAlert('warning', 'Sesión requerida', 'Debes estar logueado para comprar monedas');
    setComprandoPack(packId);
    try {
      const res = await fetch('/api/payments/monedas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, packId }),
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
      console.error('Error creando pago de monedas:', err);
      showAlert('error', 'Error de conexión', 'Error al conectar con MercadoPago. Intenta de nuevo.');
    } finally {
      setComprandoPack(null);
    }
  };

  const handleGuardarPersonalizacion = async () => {
    setGuardandoPersonalizacion(true);
    console.log('[Perfil] Guardando personalizacion:', { temaMesa, reversoCartas, connected: socketService.connected() });
    try {
      const result = await socketService.actualizarPersonalizacion(temaMesa, reversoCartas);
      console.log('[Perfil] Resultado actualizar-personalizacion:', result);
      if (result.success) {
        // Guardar en sessionStorage para usarlo en el juego
        const saved = sessionStorage.getItem('truco_usuario');
        if (saved) {
          const u = JSON.parse(saved);
          u.tema_mesa = temaMesa;
          u.reverso_cartas = reversoCartas;
          sessionStorage.setItem('truco_usuario', JSON.stringify(u));
        }
        showAlert('success', 'Guardado', 'Personalización guardada correctamente');
      } else {
        console.error('[Perfil] Error:', result.error);
        showAlert('error', 'Error', result.error || 'No se pudo guardar');
      }
    } catch (err) {
      console.error('Error guardando personalizacion:', err);
      showAlert('error', 'Error al guardar', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGuardandoPersonalizacion(false);
    }
  };

  const handleComprarCosmetico = async (cosmeticoId: string) => {
    setComprando(cosmeticoId);
    try {
      const result = await socketService.comprarCosmetico(cosmeticoId);
      if (result.success) {
        // El backend auto-equipa al comprar, actualizar UI correspondiente
        const cosmeticoComprado = cosmeticos.find(c => c.id === cosmeticoId);
        setCosmeticos(prev => prev.map(c => {
          if (c.id === cosmeticoId) {
            return { ...c, desbloqueado: 1, equipado: 1 };
          }
          // Desequipar otros del mismo tipo
          if (cosmeticoComprado && c.tipo === cosmeticoComprado.tipo) {
            return { ...c, equipado: 0 };
          }
          return c;
        }));
        // Actualizar balance de monedas
        if (cosmeticoComprado && monedas !== null) {
          setMonedas(monedas - cosmeticoComprado.precio_monedas);
        }
      } else {
        showAlert('error', 'Error', result.error || 'Error al comprar cosmético');
      }
    } catch (err) {
      console.error('Error comprando cosmético:', err);
    } finally {
      setComprando(null);
    }
  };

  const handleEquiparCosmetico = async (cosmeticoId: string, tipo: string) => {
    setEquipando(cosmeticoId);
    try {
      const result = await socketService.equiparCosmetico(cosmeticoId);
      if (result.success) {
        // Actualizar lista de cosméticos - desequipar otros del mismo tipo
        setCosmeticos(prev => prev.map(c => {
          if (c.tipo === tipo) {
            return { ...c, equipado: c.id === cosmeticoId ? 1 : 0 };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Error equipando cosmético:', err);
    } finally {
      setEquipando(null);
    }
  };

  const handleUploadAudio = async (tipoAudio: string, file: File) => {
    const userId = getUserId();
    if (!userId) return;

    // Set refs for dynamic headers
    userIdRef.current = String(userId);
    uploadTipoRef.current = tipoAudio;

    setUploading(tipoAudio);
    setUploadProgress(0);
    setUploadError(null);

    try {
      await startAudioUpload([file]);
    } catch (err) {
      console.error('Error uploading audio:', err);
      setUploadError('Error al subir audio. Verifica formato y peso (max 512KB).');
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    const userId = getUserId();
    if (!userId) return;

    userIdRef.current = String(userId);
    setUploadingAvatar(true);
    setUploadError(null);

    try {
      await startAvatarUpload([file]);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setUploadError('Error al subir avatar. Verifica formato y peso (max 1MB).');
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAudio = async (audioId: number) => {
    try {
      await socketService.eliminarAudioCustom(audioId);
      setAudiosCustom(prev => prev.filter(a => Number(a.id) !== audioId));
    } catch (err) {
      console.error('Error deleting audio:', err);
    }
  };

  const handlePlayAudio = (url: string, tipoAudio: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingAudio === tipoAudio) {
      setPlayingAudio(null);
      return;
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    audioRef.current = audio;
    setPlayingAudio(tipoAudio);
  };

  const getAudioForTipo = (tipo: string): AudioCustom | undefined => {
    return audiosCustom.find(a => a.tipo_audio === tipo);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTipoTarget) return;
    handleUploadAudio(uploadTipoTarget, file);
    setUploadTipoTarget(null);
    e.target.value = '';
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUploadAvatar(file);
    e.target.value = '';
  };

  const winRate = stats && Number(stats.partidas_jugadas) > 0
    ? Math.round((Number(stats.partidas_ganadas) / Number(stats.partidas_jugadas)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-gold-400/60 text-lg">Cargando perfil...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <p className="text-gold-300/50 text-lg mb-4">Necesitas iniciar sesion para ver tu perfil</p>
          <Link href="/lobby" className="text-gold-400 hover:text-gold-300 underline">Ir al lobby</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood p-4 sm:p-6 lg:p-8">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileSelect}
      />

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl font-bold text-gold-400 mb-2">
            Mi Perfil
          </h1>
        </header>

        <Link href="/lobby" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm mb-6 transition-colors">
          ← Volver al lobby
        </Link>

        {/* Card de perfil */}
        <div className={`glass rounded-2xl p-6 mb-6 border border-gold-800/20 ${(() => {
          const fondoEquipado = cosmeticos.find(c => c.tipo === 'fondo_perfil' && c.equipado === 1);
          const fondo = fondoEquipado ? (FONDOS_PERFIL[fondoEquipado.id] || FONDOS_PERFIL.fondo_clasico) : FONDOS_PERFIL.fondo_clasico;
          return fondo.gradient;
        })()}`}>
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="relative group">
              {(() => {
                const marcoEquipado = cosmeticos.find(c => c.tipo === 'marco_avatar' && c.equipado === 1);
                const marco = marcoEquipado ? (MARCOS_AVATAR[marcoEquipado.id] || MARCOS_AVATAR.marco_ninguno) : MARCOS_AVATAR.marco_ninguno;
                return avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={64}
                    height={64}
                    className={`w-16 h-16 rounded-full object-cover border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}
                    unoptimized
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold text-2xl border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}>
                    {stats.apodo[0].toUpperCase()}
                  </div>
                );
              })()}
              {esPremium && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <span className="text-white text-xs">...</span>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-gold-300 font-bold text-2xl">{stats.apodo}</h2>
                {esPremium && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-full">
                    PREMIUM
                  </span>
                )}
              </div>
              <div className="text-gold-500/50 text-sm">ELO: <span className="text-gold-400 font-bold">{stats.elo}</span></div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-celeste-900/20 rounded-xl p-3 text-center border border-celeste-500/10">
              <div className="text-2xl font-bold text-celeste-400">{stats.partidas_jugadas}</div>
              <div className="text-celeste-300/50 text-xs">Jugadas</div>
            </div>
            <div className="bg-green-900/20 rounded-xl p-3 text-center border border-green-500/10">
              <div className="text-2xl font-bold text-green-400">{stats.partidas_ganadas}</div>
              <div className="text-green-300/50 text-xs">Ganadas</div>
            </div>
            <div className="bg-red-900/20 rounded-xl p-3 text-center border border-red-500/10">
              <div className="text-2xl font-bold text-red-400">{stats.partidas_perdidas}</div>
              <div className="text-red-300/50 text-xs">Perdidas</div>
            </div>
            <div className="bg-yellow-900/20 rounded-xl p-3 text-center border border-yellow-500/10">
              <div className="text-2xl font-bold text-yellow-400">{winRate}%</div>
              <div className="text-yellow-300/50 text-xs">Victoria</div>
            </div>
          </div>

          {/* Rachas */}
          <div className="flex gap-4 mt-4">
            <div className="text-sm text-gold-400/60">
              Racha actual: <span className="text-yellow-400 font-bold">{stats.racha_actual}</span>
            </div>
            <div className="text-sm text-gold-400/60">
              Mejor racha: <span className="text-gold-300 font-bold">{stats.mejor_racha}</span>
            </div>
          </div>

          {/* Premium */}
          <div id="premium-section" className="mt-4 pt-4 border-t border-gold-800/20">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Boton dev toggle */}
              <button
                onClick={handleTogglePremium}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  esPremium
                    ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-600/40'
                    : 'bg-gray-600/30 text-gray-300 border border-gray-500/20 hover:bg-gray-600/40'
                }`}
              >
                {esPremium ? 'Desactivar Premium (dev)' : 'Activar Premium (dev)'}
              </button>

              {/* Boton comprar premium con MercadoPago */}
              {!esPremium ? (
                <button
                  onClick={handleComprarPremium}
                  disabled={cargandoPago}
                  className="px-5 py-2 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 shadow-lg shadow-gold-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargandoPago ? 'Redirigiendo...' : '\u{1F451} Comprar Pase Premium - 30 dias'}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500/15 border border-gold-500/30">
                  <span className="text-gold-400 text-sm">{'\u{1F451}'}</span>
                  <div>
                    <div className="text-gold-300 text-sm font-bold">Premium activo</div>
                    {diasRestantesPremium > 0 && (
                      <div className="text-gold-500/60 text-xs">
                        {diasRestantesPremium} {diasRestantesPremium === 1 ? 'dia' : 'dias'} restantes
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['stats', 'logros', 'tienda', 'historial', 'amigos', 'audios', 'mesa'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              {t === 'stats' ? 'Resumen' : t === 'logros' ? '🏆 Logros' : t === 'tienda' ? '🛒 Tienda' : t === 'historial' ? 'Historial' : t === 'amigos' ? 'Amigos' : t === 'audios' ? `${!esPremium ? '👑 ' : ''}Mis Audios` : `${!esPremium ? '👑 ' : ''}Mi Mesa`}
            </button>
          ))}
        </div>

        {/* Historial */}
        {tab === 'historial' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Ultimas partidas</h3>
            {historial.length === 0 ? (
              <p className="text-gold-500/40 text-sm text-center py-8">Aun no jugaste partidas</p>
            ) : (
              <div className="space-y-2">
                {historial.map((p) => {
                  const gane = Number(p.mi_equipo) === Number(p.equipo_ganador);
                  const fecha = new Date(p.jugada_en).toLocaleDateString('es-UY', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  const rivales = p.rivales || 'Invitado';
                  return (
                    <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      gane ? 'bg-green-900/15 border border-green-500/10' : 'bg-red-900/15 border border-red-500/10'
                    }`}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${gane ? 'text-green-400' : 'text-red-400'}`}>
                            {gane ? 'Victoria' : 'Derrota'}
                          </span>
                          <span className="text-gold-500/40 text-xs">{p.modo}</span>
                        </div>
                        <span className="text-celeste-400 text-xs">vs {rivales}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-white text-sm font-medium">
                          {p.puntaje_eq1} - {p.puntaje_eq2}
                        </span>
                        <span className="text-gold-500/40 text-xs">{fecha}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Amigos */}
        {tab === 'amigos' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            {/* Header con título y contador */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-gold-300 font-bold text-lg">Amigos</h3>
                <span className="px-2 py-0.5 rounded-full bg-gold-600/20 text-gold-400 text-xs font-medium">
                  {amigos.length}
                </span>
              </div>
              {amigos.filter(a => a.online).length > 0 && (
                <span className="flex items-center gap-1.5 text-green-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {amigos.filter(a => a.online).length} online
                </span>
              )}
            </div>

            {/* Buscar jugadores */}
            <div className="mb-5">
              <p className="text-gold-500/60 text-xs mb-2">Buscar y agregar nuevos amigos</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="input-glass w-full px-4 py-2.5 rounded-xl text-sm pl-10"
                    placeholder="Ingresa el apodo del jugador..."
                    onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleBuscar}
                  disabled={buscando || !busqueda.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold-600 to-gold-500 text-white hover:from-gold-500 hover:to-gold-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-600/20"
                >
                  {buscando ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  ) : 'Buscar'}
                </button>
              </div>
            </div>

            {/* Resultados de busqueda */}
            {resultadosBusqueda.length > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-green-900/10 border border-green-500/20">
                <p className="text-green-400 text-xs font-medium mb-2">
                  {resultadosBusqueda.length} jugador{resultadosBusqueda.length > 1 ? 'es' : ''} encontrado{resultadosBusqueda.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {resultadosBusqueda.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2.5 border border-green-500/10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                          {u.apodo.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{u.apodo}</span>
                      </div>
                      <button
                        onClick={() => handleAgregarAmigo(u.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/30 text-green-300 rounded-lg hover:bg-green-600/50 transition-all text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Separador */}
            <div className="border-t border-gold-700/20 my-4" />

            {/* Lista de amigos */}
            <div>
              <p className="text-gold-500/60 text-xs mb-3">Tus amigos</p>
              {amigos.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gold-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-gold-400/60 font-medium mb-1">Aún no tenés amigos</p>
                  <p className="text-gold-500/40 text-sm">Usa el buscador de arriba para encontrar jugadores</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Primero los online, luego los offline */}
                  {[...amigos].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(a => (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
                        a.online
                          ? 'bg-green-900/10 border-green-500/20 hover:border-green-500/40'
                          : 'bg-white/5 border-gold-700/10 hover:border-gold-600/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar con indicador de estado */}
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            a.online
                              ? 'bg-gradient-to-br from-green-500 to-green-600'
                              : 'bg-gradient-to-br from-gray-600 to-gray-700'
                          }`}>
                            {a.apodo.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117] ${
                            a.online ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                        </div>
                        {/* Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{a.apodo}</span>
                            {a.online && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-medium">
                                ONLINE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gold-500/50 mt-0.5">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              {a.elo} ELO
                            </span>
                            <span>
                              {a.partidas_ganadas}W / {a.partidas_jugadas - a.partidas_ganadas}L
                            </span>
                            {a.partidas_jugadas > 0 && (
                              <span className={a.partidas_ganadas / a.partidas_jugadas >= 0.5 ? 'text-green-400/60' : 'text-red-400/60'}>
                                ({Math.round((a.partidas_ganadas / a.partidas_jugadas) * 100)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Acciones */}
                      <button
                        onClick={() => handleEliminarAmigo(Number(a.id))}
                        className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                        title="Eliminar amigo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tip */}
            {amigos.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-celeste-900/10 border border-celeste-500/20">
                <p className="text-celeste-400 text-xs">
                  <span className="font-semibold">Tip:</span> Podés invitar a tus amigos online a jugar desde el lobby cuando crees o estés en una partida.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resumen (tab stats) */}
        {tab === 'stats' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Resumen</h3>

            {/* Barra de nivel */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  <span className="text-purple-300 font-bold text-lg">Nivel {nivel}</span>
                </div>
                <span className="text-purple-400/60 text-sm">{experiencia} / {expRequerida} XP</span>
              </div>
              <div className="w-full bg-purple-900/50 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(experiencia / expRequerida) * 100}%` }}
                />
              </div>
            </div>

            {/* Estadísticas detalladas - Premium Analytics */}
            {estadisticasDetalladas && (
              <div className="mb-6 relative">
                {!esPremium && (
                  <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-500/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👑</span>
                      <div>
                        <p className="text-yellow-300 font-bold text-xs">Analytics Premium</p>
                        <p className="text-yellow-400/60 text-[10px]">Conseguí el Pase Premium para ver tus estadísticas detalladas.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className={!esPremium ? 'opacity-40 pointer-events-none select-none blur-[2px]' : ''}>
                  <h4 className="text-gold-400/80 text-sm font-medium mb-3">Estadísticas Detalladas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-celeste-400">{estadisticasDetalladas.trucos_cantados}</div>
                      <div className="text-gold-500/50 text-xs">Trucos cantados</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-green-400">{estadisticasDetalladas.trucos_ganados}</div>
                      <div className="text-gold-500/50 text-xs">Trucos ganados</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-yellow-400">{estadisticasDetalladas.envidos_cantados}</div>
                      <div className="text-gold-500/50 text-xs">Envidos cantados</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-green-400">{estadisticasDetalladas.envidos_ganados}</div>
                      <div className="text-gold-500/50 text-xs">Envidos ganados</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-pink-400">{estadisticasDetalladas.flores_cantadas}</div>
                      <div className="text-gold-500/50 text-xs">Flores cantadas</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-xl font-bold text-amber-400">{estadisticasDetalladas.partidas_perfectas}</div>
                      <div className="text-gold-500/50 text-xs">Partidas perfectas</div>
                    </div>
                  </div>

                  {/* Stats por modo */}
                  <h4 className="text-gold-400/80 text-sm font-medium mt-4 mb-3">Por Modo de Juego</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-lg font-bold text-gold-400">{estadisticasDetalladas.victorias_1v1}/{estadisticasDetalladas.partidas_1v1}</div>
                      <div className="text-gold-500/50 text-xs">1v1</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-lg font-bold text-gold-400">{estadisticasDetalladas.victorias_2v2}/{estadisticasDetalladas.partidas_2v2}</div>
                      <div className="text-gold-500/50 text-xs">2v2</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-gold-700/10">
                      <div className="text-lg font-bold text-gold-400">{estadisticasDetalladas.victorias_3v3}/{estadisticasDetalladas.partidas_3v3}</div>
                      <div className="text-gold-500/50 text-xs">3v3</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-gold-400/60 text-sm space-y-2">
              <p>Tu ELO sube +25 por victoria y baja -15 por derrota.</p>
              <p>Todos los jugadores comienzan con 1000 ELO.</p>
              <p>Juga partidas para subir en el ranking y desbloquear logros.</p>
            </div>
          </div>
        )}

        {/* Logros (tab logros) */}
        {tab === 'logros' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gold-300 font-bold">Mis Logros</h3>
              <span className="text-gold-400/60 text-sm">
                {logros.filter(l => l.desbloqueado_en).length} / {logros.length} desbloqueados
              </span>
            </div>

            {/* Barra de nivel */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  <span className="text-purple-300 font-bold text-lg">Nivel {nivel}</span>
                </div>
                <span className="text-purple-400/60 text-sm">{experiencia} / {expRequerida} XP</span>
              </div>
              <div className="w-full bg-purple-900/50 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(experiencia / expRequerida) * 100}%` }}
                />
              </div>
            </div>

            {/* Categorías de logros */}
            {['primeros_pasos', 'victorias', 'rachas', 'habilidad', 'modos', 'especiales', 'niveles'].map(categoria => {
              const logrosCategoria = logros.filter(l => l.categoria === categoria);
              if (logrosCategoria.length === 0) return null;

              const nombreCategoria = {
                primeros_pasos: '🎯 Primeros Pasos',
                victorias: '🏆 Victorias',
                rachas: '🔥 Rachas',
                habilidad: '💪 Habilidad',
                modos: '🎮 Modos de Juego',
                especiales: '✨ Especiales',
                niveles: '⭐ Niveles',
              }[categoria] || categoria;

              return (
                <div key={categoria} className="mb-6">
                  <h4 className="text-gold-400/80 text-sm font-medium mb-3">{nombreCategoria}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {logrosCategoria.map(logro => {
                      const desbloqueado = !!logro.desbloqueado_en;
                      return (
                        <div
                          key={logro.id}
                          className={`rounded-xl p-4 border transition-all ${
                            desbloqueado
                              ? 'bg-gradient-to-r from-gold-900/30 to-amber-900/30 border-gold-500/30'
                              : 'bg-white/5 border-gold-700/10 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-2xl ${desbloqueado ? '' : 'grayscale'}`}>
                              {logro.icono}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${desbloqueado ? 'text-gold-300' : 'text-gold-500/50'}`}>
                                  {logro.nombre}
                                </span>
                                {desbloqueado && (
                                  <span className="text-green-400 text-xs">✓</span>
                                )}
                              </div>
                              <p className="text-gold-500/50 text-xs mt-0.5">{logro.descripcion}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-purple-400 text-xs font-medium">+{logro.puntos_exp} XP</span>
                                {desbloqueado && logro.desbloqueado_en && (
                                  <span className="text-gold-500/30 text-[10px]">
                                    {new Date(logro.desbloqueado_en).toLocaleDateString('es-UY')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tienda (tab tienda) */}
        {tab === 'tienda' && (
          <div className="space-y-4">
            {/* Header con balance */}
            <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gold-300 font-bold text-lg">Tienda</h3>
                <span className="text-purple-400 font-medium text-sm">Nivel {nivel}</span>
              </div>

              {/* Balance de monedas */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gold-500/10 border border-gold-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">&#x1FA99;</span>
                  <div>
                    <div className="text-gold-300 font-bold text-xl">{monedas ?? 0}</div>
                    <div className="text-gold-500/50 text-xs">monedas disponibles</div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {!esPremium && videosRestantes !== null && videosRestantes > 0 && (
                    <button
                      onClick={() => setMostrarRewardedAd(true)}
                      disabled={videoCooldown > 0}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        videoCooldown > 0
                          ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                          : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'
                      }`}
                    >
                      <span>&#x1F4FA;</span>
                      {videoCooldown > 0 ? <span>{videoCooldown}s</span> : <span>+75</span>}
                    </button>
                  )}
                  {!esPremium && videosRestantes === 0 && (
                    <span className="text-white/30 text-xs">Videos agotados hoy</span>
                  )}
                </div>
              </div>
            </div>

            {/* Packs de monedas */}
            <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
              <h4 className="text-gold-400/80 font-medium mb-1">Packs de Monedas</h4>
              <p className="text-gold-500/40 text-xs mb-4">Compra monedas para desbloquear cosmeticos mas rapido.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'pack_500', nombre: 'Basico', monedas: 500, precio: '$49', bonus: null },
                  { id: 'pack_1200', nombre: 'Popular', monedas: 1200, precio: '$99', bonus: '+20%' },
                  { id: 'pack_3000', nombre: 'Mejor Valor', monedas: 3000, precio: '$199', bonus: '+50%' },
                  { id: 'pack_7500', nombre: 'Mega Pack', monedas: 7500, precio: '$399', bonus: '+87%' },
                ].map(pack => (
                  <div key={pack.id} className={`rounded-xl border overflow-hidden ${
                    pack.nombre === 'Mejor Valor' ? 'border-gold-400/40 ring-1 ring-gold-400/20' : 'border-gold-500/20'
                  } bg-black/20`}>
                    <div className="p-3 text-center">
                      {pack.bonus && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full mb-2">
                          {pack.bonus}
                        </span>
                      )}
                      <div className="text-gold-400 text-2xl font-bold">&#x1FA99;</div>
                      <div className="text-white font-bold text-sm mt-1">{pack.monedas.toLocaleString()}</div>
                      <div className="text-gold-500/50 text-xs">{pack.nombre}</div>
                    </div>
                    <button
                      onClick={() => handleComprarPack(pack.id)}
                      disabled={comprandoPack !== null}
                      className={`w-full py-2 text-xs font-medium border-t border-gold-500/20 transition-all ${
                        comprandoPack === pack.id
                          ? 'bg-gold-500/20 text-gold-300 cursor-wait'
                          : comprandoPack !== null
                            ? 'bg-gold-500/10 text-gold-500/40 cursor-not-allowed'
                            : 'bg-gold-500/15 text-gold-400 hover:bg-gold-500/25 cursor-pointer'
                      }`}
                    >
                      {comprandoPack === pack.id ? 'Redirigiendo...' : `${pack.precio} UYU`}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cosméticos */}
            <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
              <h4 className="text-gold-400/80 font-medium mb-1">Cosmeticos</h4>
              <p className="text-gold-500/40 text-xs mb-4">
                Desbloquea cosmeticos con monedas. Los elementos premium requieren ser usuario premium.
              </p>

              {['tema_mesa', 'reverso_cartas', 'marco_avatar', 'fondo_perfil', 'pack_sonido'].map(tipo => {
                const cosmeticosTipo = cosmeticos.filter(c => c.tipo === tipo);
                if (cosmeticosTipo.length === 0) return null;

                const nombreTipo = {
                  tema_mesa: '🎨 Temas de Mesa',
                  reverso_cartas: '🃏 Reversos de Cartas',
                  marco_avatar: '🖼️ Marcos de Avatar',
                  fondo_perfil: '🌄 Fondos de Perfil',
                  pack_sonido: '🔊 Packs de Sonidos',
                }[tipo] || tipo;

                return (
                  <div key={tipo} className="mb-6">
                    <h4 className="text-gold-400/80 text-sm font-medium mb-3">{nombreTipo}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {cosmeticosTipo.map(cosmetico => {
                        const desbloqueado = cosmetico.desbloqueado === 1;
                        const equipado = cosmetico.equipado === 1;
                        const tieneNivel = nivel >= cosmetico.nivel_requerido;
                        const tienePremium = !cosmetico.es_premium || esPremium;
                        const tieneMonedas = monedas !== null && monedas >= cosmetico.precio_monedas;
                        const puedeComprar = tieneNivel && tienePremium && tieneMonedas;
                        const comprando_ = comprando === cosmetico.id;
                        const equipando_ = equipando === cosmetico.id;

                        return (
                          <div
                            key={cosmetico.id}
                            className={`rounded-xl overflow-hidden border transition-all ${
                              equipado
                                ? 'ring-2 ring-green-500 border-green-500/30'
                                : desbloqueado
                                  ? 'border-gold-500/30'
                                  : 'border-gold-700/10 opacity-70'
                            }`}
                          >
                            {/* Preview */}
                            <div className={`h-20 flex items-center justify-center relative ${
                              tipo === 'tema_mesa' ? 'bg-gradient-to-br from-emerald-800 to-emerald-900' :
                              tipo === 'reverso_cartas' ? 'bg-gradient-to-br from-blue-800 to-blue-900' :
                              tipo === 'fondo_perfil' ? 'bg-gradient-to-br from-rose-800 to-orange-900' :
                              tipo === 'pack_sonido' ? 'bg-gradient-to-br from-teal-800 to-cyan-900' :
                              'bg-gradient-to-br from-purple-800 to-purple-900'
                            }`}>
                              <span className="text-3xl">{
                                tipo === 'tema_mesa' ? '🎨' :
                                tipo === 'reverso_cartas' ? '🃏' :
                                tipo === 'fondo_perfil' ? '🌄' :
                                tipo === 'pack_sonido' ? '🔊' : '🖼️'
                              }</span>
                              {/* Precio en esquina */}
                              {!desbloqueado && cosmetico.precio_monedas > 0 && (
                                <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  tieneMonedas ? 'bg-gold-500/30 text-gold-300' : 'bg-red-500/30 text-red-300'
                                }`}>
                                  &#x1FA99; {cosmetico.precio_monedas}
                                </span>
                              )}
                              {desbloqueado && !equipado && (
                                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold-500/20 text-gold-400">
                                  Comprado
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-3 bg-black/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white text-sm font-medium">{cosmetico.nombre}</span>
                                {cosmetico.es_premium === 1 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
                                    PRO
                                  </span>
                                )}
                              </div>
                              <p className="text-gold-500/50 text-xs mb-2">{cosmetico.descripcion}</p>

                              {/* Requisitos */}
                              {!desbloqueado && (
                                <div className="text-xs mb-2 space-y-0.5">
                                  {cosmetico.nivel_requerido > 1 && (
                                    <div className={tieneNivel ? 'text-green-400' : 'text-red-400'}>
                                      Nivel {cosmetico.nivel_requerido}
                                    </div>
                                  )}
                                  {cosmetico.precio_monedas > 0 && !tieneMonedas && (
                                    <div className="text-red-400">
                                      Faltan {cosmetico.precio_monedas - (monedas ?? 0)} monedas
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Botón de acción */}
                              {desbloqueado ? (
                                <button
                                  onClick={() => handleEquiparCosmetico(cosmetico.id, cosmetico.tipo)}
                                  disabled={equipado || equipando_}
                                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    equipado
                                      ? 'bg-green-600/30 text-green-300 cursor-default'
                                      : 'bg-gold-600/30 text-gold-300 hover:bg-gold-600/50'
                                  }`}
                                >
                                  {equipando_ ? '...' : equipado ? '✓ Equipado' : 'Equipar'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleComprarCosmetico(cosmetico.id)}
                                  disabled={!puedeComprar || comprando_}
                                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    puedeComprar
                                      ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50'
                                      : 'bg-gray-600/20 text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {comprando_ ? '...' : !tieneNivel ? 'Nivel insuficiente' : !tienePremium ? 'Requiere Premium' : !tieneMonedas ? 'Monedas insuficientes' : `Comprar &#x1FA99; ${cosmetico.precio_monedas}`}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mis Audios (tab audios) */}
        {tab === 'audios' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-2">Mis Audios Personalizados</h3>
            <p className="text-gold-500/40 text-xs mb-4">
              Subi audios personalizados para cada accion del juego. Cuando realices esa accion, todos los jugadores escucharan tu audio.
            </p>

            {/* Banner premium para no-premium */}
            {!esPremium && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-500/20">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👑</span>
                  <div className="flex-1">
                    <p className="text-yellow-300 font-bold text-sm">Función Premium</p>
                    <p className="text-yellow-400/60 text-xs">Conseguí el Pase Premium para subir audios personalizados a tus acciones del juego.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contenedor con overlay para no-premium */}
            <div className={!esPremium ? 'opacity-50 pointer-events-none select-none' : ''}>
              {/* Error message */}
              {uploadError && (
                <div className="mb-3 p-3 rounded-xl bg-red-900/20 border border-red-500/20 flex items-center justify-between">
                  <span className="text-red-300 text-xs">{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="text-red-400/60 hover:text-red-300 text-xs ml-2">X</button>
                </div>
              )}

              <div className="space-y-2">
                {TIPOS_AUDIO.map(({ key, label }) => {
                  const audio = getAudioForTipo(key);
                  const isThisUploading = uploading === key;
                  const isPlaying = playingAudio === key;
                  const isAnyUploading = uploading !== null;

                  return (
                    <div
                      key={key}
                      className={`rounded-xl px-4 py-3 bg-white/5 border transition-all ${
                        isThisUploading ? 'border-gold-500/30 bg-gold-900/10' : 'border-gold-700/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-gold-300 text-sm font-medium w-28 shrink-0">{label}</span>
                          {isThisUploading ? (
                            <span className="text-gold-400 text-xs animate-pulse">Subiendo...</span>
                          ) : audio ? (
                            <span className="text-green-400/60 text-xs truncate">Configurado</span>
                          ) : (
                            <span className="text-gold-500/30 text-xs">Sin audio</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Play button */}
                          {audio && !isThisUploading && (
                            <button
                              onClick={() => handlePlayAudio(audio.url_archivo, key)}
                              className={`p-1.5 rounded-lg transition-all ${
                                isPlaying
                                  ? 'bg-green-600/30 text-green-300'
                                  : 'text-gold-400/50 hover:text-gold-300 hover:bg-white/10'
                              }`}
                              title={isPlaying ? 'Detener' : 'Reproducir'}
                            >
                              {isPlaying ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <rect x="6" y="4" width="4" height="16" />
                                  <rect x="14" y="4" width="4" height="16" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* Delete button */}
                          {audio && !isThisUploading && (
                            <button
                              onClick={() => handleDeleteAudio(Number(audio.id))}
                              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-300 hover:bg-red-900/20 transition-all"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}

                          {/* Upload button */}
                          {!isThisUploading && (
                            <button
                              onClick={() => {
                                setUploadTipoTarget(key);
                                setUploadError(null);
                                fileInputRef.current?.click();
                              }}
                              disabled={isAnyUploading}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isAnyUploading
                                  ? 'bg-gold-600/10 text-gold-400/30 cursor-not-allowed'
                                  : 'bg-gold-600/30 text-gold-300 hover:bg-gold-600/40 border border-gold-500/20'
                              }`}
                            >
                              {audio ? 'Cambiar' : 'Subir'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {isThisUploading && (
                        <div className="mt-2">
                          <div className="w-full bg-gold-900/30 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-gold-500 to-amber-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gold-400/50 mt-1 text-right">{uploadProgress}%</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-yellow-900/10 border border-yellow-500/10">
                <p className="text-yellow-300/60 text-xs">
                  Formatos soportados: MP3, WAV, OGG, M4A. Peso maximo: 512KB por audio.
                </p>
              </div>
            </div>

            {/* Botón Obtener Premium para no-premium */}
            {!esPremium && (
              <button
                onClick={() => {
                  const premiumSection = document.getElementById('premium-section');
                  if (premiumSection) premiumSection.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-4 py-3 rounded-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-500 text-black hover:from-yellow-500 hover:to-amber-400 transition-all shadow-lg shadow-yellow-600/20 flex items-center justify-center gap-2"
              >
                <span>👑</span> Obtener Premium
              </button>
            )}
          </div>
        )}

        {/* Personalización de Mesa (tab mesa) */}
        {tab === 'mesa' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20 relative">
            <h3 className="text-gold-300 font-bold mb-2">Personalización de Mesa</h3>
            <p className="text-gold-500/40 text-xs mb-6">
              Personalizá el aspecto de tu mesa de truco. Tus oponentes verán tu tema cuando juegues.
            </p>

            {/* Banner premium para no-premium */}
            {!esPremium && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-500/20">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👑</span>
                  <div className="flex-1">
                    <p className="text-yellow-300 font-bold text-sm">Función Premium</p>
                    <p className="text-yellow-400/60 text-xs">Conseguí el Pase Premium para personalizar tu mesa y el reverso de tus cartas.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contenedor con overlay para no-premium */}
            <div className={!esPremium ? 'opacity-50 pointer-events-none select-none' : ''}>
              {/* Tema de Mesa */}
              <div className="mb-6">
                <h4 className="text-gold-400/80 text-sm font-medium mb-3">Tema de la Mesa</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'clasico', nombre: 'Clásico', color: 'from-[#1a3d1a] via-[#0d2e0d] to-[#0a2a0a]', desc: 'Verde tradicional' },
                    { id: 'azul', nombre: 'Noche', color: 'from-[#1a2744] via-[#0d1a2e] to-[#0a1525]', desc: 'Azul nocturno' },
                    { id: 'rojo', nombre: 'Casino', color: 'from-[#4a1a1a] via-[#2e0d0d] to-[#250a0a]', desc: 'Rojo elegante' },
                    { id: 'dorado', nombre: 'Dorado', color: 'from-[#3d3010] via-[#2a200a] to-[#1a1505]', desc: 'Dorado real' },
                    { id: 'cuero', nombre: 'Cuero', color: 'from-[#5c3a1e] via-[#3d2814] to-[#2a1a0d]', desc: 'Marrón cálido' },
                    { id: 'marmol', nombre: 'Mármol', color: 'from-[#3a3a40] via-[#2a2a30] to-[#1a1a20]', desc: 'Gris frío' },
                    { id: 'neon', nombre: 'Neón', color: 'from-[#2a1a4a] via-[#1a1040] to-[#0a0825]', desc: '👑 Premium' },
                    { id: 'medianoche', nombre: 'Medianoche', color: 'from-[#0a0a14] via-[#050510] to-[#02020a]', desc: '👑 Premium' },
                  ].map(tema => (
                    <button
                      key={tema.id}
                      onClick={() => setTemaMesa(tema.id)}
                      className={`relative rounded-xl overflow-hidden transition-all ${
                        temaMesa === tema.id
                          ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-black/50 scale-105'
                          : 'hover:scale-102 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className={`h-20 bg-gradient-to-br ${tema.color}`}>
                        <div className="absolute inset-0 bg-[url('/Images/felt-texture.png')] opacity-20" />
                      </div>
                      <div className="p-2 bg-black/40">
                        <div className="text-white text-xs font-medium">{tema.nombre}</div>
                        <div className="text-gold-400/50 text-[10px]">{tema.desc}</div>
                      </div>
                      {temaMesa === tema.id && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-gold-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reverso de Cartas */}
              <div className="mb-6">
                <h4 className="text-gold-400/80 text-sm font-medium mb-3">Reverso de Cartas</h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {[
                    { id: 'clasico', nombre: 'Clásico', color: 'bg-blue-950', patron: 'Diseño tradicional' },
                    { id: 'azul', nombre: 'Azul', color: 'bg-blue-700', patron: 'Azul elegante' },
                    { id: 'rojo', nombre: 'Rojo', color: 'bg-red-800', patron: 'Rojo intenso' },
                    { id: 'dorado', nombre: 'Dorado', color: 'bg-amber-700', patron: 'Dorado real' },
                    { id: 'verde', nombre: 'Bosque', color: 'bg-green-900', patron: 'Verde oscuro' },
                    { id: 'purpura', nombre: 'Púrpura', color: 'bg-purple-800', patron: 'Violeta intenso' },
                    { id: 'negro', nombre: 'Obsidiana', color: 'bg-gray-900', patron: '👑 Premium' },
                    { id: 'arcoiris', nombre: 'Arcoíris', color: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500', patron: '👑 Premium' },
                  ].map(reverso => (
                    <button
                      key={reverso.id}
                      onClick={() => setReversoCartas(reverso.id)}
                      className={`relative rounded-xl overflow-hidden transition-all ${
                        reversoCartas === reverso.id
                          ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-black/50 scale-105'
                          : 'hover:scale-102 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className={`h-24 ${reverso.color} flex items-center justify-center`}>
                        <div className="w-10 h-14 rounded bg-white/10 border border-white/20 flex items-center justify-center">
                          <span className="text-white/50 text-lg">🂠</span>
                        </div>
                      </div>
                      <div className="p-1.5 bg-black/40">
                        <div className="text-white text-[10px] font-medium text-center">{reverso.nombre}</div>
                      </div>
                      {reversoCartas === reverso.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fondo de Perfil */}
              <div className="mb-6">
                <h4 className="text-gold-400/80 text-sm font-medium mb-3">Fondo de Perfil</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'fondo_clasico', nombre: 'Clásico', gradient: 'from-gray-900 to-gray-800', desc: 'Oscuro por defecto' },
                    { id: 'fondo_celeste', nombre: 'Celeste', gradient: 'from-sky-900 via-cyan-900 to-blue-900', desc: 'Azul suave' },
                    { id: 'fondo_atardecer', nombre: 'Atardecer', gradient: 'from-orange-900 via-rose-900 to-amber-900', desc: 'Tonos cálidos' },
                    { id: 'fondo_galaxia', nombre: 'Galaxia', gradient: 'from-purple-900 via-indigo-900 to-violet-900', desc: '👑 Premium' },
                    { id: 'fondo_fuego', nombre: 'Fuego', gradient: 'from-red-900 via-orange-900 to-yellow-900', desc: '👑 Premium' },
                  ].map(fondo => {
                    const equipado = cosmeticos.find(c => c.id === fondo.id && c.equipado === 1);
                    return (
                      <button
                        key={fondo.id}
                        onClick={async () => {
                          const cosmetico = cosmeticos.find(c => c.id === fondo.id);
                          if (cosmetico && cosmetico.desbloqueado) {
                            await socketService.equiparCosmetico(fondo.id);
                            setCosmeticos(prev => prev.map(c => {
                              if (c.tipo === 'fondo_perfil') {
                                return { ...c, equipado: c.id === fondo.id ? 1 : 0 };
                              }
                              return c;
                            }));
                          }
                        }}
                        className={`relative rounded-xl overflow-hidden transition-all ${
                          equipado
                            ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-black/50 scale-105'
                            : 'hover:scale-102 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className={`h-16 bg-gradient-to-br ${fondo.gradient}`} />
                        <div className="p-2 bg-black/40">
                          <div className="text-white text-xs font-medium">{fondo.nombre}</div>
                          <div className="text-gold-400/50 text-[10px]">{fondo.desc}</div>
                        </div>
                        {equipado && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-gold-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Botón Guardar (premium) o Obtener Premium (no premium) */}
            {esPremium ? (
              <>
                <button
                  onClick={handleGuardarPersonalizacion}
                  disabled={guardandoPersonalizacion}
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-gold-600 to-amber-500 text-black hover:from-gold-500 hover:to-amber-400 transition-all shadow-lg shadow-gold-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardandoPersonalizacion ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <p className="text-gold-500/40 text-xs text-center mt-3">
                  Tu personalización se aplicará en tu próxima partida
                </p>
              </>
            ) : (
              <button
                onClick={() => {
                  const premiumSection = document.getElementById('premium-section');
                  if (premiumSection) premiumSection.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-500 text-black hover:from-yellow-500 hover:to-amber-400 transition-all shadow-lg shadow-yellow-600/20 flex items-center justify-center gap-2"
              >
                <span>👑</span> Obtener Premium
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rewarded Ad Modal */}
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
      <AlertModal {...alertState} onClose={closeAlert} />
    </div>
  );
}
