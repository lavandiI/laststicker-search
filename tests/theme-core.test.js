const core = require('../theme-core.js');

describe('theme core', () => {
  test('defaults to a disabled graphite theme', () => {
    expect(core.normalizeTheme(null)).toEqual({
      version: 1,
      enabled: false,
      palette: 'graphite',
      images: 'off',
    });
  });

  test('keeps valid settings', () => {
    const theme = core.normalizeTheme({
      enabled: true,
      palette: 'black',
      images: 'strong',
    });

    expect(theme).toEqual({
      version: 1,
      enabled: true,
      palette: 'black',
      images: 'strong',
    });
  });

  test('replaces invalid values with defaults', () => {
    const theme = core.normalizeTheme({
      enabled: 'yes',
      palette: 'purple',
      images: 'maximum',
    });

    expect(theme.enabled).toBe(false);
    expect(theme.palette).toBe('graphite');
    expect(theme.images).toBe('off');
  });

  test('accepts non-object input', () => {
    expect(core.normalizeTheme('dark').enabled).toBe(false);
    expect(core.normalizeTheme(undefined).enabled).toBe(false);
  });

  test('drops unknown fields', () => {
    const theme = core.normalizeTheme({
      enabled: true,
      scope: 'panel',
      accent: 'red',
    });

    expect(theme).not.toHaveProperty('scope');
    expect(theme).not.toHaveProperty('accent');
  });

  test('migrates the old dark mode to enabled', () => {
    expect(core.normalizeTheme({ mode: 'dark' }).enabled).toBe(true);
    expect(core.normalizeTheme({ mode: 'light' }).enabled).toBe(false);
    expect(core.normalizeTheme({ mode: 'system' }).enabled).toBe(false);
  });

  test('resolves the theme from the switch', () => {
    expect(core.resolveTheme({ enabled: true })).toBe('dark');
    expect(core.resolveTheme({ enabled: false })).toBe('light');
  });

  test('builds dataset attributes', () => {
    expect(core.themeDataset({ enabled: true, palette: 'black', images: 'soft' })).toEqual({
      lsTheme: 'dark',
      lsPalette: 'black',
      lsImages: 'soft',
    });
  });

  test('does not mutate the default theme', () => {
    const theme = core.normalizeTheme(null);
    theme.enabled = true;

    expect(core.DEFAULT_THEME.enabled).toBe(false);
  });
});
