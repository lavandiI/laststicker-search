require('../inline-ui');

describe('inline-ui filters and result links', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="content"><div class="big_text"></div></div>';
    window.InlineUI.createSearchPanel();
  });

  test('creates index/cancel/clear controls without filters or import/export', () => {
    expect(document.getElementById('ls-indexBtn')).toBeTruthy();
    expect(document.getElementById('ls-cancelBtn')).toBeTruthy();
    expect(document.getElementById('ls-clearBtn')).toBeTruthy();
    expect(document.getElementById('ls-exportBtn')).toBeNull();
    expect(document.getElementById('ls-importBtn')).toBeNull();
    expect(document.getElementById('ls-partnerFilter')).toBeNull();
    expect(document.getElementById('ls-imagesOnly')).toBeNull();
  });

  test('adds accessible labels and index metadata', () => {
    const searchInput = document.getElementById('ls-searchInput');
    expect(searchInput.getAttribute('aria-label')).toBe('Поиск по сообщениям');
    expect(searchInput.getAttribute('aria-controls')).toBe('ls-results');
    expect(document.getElementById('ls-results').getAttribute('aria-label')).toBe(
      'Результаты поиска',
    );
    expect(document.getElementById('ls-indexSize')).toBeTruthy();
    expect(document.getElementById('ls-staleBanner')).toBeTruthy();
    expect(document.getElementById('ls-readNotice')).toBeTruthy();
    expect(document.getElementById('ls-indexErrors')).toBeTruthy();
    expect(document.getElementById('ls-autoEnabled')).toBeTruthy();
    expect(document.getElementById('ls-autoStatus')).toBeTruthy();
  });

  test('formats the index size and warns near the quota', () => {
    window.InlineUI.renderIndexSize(0);
    expect(document.getElementById('ls-indexSize').textContent).toBe('0 Б');

    window.InlineUI.renderIndexSize(3.4 * 1024 * 1024);
    expect(document.getElementById('ls-indexSize').textContent).toBe('3,4 МБ');
    expect(document.getElementById('ls-indexSize').classList.contains('ls-stat-warning')).toBe(
      false,
    );

    window.InlineUI.renderIndexSize(9 * 1024 * 1024);
    expect(document.getElementById('ls-indexSize').classList.contains('ls-stat-warning')).toBe(
      true,
    );
  });

  test('shows and hides the stale-index banner', () => {
    window.InlineUI.showStaleBanner(8);
    const banner = document.getElementById('ls-staleBanner');
    expect(banner.hidden).toBe(false);
    expect(document.getElementById('ls-staleText').textContent).toContain('8 дней');

    window.InlineUI.showStaleBanner(1);
    expect(document.getElementById('ls-staleText').textContent).toContain('1 день');

    window.InlineUI.showStaleBanner(2);
    expect(document.getElementById('ls-staleText').textContent).toContain('2 дня');

    window.InlineUI.hideStaleBanner();
    expect(banner.hidden).toBe(true);
  });

  test('shows and hides the read-marking notice', () => {
    const notice = document.getElementById('ls-readNotice');
    window.InlineUI.showReadNotice();
    expect(notice.hidden).toBe(false);
    window.InlineUI.hideReadNotice();
    expect(notice.hidden).toBe(true);
  });

  test('keeps the status visible when the results are re-rendered', () => {
    window.InlineUI.showStatus('Готово', 'success');
    const status = document.getElementById('ls-status');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('Готово');

    window.InlineUI.renderEmptyState('no-query');
    expect(status.textContent).toBe('Готово');
  });

  test('renders indexing errors as text without executing HTML', () => {
    window.InlineUI.renderIndexErrors([
      '<img src=x onerror="window.__xss=1">',
      'dialogue 42: HTTP 500',
    ]);

    const box = document.getElementById('ls-indexErrors');
    expect(box.hidden).toBe(false);
    expect(box.querySelector('img')).toBeNull();
    expect(box.textContent).toContain('<img src=x');
    expect(box.textContent).toContain('dialogue 42');
    expect(document.getElementById('ls-retryBtn')).toBeTruthy();
    expect(box.querySelector('details')).toBeTruthy();

    window.InlineUI.clearIndexErrors();
    expect(box.hidden).toBe(true);
    expect(box.innerHTML).toBe('');
  });

  test('renders a clickable result, its index and a load-more button', () => {
    window.InlineUI.renderResults(
      [
        {
          partner: 'Анна',
          text: 'hello world',
          timestamp: 1690000000000,
          url: 'https://www.laststicker.ru/users/my_talks/1/page2/',
          messageId: '10',
        },
      ],
      'hello',
      250,
      200,
      true,
    );

    const link = document.querySelector('.ls-result-item');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(
      'https://www.laststicker.ru/users/my_talks/1/page2/#msg_10',
    );
    expect(link.getAttribute('target')).toBeNull();
    expect(link.dataset.resultIndex).toBe('0');
    expect(link.id).toBe('ls-result-0');
    expect(link.getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('ls-loadMoreBtn')).toBeTruthy();
  });
});
