// Phase 10 — auto-pull dialog. DESIGN_SPEC §15 (HOTSPOT H15).
// Default focus on Pull latest (the safe action implied by the dialog).
// 'Always' checkbox in tab order BEFORE the action buttons. Dialog
// NEVER auto-dismisses (2.2.3 AAA). Dialog appears even when 'Always' is
// set if there are buffered local edits.

(function () {
  'use strict';

  if (globalThis.GitCiteAutoPull) return;

  async function maybePromptPull({ model, credentials, hasBufferedEdits }) {
    const cfg = (globalThis.GITCITE_CONFIG || {}).github || {};
    const Persistence = globalThis.GitCitePersistence;
    if (!cfg.enabled || !cfg.repo || !cfg.branch || !cfg.path) return null;

    const remoteSha = await globalThis.GitCiteSave.getRemoteSha({
      token: credentials && credentials.token,
      repo: credentials?.repo || cfg.repo,
      branch: cfg.branch,
      path: cfg.path,
    }).catch(() => null);
    if (!remoteSha) return null;
    if (model.meta.baseSha === remoteSha) return null; // up to date

    const prefKey = `auto-pull|${cfg.repo}|${cfg.branch}|${cfg.path}`;
    const alwaysPull = (await Persistence.getPref(prefKey)) === 'always';

    if (alwaysPull && !hasBufferedEdits) {
      // Silent pull
      return { auto: true, remoteSha };
    }

    return new Promise((resolveOk) => {
      openDialog({
        remoteSha,
        hasBufferedEdits,
        prefKey,
        onPullLatest: () => resolveOk({ auto: false, remoteSha, action: 'pull' }),
        onKeepLocal: () => resolveOk({ auto: false, remoteSha, action: 'keep' }),
        onDiff: () => resolveOk({ auto: false, remoteSha, action: 'diff' }),
      });
    });
  }

  function openDialog({ remoteSha, hasBufferedEdits, prefKey, onPullLatest, onKeepLocal, onDiff }) {
    const Dialog = globalThis.GitCiteDialog;
    const Persistence = globalThis.GitCitePersistence;

    const handle = Dialog.open({
      title: 'A newer version of the library is on GitHub',
      role: 'dialog',
      escapeCloses: true,
      content: `<p id="autopull-desc">${hasBufferedEdits ? 'You have unsaved changes. Pulling will replace the on-disk version; your edits will be re-applied on top.' : 'Local cache is older than the version on GitHub.'}</p>`,
      describedById: 'autopull-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    // Always checkbox — in tab order BEFORE the actions.
    const alwaysWrap = document.createElement('p');
    const alwaysId = (globalThis.GitCiteIds || { next: () => 'ap-always' }).next('ap-always');
    const alwaysLabel = document.createElement('label');
    alwaysLabel.setAttribute('for', alwaysId);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = alwaysId;
    Persistence.getPref(prefKey).then((v) => { cb.checked = v === 'always'; });
    cb.addEventListener('change', () => {
      Persistence.setPref(prefKey, cb.checked ? 'always' : null);
    });
    alwaysLabel.appendChild(cb);
    alwaysLabel.appendChild(document.createTextNode(' Always pull on startup'));
    alwaysWrap.appendChild(alwaysLabel);
    body.appendChild(alwaysWrap);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;';

    const pull = document.createElement('button');
    pull.type = 'button';
    pull.setAttribute('data-pull-latest', '');
    pull.textContent = 'Pull latest';
    pull.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    pull.addEventListener('click', () => { handle.close(); onPullLatest && onPullLatest(); });
    actions.appendChild(pull);

    const keep = document.createElement('button');
    keep.type = 'button';
    keep.textContent = 'Keep local copy';
    keep.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    keep.addEventListener('click', () => { handle.close(); onKeepLocal && onKeepLocal(); });
    actions.appendChild(keep);

    const diff = document.createElement('button');
    diff.type = 'button';
    diff.textContent = 'View diff';
    diff.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    diff.addEventListener('click', () => { onDiff && onDiff(); });
    actions.appendChild(diff);

    body.appendChild(actions);
    setTimeout(() => pull.focus(), 0);
  }

  globalThis.GitCiteAutoPull = { maybePromptPull };
})();
