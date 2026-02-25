'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import socketService from '@/lib/socket';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [apodo, setApodo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
            <div className="absolute inset-0 rounded-full border-4 border-celeste-600/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-celeste-400 animate-spin" />
          </div>
          <div className="text-celeste-300 text-xl font-light">Conectando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-table-wood flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-radial from-celeste-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-celeste-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-celeste-600/10 rounded-full blur-3xl" />
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
            <div className="h-px w-8 bg-celeste-600/40" />
            <p className="text-celeste-400/80 text-sm tracking-widest uppercase">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </p>
            <div className="h-px w-8 bg-celeste-600/40" />
          </div>
        </div>

        {/* Formulario */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-celeste-600/30 animate-slide-up">
          {/* Tabs login/registro */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-celeste-600/30 text-celeste-300 border border-celeste-500/30'
                  : 'text-white/50 hover:text-celeste-300 hover:bg-white/5'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setMode('registro'); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mode === 'registro'
                  ? 'bg-celeste-600/30 text-celeste-300 border border-celeste-500/30'
                  : 'text-white/50 hover:text-celeste-300 hover:bg-white/5'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-celeste-300 text-sm font-medium mb-2">Apodo</label>
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
              <label className="block text-celeste-300 text-sm font-medium mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl"
                placeholder={mode === 'registro' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
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
            <div className="h-px flex-1 bg-celeste-600/30" />
            <span className="text-white/40 text-xs uppercase tracking-wider">o</span>
            <div className="h-px flex-1 bg-celeste-600/30" />
          </div>

          {/* Botón Google */}
          <button
            onClick={() => {
              setGoogleLoading(true);
              signIn('google', { callbackUrl: '/lobby?from=google' });
            }}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-medium transition-all border border-gray-200 disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>

          {/* Separador pequeño */}
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-celeste-600/20" />
          </div>

          {/* Jugar como invitado */}
          <Link
            href="/lobby"
            className="block w-full text-center py-3 rounded-xl text-celeste-400/70 hover:text-celeste-300 hover:bg-celeste-900/20 border border-celeste-600/30 transition-all text-sm"
          >
            Jugar como invitado (sin estadísticas)
          </Link>
        </div>

        <p className="text-white/40 text-xs text-center mt-4">
          Con una cuenta guardás tus estadísticas, ranking y amigos
        </p>
      </div>
    </div>
  );
}
