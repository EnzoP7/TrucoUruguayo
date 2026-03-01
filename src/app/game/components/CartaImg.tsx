"use client";

import Image from "next/image";
import { Carta } from "../types";
import { getCartaImageUrl } from "../utils";

export default function CartaImg({
  carta,
  size = "normal",
  onClick,
  disabled,
  showGlow,
  reversoActivo,
  cardBackStyle,
}: {
  carta: Carta;
  size?: "small" | "normal" | "large";
  onClick?: () => void;
  disabled?: boolean;
  showGlow?: boolean;
  reversoActivo?: [string, string] | null;
  cardBackStyle?: React.CSSProperties;
}) {
  const isOculta = carta.valor === 0;
  // Tamaños responsive: mobile / tablet / desktop
  const sizeClasses = {
    small: "w-8 h-12 sm:w-10 sm:h-[3.75rem] lg:w-12 lg:h-[4.5rem]",
    normal: "w-12 h-[4.5rem] sm:w-14 sm:h-[5.25rem] lg:w-16 lg:h-24",
    large:
      "w-[4.5rem] h-[6.75rem] sm:w-[4.5rem] sm:h-[6.75rem] lg:w-20 lg:h-[7.5rem]",
  };

  if (isOculta) {
    // Usar reverso personalizado si hay uno activo de un jugador premium
    if (reversoActivo) {
      return (
        <div
          className={`${sizeClasses[size]} rounded-lg border border-white/20 shadow-lg flex items-center justify-center`}
          style={{
            background: `linear-gradient(to bottom right, ${reversoActivo[0]}, ${reversoActivo[1]})`,
          }}
          aria-hidden="true"
        >
          <div className="w-2/3 h-2/3 rounded border border-white/10 bg-white/5" />
        </div>
      );
    }
    return <div className={`${sizeClasses[size]} card-back rounded-lg`} style={cardBackStyle} aria-hidden="true" />;
  }

  const cartaLabel = `Jugar ${carta.valor} de ${carta.palo}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={cartaLabel}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick && !disabled) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`${sizeClasses[size]} rounded-lg overflow-hidden transition-all duration-300 relative
        ${onClick && !disabled ? "card-interactive cursor-pointer" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${showGlow ? "ring-2 ring-gold-400 shadow-gold-glow" : "shadow-card"}
      `}
    >
      <Image
        src={getCartaImageUrl(carta)}
        alt={`${carta.valor} de ${carta.palo}`}
        fill
        sizes="(max-width: 640px) 64px, 96px"
        className="object-cover"
        draggable={false}
      />
    </button>
  );
}
