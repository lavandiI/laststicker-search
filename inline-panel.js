// Inline Panel - Main entry point
// Injects search functionality directly into the page
// Uses localStorage instead of chrome.storage

(function() {
  'use strict';
  
  // Current talk page state
  let currentTalkId = null;
  let currentPartnerName = '';
  let indexProgressListenerAttached = false;
  let lastMainSearch = { query: '', results: [], limit: 200 };
  let mainKeyboard = null;
  let talkKeyboard = null;
  const resolvedMessageTargets = new Map();

  const DAY_MS = 24 * 60 * 60 * 1000;
  const STALE_INDEX_MS = 7 * DAY_MS;
  
  // Check if this is a single talk page
  function isSingleTalkPath(path) {
    return /^(?:\/users\/my_talks(?:\/hide)?\/\d+\/?)(?:page\d+\/?)?$/.test(path);
  }
  
  // Get talk ID from URL
  function getTalkIdFromPath(path) {
    const match = path.match(/^\/users\/my_talks(?:\/hide)?\/(\d+)\/?/);
    return match ? match[1] : null;
  }
  
  // Get partner name from page
  function getPartnerNameFromPage() {
    const titleLink = document.querySelector('#content h1 a');
    return titleLink ? titleLink.textContent.trim() : '';
  }

  function isEditableElement(element) {
    if (!element || !element.tagName) return false;
    const tag = element.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      element.isContentEditable === true ||
      element.getAttribute('contenteditable') === 'true'
    );
  }

  /**
   * Keyboard navigation for a search input and its result list.
   * Arrow keys select, Enter opens, Escape clears, "/" and Ctrl+K focus.
   */
  function setupKeyboardNavigation(searchInput, results, onOpen) {
    if (!searchInput || !results) return null;
    if (searchInput._keyboardController) return searchInput._keyboardController;

    let activeIndex = -1;

    function getItems() {
      return Array.from(results.querySelectorAll('.ls-result-item'));
    }

    function setActive(index) {
      const items = getItems();
      if (!items.length) {
        activeIndex = -1;
        return;
      }

      if (index < 0) index = items.length - 1;
      if (index >= items.length) index = 0;
      activeIndex = index;

      items.forEach((item, itemIndex) => {
        const active = itemIndex === activeIndex;
        item.classList.toggle('ls-result-item--active', active);
        item.setAttribute('aria-selected', active ? 'true' : 'false');
        if (active) {
          searchInput.setAttribute('aria-activedescendant', item.id || '');
          if (typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest' });
          }
        }
      });
    }

    function reset() {
      activeIndex = -1;
      searchInput.removeAttribute('aria-activedescendant');
      getItems().forEach((item) => {
        item.classList.remove('ls-result-item--active');
        item.setAttribute('aria-selected', 'false');
      });
    }

    function open(index) {
      const items = getItems();
      if (!items.length) return;
      const item = items[index >= 0 ? index : 0];
      if (!item) return;
      if (typeof onOpen === 'function') {
        onOpen(item);
      } else {
        item.click();
      }
    }

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!getItems().length) return;
        setActive(event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        open(activeIndex);
        return;
      }

      if (event.key === 'Escape') {
        if (searchInput.value) {
          event.preventDefault();
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          searchInput.blur();
        }
      }
    });

    function onGlobalKeyDown(event) {
      const isFocusShortcut =
        event.code === 'KeyK' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey;
      const isSlash =
        event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;

      if (!isFocusShortcut && !isSlash) return;
      if (isSlash && isEditableElement(event.target)) return;
      if (!searchInput.isConnected) return;

      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }

    document.addEventListener('keydown', onGlobalKeyDown);

    const controller = { reset, setActive, open };
    searchInput._keyboardController = controller;
    return controller;
  }

  function maybeShowStaleBanner(lastIndexedAt, messagesCount) {
    if (!lastIndexedAt || !messagesCount) return;

    const age = Date.now() - lastIndexedAt;
    if (age < STALE_INDEX_MS) return;

    window.InlineUI.showStaleBanner(Math.floor(age / DAY_MS));
  }

  async function updateIndexSize() {
    const bytes = await window.InlineStorage.getIndexBytes();
    window.InlineUI.renderIndexSize(bytes);
  }
  
  // Wait for DOM and dependencies
  function init() {
    console.log('[LS Search] inline-panel init called, readyState:', document.readyState);
    
    const path = window.location.pathname;
    
    // Check if this is a single talk page
    if (isSingleTalkPath(path)) {
      console.log('[LS Search] Single talk page detected, initializing talk panel');
      currentTalkId = getTalkIdFromPath(path);
      currentPartnerName = getPartnerNameFromPage();
      initTalkPage();
      return;
    }
    
    // Only show on talks list pages (not hidden)
    if (!path.startsWith('/users/my_talks/') || path.includes('/hide/')) {
      console.log('[LS Search] Not on talks list page, skipping');
      // Mark as ready even though we're not initializing the panel
      // This prevents "InlinePanel still not ready" errors on non-supported pages
      window.InlinePanelReady = true;
      return;
    }
    
    console.log('[LS Search] Initializing inline panel...');
    
    // Wait for InlineStorage and InlineUI to be available
    let attempts = 0;
    const maxAttempts = 20;
    
    function checkDependencies() {
      attempts++;
      
      console.log('[LS Search] checkDependencies attempt', attempts, '/', maxAttempts, '- InlineStorage:', !!window.InlineStorage, 'InlineUI:', !!window.InlineUI);
      
      if (window.InlineStorage && window.InlineUI) {
        injectStyles();
        
        const elements = window.InlineUI.createSearchPanel();
        
        if (!elements) {
          console.log('[LS Search] Could not create panel');
          window.InlinePanelReady = true;
          return;
        }
        
        console.log('Init', 'Panel created successfully');
        
        initPanel(elements);
        window.InlinePanelReady = true;
      } else if (attempts < maxAttempts) {
        setTimeout(checkDependencies, 100);
      } else {
        console.log('[LS Search] Dependencies not loaded, marking as ready anyway');
        window.InlinePanelReady = true;
      }
    }
    
    checkDependencies();
  }
  
  // Initialize panel for single talk page
  async function initTalkPage() {
    console.log('[LS Search] initTalkPage called');
    
    let attempts = 0;
    const maxAttempts = 20;
    
    function checkDependencies() {
      attempts++;
      
      if (window.InlineStorage && window.InlineUI) {
        injectStyles();
        
        const elements = window.InlineUI.createTalkSearchPanel();
        
        if (!elements) {
          console.log('[LS Search] Could not create talk panel');
          window.InlinePanelReady = true;
          return;
        }
        
        console.log('Init', 'Talk panel created, talkId:', currentTalkId);
        
        initTalkPanel(elements);
        window.InlinePanelReady = true;
      } else if (attempts < maxAttempts) {
        setTimeout(checkDependencies, 100);
      } else {
        console.log('[LS Search] Dependencies not loaded for talk page, marking as ready anyway');
        window.InlinePanelReady = true;
      }
    }
    
    checkDependencies();
  }
  
  // Initialize talk panel with event handlers
  async function initTalkPanel(elements) {
    const { searchInput, results, talkId, partnerName } = elements;
    
    let messages = await window.InlineStorage.loadMessages();

    // Filter messages by current talkId
    let messageCount = messages.filter((msg) => msg.talkId == talkId).length;
    
    // Use cached messages if available, otherwise fetch from network
    if (messageCount === 0) {
      console.log('[LS Search] Starting fetch for talkId:', talkId);
      let additionalMessages = [];
      try {
        additionalMessages = await fetchAllTalkPages(talkId);
      } catch (e) {
        console.log('[LS Search] Error fetching additional pages:', e);
      }
      console.log('[LS Search] Total additional messages fetched:', additionalMessages.length);
      
      if (additionalMessages.length > 0) {
        const mergedMessages = window.InlineStorage.mergeMessages(messages, additionalMessages);
        const addedCount = mergedMessages.length - messages.length;

        // Save even when only legacy records were upgraded with messageId.
        await window.InlineStorage.saveMessages(mergedMessages, {});
        messageCount = mergedMessages.filter((msg) => msg.talkId == talkId).length;
        console.log('[LS Search] Added', addedCount, 'new messages, total:', messageCount);

        // Update stats display with new count
        window.InlineUI.renderTalkStats(messageCount, partnerName);
      }
    } else {
      console.log('[LS Search] Using cached messages for talkId:', talkId, 'count:', messageCount);
    }
    
    // Update stats display
    window.InlineUI.renderTalkStats(messageCount, partnerName);
    
    // Initial state
    if (!messageCount) {
      window.InlineUI.renderEmptyState('no-index');
    }
    
    // Search handler - filter by talkId first, then search text
    if (searchInput && !searchInput._hasTalkSearchListener) {
      searchInput._hasTalkSearchListener = true;
      
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query) {
          performTalkSearch(query, talkId);
        } else {
          if (messageCount > 0) {
            window.InlineUI.renderEmptyState('no-query');
          } else {
            window.InlineUI.renderEmptyState('no-index');
          }
        }
      });
    }
    
    talkKeyboard = setupKeyboardNavigation(searchInput, results, (item) => item.click());

    // Also trigger search on initial value if any
    if (searchInput && searchInput.value.trim()) {
      performTalkSearch(searchInput.value.trim(), talkId);
    }
  }
  
  // Build the dialog base path, dropping a pageN suffix.
  function getTalkBasePath(path) {
    const base = path.replace(/page\d+\/?$/, '');
    return base.endsWith('/') ? base : `${base}/`;
  }

  function getTalkPageNumber(path) {
    const match = path.match(/\/page(\d+)\/?$/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Highest pageN linked by #pages. It is only a hint: the site links the
  // first 11 pages and the last one, so middle pages are still probed.
  function getLastLinkedTalkPage(doc) {
    const pagesRoot = doc.querySelector('#pages');
    if (!pagesRoot) return 0;

    let lastPage = 0;
    pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/page(\d+)\/?$/);
      if (match) {
        lastPage = Math.max(lastPage, parseInt(match[1], 10));
      }
    });
    return lastPage;
  }

  // Stable key for deduplication; mirrors InlineStorage.buildMessageKey.
  function buildTalkMessageKey(msg) {
    const talkId = msg.talkId || currentTalkId || '';
    const messageId = msg.messageId || '';
    if (talkId && messageId) {
      return `id::${talkId}::${messageId}`;
    }
    return `legacy::${msg.partner || ''}::${msg.text || ''}::${msg.timestamp || ''}::${talkId}`;
  }

  function dedupeTalkMessages(messages) {
    const seen = new Set();
    const unique = [];
    messages.forEach((msg) => {
      const key = buildTalkMessageKey(msg);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(msg);
    });
    return unique;
  }

  // Fetch one dialog page with one retry. A failed request resolves to null,
  // which is different from a valid page that has no messages.
  function fetchTalkPageHtml(url, retries = 2) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 20000;

      const retryOrFail = () => {
        if (retries > 0) {
          resolve(fetchTalkPageHtml(url, retries - 1));
        } else {
          resolve(null);
        }
      };

      xhr.onload = () => {
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          typeof xhr.responseText === 'string' &&
          xhr.responseText.length > 0
        ) {
          resolve(xhr.responseText);
        } else {
          retryOrFail();
        }
      };
      xhr.onerror = retryOrFail;
      xhr.ontimeout = retryOrFail;

      try {
        xhr.send();
      } catch {
        retryOrFail();
      }
    });
  }

  // Fetch every page of a talk. #pages links the first 11 pages and the last
  // one; use its highest pageN as a hint, then probe one page past it and keep
  // going only if that page is not empty.
  async function fetchAllTalkPages(talkId) {
    console.log('[LS Search] fetchAllTalkPages called with talkId:', talkId);
    const origin = window.location.origin;
    const talkBasePath = getTalkBasePath(window.location.pathname);
    const baseUrl = `${origin}${talkBasePath}`;
    const allMessages = [];
    const BATCH_SIZE = 10;
    const MAX_TALK_PAGES = 200;

    const currentPageNumber = getTalkPageNumber(window.location.pathname);
    let knownLastPage = Math.max(getLastLinkedTalkPage(document), currentPageNumber || 0);
    let endPage = knownLastPage > 0 ? Math.min(MAX_TALK_PAGES, knownLastPage + 1) : 1;

    const addPageHtml = (html, pageUrl) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const pageHint = getLastLinkedTalkPage(doc);
      if (pageHint > knownLastPage) {
        knownLastPage = pageHint;
        endPage = Math.max(endPage, Math.min(MAX_TALK_PAGES, knownLastPage + 1));
      }

      // A valid page with no messages is the end of the dialog, even if the
      // parser later rejects individual messages.
      if (!doc.querySelector('.user_message')) {
        return false;
      }
      allMessages.push(...extractMessagesFromTalkDocument(doc, currentPartnerName, talkId, pageUrl));
      return true;
    };

    // The base URL is page 1.
    const baseHtml = await fetchTalkPageHtml(baseUrl);
    if (baseHtml) {
      addPageHtml(baseHtml, baseUrl);
    }

    // page1/ is UI page 2, page2/ is UI page 3, and so on.
    let page = 1;
    while (page <= MAX_TALK_PAGES) {
      const batchEnd = Math.min(endPage, page + BATCH_SIZE - 1, MAX_TALK_PAGES);
      const batchPages = [];
      for (let p = page; p <= batchEnd; p++) {
        batchPages.push(p);
      }

      const batchResults = await Promise.all(
        batchPages.map(async (pageNumber) => {
          const pageUrl = `${baseUrl}page${pageNumber}/`;
          return { html: await fetchTalkPageHtml(pageUrl), pageUrl };
        })
      );

      let reachedEnd = false;
      let loadedPages = 0;
      for (const result of batchResults) {
        if (!result.html) continue;
        loadedPages++;
        if (!addPageHtml(result.html, result.pageUrl)) {
          reachedEnd = true;
          break;
        }
      }

      if (reachedEnd) break;
      // Avoid looping forever if the whole batch failed (network/site issue).
      if (loadedPages === 0) {
        console.log('[LS Search] No dialog pages loaded in batch, stopping');
        break;
      }

      page = batchEnd + 1;
      if (page > endPage) {
        endPage = Math.min(MAX_TALK_PAGES, page + BATCH_SIZE - 1);
      }
    }

    return dedupeTalkMessages(allMessages);
  }

  // Extract messages from a talk document
  function extractMessagesFromTalkDocument(doc, defaultPartner, talkId, pageUrl) {
    const result = [];
    const messageElements = doc.querySelectorAll('.user_message');
    console.log('[LS Search] Found', messageElements.length, 'message elements in', pageUrl);
    
    messageElements.forEach((el) => {
      const msg = parseUserMessageFromElement(el, defaultPartner);
      if (msg) {
        msg.talkId = talkId;
        msg.url = pageUrl;
        result.push(msg);
      }
    });
    
    return result;
  }
  
  function parseImagesFromHtml(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const images = doc.querySelectorAll('img');
    
    return Array.from(images).map(img => {
      const src = img.getAttribute('src');
      
      if (!src) {
        return { type: 'image', src: null, description: '[Empty src]' };
      }
      
      if (src.startsWith('data:image/')) {
        const base64Match = src.match(/^data:image\/(\w+);base64,/);
        const format = base64Match ? base64Match[1] : 'unknown';
        const dataLength = src.length;
        return { 
          type: 'image', 
          src: 'base64', 
          description: `[Base64 ${format} ${dataLength} chars]`
        };
      }
      
      return { type: 'image', src: src, description: src };
    });
  }

  function getSelfUserId(doc) {
    if (!doc || !doc.querySelector) return '';

    const link = doc.querySelector('#left_menu a[href^="/users/"]');
    if (!link) return '';

    const match = (link.getAttribute('href') || '').match(/^\/users\/(\d+)(?:\/|$)/);
    return match ? match[1] : '';
  }

  // Parse a message element
  function parseUserMessageFromElement(el, defaultPartner) {
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
      
      if (!headerDiv) {
        return null;
      }
      
      // Get messageId. The #msg_<id> element is usually headerDiv itself,
      // so closest() is safer than parentNode.
      let messageId = null;
      const idSource = headerDiv.closest('[id^="msg_"]') || headerDiv.parentNode;
      if (idSource && idSource.id) {
        const idMatch = String(idSource.id).match(/^msg_(\d+)/);
        if (idMatch) {
          messageId = idMatch[1];
        }
      }
      
      // Get timestamp
      let timestamp = null;
      const timeSpan = headerDiv.querySelector('span');
      if (timeSpan) {
        const dateText = timeSpan.textContent.trim();
        timestamp = parseDate(dateText);
      }
      
      // Get partner
      let partner = defaultPartner;
      const userLink = headerDiv.querySelector('a[href^="/users/"]');
      
      if (userLink) {
        const href = userLink.getAttribute('href') || '';
        const selfUserId = getSelfUserId(el.ownerDocument);
        const isSelf = selfUserId && href.includes(`/users/${selfUserId}/`);

        if (!isSelf) {
          const linkText = userLink.textContent.trim();
          if (linkText) {
            partner = linkText;
          }
        }
      }
      
      // Get message text
      let text = '';
      if (textDiv) {
        text = textDiv.textContent.trim();
        
        // Always extract image URLs and append to text
        const htmlContent = textDiv.innerHTML;
        const parsedImages = parseImagesFromHtml(htmlContent);
        if (parsedImages.length > 0) {
          const imgDescriptions = parsedImages
            .map(img => img.description)
            .filter(Boolean);
          if (imgDescriptions.length > 0) {
            const imageText = '[Image: ' + imgDescriptions.join(', ') + ']';
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
      
      // Don't filter out messages with just images - they are valid
      if (!text) {
        text = '[Image message]';
      }
      
      text = text.replace(/\s+/g, ' ').trim();
      
      return {
        text: text,
        partner: partner,
        timestamp: timestamp,
        messageId: messageId || undefined
      };
    } catch {
      return null;
    }
  }
  
  // Parse date
  function parseDate(dateStr) {
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
  
  // Search within current talk
  function performTalkSearch(query, talkId) {
    window.InlineStorage.loadMessages().then((messages) => {
      // First filter by talkId
      const talkMessages = messages.filter(msg => msg.talkId == talkId);
      
      if (!talkMessages.length) {
        window.InlineUI.renderEmptyState('no-index');
        return;
      }
      
      // Then filter by query
      const queryLower = query.toLowerCase();
      
      const results = talkMessages.filter((msg) => {
        const textMatch = msg.text && msg.text.toLowerCase().includes(queryLower);
        const partnerMatch = msg.partner && msg.partner.toLowerCase().includes(queryLower);
        return textMatch || partnerMatch;
      });
      
      results.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });
      
      const MAX_RESULTS = 200;
      const totalCount = results.length;
      const limited = results.slice(0, MAX_RESULTS);
      
      window.InlineUI.renderResults(limited, query, totalCount, MAX_RESULTS);
      if (talkKeyboard) talkKeyboard.reset();
    });
  }
  
  // Inject CSS
  function injectStyles() {
    const styleId = 'ls-inline-styles';
    if (document.getElementById(styleId)) {
      console.log('Styles', 'Styles already injected');
      return;
    }
    
    console.log('Styles', 'Injecting styles');
    
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = chrome.runtime ? chrome.runtime.getURL('inline-styles.css') : 'inline-styles.css';
    
    console.log('Styles', 'CSS href', { href: link.href, hasChromeRuntime: !!chrome.runtime });
    
    // For userscript without extension, try to load from same directory
    if (!chrome.runtime) {
      // Try to find the stylesheet in current directory
      const scripts = document.querySelectorAll('script[src*="inline-panel"]');
      console.log('Styles', 'Looking for inline-panel scripts', { found: scripts.length });
      
      if (scripts.length > 0) {
        const baseUrl = scripts[0].src.replace(/[^/]*$/, '');
        link.href = baseUrl + 'inline-styles.css';
        console.log('Styles', 'Using baseUrl for styles', { baseUrl, fullUrl: link.href });
      }
    }
    
    document.head.appendChild(link);
    console.log('Styles', 'Styles link appended to head');
  }
  
  function attachIndexProgressListener() {
    if (
      indexProgressListenerAttached ||
      typeof chrome === 'undefined' ||
      !chrome.runtime ||
      !chrome.runtime.onMessage
    ) {
      return;
    }

    indexProgressListenerAttached = true;
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.action !== 'indexProgress') return;

      const indexBtn = document.getElementById('ls-indexBtn');
      if (indexBtn && message.total) {
        indexBtn.textContent = `Индексация ${message.done}/${message.total}...`;
      }

      const cancelBtn = document.getElementById('ls-cancelBtn');
      if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
      }

      if (message.done < message.total) {
        window.InlineUI.showStatus(
          `Индексация: ${message.done}/${message.total} диалогов, ${
            message.messageCount || 0
          } сообщений`,
          'success',
        );
      }
    });
  }

  // Initialize the panel
  async function initPanel(elements) {
    const { indexBtn, cancelBtn, clearBtn, searchInput, results } = elements;

    attachIndexProgressListener();

    // Load stored messages
    const messages = await window.InlineStorage.loadMessages();
    const stats = window.InlineStorage.getStats(messages);
    window.InlineUI.renderStats(stats);
    
    const lastIndexedAt = await window.InlineStorage.loadLastIndexedAt();
    window.InlineUI.renderLastIndexedAt(lastIndexedAt);
    await updateIndexSize();

    const readNoticeSeen = await window.InlineStorage.loadReadNoticeSeen();
    if (!readNoticeSeen) {
      window.InlineUI.showReadNotice();
    }

    maybeShowStaleBanner(lastIndexedAt, stats.messagesCount);
    
    const lastQuery = await window.InlineStorage.loadLastQuery();
    if (searchInput) {
      searchInput.value = lastQuery;
    }
    
    // Initial state
    if (!messages.length) {
      window.InlineUI.renderEmptyState('no-index');
    } else if (lastQuery.trim()) {
      performSearch(lastQuery.trim());
    } else {
      window.InlineUI.renderEmptyState('no-query');
    }
    
    // Event handlers - always attach (overwrite any existing)
    if (indexBtn) {
      // Remove old listener if exists
      if (indexBtn._clickListener) {
        indexBtn.removeEventListener('click', indexBtn._clickListener);
      }
      // Create new listener
      indexBtn._clickListener = onIndexClick;
      indexBtn.addEventListener('click', onIndexClick);
      console.log('Init', 'Attached click handler to indexBtn (overwritten)');
    }
    
    if (clearBtn) {
      // Remove old listener if exists
      if (clearBtn._clickListener) {
        clearBtn.removeEventListener('click', clearBtn._clickListener);
      }
      // Create new listener
      clearBtn._clickListener = onClearClick;
      clearBtn.addEventListener('click', onClearClick);
      console.log('Init', 'Attached click handler to clearBtn (overwritten)');
    }

    if (cancelBtn) {
      if (cancelBtn._clickListener) {
        cancelBtn.removeEventListener('click', cancelBtn._clickListener);
      }
      cancelBtn._clickListener = onCancelClick;
      cancelBtn.addEventListener('click', onCancelClick);
    }

    const staleRefresh = document.getElementById('ls-staleRefresh');
    if (staleRefresh) {
      staleRefresh.addEventListener('click', () => {
        window.InlineUI.hideStaleBanner();
        onIndexClick();
      });
    }

    const staleDismiss = document.getElementById('ls-staleDismiss');
    if (staleDismiss) {
      staleDismiss.addEventListener('click', () => {
        window.InlineUI.hideStaleBanner();
      });
    }

    const readNoticeDismiss = document.getElementById('ls-readNoticeDismiss');
    if (readNoticeDismiss) {
      readNoticeDismiss.addEventListener('click', async () => {
        await window.InlineStorage.saveReadNoticeSeen();
        window.InlineUI.hideReadNotice();
      });
    }

    const indexErrors = document.getElementById('ls-indexErrors');
    if (indexErrors) {
      indexErrors.addEventListener('click', (event) => {
        if (event.target.closest('#ls-retryBtn')) {
          onIndexClick();
        }
      });
    }

    if (searchInput && !searchInput._hasSearchListener) {
      searchInput._hasSearchListener = true;
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
          const query = e.target.value.trim();
          if (query) {
            await window.InlineStorage.saveLastQuery(query);
            performSearch(query);
          } else {
            await window.InlineStorage.saveLastQuery('');
            if (messages.length > 0) {
              window.InlineUI.renderEmptyState('no-query');
            } else {
              window.InlineUI.renderEmptyState('no-index');
            }
          }
        }, 300);
      });
    }

    if (results && !results._hasResultsClickListener) {
      results._hasResultsClickListener = true;
      results.addEventListener('click', onResultsClick);
    }

    mainKeyboard = setupKeyboardNavigation(searchInput, results, (item) => item.click());
  }
   
  // Cancel a running background indexing pass.
  function onCancelClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ action: 'cancelIndex' }, () => {
        void chrome.runtime.lastError;
      });
      window.InlineUI.showStatus('Останавливаю индексацию...', 'success');
    }
  }

  // Index button click handler
  async function onIndexClick() {
    const indexBtn = document.getElementById('ls-indexBtn');
    if (!indexBtn) {
      return;
    }
    
    indexBtn.disabled = true;
    indexBtn.textContent = 'Индексация...';

    window.InlineUI.hideStaleBanner();
    window.InlineUI.clearIndexErrors();
    window.InlineUI.hideReadNotice();
    window.InlineStorage.saveReadNoticeSeen().catch(() => {});

    const cancelBtn = document.getElementById('ls-cancelBtn');
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-block';
    }
    
    // Check if we're running as extension (has chrome.runtime) or as userscript
    if (chrome.runtime && chrome.runtime.id) {
      // Use background script for full indexing (same as popup)
      await indexViaBackgroundScript();
      
      // Reset button and exit
      if (indexBtn) {
        indexBtn.disabled = false;
        indexBtn.textContent = 'Индексировать';
      }
      if (cancelBtn) {
        cancelBtn.style.display = 'none';
      }
      return;
    }
    
    console.log('Index', 'No chrome.runtime - using fallback extraction');
    
    try {
      // Use the content script extraction logic
      // Since we're in the page context, we can call the functions directly
      let messages = [];
      
      if (typeof window.extractAllMessages === 'function') {
        messages = await window.extractAllMessages();
      } else {
        // Fallback: try to extract from current page
        messages = await extractFromCurrentPage();
      }
      
      // Merge with existing messages
      const existingMessages = await window.InlineStorage.loadMessages();
      const allMessages = window.InlineStorage.mergeMessages(existingMessages, messages);
      const addedCount = allMessages.length - existingMessages.length;
      const now = Date.now();

      await window.InlineStorage.saveMessages(allMessages, { indexedAt: now });
      
      const stats = window.InlineStorage.getStats(allMessages);
      window.InlineUI.renderStats(stats);
      window.InlineUI.renderLastIndexedAt(now);
      window.InlineUI.clearIndexErrors();
      await updateIndexSize();
      
      if (addedCount > 0) {
        window.InlineUI.showStatus(`Добавлено ${addedCount} сообщений`, 'success');
      } else {
        window.InlineUI.showStatus('Новых сообщений не найдено', 'success');
      }
      
      const searchInput = document.getElementById('ls-searchInput');
      if (searchInput && searchInput.value.trim()) {
        performSearch(searchInput.value.trim());
      } else {
        window.InlineUI.renderEmptyState('no-query');
      }
      
    } catch (error) {
      console.error('[LS Search] Indexing error:', error);
      window.InlineUI.showStatus('Ошибка: ' + error.message, 'error');
    } finally {
      if (indexBtn) {
        indexBtn.disabled = false;
        indexBtn.textContent = 'Индексировать';
      }
      if (cancelBtn) {
        cancelBtn.style.display = 'none';
      }
    }
  }
  
  // Index via background script (full indexing like popup)
  async function indexViaBackgroundScript() {
    console.log('Index-BG', 'Starting indexViaBackgroundScript');
    
    return new Promise((resolve) => {
      console.log('Index-BG', 'Sending indexAllSections request to background');
      
      chrome.runtime.sendMessage({ action: 'indexAllSections' }, (response) => {
        (async () => {
          console.log('Index-BG', 'Got response from background', { response: response ? 'exists' : 'null' });
          try {
            if (chrome.runtime.lastError) {
              console.log('Index-BG', 'Runtime error', { error: chrome.runtime.lastError.message });
              window.InlineUI.showStatus('Ошибка: ' + chrome.runtime.lastError.message, 'error');
              resolve();
              return;
            }
            
            if (response && response.error) {
              console.log('Index-BG', 'Response error', { error: response.error });
              window.InlineUI.showStatus(response.error, 'error');
              resolve();
              return;
            }
            
            if (response && Array.isArray(response.messages)) {
              const newMessages = response.messages;
              const indexedSections = response.indexedSections || [];
              
              console.log('Index-BG', 'Indexed sections', {
                sections: indexedSections,
                totalFromBackground: newMessages.length,
              });
              
              // Merge with existing messages
              const existingMessages = await window.InlineStorage.loadMessages();
              const allMessages = window.InlineStorage.mergeMessages(existingMessages, newMessages);
              const addedCount = allMessages.length - existingMessages.length;
              const now = Date.now();

              console.log('Index-BG', 'Final result', {
                existingCount: existingMessages.length,
                newCount: newMessages.length,
                addedCount: addedCount,
                totalInStorage: allMessages.length,
              });

              const saved = await window.InlineStorage.saveMessages(allMessages, {
                indexedAt: now,
              });
              if (!saved) {
                window.InlineUI.showStatus(
                  'Не удалось сохранить индекс: проверьте квоту хранилища',
                  'error',
                );
                resolve();
                return;
              }
              
              const stats = window.InlineStorage.getStats(allMessages);
              const skippedTalks = response.skippedTalks || 0;
              const errors = Array.isArray(response.errors) ? response.errors : [];

              console.log('Index-BG', 'Stats after save', {
                dialogsCount: stats.dialogsCount,
                messagesCount: stats.messagesCount,
                skippedTalks,
                errors: errors.length,
              });
              window.InlineUI.renderStats(stats);
              window.InlineUI.renderLastIndexedAt(now);
              await updateIndexSize();

              if (errors.length > 0) {
                window.InlineUI.renderIndexErrors(errors);
              } else {
                window.InlineUI.clearIndexErrors();
              }

              if (response.cancelled) {
                window.InlineUI.showStatus(
                  `Индексация остановлена. Добавлено ${addedCount} сообщений`,
                  'success',
                );
              } else if (errors.length > 0) {
                console.error('[LS Search] Indexing errors:', errors);
                window.InlineUI.showStatus(
                  `Готово, но ${errors.length} диалогов с ошибками. Добавлено ${addedCount} сообщений`,
                  'error',
                );
              } else if (addedCount > 0) {
                window.InlineUI.showStatus(
                  `Добавлено ${addedCount} сообщений из ${indexedSections.length} разделов; пропущено ${skippedTalks} без изменений`,
                  'success',
                );
              } else if (skippedTalks > 0) {
                window.InlineUI.showStatus(
                  `Всё актуально: пропущено ${skippedTalks} диалогов без изменений`,
                  'success',
                );
              } else {
                window.InlineUI.showStatus('Новых сообщений не найдено', 'success');
              }
              
              const searchInput = document.getElementById('ls-searchInput');
              if (searchInput && searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
              } else {
              window.InlineUI.renderEmptyState('no-query');
              }
              
              resolve();
            } else {
              console.log('Index-BG', 'No messages in response');
              window.InlineUI.showStatus('Не удалось извлечь сообщения', 'error');
              resolve();
            }
          } catch (err) {
            console.log('Index-BG', 'Error processing response', { error: err.message });
            console.error('[LS Search] Indexing error:', err);
            window.InlineUI.showStatus('Ошибка: ' + err.message, 'error');
            resolve();
          }
        })();
      });
    });
  }
  // Clear button click handler
  async function onClearClick() {
    const confirmed = window.confirm('Очистить все индексированные сообщения?');
    if (!confirmed) return;
    
    try {
      await window.InlineStorage.clearMessages();
      
      window.InlineUI.renderStats({ dialogsCount: 0, messagesCount: 0 });
      window.InlineUI.renderLastIndexedAt(null);
      window.InlineUI.renderIndexSize(0);
      window.InlineUI.clearIndexErrors();
      window.InlineUI.hideStaleBanner();
      lastMainSearch = { query: '', results: [], limit: 200 };
      if (mainKeyboard) mainKeyboard.reset();
      
      const searchInput = document.getElementById('ls-searchInput');
      if (searchInput) {
        searchInput.value = '';
      }
      
      window.InlineUI.renderEmptyState('no-index');
      window.InlineUI.showStatus('Все данные очищены', 'success');
    } catch (error) {
      console.error('[LS Search] Clear error:', error);
      window.InlineUI.showStatus('Ошибка при очистке', 'error');
    }
  }
  
  // Perform search
  function performSearch(query) {
    window.InlineStorage.loadMessages().then((messages) => {
      if (!messages.length) {
        window.InlineUI.renderEmptyState('no-index');
        return;
      }

      const queryLower = query.toLowerCase();

      const results = messages.filter((msg) => {
        const textMatch = msg.text && msg.text.toLowerCase().includes(queryLower);
        const partnerMatch = msg.partner && msg.partner.toLowerCase().includes(queryLower);
        return textMatch || partnerMatch;
      });

      results.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });

      lastMainSearch = { query, results, limit: 200 };
      renderMainSearchResults();
    });
  }

  function renderMainSearchResults() {
    const { query, results, limit } = lastMainSearch;
    window.InlineUI.renderResults(
      results.slice(0, limit),
      query,
      results.length,
      limit,
      true,
    );
    if (mainKeyboard) mainKeyboard.reset();
  }

  function loadMoreMainSearch() {
    if (!lastMainSearch.query) return;
    lastMainSearch.limit += 200;
    renderMainSearchResults();
  }

  function normalizeSearchText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function findMessageOnPage(html, pageUrl, msg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = doc.querySelectorAll('.user_message');
    const wantedText = normalizeSearchText(msg.text);

    for (const el of elements) {
      const parsed = parseUserMessageFromElement(el, msg.partner);
      if (!parsed) continue;

      const candidateText = normalizeSearchText(parsed.text);
      const exactText = candidateText === wantedText;
      // Old background records did not append image markers to text messages.
      const textWithImages = candidateText.startsWith(`${wantedText} [Image:`);
      if (!exactText && !textWithImages) continue;

      if (
        msg.timestamp != null &&
        parsed.timestamp != null &&
        parsed.timestamp !== msg.timestamp
      ) {
        continue;
      }

      const idEl = el.querySelector('[id^="msg_"]');
      const messageId = idEl ? idEl.id.replace(/^msg_/, '') : parsed.messageId;
      if (messageId) {
        return `${pageUrl}#msg_${messageId}`;
      }
    }

    return null;
  }

  async function resolveMessageTarget(msg) {
    if (!msg) return null;
    if (msg.messageId && msg.url) {
      return `${msg.url}#msg_${msg.messageId}`;
    }
    if (!msg.talkId) {
      return msg.url || null;
    }

    const key = buildTalkMessageKey(msg);
    if (resolvedMessageTargets.has(key)) {
      return resolvedMessageTargets.get(key);
    }

    const baseUrl = `${window.location.origin}/users/my_talks/${msg.talkId}/`;
    const baseHtml = await fetchTalkPageHtml(baseUrl);
    if (!baseHtml) {
      return msg.url || baseUrl;
    }

    const foundOnBase = findMessageOnPage(baseHtml, baseUrl, msg);
    if (foundOnBase) {
      resolvedMessageTargets.set(key, foundOnBase);
      return foundOnBase;
    }

    const baseDoc = new DOMParser().parseFromString(baseHtml, 'text/html');
    let lastLinkedPage = getLastLinkedTalkPage(baseDoc);
    let maxPage = lastLinkedPage > 0 ? Math.min(200, lastLinkedPage + 1) : 200;
    let failures = 0;

    for (let page = 1; page <= maxPage; page++) {
      const pageUrl = `${baseUrl}page${page}/`;
      const html = await fetchTalkPageHtml(pageUrl);
      if (!html) {
        failures++;
        if (failures >= 3) break;
        continue;
      }
      failures = 0;

      const found = findMessageOnPage(html, pageUrl, msg);
      if (found) {
        resolvedMessageTargets.set(key, found);
        return found;
      }

      const pageDoc = new DOMParser().parseFromString(html, 'text/html');
      if (!pageDoc.querySelector('.user_message')) {
        break;
      }

      if (lastLinkedPage === 0) {
        const hint = getLastLinkedTalkPage(pageDoc);
        if (hint > 0) {
          lastLinkedPage = hint;
          maxPage = Math.min(200, lastLinkedPage + 1);
        }
      }
    }

    // At least open the dialog when the message cannot be located.
    return baseUrl;
  }

  async function onResultsClick(event) {
    const loadMore = event.target.closest('#ls-loadMoreBtn');
    if (loadMore) {
      event.preventDefault();
      loadMoreMainSearch();
      return;
    }

    const link = event.target.closest('.ls-result-item');
    if (!link) return;

    const index = Number(link.dataset.resultIndex);
    const msg = lastMainSearch.results[index];
    if (!msg) return;

    // New records already have the exact page and message id.
    if (msg.messageId && msg.url) {
      return;
    }

    event.preventDefault();
    if (link.dataset.resolving === '1') return;

    link.dataset.resolving = '1';
    link.style.opacity = '0.6';
    window.InlineUI.showStatus('Ищу сообщение в диалоге...', 'success');

    try {
      const target = await resolveMessageTarget(msg);
      if (!target) {
        window.InlineUI.showStatus('Не удалось найти сообщение', 'error');
        return;
      }

      // Navigate the current tab, not a new one.
      window.location.href = target;
    } catch (e) {
      console.error('[LS Search] Could not resolve message URL:', e);
      window.InlineUI.showStatus('Ошибка поиска сообщения: ' + e.message, 'error');
    } finally {
      delete link.dataset.resolving;
      link.style.opacity = '';
    }
  }
  
  // Fallback extraction from current page
  async function extractFromCurrentPage() {
    const messages = [];
    
    // Try to extract from talks list
    const talkRows = document.querySelectorAll('#talks_table tr[id^="talk_"]');
    
    talkRows.forEach((row) => {
      const talkId = row.id.replace('talk_', '');
      const msg = parseTalkRow(row, talkId);
      if (msg) {
        messages.push(msg);
      }
    });
    
    return messages;
  }
  
  // Parse talk row (simplified version from content.js)
  function parseTalkRow(row, talkId) {
    try {
      // Get partner username
      let partner = '';
      const firstCol = row.querySelector('td:first-child');
      
      if (firstCol) {
        const allLinks = firstCol.querySelectorAll('a[href^="/users/"]');
        
        let partnerLink = null;
        if (allLinks.length >= 2) {
          partnerLink = allLinks[1];
        } else if (allLinks.length === 1 && allLinks[0].textContent.trim()) {
          partnerLink = allLinks[0];
        }
        
        if (partnerLink) {
          partner = partnerLink.textContent.trim();
        }
      }
      
      // Get last message text
      let text = '';
      const messageDiv = document.getElementById('talk_text_' + talkId);
      if (messageDiv) {
        const clone = messageDiv.cloneNode(true);
        clone.querySelectorAll('img').forEach(function(img) { img.remove(); });
        text = clone.textContent.trim();
      }
      
      // Get timestamp
      let timestamp = null;
      const secondCol = row.querySelector('td:last-child');
      if (secondCol) {
        const timeSpan = secondCol.querySelector('.clear span');
        if (timeSpan) {
          const dateText = timeSpan.textContent.trim();
          timestamp = parseRussianDate(dateText);
        }
      }
      
      text = text.replace(/\s+/g, ' ').trim();
      
      return {
        text: text,
        partner: partner,
        timestamp: timestamp,
        talkId: talkId,
        url: '/users/my_talks/' + talkId + '/'
      };
      
    } catch {
      return null;
    }
  }
  
  // Parse Russian date
  function parseRussianDate(dateStr) {
    if (!dateStr) return null;
    
    dateStr = dateStr.trim();
    
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      const shortDateMatch = dateStr.match(/(\d{1,2})\s*(&nbsp;)?\s*(\w+)\s+(\d{1,2}):(\d{2})/);
      if (shortDateMatch) {
        const day = parseInt(shortDateMatch[1]);
        const monthName = shortDateMatch[3].replace('&nbsp;', ' ');
        const hours = parseInt(shortDateMatch[4]);
        const minutes = parseInt(shortDateMatch[5]);
        
        const monthNum = getRussianMonth(monthName);
        if (monthNum !== -1) {
          return new Date(currentYear, monthNum, day, hours, minutes).getTime();
        }
      }
      
      const fullDateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (fullDateMatch) {
        const day = parseInt(fullDateMatch[1]);
        const monthName = fullDateMatch[2];
        const year = parseInt(fullDateMatch[3]);
        const hours = parseInt(fullDateMatch[4]);
        const minutes = parseInt(fullDateMatch[5]);
        
        const monthNum = getRussianMonth(monthName);
        if (monthNum !== -1) {
          return new Date(year, monthNum, day, hours, minutes).getTime();
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  function getRussianMonth(monthName) {
    var months = {
      'января': 0, 'янв': 0,
      'февраля': 1, 'фев': 1,
      'марта': 2, 'мар': 2,
      'апреля': 3, 'апр': 3,
      'мая': 4,
      'июня': 5, 'июн': 5,
      'июля': 6, 'июл': 6,
      'августа': 7, 'авг': 7,
      'сентября': 8, 'сен': 8,
      'октября': 9, 'окт': 9,
      'ноября': 10, 'ноя': 10,
      'декабря': 11, 'дек': 11
    };
    
    var normalized = monthName.toLowerCase().replace('&nbsp;', '');
    return months[normalized] !== undefined ? months[normalized] : -1;
  }
  
  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure other scripts are ready
    setTimeout(init, 100);
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseImagesFromHtml,
      getSelfUserId,
      parseUserMessageFromElement,
      parseDate,
      extractMessagesFromTalkDocument,
      getTalkBasePath,
      buildTalkMessageKey,
      dedupeTalkMessages,
      fetchAllTalkPages,
      findMessageOnPage,
      resolveMessageTarget,
      setupKeyboardNavigation,
      isEditableElement,
    };
  }
  
})();

