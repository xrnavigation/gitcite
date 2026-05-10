# GitCite

Single-file, client-side academic reference manager that saves directly to a
GitHub repository. WCAG 2.2 Level AAA across the entire app. No client-side
build step, no client-side dependencies — open the deployed HTML file in a
browser and it works.

## Capabilities

- Parse, edit, and export BibTeX libraries with full round-trip fidelity
  through Zotero and JabRef, including custom user-defined fields.
- Look up metadata by identifier — DOI via CrossRef, ISBN via Open Library +
  Google Books, archival material via Internet Archive.
- Search scholarly databases by keyword or author — Semantic Scholar
  (default), OpenAlex, and CrossRef.
- Save changes back to a GitHub repository through OAuth, a Personal Access
  Token, or a localhost git bridge.
- Auto-pull on startup when the source-of-truth file in the repository has
  changed since the last session.
- Classify entries with suggested JEL codes and Library of Congress
  subclass chips.
- Render Chicago Notes-Bibliography citations.
- Analyse the library through a six-panel insights dashboard.

## Minimal deploy

1. Fork or clone this repository.
2. Edit `GITCITE_CONFIG.github.repo`, `branch`, and `path` in
   `src/config.js` (or directly in `dist/index.html`) to point at where the
   library file should live.
3. Place an initial `.bib` file at `GITCITE_CONFIG.autoLoad`.
4. Run `npm run build` (or `node tools/concat.mjs` directly) to produce
   `dist/index.html` (the single-file shipped artifact). The built file is
   committed to `main`, so a fresh clone already has it ready to open.
5. Enable GitHub Pages on the fork — Settings → Pages → Source: **GitHub
   Actions**. The included workflow (`.github/workflows/pages.yml`) builds
   and deploys `dist/` on every push to `main`. Alternatively, choose
   Source: branch `main` → folder `/dist`.
6. Visit the deployed URL — or open `dist/index.html` directly from the
   filesystem (most features work on `file://`; the only limitation is that
   a relative-path `autoLoad` is blocked by browser CORS).

At this point GitCite works as an offline editor with file download. The
next two documents are needed only if the deployer wants Save-to-GitHub.

## Optional setup

- `oauth-relay/RELAY_SETUP.md` — sets up the OAuth path (one Cloudflare
  Worker per deployment).
- `git-bridge/BRIDGE_SETUP.md` — runs the localhost git bridge for users
  who already have the repository cloned locally.

## Configuration reference

Every per-deployment option lives in the `GITCITE_CONFIG` constant. See
`src/config.js` for the documented shape. Keys you will likely change:

| Key | Purpose |
|---|---|
| `autoLoad` | Same-origin path to the initial `.bib` file. `null` disables. |
| `github.repo` | `owner/repo` to save into. |
| `github.branch` | Branch name. |
| `github.path` | Path of the `.bib` file inside the repo. |
| `github.oauthRelay` | Worker URL for the OAuth path. `null` disables. |
| `github.oauthClientId` | Public OAuth App Client ID. |
| `github.localGitBridge` | Bridge URL (`http://localhost:7117`). `null` disables. |
| `github.prFallback` | When `true`, branch protection / read-only access trigger PR fallback. |
| `autoPullPrompt` | When `true`, prompt to pull on startup if the repo is newer. |
| `scholarly.defaultProvider` | Default keyword-search provider. |
| `scholarly.contactEmail` | OpenAlex polite-pool + Semantic Scholar courtesy. |
| `glossary` | When `true`, glossary tooltips on PAT, OAuth, SHA, JEL, LOC, DOI etc. |

## Accessibility

GitCite targets WCAG 2.2 Level AAA. Token-contrast pairs are verified at
≥ 7:1 (body) / ≥ 3:1 (non-text) in both light and dark themes via
`tools/contrast-audit.mjs` on every CI run. Hit-area, axe-core,
keyboard-trap, and screen-reader-tree audits run against `dist/index.html`
in Playwright. The deviations register lives at the top of `src/index.html`.

## Testing

```sh
npm install
npm run build           # node tools/concat.mjs → dist/index.html
npm run test:unit       # vitest jsdom + pure-function unit tests
npm run test:component  # vitest + jsdom component tests
npm run test:e2e        # Playwright + axe-core
```

## License

See `LICENSE`.
