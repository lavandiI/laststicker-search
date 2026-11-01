// LastSticker Search - applies the selected theme before the page is painted.

(function () {
  'use strict';

  const core = globalThis.LSTheme;
  const store = globalThis.LSThemeStore;
  if (!core || !store) return;

  let started = false;

  function apply(theme, options) {
    const settings = options || {};
    const normalized = core.normalizeTheme(theme);
    const resolved = core.resolveTheme(normalized);
    const root = document.documentElement;

    if (!root) return;

    root.dataset.lsTheme = resolved;
    root.dataset.lsPalette = normalized.palette;
    root.dataset.lsImages = normalized.images;

    // There is no panel-only mode. The constant scope attribute is kept
    // because theme.css uses it to raise specificity over the site styles.
    root.dataset.lsScope = 'site';

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
  }

  start();
})();
