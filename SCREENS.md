# GitCite — Screen-by-Screen Reference

This document describes every screen and surface in the GitCite app, what
must appear on each, the keyboard / focus / announcement behaviour, and
how the screens connect. It is grounded in the implementation in
`src/views/`, `src/github/`, and the AAA conformance ledger at the top
of `src/index.html`.

For the underlying spec, see `DESIGN_SPEC.md`. For the implementation
plan, see `C:\Users\brandon\.claude\plans\using-the-accessibility-agent-groovy-lynx.md`.

---

## Recent feedback resolved

| # | Issue | Resolution |
|---|---|---|
| 1 | Empty-library screen had no way to add citations. | New **Empty library** state with a toolbar exposing **Add citation**, **Quick Add by DOI**, and **Import library** (`src/app.js → showEmptyLibrary`). |
| 2 | After "Start with empty library", no way back to the landing screen. | The same toolbar's **Import library** button re-mounts the landing screen via `showLanding()`, restoring all four import affordances. |
| 3 | Only `.bib` was accepted on import; `.bibtex` was rejected by the file picker. | `src/views/landing.js` now accepts `.bib,.bibtex,text/plain,text/x-bibtex,application/x-bibtex`, the button reads **Import .bib / .bibtex**, and the drop-zone aria-label and visible text mention `.bibtex`. The parser already accepts the same syntax — only the file-picker filter was the gate. |
| 4 | No `npm start` to launch the app locally. | Added `"start": "npm run build && npx --yes serve dist -l 8080 --no-clipboard"` and `"serve": "npx --yes serve dist -l 8080 --no-clipboard"` in `package.json`. See **How to run locally** below. |

### How to run locally

After `npm install`, three options:

```sh
# 1. Build single-file artifact and serve on http://localhost:8080
npm start

# 2. If dist/index.html already exists, just serve it
npm run serve

# 3. Any static server works — the artifact is a single static HTML file.
#    Examples:
python3 -m http.server 8080 --directory dist
npx --yes http-server dist -p 8080 -c-1
```

Once running, open `http://localhost:8080/`. The landing screen renders
when no auto-load URL is configured (which is the default for local
testing).

#### Other ways to test

| Goal | Command |
|---|---|
| Unit + component tests in watch mode | `npx vitest tests/unit tests/component` |
| Unit + component tests once | `npm run test:unit && npx vitest run tests/component` |
| Full E2E + axe-core suite (Playwright) | `npm run test:e2e` (requires `npx playwright install` once) |
| Only accessibility-tagged E2E checks | `npm run test:a11y` |
| Token-contrast matrix audit | `npm run audit:contrast` |
| Everything CI runs | `npm run test:all` |
| Open dev tools and poke at it | `npm start`, then DevTools → Console: `window.GitCiteApp` exposes `model`, `import.bibText(...)`, `import.csvText(...)`. |
| Localhost git bridge (optional) | `python3 git-bridge/git_bridge.py` from inside a git working tree, then open the app at any localhost URL — see `git-bridge/BRIDGE_SETUP.md`. |
| OAuth relay (optional) | Deploy `oauth-relay/worker.js` to Cloudflare Workers — see `oauth-relay/RELAY_SETUP.md`. Without it, OAuth is unavailable; PAT and localhost paths still work. |

---

## App-shell elements (always present)

These live in `src/index.html` and are mounted by `src/app.js`. They
appear on every screen.

### Header

- `<h1>GitCite</h1>` — the only H1 on every view (WCAG 2.4.6, 2.4.10).
- **Unsaved-changes pill** (`data-pill-host`, `src/views/pill.js`) — a
  real `<button aria-label="N unsaved changes — review">` that expands a
  panel listing each pending entry with per-row Discard. Hidden when N
  is 0. Count change announces politely at most once per 500 ms.
- **Theme toggle** (`data-theme-toggle-slot`, `src/a11y/theme.js`) —
  three-state radio group: Light, Dark, System. Persists to
  `localStorage` and is applied before first paint to avoid flash.

### Skip link (above the header)

`<a href="#main" class="skip-link">Skip to main content</a>` — the first
focusable element on every page (WCAG 2.4.1).

### Main region — `<main id="main" tabindex="-1">`

Hosts the active screen (landing, library list, edit form, empty-state,
or About).

### Sidebar — `<nav aria-label="Filters">`

Hidden until a library is loaded. Shows filter facets when present.

### Detail aside — `<aside aria-label="Detail">`

Hidden until a library entry is selected. Shows detail / edit panes.

### Footer

Reserved for rate-limit status (`X-RateLimit-Remaining`) and provider
status messages from keyword search.

### Live regions (singletons mounted at boot)

- `aria-live="polite"` shared region for filter counts, search results,
  toast announcements, and provider status.
- `aria-live="assertive"` shared region for rate-limit and other urgent
  messages.
- `announce.once(text)` mutes the polite region after one read — used
  by the OAuth user-code modal and the 1-minute-remaining warning.

### Toast region (`src/a11y/toast.js`)

Ephemeral status messages duplicated to the persistent activity panel
when they contain action links, so links survive toast fade (WCAG 2.2.1).

### Activity panel

Persistent log of toasts that contain action links — the PR-fallback
URL, the commit short-SHA link, and so on.

---

## 1. Landing screen

**File:** `src/views/landing.js`. **Heading:** `<h2>Load a library</h2>`.
**Mounts in:** `<main>`.

Rendered when no auto-load URL is configured or auto-load fails (DESIGN_SPEC §6).

| Element | Purpose | Notes |
|---|---|---|
| **Import .bib / .bibtex** button | Opens a file picker filtered to `.bib`, `.bibtex`, `text/plain`, `text/x-bibtex`, `application/x-bibtex`. | Real `<button>`. ≥ 44 × 44 CSS px. Precedes the drop zone in tab order (WCAG 2.5.7 keyboard substitute). |
| **Import .csv** button | Opens a file picker for CSV. | Same hit-area discipline. |
| **Start with empty library** button | Skips file load; routes to the **Empty library** screen (#2). | |
| **Drop zone** | Accepts `.bib`, `.bibtex`, `.csv` via drag-and-drop. | `tabindex="-1"` (the buttons are the keyboard substitute). aria-label reads "Drop a .bib, .bibtex, or .csv file here, or use the Import buttons above." |

When auto-load succeeds, the user goes straight to the **Library list
view** (#5) and skips landing.

---

## 2. Empty library screen *(new after feedback)*

**File:** `src/app.js → showEmptyLibrary`. **Heading:** `<h2 id="empty-library-heading">Empty library</h2>`. **Mounts in:** `<main>`.

Rendered when the user clicks **Start with empty library** on landing,
or when an import results in zero usable entries.

| Element | Purpose | Notes |
|---|---|---|
| Section labelled by the heading | Container. | `<section aria-labelledby="empty-library-heading">`. |
| Plain-language hint | "No entries yet. Add a citation manually, or load an existing library." | Reading-level ≤ ninth grade per AAA target. |
| **Add citation** button | Opens the full Edit form for a brand-new entry (#7). | Receives initial focus. |
| **Quick Add by DOI** button | Opens the Quick Add modal (#11). | |
| **Import library** button | Re-mounts the landing screen (#1) so the user can change their mind. | Resolves the "no way back" issue. |

A polite live-region announcement fires on mount: "Empty library. Add a
citation or import a library."

---

## 3. CSV mapping dialog

**File:** `src/views/mapping-dialog.js`. **Trigger:** import of a `.csv`
file. **Modal:** native `<dialog aria-modal="true">`.

| Element | Purpose | Notes |
|---|---|---|
| Dialog heading | `<h2>` describing the CSV mapping task. | |
| One **fieldset/legend per column** | Groups the source column header with its target-field `<select>` and the sample value. | `<select>` is labelled child, sample value associated via `aria-describedby` (WCAG 1.3.1, 3.3.3). |
| Auto-mapping | Common Zotero/JabRef column aliases (Title, Authors, Publication Year, etc.) are pre-selected in the `<select>`. | |
| **Import** / **Cancel** | Submit and close. On validation failure, an error summary appears with focus moved to it; each error link jumps to the offending row (WCAG 3.3.1). | |

After import, a toast and an activity-panel entry both contain the same
"N imported / M skipped" count.

---

## 4. Auto-load failure / network error landing

**File:** still `src/views/landing.js` — same screen. The
`autoLoad: '<url>'` config key fetches a `.bib` at startup; on failure
the landing screen is shown unchanged. No special "error" UI is needed
because the four affordances are already present.

---

## 5. Library list view

**File:** `src/app.js → renderLibraryView`. **Layout:** sidebar (filters)
+ search bar (top of main) + virtual list (rest of main) + detail aside.

### 5.1 Search bar

`src/views/search.js`. `<input type="search">` with visible label,
focused by `Ctrl/Cmd+F`. 80 ms debounce. Result-count change announces
through the shared polite region (one region across all filters and
search — never per-feature).

### 5.2 Virtual list (HOTSPOT H1)

`src/views/list.js`. `role="list"` with `aria-rowcount` set to the
**full filtered count, not the rendered window**. Each row has
`aria-posinset` / `aria-setsize` against the same full count. Row
accessible name combines title + author(s) + year + entry-type label
(text, never colour-only). Arrow keys move focus across the entire
list; the viewport scrolls when focus reaches the edge.

### 5.3 Sidebar filters

`src/views/filters.js`. Mounted in the `<nav aria-label="Filters">`
landmark. Facets include type, year range, datasource, JEL, LCC, and
`@archival date_range` overlap. Each facet change announces via the
shared polite region. **Clear filters** moves focus to the search input
on completion.

### 5.4 Detail panel

`src/views/detail.js`. Mounted in `<aside aria-label="Detail">` (visible
once an entry is selected). Anatomy:

- `<h2>` with the entry title.
- Field list (authors, year, journal, DOI, ISBN, abstract…).
- **Raw BibTeX** disclosure (`<button aria-expanded>`) revealing the
  serialized form.
- **Chicago citation** disclosure revealing the rendered Notes-Bibliography
  citation, with a **Copy citation** button.
- **Edit** / **Duplicate** / **Delete** buttons. Delete uses
  typed-confirmation against the citation key (WCAG 3.3.4 / 3.3.6).

---

## 6. Result card (shared component)

**File:** `src/views/result-card.js`. **Used by:** library list rows,
keyword-search results, identifier-lookup results.

Codified invariant (HOTSPOT H11): the card body is **not** a click
target. Only one `<h3><a>` heading-link and one `<button>Select</button>`
are interactive. Tab order: heading-link → Select → next card. No hover
affordance on the card body.

After **Select**, focus moves to the first field of the pre-filled edit
form, and a polite announcement fires: "Imported {title} — edit form
ready."

---

## 7. Edit form

**File:** `src/views/edit-form.js`. **Mounts in:** `<main>` or in a
modal panel depending on entry-point.

| Section | Contents |
|---|---|
| **Heading** | `<h2>` — `New entry` for a fresh entry, `Edit: {key}` otherwise. |
| **Basics** disclosure (open by default) | Entry type `<select>`, citation key (required), title (required). |
| **People** disclosure | Authors / editors as repeatable rows. |
| **Publication** disclosure | Journal, volume, issue, pages, publisher, address, year (numeric inputmode), month. |
| **Identifiers** disclosure | DOI, ISBN (numeric inputmode), URL. |
| **Abstract & notes** disclosure | Multiline. |
| **JEL / LOC chips** (#9) | Suggested codes for relevant types. |
| **Custom fields** (#8) | Name+value rows. |
| **`@archival` extension** (only when type=`archival`) | Repository, collection, finding-aid URL, container, dates, `date_range`. |
| **Save** / **Cancel** / **Save and add another** buttons | `Ctrl/Cmd+S` saves. On validation failure, an error summary appears at the top of the form and focus moves to the first invalid field (`aria-describedby` chains to error and help text — WCAG 3.3.1, 3.3.3). |

Required fields display the literal text "(required)" plus the
`required` attribute. Placeholders are never used as labels.

---

## 8. Custom-field rows (HOTSPOT H12)

**File:** `src/views/custom-fields.js`. **Used inside:** the Edit form.

Each row has a **labelled name input**, a **labelled value input**, and
a **Remove** button with `aria-label="Remove custom field {name}"` —
never a bare ✕.

Focus management on row removal:

| Removed row | Focus lands on |
|---|---|
| Middle row | Next row's Remove button. |
| Last row | The Add custom field button. |
| Only row | The Add custom field button. |

Asserts that focus never lands on `<body>` (WCAG 2.4.3).

---

## 9. JEL / LCC chips

**File:** `src/views/jel-chips.js`. **Used inside:** the Edit form.

`<fieldset>` / `<legend>` "Suggested classifications". Chips are real
`<button>` elements with hit-area ≥ 44 × 44 CSS px. The matched-terms
explanation is associated via `aria-describedby`, never hover-only
(WCAG 1.4.13).

---

## 10. Identifier lookup tab (within Edit form)

**File:** part of `src/views/edit-form.js`; results render via
`src/views/result-card.js`.

`<fieldset>` / `<legend>` "Lookup by". Three sub-tools: **DOI**,
**ISBN** (`inputmode="numeric"`), and **archival** (ArchiveGrid / SNAC
link-outs). On result, the user picks via the result-card's **Select**
button.

---

## 11. Quick Add by DOI modal

**File:** `src/views/quick-add.js`. **Modal:** native `<dialog>`.
**Trigger:** `Ctrl/Cmd+D` or the **Quick Add by DOI** button on the
Empty library screen.

DOI input receives initial focus. Errors associate to the input via
`aria-describedby`. Escape closes; closing returns focus to the
trigger.

---

## 12. Keyword search across providers

**File:** `src/views/keyword-search.js`. **Trigger:** Tab 2 of the Edit
form's lookup, or `Ctrl/Cmd+K`.

| Element | Behaviour |
|---|---|
| Provider `<select>` | Visible label. Switching providers is treated as a new search. |
| Query `<input type="search">` | |
| Sort radios | `<fieldset>` / `<legend>` "Sort by". |
| Result list | Each result uses the result-card invariant (#6). `aria-posinset` / `aria-setsize` reflect **total** result count when the provider returns reliable totals (HOTSPOT H17). |
| Pagination summary | "Showing 1–10 of 47 results" in `role="status"` so it updates without disrupting focus. |
| **Load more** | After click, focus moves to the heading of the first newly-loaded card. Polite announcement: "Loaded 10 more results — showing 11 to 20 of 47." |
| Datasource badge | Visible text label always — never colour-alone (HOTSPOT H16). |

Polite announcements: "Searching {provider}…" and "{count} results".
Assertive announcement: rate-limit messages.

---

## 13. Insights modal (HOTSPOT H8)

**File:** `src/views/insights.js`. **Modal:** native `<dialog>`. **Trigger:**
toolbar action or shortcut.

Six tabs (`role="tablist"`); each tab panel begins with a
plain-language caption (`<p>`) read first when entering the panel
(WCAG 1.1.1, 3.1.5). Charts:

- Each bar is a `<button>` with hit-area ≥ 44 × 44 CSS px.
- Focus on a bar announces "{label}: {value} ({percent}%)".
- Bar fill / surface contrast ≥ 3 : 1.
- `prefers-reduced-motion: reduce` flattens bar transitions.

---

## 14. Stats modal

Co-located with Insights — same chart component, different data set.
Reuses every Insights affordance.

---

## 15. Find / Replace modal

**File:** `src/views/find-replace.js`. **Modal:** native `<dialog>`.
**Trigger:** `Ctrl/Cmd+H`.

Live match-count via the polite region. Success / failure routed
through the shared region and the activity panel. Replace operations
are reversible until the user pushes (WCAG 3.3.6).

---

## 16. Shortcuts modal

**File:** `src/views/shortcuts-modal.js`. **Trigger:** `?` (after a
modifier — single-character chords are forbidden by the registry,
WCAG 2.1.4).

Contents are auto-populated from `src/a11y/shortcuts.js` so the modal
is the **single source of truth** (WCAG 3.3.5). A unit test asserts
that the modal contents equal the registry output.

---

## 17. About / Privacy dialog

**File:** `src/views/about.js`. **Modal:** native `<dialog>`.

Reproduces the §16 privacy table. The `<table>` has a `<caption>` and
`<th scope="col">` headers. axe returns zero violations.

---

## 18. Auth modal (foundations)

**File:** `src/github/auth-modal.js`. **Modal:** native `<dialog>`.

Three tiles, each a real `<button>`. Only configured paths render —
unconfigured ones are hidden, not disabled. Tab order puts enabled
tiles first.

| Tile | Path |
|---|---|
| **Sign in with GitHub** | OAuth device flow (#19), only if `oauthRelay` is set. |
| **Use a personal access token (PAT)** | PAT setup (#20). |
| **Use local git** | Localhost git bridge (#21), only if the probe succeeds. |

The **Use local git** tile may insert mid-session if the probe
succeeds after auth-modal open. When it does, a polite announcement
fires once ("Local git option now available") and focus is **not
stolen** (HOTSPOT H14, WCAG 3.2.2).

---

## 19. OAuth device flow modal (HOTSPOT H3, H4, H5)

**File:** `src/github/oauth-device.js`. **Modal:** native `<dialog>`.

| Element | Behaviour |
|---|---|
| User-code `<output>` | Announced **once** on open via `announce.once`, letter-spelled with explicit spaces ("W D J B dash M J H T") so SR letter-by-letter navigation is unambiguous (HOTSPOT H3, A9). Subsequent polls render visual updates but **never re-announce**. |
| **Copy code** button | Receives initial focus. |
| Polling status | At most one polite announcement per 15 s. Visible textual countdown updates faster but is **not** in a live region (HOTSPOT H4). |
| 1-minute warning | Polite + `announce.once` — fires once, never repeats (HOTSPOT H5, A2). |
| Expiry | Surfaced textually. **Try again** button receives focus. No app timeouts — only GitHub's 15-min limit, surfaced as text (WCAG 2.2.3). |
| Network error | Focus moves to **Try again**. |
| Success | Modal closes; focus returns to the **Save Changes to GitHub** button. |

---

## 20. PAT setup modal (HOTSPOT)

**File:** `src/github/pat.js`. **Modal:** native `<dialog>`.

| Element | Notes |
|---|---|
| Token field | `<input type="password" autocomplete="off">`. |
| **Show token** toggle | `aria-pressed`. Resets to hidden on every modal open (A12). |
| **Token storage** radio group | `<fieldset>` / `<legend>` "Token storage" with three options: Session only, Browser storage (IndexedDB), Encrypted with passphrase. |
| Passphrase field | Revealed when **Encrypted** is chosen. Field is associated to the radio via `aria-describedby` and announced when revealed. AES-GCM with PBKDF2 SHA-256 at 310 000 iterations (`src/github/crypto.js`). |
| **Generate token on GitHub** link | Visible suffix " (opens in new tab)". |
| In-app overlay numbered checklist | Steps for generating the token without context-switching. |
| **Verify and save** | On error, the offending field is associated to the error via `aria-describedby` and focus moves to the first error. |

---

## 21. Localhost git bridge tile / status panel

**File:** `src/github/local-bridge.js`; setup doc `git-bridge/BRIDGE_SETUP.md`.

| Element | Notes |
|---|---|
| Bridge probe | Silent on failure — no error to a user who didn't ask. |
| **Use local git** tile | Renders before OAuth in tab order when the probe succeeds. |
| Status panel | `role="region" aria-label="Local git status"`. Working directory rendered as `<code>` inside the region; long paths wrap, do not truncate. |
| **Settings → Local git → Test connection** | Explicit user-initiated probe affordance (A10, WCAG 3.2.5). |

---

## 22. Sign-out / switch-method menu

**File:** part of `src/github/auth-modal.js` and the pill area.

Disclosure button (`aria-expanded`, `aria-haspopup="menu"`). Menu
items: Sign out, Switch method, Set passphrase. Escape closes the menu
and restores focus to the disclosure button.

---

## 23. Save flow (success path)

Toast: "Saved — commit {short-sha}", duplicated to the activity panel
so the link survives toast fade (WCAG 2.2.1). The unsaved-changes pill
clears.

---

## 24. Conflict dialog (HOTSPOT H6, H7)

**File:** `src/github/conflict-dialog.js`. **Modal:** native
`<dialog role="alertdialog">`.

Default focus is on the **safe** action: **Pull remote and re-apply my
edits**. The other actions are:

- **Force-overwrite remote with my edits** — gated behind a
  typed-confirmation input. The input has a visible label ("Type the
  repository name to confirm"). The placeholder is **not** the label.
  Submit is disabled until exact match. Match announcement uses
  commit-on-Enter or genuine field-exit semantics, **not raw `blur`** —
  so NVDA character-by-character navigation does not produce
  per-character chatter (HOTSPOT H7, A3).
- **View remote diff** — opens an **in-page** panel (NOT a new tab)
  with H2 heading "Remote diff" and H3 sub-headings "Added", "Modified",
  "Deleted" (A8).
- **Save my edits as a .bib download and cancel** — always present, so
  no edits can be lost (WCAG 3.3.6).

---

## 25. PR fallback toast / activity entry

**File:** `src/github/pr-fallback.js`.

| HTTP cause | Behaviour |
|---|---|
| 422 (protected branch / no permission) | Branch-and-PR. Toast contains the PR URL; the activity-panel entry duplicates the link. |
| 403 (no push permission to repo) | Fork-and-PR. Same toast / activity duplication. |
| Localhost rejected push | Bridge prints PR URL; GitCite opens it. Toast and activity panel both link the PR. |

---

## 26. Auto-pull dialog (HOTSPOT H15)

**File:** `src/github/auto-pull.js`. **Modal:** native `<dialog>`.

| Element | Notes |
|---|---|
| Default focus | **Pull latest**. |
| **"Always do this on startup"** checkbox | Tab order **before** the action buttons. |
| Buffered-edits explanation | When the user has buffered local edits, the dialog appears even with "always" set (WCAG 3.3.6). The checkbox stays checked but the explanation notes why the dialog appeared anyway (A7). |
| Auto-dismiss | Never — the dialog only closes on explicit user action (WCAG 2.2.3). |

---

## 27. Theme toggle

`src/a11y/theme.js`. Three-state radio group on the header. Tokens are
audited at 7 : 1 (body) and 3 : 1 (non-text) in **both** themes (HOTSPOT
H9). `prefers-contrast: more` engages overrides for any near-threshold
token. `prefers-reduced-motion` flattens theme-change transitions
(A14).

---

## 28. Toast region + activity panel

`src/a11y/toast.js`. Toast minimum visible duration ≥ 6 s for
non-actionable messages; toasts with action links persist until the
user dismisses or the action is taken. Every toast with an action link
is **also** written to the activity panel so the link is reachable
after the toast fades (HOTSPOT H10, WCAG 2.2.1).

---

## Cross-screen invariants (the AAA contract)

These hold on **every** screen. The §19 deviations register at the top
of `src/index.html` lists each WCAG 2.2 AAA criterion in scope and the
phase that delivers it.

- **One H1** per view, no skipped heading levels.
- **`<html lang="en">`** at the document root (WCAG 3.1.1).
- **Skip link** is the first focusable element.
- **No positive `tabindex`** anywhere in `src/`.
- **No ad-hoc live regions** in `src/views/` — all SR announcements
  go through the singleton polite / assertive pair (`src/a11y/announce.js`).
- **No `role` on `<div>`** for things that should be `<button>` /
  `<a>` (WCAG 4.1.2).
- **Hit area ≥ 44 × 44 CSS px** on every interactive role
  (WCAG 2.5.5), audited by Playwright in both themes.
- **Token contrast ≥ 7 : 1** (body) and **≥ 3 : 1** (non-text / focus
  ring) in both themes, audited by `tools/contrast-audit.mjs`
  (WCAG 1.4.6, 1.4.11, 2.4.13).
- **`prefers-reduced-motion: reduce`** flattens every transition
  globally (WCAG 2.3.3).
- **`prefers-contrast: more`** engages overrides where applicable.
- **Native `<dialog>`** for every modal, with focus trap, Escape close,
  focus restore, and no backdrop-click-close by default
  (WCAG 2.1.2, 2.4.3, 3.2.2).
- **Field primitive** ensures every control has a visible `<label>`,
  required text, `aria-describedby` error association, and an error
  summary on submit failure with focus moved to it
  (WCAG 1.3.1, 3.3.1, 3.3.2, 3.3.3).
- **Glossary / `<abbr title>`** on first use of each domain abbreviation
  per view; tooltips dismissible by Escape
  (WCAG 1.4.13, 3.1.3, 3.1.4, 3.1.5).
- **Reading level** ≤ ninth grade for UI copy and the §20 glossary
  (WCAG 3.1.5).

---

## Where things live (quick map)

| Concern | Path |
|---|---|
| Top-level shell, AAA conformance ledger | `src/index.html` |
| App bootstrap, view routing | `src/app.js` |
| Color tokens, theme | `src/styles/tokens.css`, `src/a11y/theme.js`, `src/a11y/theme-bootstrap.js` |
| Shared a11y primitives (Phase 1) | `src/a11y/{focus,announce,dialog,toast,shortcuts,glossary,field,ids}.js` |
| BibTeX parser/serialiser | `src/core/bibtex.js` |
| Model + persistence | `src/core/{model,persistence}.js` |
| CSV mapping | `src/core/csv.js`, `src/views/mapping-dialog.js` |
| Search / filter | `src/core/{search,filter}.js`, `src/views/{search,filters}.js` |
| List + detail | `src/views/{list,detail}.js` |
| Edit + custom fields + result card | `src/views/{edit-form,custom-fields,result-card,jel-chips,quick-add}.js` |
| Keyword search | `src/views/keyword-search.js`, `src/core/providers.js` |
| Chicago renderer | `src/core/chicago.js` |
| Insights / Stats / Find-Replace / Shortcuts | `src/views/{insights,find-replace,shortcuts-modal}.js` |
| Auth + crypto | `src/github/{auth-modal,pat,oauth-device,local-bridge,crypto}.js` |
| Save / conflict / PR fallback / auto-pull | `src/github/{save,conflict-dialog,pr-fallback,auto-pull}.js` |
| About / privacy | `src/views/about.js` |
| Single-file build | `tools/concat.sh` |
| Token-contrast audit | `tools/contrast-audit.mjs`, `tools/contrast.mjs` |
| Tests | `tests/{unit,component,e2e}/` |
| OAuth relay | `oauth-relay/{worker.js,wrangler.toml,RELAY_SETUP.md}` |
| Localhost git bridge | `git-bridge/{git_bridge.py,git-bridge.ps1,BRIDGE_SETUP.md}` |
| Single-file ship artifact | `dist/index.html` |
