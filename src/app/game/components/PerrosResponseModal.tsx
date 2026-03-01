"use client";

import { useState } from "react";
import Image from "next/image";

export default function PerrosResponseModal({
  tengoFlor,
  loading,
  onResponder,
  misCartas,
  muestra,
}: {
  tengoFlor: boolean;
  loading: boolean;
  onResponder: (
    quiereContraFlor: boolean,
    quiereFaltaEnvido: boolean,
    quiereTruco: boolean,
  ) => void;
  misCartas: { palo: string; valor: number; poder: number }[];
  muestra: { palo: string; valor: number; poder: number } | null;
}) {
  const [quiereEnvidoFlor, setQuiereEnvidoFlor] = useState<boolean | null>(
    null,
  );
  const [quiereTruco, setQuiereTruco] = useState<boolean | null>(null);

  const puedeConfirmar = quiereEnvidoFlor !== null && quiereTruco !== null;
  const seVaAlMazo = quiereEnvidoFlor === false && quiereTruco === false;

  const handleConfirmar = () => {
    if (!puedeConfirmar) return;
    onResponder(
      tengoFlor ? quiereEnvidoFlor || false : false,
      !tengoFlor ? quiereEnvidoFlor || false : false,
      quiereTruco || false,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Te echaron los Perros">
      <div className="glass rounded-2xl p-6 max-w-lg w-full border-2 border-orange-600/50 animate-slide-up">
        <div className="text-center mb-4">
          <span className="text-4xl">🐕</span>
          <h3 className="text-xl font-bold text-orange-300 mt-2">
            ¡Te echaron los Perros!
          </h3>
          <p className="text-gold-400/60 text-xs mt-1">
            {tengoFlor ? "En Ley (tenés Flor)" : "A Punto (sin Flor)"}
          </p>
        </div>

        {/* Muestra y Cartas del jugador */}
        <div className="mb-4 p-3 bg-black/30 rounded-xl border border-gold-700/30">
          {/* Muestra */}
          {muestra && muestra.valor !== 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-gold-400/70 text-xs font-medium">
                Muestra:
              </span>
              <div className="relative">
                <Image
                  src={`/Cartasimg/${muestra.valor.toString().padStart(2, "0")}-${muestra.palo === "oro" ? "oros" : muestra.palo === "copa" ? "copas" : muestra.palo === "espada" ? "espadas" : muestra.palo === "basto" ? "bastos" : muestra.palo}.png`}
                  alt={`${muestra.valor} de ${muestra.palo}`}
                  width={56}
                  height={84}
                  className="w-10 h-[3.75rem] sm:w-14 sm:h-[5.25rem] rounded shadow-lg ring-2 ring-yellow-500/60"
                />
              </div>
            </div>
          )}

          {/* Mis cartas */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-gold-400/70 text-xs font-medium">
              Tus cartas:
            </span>
            <div className="flex gap-2 sm:gap-3 justify-center">
              {misCartas.filter((c) => c.valor !== 0).length > 0 ? (
                misCartas
                  .filter((c) => c.valor !== 0)
                  .map((carta, idx) => {
                    const paloStr =
                      carta.palo === "oro"
                        ? "oros"
                        : carta.palo === "copa"
                          ? "copas"
                          : carta.palo === "espada"
                            ? "espadas"
                            : carta.palo === "basto"
                              ? "bastos"
                              : carta.palo;
                    const valorStr = carta.valor.toString().padStart(2, "0");
                    return (
                      <div key={idx} className="relative">
                        <Image
                          src={`/Cartasimg/${valorStr}-${paloStr}.png`}
                          alt={`${carta.valor} de ${carta.palo}`}
                          width={64}
                          height={96}
                          className={`w-12 h-[4.5rem] sm:w-16 sm:h-24 rounded shadow-lg transition-all ${
                            muestra && carta.palo === muestra.palo
                              ? "ring-2 ring-yellow-400/70"
                              : ""
                          }`}
                        />
                        {muestra && carta.palo === muestra.palo && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px]">⭐</span>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <span className="text-gold-500/50 text-sm italic">
                  Cargando cartas...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Opción 1: Contra Flor al Resto o Falta Envido */}
        <div className="mb-4">
          <p className="text-gold-400/80 text-sm font-medium mb-2">
            {tengoFlor ? "🌸 Contra Flor al Resto" : "🎯 Falta Envido"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setQuiereEnvidoFlor(true)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereEnvidoFlor === true
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-green-900/30 text-green-400 border border-green-700/40 hover:bg-green-800/40"
              }`}
            >
              Quiero
            </button>
            <button
              onClick={() => setQuiereEnvidoFlor(false)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereEnvidoFlor === false
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-red-900/30 text-red-400 border border-red-700/40 hover:bg-red-800/40"
              }`}
            >
              Paso
            </button>
          </div>
        </div>

        {/* Opción 2: Truco */}
        <div className="mb-5">
          <p className="text-gold-400/80 text-sm font-medium mb-2">⚔️ Truco</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setQuiereTruco(true)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereTruco === true
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-green-900/30 text-green-400 border border-green-700/40 hover:bg-green-800/40"
              }`}
            >
              Quiero
            </button>
            <button
              onClick={() => setQuiereTruco(false)}
              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                quiereTruco === false
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-red-900/30 text-red-400 border border-red-700/40 hover:bg-red-800/40"
              }`}
            >
              Paso
            </button>
          </div>
        </div>

        {/* Confirmar */}
        {seVaAlMazo && puedeConfirmar && (
          <p className="text-red-400/80 text-xs text-center mb-2">
            Si pasás todo, te vas al mazo.
          </p>
        )}
        <button
          onClick={handleConfirmar}
          disabled={!puedeConfirmar || loading}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            !puedeConfirmar
              ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              : seVaAlMazo
                ? "bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
                : "bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400"
          }`}
        >
          {!puedeConfirmar
            ? "Elegí para cada uno"
            : seVaAlMazo
              ? "Me voy al mazo"
              : `Confirmar${quiereEnvidoFlor && quiereTruco ? " (todo)" : ""}`}
        </button>
      </div>
    </div>
  );
}
