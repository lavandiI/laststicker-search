// LastSticker Search - local theme storage.
// chrome.storage.local is the source of truth; the page localStorage holds
// a tiny synchronous cache so theme.js can paint before the first frame.

(function (root) {
  'use strict';

  const core = root.LSTheme || (typeof require === 'function' ? require('./theme-core.js') : null);

  if (!core) return;

  function getChromeStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return null;
    }
    return chrome.storage.local;
  }

  async function loadTheme() {
    const storage = getChromeStorage();

    if (storage) {
      try {
        const data = await storage.get(core.THEME_KEY);
        return core.normalizeTheme(data && data[core.THEME_KEY]);
      } catch {
        return core.normalizeTheme(null);
      }
    }

    try {
      const raw = localStorage.getItem(core.THEME_KEY);
      return core.normalizeTheme(raw ? JSON.parse(raw) : null);
    } catch {
      return core.normalizeTheme(null);
    }
  }

  async function saveTheme(partial) {
    const current = await loadTheme();
    const next = core.normalizeTheme({ ...current, ...(partial || {}) });
    const storage = getChromeStorage();

    if (storage) {
      await storage.set({ [core.THEME_KEY]: next });
    } else {
      try {
        localStorage.setItem(core.THEME_KEY, JSON.stringify(next));
      } catch {
        // Storage can be unavailable in private mode; the in-memory value is
        // still returned so the current page can apply it.
      }
    }

    return next;
  }

  function onThemeChanged(callback) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
      return function unsubscribe() {};
    }

    const listener = (changes, area) => {
      if (area !== 'local' || !changes[core.THEME_KEY]) return;
      callback(core.normalizeTheme(changes[core.THEME_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(listener);

    return function unsubscribe() {
      chrome.storage.onChanged.removeListener(listener);
    };
  }

  function readThemeCache() {
    try {
      const raw = localStorage.getItem(core.THEME_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      // Accept both the current shape and a bare theme object.
      const theme = core.normalizeTheme(parsed.theme || parsed);
      const resolved =
        parsed.resolved === 'dark' || parsed.resolved === 'light' ? parsed.resolved : null;

      if (!resolved) return null;
      return { theme, resolved };
    } catch {
      return null;
    }
  }

  function writeThemeCache(theme, resolved) {
    if (resolved !== 'dark' && resolved !== 'light') return;

    try {
      localStorage.setItem(
        core.THEME_CACHE_KEY,
        JSON.stringify({
          version: core.THEME_VERSION,
          theme: core.normalizeTheme(theme),
          resolved,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // The cache is an optimization; ignore quota and private-mode errors.
    }
  }

  const api = {
    loadTheme,
    saveTheme,
    onThemeChanged,
    readThemeCache,
    writeThemeCache,
  };

  root.LSThemeStore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
