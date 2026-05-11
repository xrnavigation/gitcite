# Style Architecture

CSS is split by responsibility and concatenated into `dist/index.html` by
`tools/concat.mjs`.

- `tokens.css` keeps global design tokens and theme values. Keep this file
  stable because contrast tooling reads these variables.
- `foundation/*.module.css` contains browser reset rules, typography, form
  controls, buttons, tables, and accessibility primitives.
- `layout/*.module.css` contains app shell, dialog layout, and responsive rules.
- `components/*.module.css` contains reusable UI components that appear in
  multiple views.
- `views/*.module.css` contains page- or modal-specific rules.
- `hit-area.css` keeps accessibility hit-area backstops that should always load
  last.

When adding styles, prefer the narrowest matching module. Add a new view or
component module instead of growing a generic file.
