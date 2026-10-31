// Background script for LastSticker Search
// Handles message passing and script injection

console.log('[LS Search] Background script loaded');

const ICONS_ENABLED = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};

const ICONS_DISABLED = {
  16: 'icons/black/icon16.png',
  32: 'icons/black/icon32.png',
  48: 'icons/black/icon48.png',
  128: 'icons/black/icon128.png'
};

const STORAGE_KEY = 'isEnabled';
let indexInProgress = false;
let indexCancelRequested = false;

async function setExtensionIcon(enabled) {
  const icons = enabled ? ICONS_ENABLED : ICONS_DISABLED;
  try {
    await chrome.action.setIcon({ path: icons });
    console.log('[LS Search] Icon updated:', enabled ? 'enabled' : 'disabled');
  } catch (e) {
    console.error('[LS Search] Error setting icon:', e);
  }
}

async function loadAndSetInitialState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const isEnabled = result[STORAGE_KEY] !== false;
    await setExtensionIcon(isEnabled);
    console.log('[LS Search] Initial state loaded:', isEnabled ? 'enabled' : 'disabled');
    return isEnabled;
  } catch (e) {
    console.error('[LS Search] Error loading state:', e);
    await setExtensionIcon(true);
    return true;
  }
}

async function isExtensionEnabled() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] !== false;
  } catch {
    return true;
  }
}

chrome.action.onClicked.addListener(async () => {
  console.log('[LS Search] Extension icon clicked');
  
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const currentState = result[STORAGE_KEY] !== false;
    const newState = !currentState;
    
    await chrome.storage.local.set({ [STORAGE_KEY]: newState });
    await setExtensionIcon(newState);
    
    console.log('[LS Search] State toggled:', newState ? 'enabled' : 'disabled');
  } catch (e) {
    console.error('[LS Search] Error toggling state:', e);
  }
});

loadAndSetInitialState();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LS Search] Background received message:', request.action);

  if (request.action === 'cancelIndex') {
    indexCancelRequested = true;
    sendResponse({ cancelled: indexInProgress });
    return false;
  }

  if (request.action === 'extractMessages') {
    (async () => {
      if (!(await isExtensionEnabled())) {
        sendResponse({ error: 'Расширение отключено' });
        return;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ error: 'No active tab' });
          return;
        }
        
        const tab = tabs[0];
        
        chrome.tabs.sendMessage(tab.id, request, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not found, injecting...');
            
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
              }
              
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, request, (response2) => {
                  if (chrome.runtime.lastError) {
                    sendResponse({ error: chrome.runtime.lastError.message });
                  } else {
                    sendResponse(response2);
                  }
                });
              }, 500);
            });
          } else {
            sendResponse(response);
          }
        });
      });
    })();
    return true;
  }

  if (request.action === 'indexAllSections') {
    (async () => {
      if (!(await isExtensionEnabled())) {
        sendResponse({ error: 'Расширение отключено' });
        return;
      }
      indexAllSectionsAsync(request, sender, sendResponse).catch((e) => {
        console.error('[LS Search] Indexing failed:', e);
        indexInProgress = false;
        indexCancelRequested = false;
        sendResponse({ error: e.message });
      });
    })();
    return true;
  }

  if (request.action === 'injectDependencies') {
    (async () => {
      if (!(await isExtensionEnabled())) {
        sendResponse({ error: 'Расширение отключено' });
        return;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ error: 'No active tab' });
          return;
        }
        
        const tab = tabs[0];
        
        if (!tab.url || !tab.url.startsWith('http')) {
          console.log('[LS Search] Skipping injection - invalid URL:', tab.url);
          sendResponse({ error: 'Cannot inject into this URL' });
          return;
        }
        
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                hasInlineStorage: typeof window.InlineStorage !== 'undefined',
                hasInlineUI: typeof window.InlineUI !== 'undefined'
              };
            }
          });
          
          const state = results[0]?.result;
          if (state && state.hasInlineStorage && state.hasInlineUI) {
            sendResponse({ success: true, alreadyInjected: true });
            return;
          }
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['inline-storage.js']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['inline-ui.js']
          });
          
          sendResponse({ success: true });
        } catch (e) {
          console.error('[LS Search] Error injecting dependencies:', e);
          sendResponse({ error: e.message });
        }
      });
    })();
    return true;
  }

  if (request.action === 'injectInlinePanel') {
    (async () => {
      if (!(await isExtensionEnabled())) {
        sendResponse({ error: 'Расширение отключено' });
        return;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ error: 'No active tab' });
          return;
        }
        
        const tab = tabs[0];
        
        if (!tab.url || !tab.url.startsWith('http')) {
          console.log('[LS Search] Skipping injection - invalid URL:', tab.url);
          sendResponse({ error: 'Cannot inject into this URL' });
          return;
        }
        
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                hasInlinePanelReady: typeof window.InlinePanelReady !== 'undefined'
              };
            }
          });
          
          const state = results[0]?.result;
          if (state && state.hasInlinePanelReady) {
            sendResponse({ success: true, alreadyInjected: true });
            return;
          }
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['inline-panel.js']
          });
          
          sendResponse({ success: true });
        } catch (e) {
          console.error('[LS Search] Error injecting inline-panel:', e);
          sendResponse({ error: e.message });
        }
      });
    })();
    return true;
  }
});

const SECTIONS = [
  { path: '/users/my_talks/', name: 'Мои разговоры' },
  { path: '/users/my_talks/hide/', name: 'Скрытые' }
];

async function indexAllSectionsAsync(request, sender, sendResponse) {
  if (indexInProgress) {
    sendResponse({ error: 'Индексация уже выполняется' });
    return;
  }

  indexInProgress = true;
  indexCancelRequested = false;

  // The non-www host redirects to /login/ and loses the signed-in page, so
  // always use the canonical www origin for base pages and list pages.
  const baseUrl = 'https://www.laststicker.ru';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('laststicker.ru')) {
    indexInProgress = false;
    sendResponse({ error: 'Откройте страницу laststicker.ru' });
    return;
  }

  const errors = [];
  let allMessages = [];
  let totalTalks = 0;
  let skippedTalks = 0;
  let cancelled = false;

  try {
    const storedCounts = await loadStoredTalkCounts();
    const rows = [];
    const seenTalkIds = new Set();

    for (const section of SECTIONS) {
      if (indexCancelRequested) {
        cancelled = true;
        break;
      }

      try {
        const response = await fetchWithTimeout(baseUrl + section.path, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const sectionRows = await extractAllTalkRowsWithPagination(html, tab.id);

        sectionRows.forEach((row) => {
          const talkId = String(row.talkId);
          if (seenTalkIds.has(talkId)) return;
          seenTalkIds.add(talkId);
          rows.push(row);
        });

        console.log(`[LastSticker Search] ${section.name}: ${sectionRows.length} talks`);
      } catch (e) {
        console.error(`Error fetching ${section.name}:`, e);
        errors.push(`${section.name}: ${e.message}`);
      }
    }

    totalTalks = rows.length;

    const toFetch = rows.filter((row) => {
      if (row.messageCount === null) return true;

      const storedCount = storedCounts.get(String(row.talkId));
      if (storedCount === row.messageCount) {
        skippedTalks++;
        return false;
      }
      return true;
    });

    const progress = createProgressSender(tab.id);

    progress({
      done: 0,
      total: toFetch.length,
      messageCount: 0,
      currentTalkId: null,
      errors: errors.length,
    });

    allMessages = await fetchTalkMessagesForRows(toFetch, baseUrl, tab.id, {
      onProgress: progress,
      shouldCancel: () => indexCancelRequested,
      onError: (message) => errors.push(message),
    });

    cancelled = indexCancelRequested;
  } catch (e) {
    console.error('[LastSticker Search] Indexing error:', e);
    errors.push(e.message);
  } finally {
    indexInProgress = false;
    indexCancelRequested = false;
  }

  console.log(
    `[LastSticker Search] Collected ${allMessages.length} messages, skipped ${skippedTalks} talks, errors: ${errors.length}`,
  );

  sendResponse({
    messages: allMessages,
    indexedSections: SECTIONS.map((s) => s.name),
    totalTalks,
    skippedTalks,
    cancelled,
    errors,
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadStoredTalkCounts() {
  try {
    const result = await chrome.storage.local.get('ls_search_messages');
    const raw = result.ls_search_messages;
    if (!raw) return new Map();

    const messages = JSON.parse(raw);
    if (!Array.isArray(messages)) return new Map();

    const counts = new Map();
    messages.forEach((msg) => {
      if (!msg || !msg.talkId) return;
      const talkId = String(msg.talkId);
      counts.set(talkId, (counts.get(talkId) || 0) + 1);
    });

    return counts;
  } catch (e) {
    console.error('[LS] Could not read stored talk counts:', e);
    return new Map();
  }
}

function createProgressSender(tabId) {
  let lastSent = 0;

  return (payload) => {
    const now = Date.now();
    if (payload.done < payload.total && now - lastSent < 500) {
      return;
    }
    lastSent = now;

    chrome.tabs.sendMessage(tabId, { action: 'indexProgress', ...payload }, () => {
      // The tab may have navigated away; progress is best-effort.
      void chrome.runtime.lastError;
    });
  };
}

async function extractAllTalkRowsWithPagination(html, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent) => {
        const rowsById = new Map();

        function extractRows(doc) {
          doc.querySelectorAll('#talks_table tr[id^="talk_"]').forEach((row) => {
            const talkId = (row.id || '').replace('talk_', '').trim();
            if (!talkId || rowsById.has(talkId)) return;

            const match = row.innerHTML.match(/>(\d+)\s*\/\s*(\d+)</);
            const messageCount = match ? Number(match[1]) + Number(match[2]) : null;
            rowsById.set(talkId, { talkId, messageCount });
          });
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        extractRows(doc);

        const pagesRoot = doc.querySelector('#pages');
        const pageUrls = new Set();

        if (pagesRoot) {
          pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href) pageUrls.add(href);
          });
        }

        console.log('[LS] Found list pagination pages:', pageUrls.size);

        const otherPages = Array.from(pageUrls).slice(0, 50);
        const BATCH_SIZE = 20;

        for (let i = 0; i < otherPages.length; i += BATCH_SIZE) {
          const batch = otherPages.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (pageUrl) => {
              try {
                const pageResponse = await fetch(pageUrl, { credentials: 'include' });
                if (!pageResponse.ok) return null;
                return await pageResponse.text();
              } catch (e) {
                console.log('[LS] Error fetching list page:', pageUrl, e);
                return null;
              }
            }),
          );

          batchResults.filter(Boolean).forEach((pageHtml) => {
            const pageDoc = parser.parseFromString(pageHtml, 'text/html');
            extractRows(pageDoc);
          });
        }

        return Array.from(rowsById.values());
      },
      args: [html],
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log('Error extracting talk rows with pagination:', chrome.runtime.lastError);
        resolve([]);
        return;
      }

      if (results && results[0] && Array.isArray(results[0].result)) {
        resolve(results[0].result);
      } else {
        resolve([]);
      }
    });
  });
}

async function fetchTalkMessagesForRows(rows, baseUrl, tabId, options = {}) {
  const {
    onProgress = () => {},
    shouldCancel = () => false,
    onError = () => {},
  } = options;

  const allMessages = [];
  const BATCH_SIZE = 10;
  let done = 0;

  console.log(`[LastSticker Search] Fetching messages from ${rows.length} changed talks`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (shouldCancel()) break;

    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((row) => fetchTalkMessages(row.talkId, baseUrl, tabId)),
    );

    results.forEach((result, index) => {
      if (result.error) {
        onError(result.error);
      } else if (batch[index].messageCount > 0 && result.messages.length === 0) {
        // A 200 response with no messages usually means the session expired
        // and the site returned the login page instead of the dialog.
        onError(
          `${batch[index].talkId}: 0 сообщений, ожидалось ${batch[index].messageCount}`,
        );
      }

      allMessages.push(...result.messages);
      done++;

      onProgress({
        done,
        total: rows.length,
        messageCount: allMessages.length,
        currentTalkId: batch[index].talkId,
      });
    });

    if (i + BATCH_SIZE < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`[LastSticker Search] Total messages fetched: ${allMessages.length}`);
  return allMessages;
}

async function fetchTalkMessages(talkId, baseUrl, tabId) {
  const talkUrl = `${baseUrl}/users/my_talks/${talkId}/`;

  try {
    const response = await fetchWithTimeout(talkUrl, { credentials: 'include' }, 30000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const extracted = await parseTalkHtmlWithPagination(html, talkUrl, tabId);

    if (!extracted || !Array.isArray(extracted.messages)) {
      throw new Error('не удалось разобрать страницу');
    }

    return { messages: extracted.messages, error: null };
  } catch (e) {
    console.error(`[LS] Error fetching talk ${talkId}:`, e);
    return { messages: [], error: `${talkId}: ${e.message}` };
  }
}

async function parseTalkHtmlWithPagination(html, talkUrl, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent, url) => {
        console.log('[LS] Parsing talk:', url);
        
        function extractMessagesFromDoc(doc, defaultPartner, talkId, pageUrl) {
          const messages = [];
          const messageElements = doc.querySelectorAll('.user_message');
          console.log('[LS] extractMessagesFromDoc: found elements:', messageElements.length);

          messageElements.forEach((el) => {
            const msg = parseUserMessageEl(el, defaultPartner, talkId, pageUrl);
            if (msg) {
              messages.push(msg);
            }
          });

          return messages;
        }

        function parseUserMessageEl(el, defaultPartner, talkId, pageUrl) {
          try {
            const divs = el.querySelectorAll('div');
            let headerDiv = null;
            let textDiv = null;
            
            for (let i = 0; i < divs.length; i++) {
              const d = divs[i];
              const cls = d.className || '';
              if (cls.includes('big_text')) {
                textDiv = d;
              } else if (d.querySelector('span') && d.querySelector('a')) {
                headerDiv = d;
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
              if (idMatch) {
                messageId = idMatch[1];
              }
            }
            
            let timestamp = null;
            const timeSpan = headerDiv.querySelector('span');
            if (timeSpan) {
              const dateText = timeSpan.textContent.trim();
              timestamp = parseDateStr(dateText);
            }
            
            let partner = defaultPartner;
            const userLink = headerDiv.querySelector('a[href^="/users/"]');
            
            if (userLink) {
              const href = userLink.getAttribute('href');
              if (href && !href.includes('/83061/')) {
                const linkText = userLink.textContent.trim();
                if (linkText) {
                  partner = linkText;
                }
              }
            }

            let text = '';
            if (textDiv) {
              text = textDiv.textContent.trim();
              
              const images = textDiv.querySelectorAll('img');
              if (images.length > 0) {
                const imgSrcs = Array.from(images).map(img => {
                  const src = img.getAttribute('src') || img.getAttribute('data-src');
                  if (src) {
                    if (src.startsWith('data:image/')) {
                      const base64Match = src.match(/^data:image\/(\w+);base64,/);
                      const format = base64Match ? base64Match[1] : 'unknown';
                      return `[Base64 ${format}]`;
                    }
                    return src;
                  }
                  return '';
                }).filter(Boolean);
                if (imgSrcs.length > 0) {
                  const imageText = '[Image: ' + imgSrcs.join(', ') + ']';
                  text = text ? text + ' ' + imageText : imageText;
                }
              }
            } else {
              const clone = el.cloneNode(true);
              if (clone.querySelector('div')) {
                clone.querySelectorAll('div').forEach(d => d.remove());
              }
              text = clone.textContent.trim();
            }
            
            if (!text || text.length < 1) return null;
            
            text = text.replace(/\s+/g, ' ').trim();
            
            return {
              text: text,
              partner: partner,
              timestamp: timestamp,
              url: pageUrl || `https://laststicker.ru/users/my_talks/${talkId}/`,
              talkId: talkId,
              messageId: messageId || undefined
            };
            
          } catch {
            return null;
          }
        }

        function parseDateStr(dateStr) {
          if (!dateStr) return null;
          dateStr = dateStr.trim();
          try {
            const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})/);
            if (match) {
              const day = parseInt(match[1]);
              let month = parseInt(match[2]) - 1;
              let year = parseInt(match[3]);
              if (year < 100) {
                year = year + (year > 50 ? 1900 : 2000);
              }
              const hours = parseInt(match[4]);
              const minutes = parseInt(match[5]);
              return new Date(year, month, day, hours, minutes).getTime();
            }
            return null;
          } catch {
            return null;
          }
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const userMessages = doc.querySelectorAll('.user_message');
        console.log('[LS] Found .user_message elements:', userMessages.length);
        
        const talkDiv = doc.querySelector('#talk');
        console.log('[LS] Found #talk:', !!talkDiv);
        
        const contentDiv = doc.querySelector('#content');
        console.log('[LS] Found #content:', !!contentDiv);
        
        let partner = '';
        const titleLink = doc.querySelector('#content h1 a');
        if (titleLink) {
          partner = titleLink.textContent.trim();
        }
        console.log('[LS] Partner:', partner);
        
        const match = url.match(/\/users\/my_talks\/(\d+)\//);
        const talkId = match ? match[1] : '';
        
        const firstPageMessages = extractMessagesFromDoc(doc, partner, talkId, url);
        console.log('[LS] Parsed messages count:', firstPageMessages.length);

        const allMessages = [];
        const seen = new Set();

        function buildMessageKey(msg) {
          const msgTalkId = msg.talkId || talkId || '';
          if (msgTalkId && msg.messageId) {
            return 'id::' + msgTalkId + '::' + msg.messageId;
          }
          return 'legacy::' + (msg.partner || '') + '::' + (msg.text || '') + '::' + (msg.timestamp || '') + '::' + msgTalkId;
        }

        function getLastLinkedTalkPage(pageDoc) {
          const pagesRoot = pageDoc.querySelector('#pages');
          if (!pagesRoot) return 0;

          let lastPage = 0;
          pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]').forEach((link) => {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/page(\d+)\/?$/);
            if (match) {
              lastPage = Math.max(lastPage, Number(match[1]));
            }
          });
          return lastPage;
        }

        function addMessages(pageMessages) {
          pageMessages.forEach((msg) => {
            const key = buildMessageKey(msg);
            if (seen.has(key)) return;
            seen.add(key);
            allMessages.push(msg);
          });
        }

        async function fetchPageHtml(pageUrl, retries = 2) {
          for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);

            try {
              const response = await fetch(pageUrl, {
                credentials: 'include',
                signal: controller.signal,
              });
              if (!response.ok) {
                throw new Error('HTTP ' + response.status);
              }
              return await response.text();
            } catch (e) {
              if (attempt === retries) {
                console.log('[LS] Failed to fetch dialog page:', pageUrl, e.message);
                return null;
              }
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
            } finally {
              clearTimeout(timer);
            }
          }

          return null;
        }

        addMessages(firstPageMessages);

        const parsedUrl = new URL(url);
        const talkBasePath = parsedUrl.pathname.replace(/page\d+\/?$/, '').replace(/\/*$/, '/');
        // The base URL may be laststicker.ru without www, while this injected
        // script runs on www.laststicker.ru. Pagination fetches must use the
        // page's origin, otherwise the browser blocks them as cross-origin.
        const baseUrl = window.location.origin + talkBasePath;
        const BATCH_SIZE = 10;
        const MAX_TALK_PAGES = 200;

        // The site links only the first 11 pages and the last one in #pages.
        // Use the last linked page as a hint, then probe one page past it and
        // keep going only if that page is not empty.
        let knownLastPage = getLastLinkedTalkPage(doc);
        let endPage = knownLastPage > 0 ? Math.min(MAX_TALK_PAGES, knownLastPage + 1) : 1;

        let page = 1;
        while (page <= MAX_TALK_PAGES) {
          const batchEnd = Math.min(endPage, page + BATCH_SIZE - 1, MAX_TALK_PAGES);
          const batchPages = [];
          for (let p = page; p <= batchEnd; p++) {
            batchPages.push(p);
          }

          const batchResults = await Promise.all(
            batchPages.map(async (pageNumber) => {
              const pageUrl = baseUrl + 'page' + pageNumber + '/';
              return { html: await fetchPageHtml(pageUrl), pageUrl };
            })
          );

          let reachedEnd = false;
          let loadedPages = 0;
          for (const result of batchResults) {
            if (!result.html) continue;
            loadedPages++;
            const pageDoc = parser.parseFromString(result.html, 'text/html');

            const pageHint = getLastLinkedTalkPage(pageDoc);
            if (pageHint > knownLastPage) {
              knownLastPage = pageHint;
              endPage = Math.max(endPage, Math.min(MAX_TALK_PAGES, knownLastPage + 1));
            }

            if (!pageDoc.querySelector('.user_message')) {
              reachedEnd = true;
              break;
            }
            addMessages(extractMessagesFromDoc(pageDoc, partner, talkId, result.pageUrl));
          }

          if (reachedEnd) break;
          if (loadedPages === 0) {
            console.log('[LS] No dialog pages loaded in batch, stopping');
            break;
          }

          page = batchEnd + 1;
          if (page > endPage) {
            endPage = Math.min(MAX_TALK_PAGES, page + BATCH_SIZE - 1);
          }
        }

        return { messages: allMessages };
      },
      args: [html, talkUrl]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log('[LS] Runtime error in parseTalkHtmlWithPagination:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      if (!results || !results[0]) {
        console.log('[LS] No results from executeScript');
        resolve(null);
        return;
      }
      if (!results[0].result) {
        console.log('[LS] No result in results[0]:', results[0]);
        resolve(null);
        return;
      }
      console.log('[LS] Got result with messages count:', results[0].result.messages ? results[0].result.messages.length : 0);
      resolve(results[0].result);
    });
  });
}
