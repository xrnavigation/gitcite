// Phase 3 — export. DESIGN_SPEC §7.3 + §7.4 (File System Access write-back).
//
// Public API (globalThis.GitCiteExport):
//   download(filename, text)        — fallback download via blob URL
//   saveToFile(filename, text)      — File System Access if available, else
//                                      falls back to download()

(function () {
  'use strict';

  if (globalThis.GitCiteExport) return;

  let _handle = null;

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  async function saveToFile(filename, text) {
    if (!window.showSaveFilePicker) {
      return download(filename, text);
    }
    try {
      if (!_handle) {
        _handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'BibTeX', accept: { 'text/plain': ['.bib'] } }],
        });
      }
      const writable = await _handle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (e) {
      // User cancelled or no permission — fall back to download.
      download(filename, text);
    }
  }

  globalThis.GitCiteExport = { download, saveToFile };
})();
