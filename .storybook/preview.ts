import type { Preview } from '@storybook/html-vite';
import '../stories/demo.css';

// Minimal light/dark toggle for the demo (in real projects @storybook/addon-themes works well).
const preview: Preview = {
  globalTypes: {
    scheme: {
      description: 'Colour scheme',
      toolbar: { title: 'Scheme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: 'light' },
  decorators: [
    (story, { globals }) => {
      document.documentElement.classList.toggle('dark', globals.scheme === 'dark');
      return story();
    },
  ],
};

export default preview;
