const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'),
);
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

describe('manifest', () => {
  test('does not request the tabs permission', () => {
    expect(manifest.permissions).not.toContain('tabs');
  });

  test('keeps only the permissions justified in the privacy policy', () => {
    expect(manifest.permissions.sort()).toEqual(['scripting', 'storage']);
  });

  test('version matches package.json', () => {
    expect(manifest.version).toBe(pkg.version);
  });
});
