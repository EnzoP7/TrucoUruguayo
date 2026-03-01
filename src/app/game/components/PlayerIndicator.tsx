"use client";

import Image from "next/image";
import { Carta, Jugador } from "../types";
import CartaImg from "./CartaImg";
import MonedaMano from "./MonedaMano";

interface SpeechBubble {
  id: string;
  jugadorId: string;
  tipo: "envido" | "flor" | "truco" | "quiero" | "no-quiero";
  texto: string;
  puntos?: number;
}

interface MarcoAvatar {
  border: string;
  shadow: string;
  ring: string;
}

interface PlayerIndicatorProps {
  jugador: Jugador;
  compact?: boolean;
  esSuTurno: boolean;
  esCompanero: boolean;
  bubble: SpeechBubble | undefined;
  cartasJugadas: Carta[];
  getMarcoForPlayer: (playerId: string) => MarcoAvatar;
  getCardBackStyle: () => React.CSSProperties | undefined;
}

export default function PlayerIndicator({
  jugador: j,
  compact = false,
  esSuTurno,
  esCompanero,
  bubble,
  cartasJugadas,
  getMarcoForPlayer,
  getCardBackStyle,
}: PlayerIndicatorProps) {
  return (
    <div key={j.id} className="text-center relative">
      {bubble && (
        <div
          className={`absolute -top-14 left-1/2 -translate-x-1/2 z-50 speech-bubble ${
            bubble.tipo === "envido"
              ? "speech-bubble-envido"
              : bubble.tipo === "flor"
                ? "speech-bubble-flor"
                : bubble.tipo === "truco"
                  ? "speech-bubble-truco"
                  : bubble.tipo === "quiero"
                    ? "speech-bubble-quiero"
                    : bubble.tipo === "no-quiero"
                      ? "speech-bubble-no-quiero"
                      : ""
          }`}
        >
          {bubble.puntos !== undefined &&
          bubble.puntos !== null &&
          bubble.tipo !== "flor" ? (
            <span className="bubble-number text-2xl font-bold">
              {bubble.puntos}
            </span>
          ) : (
            <span className="font-bold text-sm whitespace-nowrap">
              {bubble.texto}
            </span>
          )}
        </div>
      )}
      <div
        className={`inline-flex items-center ${compact ? "gap-1 px-2" : "gap-1.5 px-2"} py-0.5 rounded-lg ${compact ? "text-xs" : "text-xs sm:text-sm"} font-medium ${compact ? "mb-0.5" : "mb-1"} ${
          j.equipo === 1
            ? "equipo-1-light text-celeste-300"
            : "equipo-2-light text-red-300"
        } ${esSuTurno ? "turn-glow" : ""}`}
      >
        {(() => {
          const marco = getMarcoForPlayer(j.id);
          return j.avatarUrl ? (
            <Image
              src={j.avatarUrl}
              alt=""
              width={24}
              height={24}
              className={`${compact ? "w-5 h-5" : "w-6 h-6"} rounded-full object-cover border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}
              unoptimized
            />
          ) : (
            <span
              className={`${compact ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]"} rounded-full bg-gradient-to-br from-gold-600 to-gold-700 flex items-center justify-center text-wood-950 font-bold border-2 ${marco.border} ${marco.shadow} ${marco.ring}`}
            >
              {j.nombre[0]?.toUpperCase()}
            </span>
          );
        })()}
        {j.nombre}
        {j.esMano && <MonedaMano isActive={true} />}
      </div>
      <div
        className={
          compact
            ? "flex flex-col gap-0.5 items-center"
            : "flex gap-1 justify-center"
        }
      >
        {esCompanero
          ? j.cartas
              .filter((c) => c.valor !== 0)
              .map((carta, ci) => {
                const yaJugada = cartasJugadas.some(
                  (cj) => cj.palo === carta.palo && cj.valor === carta.valor,
                );
                return (
                  <div
                    key={`${carta.palo}-${carta.valor}-${ci}`}
                    className={`transition-all duration-300 ${yaJugada ? "opacity-25 grayscale scale-90" : ""}`}
                  >
                    <CartaImg carta={carta} size="small" />
                  </div>
                );
              })
          : j.cartas.map((_, i) => (
              <div
                key={i}
                className={
                  compact
                    ? "w-6 h-9 sm:w-7 sm:h-10 card-back rounded"
                    : "w-7 h-10 sm:w-8 sm:h-12 card-back rounded"
                }
                style={getCardBackStyle()}
              />
            ))}
      </div>
    </div>
  );
}
