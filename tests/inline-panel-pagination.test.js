const { fetchAllTalkPages, getTalkBasePath, dedupeTalkMessages } = require('../inline-panel');

function messageHtml(id, text, partner = 'partner', date = '01.01.2026 10:00') {
  return (
    `<div class="user_message">` +
    `<div id="msg_${id}"><span>${date}</span>, <a href="/users/2/">${partner}</a><br>City</div>` +
    `<div class="big_text clearer">${text}</div>` +
    `</div>`
  );
}

function pageHtml(messages) {
  return `<html><body>${messages.join('')}</body></html>`;
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

    const pages = {
      'http://localhost/users/my_talks/41292/': pageHtml([
        messageHtml(1, 'one'),
        messageHtml(2, 'two'),
      ]),
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
