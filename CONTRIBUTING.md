# Contributing

Thanks for helping out! Bug reports, ideas and pull requests are all welcome.

## Setup

```sh
npm install
npm run dev        # demo Storybook on http://localhost:6006, loads the addon from src/
```

The demo uses `@storybook/html-vite` and a plain CSS file (`stories/demo.css`), so it
works without any framework. The addon itself is framework-agnostic.

## Project layout

| Path                         | What it is                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `src/manager.tsx`            | Registers the panel in the Storybook UI                          |
| `src/Panel.tsx`              | The panel (React, runs in Storybook's manager)                   |
| `src/preview.ts`             | Runs in the story iframe: reads your theme and applies overrides |
| `src/shared.ts`              | Event names, OKLCH ↔ sRGB maths, CSS parsing                     |
| `src/index.ts`               | Public API and the CSF Next `definePreviewAddon` export          |
| `.storybook/local-preset.ts` | Points the demo Storybook at `src/`                              |

## Before opening a pull request

```sh
npm run typecheck
npm test
npm run build
```

Please add a line to the `Unreleased` section of `CHANGELOG.md`.

## Releasing (maintainers)

1. Update the version in `package.json` and move the `Unreleased` changelog entries under it.
2. Commit, then tag: `git tag v0.2.0 && git push --follow-tags`.
3. Create a GitHub release from the tag. The **Release** workflow publishes to npm.
