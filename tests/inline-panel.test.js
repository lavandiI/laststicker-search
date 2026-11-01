/**
 * Unit tests for parseImagesFromHtml function
 */

const fs = require('fs');
const path = require('path');
const {
  parseImagesFromHtml,
  parseUserMessageFromElement,
  extractMessagesFromTalkDocument,
} = require('../inline-panel');

const talkFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'talk-page.html'),
  'utf8',
);

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
    expect(result[0].description).toBe('https://example.com/images/photo123.jpg');
  });

  test('should parse image with base64 src', () => {
    const html =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">';
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
    expect(result[0].description).toBe('https://example.com/1.jpg');
    expect(result[1].description).toBe('https://example.com/2.png');
  });

  test('should handle relative URL src', () => {
    const html = '<img src="/uploads/sticker.png">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe('/uploads/sticker.png');
    expect(result[0].description).toBe('/uploads/sticker.png');
  });

  test('parses a talk fixture with ids, partner and image text', () => {
    const doc = new DOMParser().parseFromString(talkFixture, 'text/html');
    const messages = extractMessagesFromTalkDocument(
      doc,
      'Анна',
      '41292',
      'https://www.laststicker.ru/users/my_talks/41292/',
    );

    expect(messages).toHaveLength(6);
    expect(messages[0].messageId).toBe('101');
    expect(messages[0].partner).toBe('Анна');
    expect(messages[0].talkId).toBe('41292');
    expect(messages[2].text).toContain('[Image: /uploads/sticker.png]');
    expect(messages[5].text).toBe('<img src=x onerror=alert(1)>');
  });

  test('keeps the default partner for a self message', () => {
    const doc = new DOMParser().parseFromString(talkFixture, 'text/html');
    const message = parseUserMessageFromElement(doc.getElementById('msg_102'), 'Анна');

    expect(message.partner).toBe('Анна');
    expect(message.messageId).toBe('102');
  });

  test('should handle base64 with different formats', () => {
    const html =
      '<img src="data:image/gif;base64,abc"><img src="data:image/jpeg;base64,def"><img src="data:image/webp;base64,ghi">';
    const result = parseImagesFromHtml(html);
    expect(result).toHaveLength(3);
    expect(result[0].description).toContain('gif');
    expect(result[1].description).toContain('jpeg');
    expect(result[2].description).toContain('webp');
  });
});
