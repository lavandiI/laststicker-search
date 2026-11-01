// Shared parsing helpers for laststicker pages.
// Used by the offscreen indexer, content scripts and Jest.

(function (global) {
  'use strict';

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseDateStr(dateStr) {
    if (!dateStr) return null;

    const match = String(dateStr)
      .trim()
      .match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }

    return new Date(
      year,
      month,
      day,
      parseInt(match[4], 10),
      parseInt(match[5], 10),
    ).getTime();
  }

  function getSelfUserId(doc) {
    if (!doc || !doc.querySelector) return '';

    const link = doc.querySelector('#left_menu a[href^="/users/"]');
    if (!link) return '';

    const match = (link.getAttribute('href') || '').match(/^\/users\/(\d+)(?:\/|$)/);
    return match ? match[1] : '';
  }

  function parseMessageElement(el, options = {}) {
    if (!el) return null;

    try {
      const defaultPartner = options.defaultPartner || '';
      const talkId = options.talkId || '';
      const pageUrl = options.pageUrl || '';

      const divs = el.querySelectorAll('div');
      let headerDiv = null;
      let textDiv = null;

      for (let i = 0; i < divs.length; i++) {
        const div = divs[i];
        const className = div.className || '';
        if (className.includes('big_text')) {
          textDiv = div;
        } else if (div.querySelector('span') && div.querySelector('a')) {
          headerDiv = div;
        }
      }

      if (!headerDiv && divs.length > 0) {
        headerDiv = divs[0];
      }
      if (!headerDiv) return null;

      let messageId = null;
      const idSource = headerDiv.closest('[id^="msg_"]') || headerDiv.parentNode;
      if (idSource && idSource.id) {
        const idMatch = String(idSource.id).match(/^msg_(\d+)/);
        if (idMatch) messageId = idMatch[1];
      }

      let timestamp = null;
      const timeSpan = headerDiv.querySelector('span');
      if (timeSpan) {
        timestamp = parseDateStr(timeSpan.textContent.trim());
      }

      let partner = defaultPartner;
      const userLink = headerDiv.querySelector('a[href^="/users/"]');
      if (userLink) {
        const href = userLink.getAttribute('href') || '';
        const selfUserId = getSelfUserId(el.ownerDocument);
        const isSelf = selfUserId && href.includes(`/users/${selfUserId}/`);

        if (!isSelf) {
          const linkText = userLink.textContent.trim();
          if (linkText) partner = linkText;
        }
      }

      let text = '';
      if (textDiv) {
        text = textDiv.textContent.trim();

        const images = textDiv.querySelectorAll('img');
        if (images.length > 0) {
          const imgSrcs = Array.from(images)
            .map((img) => {
              const src = img.getAttribute('src') || img.getAttribute('data-src');
              if (!src) return '';
              if (src.startsWith('data:image/')) {
                const base64Match = src.match(/^data:image\/(\w+);base64,/);
                const format = base64Match ? base64Match[1] : 'unknown';
                return `[Base64 ${format}]`;
              }
              return src;
            })
            .filter(Boolean);

          if (imgSrcs.length > 0) {
            const imageText = `[Image: ${imgSrcs.join(', ')}]`;
            text = text ? `${text} ${imageText}` : imageText;
          }
        }
      } else {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('div').forEach((div) => div.remove());
        text = clone.textContent.trim();
      }

      text = normalizeText(text);
      if (!text) return null;

      return {
        text,
        partner,
        timestamp,
        url:
          pageUrl ||
          `https://laststicker.ru/users/my_talks/${talkId}/`,
        talkId,
        messageId: messageId || undefined,
      };
    } catch {
      return null;
    }
  }

  function extractMessagesFromDocument(doc, options = {}) {
    if (!doc) return [];

    return Array.from(doc.querySelectorAll('.user_message'))
      .map((element) => parseMessageElement(element, options))
      .filter(Boolean);
  }

  function buildMessageKey(message) {
    const talkId = message.talkId || '';
    if (talkId && message.messageId) {
      return `id::${talkId}::${message.messageId}`;
    }
    return `legacy::${message.partner || ''}::${message.text || ''}::${
      message.timestamp || ''
    }::${talkId}`;
  }

  function dedupeMessages(messages) {
    const seen = new Set();
    const unique = [];
    messages.forEach((message) => {
      const key = buildMessageKey(message);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(message);
    });
    return unique;
  }

  function extractListPage(doc) {
    if (!doc) return { rows: [], pageUrls: [] };

    const rowsById = new Map();

    doc.querySelectorAll('#talks_table tr[id^="talk_"]').forEach((row) => {
      const talkId = (row.id || '').replace('talk_', '').trim();
      if (!talkId || rowsById.has(talkId)) return;

      const match = row.innerHTML.match(/>(\d+)\s*\/\s*(\d+)</);
      const messageCount = match ? Number(match[1]) + Number(match[2]) : null;
      rowsById.set(talkId, { talkId, messageCount });
    });

    const pageUrls = new Set();
    doc.querySelectorAll('#pages a.page[href*="/users/my_talks/"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href) pageUrls.add(href);
    });

    return {
      rows: Array.from(rowsById.values()),
      pageUrls: Array.from(pageUrls),
    };
  }

  function getLastLinkedTalkPage(doc) {
    if (!doc) return 0;

    const pagesRoot = doc.querySelector('#pages');
    if (!pagesRoot) return 0;

    let lastPage = 0;
    pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/page(\d+)\/?$/);
      if (match) lastPage = Math.max(lastPage, Number(match[1]));
    });

    return lastPage;
  }

  function parseTalkIdFromUrl(url) {
    const match = String(url || '').match(/\/users\/my_talks(?:\/hide)?\/(\d+)\/?/);
    return match ? match[1] : '';
  }

  function parseUnreadParams(html) {
    const match = String(html || '').match(/req\.send\("uid=(\d+)&c=([^"]+)"\)/);
    if (!match) return null;
    return { uid: match[1], c: match[2] };
  }

  const api = {
    normalizeText,
    parseDateStr,
    getSelfUserId,
    parseMessageElement,
    extractMessagesFromDocument,
    buildMessageKey,
    dedupeMessages,
    extractListPage,
    getLastLinkedTalkPage,
    parseTalkIdFromUrl,
    parseUnreadParams,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.LSParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
