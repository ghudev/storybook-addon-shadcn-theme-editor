import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  // Loads the addon from src/ (see local-preset.ts) so changes show up without a build.
  addons: [fileURLToPath(new URL('./local-preset.ts', import.meta.url))],
  framework: { name: '@storybook/html-vite', options: {} },
};

export default config;
