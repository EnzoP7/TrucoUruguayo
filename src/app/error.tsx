'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full border border-red-800/30 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-red-400 mb-2">Algo salio mal</h1>
        <p className="text-white/60 text-sm mb-6">
          Ocurrio un error inesperado. Intenta de nuevo.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Reintentar
          </button>
          <a
            href="/lobby"
            className="px-6 py-3 rounded-xl font-bold text-sm bg-celeste-600/30 text-celeste-300 border border-celeste-500/30 hover:bg-celeste-600/40 transition-all"
          >
            Ir al Lobby
          </a>
        </div>
      </div>
    </div>
  );
}
