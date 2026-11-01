// LastSticker Search - theme model and resolution helpers.
// Shared by the content script, the popup and Jest tests.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LSTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const THEME_KEY = 'ls_search_theme';
  const THEME_CACHE_KEY = 'ls_search_theme_cache';
  const THEME_VERSION = 1;

  const PALETTES = ['graphite', 'black'];
  const IMAGE_LEVELS = ['off', 'soft', 'strong'];

  const DEFAULT_THEME = Object.freeze({
    version: THEME_VERSION,
    enabled: false,
    palette: 'graphite',
    images: 'off',
  });

  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function normalizeTheme(input) {
    const source = input && typeof input === 'object' ? input : {};

    // Older development builds used mode: 'light' | 'dark' | 'system'.
    // Dark maps to enabled, light/system map to disabled.
    const enabled = typeof source.enabled === 'boolean' ? source.enabled : source.mode === 'dark';

    return {
      version: THEME_VERSION,
      enabled,
      palette: oneOf(source.palette, PALETTES, DEFAULT_THEME.palette),
      images: oneOf(source.images, IMAGE_LEVELS, DEFAULT_THEME.images),
    };
  }

  function resolveTheme(theme) {
    return normalizeTheme(theme).enabled ? 'dark' : 'light';
  }

  function themeDataset(theme) {
    const normalized = normalizeTheme(theme);

    return {
      lsTheme: resolveTheme(normalized),
      lsPalette: normalized.palette,
      lsImages: normalized.images,
    };
  }

  return {
    THEME_KEY,
    THEME_CACHE_KEY,
    THEME_VERSION,
    DEFAULT_THEME,
    PALETTES,
    IMAGE_LEVELS,
    normalizeTheme,
    resolveTheme,
    themeDataset,
  };
});
