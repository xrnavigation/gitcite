// Phase 10 — conflict dialog. DESIGN_SPEC §14.5 (HOTSPOTS H6, H7).
// alertdialog, default focus on the SAFE action; Force overwrite requires
// typed-confirmation that commits on Enter or true field-exit (NOT raw
// blur — H7). View remote diff opens in-page; .bib-download fallback is
// always present.

(function () {
  'use strict';

  if (globalThis.GitCiteConflictDialog) return;

  function open({ localStats, remote, repo, onPullAndReapply, onForceOverwrite, onDiff, onDownload }) {
    const Dialog = globalThis.GitCiteDialog;
    const Field = globalThis.GitCiteField;
    const handle = Dialog.open({
      title: 'The library on GitHub has changed since you started editing',
      role: 'alertdialog',
      escapeCloses: true,
      content: `<p id="conflict-desc">Local edits: ${localStats.added} added, ${localStats.modified} modified, ${localStats.deleted} deleted. Remote was updated by ${remote.actor || 'a collaborator'} (${remote.shortSha || 'unknown'}).</p>`,
      describedById: 'conflict-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    const safe = document.createElement('button');
    safe.type = 'button';
    safe.textContent = 'Pull remote and re-apply my edits';
    safe.style.cssText = 'min-block-size:44px;min-inline-size:44px;display:block;margin-block-end:0.5rem;';
    safe.addEventListener('click', () => { handle.close(); if (onPullAndReapply) onPullAndReapply(); });
    body.appendChild(safe);

    const diff = document.createElement('button');
    diff.type = 'button';
    diff.textContent = 'View remote diff';
    diff.style.cssText = 'min-block-size:44px;min-inline-size:44px;display:block;margin-block-end:0.5rem;';
    diff.addEventListener('click', () => { if (onDiff) onDiff(body); });
    body.appendChild(diff);

    const force = document.createElement('button');
    force.type = 'button';
    force.textContent = 'Force overwrite remote';
    force.style.cssText = 'min-block-size:44px;min-inline-size:44px;display:block;margin-block-end:0.5rem;';
    force.addEventListener('click', () => revealForceConfirmation());
    body.appendChild(force);

    const dl = document.createElement('button');
    dl.type = 'button';
    dl.textContent = 'Save my edits as a .bib download and cancel';
    dl.style.cssText = 'min-block-size:44px;min-inline-size:44px;display:block;';
    dl.addEventListener('click', () => { handle.close(); if (onDownload) onDownload(); });
    body.appendChild(dl);

    function revealForceConfirmation() {
      // Replace the force button with a typed-confirmation flow.
      force.disabled = true;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-block-start:0.5rem;border:1px solid var(--border);padding:0.5rem;';
      const f = Field.input({ name: 'confirm', label: 'Type the repository name to confirm', help: 'Press Enter to commit. Force overwrite cannot be undone.' });
      const input = f.querySelector('input');
      wrap.appendChild(f);

      const submit = document.createElement('button');
      submit.type = 'button';
      submit.textContent = 'Force overwrite — confirm';
      submit.disabled = true;
      submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      wrap.appendChild(submit);

      // Commit-on-Enter or genuine field-exit (NOT raw blur — H7).
      function check(reason) {
        const matches = input.value === repo;
        submit.disabled = !matches;
        if (reason === 'enter' || reason === 'change') {
          if (globalThis.GitCiteAnnounce) {
            const n = input.value.length;
            const t = repo.length;
            globalThis.GitCiteAnnounce.polite(`${Math.min(n, t)} of ${t} characters match.`);
          }
        }
      }
      input.addEventListener('input', () => check('input'));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          check('enter');
          if (input.value === repo) {
            handle.close();
            if (onForceOverwrite) onForceOverwrite();
          }
        }
      });
      input.addEventListener('change', () => check('change'));
      submit.addEventListener('click', () => {
        if (input.value === repo) {
          handle.close();
          if (onForceOverwrite) onForceOverwrite();
        }
      });

      body.appendChild(wrap);
      input.focus();
    }
  }

  globalThis.GitCiteConflictDialog = { open };
})();
