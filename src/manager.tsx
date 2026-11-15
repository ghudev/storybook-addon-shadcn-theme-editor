import React from 'react';
import { addons, types } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';
import { ADDON_ID, PANEL_ID } from './shared';
import { ThemeEditorPanel } from './Panel';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Theme',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <ThemeEditorPanel />
      </AddonPanel>
    ),
  });
});
