"use client";

import { useCallback } from "react";
import { Mesa } from "../types";
import { TEMAS_MESA, REVERSOS_CARTAS, MARCOS_AVATAR, MAPEO_TEMAS } from "../constants";

export function useCosmetics(mesa: Mesa | null, socketId: string | null) {
  // Obtener tema de mesa activo (solo del jugador actual - cada premium ve su propio tema)
  const getTemaActivo = useCallback((): {
    colors: [string, string, string];
    accent: string;
    felt: string;
    feltLight: string;
  } | null => {
    // 1. Intentar desde cosméticos del server
    if (mesa?.cosmeticosJugadores && socketId) {
      const misCosmetics = mesa.cosmeticosJugadores[socketId];
      if (misCosmetics?.tema_mesa && TEMAS_MESA[misCosmetics.tema_mesa]) {
        return TEMAS_MESA[misCosmetics.tema_mesa];
      }
    }
    // 2. Fallback: leer de sessionStorage
    try {
      const saved = sessionStorage.getItem("truco_usuario");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.tema_mesa && u.tema_mesa !== "clasico") {
          const cosmeticoId = MAPEO_TEMAS[u.tema_mesa];
          if (cosmeticoId && TEMAS_MESA[cosmeticoId]) {
            return TEMAS_MESA[cosmeticoId];
          }
        }
      }
    } catch { /* ignore */ }
    return null;
  }, [mesa?.cosmeticosJugadores, socketId]);

  // Obtener reverso de cartas activo (solo del jugador actual - cada premium ve su propio reverso)
  const getReversoActivo = useCallback((): [string, string] | null => {
    if (!mesa?.cosmeticosJugadores || !socketId) return null;
    const misCosmetics = mesa.cosmeticosJugadores[socketId];
    if (
      misCosmetics?.reverso_cartas &&
      REVERSOS_CARTAS[misCosmetics.reverso_cartas]
    ) {
      return REVERSOS_CARTAS[misCosmetics.reverso_cartas].colors;
    }
    return null;
  }, [mesa?.cosmeticosJugadores, socketId]);

  // Helper: inline style para overridear .card-back con reverso custom
  const getCardBackStyle = useCallback((): React.CSSProperties | undefined => {
    const colors = getReversoActivo();
    if (!colors) return undefined;
    return {
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
      borderColor: `${colors[0]}cc`,
    };
  }, [getReversoActivo]);

  // Helper: obtener marco de avatar para un jugador
  const getMarcoForPlayer = useCallback((playerId: string) => {
    if (!mesa?.cosmeticosJugadores) return MARCOS_AVATAR.marco_ninguno;
    const cosmetics = mesa.cosmeticosJugadores[playerId];
    if (cosmetics?.marco_avatar && MARCOS_AVATAR[cosmetics.marco_avatar]) {
      return MARCOS_AVATAR[cosmetics.marco_avatar];
    }
    return MARCOS_AVATAR.marco_ninguno;
  }, [mesa?.cosmeticosJugadores]);

  // Helper: inline style para overridear .mesa-flat con color de fieltro del tema
  const getMesaFeltStyle = useCallback((): React.CSSProperties | undefined => {
    const tema = getTemaActivo();
    if (!tema?.felt) return undefined;
    return { backgroundColor: tema.felt };
  }, [getTemaActivo]);

  return {
    getTemaActivo,
    getReversoActivo,
    getCardBackStyle,
    getMarcoForPlayer,
    getMesaFeltStyle,
  };
}
