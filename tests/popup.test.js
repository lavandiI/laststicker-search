const fs = require('fs');
const path = require('path');

const core = require('../theme-core.js');

let activeStore = null;

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

function change(target) {
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('popup settings', () => {
  let LSPopup;

  beforeAll(() => {
    global.LSTheme = core;
    global.LSThemeStore = storeProxy;

    LSPopup = require('../popup.js');
  });

  beforeEach(() => {
    jest.useFakeTimers();
    activeStore = createStoreMock(core.DEFAULT_THEME);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('renders the disabled theme by default', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    expect(doc.getElementById('themeEnabled').checked).toBe(false);
    expect(doc.getElementById('themeState').textContent).toBe('Выключена');
    expect(doc.querySelector('input[name="palette"][value="graphite"]').checked).toBe(true);
    expect(doc.getElementById('images').value).toBe('off');
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
    expect(doc.getElementById('previewSite').classList.contains('is-dark')).toBe(false);
    expect(doc.getElementById('previewPanel').classList.contains('is-dark')).toBe(false);
  });

  test('turns the dark theme on and saves it', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const toggle = doc.getElementById('themeEnabled');
    toggle.checked = true;
    change(toggle);
    await flush();

    expect(activeStore.getStored().enabled).toBe(true);
    expect(doc.documentElement.dataset.lsTheme).toBe('dark');
    expect(doc.getElementById('themeState').textContent).toBe('Включена');
    expect(doc.getElementById('previewSite').classList.contains('is-dark')).toBe(true);
    expect(doc.getElementById('previewPanel').classList.contains('is-dark')).toBe(true);
  });

  test('turns the dark theme off again', async () => {
    activeStore = createStoreMock({
      enabled: true,
      palette: 'graphite',
      images: 'off',
    });

    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    expect(doc.documentElement.dataset.lsTheme).toBe('dark');

    const toggle = doc.getElementById('themeEnabled');
    toggle.checked = false;
    change(toggle);
    await flush();

    expect(activeStore.getStored().enabled).toBe(false);
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
    expect(doc.getElementById('themeState').textContent).toBe('Выключена');
  });

  test('switches to the black palette', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const black = doc.querySelector('input[name="palette"][value="black"]');
    black.checked = true;
    change(black);
    await flush();

    expect(activeStore.getStored().palette).toBe('black');
    expect(doc.documentElement.dataset.lsPalette).toBe('black');
  });

  test('updates the image dimming preview', async () => {
    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    const images = doc.getElementById('images');
    images.value = 'strong';
    change(images);
    await flush();

    expect(activeStore.getStored().images).toBe('strong');
    expect(doc.getElementById('previewSite').dataset.images).toBe('strong');
  });

  test('resets every setting', async () => {
    activeStore = createStoreMock({
      enabled: true,
      palette: 'black',
      images: 'strong',
    });

    const doc = createPopupDocument();
    LSPopup.initPopup(doc);
    await flush();

    doc.getElementById('resetBtn').click();
    await flush();

    expect(activeStore.getStored()).toEqual(core.DEFAULT_THEME);
    expect(doc.documentElement.dataset.lsTheme).toBe('light');
    expect(doc.getElementById('themeEnabled').checked).toBe(false);
    expect(doc.getElementById('saveStatus').textContent).toBe('Сброшено');
  });
});
