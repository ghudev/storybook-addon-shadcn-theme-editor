import React, { useEffect, useMemo, useState } from 'react';
import { useChannel } from 'storybook/manager-api';
import { useTheme } from 'storybook/theming';
import {
  EVENTS,
  emptyTheme,
  formatThemeCss,
  isColorValue,
  loadOverrides,
  parseThemeCss,
  saveOverrides,
  type Mode,
  type ThemeVars,
} from './shared';
import { ColorSwatchPicker } from './ColorPicker';

export function ThemeEditorPanel() {
  const theme = useTheme();
  const [baseline, setBaseline] = useState<ThemeVars>(emptyTheme);
  const [overrides, setOverrides] = useState<ThemeVars>(loadOverrides);
  const [mode, setMode] = useState<Mode>('light');
  const [filter, setFilter] = useState('');
  const [drawer, setDrawer] = useState<'import' | 'export' | null>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  const emit = useChannel({ [EVENTS.BASELINE]: (b: ThemeVars) => setBaseline(b) });
  useEffect(() => {
    emit(EVENTS.REQUEST_BASELINE);
  }, []);

  const commit = (next: ThemeVars) => {
    setOverrides(next);
    saveOverrides(next);
    emit(EVENTS.APPLY, next);
  };

  const withValue = (draft: ThemeVars, m: Mode, key: string, value: string) => {
    if (value === baseline[m][key]) delete draft[m][key];
    else draft[m][key] = value;
  };

  const setVar = (key: string, value: string) => {
    const next = { light: { ...overrides.light }, dark: { ...overrides.dark } };
    withValue(next, mode, key, value);
    commit(next);
  };

  const resetVar = (key: string) => {
    const next = { light: { ...overrides.light }, dark: { ...overrides.dark } };
    delete next[mode][key];
    commit(next);
  };

  const effective = (m: Mode) => ({ ...baseline[m], ...overrides[m] });
  const vars = effective(mode);
  const changedCount = Object.keys(overrides.light).length + Object.keys(overrides.dark).length;

  const { colors, others } = useMemo(() => {
    const entries = Object.entries(vars).filter(([k]) =>
      k.toLowerCase().includes(filter.trim().toLowerCase())
    );
    return {
      colors: entries.filter(([, v]) => isColorValue(v)),
      others: entries.filter(([, v]) => !isColorValue(v)),
    };
  }, [vars, filter]);

  const doImport = () => {
    const parsed = parseThemeCss(importText);
    const count = Object.keys(parsed.light).length + Object.keys(parsed.dark).length;
    if (!count) {
      setMessage('No :root or .dark variables found in the pasted CSS.');
      return;
    }
    const next = { light: { ...overrides.light }, dark: { ...overrides.dark } };
    (['light', 'dark'] as const).forEach((m) =>
      Object.entries(parsed[m]).forEach(([k, v]) => withValue(next, m, k, v))
    );
    commit(next);
    setImportText('');
    setDrawer(null);
    setMessage(`Imported ${count} variables.`);
  };

  const exportCss = formatThemeCss({ light: effective('light'), dark: effective('dark') });
  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCss);
      setMessage('Theme CSS copied to clipboard.');
    } catch {
      setMessage('Copy failed – select the text below and copy it manually.');
    }
  };

  const border = `1px solid ${theme.appBorderColor}`;
  const muted = theme.textMutedColor;
  const button = (active = false): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 4,
    border,
    background: active ? theme.color.secondary : 'transparent',
    color: active ? theme.color.lightest : theme.color.defaultText,
    cursor: 'pointer',
    fontSize: 12,
  });
  const input: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '4px 6px',
    border,
    borderRadius: 4,
    background: theme.input.background,
    color: theme.input.color,
    fontFamily: theme.typography.fonts.mono,
    fontSize: 12,
  };

  const loaded = Object.keys(baseline.light).length + Object.keys(baseline.dark).length > 0;

  return (
    <div style={{ padding: 12, fontSize: 12, color: theme.color.defaultText }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={button(mode === 'light')} onClick={() => setMode('light')}>
          Light
        </button>
        <button style={button(mode === 'dark')} onClick={() => setMode('dark')}>
          Dark
        </button>
        <input
          style={{ ...input, maxWidth: 180 }}
          placeholder="Filter variables…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span style={{ flex: 1 }} />
        <button
          style={button(drawer === 'import')}
          onClick={() => setDrawer(drawer === 'import' ? null : 'import')}
        >
          Import CSS
        </button>
        <button
          style={button(drawer === 'export')}
          onClick={() => setDrawer(drawer === 'export' ? null : 'export')}
        >
          Export CSS
        </button>
        <button
          style={button()}
          disabled={!changedCount}
          onClick={() => {
            commit(emptyTheme());
            setMessage('All changes reset.');
          }}
        >
          Reset all{changedCount ? ` (${changedCount})` : ''}
        </button>
      </div>

      {message && (
        <div style={{ marginTop: 8, color: muted }} onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      {drawer === 'import' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: muted, marginBottom: 4 }}>
            Paste a theme (e.g. from shadcn studio). Only the <code>:root</code> and{' '}
            <code>.dark</code> blocks are used.
          </div>
          <textarea
            style={{ ...input, width: '100%', height: 140, boxSizing: 'border-box' }}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={':root {\n  --primary: oklch(0.6 0.2 260);\n}\n.dark {\n  …\n}'}
          />
          <button style={{ ...button(true), marginTop: 6 }} onClick={doImport}>
            Apply
          </button>
        </div>
      )}

      {drawer === 'export' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: muted, marginBottom: 4 }}>
            Replace the <code>:root</code> and <code>.dark</code> blocks in your{' '}
            <code>app.css</code> with this.
          </div>
          <textarea
            readOnly
            style={{ ...input, width: '100%', height: 180, boxSizing: 'border-box' }}
            value={exportCss}
            onFocus={(e) => e.target.select()}
          />
          <button style={{ ...button(true), marginTop: 6 }} onClick={copyExport}>
            Copy to clipboard
          </button>
        </div>
      )}

      {!loaded && (
        <div style={{ marginTop: 16, color: muted }}>
          Waiting for the preview… If nothing shows up, make sure <code>preview.ts</code> imports{' '}
          <code>./theme-editor/preview</code> and your CSS declares variables in <code>:root</code>{' '}
          / <code>.dark</code>.
        </div>
      )}

      {colors.length > 0 && <SectionTitle color={muted}>Colours ({mode})</SectionTitle>}
      {colors.map(([key, value]) => (
        <ColorRow
          key={`${mode}${key}`}
          name={key}
          value={value}
          changed={key in overrides[mode]}
          onChange={(v) => setVar(key, v)}
          onReset={() => resetVar(key)}
          inputStyle={input}
          border={border}
          muted={muted}
        />
      ))}

      {others.length > 0 && <SectionTitle color={muted}>Other ({mode})</SectionTitle>}
      {others.map(([key, value]) => (
        <Row
          key={`${mode}${key}`}
          name={key}
          changed={key in overrides[mode]}
          onReset={() => resetVar(key)}
          muted={muted}
        >
          {key === '--radius' && /^[\d.]+rem$/.test(value) && (
            <input
              type="range"
              min={0}
              max={2}
              step={0.025}
              value={parseFloat(value)}
              onChange={(e) => setVar(key, `${e.target.value}rem`)}
              style={{ width: 120 }}
            />
          )}
          <TextValue value={value} onCommit={(v) => setVar(key, v)} style={input} />
        </Row>
      ))}
    </div>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        margin: '16px 0 6px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color,
      }}
    >
      {children}
    </div>
  );
}

function Row(props: {
  name: string;
  changed: boolean;
  onReset: () => void;
  muted: string;
  children: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      {props.leading}
      <code style={{ width: 210, flexShrink: 0, fontWeight: props.changed ? 700 : 400 }}>
        {props.name}
        {props.changed && ' •'}
      </code>
      {props.children}
      <button
        title="Reset to the value in your CSS"
        onClick={props.onReset}
        style={{
          visibility: props.changed ? 'visible' : 'hidden',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: props.muted,
          fontSize: 14,
        }}
      >
        ↺
      </button>
    </div>
  );
}

/** Text field that keeps local edits until Enter / blur, so half-typed values don't break the preview. */
function TextValue({
  value,
  onCommit,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  style: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft.trim() && draft.trim() !== value && onCommit(draft.trim());
  return (
    <input
      style={style}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

function ColorRow(props: {
  name: string;
  value: string;
  changed: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
  inputStyle: React.CSSProperties;
  border: string;
  muted: string;
}) {
  return (
    <Row
      name={props.name}
      changed={props.changed}
      onReset={props.onReset}
      muted={props.muted}
      leading={
        <ColorSwatchPicker value={props.value} onChange={props.onChange} border={props.border} />
      }
    >
      <TextValue value={props.value} onCommit={props.onChange} style={props.inputStyle} />
    </Row>
  );
}
