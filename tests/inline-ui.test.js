require('../inline-ui');

describe('inline-ui filters and result links', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="content"><div class="big_text"></div></div>';
    window.InlineUI.createSearchPanel();
  });

  test('creates the partner filter, import/export and cancel buttons', () => {
    expect(document.getElementById('ls-partnerFilter')).toBeTruthy();
    expect(document.getElementById('ls-imagesOnly')).toBeTruthy();
    expect(document.getElementById('ls-exportBtn')).toBeTruthy();
    expect(document.getElementById('ls-importBtn')).toBeTruthy();
    expect(document.getElementById('ls-cancelBtn')).toBeTruthy();
  });

  test('fills the partner filter with unique sorted partners', () => {
    window.InlineUI.renderPartnerFilter([
      { partner: 'Борис', text: 'a' },
      { partner: 'Анна', text: 'b' },
      { partner: 'Анна', text: 'c' },
    ]);

    const select = document.getElementById('ls-partnerFilter');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Все собеседники',
      'Анна',
      'Борис',
    ]);
  });

  test('renders a clickable result and a load-more button', () => {
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
    expect(document.getElementById('ls-loadMoreBtn')).toBeTruthy();
  });
});
