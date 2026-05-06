# GitCite localhost git bridge setup

The bridge is a small optional companion that runs the user's existing
`git` installation and pushes with their existing local credentials. It
exists because browsers cannot execute shell commands or invoke `git`
directly — the sandbox blocks all OS-level access.

DESIGN_SPEC §14.4 / §17.3.

## Steps

1. Clone the repository locally (the same repository the `library.bib`
   lives in).

2. Run one of:

   ```sh
   python3 git_bridge.py
   ```

   ```pwsh
   pwsh ./git-bridge.ps1
   ```

   The bridge prints `Listening on localhost:7117 — working directory:
   {path}`.

3. Open GitCite in a browser at `localhost` or `127.0.0.1` (any port).
   For example, run a static server in GitCite's `dist/` directory:

   ```sh
   python3 -m http.server 8080 --directory dist
   ```

   then open `http://localhost:8080/`.

4. The auth modal now shows a **Use local git** tile alongside the OAuth
   and PAT tiles. Click it; GitCite is signed in.

5. Edits saved through this path are committed and pushed using the local
   git installation's existing credentials. The bridge process must
   remain running for as long as the user wants to save changes.

## Security boundary

- The bridge listens only on the loopback interface (`127.0.0.1`).
- CORS allow-list is limited to `http://localhost:*` and `file://`.
- No daemon, no service installation, no port exposed beyond loopback.
- Source is in this repository — review `git_bridge.py` (~120 LOC) or
  `git-bridge.ps1` before running.
- The bridge inherits the user's existing git credentials (SSH key,
  GitHub CLI cache, OS keychain). No GitHub credentials touch the
  browser.
