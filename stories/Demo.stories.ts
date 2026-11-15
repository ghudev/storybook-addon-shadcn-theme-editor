import type { Meta, StoryObj } from '@storybook/html-vite';

const meta: Meta = {
  title: 'Demo/Card',
  parameters: { layout: 'padded' },
};
export default meta;

export const Card: StoryObj = {
  render: () => `
    <div class="card">
      <h2>Open the “Theme” panel below</h2>
      <p>Change any colour, the radius or the font and watch this card update.</p>
      <div class="row">
        <button class="btn btn-primary">Primary</button>
        <button class="btn btn-secondary">Secondary</button>
        <button class="btn btn-outline">Outline</button>
        <button class="btn btn-destructive">Delete</button>
      </div>
    </div>`,
};
