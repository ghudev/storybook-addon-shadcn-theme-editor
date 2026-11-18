import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from 'storybook/theming';
import {
  clampRgb,
  convertColor,
  detectFormat,
  formatColor,
  formatHsl,
  formatOklch,
  formatRgb,
  hsvToRgb,
  inSrgbGamut,
  parseHex,
  parseHsl,
  parseOklch,
  parseRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  toRgb,
  type ColorFormat,
  type Hsv,
  type Rgb,
} from './shared';

const CHECKER = 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px';
const POPOVER_WIDTH = 248;
const BLACK: Rgb = { r: 0, g: 0, b: 0, alpha: 1 };

type Tab = 'oklch' | 'rgb' | 'hsl';
const TABS: { id: Tab; label: string }[] = [
  { id: 'oklch', label: 'OKLCH' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
];

/** Colour swatch that opens a popover with a colour field, hue/alpha bars and OKLCH/RGB/HSL channels. */
export function ColorSwatchPicker({
  value,
  onChange,
  border,
}: {
  value: string;
  onChange: (v: string) => void;
  border: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        title="Pick a colour"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          width: 28,
          height: 22,
          flexShrink: 0,
          padding: 0,
          borderRadius: 4,
          border,
          cursor: 'pointer',
          overflow: 'hidden',
          background: CHECKER,
        }}
      >
        <span style={{ position: 'absolute', inset: 0, background: value }} />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <ColorPicker value={value} onChange={onChange} />
        </Popover>
      )}
    </>
  );
}

function Popover({
  anchor,
  onClose,
  children,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fixed positioning next to the swatch; flips above it when there is no room below.
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 0;
      if (!a) return;
      const below = a.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, a.top - 6 - h) : below;
      const left = Math.min(Math.max(8, a.left), window.innerWidth - POPOVER_WIDTH - 8);
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        anchor.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Colour picker"
      style={{
        position: 'fixed',
        zIndex: 1000,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        width: POPOVER_WIDTH,
        boxSizing: 'border-box',
        padding: 10,
        borderRadius: 6,
        border: `1px solid ${theme.appBorderColor}`,
        background: theme.background.content,
        color: theme.color.defaultText,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

const tabOf = (format: ColorFormat | null): Tab =>
  format === 'oklch' || format === 'hsl' ? format : 'rgb';

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  const format: ColorFormat = detectFormat(value) ?? 'oklch';
  const rgb = toRgb(value) ?? BLACK;
  const alpha = rgb.alpha;

  // The field keeps its own HSV state so hue and saturation survive at black, white and greys.
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(rgb));
  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const next = rgbToHsv(rgb);
    setHsv((prev) => ({
      h: next.s === 0 || next.v === 0 ? prev.h : next.h,
      s: next.v === 0 ? prev.s : next.s,
      v: next.v,
    }));
  }, [value]);

  const emit = (v: string) => {
    lastEmitted.current = null;
    onChange(v);
  };
  const emitFromField = (next: Hsv) => {
    setHsv(next);
    const v = formatColor(hsvToRgb(next, alpha), format);
    lastEmitted.current = v;
    onChange(v);
  };

  const outOfGamut = !inSrgbGamut(rgb);
  const opaque = rgbToHex(clampRgb({ ...rgb, alpha: 1 }));
  const border = `1px solid ${theme.appBorderColor}`;
  const tab = tabOf(format);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <SaturationField hsv={hsv} onChange={emitFromField} border={border} />
      <Bar
        label="Hue"
        value={hsv.h / 360}
        onChange={(t) => emitFromField({ ...hsv, h: t * 360 })}
        background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
        border={border}
      />
      <Bar
        label="Alpha"
        value={alpha}
        onChange={(t) => emit(withAlpha(value, format, rgb, t))}
        background={`linear-gradient(to right, transparent, ${opaque}), ${CHECKER}`}
        border={border}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          title={value}
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 4,
            border,
            background: `linear-gradient(${value}, ${value}), ${CHECKER}`,
          }}
        />
        <div role="tablist" style={{ display: 'flex', flex: 1, border, borderRadius: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              title={`Convert to ${t.label}`}
              onClick={() => {
                if (tab === t.id) return;
                const converted = convertColor(value, t.id);
                if (converted) emit(converted);
              }}
              style={{
                flex: 1,
                padding: '4px 0',
                border: 'none',
                background: tab === t.id ? theme.color.secondary : 'transparent',
                color: tab === t.id ? theme.color.lightest : 'inherit',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Channels value={value} format={format} rgb={rgb} onChange={emit} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 14, color: theme.textMutedColor }}>#</span>
        <TextInput
          value={rgbToHex(rgb).slice(1)}
          onCommit={(text) => {
            const parsed = parseHex(text);
            if (parsed)
              emit(
                formatColor(
                  text.replace('#', '').length > 6 ? parsed : { ...parsed, alpha },
                  format
                )
              );
          }}
        />
      </label>

      {outOfGamut && (
        <div style={{ color: theme.textMutedColor }}>
          Outside sRGB – the field and hex show the nearest displayable colour.
        </div>
      )}
    </div>
  );
}

function withAlpha(value: string, format: ColorFormat, rgb: Rgb, alpha: number): string {
  alpha = Math.round(alpha * 1000) / 1000;
  const oklch = parseOklch(value);
  if (oklch) return formatOklch({ ...oklch, alpha });
  const hsl = parseHsl(value);
  if (hsl) return formatHsl({ ...hsl, alpha });
  return formatColor({ ...rgb, alpha }, format);
}

type Channel = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  set: (n: number) => string;
};

function Channels({
  value,
  format,
  rgb,
  onChange,
}: {
  value: string;
  format: ColorFormat;
  rgb: Rgb;
  onChange: (v: string) => void;
}) {
  const theme = useTheme();
  let channels: Channel[];

  if (format === 'oklch') {
    const o = parseOklch(value) ?? rgbToOklch(rgb);
    channels = [
      { label: 'L', min: 0, max: 1, step: 0.001, value: o.l, set: (l) => formatOklch({ ...o, l }) },
      {
        label: 'C',
        min: 0,
        max: 0.4,
        step: 0.001,
        value: o.c,
        set: (c) => formatOklch({ ...o, c }),
      },
      { label: 'H', min: 0, max: 360, step: 0.5, value: o.h, set: (h) => formatOklch({ ...o, h }) },
    ];
  } else if (format === 'hsl') {
    const h = parseHsl(value) ?? rgbToHsl(rgb);
    channels = [
      {
        label: 'H',
        min: 0,
        max: 360,
        step: 0.5,
        value: h.h,
        set: (n) => formatHsl({ ...h, h: n }),
      },
      {
        label: 'S',
        min: 0,
        max: 100,
        step: 0.1,
        value: h.s,
        set: (n) => formatHsl({ ...h, s: n }),
      },
      {
        label: 'L',
        min: 0,
        max: 100,
        step: 0.1,
        value: h.l,
        set: (n) => formatHsl({ ...h, l: n }),
      },
    ];
  } else {
    const c = clampRgb(parseRgb(value) ?? rgb);
    const out = (next: Rgb) => (format === 'hex' ? rgbToHex(next) : formatRgb(next));
    channels = (['r', 'g', 'b'] as const).map((k) => ({
      label: k.toUpperCase(),
      min: 0,
      max: 255,
      step: 1,
      value: Math.round(c[k] * 255),
      set: (n: number) => out({ ...c, [k]: n / 255 }),
    }));
  }

  channels.push({
    label: 'A',
    min: 0,
    max: 100,
    step: 1,
    value: Math.round(rgb.alpha * 1000) / 10,
    set: (n) => withAlpha(value, format, rgb, n / 100),
  });

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {channels.map((ch) => (
        <label key={ch.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, color: theme.textMutedColor }}>{ch.label}</span>
          <input
            type="range"
            min={ch.min}
            max={ch.max}
            step={ch.step}
            value={ch.value}
            onChange={(e) => onChange(ch.set(parseFloat(e.target.value)))}
            style={{ flex: 1, minWidth: 0 }}
          />
          <TextInput
            width={52}
            value={String(Number(ch.value.toFixed(3)))}
            onCommit={(text) => {
              const n = parseFloat(text);
              if (Number.isFinite(n)) onChange(ch.set(Math.min(ch.max, Math.max(ch.min, n))));
            }}
          />
        </label>
      ))}
    </div>
  );
}

/** Small text input that commits on Enter / blur. */
function TextInput({
  value,
  onCommit,
  width,
}: {
  value: string;
  onCommit: (v: string) => void;
  width?: number;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft.trim() !== value && onCommit(draft.trim());
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      style={{
        width,
        flex: width ? undefined : 1,
        minWidth: 0,
        boxSizing: 'border-box',
        padding: '3px 5px',
        border: `1px solid ${theme.appBorderColor}`,
        borderRadius: 4,
        background: theme.input.background,
        color: theme.input.color,
        fontFamily: theme.typography.fonts.mono,
        fontSize: 11,
        textAlign: width ? 'right' : 'left',
      }}
    />
  );
}

/** Pointer-drag helper: calls `onMove` with the pointer position relative to the element (0..1). */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      move(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
    },
  };
}

const handle: React.CSSProperties = {
  position: 'absolute',
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: '2px solid #fff',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.4)',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

function SaturationField({
  hsv,
  onChange,
  border,
}: {
  hsv: Hsv;
  onChange: (hsv: Hsv) => void;
  border: string;
}) {
  const drag = useDrag((x, y) => onChange({ h: hsv.h, s: x, v: 1 - y }));
  const step = (ds: number, dv: number) =>
    onChange({
      h: hsv.h,
      s: Math.min(1, Math.max(0, hsv.s + ds)),
      v: Math.min(1, Math.max(0, hsv.v + dv)),
    });
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      onKeyDown={(e) => {
        const d = e.shiftKey ? 0.1 : 0.01;
        const keys: Record<string, [number, number]> = {
          ArrowLeft: [-d, 0],
          ArrowRight: [d, 0],
          ArrowUp: [0, d],
          ArrowDown: [0, -d],
        };
        if (keys[e.key]) {
          e.preventDefault();
          step(...keys[e.key]);
        }
      }}
      style={{
        position: 'relative',
        height: 140,
        borderRadius: 4,
        border,
        cursor: 'crosshair',
        touchAction: 'none',
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }))}`,
      }}
    >
      <span
        style={{
          ...handle,
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          background: rgbToHex(hsvToRgb(hsv)),
        }}
      />
    </div>
  );
}

function Bar({
  label,
  value,
  onChange,
  background,
  border,
}: {
  label: string;
  value: number;
  onChange: (t: number) => void;
  background: string;
  border: string;
}) {
  const drag = useDrag((x) => onChange(x));
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onKeyDown={(e) => {
        const d =
          (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1);
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          onChange(Math.min(1, Math.max(0, value + d)));
        }
      }}
      style={{
        position: 'relative',
        height: 12,
        borderRadius: 6,
        border,
        cursor: 'pointer',
        touchAction: 'none',
        background,
      }}
    >
      <span style={{ ...handle, left: `${value * 100}%`, top: '50%', background: 'transparent' }} />
    </div>
  );
}
