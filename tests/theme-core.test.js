const core = require('../theme-core.js');

describe('theme core', () => {
  test('defaults to a light graphite theme for the whole site', () => {
    expect(core.normalizeTheme(null)).toEqual({
      version: 1,
      mode: 'light',
      palette: 'graphite',
      scope: 'site',
      images: 'off',
    });
  });

  test('keeps valid settings', () => {
    const theme = core.normalizeTheme({
      mode: 'dark',
      palette: 'black',
      scope: 'panel',
      images: 'strong',
    });

    expect(theme).toEqual({
      version: 1,
      mode: 'dark',
      palette: 'black',
      scope: 'panel',
      images: 'strong',
    });
  });

  test('replaces invalid values with defaults', () => {
    const theme = core.normalizeTheme({
      mode: 'sepia',
      palette: 'purple',
      scope: 'everywhere',
      images: 'maximum',
    });

    expect(theme.mode).toBe('light');
    expect(theme.palette).toBe('graphite');
    expect(theme.scope).toBe('site');
    expect(theme.images).toBe('off');
  });

  test('accepts non-object input', () => {
    expect(core.normalizeTheme('dark').mode).toBe('light');
    expect(core.normalizeTheme(undefined).mode).toBe('light');
  });

  test('drops unknown fields', () => {
    const theme = core.normalizeTheme({
      mode: 'dark',
      schedule: { enabled: true },
      accent: 'red',
    });

    expect(theme).not.toHaveProperty('schedule');
    expect(theme).not.toHaveProperty('accent');
  });

  test('resolves explicit light and dark modes', () => {
    expect(core.resolveTheme({ mode: 'light' }, true)).toBe('light');
    expect(core.resolveTheme({ mode: 'dark' }, false)).toBe('dark');
  });

  test('resolves system mode from the media preference', () => {
    expect(core.resolveTheme({ mode: 'system' }, true)).toBe('dark');
    expect(core.resolveTheme({ mode: 'system' }, false)).toBe('light');
  });

  test('builds dataset attributes', () => {
    expect(
      core.themeDataset({ mode: 'system', palette: 'black', scope: 'panel', images: 'soft' }, true),
    ).toEqual({
      lsTheme: 'dark',
      lsPalette: 'black',
      lsScope: 'panel',
      lsImages: 'soft',
    });
  });

  test('does not mutate the default theme', () => {
    const theme = core.normalizeTheme(null);
    theme.mode = 'dark';

    expect(core.DEFAULT_THEME.mode).toBe('light');
  });
});
