# GitCite — Design Spec

**Application name:** GitCite — a single-file, client-side academic reference manager that saves directly to GitHub.
**Conformance target:** WCAG 2.2 Level **AAA** across the entire app. Where a specific AAA criterion cannot be met, the deviation is documented in §17 with a clear reason; otherwise AAA is the default. Accessibility requirements are integrated into each design section rather than separated.

This is the complete design for a single-file, client-side academic reference manager. It is a self-contained, standalone application — not an extension of any existing tool. The spec describes every feature, every file the project ships, and the deployer setup steps.

---

## 1. Overview

The application is a browser-based reference manager for large BibTeX libraries. It runs entirely in the user's browser as a single HTML file with no client-side build step and no client-side dependencies. It is designed for academic collections of 10,000+ entries and remains responsive at that scale through virtual scrolling.

**Primary capabilities:**

1. **Parse, edit, and export BibTeX libraries** with full round-trip fidelity through Zotero and JabRef, including custom user-defined fields.
2. **Look up metadata by identifier** — DOI via CrossRef, ISBN via Open Library + Google Books, archival material via Internet Archive.
3. **Search scholarly databases by keyword or author** — Semantic Scholar (default), OpenAlex, and CrossRef. Result cards link to the source paper and import into the standard editing workflow with one click.
4. **Save changes back to a GitHub repository** through one of three paths the user picks at sign-in: OAuth via a deployer-hosted relay, a Personal Access Token, or a localhost git bridge for users running the app from a local clone.
5. **Auto-pull on startup** when the source-of-truth file in the repository has changed since the last session.
6. **Classify entries** with suggested JEL (Journal of Economic Literature) codes and Library of Congress subclass chips.
7. **Render Chicago Notes-Bibliography citations** for any entry, copyable to the clipboard.
8. **Analyse the library** through a six-panel insights dashboard — citation age, authors, venues, JEL coverage, metadata quality, datasource provenance.

The application targets researchers who want a fast, scriptable, file-based reference manager with no vendor lock-in. The library file is a plain `.bib` file under the user's control in a Git repository.

---

## 2. Core principles

| Principle | Implication |
|---|---|
| **One file, no build** | The entire app is one HTML file (~310 KB) with inline CSS and inline JavaScript. No bundler, no transpiler, no package manager. Open in a browser; it works. |
| **No client-side backend** | All processing — parsing, search, classification, rendering — runs in the browser. The optional OAuth relay (§14.2) and optional git bridge (§14.4) are deployer-side or user-side helpers that exist solely to handle credentials the browser cannot reach; neither sees library data. |
| **The `.bib` file is the source of truth** | Library data is held in memory during a session. The authoritative copy lives in a Git repository. Mutations are buffered locally so unsaved work survives reload, but the user is always one click away from pushing them to the repo. |
| **AAA accessibility is a design constraint, not a polish step** | Every interactive element, every dialog, every dynamic state change is specified with its accessibility behaviour inline, not in an appendix. |
| **Plain BibTeX, no proprietary fields** | Custom fields are written as standard BibTeX and survive round-trips through Zotero, JabRef, and any other tool that respects unknown fields. |

---

## 3. Configuration

A single `GITCITE_CONFIG` constant at the top of the HTML file controls every per-deployment option. The deployer edits this once and commits.

```javascript
const GITCITE_CONFIG = {
  // §6 — auto-load
  autoLoad: '/data/library.bib',                     // path relative to the deployed origin; null disables
  autoLoadLabel: 'library.bib',                      // display name shown in the header

  // §14 — Save to GitHub
  github: {
    enabled: true,                                   // false hides the entire GitHub UI
    repo: 'your-username/your-repo',                 // user can override at runtime in the auth modal
    branch: 'main',
    path: 'data/library.bib',

    // §14.2 OAuth relay (one Cloudflare Worker per deployment, serves all users)
    oauthRelay: 'https://your-relay.workers.dev',    // null = OAuth disabled
    oauthClientId: 'Iv1.abc123def456',               // public OAuth App client ID

    // §14.3 Personal Access Token path
    patScopesUrl: 'https://github.com/settings/personal-access-tokens/new?name=GitCite',

    // §14.4 Localhost git bridge
    localGitBridge: 'http://localhost:7117',         // null = disabled

    // §14.5 Conflict / branch-protection / fork fallback
    prFallback: true,
  },

  // §15 — auto-pull on startup
  autoPullPrompt: true,                              // false = never prompt

  // §10 — keyword search
  scholarly: {
    defaultProvider: 'semanticscholar',              // 'semanticscholar' | 'openalex' | 'crossref'
    contactEmail: 'you@example.org',                 // OpenAlex polite-pool + Semantic Scholar courtesy
  },

  // §16 — analytics (optional, off by default)
  analytics: {
    provider: null,                                  // 'goatcounter' | null
    siteCode: '',
  },

  // §A — accessibility / glossary aids
  glossary: true,                                    // tooltips for PAT, OAuth, SHA, JEL, LOC, DOI, etc.
};
```

Every key has a sensible default. Setting `github.enabled = false` makes the app a pure offline editor with no Save-to-GitHub UI; setting `autoLoad = null` removes the same-origin fetch on startup.

---

## 4. BibTeX engine

The application ships its own BibTeX parser and serialiser, written from scratch in plain JavaScript. The parser supports:

- nested braces of arbitrary depth,
- `@string` and `@preamble` blocks (preserved through export),
- string concatenation with `#`,
- multi-byte and accented characters (UTF-8 throughout),
- malformed-entry recovery (skip the bad entry, continue parsing),
- entry types `@article`, `@book`, `@inbook`, `@incollection`, `@inproceedings`, `@techreport`, `@phdthesis`, `@misc`, `@unpublished`, `@working`, and the custom `@archival` type defined in §11,
- arbitrary user-defined fields (§9.4) — any field not recognised is stored verbatim and re-emitted.

**Citation key convention.** Generated keys follow the pattern `[author:lower]:[year]:[title:lower:clean:truncate=20]`, matching the Better BibTeX plugin format. Examples: `muth:1969:cities`, `alonso:1964:location`, `keynes:1936:employment`. On collision (during fetch or import) a letter suffix is appended: `smith:2024:cities`, `smithb:2024:cities`, `smithc:2024:cities`.

**Round-trip fidelity.** A library imported, edited, and re-exported produces a `.bib` file that imports cleanly back into Zotero and JabRef with all custom fields, JEL codes, LOC classes, archival fields, and `datasource` provenance preserved.

**Performance.** A 12,000-entry `.bib` file parses in 2–4 seconds on commodity hardware. The parsed model is held in a JavaScript array (`entries`) plus a citation-key-indexed map for O(1) lookup. Re-parsing on import is the only place where parse cost is incurred; all other operations work against the in-memory model.

---

## 5. Library data lifecycle

### 5.1 In-memory model

```js
entries = [
  {
    type: 'article',
    key: 'smith:2024:cities',
    fields: {
      author: 'Smith, Alice and Jones, Bob',
      title: '...',
      year: '2024',
      journal: '...',
      doi: '10.1234/...',
      jel: 'R11; R31',
      lcc: 'HD',
      datasource: 'crossref',
      // ...standard fields, archival fields, custom fields
    },
  },
  // ...
]
```

All filtering, sorting, and search operate against this array.

### 5.2 Persistence

| Layer | Purpose |
|---|---|
| **`sessionStorage`** | Volatile — cleared on tab close. Used only for the "session-only" credential storage tier (§14.3). |
| **`localStorage`** | Used for the theme preference (light/dark) and the auto-pull preference key. Never used for library data. |
| **`IndexedDB`** | Database `gitcite`, stores `pending-edits` (buffered mutations, §5.3), `credentials` (encrypted or plaintext tokens, keyed by `{repo, host}`), and `prefs` (scholarly-provider default, etc.). |
| **In-memory `entries`** | The active library. Discarded on reload; re-hydrated either from `autoLoad` (§6) or from the user's import action. |

### 5.3 Mutation buffering

Every mutation — `saveEntry`, `duplicateEntry`, `deleteEntry`, `findReplace`, `csvImport`, custom-field add/remove — flows through a single `mutate(entry, op)` helper that:

1. updates the in-memory `entries` array,
2. adds the affected key to a `dirty` set (or `deleted` set for removals),
3. writes a record to IndexedDB:
   ```js
   { repo, branch, path, baseSha, edits: [...], savedAt }
   ```

The header gains a "● 12 unsaved changes" pill showing the dirty count. Clicking it opens a small panel listing buffered edits with a Discard control per row.

> **A11y for the unsaved-changes pill.** The pill is a real `<button>` with `aria-label="12 unsaved changes — review"`; the count change is announced by the shared polite live region whenever it updates. The review panel uses the disclosure pattern (`aria-expanded`); each row is reachable in tab order. The Discard button uses `aria-describedby` to associate the citation key being discarded so screen-reader users hear "Discard, smith:2024:cities" rather than just "Discard".

### 5.4 Resilience guarantees

- A browser crash, accidental tab close, or navigation away does not lose buffered edits — they are restored on next load by reading IndexedDB.
- A failed Save-to-GitHub call (network down, conflict, branch protection) leaves the buffer intact. The user can retry or fall back to file download.
- The Save-to-File button in the toolbar is always available regardless of GitHub state, so a download-and-commit-manually escape hatch exists for every user.

---

## 6. Library load and auto-load

On startup the app does the following, in order:

1. If `GITCITE_CONFIG.autoLoad` is set, issue a same-origin `fetch()` for that path. On success, parse and hydrate `entries`. The header shows the configured `autoLoadLabel`.
2. Read IndexedDB for any buffered edits matching the loaded `{repo, branch, path}`. If present, apply them to `entries` and show the unsaved-changes pill with the count.
3. If `GITCITE_CONFIG.github.enabled` and `autoPullPrompt` are both true, issue a conditional `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` against the GitHub API. If the remote SHA differs from the locally-cached SHA, surface the auto-pull dialog (§15).
4. If no `.bib` was loaded (autoLoad disabled, or the fetch failed), show the landing screen with **Import .bib**, **Import .csv**, drag-and-drop drop zone, and **Start with empty library**.

The landing-screen drop zone and the **Import .bib** button are equivalent affordances; the button is reachable in tab order before the drop zone so keyboard-only users have a complete substitute (WCAG 2.5.7).

---

## 7. Import and export

### 7.1 Import `.bib`

Header button or drag-and-drop on the landing screen. The parser (§4) handles malformed entries by skipping them; a non-blocking toast reports `N entries imported, M skipped — see console for details`.

### 7.2 Import `.csv`

The user picks a `.csv` file; the app reads the first row as a header, normalises common column names (`Authors`, `Publication Year`, `ISBN-13`, `Issue Number`, `Book Title`, etc.) against the BibTeX field set, and opens a mapping dialog. Each row of the dialog shows:

- the original CSV column name,
- a `<select>` to map it to a BibTeX field (or leave unmapped),
- a sample value from the first data row.

`type` column values are normalised (`Journal Article` → `article`, `Book Chapter` → `inbook`, etc.). Duplicate citation keys are auto-resolved with letter suffixes. All imported entries are stamped `datasource = {csv-import}`.

> **A11y for the CSV mapping dialog.** Native `<dialog>` with `aria-modal="true"`, focus trap, focus-restore on close, `Escape` close. Each mapping row is a `<fieldset>` with a `<legend>` showing the column index and original name; the `<select>` is the labelled child; the sample value is associated via `aria-describedby`. Submission errors (e.g., the same BibTeX field mapped twice) are listed in an error summary at the top of the dialog with links to the offending rows (WCAG 3.3.1, 3.3.3); focus moves to the summary on submit failure.

### 7.3 Export `.bib`

Header button **Export .bib**. The exporter serialises every entry — including custom fields, archival fields, JEL/LOC codes, and `datasource` — and triggers a download named `library_export.bib`. The same exporter is used by the Save-to-GitHub flow (§14) and by the localhost git bridge (§14.4).

### 7.4 File System Access write-back (Chromium)

When the browser supports `window.showSaveFilePicker`, the toolbar gains a **Save to file** button that retains a file handle on first use; subsequent presses write back to the same on-disk file without re-prompting. A small badge in the toolbar shows the current file's name. On browsers without File System Access (Firefox, Safari) the button degrades to a normal download, identical to **Export .bib**.

### 7.5 Empty start

The landing screen offers **Start with empty library** for users opening the app without any source file. The empty state otherwise looks identical to a freshly loaded library with zero entries.

---

## 8. Library list view

The main view is a three-pane layout (search + sidebar filters on the left, virtual-scrolling entry list in the centre, detail panel on the right). The exact layout adapts to viewport size (§13).

### 8.1 Virtual-scrolling list

The entry list uses fixed-height row virtualisation: rows are 76 CSS px tall, only rows currently in the viewport are rendered as DOM elements, and a tall spacer element gives the scrollbar the correct extent for the full filtered list. This keeps the cost of scrolling and re-rendering independent of library size.

> **A11y for the virtual-scrolling list.** The container exposes `role="feed"` (or `role="list"` with correct `aria-rowcount` / `aria-rowindex` / `aria-setsize` / `aria-posinset` if `feed` is unsuitable) so screen-reader users perceive the **full** filtered library, not just the rendered window. The ↑ / ↓ keyboard shortcuts move focus through the entire list and scroll the viewport when focus reaches the rendered edge — focus never gets stuck at a virtual boundary. Each row's accessible name combines title + author(s) + year + entry-type label so screen-reader users hear the same information sighted users see, never colour alone.

### 8.2 Search bar

A header search input (`Ctrl/Cmd+F` to focus) matches against title, author, citation key, DOI, JEL codes, keywords, custom-field names and values, and `datasource`. Results update within 200 ms on a 12,000-entry library (debounced 80 ms).

### 8.3 Sidebar filters

Each filter combines with the others using AND logic. All filters apply against the in-memory model and are recomputed on every change.

| Filter | Behaviour |
|---|---|
| **Entry type** | Click a type to show only that type. Each type shows a live count; counts update as other filters change. |
| **Year range** | From / To inputs; either or both can be set. For `@archival` entries with a `date_range` field, uses overlap logic — a filter of 1930–1950 matches `date_range = {1923--1947}`. |
| **JEL code** | Dropdown of JEL codes present in the loaded library. |
| **LOC class** | Dropdown of LOC subclasses present in the loaded library. |
| **Datasource** | CrossRef · Open Library · Google Books · CSV Import · Archive Visit · Manual · Semantic Scholar · OpenAlex · CrossRef Search. |
| **Archive Access** | open / digitized / by-appointment / restricted. Auto-shown only when `@archival` entries are present. |
| **Custom fields** | Auto-discovered (§9.4). |
| **Sort** | Year ↓ / ↑, Author A–Z / Z–A, Title A–Z, Citation key A–Z. |

> **A11y for the filter changes.** Filter changes announce the new result count via a single shared `aria-live="polite"` status region — never a separate region per filter. The shape is "{count} entries match your filters" or "No entries match — clear filters to see the full library". The **Clear filters** action focuses on the search input on completion (not on the cleared filter, which would be visually nondescript).

### 8.4 Detail panel

Selecting an entry in the list opens its detail panel on the right. The panel shows:

- the rendered citation header (author, title, venue, year),
- a structured field display grouped by category (publication details, identifiers, classification, archival source, custom fields),
- a collapsible **Raw BibTeX** pane with syntax highlighting (read-only),
- a collapsible **Chicago NB Citation** pane (§12),
- toolbar buttons: **Edit**, **Duplicate**, **Delete**.

> **A11y for the detail panel.** The panel is `role="region"` with `aria-labelledby` pointing at the entry-title heading. The Raw BibTeX pane and Chicago citation pane each use the disclosure pattern with `aria-expanded` on their toggle. Delete prompts a typed-confirmation step (the citation key) to satisfy WCAG 3.3.4 Error Prevention.

---

## 9. Entry editing

### 9.1 Edit form

Triggered by **New** in the header, **Edit** in the detail panel, or **Duplicate** (which clones the selected entry with a new key). The form occupies the right pane on desktop, full-screen on mobile.

The form is divided into the following sections, each a disclosure that expands by default for the relevant entry type:

1. **Basics.** Type, citation key, title, author(s), editor(s), year.
2. **Publication.** Journal / book title, volume, number, pages, edition, publisher, place.
3. **Identifiers.** DOI, ISBN, ISSN, URL.
4. **Classification.** JEL codes (chips), LOC class. **Fetch JEL** and **Suggest LOC** buttons (§11).
5. **Archival source.** Auto-revealed when the type is `@archival`. See §11.2.
6. **Custom fields.** §9.4.
7. **Notes.** Abstract, keywords, free-form note.

All fields have visible `<label>` elements; placeholders are not labels. Required fields use the `required` attribute and a visible "(required)" suffix — never asterisks alone.

### 9.2 Save behaviour

**Save Entry** (`Ctrl/Cmd+S` while editing) validates that citation key and title are both present, that the citation key is unique among existing entries (for new entries) or unchanged (for edits), and that custom-field names match the `[a-z][a-z0-9_-]*` pattern. On error, focus moves to the first invalid field and the error is associated via `aria-describedby` (WCAG 3.3.1, 3.3.3).

On success the entry is committed to `entries` via the `mutate()` helper (§5.3), the dirty count increments, and the form closes. **Save and add another** is a secondary action that keeps the form open with a fresh blank entry of the same type.

### 9.3 Identifier lookup tab

Tab 1 of the search section embedded in the edit form. Three sub-tools, switched by radio buttons:

| Sub-tool | What it queries | API used |
|---|---|---|
| **DOI** | The user pastes a DOI or `https://doi.org/...` URL. | `api.crossref.org` |
| **ISBN** | The user pastes an ISBN (10 or 13). Open Library is queried first; Google Books is queried automatically as fallback if Open Library returns sparse data. WorldCat link-out for manual lookup. | `openlibrary.org`, `googleapis.com/books` |
| **Archival** | Free-text query against Internet Archive's Advanced Search API. Results render as cards (§9.5); clicking a card applies title, author, year, URL, publisher, keywords, and (for `@archival` entries) collection and finding-aid URL, stamping `datasource = {archive-visit}`. DPLA, Europeana, ArchiveGrid, and SNAC link-outs are also exposed. | `archive.org/advancedsearch.php` |

A **Quick Add by DOI** modal (`Ctrl/Cmd+D`) is available from the header for the most common path: paste DOI, fetch, preview, add to library.

> **A11y for the identifier tab and Quick-Add modal.** The radio sub-tool selector is wrapped in `<fieldset>` / `<legend>` "Lookup by". Each input has a visible `<label>` and `<input type="search">` (or `inputmode="numeric"` for ISBN). The Quick-Add modal is a native `<dialog>` with focus on the DOI input on open, focus-trap, `Escape` close, focus return on close. Errors (404 from CrossRef, malformed DOI, network failure) announce through the polite live region and are associated to the input via `aria-describedby`.

### 9.4 Custom user-defined fields

Inside the edit form, the **Custom fields** disclosure section lets the user add any number of `{ name, value }` pairs:

```
Custom fields                             [+ Add field]
─────────────────────────────────────────────────────
  funder            [ NIH R01-XXXXX            ] [Remove]
  irb_protocol      [ 2025-118                 ] [Remove]
  reading_status    [ in-progress              ] [Remove]
```

Field names are validated as legal BibTeX (`[a-z][a-z0-9_-]*`), lower-cased, deduplicated against built-in fields, and saved into the entry's `fields` map. They survive export and round-trip.

The **sidebar Custom fields filter** auto-discovers every custom field name present in the loaded library:

- A `<select>` of distinct values for fields with ≤ 30 distinct values (e.g., `reading_status` → `to-read`, `in-progress`, `done`).
- A free-text **contains** input for fields with > 30 distinct values (e.g., `funder` numbers).
- An "Empty" / "Not empty" toggle for any field.

Multiple custom-field filters combine with AND and clear together with the **Clear filters** button.

> **A11y for custom-field UI.** The Add-field control is a single labelled `<button>` ("Add custom field") that inserts a new row containing a labelled name input and a labelled value input. Each row's remove control is a `<button>` with `aria-label="Remove custom field {name}"` — never an unlabelled "✕" or "X". When the user types an invalid field name (starts with a digit, contains spaces, collides with a built-in field), focus stays on the input, the error is associated via `aria-describedby` and announced through the polite live region, and the row is not committed. Removing a row moves focus to the next remove button, or to **Add custom field** if it was the last row (avoids focus loss — WCAG 2.4.3). The sidebar Custom-fields section is a disclosure with `aria-expanded`; the collapsed-by-default state is announced ("Custom fields, collapsed, button") so SR users discover the section even before any custom fields are present. Each filter dropdown carries a `<label>` (the field name) and an associated `<select>`; free-text variants use `<input type="search">` with an `<output>` for the live result count.

### 9.5 Result-card pattern

The edit form's archival sub-tool and the keyword-search panel (§10) both render results as cards. The card pattern is shared:

- a `role="listitem"` containing,
- an `<h3>` heading-link that opens the source page in a new tab,
- a metadata block (creator, date, venue, identifiers),
- a one-line description / abstract excerpt,
- a single **Select** button that imports the card's data into the form.

Card hit areas: only the heading-link and the **Select** button are interactive — the card body itself is not a click target. Each interactive element is ≥ 44 × 44 CSS px (WCAG 2.5.5).

---

## 10. Keyword search across scholarly databases

A new search affordance for "I want to find papers I don't yet know about." The user enters a free-text query (a paper title, an author name, a topic phrase) and receives a result list inside GitCite, with one-click import.

### 10.1 Providers

| Provider | Endpoint | Key required? | Notes |
|---|---|---|---|
| **Semantic Scholar** (default) | `api.semanticscholar.org/graph/v1/paper/search` | No (optional key for higher rate limit) | Strong relevance ranking; returns DOI, authors, year, venue, abstract, citation count, open-access PDF link. |
| **OpenAlex** | `api.openalex.org/works` | No (`mailto=` recommended for the polite pool) | Largest open scholarly index. Returns DOI, authors, year, venue, abstract, OpenAlex concepts. |
| **CrossRef** | `api.crossref.org/works` | No | The same engine used for DOI lookups (§9.3), here exposed for title and author queries. |

Semantic Scholar is the default. The user can change the active provider via a dropdown; the choice is persisted to IndexedDB.

### 10.2 Search panel UI

Tab 2 of the search section embedded in the edit form, also reachable directly from the header by `Ctrl/Cmd+K` (open keyword search without opening the full edit form).

```
┌──────────────────────────────────────────────────────────────────────┐
│  Search scholarly sources                                            │
│                                                                      │
│  Provider  [ Semantic Scholar ▾ ]  Query  [                       ]  │
│                                                                      │
│  Sort by   ( ) Relevance   (•) Year ↓   ( ) Citations ↓              │
│                                                                      │
│  Showing 1–10 of 47 results                                          │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ # An accessible web map for the visually impaired            │    │
│  │   B. Biggs, S. Coughlan · Frontiers in Computer Science      │    │
│  │   2024 · 12 citations · DOI: 10.3389/fcomp.2024.xxxxx        │    │
│  │   "We present an accessible web mapping interface that ..."  │    │
│  │   [ Select ]                                                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ # Audiom: a non-visual map viewer ...                        │    │
│  │   ...                                                        │    │
│  │   [ Select ]                                                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  [ Load more ]                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

- **Heading.** Each result's title is an `<h3>` element wrapping a single `<a>` — the heading is the link, opening the paper at the provider in a new tab. The link's accessible name is the paper title plus a visually-hidden "(opens in new tab)" suffix. There is no separate "Open paper" button — a single link removes the dual-affordance ambiguity that would otherwise confuse screen-reader users navigating by heading (WCAG 2.4.4).
- **Select.** Imports the paper. The provider's record is mapped into BibTeX fields (title, author, year, venue, DOI, abstract, keywords) and the user is dropped into the standard edit form pre-filled with those values. The new entry is stamped `datasource = {semanticscholar}` / `{openalex}` / `{crossref-search}` accordingly. From here the normal add-citation workflow continues — JEL / LOC suggestion, custom fields, save. After **Select** is pressed, focus moves to the first field of the pre-filled edit form and the polite live region announces "Imported {title} — edit form ready".
- **Load more.** Pagination via the provider's offset / cursor. Default page size 10; the user can raise to 25 / 50 from a dropdown. After **Load more** completes, focus moves to the first newly-loaded result's heading — not back to the Load-more button, which would re-disorient the keyboard or screen-reader user.
- **Sort.** Relevance (provider default), Year ↓, Citations ↓ (Semantic Scholar / OpenAlex only — disabled for CrossRef which does not return reliable citation counts).
- **No results / rate-limited / network error.** Each surfaces a clear inline message in the panel, not a toast — these are search states, not transient events.

### 10.3 New `datasource` values and badges

`semanticscholar`, `openalex`, `crossref-search` are added to the sidebar `datasource` filter dropdown, the Stats and Insights datasource bar charts, and the badge palette (Semantic Scholar purple, OpenAlex teal, CrossRef Search blue — distinct from the CrossRef DOI-lookup badge). Every badge carries a visible text label; colour alone is never the channel (WCAG 1.4.1).

> **A11y throughout the keyword-search panel.** The provider dropdown uses a real `<select>` with a visible `<label>`. The query input has a visible `<label>` "Search scholarly sources" and is `<input type="search">`. The Sort radios are wrapped in `<fieldset>` / `<legend>`. The result list is a `role="list"` with each card as a `role="listitem"` containing the `<h3>` heading-link and a single real `<button>` ("Select") — never wrapped in nested interactive elements that would create double tab stops, and the card body itself is **not** a click target. The "Showing 1–10 of 47 results" line is `role="status"` so pagination changes are perceived without focus disturbance; cards expose `aria-posinset` and `aria-setsize` matching the **total** result count (not just the loaded count), so SR users know how far through the result set they are. While searching, "Searching {provider}…" announces through the polite live region; on completion, "{count} results" announces. Error states ("Rate limited — try again in 30 seconds", "Network error") announce through the assertive live region. The "Load more" button announces "Loaded 10 more results — showing 11 to 20 of 47" on success. Provider-switch is treated as a new search and announces accordingly.

### 10.4 Rate-limit politeness

- **OpenAlex** receives `mailto=` from `GITCITE_CONFIG.scholarly.contactEmail` (the polite pool).
- **Semantic Scholar** caches results for 5 minutes by `{provider, query, sort}` to avoid hammering the unauthenticated quota. The optional API key in **Settings** raises that quota.
- All three providers' returned rate-limit headers are surfaced in a footer line under the result list when present.

---

## 11. Classification engines and archival research

### 11.1 JEL and LOC suggestion

In the **Classification** section of the edit form:

- **Fetch JEL** runs a keyword-scoring engine against the entry's title, abstract, and keywords. It fetches the AEA EconLit XML classification tree on first use (cached for the session); falls back to a built-in 200+ code table if the fetch is blocked. Top 3 candidate codes appear as ranked chips with matched terms and full descriptions; clicking a chip accepts it.
- **Suggest LOC** is active for book-type entries (`@book`, `@inbook`, `@incollection`, `@inproceedings`). The keyword table is weighted toward economics, social science, and urban planning subclasses. Up to 3 suggestions appear as clickable chips.

Output formats:

```bibtex
jel  = {R11; R31; H72},
lcc  = {HD},
```

> **A11y for chip suggestions.** Each chip is a real `<button>` inside a `<fieldset>` with `<legend>` "Suggested JEL codes" / "Suggested LOC classes". Selection state announces through the polite live region. Chip hit area ≥ 44 × 44 (WCAG 2.5.5). The matched-terms tooltip is exposed via `aria-describedby` so the explanation is reachable without hover.

### 11.2 The `@archival` entry type

Selecting `archival` from the entry type dropdown reveals a dedicated **Archival source** form section:

| Field | Description |
|---|---|
| `repository` | Holding institution (e.g., *National Archives, NARA*). |
| `collection` | Named collection or record group. |
| `box` | Box number within the collection. |
| `folder` | Folder number within the box. |
| `item` | Individual document description. |
| `call_number` | Archive's own finding-aid identifier. |
| `date_range` | Date span of the material, e.g., `1923--1947`. |
| `access` | One of `open`, `digitized`, `restricted`, `by-appointment`. |
| `finding_aid_url` | URL to the EAD or HTML finding aid. |
| `visit_date` | Date of the user's research visit. |
| `access_note` | Permission notes or access conditions. |

All fields are written to the exported `.bib` as standard custom fields and survive round-trips through Zotero and JabRef.

In the entry list, `@archival` entries display a colour-coded access badge **with a visible text label** (`open`, `digitized`, `restricted`, `by-appointment`) and show `date_range` in place of a single year. The **Archive Access** sidebar filter auto-appears when archival entries are present. Year-range filtering uses overlap logic so `date_range = {1923--1947}` matches a 1930–1950 filter window.

The form section also exposes link-outs to ArchiveGrid (OCLC's finding-aid aggregator) and SNAC (Social Networks and Archival Context) for manual name-authority and finding-aid lookups.

---

## 12. Chicago Notes-Bibliography citations

A collapsible **Chicago NB Citation** pane in the detail view renders a Chicago 17th-edition bibliography entry for any selected entry. **Copy citation** copies plain text to the clipboard.

Coverage by entry type:

| Type | Format |
|---|---|
| `@archival` | Creator (if any). "Item description." Date range. Collection, Box X, Folder Y. Repository. Finding aid URL. |
| `@article` | Author. "Title." *Journal* vol, no. N (year): pages. DOI. |
| `@book` / `@inbook` | Author. *Title*. Edited by …. Nth ed. Place: Publisher, year. |
| `@incollection` / `@inproceedings` | Author. "Chapter title." In *Booktitle*, edited by …, pages. Place: Publisher, year. |
| `@phdthesis` | Author. "Title." PhD diss., Institution, year. |
| `@techreport` / `@working` | Author. "Title." Institution, year. No. N. |

Author formatting follows Chicago bibliography style: first author inverted (Last, First), subsequent authors in natural order, Oxford comma for three or more, `ed.` / `eds.` suffix for editor-only entries.

> **A11y for the citation pane.** Disclosure pattern with `aria-expanded` on the toggle. The rendered citation is `role="region"` with `aria-label="Chicago Notes-Bibliography citation"`. **Copy citation** announces "Citation copied" through the polite live region on success.

---

## 13. Insights, stats, find-and-replace, shortcuts, theme

### 13.1 Insights modal

A six-tab analytics dashboard, reachable from the toolbar. All computation is in-memory; nothing is sent anywhere.

| Tab | Content |
|---|---|
| **Overview** | Total entries, JEL / LOC classification rates, recent (≤ 5 yr) percentage, datasource breakdown. |
| **Citation Age** | Publication year histogram (up to 40 buckets), median age, average age, decade breakdown. |
| **Authors** | Top 20 authors by entry count, multi-author rate, unique author count. |
| **Venues** | Top 20 journals / booktitles by frequency, venue coverage rate. |
| **JEL Coverage** | Top codes with descriptions, category letter roll-up (A–Z), unique codes used. |
| **Quality** | Average metadata completeness, distribution across quality tiers, per-field fill rate. |

> **A11y for charts.** Each bar is keyboard-focusable; focus announces "{label}: {value} ({percent}%)". Each panel includes a plain-language caption summarising the chart in one sentence (WCAG 1.1.1, 3.1.5). The modal is a native `<dialog>` with focus trap, `Escape` close, and focus restore on close.

### 13.2 Stats modal

A simpler companion to Insights: total entries, JEL / LOC / DOI counts, by-type bar chart, by-datasource bar chart, publication-year histogram. Same accessibility expectations as Insights.

### 13.3 Find and Replace

A toolbar button (`Ctrl/Cmd+H`) opens the Find and Replace modal. Options: field-targeted or all-fields, case-sensitive, whole-field match. A live match preview shows the first N matches before the user commits. On apply, the success message ("X fields updated") routes through the shared status region.

### 13.4 Shortcuts modal

Reachable from the toolbar and from a small `?` button beside the search bar. Documents:

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+D` | Quick Add via DOI |
| `Ctrl/Cmd+F` | Focus search |
| `Ctrl/Cmd+K` | Open keyword search |
| `Ctrl/Cmd+S` | Save entry while editing, or save-to-file otherwise |
| `Ctrl/Cmd+G` | Save Changes to GitHub |
| `Ctrl/Cmd+H` | Find and Replace |
| `↑` / `↓` | Navigate the entry list |
| `Escape` | Cancel edit / close modal |

No shortcut is a single character without a modifier (WCAG 2.1.4). Every new shortcut introduced in future versions is documented here (WCAG 3.3.5).

### 13.5 Theme toggle

A sun/moon button in the top-right corner toggles light and dark themes. The preference is stored in `localStorage`. Both themes are verified to meet WCAG 1.4.6 (7:1 for body text) and WCAG 1.4.11 (3:1 for non-text and focus rings) against every colour token. `prefers-contrast: more` overrides are supplied for any token that cannot reach 7:1 in its base form. `prefers-reduced-motion: reduce` is honoured in every transition (WCAG 2.3.3).

---

## 14. Saving changes back to a GitHub repository

The library is held in memory for the duration of the session and buffered to IndexedDB on every mutation (§5.3). A toolbar **Save Changes to GitHub** button (`Ctrl/Cmd+G`) writes the buffered library back to the configured repository through one of three sign-in paths the user picks at first sign-in: OAuth via the deployer's relay (§14.2), Personal Access Token (§14.3), or the localhost git bridge (§14.4). The save flow itself, conflict handling, and PR fallback are described in §14.5.

### 14.1 Why three paths

A static page in a browser cannot read the user's local git, SSH, or OS-keychain credentials — the browser sandbox blocks access to all of them by design. A static page also cannot ship a `client_secret` for OAuth, because the page is public. The three paths each solve this differently:

- **OAuth via relay** — the deployer runs one tiny Cloudflare Worker that holds the OAuth `client_secret` and CORS-relays the two GitHub OAuth endpoints that block browser CORS. Best UX: the user clicks **Sign in with GitHub**, authorises on github.com, and is signed in. Permissions are pre-set at OAuth App registration time.
- **Personal Access Token** — the user generates a fine-grained PAT once on github.com and pastes it. Zero infrastructure for the deployer. Slightly more friction for the user.
- **Localhost git bridge** — the user runs a small Python (or PowerShell) helper alongside the app. The helper runs `git commit && git push` using the user's existing local credentials. Best for users who already have the repo cloned locally and have git credentials configured.

The **Sign in** modal shows whichever paths are configured. If only one is configured, that one is the default.

### 14.2 OAuth via deployer-hosted relay

**One Worker per deployment serves all users.** Every user sign-in points at the same `oauthRelay` URL, authenticates against the same OAuth App (`oauthClientId`), and receives a token whose permissions are whatever the user already has on the target repo. A maintainer's token can push directly. A read-only collaborator's token cannot — the §14.5 PR fallback handles that case automatically. The deployer registers one OAuth App once; users authenticate normally.

**Pre-set repository permissions on the OAuth App.** When registering the OAuth App, the deployer selects `Contents: Read and write` on the configured repository — and only that. When each user authorises, GitHub shows them exactly those scopes pre-selected; the user only clicks Authorise. No scope-picking happens in the browser.

**Files shipped in `/oauth-relay/`:**

| File | Purpose |
|---|---|
| `worker.js` | ~30 lines. Two routes — `POST /device/code` relays to `github.com/login/device/code`; `POST /token` relays to `github.com/login/oauth/access_token`. Adds the `Access-Control-Allow-Origin` header for the deployed app's origin. Reads `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` from Worker secrets. |
| `wrangler.toml` | Cloudflare Worker config. |
| `RELAY_SETUP.md` | Step-by-step deployer setup (§17). |

**End-user device-flow sequence:**

```
[ Sign in with GitHub ]
  │
  ├─► POST {oauthRelay}/device/code            → user_code, verification_uri, interval
  │
  ├─► Modal shows: "Enter WDJB-MJHT at github.com/login/device — [Open in new tab]"
  │   The code is rendered as a large monospace block with a "Copy code" button.
  │
  ├─► Browser polls POST {oauthRelay}/token every {interval} seconds
  │
  ├─► User authorises on github.com → next poll returns access_token
  │
  └─► Token stored using §14.3's three storage tiers; signed-in pill replaces the modal:
      "signed in as @username · sign out"
```

> **A11y for the device-flow modal.** Native `<dialog>` with `aria-modal="true"`. Focus moves to the **Copy code** button on open (the most likely next action) and is trapped. The user-code is rendered as both a visible monospace `<output>` and announced **once** when the modal opens (the announcement node uses `aria-live="off"` on subsequent re-renders so the code does not re-announce on every poll). The user hears "Your code is W D J B dash M J H T". The `verification_uri` link includes a visually-hidden "(opens in new tab)" suffix. **Copy code** announces "Code copied" through the polite live region on success and toggles `aria-pressed` briefly. The polling status region updates at most once every 15 seconds (not on every poll tick) and surfaces a visible textual countdown to GitHub's 15-minute device-code expiry — text, not just a progress bar (WCAG 1.4.1). On a polling network error, focus moves to a **Try again** button. When the token arrives, the modal closes and focus returns to the Save Changes button. **No automatic timeouts on the polling UI** beyond GitHub's own (15-minute device-code expiry, surfaced clearly with a "Try again" button) — WCAG 2.2.3 No Timing AAA is observed wherever GitCite controls the timing.

### 14.3 Personal Access Token path

The auth modal exposes:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Sign in with a Personal Access Token                                │
│                                                                      │
│  [ Generate token on GitHub ↗ ]                                      │
│  Opens a pre-filled token-creation page in a new tab. Required        │
│  permissions: Contents → Read and write, on this repo only.          │
│                                                                      │
│  Token       [ github_pat_••••••••••••••••••••••••••••• ]  [show]   │
│  Repository  [ your-username/your-repo     ]                         │
│  Branch      [ main ]                                                │
│  File path   [ data/library.bib ]                                    │
│                                                                      │
│  Storage  ( ) This session only                                      │
│           (•) This browser, until the token expires                  │
│           ( ) This browser, encrypted with a passphrase              │
│                                                                      │
│  [ Verify and save ]    [ Cancel ]                                   │
└──────────────────────────────────────────────────────────────────────┘
```

The **Generate token on GitHub** button opens a URL prefilling as much as the GitHub settings page allows. (Classic PAT URLs accept `?scopes=...&description=...`; fine-grained PAT URLs accept fewer query parameters.) To compensate, the page that opens shows a small in-app overlay with a numbered checklist of the exact settings to select on GitHub's form: resource owner, repository, `Contents: Read and write`, expiration. The checklist is the only friction the user faces.

**Storage tiers:**

1. **Session only** — `sessionStorage`, discarded on tab close.
2. **This browser, until the token expires** — IndexedDB record with the GitHub-returned expiration. Default.
3. **Encrypted with a passphrase** — IndexedDB record encrypted via AES-GCM with a key derived through PBKDF2 (310,000 iterations, SHA-256). User is prompted for the passphrase on each load.

**Security notice shown in the modal and in the deployer README:**

> The application runs on a public web page. Any script that runs in this page can read tokens stored in this browser. Use the smallest possible scope (this repo only, `Contents: Read and write`) and the shortest expiration that fits your workflow. Use **Encrypted with a passphrase** on shared computers.

> **A11y for the auth modal and storage radios.** Native `<dialog>` with focus trap, focus-restore on close, and `Escape` close. Focus moves to **Generate token on GitHub** on open (the recommended first step). Every input has a visible `<label>`; placeholders are not labels. The token field is `<input type="password" autocomplete="off">` with a "Show token" toggle button (`aria-pressed`) — never autofilled. Storage radios are wrapped in `<fieldset>` with `<legend>` "Token storage"; arrow-key traversal is the native browser behaviour. The passphrase field appears only when **Encrypted** is selected; the new field is associated to the radio via `aria-describedby` and its appearance announced. Errors from **Verify and save** (401, 403, 404, network) are associated to the offending field via `aria-describedby` and focus moves to the first error.

### 14.4 Localhost git bridge

When GitCite is opened from `localhost` or `127.0.0.1`, a **Use local git** sign-in tile appears alongside the OAuth and PAT tiles. This routes saves through a tiny optional companion that runs the user's existing git installation and pushes with their existing local credentials.

**Why a companion is needed.** Browsers cannot execute shell commands or invoke `git` directly — the sandbox blocks all OS-level access. A small local HTTP service acts as a sanctioned bridge.

**Files shipped in `/git-bridge/`:**

| File | Purpose |
|---|---|
| `git_bridge.py` | ~60 lines. Standard-library Python 3 (no pip). Listens on `localhost:7117`. `GET /status` returns the working-directory path, current branch, and clean / dirty status. `POST /commit` accepts `{ path, content, message, branch }`, writes the file under the working directory, runs `git add <path>`, `git commit -m <message>`, `git push origin <branch>`, and returns the commit SHA. CORS allow-list is `http://localhost:*` and `file://`. |
| `git-bridge.ps1` | PowerShell equivalent for users who prefer it; same surface. |
| `BRIDGE_SETUP.md` | Three steps: clone the repo locally, run `python git_bridge.py` from the repo root, open GitCite — the **Use local git** tile appears. |

**Browser-side detection.** When GitCite loads on a localhost origin, it issues a `GET http://localhost:7117/status` with a 500 ms timeout. If the bridge responds, the **Use local git** tile is shown. Save flow becomes:

```
[ Save Changes to GitHub ]   →   POST http://localhost:7117/commit
                                  body: { path, content, message, branch }
                                  → returns { sha, pushed: true }
```

No GitHub credentials touch the browser. The companion uses whatever git credentials the user already has configured on the machine (SSH key, GitHub CLI cache, OS keychain).

**Security boundary.** The bridge listens only on the loopback interface, accepts requests only from GitCite's origin, and is a foreground process the user starts and stops. No daemon, no service installation, no port exposed beyond loopback. The companion's source is in the repository for the user to audit before running it.

> **A11y for the localhost tile.** The tile is a real `<button>` (not a `<div>` with a click handler). When the bridge probe succeeds, the auth modal announces "Local git detected at {working-directory}" via the polite live region; the tile receives a visible focus ring and is in tab order before the OAuth tile. When the probe fails, no tile appears and no error is shown — the user has not asked for it. If the bridge becomes available mid-session (the user starts it after GitCite loaded), the newly-inserted tile announces once through the polite live region as "Local git option now available" and is **not** auto-focused (would steal focus — WCAG 3.2.2). The status panel under the tile shows the working directory (rendered as `<code>` inside a region labelled "Local git status"), current branch, and dirty-status; long paths wrap rather than truncate so SR users hear the full path. The panel uses `aria-live="polite"` so changes are announced when GitCite re-probes.

### 14.5 Save flow, conflict detection, and PR fallback

```
User clicks [ Save Changes to GitHub ]    (Ctrl/Cmd+G)
   │
   ├─► If not signed in → auth modal, then resume.
   │
   ├─► For OAuth / PAT path:
   │     GET  /repos/{owner}/{repo}/contents/{path}?ref={branch}
   │     If returned sha !== buffered baseSha → conflict dialog (below).
   │     PUT  /repos/{owner}/{repo}/contents/{path}
   │
   ├─► For localhost path:
   │     POST localhost:7117/commit
   │     If git push returns non-fast-forward → conflict dialog.
   │
   ├─► On 422 (branch protection) or 403 (read-only access) → PR fallback (below).
   │
   ├─► On success: clear dirty / deleted, clear IndexedDB buffer, update baseSha.
   │
   └─► Toast (≥ 6 s, also written to the persistent activity panel):
       "Saved to repo@<short-sha> · view commit ↗"
```

**Conflict dialog (sha mismatch or non-fast-forward push).**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠ The library on GitHub has changed since you started editing      │
│                                                                      │
│  Local edits: 7 added, 3 modified, 1 deleted                         │
│  Remote was updated 14 minutes ago by @collaborator (b3d7a91)        │
│                                                                      │
│  [ Pull remote and re-apply my edits ]   ← default focus             │
│  [ View remote diff ]                                                │
│  [ Force overwrite remote ]                                          │
│  [ Save my edits as a .bib download and cancel ]                     │
└──────────────────────────────────────────────────────────────────────┘
```

The default-focus action is **Pull remote and re-apply my edits** — the safe, non-destructive choice (WCAG 3.3.4). **Force overwrite remote** is reachable but never the default and prompts a typed-confirmation step: an input whose visible `<label>` reads "Type the repository name to confirm" (placeholder is not the label); the input announces "{X} of {N} characters match" through the polite live region only on `blur` (per-keystroke would be noisy and unhelpful). **Save my edits as a .bib download and cancel** guarantees the user can never lose work even if every push path fails.

**PR fallback (`prFallback: true`).**

| Trigger | Path |
|---|---|
| `422` from `PUT contents` (protected branch) | Branch-and-PR — create `gitcite/save-{timestamp}` from `{branch}`, commit there, open PR. |
| `403` "Resource not accessible" (read-only collaborator) | Fork-and-PR — `POST /repos/{owner}/{repo}/forks` (idempotent), commit to the fork, open PR with `head: '{user}:{branch}'`. |
| Localhost path, `git push` rejected by branch protection | The companion attempts `git push origin HEAD:gitcite/save-{timestamp}` and prints the URL of the create-PR page — GitCite follows the URL and opens it in a new tab. |

The success toast after a PR fallback reads `Saved as PR #142 — merge the PR to update library.bib · [view PR ↗]`. The PR appears in the persistent activity panel.

> **A11y for the conflict dialog and PR-fallback flow.** `role="alertdialog"` with `aria-describedby` on the explanation paragraph so SR users hear the situation summary on focus. Default focus on the safe action — destructive **Force overwrite** requires both a click and typed confirmation, satisfying WCAG 3.3.4. **View remote diff** opens an in-page diff panel (not a new tab) listing added / modified / deleted entries derived by parsing both `.bib` files in memory; the panel is `role="region"` with a heading addressable by screen reader. The PR-fallback toast contains the PR link, duplicated into the persistent activity panel so the link remains keyboard-reachable after the toast fades (WCAG 2.2.1).

### 14.6 Sign-out, multi-mode, and switching paths

The signed-in pill in the header is a disclosure button (`aria-expanded`, `aria-haspopup="menu"`) that opens a small menu with **Switch sign-in method**, **Sign out**, and (if applicable) **Set / change passphrase**. Sign-out clears the IndexedDB token record and `sessionStorage`. Buffered edits are repo-keyed, not token-keyed, so they survive sign-out — the user can sign in again and push.

---

## 15. Auto-pull on startup

On every load, after the in-memory parse of the auto-loaded `.bib`, GitCite issues a conditional `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` using `If-None-Match: <last-seen-sha>`. The conditional GET is unauthenticated for public repos; it falls back to the user's stored token only if the repo is private or rate-limited.

| State | Behaviour |
|---|---|
| Local SHA = remote SHA | Silent. Use cache. |
| Newer remote, no buffered local edits | Show pull dialog (below). |
| Newer remote, with buffered local edits | Show pull dialog with merge warning: "You have N unsaved changes. Pulling will replace the on-disk version; your edits will be re-applied on top." |
| Auto-pull preference = always, no buffered edits | Pull silently; toast: "Library synced from repo@{sha}". |
| Auto-pull preference = always, with buffered edits | Still show the dialog — never silently overwrite local work. |

**Dialog:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  A newer version of library.bib is on GitHub                         │
│                                                                      │
│  Local : 12,341 entries, last synced 2 days ago                      │
│  Remote: 12,358 entries, updated 3 hours ago by @collaborator         │
│                                                                      │
│  ☐ Always do this on startup                                         │
│                                                                      │
│  [ Pull latest ]   [ Keep local copy ]   [ View diff ]               │
└──────────────────────────────────────────────────────────────────────┘
```

The "Always do this on startup" preference is stored in IndexedDB keyed by `{repo, branch, path}`. Even when checked, the dialog still appears if there are buffered local edits, to prevent silent data loss. A **Pull from GitHub** button is permanently available in the toolbar so the user can refresh on demand regardless of preference. **Settings → Auto-pull** lets the user clear the preference.

> **A11y for the pull dialog.** Native `<dialog>` with focus trap. Default focus on **Pull latest** (the action implied by the dialog's existence). The "Always do this on startup" checkbox has a visible `<label>` and is reachable in tab order before the action buttons so a keyboard user can toggle it before committing. The diff view, when opened, is a `role="region"` panel with a heading and a list of added / modified / deleted entries. The dialog never auto-dismisses (WCAG 2.2.3 No Timing AAA).

---

## 16. Privacy and outbound requests

| Endpoint | Trigger | Sent |
|---|---|---|
| `api.crossref.org` | DOI lookup, CrossRef keyword search | DOI / query |
| `openlibrary.org` | ISBN / title lookup | ISBN / query |
| `googleapis.com/books` | Google Books fallback for ISBN | ISBN / query |
| `archive.org/advancedsearch.php` | Archival sub-tool search | query |
| `aeaweb.org/.../classificationTree.xml` | First **Fetch JEL** click | nothing |
| `api.semanticscholar.org` | Keyword search | query |
| `api.openalex.org` | Keyword search | query + `mailto=` if configured |
| `api.github.com/repos/{owner}/{repo}/...` | Save flow, auto-pull | token (header) + base64 of `.bib` on PUT |
| `{oauthRelay}/device/code`, `/token` | OAuth device flow | `client_id`, `device_code` |
| `localhost:7117/status`, `/commit` | Localhost git bridge | `.bib` content + commit message |
| `fonts.googleapis.com` | Startup | nothing |
| Same-origin `.bib` path | Auto-load | nothing |
| (optional) `gc.zgo.at/count.js` | Page load if analytics enabled | URL + referrer (no cookies) |

**Library data leaves the browser only when the user clicks Save Changes to GitHub** — and even then, it goes only to the configured GitHub repository (or, on localhost, to the local git bridge running on the user's own machine).

The **About** dialog inside GitCite reproduces this table verbatim so users can audit what their copy of GitCite calls out to.

---

## 17. Deployer setup

The application repository ships three setup-time documents.

### 17.1 `README.md` (top-level)

Covers: what GitCite is, how to deploy it, how to point it at a `library.bib`, and the configuration reference for `GITCITE_CONFIG`. The minimal-deploy path is:

1. Fork or clone GitCite's repository.
2. Edit `GITCITE_CONFIG.github.repo`, `branch`, and `path` to point at where the user wants the library file to live.
3. Place an initial `.bib` file at `GITCITE_CONFIG.autoLoad`.
4. Enable GitHub Pages on the fork: **Settings → Pages → Source: main branch, / (root)**.
5. Visit the deployed URL.

At this point GitCite works as an offline editor with file download. The next two documents are needed only if the deployer wants Save-to-GitHub.

### 17.2 `oauth-relay/RELAY_SETUP.md`

Steps:

1. **Register a GitHub OAuth App** at `github.com/settings/applications/new`.
   - **Application name:** anything (e.g., "Reference Manager — your-username/your-repo").
   - **Homepage URL:** GitCite's deployed URL.
   - **Authorization callback URL:** any value (device flow does not use the callback) — use the deployed URL.
   - **Enable Device Flow:** **must be checked.**
   - After registration, copy the `Client ID` (public) and generate a `Client secret`.
   - On the **Permissions** tab, set **Contents: Read and write** for the configured repository. This is what each user will see pre-selected on their consent screen — the user authorises a single, narrow scope on a single repo and nothing else.
2. **Create the Cloudflare Worker.**
   - `npm install -g wrangler` if not installed; `wrangler login`.
   - `cd oauth-relay && wrangler deploy`.
   - Set secrets: `wrangler secret put GITHUB_OAUTH_CLIENT_ID`, then `… GITHUB_OAUTH_CLIENT_SECRET`.
   - Note the deployed URL (e.g., `https://your-relay.your-name.workers.dev`).
3. **Configure GitCite.**
   - Edit `GITCITE_CONFIG.github` in GitCite's HTML file:
     - `oauthRelay`: the Worker URL.
     - `oauthClientId`: the OAuth App's Client ID.
     - `repo`, `branch`, `path`: the repo and the path to the `.bib` file.
   - Commit and push. The next page load offers **Sign in with GitHub**.
4. **Test.** Open the deployed application in an incognito window, click **Sign in with GitHub**, complete the device flow, edit an entry, click **Save Changes to GitHub**, and verify the commit appears on github.com.

Setup-time goal: **under 10 minutes** for a deployer with an existing GitHub account and a free Cloudflare account. Cloudflare Workers' free tier (100,000 requests/day) is well above any plausible application load.

### 17.3 `git-bridge/BRIDGE_SETUP.md`

Steps for users who want the localhost path:

1. Clone the repository locally (the same repository the `library.bib` lives in).
2. Run `python git_bridge.py` (or `pwsh git-bridge.ps1`) from the repo root. The bridge prints `Listening on localhost:7117 — working directory: {path}`.
3. Open GitCite in a browser at `localhost` or `127.0.0.1` (any port; for example `python -m http.server` from GitCite's deployed directory).
4. The auth modal now shows a **Use local git** tile alongside the OAuth and PAT tiles. Click it; GitCite is signed in.
5. Edits saved through this path are committed and pushed using the local git installation's existing credentials. The bridge process must remain running for as long as the user wants to save changes.

---

## 18. Implementation footprint

| Area | LOC (est.) | Deps | `GITCITE_CONFIG` |
|---|---|---|---|
| BibTeX parser, serialiser, model | ~600 | none | none |
| Library load, autoLoad, IndexedDB buffering | ~350 | none | `autoLoad`, `autoLoadLabel` |
| Import (.bib drag-drop, .csv mapping dialog) | ~450 | none | none |
| Export (.bib download, File System Access write-back) | ~150 | `showSaveFilePicker` (built-in) | none |
| Virtual-scrolling list view | ~300 | none | none |
| Search bar + sidebar filters (incl. custom-field filters) | ~500 | none | none |
| Detail panel + Raw BibTeX + Chicago citation pane | ~600 | none | none |
| Edit form (sections, validation, custom fields) | ~700 | none | none |
| Identifier lookup tab (DOI, ISBN, archival) | ~450 | none | none |
| Keyword search panel (3 providers, unified UI) | ~500 | none | `scholarly.{defaultProvider,contactEmail}` |
| JEL + LOC classification engines | ~400 | none | none |
| Insights modal (6 tabs, charts) | ~600 | none | none |
| Stats modal, Find and Replace, Shortcuts modal | ~350 | none | none |
| Theme toggle, glossary tooltips, plain-language helpers | ~150 | none | `glossary` |
| Auth modal (OAuth, PAT, localhost) | ~450 | none | `github.{oauthRelay,oauthClientId,patScopesUrl,localGitBridge}` |
| OAuth Cloudflare Worker (`/oauth-relay/`) | ~30 (Worker) + ~120 (setup docs) | none on the client | n/a |
| Localhost git bridge (`/git-bridge/`) | ~60 (Python) + ~60 (PowerShell) + ~80 (docs) | none on the client | n/a |
| Save-to-GitHub PUT, sha-conflict dialog | ~250 | none | — |
| PR fallback (branch protection, fork-and-PR) | ~250 | none | `github.prFallback` |
| Auto-pull dialog, diff view | ~300 | none | `autoPullPrompt` |
| Optional passphrase encryption (AES-GCM via PBKDF2) | ~80 | `crypto.subtle` (built-in) | none |
| Datasource filter, badges, accessibility plumbing across the app | ~400 | none | none |
| **Total client-side** | **~7,860** | none | **15** keys |

Net file size: roughly 310 KB for the single HTML file. Single-file, no client-side build step, no client-side dependencies.

---

## 19. AAA conformance — the deviations register

The application aims at WCAG 2.2 AAA across the whole app. Accessibility expectations are integrated into each design section above, not collected here. This section exists solely to record any AAA criterion that cannot be met, with a clear reason.

| WCAG criterion | Status | Note |
|---|---|---|
| 1.4.6 Contrast (Enhanced) | met | All text ≥ 7:1 in both themes; chart-bar text labels present. |
| 2.2.3 No Timing | met | No automatic timeouts on any application-controlled flow. |
| 2.2.4 Interruptions | met | Auto-pull, toast, and live-region updates are gated on user preferences and never interrupt focused composition. |
| 2.3.3 Animation from Interactions | met | All transitions honour `prefers-reduced-motion`. |
| 2.4.10 Section Headings | met | Search panel, detail panel, edit form, and dialogs all use heading hierarchies. |
| 2.4.13 Focus Appearance | met | ≥ 2 CSS px focus ring with ≥ 3:1 contrast on every interactive element. |
| 2.5.5 Target Size (Enhanced) | met | All targets ≥ 44 × 44 CSS px including JEL chips after spacing audit. |
| 3.1.3 Unusual Words | met | Glossary tooltips on PAT, OAuth, SHA, JEL, LOC, DOI, ISBN, ISSN, BibTeX, PR, fork. |
| 3.1.4 Abbreviations | met | `<abbr title="...">` on every domain abbreviation on first use in each view. |
| 3.1.5 Reading Level | met | UI copy reviewed against ninth-grade reading-level target; technical terms accompanied by plain-language gloss on first use in a flow. |
| 3.2.5 Change on Request | met | Auto-pull, auto-load, and auto-tab-selection all gated on user preferences. |
| 3.3.5 Help | met | Shortcuts modal, glossary tooltips, inline error explanations, and the deployer setup documents fulfil this. |
| 3.3.6 Error Prevention (All) | met | All save flows have reversal paths; destructive **Force overwrite** requires typed confirmation. |

If any criterion later fails verification, the deviation is documented in the relevant PR description before merge, the row is updated to `deviation`, and the reason is logged here.

---

## 20. Glossary

The glossary tooltips configured by `GITCITE_CONFIG.glossary = true` cover, at minimum:

| Term | Plain-language gloss |
|---|---|
| **BibTeX** | A plain-text file format for storing references. Each entry is a record with fields like `title`, `author`, `year`. |
| **DOI** | Digital Object Identifier. A short string like `10.1234/abc.5678` that uniquely identifies a paper. |
| **ISBN** | International Standard Book Number. The 10- or 13-digit number on the back of a book. |
| **ISSN** | International Standard Serial Number. The 8-digit number that identifies a journal. |
| **JEL** | Journal of Economic Literature classification. A standard set of codes economists use to categorise their work. |
| **LOC** | Library of Congress classification. The letter-based system US libraries use to shelve books (e.g., `HD` = economic history). |
| **OAuth** | A way to sign in to one website using your account from another (here, GitHub). The website you visit never sees your password. |
| **PAT** | Personal Access Token. A long string you generate on GitHub and paste here; it lets GitCite act on your behalf without your password. |
| **PR** | Pull Request. A proposed change to a Git repository. Used here as the fallback save path when you cannot push directly. |
| **SHA** | A short fingerprint of a file's contents. The application uses it to detect when the library has changed on GitHub since you started editing. |
| **fork** | Your own copy of someone else's GitHub repository. The application creates one for you automatically if you only have read access to the source repo. |

---

## Sources

- [GitHub: Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub: Device flow CORS notes (octokit)](https://github.com/octokit/auth-oauth-user.js/)
- [GitHub: REST repository contents](https://docs.github.com/en/rest/repos/contents)
- [Authenticate to GitHub in the Browser with the Device Flow — Andrea Zonca](https://www.zonca.dev/posts/2025-01-29-github-auth-browser-device-flow)
- [Cloudflare Workers: getting started](https://developers.cloudflare.com/workers/get-started/guide/)
- [OpenAlex API documentation](https://docs.openalex.org/)
- [Semantic Scholar Academic Graph API](https://api.semanticscholar.org/api-docs/)
- [CrossRef REST API](https://api.crossref.org/swagger-ui/index.html)
- [Internet Archive Advanced Search API](https://archive.org/advancedsearch.php)
- [AEA EconLit JEL classification tree](https://www.aeaweb.org/econlit/classificationTree.xml)
- [Library of Congress Classification outline](https://www.loc.gov/catdir/cpso/lcco/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)


---

## §21 — Phase 13 revisions

After the Phase 12 release, eight UX/a11y issues were surfaced in user
review. Several conflicted with foundational §1–§2 constraints
(single-file ship, no client-side dependencies, AAA-grade error
prevention, lazy auth) and required design decisions before
implementation.

### Decisions

| # | Tension | Resolution |
|---|---|---|
| D1 | AG-Grid would violate §2 "no client-side dependencies" and balloon the artifact ~4×. | Built an in-house accessible grid (`src/views/grid.js`). Roving tabindex and Excel/Google-Sheets keyboard model, modeled on the WhatSock Dynamic Grid pattern. Stays single-file. |
| D2 | Removing typed-confirm for delete drops AAA 3.3.4 / 3.3.6. | `<dialog role="alertdialog">` Cancel/Delete pair followed by a 30 s **Undo toast** persisted to the activity panel. Undo restores the entry from `model.deleted`. Reversibility now lives in the undo path plus the .bib download fallback at save time, so 3.3.6 stays "met". |
| D3 | §14 says auth is lazy. User wants auth visible at startup. | Always-present **Sign in to GitHub** button in the header (`src/views/auth-toggle.js`). Lazy-auth contract preserved: read-only users are never forced through auth. |
| D4 | Where the multi-mode search lives. | The Quick Add by DOI modal is replaced by a multi-mode search modal (`src/views/add-search.js`) with DOI / Title / Author / Keyword modes. DOI mode runs `providers.byDoi` (direct CrossRef `works/{doi}` lookup); the others go through the existing keyword-search providers. |

### Spec amendments

- **§2 (Core principles)** — restated as a hard constraint after D1: no
  client-side dependencies in the shipped artifact. The accessible grid
  is in-house code.
- **§5.3 (Mutation buffering)** — extended with an undo stack
  (`src/core/undo.js`). Each delete pushes an `{ id, undo }` entry. The
  toast's **Undo** button calls `runById(id)` to restore via
  `model.mutate(entry, 'add')`.
- **§8.1 (Library list)** — replaced with **§8.1' Library grid**. The
  virtual list is replaced by an accessible `role="grid"` view with
  roving tabindex, six columns (Title, Authors, Year, Type, Datasource,
  Saved), sortable column headers, and the Excel/Sheets keyboard model
  documented in `SCREENS.md`. The HOTSPOT H1 invariant carries forward:
  `aria-rowcount` reflects filtered + header, and every rendered row's
  `aria-rowindex` reflects its position in the **full filtered count**,
  not the rendered window.
- **§9.3 (Quick Add)** — replaced with **§9.3' Multi-mode search modal**.
  Modes DOI / Title / Author / Keyword. DOI mode uses `providers.byDoi`;
  others route through the existing search providers. Result list uses
  the result-card invariant; **Select** pre-fills via `onPick`.
- **§10.1 (Providers)** — added `byDoi(doi)` returning the same
  `{ results, total }` shape as `search()`. Strips `https://doi.org/`,
  `https://dx.doi.org/`, `doi:` prefixes; rejects malformed DOIs without
  a network call; caches by DOI for 5 minutes.
- **§13.4 (Shortcuts) / §13.5 (Theme)** — entry-points moved from
  global JS API / shortcut-only to visible buttons on the new header
  toolbar. The Shortcuts modal still respects 2.1.4 (modifier required
  for the `?` chord).
- **§14 (Auth)** — visible **Sign in to GitHub** affordance in the
  header (`src/views/auth-toggle.js`). When unauthenticated, click
  opens the existing auth modal. When authenticated, the button
  carries `aria-haspopup="menu"` and opens the sign-out / switch-method
  / set-passphrase menu. Lazy-auth contract preserved — read-only
  users not forced through auth.
- **§14.5 (Save flow)** — visible **Save changes** button in the
  header (`src/views/save-button.js`). Disabled when 0 pending changes.
  Click and global Ctrl/Cmd+S route to the save flow. The button is
  the user-facing complement to the unsaved-changes pill (count) so
  the action is one Tab away from the count.
- **§14.5 (Save flow, delete sub-clause)** — typed-confirmation for
  delete is replaced with the simple-confirm + 30 s Undo toast pattern
  described in D2 above. The .bib download fallback is unchanged.

### §19 deviations register updates

The conformance ledger comment at the top of `src/index.html` is
updated by Phase 13 with these row changes:

- **3.3.4 (Error Prevention All)** — mechanism changed from
  typed-confirmation to `<alertdialog>` confirm + 30 s undo toast.
  Status remains **met**; verification mechanism: tests/component/{
  toast-action, undo, row-action-dialog}.test.mjs.
- **3.3.6 (Error Prevention All — All Submissions)** — same change.
  Status remains **met**; .bib download fallback at save time and undo
  buffer cover the reversibility requirement.
- **2.4.5 (Multiple Ways)** — new row, status **met**: every
  formerly-orphaned screen now has a visible button on the header
  toolbar AND retains its keyboard shortcut where applicable.
- **1.3.1 (Info & Relationships)** — restated for grid: `role="grid"`,
  `role="row"`, `role="columnheader"`, `role="gridcell"`,
  `aria-rowcount`, `aria-rowindex`, `aria-colcount`, `aria-sort`.
  Verification: tests/component/grid.test.mjs.
- **2.1.1 (Keyboard)** — restated for grid (Excel/Sheets keys) and
  toolbar (arrow-key nav). Verification: tests/component/{grid,
  header-toolbar}.test.mjs.
- **2.1.2 (No Keyboard Trap)** — restated for the row-action dialog
  morph (Edit/Duplicate body swap does not trap focus; Cancel returns
  to menu mode). Verification: tests/component/row-action-dialog.test.mjs.
- **2.4.3 (Focus Order)** — restated for the disclosure helper
  (Escape returns focus to the disclosure button) and the grid
  (focus never lands on `<body>`; roving tabindex). Verification:
  tests/component/{disclosure, grid}.test.mjs.
- **3.2.4 (Consistent Identification)** — new row, status **met**:
  the Save changes and Sign in buttons, the header toolbar, and the
  unsaved-changes pill are present in identical position and labelling
  across every view. Verification by visual inspection plus
  tests/component/{save-button, auth-toggle, header-toolbar}.test.mjs.
- **4.1.2 (Name, Role, Value)** — restated for: grid (`role="grid"`
  with proper child roles), toolbar (`role="toolbar"` with `aria-label`),
  add-search radio group, row-action dialog menu/morph buttons,
  delete-confirm Cancel/Delete pair, save and auth-toggle buttons, and
  the toast button-style action.
- **4.1.3 (Status Messages)** — restated for sort-change polite
  announcement, restored-after-undo announcement, and search status.

### Test-suite delta

Total component+unit tests: 286 → **+75 from Phase 12**.

| Edit | New tests |
|---|---|
| 1 (multi-mode search + byDoi) | 6 unit + 9 component |
| 2 (accessible grid) | 15 component |
| 3 (row-action dialog) | 11 component |
| 4 (undo + toast action) | 6 + 5 component |
| 5 (save button) | 8 component |
| 6 (disclosure helper) | 8 component |
| 7 (auth toggle) | 8 component |
| 8 (header toolbar) | 7 component |

All green at the close of Phase 13.
