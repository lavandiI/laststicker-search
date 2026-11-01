// LastSticker Search - popup settings controller.

(function (root) {
  'use strict';

  const core = root.LSTheme || (typeof require === 'function' ? require('./theme-core.js') : null);
  const store =
    root.LSThemeStore || (typeof require === 'function' ? require('./theme-store.js') : null);

  if (!core || !store) return;

  const media =
    typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-color-scheme: dark)') : null;

  let current = core.normalizeTheme(null);
  let saveTimer = null;
  let saveQueue = Promise.resolve();

  function systemDark() {
    return Boolean(media && media.matches);
  }

  function byId(doc, id) {
    return doc.getElementById(id);
  }

  function readForm(doc) {
    const mode = doc.querySelector('input[name="mode"]:checked');
    const palette = doc.querySelector('input[name="palette"]:checked');
    const scope = doc.querySelector('input[name="scope"]:checked');
    const images = byId(doc, 'images');

    return core.normalizeTheme({
      mode: mode ? mode.value : undefined,
      palette: palette ? palette.value : undefined,
      scope: scope ? scope.value : undefined,
      images: images ? images.value : undefined,
    });
  }

  function setChecked(doc, name, value) {
    const input = doc.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function render(doc, theme) {
    current = core.normalizeTheme(theme);

    setChecked(doc, 'mode', current.mode);
    setChecked(doc, 'palette', current.palette);
    setChecked(doc, 'scope', current.scope);

    const images = byId(doc, 'images');
    if (images) images.value = current.images;

    const resolved = core.resolveTheme(current, systemDark());
    const rootEl = doc.documentElement;
    rootEl.dataset.lsTheme = resolved;
    rootEl.dataset.lsPalette = current.palette;

    const site = byId(doc, 'previewSite');
    if (site) {
      site.classList.toggle('is-dark', resolved === 'dark' && current.scope === 'site');
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

      if (target.name === 'mode' || target.name === 'palette' || target.name === 'scope') {
        update(document, readForm(document));
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

    if (media) {
      const onSystemChange = function () {
        if (current.mode === 'system') {
          render(document, current);
        }
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onSystemChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onSystemChange);
      }
    }

    return { render, readForm };
  }

  root.LSPopup = { initPopup, readForm, render };

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
