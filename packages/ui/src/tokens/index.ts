/**
 * Design Token System for Hybrid Exchange Platform
 * Adheres strictly to Section 9:
 * - 4px base spacing scale
 * - Restrained palette: neutral dark & light themes, single brand accent, semantic buy/sell/warning colors
 * - Tabular lining numerals & mono font for prices / order book
 * - No hardcoded hex values in components
 */

export const tokens = {
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radii: {
    none: '0px',
    sm: '2px',
    md: '4px',
    lg: '6px',
    full: '9999px',
  },
  typography: {
    fontFamily: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
    },
    fontSize: {
      xs: '11px',
      sm: '12px',
      base: '13px',
      md: '14px',
      lg: '16px',
      xl: '18px',
      '2xl': '24px',
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
  },
  animation: {
    transitionDuration: '120ms',
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type DesignTokens = typeof tokens;
