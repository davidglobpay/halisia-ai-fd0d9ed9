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
  // HALISIA light-glass brand palette
  black: "#102D1A", // deep forest — ink / deepest surface
  charcoal: "#1B4429",
  graphite: "#2B5C3A",
  white: "#F7F3EA", // egg white — page background
  offWhite: "#FFFDF8",
  emerald: "#147B35", // primary — verified / positive
  emeraldGlow: "#1B9B45",
  emeraldDeep: "#0E5A26",
  emeraldInk: "#0E5A26", // AA-safe small text on tinted glass
  crimson: "#B3261E", // destructive — risk / alert
  crimsonGlow: "#D2372C",
  crimsonDeep: "#8C1C16",
  // Accents (use sparingly)
  gold: "#C08A2E",
  goldSoft: "#D4AF37",
  champagne: "#EDD493",
  silver: "#E7E0D2",
  silverBrushed: "#6B7A6E",
} as const;

export const gradients = {
  green: `linear-gradient(135deg, ${colors.emeraldDeep} 0%, ${colors.emerald} 55%, ${colors.emeraldGlow} 100%)`,
  red: `linear-gradient(135deg, ${colors.crimsonDeep} 0%, ${colors.crimson} 55%, ${colors.crimsonGlow} 100%)`,
  gold: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldSoft} 50%, ${colors.champagne} 100%)`,
  silver: `linear-gradient(135deg, ${colors.silverBrushed} 0%, ${colors.silver} 100%)`,
  hero: `linear-gradient(135deg, ${colors.black} 0%, ${colors.emerald} 45%, ${colors.gold} 100%)`,
  night: `linear-gradient(180deg, ${colors.white} 0%, #F1ECE0 60%, #E7E0D2 100%)`,
} as const;

/** Chart series, in order. Each >= 3:1 on ivory; tested for protan/deutan/tritan separation. */
export const chart = ["#147B35", "#B37E1D", "#850404", "#73927B", "#597962"] as const;

export const radii = {
  xs: "6px",
  sm: "10px",
  md: "12px",
  lg: "16px",
  xl: "20px", // canonical glass radius
  "2xl": "24px",
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
  soft: "0 8px 24px rgba(16,45,26,0.10)",
  glass: "0 1px 0 0 rgba(255,255,255,0.70) inset, 0 14px 34px rgba(16,45,26,0.08)",
  glassStrong: "0 1px 0 0 rgba(255,255,255,0.80) inset, 0 22px 56px rgba(16,45,26,0.12)",
  glowGold: "0 10px 34px rgba(192,138,46,0.22), 0 0 60px rgba(192,138,46,0.12)",
  glowEmerald: "0 10px 34px rgba(20,123,53,0.22), 0 0 60px rgba(20,123,53,0.12)",
  glowCrimson: "0 10px 34px rgba(179,38,30,0.22), 0 0 60px rgba(179,38,30,0.12)",
  glowSilver: "0 0 24px rgba(16,45,26,0.10)",
} as const;

export const blur = {
  sm: "12px",
  md: "24px", // canonical glass blur
  lg: "32px",
} as const;

export const motion = {
  fast: "150ms",
  base: "180ms",
  slow: "320ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/** Semantic aliases (map intent → color) */
export const semantic = {
  positive: colors.emerald,
  negative: colors.crimson,
  premium: colors.gold,
  neutral: colors.silver,
  surface: colors.offWhite,
  onSurface: colors.black,
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
