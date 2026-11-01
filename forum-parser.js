// Shared parsing helpers for laststicker forum pages.
// Used by the offscreen forum indexer, the inline panel and Jest.

(function (global) {
  'use strict';

  const BASE_URL = 'https://www.laststicker.ru';
  const MONTHS = {
    января: 0,
    янв: 0,
    февраля: 1,
    фев: 1,
    марта: 2,
    мар: 2,
    апреля: 3,
    апр: 3,
    мая: 4,
    июня: 5,
    июн: 5,
    июля: 6,
    июл: 6,
    августа: 7,
    авг: 7,
    сентября: 8,
    сен: 8,
    октября: 9,
    окт: 9,
    ноября: 10,
    ноя: 10,
    декабря: 11,
    дек: 11,
  };

  function normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getMonthNumber(monthName) {
    const normalized = String(monthName || '')
      .toLowerCase()
      .replace(/[^а-яё]/g, '');
    return MONTHS[normalized] === undefined ? -1 : MONTHS[normalized];
  }

  /**
   * Parse a Russian forum date: "17 июля 2013 13:37" or "27 марта 13:53".
   * The site omits the year for the current year. If the resulting date is in
   * the future, assume the previous year (new-year rollover).
   *
   * @param {string} value
   * @returns {number|null}
   */
  function parseForumDate(value) {
    const text = normalizeText(value);
    if (!text) return null;

    const match = text.match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?\s+(\d{1,2}):(\d{2})/i);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = getMonthNumber(match[2]);
    if (month < 0) return null;

    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const explicitYear = match[3] ? parseInt(match[3], 10) : null;
    const now = new Date();
    let year = explicitYear || now.getFullYear();

    let date = new Date(year, month, day, hours, minutes);
    if (!explicitYear && date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      year -= 1;
      date = new Date(year, month, day, hours, minutes);
    }

    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function getForumTopicIdFromPath(path) {
    const match = String(path || '').match(/^\/blog\/post(\d+)(?:\/page\d+)?\/?$/);
    return match ? match[1] : '';
  }

  function getForumPageParamFromPath(path) {
    const match = String(path || '').match(/\/blog\/post\d+\/page(\d+)\/?$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function buildForumTopicUrl(postId) {
    return `${BASE_URL}/blog/post${postId}/`;
  }

  /**
   * Build a direct link to a forum comment.
   * The site's base topic page is human page 1; /page1/ is human page 2.
   *
   * @param {string|number} postId
   * @param {number} page human page number, starting at 1
   * @param {string|number} [commentId]
   * @returns {string}
   */
  function buildForumCommentUrl(postId, page, commentId) {
    const base = buildForumTopicUrl(postId);
    const humanPage = Math.max(1, parseInt(page, 10) || 1);
    const pageUrl = humanPage > 1 ? `${base}page${humanPage - 1}/` : base;
    return commentId ? `${pageUrl}#c${commentId}` : pageUrl;
  }

  function buildForumCommentKey(postId, commentId) {
    return `forum:${postId}:${commentId || 'post'}`;
  }

  /**
   * Highest /pageN/ linked from #pages. N is the URL parameter, so the human
   * page count is N + 1 (the base page is page 1).
   *
   * @param {Document} doc
   * @returns {number}
   */
  function getLastForumPage(doc) {
    if (!doc || !doc.querySelector) return 0;

    const pagesRoot = doc.querySelector('#pages');
    if (!pagesRoot) return 0;

    let lastPage = 0;
    pagesRoot.querySelectorAll('a[href*="/page"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/page(\d+)\/?/);
      if (match) {
        lastPage = Math.max(lastPage, parseInt(match[1], 10));
      }
    });

    return lastPage;
  }

  function getLastForumPageFromHtml(html) {
    if (typeof DOMParser === 'undefined') return 0;
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return getLastForumPage(doc);
  }

  function parseUserLink(root) {
    if (!root || !root.querySelector) return { author: '', authorId: '' };

    const links = Array.from(root.querySelectorAll('a[href^="/users/"]'));
    let author = '';
    let authorId = '';

    links.forEach((link) => {
      const text = normalizeText(link.textContent);
      if (!text) return;
      author = text;
      const match = (link.getAttribute('href') || '').match(/^\/users\/(\d+)(?:\/|$)/);
      if (match) authorId = match[1];
    });

    return { author, authorId };
  }

  function parseCity(forumLeft) {
    if (!forumLeft) return '';

    const span = forumLeft.querySelector('span');
    const spanText = normalizeText(span ? span.textContent : '');
    // In comments the city is a span; in the topic header the span is the
    // creation date and the city follows a <br>.
    if (spanText && !/\d{1,2}\s+[а-яё]+/i.test(spanText)) {
      return spanText;
    }

    const br = forumLeft.querySelector('br');
    if (!br) return '';
    return normalizeText(br.nextSibling ? br.nextSibling.textContent : '');
  }

  /**
   * @param {Element} el
   * @param {{
   *   postId?: string,
   *   topicTitle?: string,
   *   category?: string,
   *   categoryPath?: string,
   *   page?: number
   * }} [options]
   * @returns {object|null}
   */
  function parseForumCommentElement(el, options = {}) {
    if (!el) return null;

    try {
      const postId = String(options.postId || '');
      const idMatch = String(el.id || '').match(/^comment(\d+)$/);
      const commentId = idMatch ? idMatch[1] : '';
      if (!commentId) return null;

      const dt = el.querySelector('dt');
      const dd = el.querySelector('dd');
      if (!dt || !dd) return null;

      const left = dt.querySelector('.left') || dt;
      const user = parseUserLink(left);
      const dateText = normalizeText(left.textContent);
      const timestamp = parseForumDate(dateText);
      const city = parseCity(left);

      let textEl = dd.querySelector(`#comment_txt${commentId}`);
      if (!textEl) textEl = dd.querySelector('[id^="comment_txt"]');
      const text = normalizeText(textEl ? textEl.textContent : '');
      const images = dd.querySelectorAll('img').length;

      let replyTo = null;
      const replyEl = dd.querySelector('.comment_reply');
      if (replyEl) {
        const replyUser = parseUserLink(replyEl);
        const replyLink = replyEl.querySelector('a[href^="#c"]');
        const replyMatch = (replyLink ? replyLink.getAttribute('href') : '').match(/^#c(\d+)$/);
        replyTo = {
          author: replyUser.author,
          commentId: replyMatch ? replyMatch[1] : '',
        };
      }

      const page = Math.max(1, parseInt(options.page, 10) || 1);

      return {
        key: buildForumCommentKey(postId, commentId),
        kind: 'comment',
        postId,
        commentId,
        topicTitle: options.topicTitle || '',
        category: options.category || '',
        categoryPath: options.categoryPath || '',
        author: user.author,
        authorId: user.authorId,
        city,
        timestamp,
        text,
        hasImages: images > 0,
        replyTo,
        page,
        pageParam: page - 1,
        url: buildForumCommentUrl(postId, page, commentId),
      };
    } catch {
      return null;
    }
  }

  function extractForumCommentsFromDocument(doc, options = {}) {
    if (!doc || !doc.querySelectorAll) return [];
    return Array.from(doc.querySelectorAll('dl.comment_new'))
      .map((el) => parseForumCommentElement(el, options))
      .filter(Boolean);
  }

  function parseForumTopicMeta(doc, options = {}) {
    if (!doc) return null;

    const postId =
      String(options.postId || '') ||
      getForumTopicIdFromPath(
        typeof window !== 'undefined' ? window.location && window.location.pathname : '',
      );
    const titleEl = doc.querySelector('#content h1');
    const forumTop = doc.querySelector('.forum_top');
    const forumLeft = forumTop
      ? forumTop.querySelector('.forum_left')
      : doc.querySelector('.forum_left');
    const user = parseUserLink(forumLeft);
    const dateEl = forumLeft ? forumLeft.querySelector('span') : null;
    const createdAt = dateEl ? parseForumDate(dateEl.textContent) : null;
    const city = parseCity(forumLeft);
    const categoryLink = doc.querySelector('.forum_right a[href^="/blog/"]');

    const firstPost =
      doc.querySelector('.forum_annotation') || doc.querySelector('#content .forum_content');
    const firstPostText = normalizeText(firstPost ? firstPost.textContent : '');

    const tags = Array.from(doc.querySelectorAll('.forum_bottom a[href*="/blog/forum/tag"]'))
      .map((link) => normalizeText(link.textContent))
      .filter(Boolean);

    const lastPage = getLastForumPage(doc);

    return {
      postId,
      title: normalizeText(titleEl ? titleEl.textContent : ''),
      category: normalizeText(categoryLink ? categoryLink.textContent : ''),
      categoryPath: categoryLink ? categoryLink.getAttribute('href') || '' : '',
      author: user.author,
      authorId: user.authorId,
      city,
      createdAt,
      firstPostText,
      tags,
      lastPage,
      pageCount: lastPage + 1,
    };
  }

  /**
   * Parse a topic card from a forum index/category page.
   *
   * @param {Element} card
   * @returns {object|null}
   */
  function parseForumTopicCard(card) {
    if (!card) return null;

    try {
      const titleLink = card.querySelector('h2 a[href*="/blog/post"]');
      if (!titleLink) return null;

      const href = titleLink.getAttribute('href') || '';
      const match = href.match(/\/blog\/post(\d+)\//);
      if (!match) return null;
      const postId = match[1];

      const commentsLink = card.querySelector('a[href*="#comments_list"]');
      let commentCount = 0;
      if (commentsLink) {
        const digits = (commentsLink.textContent.match(/(\d[\d\s]*)/) || [])[1];
        if (digits) commentCount = parseInt(digits.replace(/\s/g, ''), 10);
      }

      const forumLeft = card.querySelector('.forum_top .forum_left');
      const user = parseUserLink(forumLeft);
      const dateEl = forumLeft ? forumLeft.querySelector('span') : null;
      const createdAt = dateEl ? parseForumDate(dateEl.textContent) : null;
      const city = parseCity(forumLeft);

      const categoryLink = card.querySelector('.forum_right a[href^="/blog/"]');
      const lastActivityEl = card.querySelector('.normal_text span');
      const lastActivityAt = lastActivityEl ? parseForumDate(lastActivityEl.textContent) : null;

      const content = card.querySelector('.forum_content');
      const firstPostText = normalizeText(content ? content.textContent : '');

      const tags = Array.from(card.querySelectorAll('.forum_bottom a[href*="/blog/forum/tag"]'))
        .map((link) => normalizeText(link.textContent))
        .filter(Boolean);

      return {
        postId,
        title: normalizeText(titleLink.textContent),
        category: normalizeText(categoryLink ? categoryLink.textContent : ''),
        categoryPath: categoryLink ? categoryLink.getAttribute('href') || '' : '',
        author: user.author,
        authorId: user.authorId,
        city,
        createdAt,
        lastActivityAt,
        commentCount,
        firstPostText,
        tags,
        url: buildForumTopicUrl(postId),
      };
    } catch {
      return null;
    }
  }

  function extractForumTopicsFromDocument(doc) {
    if (!doc || !doc.querySelectorAll) return [];
    return Array.from(doc.querySelectorAll('.forum_list'))
      .map((card) => parseForumTopicCard(card))
      .filter(Boolean);
  }

  function isForumTopicPath(path) {
    return Boolean(getForumTopicIdFromPath(path));
  }

  const api = {
    BASE_URL,
    normalizeText,
    parseForumDate,
    getForumTopicIdFromPath,
    getForumPageParamFromPath,
    buildForumTopicUrl,
    buildForumCommentUrl,
    buildForumCommentKey,
    getLastForumPage,
    getLastForumPageFromHtml,
    parseForumCommentElement,
    extractForumCommentsFromDocument,
    parseForumTopicMeta,
    parseForumTopicCard,
    extractForumTopicsFromDocument,
    isForumTopicPath,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.LSForumParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
