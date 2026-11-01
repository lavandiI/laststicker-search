// Offscreen indexer: fetches and parses laststicker pages, merges and saves the
// local index. Runs in an offscreen document, independent of the active tab.

(function (global) {
  'use strict';

  const BASE_URL = 'https://www.laststicker.ru';
  const SECTIONS = [
    { path: '/users/my_talks/', name: 'Мои разговоры' },
    { path: '/users/my_talks/hide/', name: 'Скрытые' },
  ];
  const BATCH_SIZE = 10;
  const LIST_BATCH_SIZE = 20;
  const MAX_LIST_PAGES = 50;
  const MAX_TALK_PAGES = 200;
  const UNREAD_URL = `${BASE_URL}/inc/site/ajax/user_new_msg.php`;

  let running = false;
  let cancelRequested = false;
  let currentJob = null;
  let lastProgressAt = 0;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
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

  function reportProgress(done, total, messageCount, currentTalkId) {
    if (!currentJob) return;

    const now = Date.now();
    if (done < total && now - lastProgressAt < 500) return;
    lastProgressAt = now;

    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    setBadge(total > 0 ? `${percent}%` : '', '#2444bc');
    void sendMessage({
      target: 'background',
      action: 'indexProgress',
      jobId: currentJob.jobId,
      source: currentJob.source,
      done,
      total,
      messageCount,
      currentTalkId,
    });
  }

  function reportFinished(result) {
    void sendMessage({
      target: 'background',
      action: 'indexFinished',
      jobId: result.jobId,
      result,
    });
  }

  async function fetchText(url, options = {}) {
    const response = await LSFetch.fetchWithRetry(
      url,
      { credentials: 'include', ...options },
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

  async function fetchTextOptional(url) {
    try {
      return await fetchText(url);
    } catch {
      return null;
    }
  }

  async function fetchUnreadCount(params) {
    if (!params || !params.uid || !params.c) {
      throw new Error('Не удалось проверить непрочитанные сообщения');
    }

    const response = await LSFetch.fetchWithRetry(
      UNREAD_URL,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `uid=${encodeURIComponent(params.uid)}&c=${encodeURIComponent(params.c)}`,
      },
      {
        timeoutMs: 15000,
        retries: 1,
        shouldCancel: () => cancelRequested,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.answer !== 'y') {
      throw new Error('Сайт не вернул состояние непрочитанных');
    }

    const count = Number(data.new_msg_cnt);
    if (!Number.isFinite(count)) {
      throw new Error('Сайт вернул некорректное число непрочитанных');
    }
    return count;
  }

  async function saveAutoSkip(reason) {
    const meta = await InlineStorage.loadAutoMeta();
    await InlineStorage.saveAutoMeta({
      ...meta,
      lastCheck: Date.now(),
      lastError: '',
      lastResult: reason,
    });
  }

  async function loadStoredCounts() {
    const messages = await InlineStorage.loadMessages();
    const counts = new Map();

    messages.forEach((message) => {
      if (!message || !message.talkId) return;
      const talkId = String(message.talkId);
      counts.set(talkId, (counts.get(talkId) || 0) + 1);
    });

    return counts;
  }

  function filterChangedTalks(rows, counts) {
    const toFetch = [];
    let skippedTalks = 0;

    rows.forEach((row) => {
      if (row.messageCount === null) {
        toFetch.push(row);
        return;
      }

      const storedCount = counts.get(String(row.talkId));
      if (storedCount === row.messageCount) {
        skippedTalks++;
      } else {
        toFetch.push(row);
      }
    });

    return { toFetch, skippedTalks };
  }

  function addRows(rowsById, rows) {
    rows.forEach((row) => {
      if (!rowsById.has(String(row.talkId))) {
        rowsById.set(String(row.talkId), row);
      }
    });
  }

  async function fetchListSection(path, rowsById, pageUrls) {
    const html = await fetchText(BASE_URL + path);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.querySelector('#talks_table')) {
      throw new Error('Сессия laststicker истекла или страница недоступна');
    }

    const page = LSParser.extractListPage(doc);
    addRows(rowsById, page.rows);
    page.pageUrls.forEach((url) => {
      pageUrls.add(new URL(url, BASE_URL + path).href);
    });

    return { html, doc };
  }

  async function fetchListPagination(pageUrls, rowsById, errors) {
    const urls = Array.from(pageUrls).slice(0, MAX_LIST_PAGES);
    for (let i = 0; i < urls.length; i += LIST_BATCH_SIZE) {
      if (cancelRequested) return;
      const batch = urls.slice(i, i + LIST_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (url) => {
          const absolute = new URL(url, BASE_URL).href;
          return { url: absolute, html: await fetchTextOptional(absolute) };
        }),
      );

      results.forEach((result) => {
        if (!result.html) {
          errors.push(`Список: не удалось загрузить ${result.url}`);
          return;
        }
        const doc = new DOMParser().parseFromString(result.html, 'text/html');
        addRows(rowsById, LSParser.extractListPage(doc).rows);
      });
    }
  }

  async function fetchTalkMessages(row) {
    const talkId = String(row.talkId);
    const talkUrl = `${BASE_URL}/users/my_talks/${talkId}/`;
    const baseHtml = await fetchText(talkUrl);
    const baseDoc = new DOMParser().parseFromString(baseHtml, 'text/html');

    const partnerLink = baseDoc.querySelector('#content h1 a');
    const partner = partnerLink ? partnerLink.textContent.trim() : '';
    const messages = [];
    const seen = new Set();

    const addMessages = (pageMessages) => {
      pageMessages.forEach((message) => {
        const key = LSParser.buildMessageKey(message);
        if (seen.has(key)) return;
        seen.add(key);
        messages.push(message);
      });
    };

    addMessages(
      LSParser.extractMessagesFromDocument(baseDoc, {
        defaultPartner: partner,
        talkId,
        pageUrl: talkUrl,
      }),
    );

    const lastLinkedPage = LSParser.getLastLinkedTalkPage(baseDoc);
    let endPage =
      lastLinkedPage > 0 ? Math.min(MAX_TALK_PAGES, lastLinkedPage + 1) : 1;
    let page = 1;

    while (page <= MAX_TALK_PAGES) {
      if (cancelRequested) break;

      const batchEnd = Math.min(endPage, page + BATCH_SIZE - 1, MAX_TALK_PAGES);
      const pageNumbers = [];
      for (let p = page; p <= batchEnd; p++) pageNumbers.push(p);

      const results = await Promise.all(
        pageNumbers.map(async (pageNumber) => {
          const pageUrl = `${talkUrl}page${pageNumber}/`;
          return { pageUrl, html: await fetchTextOptional(pageUrl) };
        }),
      );

      let reachedEnd = false;
      let loadedPages = 0;

      for (const result of results) {
        if (!result.html) continue;
        loadedPages++;

        const pageDoc = new DOMParser().parseFromString(result.html, 'text/html');
        if (!pageDoc.querySelector('.user_message')) {
          reachedEnd = true;
          break;
        }

        addMessages(
          LSParser.extractMessagesFromDocument(pageDoc, {
            defaultPartner: partner,
            talkId,
            pageUrl: result.pageUrl,
          }),
        );
      }

      if (reachedEnd || loadedPages === 0) break;

      page = batchEnd + 1;
      if (page > endPage) {
        endPage = Math.min(MAX_TALK_PAGES, page + BATCH_SIZE - 1);
      }
      await sleep(50);
    }

    return messages;
  }

  async function runIndex(job) {
    const errors = [];
    const rowsById = new Map();
    const pageUrls = new Set();
    let indexedSections = 0;
    let unreadParams;
    let unreadCount;

    const main = await fetchListSection(
      SECTIONS[0].path,
      rowsById,
      pageUrls,
    );
    indexedSections++;
    unreadParams = LSParser.parseUnreadParams(main.html);

    if (job.source === 'auto') {
      unreadCount = await fetchUnreadCount(unreadParams);
      if (unreadCount > 0) {
        return {
          jobId: job.jobId,
          source: job.source,
          skipped: true,
          reason: `Есть непрочитанные сообщения: ${unreadCount}`,
        };
      }
    }

    for (let i = 1; i < SECTIONS.length; i++) {
      try {
        await fetchListSection(SECTIONS[i].path, rowsById, pageUrls);
        indexedSections++;
      } catch (e) {
        errors.push(`${SECTIONS[i].name}: ${e.message}`);
      }
    }

    await fetchListPagination(pageUrls, rowsById, errors);

    if (job.source === 'auto') {
      unreadCount = await fetchUnreadCount(unreadParams);
      if (unreadCount > 0) {
        return {
          jobId: job.jobId,
          source: job.source,
          skipped: true,
          reason: `Есть непрочитанные сообщения: ${unreadCount}`,
        };
      }
    }

    const rows = Array.from(rowsById.values());
    const counts = await loadStoredCounts();
    const { toFetch, skippedTalks } = filterChangedTalks(rows, counts);
    const allMessages = [];
    let done = 0;

    reportProgress(0, toFetch.length, 0, null);

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      if (cancelRequested) break;

      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (row) => {
          try {
            return { row, messages: await fetchTalkMessages(row), error: null };
          } catch (e) {
            return { row, messages: [], error: `${row.talkId}: ${e.message}` };
          }
        }),
      );

      results.forEach((result) => {
        if (result.error) errors.push(result.error);
        allMessages.push(...result.messages);
        done++;
        reportProgress(done, toFetch.length, allMessages.length, result.row.talkId);
      });

      if (i + BATCH_SIZE < toFetch.length) {
        await sleep(100);
      }
    }

    if (cancelRequested) {
      return {
        jobId: job.jobId,
        source: job.source,
        cancelled: true,
        errors,
        indexedSections,
        skippedTalks,
        addedCount: 0,
        messagesCount: allMessages.length,
        dialogsCount: 0,
      };
    }

    const existing = await InlineStorage.loadMessages();
    const merged = InlineStorage.mergeMessages(existing, allMessages);
    const addedCount = merged.length - existing.length;
    const now = Date.now();

    const saved = await InlineStorage.saveMessages(merged, { indexedAt: now });
    if (!saved) {
      throw new Error('Не удалось сохранить индекс: проверьте квоту хранилища');
    }

    const stats = InlineStorage.getStats(merged);
    const fullIndex =
      errors.length === 0 &&
      indexedSections === SECTIONS.length &&
      merged.length > 0;

    if (fullIndex) {
      await InlineStorage.saveFullIndexAt(now);
    }

    if (job.source === 'auto') {
      const meta = await InlineStorage.loadAutoMeta();
      await InlineStorage.saveAutoMeta({
        ...meta,
        lastRun: now,
        lastCheck: now,
        lastError: errors[0] || '',
        lastResult: `Добавлено ${addedCount}, пропущено ${skippedTalks}`,
      });
    }

    return {
      jobId: job.jobId,
      source: job.source,
      cancelled: false,
      errors,
      indexedSections,
      skippedTalks,
      addedCount,
      messagesCount: stats.messagesCount,
      dialogsCount: stats.dialogsCount,
      indexedAt: now,
      fullIndex,
    };
  }

  async function startIndex(job) {
    if (running) {
      reportFinished({
        jobId: job.jobId,
        source: job.source,
        error: 'Индексация уже выполняется',
      });
      return;
    }

    running = true;
    cancelRequested = false;
    currentJob = job;
    lastProgressAt = 0;

    try {
      if (job.source === 'auto') {
        const enabled = await InlineStorage.loadAutoEnabled();
        if (!enabled) {
          await saveAutoSkip('Автообновление выключено');
          reportFinished({
            jobId: job.jobId,
            source: job.source,
            skipped: true,
            reason: 'Автообновление выключено',
          });
          return;
        }

        const hasFullIndex = await InlineStorage.ensureFullIndexFlag();
        if (!hasFullIndex) {
          await saveAutoSkip('Нет полного индекса');
          reportFinished({
            jobId: job.jobId,
            source: job.source,
            skipped: true,
            reason: 'Нет полного индекса',
          });
          return;
        }
      }

      const result = await runIndex(job);
      if (result.skipped) {
        await saveAutoSkip(result.reason);
      }
      reportFinished(result);
    } catch (e) {
      const cancelled = cancelRequested;
      reportFinished({
        jobId: job.jobId,
        source: job.source,
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

      if (message.action === 'startIndex') {
        if (running) {
          sendResponse({ error: 'Индексация уже выполняется' });
          return false;
        }
        const job = {
          jobId: message.jobId,
          source: message.source || 'manual',
        };
        void startIndex(job);
        sendResponse({ started: true });
        return false;
      }

      if (message.action === 'cancelIndex') {
        cancelRequested = true;
        sendResponse({ cancelled: running });
        return false;
      }

      return false;
    });
  }

  const api = {
    SECTIONS,
    filterChangedTalks,
    fetchUnreadCount,
    fetchTalkMessages,
    runIndex,
    startIndex,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.LSIndexer = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
