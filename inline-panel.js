// Inline Panel - Main entry point
// Injects search functionality directly into the page
// Uses localStorage instead of chrome.storage

(function() {
  'use strict';
  
  // Current talk page state
  let currentTalkId = null;
  let currentPartnerName = '';
  
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
  
  // Wait for DOM and dependencies
  function init() {
    console.log('[LS Search] inline-panel init called, readyState:', document.readyState);
    
    const path = window.location.pathname;
    
    // Check if this is a single talk page
    if (isSingleTalkPath(path)) {
      console.log('[LS Search] Single talk page detected, initializing talk panel');
      currentTalkId = getTalkIdFromPath(path);
      currentPartnerName = getPartnerNameFromPage();
      console.log('[LS Search] Current talkId:', currentTalkId, 'Partner:', currentPartnerName);
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
    console.log('[LS Search] initTalkPanel called with elements:', elements);
    const { searchInput, talkId, partnerName } = elements;
    
    let messages = await window.InlineStorage.loadMessages();
    
    // Filter messages by current talkId
    let talkMessages = messages.filter(msg => msg.talkId == talkId);
    let messageCount = talkMessages.length;
    
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
        // Merge with existing messages - use text+timestamp for deduplication since messageId might not be unique
        const existingTexts = new Set(talkMessages.map(m => `${m.text?.substring(0, 50)}_${m.timestamp}`));
        const newMsgs = additionalMessages.filter(m => {
          const key = `${m.text?.substring(0, 50)}_${m.timestamp}`;
          return !existingTexts.has(key);
        });
        
        if (newMsgs.length > 0) {
          const allTalkMessages = [...talkMessages, ...newMsgs];
          await window.InlineStorage.saveMessages([...messages, ...newMsgs], {});
          talkMessages = allTalkMessages;
          messageCount = allTalkMessages.length;
          console.log('[LS Search] Added', newMsgs.length, 'new messages, total:', messageCount);
          
          // Update stats display with new count
          window.InlineUI.renderTalkStats(messageCount, partnerName);
        }
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
    
    // Also trigger search on initial value if any
    if (searchInput && searchInput.value.trim()) {
      performTalkSearch(searchInput.value.trim(), talkId);
    }
  }
  
  // Fetch all pages of a talk
  async function fetchAllTalkPages(talkId) {
    console.log('[LS Search] fetchAllTalkPages called with talkId:', talkId);
    const allMessages = [];
    const origin = window.location.origin;
    const path = window.location.pathname;
    const isHidden = path.includes('/hide/');
    const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';
    
    // Normalize URL to avoid duplicates (remove trailing slash)
    const normalizeUrl = (url) => {
      return url.replace(/\/+$/, '') || '/';
    };
    
    // Get all page URLs from pagination
    const pagesDiv = document.getElementById('pages');
    const urlSet = new Set();
    
    // Add current page URL (normalized)
    urlSet.add(normalizeUrl(window.location.href));
    
    if (pagesDiv) {
      const pageLinks = pagesDiv.querySelectorAll('a.page[href*="/users/my_talks/"]');
      pageLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          urlSet.add(normalizeUrl(href));
        }
      });
    }
    
    // Also try to add base talk URL and numbered pages
    urlSet.add(normalizeUrl(`${origin}${talksBasePath}${talkId}/`));
    
    // Try adding page1-page10 URLs
    for (let i = 1; i <= 10; i++) {
      urlSet.add(normalizeUrl(`${origin}${talksBasePath}${talkId}/page${i}/`));
    }
    
    // Also add URL variations
    urlSet.add(normalizeUrl(`${origin}${talksBasePath}${talkId}`));
    urlSet.add(normalizeUrl(`${origin}${talksBasePath}${talkId}/`));
    
    console.log('[LS Search] URLs to fetch:', Array.from(urlSet));
    
    const urls = Array.from(urlSet);
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(rawUrl => {
          return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', rawUrl, true);
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText && xhr.responseText.length >= 1000) {
                resolve({ html: xhr.responseText, url: rawUrl });
              } else {
                resolve(null);
              }
            };
            xhr.onerror = () => resolve(null);
            xhr.send();
          });
        })
      );
      
      batchResults.filter(Boolean).forEach(({ html, url }) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pageMessages = extractMessagesFromTalkDocument(doc, currentPartnerName, talkId, url);
        console.log('[LS Search] Got', pageMessages.length, 'messages from', url);
        allMessages.push(...pageMessages);
      });
    }

    return allMessages;
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
      
      // Get messageId
      let messageId = null;
      const wrapper = headerDiv.parentNode;
      if (wrapper && wrapper.id) {
        const idMatch = String(wrapper.id).match(/^msg_(\d+)/);
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
        const href = userLink.getAttribute('href');
        if (href && !href.includes('/83061/')) {
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
    } catch (e) {
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
    } catch (e) {
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
        const baseUrl = scripts[0].src.replace(/[^\/]*$/, '');
        link.href = baseUrl + 'inline-styles.css';
        console.log('Styles', 'Using baseUrl for styles', { baseUrl, fullUrl: link.href });
      }
    }
    
    document.head.appendChild(link);
    console.log('Styles', 'Styles link appended to head');
  }
  
  // Initialize the panel
  async function initPanel(elements) {
    const { indexBtn, clearBtn, searchInput } = elements;
    
    // Load stored messages
    const messages = await window.InlineStorage.loadMessages();
    const stats = window.InlineStorage.getStats(messages);
    window.InlineUI.renderStats(stats);
    
    const lastIndexedAt = await window.InlineStorage.loadLastIndexedAt();
    window.InlineUI.renderLastIndexedAt(lastIndexedAt);
    
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
    
    // Keyboard navigation
    let activeIndex = -1;
    const MAX_RESULTS = 200;
    
    document.addEventListener('keydown', (e) => {
      if (e.target !== searchInput) return;
      
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        
        const items = Array.from(document.querySelectorAll('.ls-result-item'));
        if (!items.length) return;
        
        if (e.key === 'ArrowDown') {
          activeIndex = (activeIndex + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
          activeIndex = (activeIndex - 1 + items.length) % items.length;
        }
        
        // Update active state
        items.forEach((item, i) => {
          if (i === activeIndex) {
            item.classList.add('ls-result-item--active');
            item.scrollIntoView({ block: 'nearest' });
          } else {
            item.classList.remove('ls-result-item--active');
          }
        });
      }
    });
  }
   
  // Index button click handler
  async function onIndexClick(event) {
    const indexBtn = document.getElementById('ls-indexBtn');
    if (!indexBtn) {
      return;
    }
    
    indexBtn.disabled = true;
    indexBtn.textContent = 'Индексация...';
    
    // Check if we're running as extension (has chrome.runtime) or as userscript
    if (chrome.runtime && chrome.runtime.id) {
      // Use background script for full indexing (same as popup)
      await indexViaBackgroundScript();
      
      // Reset button and exit
      if (indexBtn) {
        indexBtn.disabled = false;
        indexBtn.textContent = 'Индексировать';
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
      const messageMap = new Map();
      
      existingMessages.forEach((msg) => {
        messageMap.set(window.InlineStorage.buildMessageKey(msg), msg);
      });
      
      let addedCount = 0;
      messages.forEach((msg) => {
        const key = window.InlineStorage.buildMessageKey(msg);
        if (!messageMap.has(key)) {
          messageMap.set(key, msg);
          addedCount++;
        }
      });
      
      const allMessages = Array.from(messageMap.values());
      const now = Date.now();
      
      await window.InlineStorage.saveMessages(allMessages, { indexedAt: now });
      
      const stats = window.InlineStorage.getStats(allMessages);
      window.InlineUI.renderStats(stats);
      window.InlineUI.renderLastIndexedAt(now);
      
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
    }
  }
  
  // Index via background script (full indexing like popup)
  async function indexViaBackgroundScript() {
    console.log('Index-BG', 'Starting indexViaBackgroundScript');
    
    return new Promise((resolve, reject) => {
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
              const messageMap = new Map();
              
              existingMessages.forEach((msg) => {
                messageMap.set(window.InlineStorage.buildMessageKey(msg), msg);
              });
              
              let addedCount = 0;
              newMessages.forEach((msg) => {
                const key = window.InlineStorage.buildMessageKey(msg);
                if (!messageMap.has(key)) {
                  messageMap.set(key, msg);
                  addedCount++;
                }
              });
              
              const allMessages = Array.from(messageMap.values());
              const now = Date.now();
              
              console.log('Index-BG', 'Final result', {
                existingCount: existingMessages.length,
                newCount: newMessages.length,
                addedCount: addedCount,
                totalInStorage: allMessages.length,
              });
              
              await window.InlineStorage.saveMessages(allMessages, { indexedAt: now });
              
              const stats = window.InlineStorage.getStats(allMessages);
              console.log('Index-BG', 'Stats after save', {
                dialogsCount: stats.dialogsCount,
                messagesCount: stats.messagesCount,
              });
              window.InlineUI.renderStats(stats);
              window.InlineUI.renderLastIndexedAt(now);
              
              if (addedCount > 0) {
                window.InlineUI.showStatus(`Добавлено ${addedCount} сообщений из ${indexedSections.length} разделов`, 'success');
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
    // This is async but we'll handle it synchronously for simplicity
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
      
      const MAX_RESULTS = 200;
      const totalCount = results.length;
      const limited = results.slice(0, MAX_RESULTS);
      
      window.InlineUI.renderResults(limited, query, totalCount, MAX_RESULTS);
    });
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
      
    } catch (e) {
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
    } catch (e) {
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
    module.exports = { parseImagesFromHtml };
  }
  
})();

