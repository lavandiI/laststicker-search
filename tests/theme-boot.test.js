function createChromeMock(initial = {}) {
  const data = { ...initial };
  const listeners = [];

  return {
    storage: {
      local: {
        async get(key) {
          if (typeof key === 'string') return { [key]: data[key] };
          return { ...data };
        },
        async set(values) {
          Object.assign(data, values);
        },
      },
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
        removeListener(listener) {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    },
    emit(changes) {
      listeners.slice().forEach((listener) => listener(changes, 'local'));
    },
    data,
  };
}

function createMedia(initial) {
  let matches = initial;
  const listeners = [];

  return {
    get matches() {
      return matches;
    },
    addEventListener(type, listener) {
      if (type === 'change') listeners.push(listener);
    },
    removeEventListener() {},
    emit(next) {
      matches = next;
      listeners.slice().forEach((listener) => listener({ matches }));
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function loadThemeScript() {
  jest.resetModules();

  window.LSTheme = require('../theme-core.js');
  window.LSThemeStore = require('../theme-store.js');
  global.LSTheme = window.LSTheme;
  global.LSThemeStore = window.LSThemeStore;

  require('../theme.js');
}

describe('theme boot', () => {
  beforeEach(() => {
    localStorage.clear();
    delete global.chrome;
    document.documentElement.removeAttribute('data-ls-theme');
    document.documentElement.removeAttribute('data-ls-palette');
    document.documentElement.removeAttribute('data-ls-scope');
    document.documentElement.removeAttribute('data-ls-images');
    window.matchMedia = () => createMedia(false);
  });

  afterEach(() => {
    delete global.chrome;
    jest.resetModules();
  });

  test('applies the synchronous cache before storage resolves', async () => {
    const store = require('../theme-store.js');
    store.writeThemeCache(
      { mode: 'dark', palette: 'black', scope: 'panel', images: 'soft' },
      'dark',
    );

    global.chrome = createChromeMock();
    loadThemeScript();

    expect(document.documentElement.dataset.lsTheme).toBe('dark');
    expect(document.documentElement.dataset.lsPalette).toBe('black');
    expect(document.documentElement.dataset.lsScope).toBe('panel');
    expect(document.documentElement.dataset.lsImages).toBe('soft');

    await flush();
  });

  test('applies chrome.storage.local after the cache check', async () => {
    global.chrome = createChromeMock({
      ls_search_theme: {
        mode: 'dark',
        palette: 'graphite',
        scope: 'site',
        images: 'off',
      },
    });
    loadThemeScript();

    await flush();

    expect(document.documentElement.dataset.lsTheme).toBe('dark');
    expect(document.documentElement.dataset.lsPalette).toBe('graphite');
    expect(document.documentElement.dataset.lsScope).toBe('site');
  });

  test('reacts to storage changes', async () => {
    const chromeMock = createChromeMock();
    global.chrome = chromeMock;
    loadThemeScript();
    await flush();

    expect(document.documentElement.dataset.lsTheme).toBe('light');

    chromeMock.emit({
      ls_search_theme: {
        newValue: { mode: 'dark', scope: 'panel', images: 'strong' },
      },
    });

    expect(document.documentElement.dataset.lsTheme).toBe('dark');
    expect(document.documentElement.dataset.lsScope).toBe('panel');
    expect(document.documentElement.dataset.lsImages).toBe('strong');
  });

  test('follows the system theme in system mode', async () => {
    const media = createMedia(false);
    window.matchMedia = () => media;

    global.chrome = createChromeMock({
      ls_search_theme: { mode: 'system' },
    });
    loadThemeScript();
    await flush();

    expect(document.documentElement.dataset.lsTheme).toBe('light');

    media.emit(true);
    expect(document.documentElement.dataset.lsTheme).toBe('dark');

    media.emit(false);
    expect(document.documentElement.dataset.lsTheme).toBe('light');
  });
});
