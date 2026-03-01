// Mapeo palo del modelo -> nombre en archivo de imagen
export const paloAArchivo: Record<string, string> = {
  oro: "oros",
  copa: "copas",
  espada: "espadas",
  basto: "bastos",
};

// Configuración de temas de mesa para usuarios premium
// Usar colores CSS directos en lugar de clases Tailwind dinámicas
export const TEMAS_MESA: Record<
  string,
  { colors: [string, string, string]; accent: string; name: string; felt: string; feltLight: string }
> = {
  mesa_clasico: {
    colors: ["#1a3d1a", "#0d2e0d", "#0a2a0a"],
    accent: "#10b981",
    name: "Clásico",
    felt: "#064e3b",
    feltLight: "rgba(30, 120, 60, 0.4)",
  },
  mesa_noche: {
    colors: ["#1a2744", "#0d1a2e", "#0a1525"],
    accent: "#3b82f6",
    name: "Noche",
    felt: "#0f1d3d",
    feltLight: "rgba(30, 60, 150, 0.4)",
  },
  mesa_rojo: {
    colors: ["#4a1a1a", "#2e0d0d", "#250a0a"],
    accent: "#ef4444",
    name: "Casino",
    felt: "#3d1010",
    feltLight: "rgba(150, 30, 30, 0.4)",
  },
  mesa_dorado: {
    colors: ["#3d3010", "#2a200a", "#1a1505"],
    accent: "#f59e0b",
    name: "Dorado",
    felt: "#3d3010",
    feltLight: "rgba(150, 120, 30, 0.4)",
  },
  mesa_cuero: {
    colors: ["#4a2c17", "#3b2010", "#2a1508"],
    accent: "#d97706",
    name: "Cuero",
    felt: "#3d2510",
    feltLight: "rgba(150, 90, 30, 0.4)",
  },
  mesa_marmol: {
    colors: ["#374151", "#1f2937", "#111827"],
    accent: "#9ca3af",
    name: "Mármol",
    felt: "#1f2937",
    feltLight: "rgba(100, 100, 120, 0.3)",
  },
  mesa_neon: {
    colors: ["#2e1065", "#1e1b4b", "#0f0a2e"],
    accent: "#a855f7",
    name: "Neón",
    felt: "#1a0a3d",
    feltLight: "rgba(120, 50, 200, 0.4)",
  },
  mesa_medianoche: {
    colors: ["#0a0a0a", "#0d0d0d", "#050505"],
    accent: "#6366f1",
    name: "Medianoche",
    felt: "#0a0a15",
    feltLight: "rgba(60, 60, 120, 0.3)",
  },
};

// Configuración de reversos de cartas para usuarios premium (colores CSS directos)
export const REVERSOS_CARTAS: Record<
  string,
  { colors: [string, string]; name: string }
> = {
  reverso_clasico: { colors: ["#1e3a5f", "#172554"], name: "Clásico" },
  reverso_azul: { colors: ["#1d4ed8", "#1e3a8a"], name: "Azul Elegante" },
  reverso_rojo: { colors: ["#991b1b", "#450a0a"], name: "Rojo Fuego" },
  reverso_dorado: { colors: ["#b45309", "#78350f"], name: "Dorado Real" },
  reverso_verde: { colors: ["#166534", "#14532d"], name: "Verde Bosque" },
  reverso_purpura: { colors: ["#7e22ce", "#581c87"], name: "Púrpura" },
  reverso_negro: { colors: ["#1c1c1c", "#0a0a0a"], name: "Obsidiana" },
  reverso_arcoiris: { colors: ["#ec4899", "#8b5cf6"], name: "Arcoíris" },
};

export const MARCOS_AVATAR: Record<string, { border: string; shadow: string; ring: string }> = {
  marco_ninguno: { border: "border-gold-600/50", shadow: "", ring: "" },
  marco_bronce: { border: "border-amber-700", shadow: "shadow-lg shadow-amber-700/30", ring: "ring-1 ring-amber-600/40" },
  marco_plata: { border: "border-gray-300", shadow: "shadow-lg shadow-gray-300/30", ring: "ring-1 ring-gray-300/40" },
  marco_oro: { border: "border-yellow-400", shadow: "shadow-lg shadow-yellow-400/40", ring: "ring-2 ring-yellow-400/50" },
  marco_diamante: { border: "border-cyan-300", shadow: "shadow-lg shadow-cyan-300/50", ring: "ring-2 ring-cyan-300/60" },
};

// Valores que son pieza del palo de la muestra
export const VALORES_PIEZA_CLIENT = [2, 4, 5, 10, 11];

// Mapeo de nombre corto a ID de cosmético para fallback
export const MAPEO_TEMAS: Record<string, string> = {
  clasico: "mesa_clasico", azul: "mesa_noche", rojo: "mesa_rojo", dorado: "mesa_dorado",
  cuero: "mesa_cuero", marmol: "mesa_marmol", neon: "mesa_neon", medianoche: "mesa_medianoche",
};
