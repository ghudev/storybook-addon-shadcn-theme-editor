import { describe, expect, it } from 'vitest';
import {
  convertColor,
  detectFormat,
  formatHsl,
  formatRgb,
  hslToRgb,
  hsvToRgb,
  inSrgbGamut,
  oklchToRgb,
  parseHsl,
  parseRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  formatOklch,
  formatThemeCss,
  hexToOklch,
  isColorValue,
  oklchToHex,
  parseOklch,
  parseThemeCss,
} from './shared';

describe('parseOklch', () => {
  it('parses plain numbers', () => {
    expect(parseOklch('oklch(0.205 0 0)')).toEqual({ l: 0.205, c: 0, h: 0, alpha: 1 });
  });

  it('parses percentages and alpha (as minified by Tailwind)', () => {
    expect(parseOklch('oklch(14.5% 0 0)')).toEqual({ l: 0.145, c: 0, h: 0, alpha: 1 });
    expect(parseOklch('oklch(1 0 0 / 10%)')).toEqual({ l: 1, c: 0, h: 0, alpha: 0.1 });
    expect(parseOklch('oklch(0.6 0.2 260deg / 0.5)')).toEqual({
      l: 0.6,
      c: 0.2,
      h: 260,
      alpha: 0.5,
    });
  });

  it('returns null for non-OKLCH values', () => {
    expect(parseOklch('#fff')).toBeNull();
    expect(parseOklch('hsl(0 0% 100%)')).toBeNull();
  });
});

describe('formatOklch', () => {
  it('rounds and only writes alpha when needed', () => {
    expect(formatOklch({ l: 0.55555, c: 0.12345, h: 259.999, alpha: 1 })).toBe(
      'oklch(0.556 0.123 260)'
    );
    expect(formatOklch({ l: 1, c: 0, h: 0, alpha: 0.1 })).toBe('oklch(1 0 0 / 10%)');
  });
});

describe('colour conversion', () => {
  it('maps black and white', () => {
    expect(oklchToHex({ l: 0, c: 0, h: 0, alpha: 1 })).toBe('#000000');
    expect(oklchToHex({ l: 1, c: 0, h: 0, alpha: 1 })).toBe('#ffffff');
  });

  it('round-trips sRGB colours', () => {
    for (const hex of ['#3b82f6', '#ef4444', '#22c55e', '#737373', '#f5f5f5']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('keeps greys achromatic', () => {
    const grey = hexToOklch('#737373');
    expect(grey.c).toBe(0);
    expect(grey.h).toBe(0);
  });

  it('keeps alpha when picking a new colour', () => {
    expect(hexToOklch('#ffffff', 0.1).alpha).toBe(0.1);
  });
});

describe('parseThemeCss / formatThemeCss', () => {
  const css = `
    /* exported from shadcn studio */
    :root {
      --radius: 0.5rem;
      --primary: oklch(0.6 0.2 260);
    }
    .dark { --primary: oklch(0.7 0.15 150); }
    @theme inline { --color-primary: var(--primary); }
  `;

  it('reads :root and .dark blocks and ignores the rest', () => {
    expect(parseThemeCss(css)).toEqual({
      light: { '--radius': '0.5rem', '--primary': 'oklch(0.6 0.2 260)' },
      dark: { '--primary': 'oklch(0.7 0.15 150)' },
    });
  });

  it('round-trips through formatThemeCss', () => {
    const theme = parseThemeCss(css);
    expect(parseThemeCss(formatThemeCss(theme))).toEqual(theme);
  });
});

describe('isColorValue', () => {
  it('detects colours', () => {
    expect(isColorValue('oklch(0.5 0.1 20)')).toBe(true);
    expect(isColorValue('#abc')).toBe(true);
    expect(isColorValue('0.625rem')).toBe(false);
    expect(isColorValue('ui-sans-serif, system-ui')).toBe(false);
  });
});

describe('rgb / hsl parsing and formatting', () => {
  it('parses modern and legacy syntax', () => {
    expect(rgbToHex(parseRgb('rgb(59 130 246)')!)).toBe('#3b82f6');
    expect(parseRgb('rgba(255, 0, 0, 0.5)')).toEqual({ r: 1, g: 0, b: 0, alpha: 0.5 });
    expect(parseHsl('hsl(217.2 91.2% 59.8% / 50%)')).toEqual({
      h: 217.2,
      s: 91.2,
      l: 59.8,
      alpha: 0.5,
    });
    expect(parseHsl('hsla(0, 100%, 50%, 1)')).toEqual({ h: 0, s: 100, l: 50, alpha: 1 });
    expect(parseRgb('oklch(0.5 0.1 20)')).toBeNull();
  });

  it('formats with modern syntax', () => {
    expect(formatRgb({ r: 1, g: 0.5, b: 0, alpha: 0.25 })).toBe('rgb(255 128 0 / 25%)');
    expect(formatHsl({ h: 210.04, s: 40, l: 98.04, alpha: 1 })).toBe('hsl(210 40% 98%)');
  });

  it('detects formats', () => {
    expect(detectFormat('oklch(0.5 0.1 20)')).toBe('oklch');
    expect(detectFormat('rgb(0 0 0)')).toBe('rgb');
    expect(detectFormat('hsl(0 0% 0%)')).toBe('hsl');
    expect(detectFormat('#fff')).toBe('hex');
    expect(detectFormat('var(--x)')).toBeNull();
  });
});

describe('hsl / hsv conversion', () => {
  it('round-trips through hsl and hsv', () => {
    for (const hex of ['#3b82f6', '#ef4444', '#22c55e', '#737373', '#000000', '#ffffff']) {
      const rgb = parseRgb(
        `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')})`
      )!;
      expect(rgbToHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex);
      expect(rgbToHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex);
    }
  });
});

describe('convertColor', () => {
  it('translates between oklch, rgb and hsl', () => {
    expect(convertColor('rgb(255 0 0)', 'hsl')).toBe('hsl(0 100% 50%)');
    expect(convertColor('hsl(0 100% 50%)', 'rgb')).toBe('rgb(255 0 0)');
    expect(convertColor('oklch(1 0 0)', 'rgb')).toBe('rgb(255 255 255)');
    expect(convertColor('rgb(255 255 255)', 'oklch')).toBe('oklch(1 0 0)');
    expect(convertColor('oklch(1 0 0 / 10%)', 'hsl')).toBe('hsl(0 0% 100% / 10%)');
  });

  it('leaves a value alone when it is already in that format', () => {
    expect(convertColor('oklch(0.6 0.2 260)', 'oklch')).toBe('oklch(0.6 0.2 260)');
  });

  it('flags colours outside sRGB', () => {
    expect(inSrgbGamut(oklchToRgb({ l: 0.6, c: 0.37, h: 150, alpha: 1 }))).toBe(false);
    expect(inSrgbGamut(oklchToRgb({ l: 0.6, c: 0.05, h: 150, alpha: 1 }))).toBe(true);
  });
});
