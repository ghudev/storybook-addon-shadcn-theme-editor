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
const signed = (f: (x: number) => number) => (x: number) => Math.sign(x) * f(Math.abs(x));

/** Gamma-encoded sRGB, channels 0..1. Values outside 0..1 mean "outside the sRGB gamut". */
export type Rgb = { r: number; g: number; b: number; alpha: number };
/** h 0..360, s and l 0..100 (as written in CSS). */
export type Hsl = { h: number; s: number; l: number; alpha: number };
/** h 0..360, s and v 0..1 – only used by the picker's colour field. */
export type Hsv = { h: number; s: number; v: number };

export function oklchToRgb({ l, c, h, alpha }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = signed(toGamma);
  return {
    r: gamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: gamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: gamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    alpha,
  };
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(signed(toLinear));
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
  return { l: L, c: C < 0.0005 ? 0 : C, h: C < 0.0005 ? 0 : H, alpha: rgb.alpha };
}

/** True if the colour can be shown in sRGB without clipping. */
export const inSrgbGamut = ({ r, g, b }: Rgb, eps = 0.0005) =>
  [r, g, b].every((x) => x >= -eps && x <= 1 + eps);

export const clampRgb = ({ r, g, b, alpha }: Rgb): Rgb => ({
  r: clamp01(r),
  g: clamp01(g),
  b: clamp01(b),
  alpha,
});

export function rgbToHex(rgb: Rgb, withAlpha = rgb.alpha < 1): string {
  const ch = [rgb.r, rgb.g, rgb.b, ...(withAlpha ? [rgb.alpha] : [])];
  return (
    '#' +
    ch
      .map((x) =>
        Math.round(clamp01(x) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

export function parseHex(value: string): Rgb | null {
  let hex = value.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  if (hex.length <= 4) hex = [...hex].map((x) => x + x).join('');
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), alpha: hex.length === 8 ? n(6) : 1 };
}

export const oklchToHex = (oklch: Oklch) => rgbToHex({ ...oklchToRgb(oklch), alpha: 1 });
export const hexToOklch = (hex: string, alpha = 1): Oklch =>
  rgbToOklch({ ...(parseHex(hex) ?? { r: 0, g: 0, b: 0 }), alpha });

export function rgbToHsl({ r, g, b, alpha }: Rgb): Hsl {
  [r, g, b] = [r, g, b].map(clamp01);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: hueOf(r, g, b, max, d), s: s * 100, l: l * 100, alpha };
}

export function hslToRgb({ h, s, l, alpha }: Hsl): Rgb {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0), g: f(8), b: f(4), alpha };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  [r, g, b] = [r, g, b].map(clamp01);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  return { h: hueOf(r, g, b, max, d), s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv, alpha = 1): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5), g: f(3), b: f(1), alpha };
}

function hueOf(r: number, g: number, b: number, max: number, d: number) {
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Splits `fn(a b c / d)` or legacy `fn(a, b, c, d)` into its function name and arguments. */
function parseFunction(value: string): { fn: string; args: string[] } | null {
  const m = value.trim().match(/^([a-z]+)\(\s*([^()]*?)\s*\)$/i);
  if (!m) return null;
  const args = m[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  return { fn: m[1].toLowerCase(), args };
}

const isNum = (s: string) => /^-?[\d.]+(%|deg)?$/.test(s);
const alphaOf = (s?: string) =>
  s === undefined ? 1 : s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);

/** Parses `rgb(…)` / `rgba(…)` (modern or legacy syntax). */
export function parseRgb(value: string): Rgb | null {
  const p = parseFunction(value);
  if (!p || !/^rgba?$/.test(p.fn) || p.args.length < 3 || p.args.length > 4) return null;
  if (!p.args.every(isNum)) return null;
  const ch = (s: string) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s) / 255);
  return { r: ch(p.args[0]), g: ch(p.args[1]), b: ch(p.args[2]), alpha: alphaOf(p.args[3]) };
}

/** Parses `hsl(…)` / `hsla(…)` (modern or legacy syntax). */
export function parseHsl(value: string): Hsl | null {
  const p = parseFunction(value);
  if (!p || !/^hsla?$/.test(p.fn) || p.args.length < 3 || p.args.length > 4) return null;
  if (!p.args.every(isNum)) return null;
  return {
    h: parseFloat(p.args[0]),
    s: parseFloat(p.args[1]),
    l: parseFloat(p.args[2]),
    alpha: alphaOf(p.args[3]),
  };
}

const alphaSuffix = (alpha: number) => (alpha < 1 ? ` / ${round(alpha * 100, 1)}%` : '');

export const formatRgb = ({ r, g, b, alpha }: Rgb) =>
  `rgb(${[r, g, b].map((x) => Math.round(clamp01(x) * 255)).join(' ')}${alphaSuffix(alpha)})`;

export const formatHsl = ({ h, s, l, alpha }: Hsl) =>
  `hsl(${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%${alphaSuffix(alpha)})`;

export type ColorFormat = 'oklch' | 'rgb' | 'hsl' | 'hex';

export function detectFormat(value: string): ColorFormat | null {
  if (parseOklch(value)) return 'oklch';
  if (parseRgb(value)) return 'rgb';
  if (parseHsl(value)) return 'hsl';
  if (value.trim().startsWith('#') && parseHex(value)) return 'hex';
  return null;
}

/** Converts any supported colour string to (unclamped) sRGB. */
export function toRgb(value: string): Rgb | null {
  const oklch = parseOklch(value);
  if (oklch) return oklchToRgb(oklch);
  const hsl = parseHsl(value);
  if (hsl) return hslToRgb(hsl);
  return parseRgb(value) ?? (value.trim().startsWith('#') ? parseHex(value) : null);
}

/** Writes an sRGB colour in the given CSS format. */
export function formatColor(rgb: Rgb, format: ColorFormat): string {
  switch (format) {
    case 'oklch':
      return formatOklch(rgbToOklch(rgb));
    case 'hsl':
      return formatHsl(rgbToHsl(rgb));
    case 'hex':
      return rgbToHex(rgb);
    default:
      return formatRgb(rgb);
  }
}

/** Translates a colour string into another format. Exact for OKLCH sources (no sRGB detour). */
export function convertColor(value: string, format: ColorFormat): string | null {
  const format0 = detectFormat(value);
  if (format0 === format) return value;
  const rgb = toRgb(value);
  if (!rgb) return null;
  return formatColor(format === 'oklch' ? rgb : clampRgb(rgb), format);
}

/** True if the value looks like a colour the browser can paint as a swatch. */
export function isColorValue(value: string): boolean {
  return /^(oklch|oklab|rgb|rgba|hsl|hsla|lab|lch|color)\(|^#[0-9a-f]{3,8}$/i.test(value.trim());
}
