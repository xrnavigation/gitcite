# GitCite

Single-file, client-side academic reference manager that saves directly to a
GitHub repository. WCAG 2.2 Level AAA across the entire app. No client-side
build step, no client-side dependencies — open one HTML file in a browser
and it works.

**Live:** https://xrnavigation.github.io/gitcite/

## Capabilities

- Parse, edit, and export BibTeX libraries with full round-trip fidelity
  through Zotero and JabRef, including custom user-defined fields.
- Look up metadata by identifier — DOI via CrossRef, ISBN via Open Library +
  Google Books, archival material via Internet Archive.
- Search scholarly databases by keyword, title, author, or DOI — OpenAlex
  (default), Semantic Scholar, and CrossRef. Per-provider rate-limit handling
  with automatic fallback prompts.
- Save changes back to a GitHub repository through OAuth, a Personal Access
  Token, or a localhost git bridge.
- Auto-pull on startup when the source-of-truth file in the repository has
  changed since the last session.
- Classify entries with suggested JEL codes and Library of Congress
  subclass chips.
- Render Chicago Notes-Bibliography and APA 7 citations side-by-side; copy
  the citation key with one click.
- Analyse the library through a six-panel insights dashboard.
- Reorderable library columns and Default-add fields, configurable from a
  single Settings dialog.

## Three ways to use GitCite

### 1. Open the hosted version

The simplest path: visit https://xrnavigation.github.io/gitcite/.

This URL serves the latest `dist/index.html` from `main`. Every push to
`main` redeploys it via `.github/workflows/pages.yml` (Source: GitHub
Actions; there is no `gh-pages` branch — the workflow uploads `dist/`
straight to Pages). Your library, prefs, and tokens stay in your browser's
`localStorage` / `IndexedDB`; the page is HTTPS-served and works offline
after the first visit thanks to browser caching.

### 2. Download once, run offline

For full offline use, grab a single self-contained HTML file:

- **From the repo:** download
  https://raw.githubusercontent.com/xrnavigation/gitcite/main/dist/index.html
  and save as `gitcite.html` (or any name). Double-click to open. No
  installation, no network required after download.
- **From a release:** if a tagged release exists at
  https://github.com/xrnavigation/gitcite/releases, download the
  `gitcite.html` asset attached to it. Releases are pinned to a known
  `dist/index.html` build.

`file://` features that work: local library, prefs, dirty pill, search
against CrossRef / OpenAlex / Semantic Scholar, GitHub PAT and OAuth
device-flow save, encrypted token storage. The one limit: a relative-path
`autoLoad` (loading a `.bib` file from the same folder) is blocked by
browser CORS — host the `.bib` at an `https://` URL or paste its contents
into `GITCITE_CONFIG.autoLoad` as a string.

### 3. Fork and host your own

Use this when you want a per-organisation deployment that points at your
own library file:

1. Fork or clone this repo.
2. Edit `GITCITE_CONFIG.github.repo`, `branch`, and `path` in
   `src/config.js` to point at the `.bib` file in your repo.
3. Optionally set `GITCITE_CONFIG.autoLoad` to the `https://` URL where
   your library lives so it loads on first visit.
4. Run `npm run build` (or `node tools/concat.mjs` directly) to regenerate
   `dist/index.html`. The built file is committed to `main`, so a fresh
   clone already has it ready to open — you only rebuild after editing
   sources.
5. Push to `main`. The included `.github/workflows/pages.yml` workflow
   rebuilds `dist/index.html` and deploys it to GitHub Pages.
6. One-time setup: in your fork's **Settings → Pages**, set **Source =
   GitHub Actions**. After the first push, your site is live at
   `https://<your-user>.github.io/<your-repo>/`.

If you'd rather not use GitHub Actions, choose **Source = Deploy from a
branch**, branch `main`, folder `/` — and rename `dist/` to `docs/` (or
serve from root) since GitHub's branch-deploy only allows `/` or `/docs`
as the publish folder.

## Providing updates

GitCite has no client-side build at runtime. Every change ships as a new
`dist/index.html`. The flow:

1. Edit files under `src/`.
2. Run `npm run build` to regenerate `dist/index.html` (byte-deterministic
   — same input always produces identical output).
3. Run the test suite: `npm run test:unit && npm run test:component`. The
   single-file ship target stays under 400 KB.
4. Commit `dist/index.html` along with the source change so a fresh clone
   has the matching binary.
5. Push to `main`. The Pages workflow redeploys within ~30 seconds.

For tagged releases, see `gh release create vX.Y.Z dist/index.html#gitcite.html`
which attaches the built file as a downloadable asset for users who prefer
versioned offline copies.

## Optional infrastructure

GitCite works fully without any of these. They unlock specific features:

- `oauth-relay/RELAY_SETUP.md` — Cloudflare Worker that proxies the GitHub
  OAuth device-flow handshake so users can sign in with a GitHub account
  rather than a PAT. One worker per deployment.
- `git-bridge/BRIDGE_SETUP.md` — local Python/PowerShell bridge that lets
  GitCite save into a repo you already have cloned, bypassing the GitHub
  API entirely. Useful for offline LANs and large monorepos.

## Configuration reference

Every per-deployment option lives in the `GITCITE_CONFIG` constant. See
`src/config.js` for the documented shape. Keys you will likely change:

| Key | Purpose |
|---|---|
| `autoLoad` | URL to the initial `.bib` file. Same-origin path or `https://` URL. `null` disables. |
| `github.repo` | `owner/repo` to save into. |
| `github.branch` | Branch name. |
| `github.path` | Path of the `.bib` file inside the repo. |
| `github.oauthRelay` | Worker URL for the OAuth path. `null` disables OAuth, leaving PAT-only. |
| `github.oauthClientId` | Public OAuth App Client ID. |
| `github.localGitBridge` | Bridge URL (`http://localhost:7117`). `null` disables. |
| `github.prFallback` | When `true`, branch protection / read-only access trigger PR fallback. |
| `autoPullPrompt` | When `true`, prompt to pull on startup if the repo is newer. |
| `scholarly.defaultProvider` | Default keyword-search provider — `openalex` (recommended), `semanticscholar`, or `crossref`. |
| `scholarly.contactEmail` | OpenAlex polite-pool + Semantic Scholar courtesy. |
| `scholarly.semanticScholarApiKey` | Optional API key for higher Semantic Scholar rate limits. |
| `glossary` | When `true`, glossary tooltips on PAT, OAuth, SHA, JEL, LOC, DOI etc. |

## Accessibility

GitCite targets WCAG 2.2 Level AAA. Token-contrast pairs are verified at
≥ 7:1 (body) / ≥ 3:1 (non-text) in both light and dark themes via
`tools/contrast-audit.mjs` on every CI run. Hit-area, axe-core,
keyboard-trap, and screen-reader-tree audits run against `dist/index.html`
in Playwright. Every dialog has a close button (`× Close dialog`); the skip
link lands on the page H1; tables are native `<table role="grid">` so NVDA
table-navigation works. The deviations register lives at the top of
`src/index.html`.

## Development

```sh
npm install
npm run build           # node tools/concat.mjs → dist/index.html
npm run test:unit       # vitest pure-function unit tests
npm run test:component  # vitest + jsdom component tests (414 currently)
npm run test:e2e        # Playwright + axe-core against the built file
npm run audit:contrast  # token-pair contrast matrix
npm run start           # build + serve dist/ on http://localhost:8080
```

The build is Node-only (`tools/concat.mjs`) — no `bash` or `python3`
required. Output is byte-deterministic; running the build twice produces
identical bytes.

## License

See `LICENSE`.
