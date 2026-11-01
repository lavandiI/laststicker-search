// LastSticker Search - applies the selected theme before the page is painted.

(function () {
  'use strict';

  const core = globalThis.LSTheme;
  const store = globalThis.LSThemeStore;
  if (!core || !store) return;

  const media =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  let currentTheme = core.normalizeTheme(null);
  let started = false;

  function systemDark() {
    return Boolean(media && media.matches);
  }

  function apply(theme, options) {
    const settings = options || {};
    const normalized = core.normalizeTheme(theme);
    const resolved = core.resolveTheme(normalized, systemDark());
    const root = document.documentElement;

    if (!root) return;

    root.dataset.lsTheme = resolved;
    root.dataset.lsPalette = normalized.palette;
    root.dataset.lsScope = normalized.scope;
    root.dataset.lsImages = normalized.images;

    currentTheme = normalized;

    if (settings.cache !== false) {
      store.writeThemeCache(normalized, resolved);
    }
  }

  function applyWhenReady(theme, options) {
    if (document.documentElement) {
      apply(theme, options);
      return;
    }

    document.addEventListener('readystatechange', function onReady() {
      if (!document.documentElement) return;
      document.removeEventListener('readystatechange', onReady);
      apply(theme, options);
    });
  }

  function start() {
    if (started) return;
    started = true;

    // Synchronous cache: prevents a white flash on repeat visits.
    const cached = store.readThemeCache();
    if (cached) {
      applyWhenReady(cached.theme, { cache: false });
    }

    // chrome.storage.local is the source of truth.
    store
      .loadTheme()
      .then(function (theme) {
        applyWhenReady(theme);
      })
      .catch(function () {});

    store.onThemeChanged(function (theme) {
      applyWhenReady(theme);
    });

    if (media) {
      const onSystemChange = function () {
        if (currentTheme.mode === 'system') {
          applyWhenReady(currentTheme, { cache: false });
        }
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onSystemChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onSystemChange);
      }
    }
  }

  start();
})();
