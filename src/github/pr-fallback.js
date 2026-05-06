// Phase 10 — PR fallback. DESIGN_SPEC §14.5.
//   422 (protected branch)        → branch-and-PR
//   403 (read-only collaborator)  → fork-and-PR
//   localhost rejected push       → bridge prints PR-create URL

(function () {
  'use strict';

  if (globalThis.GitCitePRFallback) return;

  const API = 'https://api.github.com';

  async function api(path, { method = 'GET', token, body } = {}) {
    const r = await fetch(API + path, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`${path} → ${r.status} ${txt}`);
    }
    return r.json();
  }

  async function branchAndPR({ token, repo, branch, path, content, message }) {
    // Get base ref sha
    const baseRef = await api(`/repos/${repo}/git/ref/heads/${branch}`, { token });
    const newBranch = `gitcite/save-${Date.now()}`;
    await api(`/repos/${repo}/git/refs`, { method: 'POST', token, body: { ref: `refs/heads/${newBranch}`, sha: baseRef.object.sha } });
    const enc = (typeof btoa !== 'undefined') ? btoa(unescape(encodeURIComponent(content))) : Buffer.from(content, 'utf-8').toString('base64');
    await api(`/repos/${repo}/contents/${path}`, { method: 'PUT', token, body: { message, content: enc, branch: newBranch } });
    const pr = await api(`/repos/${repo}/pulls`, { method: 'POST', token, body: { title: message, head: newBranch, base: branch, body: 'Saved via GitCite (branch protection fallback).' } });
    return { number: pr.number, url: pr.html_url, kind: 'branch' };
  }

  async function forkAndPR({ token, repo, branch, path, content, message }) {
    const fork = await api(`/repos/${repo}/forks`, { method: 'POST', token });
    const headRepo = fork.full_name; // e.g. user/repo
    const baseRef = await api(`/repos/${headRepo}/git/ref/heads/${branch}`, { token });
    const newBranch = `gitcite/save-${Date.now()}`;
    await api(`/repos/${headRepo}/git/refs`, { method: 'POST', token, body: { ref: `refs/heads/${newBranch}`, sha: baseRef.object.sha } });
    const enc = (typeof btoa !== 'undefined') ? btoa(unescape(encodeURIComponent(content))) : Buffer.from(content, 'utf-8').toString('base64');
    await api(`/repos/${headRepo}/contents/${path}`, { method: 'PUT', token, body: { message, content: enc, branch: newBranch } });
    const owner = headRepo.split('/')[0];
    const pr = await api(`/repos/${repo}/pulls`, { method: 'POST', token, body: { title: message, head: `${owner}:${newBranch}`, base: branch, body: 'Saved via GitCite (read-only fallback — fork+PR).' } });
    return { number: pr.number, url: pr.html_url, kind: 'fork' };
  }

  globalThis.GitCitePRFallback = { branchAndPR, forkAndPR };
})();
