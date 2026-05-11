// Phase 8 — Personal Access Token modal. DESIGN_SPEC §14.3.
// <input type="password" autocomplete="off"> — never autofilled.
// Show-token toggle is aria-pressed; resets to hidden on every modal open
// (security — ambiguity A12).
// Storage: session | this-browser | passphrase-encrypted (AES-GCM via PBKDF2).

(function () {
  'use strict';

  if (globalThis.GitCitePAT) return;

  function open(opts) {
    opts = opts || {};
    const cfg = (globalThis.GITCITE_CONFIG || {}).github || {};
    const Field = globalThis.GitCiteField;
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({
      title: 'Sign in with a Personal Access Token',
      content: '<p id="pat-desc">A Personal Access Token (PAT) lets GitCite act on your behalf to push library updates. Follow the steps below to create one with the minimum permissions needed.</p>',
      describedById: 'pat-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    // Phase 15 #6 — explicit step-by-step setup. Tells the user exactly
    // what scope to pick (fine-grained vs classic) and which permissions
    // to grant so the token works for save AND can't do anything else.
    const setup = document.createElement('section');
    setup.setAttribute('aria-labelledby', 'pat-setup-heading');
    setup.style.cssText = 'margin-block-end:1rem;';
    const setupH = document.createElement('h3');
    setupH.id = 'pat-setup-heading';
    setupH.textContent = 'How to create the token';
    setupH.style.cssText = 'margin:0 0 0.5rem;font-size:1rem;';
    setup.appendChild(setupH);

    const ol = document.createElement('ol');
    ol.style.cssText = 'margin:0 0 0.5rem 1.25rem;padding:0;line-height:1.5;';
    const steps = [
      'Click "Generate token on GitHub" below — it opens GitHub\'s "New fine-grained personal access token" page in a new tab.',
      'Token name: anything memorable (e.g. "GitCite — my-library").',
      'Expiration: pick a length you are comfortable with. GitCite re-prompts when the token expires.',
      'Repository access: choose "Only select repositories", then pick the single repo where the .bib file lives.',
      'Repository permissions → set "Contents" to "Read and write". Leave every other permission set to "No access".',
      'Click Generate token, copy the value (it begins with github_pat_), and paste it below.',
    ];
    for (const s of steps) {
      const li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    }
    setup.appendChild(ol);

    const note = document.createElement('p');
    note.style.cssText = 'margin:0;font-size:0.875rem;color:var(--fg-muted);';
    note.innerHTML =
      'Classic tokens also work — pick the <code>repo</code> scope (or <code>public_repo</code> for public repositories). ' +
      'Fine-grained tokens are preferred because they limit access to a single repository.';
    setup.appendChild(note);
    body.appendChild(setup);

    // Generate-token link
    const gen = document.createElement('a');
    gen.href = cfg.patScopesUrl || 'https://github.com/settings/personal-access-tokens/new?name=GitCite';
    gen.target = '_blank';
    gen.rel = 'noopener noreferrer';
    gen.textContent = 'Generate token on GitHub';
    const sr = document.createElement('span');
    sr.style.cssText = 'position:absolute;left:-9999px;';
    sr.textContent = ' (opens in new tab)';
    gen.appendChild(sr);
    const genWrap = document.createElement('p');
    genWrap.appendChild(gen);
    body.appendChild(genWrap);

    // Token field — type=password, autocomplete=off
    const tokenWrap = document.createElement('div');
    const tokenField = Field.input({ name: 'token', label: 'Token', required: true, type: 'password' });
    const tokenInput = tokenField.querySelector('input');
    tokenInput.setAttribute('autocomplete', 'off');
    tokenInput.setAttribute('data-pat-token', '');
    tokenWrap.appendChild(tokenField);
    const showBtn = document.createElement('button');
    showBtn.type = 'button';
    showBtn.setAttribute('aria-pressed', 'false');
    showBtn.textContent = 'Show token';
    showBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    showBtn.addEventListener('click', () => {
      const pressed = showBtn.getAttribute('aria-pressed') === 'true';
      showBtn.setAttribute('aria-pressed', String(!pressed));
      tokenInput.type = pressed ? 'password' : 'text';
    });
    tokenWrap.appendChild(showBtn);
    body.appendChild(tokenWrap);

    body.appendChild(Field.input({ name: 'repo', label: 'Repository', value: cfg.repo || '' }));
    body.appendChild(Field.input({ name: 'branch', label: 'Branch', value: cfg.branch || 'main' }));
    body.appendChild(Field.input({ name: 'path', label: 'File path', value: cfg.path || 'data/library.bib' }));

    // Storage tier radios
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend');
    lg.textContent = 'Token storage';
    fs.appendChild(lg);
    let tier = 'browser';
    const tiers = [
      ['session', 'This session only'],
      ['browser', 'This browser, until the token expires'],
      ['encrypted', 'This browser, encrypted with a passphrase'],
    ];
    let passphraseField = null;
    for (const [v, l] of tiers) {
      const id = (globalThis.GitCiteIds || { next: () => 'tier' }).next('pat-tier');
      const lab = document.createElement('label');
      lab.setAttribute('for', id);
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = 'gitcite-tier';
      r.id = id;
      r.value = v;
      if (v === tier) r.checked = true;
      r.addEventListener('change', () => {
        if (r.checked) {
          tier = v;
          if (tier === 'encrypted' && !passphraseField) {
            passphraseField = Field.input({ name: 'passphrase', label: 'Passphrase', required: true, type: 'password' });
            passphraseField.querySelector('input').setAttribute('aria-describedby', id);
            fs.appendChild(passphraseField);
            if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('Passphrase field now available.');
          } else if (tier !== 'encrypted' && passphraseField) {
            passphraseField.remove();
            passphraseField = null;
          }
        }
      });
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(' ' + l));
      fs.appendChild(lab);
    }
    body.appendChild(fs);

    const errorBox = document.createElement('p');
    errorBox.setAttribute('role', 'alert');
    errorBox.style.cssText = 'color:var(--danger);';
    body.appendChild(errorBox);

    const verify = document.createElement('button');
    verify.type = 'button';
    verify.setAttribute('data-pat-verify', '');
    verify.textContent = 'Verify and save';
    verify.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    verify.addEventListener('click', async () => {
      errorBox.textContent = '';
      const token = tokenInput.value;
      if (!token) {
        tokenInput.setAttribute('aria-invalid', 'true');
        errorBox.textContent = 'Token is required.';
        tokenInput.focus();
        return;
      }
      // Persist according to tier.
      const repo = body.querySelector('input[name="repo"]').value;
      const cred = { repo, host: 'github.com', token, savedAt: Date.now() };
      try {
        if (tier === 'session') {
          sessionStorage.setItem('gitcite:pat', JSON.stringify(cred));
        } else if (tier === 'encrypted' && passphraseField) {
          const pw = passphraseField.querySelector('input').value;
          if (!pw) throw new Error('Passphrase is required.');
          const enc = await globalThis.GitCiteCrypto.encrypt(JSON.stringify(cred), pw);
          await globalThis.GitCitePersistence.saveCredential({ repo, host: 'github.com', encrypted: enc });
        } else {
          await globalThis.GitCitePersistence.saveCredential(cred);
        }
        handle.close();
        if (typeof opts.onSignedIn === 'function') opts.onSignedIn(cred);
      } catch (e) {
        errorBox.textContent = (e && e.message) || 'Failed to save token.';
      }
    });
    body.appendChild(verify);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancel.addEventListener('click', () => handle.close());
    body.appendChild(cancel);

    // Initial focus on the Generate-token link (first recommended step).
    setTimeout(() => gen.focus(), 0);
  }

  globalThis.GitCitePAT = { open };
})();
