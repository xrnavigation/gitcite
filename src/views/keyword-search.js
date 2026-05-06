// Phase 6 — keyword search panel. DESIGN_SPEC §10.
// HOTSPOT H17: aria-posinset/aria-setsize reflect TOTAL result count, not
// loaded count. Polite/assertive announcements through Phase 1.C.
// Result cards via Phase 5 invariant pattern.

(function () {
  'use strict';

  if (globalThis.GitCiteKeywordSearch) return;

  let _state = {
    provider: 'semanticscholar',
    query: '',
    sort: 'relevance',
    offset: 0,
    limit: 10,
    total: 0,
    loaded: [],
  };

  function open(host, opts) {
    opts = opts || {};
    host.innerHTML = '';
    host.setAttribute('aria-label', 'Search scholarly databases');
    const Field = globalThis.GitCiteField;

    const heading = document.createElement('h2');
    heading.textContent = 'Search scholarly sources';
    host.appendChild(heading);

    // Provider select
    const providerWrap = document.createElement('div');
    const providerId = (globalThis.GitCiteIds || { next: () => 'ks-provider' }).next('ks-provider');
    const providerLabel = document.createElement('label');
    providerLabel.setAttribute('for', providerId);
    providerLabel.textContent = 'Provider';
    providerWrap.appendChild(providerLabel);
    const providerSelect = document.createElement('select');
    providerSelect.id = providerId;
    for (const [v, l] of [['semanticscholar', 'Semantic Scholar'], ['openalex', 'OpenAlex'], ['crossref', 'CrossRef']]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = l;
      if (v === _state.provider) o.selected = true;
      providerSelect.appendChild(o);
    }
    providerSelect.addEventListener('change', () => { _state.provider = providerSelect.value; runSearch({ reset: true }); });
    providerWrap.appendChild(providerSelect);
    host.appendChild(providerWrap);

    // Query input
    const queryField = Field.input({ name: 'q', label: 'Query', placeholder: 'paper title, author, topic', type: 'search' });
    const queryInput = queryField.querySelector('input');
    queryInput.setAttribute('data-keyword-query', '');
    host.appendChild(queryField);

    // Sort
    const sortFs = document.createElement('fieldset');
    const sortLegend = document.createElement('legend');
    sortLegend.textContent = 'Sort by';
    sortFs.appendChild(sortLegend);
    for (const [v, l] of [['relevance', 'Relevance'], ['year', 'Year ↓'], ['citations', 'Citations ↓']]) {
      const id = (globalThis.GitCiteIds || { next: () => 'ks-sort' }).next('ks-sort');
      const wrap = document.createElement('label');
      wrap.setAttribute('for', id);
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.id = id;
      radio.name = 'gitcite-keyword-sort';
      radio.value = v;
      if (v === _state.sort) radio.checked = true;
      radio.addEventListener('change', () => { if (radio.checked) { _state.sort = v; runSearch({ reset: true }); } });
      wrap.appendChild(radio);
      wrap.appendChild(document.createTextNode(' ' + l));
      sortFs.appendChild(wrap);
    }
    host.appendChild(sortFs);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Search';
    submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    submit.addEventListener('click', () => { _state.query = queryInput.value; runSearch({ reset: true }); });
    host.appendChild(submit);

    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _state.query = queryInput.value; runSearch({ reset: true }); }
    });

    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('data-keyword-status', '');
    host.appendChild(status);

    const resultList = document.createElement('div');
    resultList.setAttribute('role', 'list');
    resultList.setAttribute('aria-label', 'Search results');
    host.appendChild(resultList);

    const errorBox = document.createElement('p');
    errorBox.setAttribute('role', 'alert');
    errorBox.style.cssText = 'color:var(--danger);';
    host.appendChild(errorBox);

    const more = document.createElement('button');
    more.type = 'button';
    more.textContent = 'Load more';
    more.hidden = true;
    more.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    more.addEventListener('click', () => runSearch({ reset: false }));
    host.appendChild(more);

    async function runSearch({ reset }) {
      const Providers = globalThis.GitCiteProviders;
      const Announce = globalThis.GitCiteAnnounce;
      const ResultCard = globalThis.GitCiteResultCard;
      if (!Providers || !ResultCard) return;
      errorBox.textContent = '';
      if (reset) {
        _state.offset = 0;
        _state.loaded = [];
        resultList.innerHTML = '';
      }
      if (!_state.query) {
        status.textContent = '';
        more.hidden = true;
        return;
      }
      status.textContent = `Searching ${_state.provider}…`;
      Announce && Announce.polite(`Searching ${_state.provider}`);
      let prevLoaded = _state.loaded.length;
      try {
        const data = await Providers.search({
          provider: _state.provider,
          query: _state.query,
          sort: _state.sort,
          offset: _state.offset,
          limit: _state.limit,
          mailto: opts.mailto,
        });
        _state.total = data.total || data.results.length;
        _state.loaded = _state.loaded.concat(data.results);
        // Render newly added results.
        const total = _state.total;
        let firstNewCard = null;
        for (let i = prevLoaded; i < _state.loaded.length; i++) {
          const r = _state.loaded[i];
          const card = ResultCard.render(r, {
            posinset: i + 1,
            setsize: total,
            onSelect: (d) => { if (typeof opts.onPick === 'function') opts.onPick(d); },
          });
          resultList.appendChild(card);
          if (i === prevLoaded) firstNewCard = card;
        }
        _state.offset = _state.loaded.length;
        const showing = `Showing 1–${_state.loaded.length} of ${total} results`;
        status.textContent = showing;
        if (reset) {
          Announce && Announce.polite(`${total} results`);
        } else {
          Announce && Announce.polite(`Loaded ${data.results.length} more results — ${showing}`);
          // Move focus to the first newly loaded result's heading.
          if (firstNewCard) {
            const link = firstNewCard.querySelector('h3 a, h3 button');
            if (link) link.focus();
          }
        }
        more.hidden = _state.loaded.length >= total;
      } catch (e) {
        const msg = (e && e.code === 'rate-limit') ? 'Rate limited — try again in 30 seconds' : (e && e.message) || 'Search failed.';
        status.textContent = '';
        errorBox.textContent = msg;
        Announce && Announce.assertive(msg);
      }
    }

    if (globalThis.GitCiteShortcuts) {
      try {
        globalThis.GitCiteShortcuts.register({
          key: 'k', mod: 'mod', label: 'Open keyword search', action: 'open-keyword-search',
          handler: () => queryInput.focus(),
        });
      } catch (_) {}
    }

    return { focus: () => queryInput.focus(), runSearch };
  }

  globalThis.GitCiteKeywordSearch = { open };
})();
