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
  });

  afterEach(() => {
    delete global.chrome;
    jest.resetModules();
  });

  test('applies the synchronous cache before storage resolves', async () => {
    const store = require('../theme-store.js');
    store.writeThemeCache({ enabled: true, palette: 'black', images: 'soft' }, 'dark');

    global.chrome = createChromeMock();
    loadThemeScript();

    expect(document.documentElement.dataset.lsTheme).toBe('dark');
    expect(document.documentElement.dataset.lsPalette).toBe('black');
    expect(document.documentElement.dataset.lsScope).toBe('site');
    expect(document.documentElement.dataset.lsImages).toBe('soft');

    await flush();
  });

  test('applies chrome.storage.local after the cache check', async () => {
    global.chrome = createChromeMock({
      ls_search_theme: {
        enabled: true,
        palette: 'graphite',
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
        newValue: { enabled: true, images: 'strong' },
      },
    });

    expect(document.documentElement.dataset.lsTheme).toBe('dark');
    expect(document.documentElement.dataset.lsScope).toBe('site');
    expect(document.documentElement.dataset.lsImages).toBe('strong');
  });

  test('keeps the site light when the switch is off', async () => {
    global.chrome = createChromeMock({
      ls_search_theme: { enabled: false },
    });
    loadThemeScript();
    await flush();

    expect(document.documentElement.dataset.lsTheme).toBe('light');
    expect(document.documentElement.dataset.lsScope).toBe('site');
  });
});
