/**
 * Shared Recharts theme configuration.
 *
 * WHY: The CSS variables in this project use oklch() color space.
 * Wrapping them in hsl() — e.g. `hsl(var(--card))` — produces the invalid
 * string "hsl(oklch(...))" which browsers silently ignore, leaving tooltips
 * unstyled in both light and dark mode.
 *
 * Fix: reference the CSS variables directly with var(). The browser resolves
 * oklch() values at paint time, so `var(--card)` correctly becomes the themed
 * color for the current mode.
 *
 * Axis / grid text is handled globally via globals.css Recharts class overrides
 * because SVG presentation attributes (stroke="...") do not resolve CSS
 * variables — CSS rules with higher specificity override them instead.
 */

/** Drop-in replacement for the `contentStyle` prop on every <Tooltip>. */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  border:          '1px solid var(--border)',
  borderRadius:    '8px',
  color:           'var(--card-foreground)',
  fontSize:        '12px',
  padding:         '8px 12px',
};

/** Axis stroke / tick fill (for Recharts props that accept CSS strings). */
export const CHART_AXIS_COLOR  = 'var(--muted-foreground)';

/** CartesianGrid stroke. */
export const CHART_GRID_COLOR  = 'var(--border)';
