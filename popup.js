// LastSticker Search - popup settings controller.

(function (root) {
  'use strict';

  const core = root.LSTheme || (typeof require === 'function' ? require('./theme-core.js') : null);
  const store =
    root.LSThemeStore || (typeof require === 'function' ? require('./theme-store.js') : null);

  if (!core || !store) return;

  let current = core.normalizeTheme(null);
  let saveTimer = null;
  let saveQueue = Promise.resolve();

  function byId(doc, id) {
    return doc.getElementById(id);
  }

  function setChecked(doc, name, value) {
    const input = doc.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function render(doc, theme) {
    current = core.normalizeTheme(theme);

    const toggle = byId(doc, 'themeEnabled');
    if (toggle) toggle.checked = current.enabled;

    const state = byId(doc, 'themeState');
    if (state) {
      state.textContent = current.enabled ? 'Включена' : 'Выключена';
      state.classList.toggle('is-on', current.enabled);
    }

    setChecked(doc, 'palette', current.palette);

    const images = byId(doc, 'images');
    if (images) images.value = current.images;

    const resolved = core.resolveTheme(current);
    const rootEl = doc.documentElement;
    rootEl.dataset.lsTheme = resolved;
    rootEl.dataset.lsPalette = current.palette;

    const site = byId(doc, 'previewSite');
    if (site) {
      site.classList.toggle('is-dark', resolved === 'dark');
      site.dataset.images = current.images;
    }

    const panel = byId(doc, 'previewPanel');
    if (panel) {
      panel.classList.toggle('is-dark', resolved === 'dark');
    }
  }

  function showSaved(doc, text) {
    const status = byId(doc, 'saveStatus');
    if (!status) return;

    status.textContent = text || 'Сохранено';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      status.textContent = '';
    }, 1600);
  }

  function enqueue(task) {
    saveQueue = saveQueue.then(task, task);
    return saveQueue;
  }

  function update(doc, partial, statusText) {
    return enqueue(async function () {
      try {
        const next = await store.saveTheme(partial);
        render(doc, next);
        showSaved(doc, statusText);
      } catch {
        showSaved(doc, 'Не удалось сохранить');
      }
    });
  }

  function initPopup(doc) {
    const document = doc || root.document;
    if (!document) return null;

    const version = byId(document, 'version');
    if (
      version &&
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      typeof chrome.runtime.getManifest === 'function'
    ) {
      try {
        version.textContent = `v${chrome.runtime.getManifest().version}`;
      } catch {
        version.textContent = '';
      }
    }

    store
      .loadTheme()
      .then(function (theme) {
        render(document, theme);
      })
      .catch(function () {
        render(document, core.DEFAULT_THEME);
      });

    document.addEventListener('change', function (event) {
      const target = event.target;
      if (!target) return;

      if (target.id === 'themeEnabled') {
        update(document, { enabled: target.checked });
        return;
      }

      if (target.name === 'palette') {
        update(document, { palette: target.value });
        return;
      }

      if (target.id === 'images') {
        update(document, { images: target.value });
      }
    });

    const reset = byId(document, 'resetBtn');
    if (reset) {
      reset.addEventListener('click', function () {
        update(document, core.DEFAULT_THEME, 'Сброшено');
      });
    }

    store.onThemeChanged(function (theme) {
      render(document, theme);
    });

    return { render };
  }

  root.LSPopup = { initPopup, render };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LSPopup;
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initPopup();
    });
  } else {
    initPopup();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
