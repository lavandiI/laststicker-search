const parser = require('../forum-parser');

function pageHtml(commentId, text) {
  return `
    <div id="content">
      <div class="forum_top">
        <div class="forum_left">
          <a href="/users/1/">Author</a>
          <span>1 января 2026 10:00</span>
          <br>Москва
        </div>
        <div class="forum_right"><a href="/blog/football/">Футбол</a></div>
      </div>
      <h1>Тестовая тема</h1>
      <div class="forum_annotation">Первое сообщение темы</div>
      <dl class="comment_new" id="comment${commentId}">
        <dt><div class="left"><a href="/users/2/">User</a><span>Москва</span> - 2 января 2026 12:00</div></dt>
        <dd><div id="comment_txt${commentId}">${text}</div></dd>
      </dl>
      <div id="pages"><a href="/blog/post1/page1/#comments_list">2</a></div>
    </div>
  `;
}

describe('forum indexer', () => {
  let comments;
  let topic;
  let metadata;
  let fetchMock;

  beforeAll(() => {
    comments = [];
    topic = null;
    metadata = {};
    fetchMock = {
      fetchWithRetry: jest.fn(async (url) => ({
        ok: true,
        text: async () =>
          String(url).includes('/page1/')
            ? pageHtml('2', 'Второе сообщение')
            : pageHtml('1', 'Первое сообщение'),
      })),
    };

    global.LSForumParser = parser;
    global.LSFetch = fetchMock;
    global.LSForumStorage = {
      getGeneration: jest.fn(async () => 0),
      getTopic: jest.fn(async () => topic),
      deleteTopic: jest.fn(async () => {
        comments = [];
        topic = null;
      }),
      putComments: jest.fn(async (items) => {
        comments.push(...items);
      }),
      putTopic: jest.fn(async (value) => {
        topic = value;
      }),
      countCommentsByPost: jest.fn(async () => comments.length),
      getTopicSize: jest.fn(async () =>
        comments.reduce((sum, item) => sum + JSON.stringify(item).length, 0),
      ),
      setMeta: jest.fn(async (key, value) => {
        metadata[key] = value;
      }),
    };
  });

  test('builds base and page URLs without the forum page offset mistake', () => {
    const indexer = require('../forum-indexer');
    expect(indexer.buildPageUrl('712', 0)).toBe('https://www.laststicker.ru/blog/post712/');
    expect(indexer.buildPageUrl('712', 1)).toBe('https://www.laststicker.ru/blog/post712/page1/');
  });

  test('indexes the first post and all comment pages', async () => {
    const indexer = require('../forum-indexer');
    const result = await indexer.indexTopic({
      jobId: 'test-job',
      postId: '1',
      mode: 'topic',
    });

    expect(result.complete).toBe(true);
    expect(result.messageCount).toBe(3);
    expect(fetchMock.fetchWithRetry).toHaveBeenCalledTimes(2);
    expect(comments.some((item) => item.kind === 'post')).toBe(true);
    expect(comments.some((item) => item.text === 'Второе сообщение')).toBe(true);
    expect(topic).toMatchObject({
      postId: '1',
      title: 'Тестовая тема',
      lastPageParam: 1,
      lastCompletePageParam: 1,
      lastCommentId: '2',
      complete: true,
    });
    expect(metadata.lastIndexedAt).toEqual(expect.any(Number));
  });

  test('does not write anything when the topic has no new messages', async () => {
    const indexer = require('../forum-indexer');
    fetchMock.fetchWithRetry.mockClear();
    LSForumStorage.putComments.mockClear();
    LSForumStorage.putTopic.mockClear();
    const commentsBefore = comments.length;
    const topicBefore = { ...topic };

    const result = await indexer.indexTopic({
      jobId: 'no-change',
      postId: '1',
      mode: 'update',
    });

    expect(result.noChanges).toBe(true);
    expect(fetchMock.fetchWithRetry).toHaveBeenCalledTimes(2);
    expect(comments).toHaveLength(commentsBefore);
    expect(topic).toEqual(topicBefore);
    expect(LSForumStorage.putComments).not.toHaveBeenCalled();
    expect(LSForumStorage.putTopic).not.toHaveBeenCalled();
  });
});
