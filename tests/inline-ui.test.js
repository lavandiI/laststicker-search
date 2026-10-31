require('../inline-ui');

describe('inline-ui filters and result links', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="content"><div class="big_text"></div></div>';
    window.InlineUI.createSearchPanel();
  });

  test('creates import/export and cancel buttons but no filters', () => {
    expect(document.getElementById('ls-exportBtn')).toBeTruthy();
    expect(document.getElementById('ls-importBtn')).toBeTruthy();
    expect(document.getElementById('ls-cancelBtn')).toBeTruthy();
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
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.dataset.resultIndex).toBe('0');
    expect(document.getElementById('ls-loadMoreBtn')).toBeTruthy();
  });
});
