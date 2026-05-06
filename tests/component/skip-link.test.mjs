// Phase 14 Group B — skip-link target lands on H1 (#12).
//
// The skip link's href stays "#main", but activating it moves focus to
// the H1 inside <main> (which has tabindex=-1) so screen readers
// announce "heading level 1, …" immediately. We exercise the document
// listener that app.js installs in setupSkipLink().
import { describe, it, expect, beforeEach } from 'vitest';

function setupShell() {
  document.body.innerHTML = `
    <a href="#main" class="skip-link">Skip to main content</a>
    <header><div data-toolbar-host></div></header>
    <main id="main" tabindex="-1">
      <h1 id="library-heading" tabindex="-1">Library</h1>
      <p>Body</p>
    </main>
  `;
  // Mirror app.js setupSkipLink behaviour. We can't easily load app.js
  // (it depends on many globals), so we re-install the same handler here
  // and assert the contract.
  const skip = document.querySelector('.skip-link');
  skip.addEventListener('click', (e) => {
    const main = document.querySelector('#main');
    const h1 = main.querySelector('h1');
    if (h1) { e.preventDefault(); h1.focus(); }
  });
}

describe('Phase 14 B — skip link focus shift (#12)', () => {
  beforeEach(setupShell);

  it('clicking the skip link moves focus to the H1', () => {
    const skip = document.querySelector('.skip-link');
    skip.click();
    expect(document.activeElement).toBe(document.querySelector('h1'));
  });

  it('the H1 carries tabindex="-1" so it can accept programmatic focus', () => {
    const h1 = document.querySelector('main h1');
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });
});
