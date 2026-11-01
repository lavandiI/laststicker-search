const fs = require('fs');
const path = require('path');
const parser = require('../forum-parser');

function loadFixture(name) {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('forum parser', () => {
  test('parses topic metadata, first post and pagination', () => {
    const doc = loadFixture('forum-topic.html');
    const meta = parser.parseForumTopicMeta(doc, { postId: '54672' });

    expect(meta).toMatchObject({
      postId: '54672',
      title: 'Черный плащ, Панини',
      category: 'Мультфильмы и Кино',
      categoryPath: '/blog/ent/',
      author: 'Dashik',
      authorId: '5793',
      city: 'Москва',
      lastPage: 2,
      pageCount: 3,
    });
    expect(meta.createdAt).toEqual(expect.any(Number));
    expect(meta.firstPostText).toContain('Коллекция посвящена');
    expect(meta.tags).toEqual(['наклейки', 'panini']);
  });

  test('parses comments, authors, dates, replies and images', () => {
    const doc = loadFixture('forum-topic.html');
    const comments = parser.extractForumCommentsFromDocument(doc, {
      postId: '54672',
      topicTitle: 'Черный плащ, Панини',
      category: 'Мультфильмы и Кино',
      categoryPath: '/blog/ent/',
      page: 1,
    });

    expect(comments).toHaveLength(3);
    expect(comments[0]).toMatchObject({
      key: 'forum:54672:637184',
      postId: '54672',
      commentId: '637184',
      author: 'Dashik',
      authorId: '5793',
      city: 'Москва',
      page: 1,
      pageParam: 0,
      url: 'https://www.laststicker.ru/blog/post54672/#c637184',
    });
    expect(comments[0].text).toContain('пакетик');
    expect(comments[0].timestamp).toEqual(expect.any(Number));

    expect(comments[1].replyTo).toEqual({
      author: 'Rialto',
      commentId: '1147994',
    });
    expect(comments[2].hasImages).toBe(true);
    expect(comments[2].text).toContain('авито');
  });

  test('builds direct links without the page offset mistake', () => {
    expect(parser.buildForumCommentUrl('712', 1, '8500')).toBe(
      'https://www.laststicker.ru/blog/post712/#c8500',
    );
    expect(parser.buildForumCommentUrl('712', 2, '9396')).toBe(
      'https://www.laststicker.ru/blog/post712/page1/#c9396',
    );
    expect(parser.buildForumCommentUrl('712', 2197, '2264936')).toBe(
      'https://www.laststicker.ru/blog/post712/page2196/#c2264936',
    );
  });

  test('parses forum index cards', () => {
    const doc = loadFixture('forum-index.html');
    const topics = parser.extractForumTopicsFromDocument(doc);

    expect(topics).toHaveLength(2);
    expect(topics[0]).toMatchObject({
      postId: '54672',
      title: 'Черный плащ, Панини',
      category: 'Мультфильмы и Кино',
      categoryPath: '/blog/ent/',
      author: 'Dashik',
      commentCount: 24,
    });
    expect(topics[1].commentCount).toBe(0);
    expect(topics[0].lastActivityAt).toEqual(expect.any(Number));
    expect(parser.getLastForumPage(doc)).toBe(145);
  });

  test('parses full and short Russian dates with year rollover', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 12, 0, 0));

    expect(parser.parseForumDate('17 июля 2013 13:37')).toBe(
      new Date(2013, 6, 17, 13, 37).getTime(),
    );
    expect(parser.parseForumDate('30 октября 03:36')).toBe(new Date(2026, 9, 30, 3, 36).getTime());
    expect(parser.parseForumDate('26 декабря 23:52')).toBe(
      new Date(2025, 11, 26, 23, 52).getTime(),
    );
    expect(parser.parseForumDate('not a date')).toBeNull();

    jest.useRealTimers();
  });

  test('detects forum topic paths and page params', () => {
    expect(parser.getForumTopicIdFromPath('/blog/post712/')).toBe('712');
    expect(parser.getForumTopicIdFromPath('/blog/post712/page100/')).toBe('712');
    expect(parser.getForumTopicIdFromPath('/blog/post/')).toBe('');
    expect(parser.getForumPageParamFromPath('/blog/post712/page100/')).toBe(100);
    expect(parser.isForumTopicPath('/blog/post712/')).toBe(true);
    expect(parser.isForumTopicPath('/blog/forum/')).toBe(false);
  });
});
