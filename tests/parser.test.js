const fs = require('fs');
const path = require('path');
const {
  parseUnreadParams,
  extractListPage,
  getLastLinkedTalkPage,
  parseTalkIdFromUrl,
  getSelfUserId,
  parseMessageElement,
} = require('../parser');

const talkFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'talk-page.html'),
  'utf8',
);

describe('parser', () => {
  test('reads csrf parameters for the unread counter', () => {
    expect(parseUnreadParams('<script>req.send("uid=123&c=abc");</script>')).toEqual({
      uid: '123',
      c: 'abc',
    });
    expect(parseUnreadParams('<div>no params</div>')).toBeNull();
  });

  test('extracts list rows and pagination links', () => {
    const doc = new DOMParser().parseFromString(
      `<div id="content"><table id="talks_table">
        <tr id="talk_1"><td>2 / 3</td></tr>
        <tr id="talk_2"><td>no count</td></tr>
      </table><div id="pages"><a class="page" href="/users/my_talks/page2/">2</a></div></div>`,
      'text/html',
    );

    const page = extractListPage(doc);

    expect(page.rows).toEqual([
      { talkId: '1', messageCount: 5 },
      { talkId: '2', messageCount: null },
    ]);
    expect(page.pageUrls).toEqual(['/users/my_talks/page2/']);
    expect(getLastLinkedTalkPage(doc)).toBe(2);
  });

  test('reads own id and message id from a talk page', () => {
    const doc = new DOMParser().parseFromString(talkFixture, 'text/html');

    expect(getSelfUserId(doc)).toBe('55555');
    expect(parseTalkIdFromUrl('https://www.laststicker.ru/users/my_talks/41292/')).toBe(
      '41292',
    );

    const message = parseMessageElement(doc.getElementById('msg_101'), {
      defaultPartner: 'Анна',
      talkId: '41292',
      pageUrl: 'https://www.laststicker.ru/users/my_talks/41292/',
    });

    expect(message.messageId).toBe('101');
    expect(message.talkId).toBe('41292');
    expect(message.partner).toBe('Анна');
    expect(message.text).toContain('наклейки для обмена');
  });
});
