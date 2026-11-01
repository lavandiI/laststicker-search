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

  const MODES = ['light', 'dark', 'system'];
  const PALETTES = ['graphite', 'black'];
  const SCOPES = ['site', 'panel'];
  const IMAGE_LEVELS = ['off', 'soft', 'strong'];

  const DEFAULT_THEME = Object.freeze({
    version: THEME_VERSION,
    mode: 'light',
    palette: 'graphite',
    scope: 'site',
    images: 'off',
  });

  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function normalizeTheme(input) {
    const source = input && typeof input === 'object' ? input : {};

    return {
      version: THEME_VERSION,
      mode: oneOf(source.mode, MODES, DEFAULT_THEME.mode),
      palette: oneOf(source.palette, PALETTES, DEFAULT_THEME.palette),
      scope: oneOf(source.scope, SCOPES, DEFAULT_THEME.scope),
      images: oneOf(source.images, IMAGE_LEVELS, DEFAULT_THEME.images),
    };
  }

  function resolveTheme(theme, systemDark) {
    const normalized = normalizeTheme(theme);
    if (normalized.mode === 'dark') return 'dark';
    if (normalized.mode === 'light') return 'light';
    return systemDark ? 'dark' : 'light';
  }

  function themeDataset(theme, systemDark) {
    const normalized = normalizeTheme(theme);

    return {
      lsTheme: resolveTheme(normalized, systemDark),
      lsPalette: normalized.palette,
      lsScope: normalized.scope,
      lsImages: normalized.images,
    };
  }

  return {
    THEME_KEY,
    THEME_CACHE_KEY,
    THEME_VERSION,
    DEFAULT_THEME,
    MODES,
    PALETTES,
    SCOPES,
    IMAGE_LEVELS,
    normalizeTheme,
    resolveTheme,
    themeDataset,
  };
});
