// Offscreen forum indexer: fetches forum topic pages, parses comments and
// stores them in IndexedDB in batches.

(function (global) {
  'use strict';

  const BASE_URL = 'https://www.laststicker.ru';
  const MAX_FORUM_PAGES = 10000;

  let running = false;
  let cancelRequested = false;
  let currentJob = null;
  let lastProgressAt = 0;

  function sanitizeHtml(html) {
    return String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve();
        return;
      }
      chrome.runtime.sendMessage(message, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }

  function setBadge(text, color) {
    try {
      if (chrome.action && chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text });
        if (color && chrome.action.setBadgeBackgroundColor) {
          chrome.action.setBadgeBackgroundColor({ color });
        }
      }
    } catch {
      // Badge updates are best-effort.
    }
  }

  function reportProgress(done, total, messageCount, currentPage) {
    if (!currentJob) return;

    const now = Date.now();
    if (done < total && now - lastProgressAt < 500) return;
    lastProgressAt = now;

    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    setBadge(total > 0 ? `${percent}%` : '', '#2444bc');
    void sendMessage({
      target: 'background',
      action: 'forumIndexProgress',
      jobId: currentJob.jobId,
      postId: currentJob.postId,
      done,
      total,
      messageCount,
      currentPage,
    });
  }

  function reportFinished(result) {
    void sendMessage({
      target: 'background',
      action: 'forumIndexFinished',
      jobId: result.jobId,
      result,
    });
  }

  async function fetchText(url) {
    const response = await LSFetch.fetchWithRetry(
      url,
      { credentials: 'include' },
      {
        timeoutMs: 30000,
        retries: 2,
        shouldCancel: () => cancelRequested,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  }

  function buildPageUrl(postId, pageParam) {
    const base = `${BASE_URL}/blog/post${postId}/`;
    return pageParam > 0 ? `${base}page${pageParam}/` : base;
  }

  function makePostRecord(meta) {
    if (!meta || !meta.firstPostText) return null;
    return {
      key: LSForumParser.buildForumCommentKey(meta.postId, 'post'),
      kind: 'post',
      postId: String(meta.postId),
      commentId: '',
      topicTitle: meta.title || '',
      category: meta.category || '',
      categoryPath: meta.categoryPath || '',
      author: meta.author || '',
      authorId: meta.authorId || '',
      city: meta.city || '',
      timestamp: meta.createdAt || 0,
      text: meta.firstPostText,
      hasImages: false,
      replyTo: null,
      page: 1,
      pageParam: 0,
      url: LSForumParser.buildForumCommentUrl(meta.postId, 1),
    };
  }

  async function indexTopic(job) {
    const postId = String(job.postId || '');
    if (!postId) throw new Error('Не указана тема форума');

    const generation = await LSForumStorage.getGeneration();
    let existing = await LSForumStorage.getTopic(postId);

    if (job.mode === 'reindex' && existing) {
      await LSForumStorage.deleteTopic(postId);
      existing = null;
    }

    const baseUrl = buildPageUrl(postId, 0);
    const baseHtml = await fetchText(baseUrl);
    const baseDoc = parseHtml(baseHtml);
    const meta = LSForumParser.parseForumTopicMeta(baseDoc, { postId });
    if (!meta || !meta.title) {
      throw new Error('Не удалось разобрать страницу темы');
    }

    meta.postId = postId;
    const lastPageParam = Math.min(MAX_FORUM_PAGES, LSForumParser.getLastForumPage(baseDoc));
    const totalPages = lastPageParam + 1;

    // If the pagination shrank, the old index is no longer trustworthy.
    if (existing && Number(existing.lastCompletePageParam) > lastPageParam) {
      await LSForumStorage.deleteTopic(postId);
      existing = null;
    }

    const startPageParam = existing
      ? Math.min(Number(existing.lastCompletePageParam) || 0, lastPageParam)
      : 0;

    const errors = [];
    let lastCompletePageParam = startPageParam - 1;
    let messageCount = Number(existing && existing.indexedComments) || 0;
    let cancelled = false;
    let done = 0;

    reportProgress(done, totalPages - startPageParam, messageCount, startPageParam + 1);

    const postRecord = makePostRecord(meta);
    if (postRecord) {
      await LSForumStorage.putComments([postRecord], generation);
    }

    for (let pageParam = startPageParam; pageParam <= lastPageParam; pageParam++) {
      if (cancelRequested) {
        cancelled = true;
        break;
      }

      let pageDoc;
      if (pageParam === 0) {
        pageDoc = baseDoc;
      } else {
        try {
          const html = await fetchText(buildPageUrl(postId, pageParam));
          pageDoc = parseHtml(html);
        } catch (e) {
          errors.push(`Тема ${postId}, страница ${pageParam + 1}: ${e.message}`);
          break;
        }
      }

      const comments = LSForumParser.extractForumCommentsFromDocument(pageDoc, {
        postId,
        topicTitle: meta.title,
        category: meta.category,
        categoryPath: meta.categoryPath,
        page: pageParam + 1,
      });

      if (comments.length > 0) {
        try {
          await LSForumStorage.putComments(comments, generation);
          messageCount += comments.length;
        } catch (e) {
          if (String(e.message || '').includes('очищен')) throw e;
          errors.push(`Тема ${postId}, страница ${pageParam + 1}: ${e.message}`);
          break;
        }
      }

      lastCompletePageParam = pageParam;
      done = pageParam - startPageParam + 1;
      reportProgress(done, totalPages - startPageParam, messageCount, pageParam + 1);

      if (pageParam < lastPageParam) {
        await sleep(60);
      }
    }

    if (cancelled) {
      // Save the partial state so a later update can continue.
      const indexedComments = await LSForumStorage.countCommentsByPost(postId);
      await LSForumStorage.putTopic(
        {
          postId,
          title: meta.title,
          category: meta.category,
          categoryPath: meta.categoryPath,
          author: meta.author,
          authorId: meta.authorId,
          city: meta.city,
          createdAt: meta.createdAt,
          tags: meta.tags,
          pageCount: totalPages,
          lastPageParam,
          lastCompletePageParam,
          indexedComments,
          complete: false,
          partial: true,
          indexedAt: Date.now(),
          updatedAt: Date.now(),
        },
        generation,
      );

      return {
        jobId: job.jobId,
        postId,
        mode: job.mode,
        cancelled: true,
        errors,
        messageCount: indexedComments,
        lastPageParam,
        lastCompletePageParam,
        complete: false,
      };
    }

    const indexedComments = await LSForumStorage.countCommentsByPost(postId);
    const complete = errors.length === 0 && lastCompletePageParam >= lastPageParam;
    const now = Date.now();

    await LSForumStorage.putTopic(
      {
        postId,
        title: meta.title,
        category: meta.category,
        categoryPath: meta.categoryPath,
        author: meta.author,
        authorId: meta.authorId,
        city: meta.city,
        createdAt: meta.createdAt,
        tags: meta.tags,
        pageCount: totalPages,
        lastPageParam,
        lastCompletePageParam,
        indexedComments,
        complete,
        partial: !complete,
        indexedAt: now,
        updatedAt: now,
      },
      generation,
    );

    if (complete) {
      await LSForumStorage.setMeta('lastIndexedAt', now);
    }

    return {
      jobId: job.jobId,
      postId,
      mode: job.mode,
      cancelled: false,
      errors,
      messageCount: indexedComments,
      lastPageParam,
      lastCompletePageParam,
      complete,
    };
  }

  async function startIndex(job) {
    if (running) {
      reportFinished({
        jobId: job.jobId,
        postId: job.postId,
        error: 'Индексация форума уже выполняется',
      });
      return;
    }

    running = true;
    cancelRequested = false;
    currentJob = job;
    lastProgressAt = 0;

    try {
      const result = await indexTopic(job);
      reportFinished(result);
    } catch (e) {
      const cancelled = cancelRequested;
      reportFinished({
        jobId: job.jobId,
        postId: job.postId,
        cancelled,
        error: cancelled ? null : e.message,
        reason: cancelled ? 'Индексация отменена' : null,
      });
    } finally {
      running = false;
      currentJob = null;
      setBadge('');
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.target !== 'offscreen') return false;

      if (message.action === 'startForumIndex') {
        if (running) {
          sendResponse({ error: 'Индексация форума уже выполняется' });
          return false;
        }

        const job = {
          jobId: message.jobId,
          postId: String(message.postId || ''),
          mode: message.mode || 'topic',
          source: message.source || 'manual',
        };
        void startIndex(job);
        sendResponse({ started: true });
        return false;
      }

      if (message.action === 'cancelForumIndex') {
        cancelRequested = true;
        sendResponse({ cancelled: running });
        return false;
      }

      return false;
    });
  }

  const api = {
    BASE_URL,
    sanitizeHtml,
    buildPageUrl,
    makePostRecord,
    indexTopic,
    startIndex,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.LSForumIndexer = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
