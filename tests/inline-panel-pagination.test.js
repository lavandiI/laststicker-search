const {
  fetchAllTalkPages,
  getTalkBasePath,
  dedupeTalkMessages,
  resolveMessageTarget,
} = require('../inline-panel');

function messageHtml(id, text, partner = 'partner', date = '01.01.2026 10:00') {
  return (
    `<div class="user_message">` +
    `<div id="msg_${id}"><span>${date}</span>, <a href="/users/2/">${partner}</a><br>City</div>` +
    `<div class="big_text clearer">${text}</div>` +
    `</div>`
  );
}

function pageHtml(messages, lastPage = 0, talkId = '41292') {
  const pages = lastPage
    ? `<div id="pages">${Array.from(
        { length: lastPage },
        (_, index) =>
          `<a href="/users/my_talks/${talkId}/page${index + 1}/" class="page">${index + 2}</a>`,
      ).join('')}</div>`
    : '';

  return `<html><body>${messages.join('')}${pages}</body></html>`;
}

describe('fetchAllTalkPages', () => {
  const originalXHR = window.XMLHttpRequest;
  const originalPath = window.location.pathname;

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
    global.XMLHttpRequest = originalXHR;
    window.history.replaceState({}, '', originalPath);
  });

  test('walks pageN until an empty page and deduplicates messages', async () => {
    window.history.replaceState({}, '', '/users/my_talks/41292/');

    const requested = [];
    const pages = {
      'http://localhost/users/my_talks/41292/': pageHtml(
        [messageHtml(1, 'one'), messageHtml(2, 'two')],
        2,
      ),
      'http://localhost/users/my_talks/41292/page1/': pageHtml([
        messageHtml(2, 'two'),
        messageHtml(3, 'three'),
      ]),
      'http://localhost/users/my_talks/41292/page2/': pageHtml([messageHtml(4, 'four')]),
      'http://localhost/users/my_talks/41292/page3/': pageHtml([]),
    };

    // The batch requests pages past the end, but the code must not parse them.
    for (let i = 4; i <= 10; i++) {
      pages[`http://localhost/users/my_talks/41292/page${i}/`] = pageHtml([]);
    }

    class MockXHR {
      open(method, url) {
        this.url = url;
        requested.push(url);
      }

      send() {
        setTimeout(() => {
          this.status = pages[this.url] ? 200 : 404;
          this.responseText = pages[this.url] || '';
          this.onload();
        }, 0);
      }
    }

    window.XMLHttpRequest = MockXHR;
    global.XMLHttpRequest = MockXHR;

    const messages = await fetchAllTalkPages('41292');

    expect(messages.map((message) => message.text)).toEqual(['one', 'two', 'three', 'four']);
    expect(requested.some((url) => url.endsWith('/page4/'))).toBe(false);
  });

  test('keeps messages with the same text and minute when IDs differ', async () => {
    window.history.replaceState({}, '', '/users/my_talks/81159/');

    const pages = {
      'http://localhost/users/my_talks/81159/': pageHtml(
        [
          messageHtml(27737820, 'same text', 'partner', '11.07.2023 22:50'),
          messageHtml(2, 'other', 'partner', '11.07.2023 22:51'),
        ],
        1,
        '81159',
      ),
      'http://localhost/users/my_talks/81159/page1/': pageHtml([
        messageHtml(27737814, 'same text', 'partner', '11.07.2023 22:50'),
      ]),
      'http://localhost/users/my_talks/81159/page2/': pageHtml([]),
    };

    class MockXHR {
      open(method, url) {
        this.url = url;
      }

      send() {
        setTimeout(() => {
          this.status = pages[this.url] ? 200 : 404;
          this.responseText = pages[this.url] || '';
          this.onload();
        }, 0);
      }
    }

    window.XMLHttpRequest = MockXHR;
    global.XMLHttpRequest = MockXHR;

    const messages = await fetchAllTalkPages('81159');

    expect(messages.map((message) => message.text)).toEqual(['same text', 'other', 'same text']);
    expect(messages.map((message) => message.messageId)).toEqual(['27737820', '2', '27737814']);
  });
});

describe('getTalkBasePath', () => {
  test.each([
    ['/users/my_talks/41292/', '/users/my_talks/41292/'],
    ['/users/my_talks/41292/page5/', '/users/my_talks/41292/'],
    ['/users/my_talks/hide/1594/page2/', '/users/my_talks/hide/1594/'],
  ])('%s -> %s', (input, expected) => {
    expect(getTalkBasePath(input)).toBe(expected);
  });
});

describe('dedupeTalkMessages', () => {
  test('keeps the first message for each stable key', () => {
    const messages = [
      { talkId: '1', messageId: '10', text: 'first' },
      { talkId: '1', messageId: '10', text: 'duplicate' },
      { talkId: '1', text: 'legacy', partner: 'p', timestamp: 1 },
      { talkId: '1', text: 'legacy', partner: 'p', timestamp: 1 },
    ];

    expect(dedupeTalkMessages(messages)).toHaveLength(2);
  });
});

describe('resolveMessageTarget', () => {
  const originalXHR = window.XMLHttpRequest;
  const originalPath = window.location.pathname;

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
    global.XMLHttpRequest = originalXHR;
    window.history.replaceState({}, '', originalPath);
  });

  test('finds the page and message id for an old record without messageId', async () => {
    window.history.replaceState({}, '', '/users/my_talks/');

    const pages = {
      'http://localhost/users/my_talks/999/': pageHtml(
        [
          messageHtml(10, 'first', 'partner', '11.07.2023 22:48'),
          messageHtml(9, 'second', 'partner', '11.07.2023 22:49'),
        ],
        2,
        '999',
      ),
      'http://localhost/users/my_talks/999/page1/': pageHtml([
        messageHtml(8, 'third', 'partner', '11.07.2023 22:50'),
        messageHtml(7, 'fourth', 'partner', '11.07.2023 22:51'),
      ]),
      'http://localhost/users/my_talks/999/page2/': pageHtml([
        messageHtml(6, 'target', 'partner', '11.07.2023 22:52'),
      ]),
      'http://localhost/users/my_talks/999/page3/': pageHtml([]),
    };

    class MockXHR {
      open(method, url) {
        this.url = url;
      }

      send() {
        setTimeout(() => {
          this.status = pages[this.url] ? 200 : 404;
          this.responseText = pages[this.url] || '';
          this.onload();
        }, 0);
      }
    }

    window.XMLHttpRequest = MockXHR;
    global.XMLHttpRequest = MockXHR;

    const target = await resolveMessageTarget({
      talkId: '999',
      text: 'target',
      partner: 'partner',
      timestamp: null,
    });

    expect(target).toBe('http://localhost/users/my_talks/999/page2/#msg_6');
  });
});
