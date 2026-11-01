const fs = require('fs');
const path = require('path');

const core = require('../theme-core.js');

let activeStore = null;
let media = null;

const storeProxy = {
  loadTheme: (...args) => activeStore.loadTheme(...args),
  saveTheme: (...args) => activeStore.saveTheme(...args),
  onThemeChanged: (...args) => activeStore.onThemeChanged(...args),
};

function createStoreMock(initial) {
  let stored = core.normalizeTheme(initial);

  return {
    loadTheme: jest.fn(async () => stored),
    saveTheme: jest.fn(async (partial) => {
      stored = core.normalizeTheme({ ...stored, ...partial });
      return stored;
    }),
    onThemeChanged: jest.fn(() => () => {}),
    getStored: () => stored,
  };
}

function createMedia(initial) {
  const listeners = [];

  return {
    matches: initial,
    addEventListener(type, listener) {
      if (type === 'change') listeners.push(listener);
    },
    removeEventListener() {},
    emit(next) {
      this.matches = next;
      listeners.slice().forEach((listener) => listener({ matches: next }));
    },
  };
}

function createPopupDocument() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  const body = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '') : '';

  const doc = document.implementation.createHTMLDocument('popup');
  doc.body.innerHTML = body;
  return doc;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function change(_doc, target) {
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('popup settings', () => {
  let LSPopup;

  beforeAll(() => {
    media = createMedia(false);
    window.matchMedia = () => media;
    global.matchMedia = window.matchMedia;
    global.LSTheme = core;
    global.LSThemeStore = storeProxy;

    LSPopup = require('../popup.js');
  });

  beforeEach(() => {
    jest.useFakeTimers();
    activeStore = createStoreMock(core.DEFAULT_THEME);
    media.matches = false;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('renders the light theme by default', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    expect(doc.querySelector('input[name="mode"][value="light"]').checked).toBe(true);
    expect(doc.querySelector('input[name="palette"][value="graphite"]').checked).toBe(true);
    expect(doc.querySelector('input[name="scope"][value="site"]').checked).toBe(true);
    expect(doc.getElementById('images').value).toBe('off');
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
    expect(doc.getElementById('previewSite').classList.contains('is-dark')).toBe(false);
    expect(doc.getElementById('previewPanel').classList.contains('is-dark')).toBe(false);
  });

  test('switches the whole site to dark and saves it', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const dark = doc.querySelector('input[name="mode"][value="dark"]');
    dark.checked = true;
    change(doc, dark);
    await flush();

    expect(activeStore.getStored().mode).toBe('dark');
    expect(doc.documentElement.dataset.lsTheme).toBe('dark');
    expect(doc.getElementById('previewSite').classList.contains('is-dark')).toBe(true);
    expect(doc.getElementById('previewPanel').classList.contains('is-dark')).toBe(true);
  });

  test('keeps the site preview light when only panels are themed', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const dark = doc.querySelector('input[name="mode"][value="dark"]');
    dark.checked = true;
    change(doc, dark);
    await flush();

    const panelScope = doc.querySelector('input[name="scope"][value="panel"]');
    panelScope.checked = true;
    change(doc, panelScope);
    await flush();

    expect(activeStore.getStored().scope).toBe('panel');
    expect(doc.getElementById('previewSite').classList.contains('is-dark')).toBe(false);
    expect(doc.getElementById('previewPanel').classList.contains('is-dark')).toBe(true);
  });

  test('updates the image dimming preview', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const images = doc.getElementById('images');
    images.value = 'strong';
    change(doc, images);
    await flush();

    expect(activeStore.getStored().images).toBe('strong');
    expect(doc.getElementById('previewSite').dataset.images).toBe('strong');
  });

  test('switches to the black palette', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const black = doc.querySelector('input[name="palette"][value="black"]');
    black.checked = true;
    change(doc, black);
    await flush();

    expect(activeStore.getStored().palette).toBe('black');
    expect(doc.documentElement.dataset.lsPalette).toBe('black');
  });

  test('resets every setting', async () => {
    activeStore = createStoreMock({
      mode: 'dark',
      palette: 'black',
      scope: 'panel',
      images: 'strong',
    });

    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    doc.getElementById('resetBtn').click();
    await flush();

    expect(activeStore.getStored()).toEqual(core.DEFAULT_THEME);
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
    expect(doc.getElementById('saveStatus').textContent).toBe('Сброшено');
  });

  test('follows the system preference in system mode', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    media.matches = true;
    const system = doc.querySelector('input[name="mode"][value="system"]');
    system.checked = true;
    change(doc, system);
    await flush();

    expect(doc.documentElement.dataset.lsTheme).toBe('dark');

    media.emit(false);
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
  });
});
