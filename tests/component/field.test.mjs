// Phase 1.I — Field form primitive. WCAG 1.3.1, 3.3.1, 3.3.2, 3.3.3.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/field.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteField;
  delete globalThis.GitCiteIds;
  // eslint-disable-next-line no-new-func
  new Function(IDS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteField;
}

describe('Phase 1.I Field primitive', () => {
  let Field;
  beforeEach(() => {
    Field = load();
  });

  it('input() returns a wrapper with a real <label> for the input', () => {
    const wrap = Field.input({ name: 'title', label: 'Title' });
    document.body.appendChild(wrap);
    const label = wrap.querySelector('label');
    const input = wrap.querySelector('input');
    expect(label).toBeTruthy();
    expect(input).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
    expect(label.textContent).toMatch(/Title/);
  });

  it('placeholder is NOT used as the label', () => {
    const wrap = Field.input({ name: 'title', label: 'Title', placeholder: 'e.g. Cities' });
    const label = wrap.querySelector('label');
    expect(label.textContent).not.toBe('e.g. Cities');
    expect(wrap.querySelector('input').placeholder).toBe('e.g. Cities');
  });

  it('required adds visible "(required)" text and the required attribute', () => {
    const wrap = Field.input({ name: 'title', label: 'Title', required: true });
    expect(wrap.textContent).toMatch(/\(required\)/i);
    expect(wrap.querySelector('input').hasAttribute('required')).toBe(true);
  });

  it('error association: input gets aria-invalid + aria-describedby pointing at the error node', () => {
    const wrap = Field.input({ name: 'title', label: 'Title', error: 'Title cannot be empty.' });
    const input = wrap.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const desc = input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    document.body.appendChild(wrap);
    const errNode = document.getElementById(desc);
    expect(errNode).toBeTruthy();
    expect(errNode.textContent).toMatch(/Title cannot be empty/);
  });

  it('help text is associated via aria-describedby (alongside error if both present)', () => {
    const wrap = Field.input({ name: 'doi', label: 'DOI', help: 'Paste the DOI string.' });
    document.body.appendChild(wrap);
    const input = wrap.querySelector('input');
    const desc = input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    const helpNode = document.getElementById(desc.split(' ')[0]);
    expect(helpNode.textContent).toMatch(/Paste the DOI string/);
  });

  it('errorSummary() returns a focusable region with links to each error field', () => {
    const summary = Field.errorSummary([
      { id: 'f1', message: 'Title cannot be empty.' },
      { id: 'f2', message: 'Citation key already exists.' },
    ]);
    document.body.appendChild(summary);
    expect(summary.getAttribute('role')).toBe('alert');
    expect(summary.getAttribute('tabindex')).toBe('-1');
    const links = summary.querySelectorAll('a[href^="#"]');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('#f1');
    expect(links[1].getAttribute('href')).toBe('#f2');
  });

  it('focusFirstError(form) moves focus to the first invalid field', () => {
    const wrap1 = Field.input({ id: 'f1', name: 'a', label: 'A', error: 'bad' });
    const wrap2 = Field.input({ id: 'f2', name: 'b', label: 'B' });
    const form = document.createElement('form');
    form.appendChild(wrap1);
    form.appendChild(wrap2);
    document.body.appendChild(form);
    Field.focusFirstError(form);
    expect(document.activeElement.id).toBe('f1');
  });
});
