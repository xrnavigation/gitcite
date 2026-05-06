// Phase 9 — OAuth device flow. DESIGN_SPEC §14.2.
// Highest-risk a11y surface in the app. Discipline (codified by tests):
//   H3 — user code announces ONCE on open via Phase 1.C announce.once
//        (subsequent polls update the visible <output> but never re-announce)
//   H4 — polling status announces at most once per 15 seconds; the
//        countdown to GitHub's 15-min device-code expiry is text, not just
//        a progress bar
//   2.2.3 AAA — no app-controlled timeouts; only GitHub's device-code
//        expiry surfaced textually with a Try again button
//   H5 — 1-minute-remaining warning is polite + announce.once (never re-fires)

(function () {
  'use strict';

  if (globalThis.GitCiteOAuthDevice) return;

  const STATUS_THROTTLE_MS = 15_000;
  const ONE_MINUTE = 60_000;

  function spellCode(code) {
    // SR-friendly spelling: insert spaces between glyphs and replace dashes
    return String(code || '').replace(/-/g, ' dash ').split('').join(' ').replace(/  +/g, ' ').trim();
  }

  async function start(opts) {
    opts = opts || {};
    const cfg = (globalThis.GITCITE_CONFIG || {}).github || {};
    const Dialog = globalThis.GitCiteDialog;
    const Announce = globalThis.GitCiteAnnounce;
    const Persistence = globalThis.GitCitePersistence;

    let deviceCode, userCode, verificationUri, interval, expiresAt, oneMinuteWarned = false;
    try {
      const r = await fetch(cfg.oauthRelay + '/device/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: cfg.oauthClientId, scope: 'repo' }),
      });
      const data = await r.json();
      deviceCode = data.device_code;
      userCode = data.user_code;
      verificationUri = data.verification_uri || 'https://github.com/login/device';
      interval = (data.interval || 5) * 1000;
      expiresAt = Date.now() + ((data.expires_in || 900) * 1000);
    } catch (e) {
      Announce && Announce.assertive('Could not start sign-in. Please try again.');
      return;
    }

    const handle = Dialog.open({
      title: 'Sign in with GitHub',
      content: '<p id="oauth-desc">Open the verification link below and enter the user code.</p>',
      describedById: 'oauth-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    // User code visible in a non-live <output>.
    const codeBox = document.createElement('output');
    codeBox.style.cssText = 'font-family:monospace;font-size:1.5rem;padding:0.5rem 1rem;border:1px solid var(--border);background:var(--bg-elevated);display:inline-block;letter-spacing:0.25em;';
    codeBox.textContent = userCode;
    body.appendChild(codeBox);

    // Spelled code announced ONCE via announce.once.
    if (Announce) Announce.once(`Your code is ${spellCode(userCode)}`);

    // Verification link
    const link = document.createElement('p');
    const a = document.createElement('a');
    a.href = verificationUri;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Enter the code at github.com/login/device';
    const sr = document.createElement('span');
    sr.style.cssText = 'position:absolute;left:-9999px;';
    sr.textContent = ' (opens in new tab)';
    a.appendChild(sr);
    link.appendChild(a);
    body.appendChild(link);

    // Copy code button — initial focus.
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.setAttribute('aria-pressed', 'false');
    copyBtn.textContent = 'Copy code';
    copyBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(userCode);
        copyBtn.setAttribute('aria-pressed', 'true');
        Announce && Announce.polite('Code copied');
        setTimeout(() => copyBtn.setAttribute('aria-pressed', 'false'), 2000);
      } catch (_) {}
    });
    body.appendChild(copyBtn);

    // Visible countdown — text, not just a progress bar.
    const countdown = document.createElement('p');
    countdown.setAttribute('aria-hidden', 'true'); // text-only countdown not in SR live region
    body.appendChild(countdown);

    // Polite status (separate from announce.once region, throttled).
    let lastStatusAt = 0;
    function statusAnnounce(text) {
      const now = Date.now();
      if (now - lastStatusAt < STATUS_THROTTLE_MS) return;
      lastStatusAt = now;
      Announce && Announce.polite(text);
    }

    const tryAgain = document.createElement('button');
    tryAgain.type = 'button';
    tryAgain.textContent = 'Try again';
    tryAgain.hidden = true;
    tryAgain.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    tryAgain.addEventListener('click', () => {
      handle.close();
      start(opts);
    });
    body.appendChild(tryAgain);

    let pollHandle, countHandle;

    function stopAll() {
      if (pollHandle) clearTimeout(pollHandle);
      if (countHandle) clearInterval(countHandle);
    }

    countHandle = setInterval(() => {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        countdown.textContent = 'Code expired.';
        Announce && Announce.polite('The sign-in code has expired. Try again.');
        tryAgain.hidden = false;
        tryAgain.focus();
        stopAll();
        return;
      }
      const m = Math.floor(remainingMs / 60_000);
      const s = Math.floor((remainingMs % 60_000) / 1000);
      countdown.textContent = `Code expires in ${m}:${String(s).padStart(2, '0')}.`;
      // 1-minute warning — polite + once.
      if (!oneMinuteWarned && remainingMs <= ONE_MINUTE) {
        oneMinuteWarned = true;
        Announce && Announce.once('Sign-in code expires in one minute.');
      }
    }, 1000);

    async function poll() {
      try {
        const r = await fetch(cfg.oauthRelay + '/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ client_id: cfg.oauthClientId, device_code: deviceCode }),
        });
        const data = await r.json();
        if (data.access_token) {
          const cred = { repo: cfg.repo, host: 'github.com', token: data.access_token, savedAt: Date.now() };
          if (Persistence) await Persistence.saveCredential(cred);
          stopAll();
          handle.close();
          if (typeof opts.onSignedIn === 'function') opts.onSignedIn(cred);
          // Restore focus to the Save Changes button if mounted.
          const saveBtn = document.querySelector('[data-save-to-github]');
          if (saveBtn) saveBtn.focus();
          return;
        }
        if (data.error === 'authorization_pending') {
          statusAnnounce('Waiting for you to authorise on github.com');
        } else if (data.error === 'slow_down') {
          interval += 5_000;
        } else if (data.error === 'expired_token') {
          countdown.textContent = 'Code expired.';
          tryAgain.hidden = false;
          tryAgain.focus();
          stopAll();
          return;
        } else if (data.error === 'access_denied') {
          Announce && Announce.assertive('Access denied. Try again.');
          stopAll();
          tryAgain.hidden = false;
          tryAgain.focus();
          return;
        }
      } catch (_) {
        Announce && Announce.assertive('Network error during sign-in. Try again.');
        tryAgain.hidden = false;
        tryAgain.focus();
        stopAll();
        return;
      }
      pollHandle = setTimeout(poll, interval);
    }

    pollHandle = setTimeout(poll, interval);

    // Initial focus on Copy code.
    setTimeout(() => copyBtn.focus(), 0);
  }

  globalThis.GitCiteOAuthDevice = { start, _spellCode: spellCode };
})();
