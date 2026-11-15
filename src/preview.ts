/// <reference types="vite/client" />
// Runs inside the preview iframe: reads the theme from your CSS and applies overrides live.
// Importing this module has side effects only; it is safe to import more than once.
import { addons } from 'storybook/preview-api';
import { EVENTS, emptyTheme, loadOverrides, type ThemeVars, type VarMap } from './shared';

const STYLE_ID = 'shadcn-theme-editor-overrides';

function styleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
  }
  // Always keep it last in <head> so it wins over Vite-injected styles.
  if (el !== document.head.lastElementChild) document.head.appendChild(el);
  return el;
}

/** Collects the custom properties declared in `:root { }` and `.dark { }` across all stylesheets. */
function collectBaseline(): ThemeVars {
  const theme = emptyTheme();
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const selectors = rule.selectorText.split(',').map((s) => s.trim());
        const target = selectors.includes(':root')
          ? theme.light
          : selectors.includes('.dark')
            ? theme.dark
            : null;
        // Skip Tailwind's own `:root, :host` theme block – it's not part of the shadcn theme.
        if (target && !selectors.includes(':host')) {
          for (const prop of Array.from(rule.style)) {
            if (prop.startsWith('--')) target[prop] = rule.style.getPropertyValue(prop).trim();
          }
        }
      } else if ('cssRules' in rule) {
        walk((rule as CSSGroupingRule).cssRules); // @layer, @media, …
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode instanceof Element && sheet.ownerNode.id === STYLE_ID) continue;
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin sheet */
    }
  }
  return theme;
}

const decl = (vars: VarMap) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');

function apply(overrides: ThemeVars) {
  const baseline = collectBaseline();
  // A light override is stronger than your original `.dark` rule, so for every overridden
  // variable we also write the dark value explicitly to keep dark mode correct.
  const dark: VarMap = {};
  for (const key of new Set([...Object.keys(overrides.light), ...Object.keys(overrides.dark)])) {
    const value = overrides.dark[key] ?? baseline.dark[key];
    if (value !== undefined) dark[key] = value;
  }
  const hasAny = Object.keys(overrides.light).length || Object.keys(dark).length;
  styleEl().textContent = hasAny
    ? `:root:root { ${decl(overrides.light)} }\n.dark.dark { ${decl(dark)} }`
    : '';
}

function init() {
  const w = window as unknown as Record<string, unknown>;
  if (w.__SHADCN_THEME_EDITOR__) return;
  w.__SHADCN_THEME_EDITOR__ = true;

  const channel = addons.getChannel();
  let current: ThemeVars = loadOverrides();

  const sendBaseline = () => channel.emit(EVENTS.BASELINE, collectBaseline());

  channel.on(EVENTS.REQUEST_BASELINE, sendBaseline);
  channel.on(EVENTS.APPLY, (overrides: ThemeVars) => {
    current = overrides;
    apply(current);
  });

  // Apply saved overrides straight away (no flash), then again once all CSS has loaded.
  apply(current);
  const onReady = () => {
    apply(current);
    sendBaseline();
  };
  if (document.readyState === 'complete') setTimeout(onReady);
  else window.addEventListener('load', onReady);

  // Re-sync when your CSS changes through HMR.
  import.meta.hot?.on('vite:afterUpdate', () => setTimeout(onReady, 50));
}

init();
