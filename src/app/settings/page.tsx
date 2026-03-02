'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import socketService from '@/lib/socket';
import audioManager from '@/lib/audioManager';
import AlertModal, { useAlertModal } from '@/components/AlertModal';
import TrucoLoader from '@/components/TrucoLoader';

type Tab = 'audio' | 'cuenta' | 'notificaciones';

const MUSIC_PACKS = [
  { id: 'sonido_clasico', nombre: 'Clasico', descripcion: 'Milonga tradicional' },
  { id: 'sonido_casino', nombre: 'Casino', descripcion: 'Jazz lounge' },
  { id: 'sonido_campo', nombre: 'Campo', descripcion: 'Folk rural' },
  { id: 'sonido_fiesta', nombre: 'Fiesta', descripcion: 'Ritmo festivo' },
];

export default function SettingsPage() {
  const { alertState, showAlert, closeAlert } = useAlertModal();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('audio');
  const [conectado, setConectado] = useState(false);

  // Audio state
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [musicPack, setMusicPack] = useState('sonido_clasico');
  const [previewingPack, setPreviewingPack] = useState<string | null>(null);

  // Cuenta state
  const [usuario, setUsuario] = useState<{
    id: number;
    apodo: string;
    email?: string;
    auth_provider?: string;
    es_premium?: boolean;
  } | null>(null);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  // Notificaciones state
  const [notifPermiso, setNotifPermiso] = useState<NotificationPermission>('default');
  const [sonidoNotif, setSonidoNotif] = useState(true);

  useEffect(() => {
    // Load audio settings from localStorage
    setMuted(localStorage.getItem('truco_muted') === 'true');
    const savedVol = localStorage.getItem('truco_volume');
    if (savedVol !== null) setVolume(parseFloat(savedVol));
    const savedPack = localStorage.getItem('truco_music_pack');
    if (savedPack) setMusicPack(savedPack);
    const savedSonidoNotif = localStorage.getItem('truco_sonido_notif');
    if (savedSonidoNotif !== null) setSonidoNotif(savedSonidoNotif !== 'false');

    // Check notification permission
    if (typeof Notification !== 'undefined') {
      setNotifPermiso(Notification.permission);
    }

    // Load user data
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    if (savedUsuario) {
      try {
        setUsuario(JSON.parse(savedUsuario));
      } catch { /* ignore */ }
    }

    // Connect socket for account operations
    const init = async () => {
      try {
        await socketService.connect();
        setConectado(true);

        // Re-authenticate if we have credentials
        const saved = sessionStorage.getItem('truco_usuario');
        const auth = sessionStorage.getItem('truco_auth');

        if (saved) {
          const u = JSON.parse(saved);

          if (auth) {
            // Usuario con password - login normal
            await socketService.login(u.apodo, auth);
          } else if (u.google_id || u.auth_provider === 'google') {
            // Usuario de Google - login con datos guardados
            await socketService.loginConGoogle(
              u.google_id,
              u.email,
              u.apodo,
              u.avatar_url
            );
          }
        }
      } catch {
        // Not critical for audio/notif tabs
      }
      setLoading(false);
    };

    init();

    return () => {
      if (previewingPack) {
        audioManager.stopMusic();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    audioManager.setMuted(newMuted);
    localStorage.setItem('truco_muted', String(newMuted));
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    audioManager.setVolume(val);
    localStorage.setItem('truco_volume', String(val));
  };

  const handleMusicPackChange = (packId: string) => {
    setMusicPack(packId);
    audioManager.setMusicPack(packId);
    localStorage.setItem('truco_music_pack', packId);
  };

  const handlePreviewPack = (packId: string) => {
    if (previewingPack === packId) {
      audioManager.stopMusic();
      setPreviewingPack(null);
    } else {
      audioManager.setMusicPack(packId);
      audioManager.startMusic();
      setPreviewingPack(packId);
    }
  };

  const handleCambiarPassword = async () => {
    if (!passwordNueva || passwordNueva.length < 8) {
      showAlert('error', 'Error', 'La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordNueva !== passwordConfirm) {
      showAlert('error', 'Error', 'Las contraseñas no coinciden');
      return;
    }

    setCambiandoPassword(true);
    try {
      const result = await socketService.cambiarPassword(passwordActual, passwordNueva);
      if (result.success) {
        showAlert('success', 'Listo', 'Contraseña actualizada correctamente');
        setPasswordActual('');
        setPasswordNueva('');
        setPasswordConfirm('');
        // Update saved auth
        sessionStorage.setItem('truco_auth', passwordNueva);
      } else {
        showAlert('error', 'Error', result.error || 'No se pudo cambiar la contraseña');
      }
    } catch {
      showAlert('error', 'Error', 'Error de conexion');
    }
    setCambiandoPassword(false);
  };

  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotifPermiso(permission);
  };

  const handleToggleSonidoNotif = () => {
    const newVal = !sonidoNotif;
    setSonidoNotif(newVal);
    localStorage.setItem('truco_sonido_notif', String(newVal));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <TrucoLoader text="Cargando configuracion..." />
      </div>
    );
  }

  const tienePassword = usuario?.auth_provider === 'local' || usuario?.auth_provider === 'both';
  const tieneGoogle = usuario?.auth_provider === 'google' || usuario?.auth_provider === 'both';

  return (
    <div className="h-screen bg-table-wood overflow-hidden flex flex-col">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto w-full flex flex-col flex-1 min-h-0 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <Link href="/lobby" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
          <h1 className="text-gold-300 font-bold text-lg">Configuracion</h1>
          <div className="w-16" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 shrink-0">
          {([
            { id: 'audio' as Tab, label: 'Audio' },
            { id: 'cuenta' as Tab, label: 'Cuenta' },
            { id: 'notificaciones' as Tab, label: 'Notificaciones' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-6">

          {/* === TAB: AUDIO === */}
          {tab === 'audio' && (
            <div className="space-y-4">
              {/* Volume */}
              <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                <h3 className="text-gold-300 font-bold mb-4">Volumen</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleMute}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        muted ? 'bg-red-600/30 text-red-400' : 'bg-gold-600/20 text-gold-400'
                      }`}
                    >
                      {muted ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gold-500/60 mb-1">
                        <span>Volumen general</span>
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(volume * 100)}
                        onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                        className="w-full accent-gold-500"
                        disabled={muted}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Music Pack */}
              <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                <h3 className="text-gold-300 font-bold mb-4">Pack de musica</h3>
                <div className="grid grid-cols-2 gap-2">
                  {MUSIC_PACKS.map(pack => (
                    <div
                      key={pack.id}
                      className={`rounded-xl p-3 border cursor-pointer transition-all ${
                        musicPack === pack.id
                          ? 'bg-gold-600/20 border-gold-500/40'
                          : 'bg-white/5 border-white/10 hover:border-gold-500/20'
                      }`}
                      onClick={() => handleMusicPackChange(pack.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gold-300">{pack.nombre}</div>
                          <div className="text-xs text-gold-500/50">{pack.descripcion}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePreviewPack(pack.id); }}
                          className="w-8 h-8 rounded-full bg-gold-600/20 flex items-center justify-center text-gold-400 hover:bg-gold-600/30 transition-all"
                        >
                          {previewingPack === pack.id ? '■' : '▶'}
                        </button>
                      </div>
                      {musicPack === pack.id && (
                        <div className="text-[10px] text-gold-400 mt-1 font-medium">Seleccionado</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === TAB: CUENTA === */}
          {tab === 'cuenta' && (
            <div className="space-y-4">
              {/* Account Info */}
              <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                <h3 className="text-gold-300 font-bold mb-4">Informacion de la cuenta</h3>
                {usuario ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-sm text-gold-500/60">Apodo</span>
                      <span className="text-sm text-gold-300 font-medium">{usuario.apodo}</span>
                    </div>
                    {usuario.email && (
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-sm text-gold-500/60">Email</span>
                        <span className="text-sm text-gold-300 font-medium">{usuario.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-sm text-gold-500/60">Tipo de cuenta</span>
                      <span className="text-sm text-gold-300 font-medium">
                        {usuario.auth_provider === 'google' ? 'Google' :
                         usuario.auth_provider === 'both' ? 'Local + Google' : 'Local'}
                      </span>
                    </div>
                    {!tieneGoogle && (
                      <button
                        onClick={() => signIn('google', { callbackUrl: '/settings?linked=true' })}
                        className="w-full mt-2 px-4 py-2.5 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Vincular Google
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gold-500/50 text-sm mb-3">Modo invitado - No hay cuenta vinculada</p>
                    <Link href="/login" className="btn-primary px-6 py-2 text-sm">
                      Crear cuenta
                    </Link>
                  </div>
                )}
              </div>

              {/* Change Password */}
              {usuario && (
                <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                  <h3 className="text-gold-300 font-bold mb-4">
                    {tienePassword ? 'Cambiar contraseña' : 'Agregar contraseña'}
                  </h3>
                  {!conectado ? (
                    <p className="text-gold-500/50 text-sm">Conectando al servidor...</p>
                  ) : (
                    <div className="space-y-3">
                      {tienePassword && (
                        <div>
                          <label className="text-xs text-gold-500/60 mb-1 block">Contraseña actual</label>
                          <input
                            type="password"
                            value={passwordActual}
                            onChange={(e) => setPasswordActual(e.target.value)}
                            className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                            placeholder="Ingresa tu contraseña actual"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gold-500/60 mb-1 block">Nueva contraseña</label>
                        <input
                          type="password"
                          value={passwordNueva}
                          onChange={(e) => setPasswordNueva(e.target.value)}
                          className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                          placeholder="Minimo 8 caracteres"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gold-500/60 mb-1 block">Confirmar contraseña</label>
                        <input
                          type="password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className="input-glass w-full px-3 py-2 rounded-xl text-sm"
                          placeholder="Repetir nueva contraseña"
                        />
                      </div>
                      <button
                        onClick={handleCambiarPassword}
                        disabled={cambiandoPassword || !passwordNueva || passwordNueva.length < 8 || passwordNueva !== passwordConfirm}
                        className="btn-primary w-full py-2.5 text-sm disabled:opacity-40"
                      >
                        {cambiandoPassword ? 'Guardando...' : tienePassword ? 'Cambiar contraseña' : 'Agregar contraseña'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === TAB: NOTIFICACIONES === */}
          {tab === 'notificaciones' && (
            <div className="space-y-4">
              <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                <h3 className="text-gold-300 font-bold mb-4">Notificaciones del navegador</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gold-300 font-medium">Notificaciones push</div>
                      <div className="text-xs text-gold-500/50">Recibir invitaciones de amigos y alertas</div>
                    </div>
                    {notifPermiso === 'granted' ? (
                      <span className="text-xs text-green-400 font-medium bg-green-600/20 px-3 py-1 rounded-full">Activadas</span>
                    ) : notifPermiso === 'denied' ? (
                      <span className="text-xs text-red-400 font-medium bg-red-600/20 px-3 py-1 rounded-full">Bloqueadas</span>
                    ) : (
                      <button
                        onClick={handleRequestNotifPermission}
                        className="text-xs font-bold text-gold-300 bg-gold-600/20 px-3 py-1.5 rounded-lg hover:bg-gold-600/30 transition-all"
                      >
                        Activar
                      </button>
                    )}
                  </div>
                  {notifPermiso === 'denied' && (
                    <p className="text-xs text-red-400/70">
                      Las notificaciones fueron bloqueadas. Para activarlas, cambia los permisos del sitio en la configuracion de tu navegador.
                    </p>
                  )}
                </div>
              </div>

              <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
                <h3 className="text-gold-300 font-bold mb-4">Sonidos</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gold-300 font-medium">Sonido de notificacion</div>
                    <div className="text-xs text-gold-500/50">Reproducir sonido al recibir invitaciones</div>
                  </div>
                  <button
                    onClick={handleToggleSonidoNotif}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      sonidoNotif ? 'bg-gold-500' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      sonidoNotif ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <AlertModal {...alertState} onClose={closeAlert} />
    </div>
  );
}
