import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full border border-gold-800/20 text-center">
        <div className="text-6xl mb-4">🃏</div>
        <h1 className="text-3xl font-bold text-gold-400 mb-2">404</h1>
        <p className="text-white/60 text-sm mb-6">
          Esta pagina no existe. Parece que te fuiste al mazo.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Volver al inicio
          </Link>
          <Link
            href="/lobby"
            className="px-6 py-3 rounded-xl font-bold text-sm bg-celeste-600/30 text-celeste-300 border border-celeste-500/30 hover:bg-celeste-600/40 transition-all"
          >
            Ir al Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
