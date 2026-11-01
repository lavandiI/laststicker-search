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
    expect(panel.nextElementSibling.textContent).toContain(
      'Обсуждаемые темы',
    );
  });

  test('creates a separate forum panel with controls and scope', () => {
    expect(document.getElementById('ls-forum-panel')).toBeTruthy();
    expect(document.getElementById('ls-forumIndexBtn')).toBeTruthy();
    expect(document.getElementById('ls-forumReindexBtn')).toBeTruthy();
    expect(document.getElementById('ls-forumClearBtn')).toBeTruthy();
    expect(document.getElementById('ls-forumScopeCurrent')).toBeTruthy();
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
    expect(document.getElementById('ls-forumReindexBtn').hidden).toBe(false);
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

  test('renders empty forum states', () => {
    window.InlineUI.renderForumEmptyState('no-topic-index');
    expect(document.getElementById('ls-forumResults').textContent).toContain('не проиндексирована');

    window.InlineUI.renderForumEmptyState('no-query');
    expect(document.getElementById('ls-forumResults').textContent).toContain('Введите запрос');
  });
});
