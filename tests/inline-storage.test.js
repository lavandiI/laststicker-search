require('../inline-storage');

describe('inline-storage', () => {
  const { mergeMessages, getStats, normalizeMessage } = window.InlineStorage;

  test('upgrades a legacy record to an id-keyed record without duplicating it', () => {
    const legacy = { talkId: '1', text: 'hello', partner: 'p', timestamp: 1 };
    const withId = {
      talkId: '1',
      messageId: '10',
      text: 'hello',
      partner: 'p',
      timestamp: 1,
    };

    const merged = mergeMessages([legacy], [withId]);

    expect(merged).toHaveLength(1);
    expect(merged[0].messageId).toBe('10');
  });

  test('keeps two messages with the same text but different IDs', () => {
    const first = { talkId: '1', messageId: '10', text: 'same', partner: 'p', timestamp: 1 };
    const second = { talkId: '1', messageId: '11', text: 'same', partner: 'p', timestamp: 1 };

    const merged = mergeMessages([], [first, second]);

    expect(merged).toHaveLength(2);
  });

  test('upgrades 79 legacy messages and adds the missing 80th without duplicates', () => {
    const existing = Array.from({ length: 79 }, (_, index) => ({
      talkId: '81159',
      text: `message ${index}`,
      partner: 'p',
      timestamp: index,
    }));
    const incoming = Array.from({ length: 80 }, (_, index) => ({
      talkId: '81159',
      messageId: String(1000 + index),
      text: `message ${index}`,
      partner: 'p',
      timestamp: index,
    }));

    const merged = mergeMessages(existing, incoming);

    expect(merged).toHaveLength(80);
    expect(merged.every((message) => message.messageId)).toBe(true);
  });

  test('normalizes legacy non-www laststicker URLs', () => {
    const message = normalizeMessage({
      text: 'hello',
      url: 'https://laststicker.ru/users/my_talks/1/',
    });

    expect(message.url).toBe('https://www.laststicker.ru/users/my_talks/1/');
  });

  test('counts dialogs by talkId, not by partner', () => {
    const messages = [
      { talkId: '1', partner: 'p', text: 'a' },
      { talkId: '2', partner: 'p', text: 'b' },
    ];

    const stats = getStats(messages);

    expect(stats.dialogsCount).toBe(2);
    expect(stats.partnersCount).toBe(1);
    expect(stats.messagesCount).toBe(2);
  });
});
