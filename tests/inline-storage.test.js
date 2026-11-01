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

  test('remembers that the read-marking notice was dismissed', async () => {
    localStorage.clear();
    expect(await window.InlineStorage.loadReadNoticeSeen()).toBe(false);

    await window.InlineStorage.saveReadNoticeSeen();
    expect(await window.InlineStorage.loadReadNoticeSeen()).toBe(true);

    localStorage.clear();
  });

  test('enables automatic refresh by default and remembers a change', async () => {
    localStorage.clear();
    expect(await window.InlineStorage.loadAutoEnabled()).toBe(true);

    await window.InlineStorage.saveAutoEnabled(false);
    expect(await window.InlineStorage.loadAutoEnabled()).toBe(false);

    localStorage.clear();
  });

  test('migrates an existing non-empty index to a complete index', async () => {
    localStorage.clear();
    localStorage.setItem(
      'ls_search_messages',
      JSON.stringify([{ talkId: '1', messageId: '2', text: 'hello', partner: 'p' }]),
    );
    localStorage.setItem('ls_search_last_indexed_at', '123');

    expect(await window.InlineStorage.ensureFullIndexFlag()).toBe(true);
    expect(await window.InlineStorage.loadFullIndexAt()).toBe(123);

    localStorage.clear();
  });

  test('reports the index size from the stored payload', async () => {
    localStorage.clear();
    localStorage.setItem('ls_search_messages', JSON.stringify([{ text: 'hello' }]));

    const bytes = await window.InlineStorage.getIndexBytes();

    expect(bytes).toBeGreaterThan(0);
    localStorage.clear();
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
