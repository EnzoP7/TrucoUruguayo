"use client";

import { useState } from "react";
import Image from "next/image";
import { Carta } from "../types";
import {
  getCartaImageUrl,
  getNombrePoderCarta,
  ordenarCartasPorPoder,
  calcularEnvido,
  tieneFlor_client,
  calcularFlor_client,
} from "../utils";

export default function PanelAyuda({
  cartas,
  muestra,
  envidoYaCantado,
  florYaCantada,
}: {
  cartas: Carta[];
  muestra: Carta | null;
  envidoYaCantado: boolean;
  florYaCantada: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const cartasOrdenadas = ordenarCartasPorPoder(cartas);
  const envido = calcularEnvido(cartas);
  const cartaMasAlta = cartasOrdenadas[0];

  // Verificar flor con reglas completas (incluye piezas)
  const tieneFlor = tieneFlor_client(cartas, muestra);
  const florInfo = tieneFlor ? calcularFlor_client(cartas, muestra) : null;

  // Minimizado: solo el boton
  if (!abierto) {
    return (
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setAbierto(true)}
          className="glass rounded-xl p-2.5 border border-celeste-500/30 bg-celeste-950/40 shadow-lg hover:bg-celeste-900/50 transition-all flex items-center gap-2"
          title="Abrir ayuda"
        >
          <span className="text-lg">📚</span>
          <span className="hidden md:inline text-celeste-300 text-sm font-medium">
            Ayuda
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40 w-48 sm:w-56">
      <div className="glass rounded-xl p-3 border border-celeste-500/30 bg-celeste-950/40 shadow-lg">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-celeste-500/20">
          <span className="text-lg">📚</span>
          <h3 className="text-celeste-300 font-bold text-sm flex-1">Ayuda</h3>
          <button
            onClick={() => setAbierto(false)}
            className="text-celeste-400/60 hover:text-celeste-300 text-xs px-1.5 py-0.5 rounded hover:bg-celeste-800/30 transition-all"
            title="Minimizar"
          >
            X
          </button>
        </div>

        {/* Carta mas alta */}
        {cartaMasAlta && (
          <div className="mb-3">
            <div className="text-celeste-400/70 text-xs font-medium mb-1">
              Tu carta mas fuerte:
            </div>
            <div className="flex items-center gap-2 bg-celeste-900/30 rounded-lg p-2">
              <Image
                src={getCartaImageUrl(cartaMasAlta)}
                alt={`${cartaMasAlta.valor} de ${cartaMasAlta.palo}`}
                width={32}
                height={48}
                className="w-8 h-12 rounded shadow"
              />
              <div className="text-xs">
                <div className="text-white font-medium">
                  {cartaMasAlta.valor} de {cartaMasAlta.palo}
                </div>
                <div
                  className={`${cartaMasAlta.poder >= 15 ? "text-yellow-400" : "text-celeste-300/60"}`}
                >
                  {getNombrePoderCarta(cartaMasAlta)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Envido - ocultar si ya se resolvio */}
        {!envidoYaCantado && (
          <div className="mb-3">
            <div className="text-celeste-400/70 text-xs font-medium mb-1">
              Tu envido:
            </div>
            <div className="bg-celeste-900/30 rounded-lg p-2">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {envido.puntos}
              </div>
              <div className="text-celeste-300/60 text-[10px] leading-tight">
                {envido.explicacion}
              </div>
            </div>
          </div>
        )}

        {/* Flor - con puntos calculados */}
        {tieneFlor && !florYaCantada && florInfo && (
          <div className="mb-3">
            <div className="text-pink-400/70 text-xs font-medium mb-1">
              Tenes FLOR!
            </div>
            <div className="bg-pink-900/30 rounded-lg p-2">
              <div className="text-2xl font-bold text-pink-300 mb-1">
                {florInfo.puntos}
              </div>
              <div className="text-pink-300/60 text-[10px] leading-tight">
                {florInfo.explicacion}
              </div>
            </div>
          </div>
        )}

        {/* Orden de cartas */}
        <div className="mb-2">
          <div className="text-celeste-400/70 text-xs font-medium mb-1">
            Tus cartas (de + a -):
          </div>
          <div className="space-y-1">
            {cartasOrdenadas.map((carta, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-[10px] rounded px-2 py-1 ${
                  carta.poder >= 15
                    ? "bg-yellow-900/30 border border-yellow-500/20"
                    : "bg-celeste-900/20"
                }`}
              >
                <span className="text-celeste-300 font-bold">{idx + 1}.</span>
                <span className="text-white">
                  {carta.valor} {carta.palo}
                </span>
                <span
                  className={`ml-auto text-[9px] ${carta.poder >= 15 ? "text-yellow-400" : "text-celeste-400/50"}`}
                >
                  {getNombrePoderCarta(carta)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Muestra */}
        {muestra && (
          <div className="pt-2 border-t border-celeste-500/20">
            <div className="text-yellow-400/70 text-xs font-medium mb-1">
              Muestra: {muestra.valor} de {muestra.palo}
            </div>
            <div className="text-[10px] text-yellow-300/50">
              Las cartas de {muestra.palo} son piezas (mas fuertes)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
