const fakeIndexedDB = require('fake-indexeddb');

global.indexedDB = fakeIndexedDB.indexedDB;
global.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
window.indexedDB = fakeIndexedDB.indexedDB;
window.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
global.structuredClone = global.structuredClone || ((value) => JSON.parse(JSON.stringify(value)));
window.structuredClone = global.structuredClone;

const storage = require('../forum-storage');

function comment(overrides = {}) {
  return {
    key: 'forum:1:1',
    kind: 'comment',
    postId: '1',
    commentId: '1',
    topicTitle: 'Тема',
    category: 'Футбол',
    categoryPath: '/blog/football/',
    author: 'Автор',
    authorId: '10',
    city: 'Москва',
    timestamp: 100,
    text: 'Есть пакетик запечатаный',
    page: 1,
    pageParam: 0,
    url: 'https://www.laststicker.ru/blog/post1/#c1',
    ...overrides,
  };
}

describe('forum storage', () => {
  beforeEach(async () => {
    await storage.deleteDatabase();
  });

  afterAll(async () => {
    await storage.closeDb();
  });

  test('stores and searches comments with a topic filter', async () => {
    await storage.putComments(
      [
        comment({ key: 'forum:1:1', commentId: '1', timestamp: 100 }),
        comment({
          key: 'forum:1:2',
          commentId: '2',
          timestamp: 200,
          text: 'Другой пакетик',
        }),
        comment({
          key: 'forum:2:3',
          postId: '2',
          commentId: '3',
          timestamp: 300,
          text: 'Посторонняя тема',
        }),
        comment({
          key: 'forum:1:4',
          commentId: '4',
          topicTitle: 'УникальныйЗаголовок',
          timestamp: 400,
          text: 'обычный текст',
        }),
      ],
      0,
    );

    const all = await storage.searchComments('пакетик');
    expect(all.total).toBe(2);
    expect(all.results.map((item) => item.commentId)).toEqual(['2', '1']);

    const topic = await storage.searchComments('пакетик', { postId: '1' });
    expect(topic.total).toBe(2);
    expect(topic.results.every((item) => item.postId === '1')).toBe(true);

    const limited = await storage.searchComments('пакетик', {
      postId: '1',
      limit: 1,
    });
    expect(limited.results).toHaveLength(1);
    expect(limited.hasMore).toBe(true);

    const titleOnly = await storage.searchComments('УникальныйЗаголовок');
    expect(titleOnly.total).toBe(0);
  });

  test('returns statistics and topic metadata', async () => {
    await storage.putComments(
      [comment({ key: 'forum:1:1' }), comment({ key: 'forum:1:2', commentId: '2' })],
      0,
    );
    await storage.putTopic(
      {
        postId: '1',
        title: 'Тема',
        category: 'Футбол',
        indexedComments: 2,
        lastPageParam: 0,
        lastCompletePageParam: 0,
        complete: true,
      },
      0,
    );

    const stats = await storage.getStats('1');
    expect(stats.messagesCount).toBe(2);
    expect(stats.topicsCount).toBe(1);
    expect(stats.topic).toMatchObject({
      postId: '1',
      title: 'Тема',
      indexedComments: 2,
      complete: true,
    });
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  test('bumps generation without deleting existing comments', async () => {
    await storage.putComments([comment()], 0);
    const before = await storage.getGeneration();

    await storage.bumpGeneration();

    expect(await storage.getGeneration()).toBe(before + 1);
    expect(await storage.countComments()).toBe(1);
  });

  test('rejects writes after the index was cleared', async () => {
    await storage.putComments([comment()], 0);
    await storage.clearAll();

    expect(await storage.getGeneration()).toBe(1);
    expect(await storage.countComments()).toBe(0);
    expect((await storage.getStats('')).sizeBytes).toBe(0);

    await expect(storage.putComments([comment()], 0)).rejects.toThrow('очищен');
    expect(await storage.countComments()).toBe(0);
  });

  test('deletes a single topic without touching other topics', async () => {
    await storage.putComments(
      [
        comment({ key: 'forum:1:1', postId: '1', commentId: '1' }),
        comment({ key: 'forum:2:2', postId: '2', commentId: '2' }),
      ],
      0,
    );
    await storage.putTopic({ postId: '1', title: 'One' }, 0);
    await storage.putTopic({ postId: '2', title: 'Two' }, 0);

    await storage.deleteTopic('1');

    expect(await storage.countComments()).toBe(1);
    expect(await storage.countTopics()).toBe(1);
    expect(await storage.getTopic('1')).toBeNull();
    expect((await storage.getTopic('2')).title).toBe('Two');
  });
});
