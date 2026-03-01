"use client";

export default function ScoreBoard({
  equipo,
  puntos,
  isMyTeam,
  puntosLimite = 30,
}: {
  equipo: number;
  puntos: number;
  isMyTeam: boolean;
  puntosLimite?: number;
}) {
  const limite = puntosLimite;
  const mitad = Math.floor(limite / 2);
  const enBuenas = puntos >= mitad;
  const buenos = Math.max(puntos - mitad, 0);
  const malos = Math.min(puntos, mitad);
  const label = isMyTeam ? "Nosotros" : "Ellos";

  return (
    <div
      className={`score-panel rounded-xl px-3 py-1.5 ${isMyTeam ? "ring-2 ring-gold-500/50" : ""}`}
    >
      <div className="text-center">
        <span
          className={`text-[10px] uppercase tracking-wider font-medium ${equipo === 1 ? "text-celeste-400" : "text-red-400"}`}
        >
          {label}
        </span>
      </div>
      <div className="text-center">
        <span className="text-lg font-bold text-white">{puntos}</span>
      </div>
      <div className="text-center">
        {enBuenas ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-600/30 text-green-400 border border-green-500/40">
            BUENAS {buenos}/{mitad}
          </span>
        ) : (
          <span className="text-[9px] text-gold-500/50">
            Malos {malos}/{mitad}
          </span>
        )}
      </div>
    </div>
  );
}
