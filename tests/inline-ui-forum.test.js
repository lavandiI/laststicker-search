require('../inline-ui');

describe('forum inline UI', () => {
  beforeAll(() => {
    document.body.innerHTML = `
      <div id="content">
        <h1>Форум коллекционеров</h1>
        <p class="big_text"><b>Важные темы:</b> <a href="/blog/post15/">Черный список</a></p>
        <div class="line"></div>
        <p class="big_text">
          <b>Обсуждаемые темы</b>&nbsp;&nbsp; | &nbsp;&nbsp;
          <a href="/blog/forum/new/">Новые темы</a>
        </p>
        <div class="forum_list"></div>
      </div>
    `;
    window.InlineUI.createForumSearchPanel({
      postId: '',
      isTopicPage: false,
    });
  });

  test('inserts the forum panel under the dashed line and above the topic list', () => {
    const panel = document.getElementById('ls-forum-panel');
    expect(panel.previousElementSibling.classList.contains('line')).toBe(true);
    expect(panel.nextElementSibling.textContent).toContain('Обсуждаемые темы');
  });

  test('creates a separate forum panel with controls', () => {
    expect(document.getElementById('ls-forum-panel')).toBeTruthy();
    expect(document.getElementById('ls-forumIndexBtn')).toBeTruthy();
    expect(document.getElementById('ls-forumReindexBtn')).toBeNull();
    expect(document.getElementById('ls-forumClearBtn').textContent).toBe('Очистить');
    expect(document.getElementById('ls-forumClearBtn').title).toContain('индекс форума');
    expect(document.querySelector('#ls-forum-panel .ls-stats').hidden).toBe(false);
    expect(document.getElementById('ls-forumLastIndexed').hidden).toBe(false);
    expect(document.getElementById('ls-forumScopeCurrent')).toBeNull();
    expect(document.getElementById('ls-forumSearchInput').getAttribute('aria-label')).toBe(
      'Поиск по сообщениям форума',
    );
    expect(document.getElementById('ls-forumResults').getAttribute('aria-label')).toBe(
      'Результаты поиска по форуму',
    );
    expect(document.getElementById('ls-forumExportBtn')).toBeNull();
    expect(document.getElementById('ls-forumImportBtn')).toBeNull();
  });

  test('renders topic statistics and button states', () => {
    window.InlineUI.renderForumStats({
      topicsCount: 3,
      messagesCount: 120,
      sizeBytes: 2 * 1024 * 1024,
      lastIndexedAt: Date.now(),
      topic: {
        postId: '54672',
        indexedComments: 24,
        pageCount: 3,
        complete: true,
      },
    });

    expect(document.getElementById('ls-forumTopicCount').textContent).toBe('3');
    expect(document.getElementById('ls-forumMessageCount').textContent).toBe('120');
    expect(document.getElementById('ls-forumIndexSize').textContent).toContain('МБ');
    expect(document.getElementById('ls-forumTopicStats').hidden).toBe(false);
    expect(document.getElementById('ls-forumTopicStats').textContent).toContain('24');
    expect(document.getElementById('ls-forumIndexBtn').textContent).toBe('Обновить');
  });

  test('renders global results grouped by topic with direct links', () => {
    window.InlineUI.renderForumResults(
      [
        {
          key: 'forum:54672:637184',
          kind: 'comment',
          postId: '54672',
          commentId: '637184',
          topicTitle: 'Черный плащ, Панини',
          author: 'Dashik',
          timestamp: new Date(2013, 6, 17, 13, 37).getTime(),
          text: 'Есть 1 пакетик запечатаный',
          page: 1,
          url: 'https://www.laststicker.ru/blog/post54672/#c637184',
        },
        {
          key: 'forum:54672:1148053',
          kind: 'comment',
          postId: '54672',
          commentId: '1148053',
          topicTitle: 'Черный плащ, Панини',
          author: 'Slink',
          timestamp: new Date(2016, 11, 26, 23, 52).getTime(),
          text: 'Не издавался. Пакетик не завезли.',
          page: 2,
          url: 'https://www.laststicker.ru/blog/post54672/page1/#c1148053',
        },
      ],
      'пакетик',
      2,
      200,
      { groupByTopic: true, canLoadMore: false },
    );

    const results = document.getElementById('ls-forumResults');
    expect(results.querySelectorAll('.ls-result-item')).toHaveLength(2);
    expect(results.querySelector('.ls-forum-topic-header').textContent).toContain('Черный плащ');
    expect(results.querySelector('.ls-result-item').getAttribute('href')).toContain('#c637184');
    expect(results.querySelector('.ls-highlight').textContent.toLowerCase()).toBe('пакетик');
    expect(results.textContent).toContain('стр. 2');
  });

  test('highlights an author match when the message text has no match', () => {
    window.InlineUI.renderForumResults(
      [
        {
          key: 'forum:1:2',
          kind: 'comment',
          postId: '1',
          commentId: '2',
          topicTitle: 'Тема',
          author: 'Пресс',
          timestamp: 1,
          text: 'Текст без совпадения',
          page: 1,
          url: 'https://www.laststicker.ru/blog/post1/#c2',
        },
      ],
      'пре',
      1,
      200,
    );

    expect(
      document.querySelector('#ls-forumResults .ls-result-message .ls-highlight'),
    ).toBeNull();
    expect(
      document.querySelector('#ls-forumResults .ls-result-meta .ls-highlight')
        .textContent,
    ).toBe('Пре');
  });

  test('highlights short prefixes in message text', () => {
    window.InlineUI.renderForumResults(
      [
        {
          key: 'forum:1:1',
          kind: 'comment',
          postId: '1',
          commentId: '1',
          topicTitle: 'Тема',
          author: 'Автор',
          timestamp: 1,
          text: 'Предложение о обмене',
          page: 1,
          url: 'https://www.laststicker.ru/blog/post1/#c1',
        },
      ],
      'пре',
      1,
      200,
    );

    expect(
      document.querySelector('#ls-forumResults .ls-highlight').textContent,
    ).toBe('Пре');
  });

  test('renders empty forum states', () => {
    window.InlineUI.renderForumEmptyState('no-topic-index');
    expect(document.getElementById('ls-forumResults').textContent).toContain('не проиндексирована');

    window.InlineUI.renderForumEmptyState('no-query');
    expect(document.getElementById('ls-forumResults').textContent).toContain('Введите запрос');
  });

  test('inserts the topic panel under the last line and above comments', () => {
    document.body.innerHTML = `
      <div id="content">
        <div class="head_bg-l clearer"><div class="head_inner"><h1>Тема</h1></div></div>
        <div class="line"></div>
        <div class="album_item">Описание темы</div>
        <div class="line"></div>
        <h2 id="comments_list">Комментарии:</h2>
      </div>
    `;

    window.InlineUI.createForumSearchPanel({
      postId: '54672',
      isTopicPage: true,
    });

    const panel = document.getElementById('ls-forum-panel');
    expect(panel.previousElementSibling.classList.contains('line')).toBe(true);
    expect(panel.nextElementSibling.id).toBe('comments_list');
    expect(document.getElementById('ls-forumClearBtn').title).toContain('этой темы');
    expect(panel.querySelector('.ls-stats').hidden).toBe(true);
    expect(document.getElementById('ls-forumLastIndexed').hidden).toBe(true);
    expect(document.getElementById('ls-forumScopeCurrent')).toBeNull();

    window.InlineUI.renderForumStats({
      topicsCount: 5,
      messagesCount: 500,
      sizeBytes: 50 * 1024,
      topic: {
        postId: '54672',
        indexedComments: 24,
        pageCount: 3,
        sizeBytes: 10 * 1024,
        complete: true,
      },
    });

    const topicStats = document.getElementById('ls-forumTopicStats');
    expect(topicStats.hidden).toBe(false);
    expect(topicStats.textContent).toContain('В теме: 24 сообщений');
    expect(topicStats.textContent).toContain('индекс 10 КБ');
  });
});
