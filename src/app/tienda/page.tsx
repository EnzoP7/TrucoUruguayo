'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';
import { TEMAS_MESA, REVERSOS_CARTAS, MARCOS_AVATAR } from '@/app/game/constants';
import audioManager from '@/lib/audioManager';
import { RewardedAd } from '@/components/ads';
import AlertModal, { useAlertModal } from '@/components/AlertModal';
import TrucoLoader from '@/components/TrucoLoader';

const FONDOS_PERFIL_PREVIEW: Record<string, string> = {
  fondo_clasico: 'from-gray-900 to-gray-800',
  fondo_celeste: 'from-sky-900 via-cyan-900 to-blue-900',
  fondo_atardecer: 'from-orange-900 via-rose-900 to-amber-900',
  fondo_galaxia: 'from-purple-900 via-indigo-900 to-violet-900',
  fondo_fuego: 'from-red-900 via-orange-900 to-yellow-900',
};


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

export default function TiendaPage() {
  const { alertState, showAlert, closeAlert } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [esPremium, setEsPremium] = useState(false);
  const [diasRestantesPremium, setDiasRestantesPremium] = useState(0);
  const [nivel, setNivel] = useState(1);
  const [monedas, setMonedas] = useState<number | null>(null);
  const [cosmeticos, setCosmeticos] = useState<Cosmetico[]>([]);
  const [comprando, setComprando] = useState<string | null>(null);
  const [equipando, setEquipando] = useState<string | null>(null);
  const [comprandoPack, setComprandoPack] = useState<string | null>(null);
  const [cargandoPago, setCargandoPago] = useState(false);
  const [videosRestantes, setVideosRestantes] = useState<number | null>(null);
  const [videoCooldown, setVideoCooldown] = useState(0);
  const [mostrarRewardedAd, setMostrarRewardedAd] = useState(false);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  const getUserId = (): number | null => {
    const saved = sessionStorage.getItem('truco_usuario');
    if (!saved) return null;
    try {
      return JSON.parse(saved).id;
    } catch {
      return null;
    }
  };

  // Cargar datos
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        if (!socketService.connected()) {
          await socketService.connect();
          const saved = sessionStorage.getItem('truco_usuario');
          const savedPw = sessionStorage.getItem('truco_auth');
          if (saved && savedPw) {
            const u = JSON.parse(saved);
            await socketService.login(u.apodo, savedPw);
          }
        }

        const premiumResult = await socketService.obtenerEstadoPremium();
        if (premiumResult.success) {
          setEsPremium(!!premiumResult.es_premium);
          setDiasRestantesPremium(premiumResult.dias_restantes || 0);
        }

        const logrosResult = await socketService.obtenerLogros();
        if (logrosResult.success) {
          setNivel(logrosResult.nivel || 1);
        }

        const cosmeticosResult = await socketService.obtenerCosmeticos();
        if (cosmeticosResult.success) {
          setCosmeticos(cosmeticosResult.cosmeticos || []);
        }

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
        console.error('Error cargando datos de tienda:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (videoCooldown <= 0) return;
    const interval = setInterval(() => {
      setVideoCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [videoCooldown]);

  // Handlers
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

  const handleComprarCosmetico = async (cosmeticoId: string) => {
    setComprando(cosmeticoId);
    try {
      const result = await socketService.comprarCosmetico(cosmeticoId);
      if (result.success) {
        const cosmeticoComprado = cosmeticos.find(c => c.id === cosmeticoId);
        setCosmeticos(prev => prev.map(c => {
          if (c.id === cosmeticoId) {
            return { ...c, desbloqueado: 1, equipado: 1 };
          }
          if (cosmeticoComprado && c.tipo === cosmeticoComprado.tipo) {
            return { ...c, equipado: 0 };
          }
          return c;
        }));
        if (cosmeticoComprado && monedas !== null) {
          setMonedas(monedas - cosmeticoComprado.precio_monedas);
        }
        if (cosmeticoComprado?.tipo === 'pack_sonido') {
          audioManager.setMusicPack(cosmeticoId);
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
        setCosmeticos(prev => prev.map(c => {
          if (c.tipo === tipo) {
            return { ...c, equipado: c.id === cosmeticoId ? 1 : 0 };
          }
          return c;
        }));
        if (tipo === 'pack_sonido') {
          audioManager.setMusicPack(cosmeticoId);
        }
      }
    } catch (err) {
      console.error('Error equipando cosmético:', err);
    } finally {
      setEquipando(null);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-table-wood flex items-center justify-center">
        <TrucoLoader text="Cargando tienda..." />
      </div>
    );
  }

  return (
    <div className="h-screen bg-table-wood overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gold-800/20 bg-black/20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/lobby"
            className="px-3 py-1.5 rounded-lg text-xs text-celeste-400/70 hover:text-celeste-300 hover:bg-celeste-500/10 transition-all"
          >
            ← Lobby
          </Link>
          <h1 className="font-[var(--font-cinzel)] text-lg font-bold text-gold-300">Tienda</h1>
          <div className="flex items-center gap-2">
            <span className="text-lg">&#x1FA99;</span>
            <span className="text-gold-300 font-bold">{monedas ?? 0}</span>
            {!esPremium && videosRestantes !== null && videosRestantes > 0 && (
              <button
                onClick={() => setMostrarRewardedAd(true)}
                disabled={videoCooldown > 0}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  videoCooldown > 0
                    ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'
                }`}
              >
                <span>&#x1F4FA;</span>
                {videoCooldown > 0 ? <span>{videoCooldown}s</span> : <span>+20</span>}
              </button>
            )}
            {!esPremium && videosRestantes === 0 && (
              <span className="text-white/30 text-[10px]">Videos agotados</span>
            )}
          </div>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">

          {/* Premium Section */}
          <div className="glass rounded-2xl border border-gold-500/30 overflow-hidden">
            <div className="bg-gradient-to-r from-gold-900/30 via-gold-800/15 to-gold-900/30 p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">&#x1F451;</span>
                <div>
                  <h2 className="font-bold text-gold-300 text-lg">Pase Premium</h2>
                  <p className="text-gold-500/50 text-xs">30 dias de beneficios exclusivos</p>
                </div>
              </div>

              {esPremium ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gold-500/15 border border-gold-500/30">
                  <span className="text-gold-400 text-lg">&#x1F451;</span>
                  <div>
                    <div className="text-gold-300 font-bold">Premium activo</div>
                    {diasRestantesPremium > 0 && (
                      <div className="text-gold-500/60 text-xs">
                        {diasRestantesPremium} {diasRestantesPremium === 1 ? 'dia' : 'dias'} restantes
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 mb-4">
                    {[
                      { icon: '🔇', text: 'Sin anuncios' },
                      { icon: '🎁', text: 'Todos los cosmeticos premium desbloqueados' },
                      { icon: '🎵', text: 'Audios personalizados' },
                      { icon: '⚡', text: 'Bonus x1.5 monedas y XP' },
                      { icon: '🪙', text: '+100 monedas de bienvenida' },
                    ].map(b => (
                      <div key={b.text} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/15">
                        <span className="text-sm">{b.icon}</span>
                        <span className="text-gold-300/80 text-xs">{b.text}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleComprarPremium}
                    disabled={cargandoPago}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 shadow-lg shadow-gold-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cargandoPago ? 'Redirigiendo a MercadoPago...' : '\u{1F451} Obtener Premium - $1 USD'}
                  </button>
                  <p className="text-gold-500/40 text-[11px] mt-2">
                    Tu granito de arena ayuda a mantener el juego gratis para todos
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Packs de monedas */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-gold-800/20">
            <h3 className="text-gold-400/80 font-medium mb-1">Packs de Monedas</h3>
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
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full mb-2 ${pack.bonus ? 'bg-green-500/20 text-green-400' : 'invisible'}`}>
                      {pack.bonus || '-'}
                    </span>
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
            <h3 className="text-gold-400/80 font-medium mb-1">Cosmeticos</h3>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                          <div className="h-24 relative overflow-hidden">
                            {/* tema_mesa: mini mesa con gradiente real + fieltro + cartas */}
                            {tipo === 'tema_mesa' && (() => {
                              const tema = TEMAS_MESA[cosmetico.id];
                              if (!tema) return <div className="absolute inset-0 bg-emerald-900" />;
                              return (
                                <div className="absolute inset-0" style={{
                                  background: `linear-gradient(135deg, ${tema.colors[0]} 0%, ${tema.colors[1]} 50%, ${tema.colors[2]} 100%)`
                                }}>
                                  <div className="absolute inset-3 rounded-xl opacity-50" style={{ backgroundColor: tema.felt }} />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex items-end" style={{ gap: '3px' }}>
                                      {[-15, 0, 15].map((rot, i) => (
                                        <div key={i} className="w-5 h-7 rounded-[3px] bg-white/20 border border-white/15"
                                             style={{ transform: `rotate(${rot}deg) translateY(${Math.abs(rot) / 5}px)` }} />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                                    <div className="w-10 h-[3px] rounded-full" style={{ backgroundColor: tema.accent, opacity: 0.5 }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {/* reverso_cartas: cartas con el reverso real */}
                            {tipo === 'reverso_cartas' && (() => {
                              const reverso = REVERSOS_CARTAS[cosmetico.id];
                              if (!reverso) return <div className="absolute inset-0 bg-blue-900" />;
                              return (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <div className="flex items-center" style={{ gap: '3px' }}>
                                    {[-12, 0, 12].map((rot, i) => (
                                      <div key={i} className="w-9 h-[52px] rounded-md shadow-lg"
                                           style={{
                                             background: `linear-gradient(135deg, ${reverso.colors[0]} 0%, ${reverso.colors[1]} 100%)`,
                                             transform: `rotate(${rot}deg)`,
                                             border: `1.5px solid ${reverso.colors[0]}99`
                                           }}>
                                        <div className="w-full h-full rounded-md flex items-center justify-center">
                                          <div className="w-4 h-4 rounded-sm border border-white/15 rotate-45" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* marco_avatar: circulo con el marco real */}
                            {tipo === 'marco_avatar' && (() => {
                              const marco = MARCOS_AVATAR[cosmetico.id];
                              if (!marco) return <div className="absolute inset-0 bg-purple-900" />;
                              return (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className={`w-14 h-14 rounded-full border-[3px] ${marco.border} ${marco.shadow} ${marco.ring} bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center`}>
                                    <svg className="w-7 h-7 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* fondo_perfil: gradiente real con mini card de perfil */}
                            {tipo === 'fondo_perfil' && (() => {
                              const gradient = FONDOS_PERFIL_PREVIEW[cosmetico.id] || 'from-gray-900 to-gray-800';
                              return (
                                <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
                                  <div className="absolute inset-2.5 rounded-lg border border-white/10 bg-black/20 flex items-center gap-2 px-3">
                                    <div className="w-8 h-8 rounded-full bg-white/15 border border-white/15 shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-2 w-16 bg-white/15 rounded" />
                                      <div className="h-1.5 w-10 bg-white/10 rounded" />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* pack_sonido: boton de play con preview de musica de fondo */}
                            {tipo === 'pack_sonido' && (() => {
                              const isPlaying = playingSoundId === cosmetico.id;
                              return (
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-900/80 to-cyan-900/80 flex items-center justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isPlaying) {
                                        audioManager.stopMusicPreview();
                                        setPlayingSoundId(null);
                                        return;
                                      }
                                      audioManager.initFromUserGesture();
                                      audioManager.playMusicPreview(cosmetico.id);
                                      setPlayingSoundId(cosmetico.id);
                                      setTimeout(() => setPlayingSoundId(null), 4000);
                                    }}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                      isPlaying
                                        ? 'bg-green-500/30 border-2 border-green-400/50 scale-110'
                                        : 'bg-white/10 border-2 border-white/20 hover:bg-white/20 hover:scale-105'
                                    }`}
                                  >
                                    {isPlaying ? (
                                      <div className="flex items-center gap-[3px]">
                                        {[10, 16, 20, 14, 8].map((h, i) => (
                                          <div key={i} className="w-1 bg-green-400 rounded-full animate-pulse"
                                               style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
                                        ))}
                                      </div>
                                    ) : (
                                      <svg className="w-6 h-6 text-white/70 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              );
                            })()}

                            {/* Badges de precio / estado */}
                            {!desbloqueado && cosmetico.precio_monedas > 0 && (
                              <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold z-10 ${
                                tieneMonedas ? 'bg-gold-500/30 text-gold-300' : 'bg-red-500/30 text-red-300'
                              }`}>
                                &#x1FA99; {cosmetico.precio_monedas}
                              </span>
                            )}
                            {desbloqueado && !equipado && (
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold-500/20 text-gold-400 z-10">
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
                                {comprando_ ? '...' : !tieneNivel ? 'Nivel insuficiente' : !tienePremium ? 'Requiere Premium' : !tieneMonedas ? 'Monedas insuficientes' : `Comprar \u{1FA99} ${cosmetico.precio_monedas}`}
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
      </div>

      {/* Rewarded Ad Modal */}
      {mostrarRewardedAd && (
        <RewardedAd
          rewardAmount={20}
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
