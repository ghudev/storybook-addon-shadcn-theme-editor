import { definePreviewAddon } from 'storybook/internal/csf';
import './preview';

export {
  ADDON_ID,
  EVENTS,
  PANEL_ID,
  STORAGE_KEY,
  formatOklch,
  formatThemeCss,
  hexToOklch,
  oklchToHex,
  parseOklch,
  parseThemeCss,
} from './shared';
export type { Mode, Oklch, ThemeVars, VarMap } from './shared';

/** For CSF Next (`definePreview({ addons: [shadcnThemeEditor()] })`). */
export default () => definePreviewAddon({});
