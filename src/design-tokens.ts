/**
 * HALISIA.AI unified design tokens.
 *
 * The source of truth is CSS custom properties in `src/styles.css` and the
 * @theme block (colors, radii, fonts). This module re-exports the semantic
 * names so TS/JS code (charts, canvas, PDF generators, inline styles) can
 * reference the same values without hardcoding hex.
 *
 * Always prefer Tailwind utility classes (`bg-primary`, `text-accent`,
 * `glass`, `rounded-2xl`) in JSX. Reach for these tokens only when the
 * consumer cannot resolve CSS variables (e.g. Recharts stroke, jsPDF).
 */

export const colors = {
  // Kenyan flag palette
  black: "#05070A",
  charcoal: "#0D1116",
  graphite: "#151A21",
  white: "#F7F8FA",
  offWhite: "#E9ECF2",
  emerald: "#0E7C3A", // primary — verified / positive
  emeraldGlow: "#22C55E",
  emeraldDeep: "#064023",
  crimson: "#C8102E", // destructive — risk / alert
  crimsonGlow: "#F43F5E",
  crimsonDeep: "#7A0A1C",
  // Accents (use sparingly)
  gold: "#D4A017",
  goldSoft: "#E8C560",
  champagne: "#F1DFA4",
  silver: "#C7CED6",
  silverBrushed: "#8B94A0",
} as const;

export const gradients = {
  green: `linear-gradient(135deg, ${colors.emeraldDeep} 0%, ${colors.emerald} 55%, ${colors.emeraldGlow} 100%)`,
  red: `linear-gradient(135deg, ${colors.crimsonDeep} 0%, ${colors.crimson} 55%, ${colors.crimsonGlow} 100%)`,
  gold: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldSoft} 50%, ${colors.champagne} 100%)`,
  silver: `linear-gradient(135deg, ${colors.silverBrushed} 0%, ${colors.silver} 100%)`,
  hero: `linear-gradient(135deg, ${colors.white} 0%, ${colors.gold} 55%, ${colors.emerald} 100%)`,
  night: `linear-gradient(180deg, ${colors.black} 0%, ${colors.charcoal} 60%, ${colors.graphite} 100%)`,
} as const;

export const radii = {
  xs: "6px",
  sm: "10px",
  md: "14px",
  lg: "18px",
  xl: "22px", // canonical glass radius
  "2xl": "28px",
  pill: "9999px",
} as const;

export const spacing = {
  hair: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
  "4xl": "64px",
} as const;

export const shadows = {
  soft: "0 8px 24px rgba(0,0,0,0.25)",
  glass: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 50px rgba(0,0,0,0.45)",
  glassStrong: "0 1px 0 0 rgba(255,255,255,0.10) inset, 0 30px 80px rgba(0,0,0,0.60)",
  glowGold: "0 0 40px rgba(212,160,23,0.35), 0 0 80px rgba(212,160,23,0.18)",
  glowEmerald: "0 0 40px rgba(14,124,58,0.35), 0 0 80px rgba(14,124,58,0.18)",
  glowCrimson: "0 0 40px rgba(200,16,46,0.35), 0 0 80px rgba(200,16,46,0.18)",
  glowSilver: "0 0 24px rgba(199,206,214,0.25)",
} as const;

export const blur = {
  sm: "12px",
  md: "24px", // canonical glass blur
  lg: "32px",
} as const;

export const motion = {
  fast: "150ms",
  base: "220ms",
  slow: "420ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/** Semantic aliases (map intent → color) */
export const semantic = {
  positive: colors.emerald,
  negative: colors.crimson,
  premium: colors.gold,
  neutral: colors.silver,
  surface: colors.charcoal,
  onSurface: colors.white,
} as const;

export type DesignTokens = {
  colors: typeof colors;
  gradients: typeof gradients;
  radii: typeof radii;
  spacing: typeof spacing;
  shadows: typeof shadows;
  blur: typeof blur;
  motion: typeof motion;
  semantic: typeof semantic;
};

export const tokens: DesignTokens = {
  colors,
  gradients,
  radii,
  spacing,
  shadows,
  blur,
  motion,
  semantic,
};

export default tokens;
