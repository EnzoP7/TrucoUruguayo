"use client";

import Image from "next/image";

export default function MonedaMano({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-500 ${
        isActive
          ? "animate-coin-flip shadow-lg shadow-yellow-500/40"
          : "opacity-40 grayscale"
      }`}
      title="Mano"
    >
      <Image
        src="/Images/MonedaArtigas.png"
        alt="Mano"
        width={32}
        height={32}
        className="w-full h-full rounded-full object-cover"
      />
    </div>
  );
}
