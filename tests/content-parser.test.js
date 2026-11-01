const fs = require('fs');
const path = require('path');

const {
  parseUserMessage,
  parseDate,
  extractMessagesFromTalkDocument,
  buildTalkMessageKey,
  dedupeTalkMessages,
} = require('../content');

const fixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'talk-page.html'),
  'utf8',
);

function parseFixture() {
  return new DOMParser().parseFromString(fixture, 'text/html');
}

describe('content parser', () => {
  test('extracts message id, partner, date and text', () => {
    const doc = parseFixture();
    const element = doc.getElementById('msg_101');

    const message = parseUserMessage(element, 'Анна');

    expect(message.messageId).toBe('101');
    expect(message.partner).toBe('Анна');
    expect(message.text).toBe('Здравствуйте! Есть ли у вас наклейки для обмена?');
    expect(message.timestamp).toBe(new Date(2025, 9, 31, 11, 40).getTime());
  });

  test('keeps the default partner for messages from the current account', () => {
    const doc = parseFixture();
    const element = doc.getElementById('msg_102');

    const message = parseUserMessage(element, 'Анна');

    expect(message.partner).toBe('Анна');
    expect(message.text).toBe('Да, есть несколько наборов.');
  });

  test('appends image URLs to the message text', () => {
    const doc = parseFixture();
    const element = doc.getElementById('msg_103');

    const message = parseUserMessage(element, 'Анна');

    expect(message.text).toContain('Фото:');
    expect(message.text).toContain('[Image: /uploads/sticker.png]');
  });

  test('keeps HTML-looking text as text', () => {
    const doc = parseFixture();
    const element = doc.getElementById('msg_106');

    const message = parseUserMessage(element, 'Анна');

    expect(message.text).toBe('<img src=x onerror=alert(1)>');
    expect(doc.querySelectorAll('img')).toHaveLength(1);
  });

  test('extracts every message with talk id and page URL', () => {
    const doc = parseFixture();
    const messages = extractMessagesFromTalkDocument(
      doc,
      'Анна',
      '41292',
      'https://www.laststicker.ru/users/my_talks/41292/page2/',
    );

    expect(messages).toHaveLength(6);
    expect(messages[0].talkId).toBe('41292');
    expect(messages[0].url).toBe(
      'https://www.laststicker.ru/users/my_talks/41292/page2/',
    );
    expect(messages.every((message) => message.messageId)).toBe(true);
  });

  test('keeps equal text with different message ids after deduplication', () => {
    const doc = parseFixture();
    const messages = extractMessagesFromTalkDocument(doc, 'Анна', '41292', 'https://x/');
    const duplicates = messages.filter(
      (message) => message.messageId === '104' || message.messageId === '105',
    );

    expect(buildTalkMessageKey(duplicates[0])).not.toBe(buildTalkMessageKey(duplicates[1]));
    expect(dedupeTalkMessages(duplicates)).toHaveLength(2);
  });

  test('parses Russian dates with a two-digit year', () => {
    expect(parseDate('31.10.25 11:40')).toBe(new Date(2025, 9, 31, 11, 40).getTime());
    expect(parseDate('01.01.99 00:05')).toBe(new Date(1999, 0, 1, 0, 5).getTime());
    expect(parseDate('не дата')).toBeNull();
  });
});
