# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The colour swatch now opens a popover picker: a saturation/brightness field, hue and alpha
  bars, and OKLCH / RGB / HSL channel sliders with number inputs and a hex field. Switching the
  format tab converts the variable to that format. This replaces the **LCH** button.

## [0.1.0] - 2026-11-15

### Added

- "Theme" panel that reads the CSS variables in your `:root` and `.dark` blocks.
- Separate Light and Dark editing, with a colour picker and OKLCH lightness, chroma, hue and alpha sliders.
- Slider for `--radius`; plain text fields for every other variable (fonts, shadows, …).
- Import of `:root` / `.dark` CSS, e.g. a shadcn studio export.
- Export of the full theme as CSS, ready to paste into `app.css`.
- Per-variable and global reset; changes are kept in localStorage.
