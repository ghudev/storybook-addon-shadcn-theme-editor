import { defineConfig, type Options } from 'tsup';

// Storybook provides these at runtime; never bundle them.
const shared: Options = {
  format: ['esm'],
  platform: 'browser',
  target: 'es2022',
  treeshake: true,
  external: [/^storybook(\/.*)?$/, 'react', 'react-dom'],
  // Classic JSX (React.createElement): Storybook's manager exposes `react`, not `react/jsx-runtime`.
  esbuildOptions(options) {
    options.jsx = 'transform';
  },
};

export default defineConfig([
  // Preview side (runs in the story iframe) + public API.
  {
    ...shared,
    entry: { index: 'src/index.ts', preview: 'src/preview.ts' },
    dts: true,
    splitting: true,
  },
  // Manager side (the panel), as one self-contained file.
  {
    ...shared,
    entry: { manager: 'src/manager.tsx' },
    splitting: false,
  },
]);
