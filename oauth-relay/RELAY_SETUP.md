# GitCite OAuth Relay setup

This relay is one Cloudflare Worker per deployment that serves every user.
It holds the OAuth App's `client_secret` as a Worker secret and relays the
two GitHub device-flow endpoints that block browser CORS.

DESIGN_SPEC §14.2 / §17.2.

## 1. Register a GitHub OAuth App

Visit `github.com/settings/applications/new`.

- Application name: anything (for example, `Reference Manager — your-username/your-repo`).
- Homepage URL: GitCite's deployed URL.
- Authorization callback URL: any value (device flow does not use it).
- **Enable Device Flow: must be checked.**
- After registration, copy the **Client ID** (public).
- Generate a **Client secret** (private).
- On the **Permissions** tab, set **Contents: Read and write** for the
  configured repository. This is what each user will see pre-selected on
  their consent screen — the user authorises a single, narrow scope on a
  single repository and nothing else.

## 2. Deploy the Worker

```sh
npm install -g wrangler
wrangler login
cd oauth-relay
wrangler deploy
wrangler secret put GITHUB_OAUTH_CLIENT_ID
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
wrangler secret put ALLOWED_ORIGIN  # e.g. https://your-username.github.io
```

Note the deployed URL (for example `https://gitcite-oauth-relay.your-name.workers.dev`).

## 3. Configure GitCite

Edit `GITCITE_CONFIG.github` in GitCite's HTML file (`src/config.js` or the
shipped `dist/index.html`):

- `oauthRelay`: the Worker URL.
- `oauthClientId`: the OAuth App's Client ID.
- `repo`, `branch`, `path`: the repository and the path to the `.bib` file.

Commit and push. The next page load offers **Sign in with GitHub**.

## 4. Test

Open the deployed application in an incognito window, click **Sign in
with GitHub**, complete the device flow, edit an entry, click **Save
Changes to GitHub**, and verify the commit appears on github.com.

## Notes

- Cloudflare Workers' free tier (100,000 requests/day) is well above any
  plausible application load.
- The Worker contains ~30 lines of code; review the source in `worker.js`
  before deploying.
- The CORS allow-list is `ALLOWED_ORIGIN` only — set this to your
  deployed origin so the relay refuses requests from other sites.
