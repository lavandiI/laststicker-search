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
    expect(document.getElementById('ls-loadMoreBtn')).toBeTruthy();
  });
});
