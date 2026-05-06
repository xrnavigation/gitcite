// Phase 10 — save flow. DESIGN_SPEC §14.5.
// PUT /repos/{owner}/{repo}/contents/{path}; on 409 / sha mismatch the
// conflict dialog drives the user. 422 (branch protection) → branch-PR.
// 403 (read-only) → fork-PR. localhost path uses GitCite Local Bridge.

(function () {
  'use strict';

  if (globalThis.GitCiteSave) return;

  const API = 'https://api.github.com';

  function b64encode(str) {
    if (typeof btoa !== 'undefined') {
      try { return btoa(unescape(encodeURIComponent(str))); } catch (_) {}
    }
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  async function getRemoteSha({ token, repo, branch, path }) {
    const r = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error('GET contents failed: ' + r.status), { status: r.status });
    const data = await r.json();
    return data.sha;
  }

  async function putContents({ token, repo, branch, path, content, message, sha }) {
    const r = await fetch(`${API}/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message, content: b64encode(content), branch, sha: sha || undefined }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 422) throw Object.assign(new Error('Branch protected'), { status: 422, data });
    if (r.status === 403) throw Object.assign(new Error('Read-only access'), { status: 403, data });
    if (r.status === 409 || r.status === 422 || (r.status === 412)) throw Object.assign(new Error('Sha mismatch'), { status: 409, data });
    if (!r.ok) throw Object.assign(new Error('PUT contents failed: ' + r.status), { status: r.status, data });
    return data;
  }

  async function save({ model, credentials, message, signal }) {
    const cfg = (globalThis.GITCITE_CONFIG || {}).github || {};
    const token = credentials.token;
    const repo = credentials.repo || cfg.repo;
    const branch = cfg.branch;
    const path = cfg.path;
    const text = model.serialise();
    const remoteSha = await getRemoteSha({ token, repo, branch, path });
    if (model.meta.baseSha && remoteSha && remoteSha !== model.meta.baseSha) {
      const e = new Error('Remote changed since last sync');
      e.status = 409;
      e.data = { remoteSha, baseSha: model.meta.baseSha };
      throw e;
    }
    const result = await putContents({ token, repo, branch, path, content: text, message, sha: remoteSha });
    return { sha: result.commit?.sha || result.content?.sha, htmlUrl: result.commit?.html_url };
  }

  globalThis.GitCiteSave = { save, getRemoteSha, putContents };
})();
