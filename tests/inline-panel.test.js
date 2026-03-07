/**
 * Unit tests for parseImagesFromHtml function
 */

global.DOMParser = require('jsdom').DOMParser;

const { parseImagesFromHtml } = require('./inline-panel');

describe('parseImagesFromHtml', () => {
  test('should return empty array when no images', () => {
    const html = '<div>Hello world</div>';
    const result = parseImagesFromHtml(html);
    expect(result).toEqual([]);
  });

  test('should parse image with URL src', () => {
    const html = '<img src="https://example.com/images/photo123.jpg">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('image');
    expect(result[0].src).toBe('https://example.com/images/photo123.jpg');
    expect(result[0].description).toBe('photo123.jpg');
  });

  test('should parse image with base64 src', () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('image');
    expect(result[0].src).toBe('base64');
    expect(result[0].description).toContain('Base64 png');
    expect(result[0].description).toContain('chars');
  });

  test('should handle empty src attribute', () => {
    const html = '<img src="">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].src).toBeNull();
    expect(result[0].description).toBe('[Empty src]');
  });

  test('should handle missing src attribute', () => {
    const html = '<img alt="test">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].src).toBeNull();
    expect(result[0].description).toBe('[Empty src]');
  });

  test('should handle multiple images', () => {
    const html = '<img src="https://example.com/1.jpg"><img src="https://example.com/2.png">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('1.jpg');
    expect(result[1].description).toBe('2.png');
  });

  test('should handle relative URL src', () => {
    const html = '<img src="/uploads/sticker.png">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe('/uploads/sticker.png');
    expect(result[0].description).toBe('sticker.png');
  });

  test('should handle base64 with different formats', () => {
    const html = '<img src="data:image/gif;base64,abc"><img src="data:image/jpeg;base64,def"><img src="data:image/webp;base64,ghi">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(3);
    expect(result[0].description).toContain('gif');
    expect(result[1].description).toContain('jpeg');
    expect(result[2].description).toContain('webp');
  });
});
