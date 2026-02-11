'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import socketService from '@/lib/socket';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [apodo, setApodo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    // Si ya está logueado, redirigir al lobby
    const savedUsuario = sessionStorage.getItem('truco_usuario');
    if (savedUsuario) {
      window.location.href = '/lobby';
      return;
    }

    const connect = async () => {
      try {
        await socketService.connect();
        setConectado(true);
      } catch {
        setConectado(false);
      }
    };
    connect();
  }, []);

  const handleSubmit = async () => {
    if (!apodo.trim() || !password) return;
    setLoading(true);
    setError('');

    try {
      const result = mode === 'login'
        ? await socketService.login(apodo.trim(), password)
        : await socketService.registrar(apodo.trim(), password);

      if (result.success) {
        sessionStorage.setItem('truco_usuario', JSON.stringify(result.usuario));
        sessionStorage.setItem('truco_nombre', result.usuario.apodo);
        sessionStorage.setItem('truco_auth', password);
        window.location.href = '/lobby';
      } else {
        setError(result.error || 'Error desconocido');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (!conectado) {
    return (
      <div className="min-h-screen bg-table-wood flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gold-700/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 animate-spin" />
          </div>
          <div className="text-gold-400/80 text-xl font-light">Conectando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group">
            <h1 className="font-[var(--font-cinzel)] text-4xl sm:text-5xl font-bold text-gold-400 mb-2 group-hover:text-gold-300 transition-colors">
              Truco Uruguayo
            </h1>
          </Link>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gold-700/40" />
            <p className="text-gold-500/60 text-sm tracking-widest uppercase">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </p>
            <div className="h-px w-8 bg-gold-700/40" />
          </div>
        </div>

        {/* Formulario */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-gold-800/20 animate-slide-up">
          {/* Tabs login/registro */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setMode('registro'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'registro'
                  ? 'bg-gold-600/30 text-gold-300 border border-gold-500/30'
                  : 'text-gold-500/50 hover:text-gold-400 hover:bg-white/5'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gold-400/80 text-sm font-medium mb-2">Apodo</label>
              <input
                type="text"
                value={apodo}
                onChange={(e) => setApodo(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl"
                placeholder="Tu apodo de jugador"
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <label className="block text-gold-400/80 text-sm font-medium mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl"
                placeholder={mode === 'registro' ? 'Mínimo 4 caracteres' : 'Tu contraseña'}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2 border border-red-500/20">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !apodo.trim() || !password}
              className="btn-primary w-full text-white py-3.5 px-6 rounded-xl text-lg disabled:opacity-40"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear Cuenta'}
            </button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-gold-700/20" />
            <span className="text-gold-500/40 text-xs uppercase tracking-wider">o</span>
            <div className="h-px flex-1 bg-gold-700/20" />
          </div>

          {/* Jugar como invitado */}
          <Link
            href="/lobby"
            className="block w-full text-center py-3 rounded-xl text-gold-400/60 hover:text-gold-300 hover:bg-white/5 border border-gold-700/20 transition-all text-sm"
          >
            Jugar como invitado (sin estadísticas)
          </Link>
        </div>

        <p className="text-gold-500/30 text-xs text-center mt-4">
          Con una cuenta guardás tus estadísticas, ranking y amigos
        </p>
      </div>
    </div>
  );
}
