"use client";

import React from "react";

export default function MazoCorte({
  onCorte,
  esperandoCorte,
  esMiTurnoCorte,
  cutAnimating,
  cutPosition,
  setCutPosition,
  setCutAnimating,
  getCardBackStyle,
}: {
  onCorte?: (posicion: number) => void;
  esperandoCorte: boolean;
  esMiTurnoCorte: boolean;
  cutAnimating: boolean;
  cutPosition: number | null;
  setCutPosition: (pos: number | null) => void;
  setCutAnimating: (val: boolean) => void;
  getCardBackStyle: () => React.CSSProperties | undefined;
}) {
  if (!esperandoCorte) return null;

  const TOTAL_CARTAS = 40; // 40 cartas en el mazo

  const handleCartaClick = async (index: number) => {
    if (!esMiTurnoCorte || !onCorte || cutAnimating) return;
    const posicion = index + 1;
    setCutPosition(index);
    setCutAnimating(true);

    await new Promise((resolve) => setTimeout(resolve, 600));
    onCorte(posicion);
  };

  // Tamaños responsive para mobile/tablet/desktop
  // En mobile: cartas más pequeñas y menos spread
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const isTablet =
    typeof window !== "undefined" &&
    window.innerWidth >= 640 &&
    window.innerWidth < 1024;

  const cardWidth = esMiTurnoCorte
    ? "w-6 h-10 sm:w-10 sm:h-16 lg:w-14 lg:h-22"
    : "w-4 h-6 sm:w-6 sm:h-10";

  // Contenedor responsive - más pequeño en mobile
  const containerClasses = esMiTurnoCorte
    ? "w-[95vw] sm:w-[85vw] lg:w-[700px] h-[140px] sm:h-[180px] lg:h-[220px]"
    : "w-[80vw] sm:w-[400px] h-[100px] sm:h-[140px]";

  // Spread y arco responsive
  const getSpreadMultiplier = () => {
    if (!esMiTurnoCorte) return isMobile ? 5 : isTablet ? 8 : 11;
    return isMobile ? 5 : isTablet ? 10 : 15;
  };
  const getArcMultiplier = () => {
    if (!esMiTurnoCorte) return isMobile ? 6 : isTablet ? 9 : 12;
    return isMobile ? 10 : isTablet ? 15 : 20;
  };

  const spreadMultiplier = getSpreadMultiplier();
  const arcMultiplier = getArcMultiplier();

  return (
    <div
      className={`flex flex-col items-center z-30 transition-all duration-500 ${
        esMiTurnoCorte ? "scale-100" : "scale-90 opacity-70"
      }`}
    >
      <div
        className={`font-bold mb-2 sm:mb-4 uppercase tracking-wider ${
          esMiTurnoCorte
            ? "text-base sm:text-xl lg:text-2xl text-gold-400 animate-pulse drop-shadow-lg"
            : "text-xs sm:text-sm lg:text-base text-gold-500/60"
        }`}
      >
        {esMiTurnoCorte ? "¡CORTÁ EL MAZO!" : "Esperando corte..."}
      </div>

      {esMiTurnoCorte && !cutAnimating && (
        <div className="mb-2 sm:mb-4 text-gold-300/80 text-xs sm:text-sm lg:text-base font-medium animate-bounce">
          👇 Tocá una carta para cortar 👇
        </div>
      )}

      {/* Abanico horizontal de 40 cartas - responsive */}
      <div
        className={`relative ${cutAnimating ? "" : "deck-shuffle-anim"} ${containerClasses}`}
      >
        {Array.from({ length: TOTAL_CARTAS }).map((_, i) => {
          const isLeftPart = cutPosition !== null && i <= cutPosition;
          const isRightPart = cutPosition !== null && i > cutPosition;

          const spreadX = (i - TOTAL_CARTAS / 2) * spreadMultiplier;
          const arcY =
            Math.pow((i - TOTAL_CARTAS / 2) / (TOTAL_CARTAS / 2), 2) *
            arcMultiplier;

          return (
            <div
              key={i}
              onClick={() => handleCartaClick(i)}
              className={`absolute transition-all duration-500 ease-out origin-bottom
                ${esMiTurnoCorte && !cutAnimating ? "cursor-pointer group" : "cursor-default"}
              `}
              style={{
                left: "50%",
                bottom: "10px",
                zIndex: i + 1,
                transform: cutAnimating
                  ? isLeftPart
                    ? `translateX(calc(-50% + ${spreadX - 40}px)) translateY(${-arcY - 30}px) rotate(${-15}deg)`
                    : isRightPart
                      ? `translateX(calc(-50% + ${spreadX + 40}px)) translateY(${-arcY}px) rotate(${12}deg)`
                      : `translateX(calc(-50% + ${spreadX}px)) translateY(${-arcY}px)`
                  : `translateX(calc(-50% + ${spreadX}px)) translateY(${-arcY}px)`,
              }}
            >
              <div
                className={`${cardWidth} card-back rounded transition-all duration-200 border ${
                  esMiTurnoCorte
                    ? "border-gold-600/70 shadow-lg shadow-gold-500/20"
                    : "border-amber-900/50"
                } ${
                  esMiTurnoCorte && !cutAnimating
                    ? "group-hover:-translate-y-4 sm:group-hover:-translate-y-6 group-hover:shadow-xl group-hover:shadow-gold-500/50 group-hover:scale-110 sm:group-hover:scale-125 group-hover:z-50 group-hover:border-gold-400"
                    : ""
                }`}
                style={{
                  ...getCardBackStyle(),
                  boxShadow: esMiTurnoCorte
                    ? `1px 2px 6px rgba(0,0,0,0.5), 0 0 10px rgba(202, 138, 4, 0.2)`
                    : `1px 2px 4px rgba(0,0,0,0.4)`,
                }}
              />
            </div>
          );
        })}
      </div>

      {esMiTurnoCorte && !cutAnimating && (
        <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-gold-400/70 font-medium">
          Posición 1-40
        </div>
      )}

      {cutAnimating && cutPosition !== null && (
        <div className="mt-2 sm:mt-4 text-sm sm:text-lg text-gold-400 font-bold animate-pulse">
          ✂️ Cortando en posición {cutPosition + 1}...
        </div>
      )}
    </div>
  );
}
