const core = require('../theme-core.js');
const store = require('../theme-store.js');

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
    listeners,
    data,
  };
}

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    delete global.chrome;
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('loads defaults when storage is empty', async () => {
    global.chrome = createChromeMock();

    await expect(store.loadTheme()).resolves.toEqual(core.DEFAULT_THEME);
  });

  test('normalizes invalid stored values', async () => {
    global.chrome = createChromeMock({
      [core.THEME_KEY]: { mode: 'sepia', palette: 'purple' },
    });

    const theme = await store.loadTheme();
    expect(theme.mode).toBe('light');
    expect(theme.palette).toBe('graphite');
  });

  test('saves a partial update and keeps the other settings', async () => {
    const chromeMock = createChromeMock({
      [core.THEME_KEY]: {
        mode: 'dark',
        palette: 'graphite',
        scope: 'site',
        images: 'off',
      },
    });
    global.chrome = chromeMock;

    const next = await store.saveTheme({ palette: 'black' });

    expect(next.mode).toBe('dark');
    expect(next.palette).toBe('black');
    expect(chromeMock.data[core.THEME_KEY]).toEqual(next);
  });

  test('falls back to localStorage without chrome.storage', async () => {
    await store.saveTheme({ mode: 'dark', scope: 'panel' });

    const theme = await store.loadTheme();
    expect(theme.mode).toBe('dark');
    expect(theme.scope).toBe('panel');
    expect(JSON.parse(localStorage.getItem(core.THEME_KEY)).mode).toBe('dark');
  });

  test('notifies about theme changes only', () => {
    const chromeMock = createChromeMock();
    global.chrome = chromeMock;
    const callback = jest.fn();

    const unsubscribe = store.onThemeChanged(callback);

    chromeMock.emit({ another_key: { newValue: true } });
    chromeMock.emit({
      [core.THEME_KEY]: { newValue: { mode: 'dark' } },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].mode).toBe('dark');

    unsubscribe();
    expect(chromeMock.listeners).toHaveLength(0);
  });

  test('writes and reads the synchronous cache', () => {
    store.writeThemeCache({ mode: 'dark', palette: 'black' }, 'dark');

    const cached = store.readThemeCache();
    expect(cached.resolved).toBe('dark');
    expect(cached.theme.mode).toBe('dark');
    expect(cached.theme.palette).toBe('black');
  });

  test('ignores cache entries without a valid resolved theme', () => {
    localStorage.setItem(
      core.THEME_CACHE_KEY,
      JSON.stringify({ theme: { mode: 'dark' }, resolved: 'sepia' }),
    );

    expect(store.readThemeCache()).toBeNull();
  });
});
