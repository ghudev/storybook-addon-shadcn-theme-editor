// Shared between the manager (panel) and the preview (iframe).

export const ADDON_ID = 'shadcn-theme-editor';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const STORAGE_KEY = 'shadcn-theme-editor:v1';

export const EVENTS = {
  REQUEST_BASELINE: `${ADDON_ID}/request-baseline`,
  BASELINE: `${ADDON_ID}/baseline`,
  APPLY: `${ADDON_ID}/apply`,
} as const;

export type Mode = 'light' | 'dark';
export type VarMap = Record<string, string>;
export type ThemeVars = { light: VarMap; dark: VarMap };

export const emptyTheme = (): ThemeVars => ({ light: {}, dark: {} });

// ---------- persistence (manager and preview share an origin) ----------

export function loadOverrides(): ThemeVars {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { light: parsed.light ?? {}, dark: parsed.dark ?? {} };
    }
  } catch {
    /* storage unavailable */
  }
  return emptyTheme();
}

export function saveOverrides(overrides: ThemeVars) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* storage unavailable */
  }
}

// ---------- CSS parsing / formatting ----------

function parseDeclarations(body: string): VarMap {
  const out: VarMap = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].trim();
  return out;
}

/** Parses the `:root { … }` and `.dark { … }` blocks of a pasted theme (e.g. a shadcn studio export). */
export function parseThemeCss(css: string): ThemeVars {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const theme = emptyTheme();
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(clean))) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(':root')) Object.assign(theme.light, parseDeclarations(m[2]));
    else if (selectors.includes('.dark')) Object.assign(theme.dark, parseDeclarations(m[2]));
  }
  return theme;
}

const block = (selector: string, vars: VarMap) =>
  `${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`;

export function formatThemeCss(theme: ThemeVars): string {
  return `${block(':root', theme.light)}\n\n${block('.dark', theme.dark)}\n`;
}

// ---------- OKLCH <-> sRGB ----------

export type Oklch = { l: number; c: number; h: number; alpha: number };

export function parseOklch(value: string): Oklch | null {
  const m = value
    .trim()
    .match(
      /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+|none)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/i
    );
  if (!m) return null;
  const num = (s: string, pctScale: number) =>
    s.endsWith('%') ? (parseFloat(s) / 100) * pctScale : parseFloat(s);
  return {
    l: num(m[1], 1),
    c: num(m[2], 0.4),
    h: m[3] === 'none' ? 0 : parseFloat(m[3]),
    alpha: m[4] ? num(m[4], 1) : 1,
  };
}

const round = (n: number, d: number) => Number(n.toFixed(d));

export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const a = alpha < 1 ? ` / ${round(alpha * 100, 1)}%` : '';
  return `oklch(${round(l, 3)} ${round(c, 3)} ${round(h, 2)}${a})`;
}

const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const toGamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function oklchToHex({ l, c, h }: Oklch): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    '#' +
    rgb
      .map((x) =>
        Math.round(clamp01(toGamma(x)) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

export function hexToOklch(hex: string, alpha = 1): Oklch {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => toLinear(x / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  // Achromatic colours: keep hue at 0 so values stay tidy (e.g. oklch(0.985 0 0)).
  return { l: L, c: C < 0.0005 ? 0 : C, h: C < 0.0005 ? 0 : H, alpha };
}

/** True if the value looks like a colour the browser can paint as a swatch. */
export function isColorValue(value: string): boolean {
  return /^(oklch|oklab|rgb|rgba|hsl|hsla|lab|lch|color)\(|^#[0-9a-f]{3,8}$/i.test(value.trim());
}
