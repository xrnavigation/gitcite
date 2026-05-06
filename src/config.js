// Per-deployment configuration. Edit once and commit. Every key has a
// sensible default. See DESIGN_SPEC.md §3 for the documented shape.
const GITCITE_CONFIG = {
  // §6 — auto-load
  autoLoad: '/data/library.bib',
  autoLoadLabel: 'library.bib',

  // §14 — Save to GitHub
  github: {
    enabled: true,
    repo: 'your-username/your-repo',
    branch: 'main',
    path: 'data/library.bib',

    // §14.2 OAuth relay
    oauthRelay: null,
    oauthClientId: '',

    // §14.3 PAT
    patScopesUrl: 'https://github.com/settings/personal-access-tokens/new?name=GitCite',

    // §14.4 Localhost git bridge
    localGitBridge: 'http://localhost:7117',

    // §14.5 Conflict / branch-protection / fork fallback
    prFallback: true,
  },

  // §15 — auto-pull on startup
  autoPullPrompt: true,

  // §10 — keyword search
  scholarly: {
    defaultProvider: 'semanticscholar',
    contactEmail: 'you@example.org',
  },

  // §16 — analytics (optional, off by default)
  analytics: {
    provider: null,
    siteCode: '',
  },

  // §A — accessibility / glossary aids
  glossary: true,
};

// Expose for both module and inline-script use.
globalThis.GITCITE_CONFIG = GITCITE_CONFIG;
