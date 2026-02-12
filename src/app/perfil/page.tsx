'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';
import { useUploadThing } from '@/lib/uploadthing';

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [historial, setHistorial] = useState<Partida[]>([]);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<{ id: number; apodo: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [tab, setTab] = useState<'stats' | 'historial' | 'amigos' | 'audios'>('stats');

  // Premium state
  const [esPremium, setEsPremium] = useState(false);
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

        const amigosResult = await socketService.obtenerAmigos();
        if (amigosResult.success) {
          setAmigos(amigosResult.amigos);
        }
      } catch (err) {
        console.error('Error cargando perfil:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarPerfil();
  }, []);

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
        <div className="glass rounded-2xl p-6 mb-6 border border-gold-800/20">
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-gold-600/50"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold text-2xl">
                  {stats.apodo[0].toUpperCase()}
                </div>
              )}
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

          {/* Toggle Premium (dev) */}
          <div className="mt-4 pt-4 border-t border-gold-800/20">
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
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['stats', 'historial', 'amigos', ...(esPremium ? ['audios'] as const : [])] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              {t === 'stats' ? 'Resumen' : t === 'historial' ? 'Historial' : t === 'amigos' ? 'Amigos' : 'Mis Audios'}
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
            <h3 className="text-gold-300 font-bold mb-4">Amigos</h3>

            {/* Buscar */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input-glass flex-1 px-3 py-2 rounded-lg text-sm"
                placeholder="Buscar jugador por apodo..."
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              />
              <button
                onClick={handleBuscar}
                disabled={buscando || !busqueda.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-gold-600/30 text-gold-300 hover:bg-gold-600/40 transition-all disabled:opacity-40"
              >
                {buscando ? '...' : 'Buscar'}
              </button>
            </div>

            {/* Resultados de busqueda */}
            {resultadosBusqueda.length > 0 && (
              <div className="mb-4 space-y-1">
                {resultadosBusqueda.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-celeste-900/20 rounded-lg px-3 py-2">
                    <span className="text-white text-sm">{u.apodo}</span>
                    <button
                      onClick={() => handleAgregarAmigo(u.id)}
                      className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded hover:bg-green-600/40 transition-all"
                    >
                      + Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de amigos */}
            {amigos.length === 0 ? (
              <p className="text-gold-500/40 text-sm text-center py-8">Aun no tenes amigos agregados</p>
            ) : (
              <div className="space-y-2">
                {amigos.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3 bg-white/5 border border-gold-700/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${a.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-white font-medium">{a.apodo}</span>
                      <span className="text-gold-500/40 text-xs">ELO: {a.elo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold-500/40 text-xs">
                        {a.partidas_ganadas}/{a.partidas_jugadas}
                      </span>
                      <button
                        onClick={() => handleEliminarAmigo(Number(a.id))}
                        className="text-xs px-2 py-1 text-red-400/60 hover:text-red-300 hover:bg-red-900/20 rounded transition-all"
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resumen (tab stats) */}
        {tab === 'stats' && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-4">Resumen</h3>
            <div className="text-gold-400/60 text-sm space-y-2">
              <p>Tu ELO sube +25 por victoria y baja -15 por derrota.</p>
              <p>Todos los jugadores comienzan con 1000 ELO.</p>
              <p>Juga partidas para subir en el ranking.</p>
            </div>
          </div>
        )}

        {/* Mis Audios (tab audios - solo premium) */}
        {tab === 'audios' && esPremium && (
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-300 font-bold mb-2">Mis Audios Personalizados</h3>
            <p className="text-gold-500/40 text-xs mb-4">
              Subi audios personalizados para cada accion del juego. Cuando realices esa accion, todos los jugadores escucharan tu audio.
            </p>

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
        )}
      </div>
    </div>
  );
}
