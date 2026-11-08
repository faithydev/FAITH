/**
 * FAITH design tokens. Pure black and pure white carry the logo; one neon green carries
 * everything alive: actions, focus, live state and data emphasis. The logo is never recoloured.
 */

export const palette = {
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    950: '#0A0A0A', 900: '#101010', 850: '#161616', 800: '#1E1E1E', 700: '#2A2A2A', 600: '#3D3D3D',
    500: '#6B6B6B', 400: '#8F8F8F', 300: '#B3B3B3', 200: '#D6D6D6', 150: '#E6E6E6', 100: '#F0F0F0', 50: '#F7F7F7',
  },
  neon: {
    100: '#D9FFE8', 200: '#B8FFD6', 300: '#7DFFB2', 400: '#33FF85', 500: '#00FF66',
    600: '#00D655', 700: '#00A844', 800: '#007A32', 900: '#003D19', 950: '#001F0D',
  },
  positive: { light: '#007A32', dark: '#33FF85' },
  warning: { light: '#9A6200', dark: '#FFC53D' },
  negative: { light: '#C62828', dark: '#FF6B6B' },
} as const;

export const radius = { xs: '6px', sm: '8px', md: '12px', lg: '18px', xl: '28px', full: '999px' } as const;

export const motion = {
  duration: { fast: '140ms', base: '220ms', slow: '420ms', cinematic: '760ms' },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

/** Semantic surfaces per theme. Components use these, never the raw palette. */
export const themes = {
  light: {
    bg: palette.gray[50], surface: palette.white, surface2: palette.gray[100], surface3: palette.gray[150],
    border: 'rgba(0,0,0,0.08)', borderStrong: 'rgba(0,0,0,0.16)',
    text: palette.black, textMuted: '#555555', textSubtle: '#6B6B6B',
    primary: palette.black, primaryText: palette.white, primaryHover: palette.gray[800],
    accent: palette.neon[800], accentSoft: 'rgba(0,168,68,0.1)',
    neon: palette.neon[500], neonDeep: palette.neon[800], neonGlow: 'rgba(0,214,85,0.35)',
    positive: palette.positive.light, warning: palette.warning.light, negative: palette.negative.light,
    focus: palette.neon[700],
    shadow1: '0 1px 2px rgba(0,0,0,0.05)',
    shadow2: '0 10px 30px -14px rgba(0,0,0,0.18)',
    shadow3: '0 30px 70px -28px rgba(0,0,0,0.3)',
  },
  dark: {
    bg: palette.black, surface: palette.gray[950], surface2: palette.gray[900], surface3: palette.gray[800],
    border: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.16)',
    text: palette.white, textMuted: palette.gray[300], textSubtle: palette.gray[400],
    primary: palette.neon[500], primaryText: palette.black, primaryHover: palette.neon[400],
    accent: palette.neon[500], accentSoft: 'rgba(0,255,102,0.1)',
    neon: palette.neon[500], neonDeep: palette.neon[800], neonGlow: 'rgba(0,255,102,0.45)',
    positive: palette.positive.dark, warning: palette.warning.dark, negative: palette.negative.dark,
    focus: palette.neon[500],
    shadow1: '0 1px 2px rgba(0,0,0,0.6)',
    shadow2: '0 12px 32px -14px rgba(0,0,0,0.9)',
    shadow3: '0 30px 80px -30px rgba(0,0,0,0.95)',
  },
} as const;

const kebab = (s: string) => s.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

/** Renders the tokens as CSS custom properties. The web app writes this to tokens.css. */
export function tokensCss(): string {
  const vars = (t: Record<string, string>) =>
    Object.entries(t).map(([k, v]) => `  --${kebab(k)}: ${v};`).join('\n');
  const staticVars = [
    ...Object.entries(radius).map(([k, v]) => `  --r-${k}: ${v};`),
    ...Object.entries(motion.duration).map(([k, v]) => `  --dur-${k}: ${v};`),
    ...Object.entries(motion.ease).map(([k, v]) => `  --ease-${k}: ${v};`),
  ].join('\n');
  return `/* Generated from @faith/design-tokens. Do not edit by hand. */
:root {
${staticVars}
${vars(themes.light)}
  color-scheme: light;
}
[data-theme='dark'] {
${vars(themes.dark)}
  color-scheme: dark;
}
`;
}
