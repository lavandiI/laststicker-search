// Inline Panel - Main entry point
// Injects search functionality directly into the page
// Uses localStorage instead of chrome.storage

// Debug logging function
function lsDebugLogPanel(section, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, section, message, data };
  
  try {
    let logs = JSON.parse(localStorage.getItem('ls-debug-logs') || '[]');
    logs.push(logEntry);
    if (logs.length > 50) logs = logs.slice(-50);
    localStorage.setItem('ls-debug-logs', JSON.stringify(logs));
  } catch (e) {}
  
  console.log(`[LS-DEBUG-PANEL] ${section}: ${message}`, data || '');
}

(function() {
  'use strict';
  
  // Prevent multiple initialization
  if (window.InlinePanelReady) {
    console.log('[LS Search] inline-panel already initialized, skipping');
    return;
  }
  window.InlinePanelReady = true;
  
  // Wait for DOM and dependencies
  function init() {
    console.log('[LS Search] inline-panel init called, readyState:', document.readyState);
    
    // Check if we're on the right page (my_talks)
    const path = window.location.pathname;
    lsDebugLogPanel('Init', 'Page path', { path: path });
    
    if (!path.startsWith('/users/my_talks/') || path.includes('/hide/')) {
      console.log('[LS Search] Not on talks page, skipping');
      lsDebugLogPanel('Init', 'Not on talks page, exiting');
      return;
    }
    
    console.log('[LS Search] Initializing inline panel...');
    lsDebugLogPanel('Init', 'On talks page, starting initialization');
    
    // Check if InlineStorage and InlineUI are available
    lsDebugLogPanel('Init', 'Checking dependencies', {
      InlineStorage: typeof window.InlineStorage,
      InlineUI: typeof window.InlineUI
    });
    
    // Wait for InlineStorage and InlineUI to be available
    let attempts = 0;
    const maxAttempts = 20;
    
    function checkDependencies() {
      attempts++;
      
      console.log('[LS Search] checkDependencies attempt', attempts, '/', maxAttempts, '- InlineStorage:', !!window.InlineStorage, 'InlineUI:', !!window.InlineUI);
      lsDebugLogPanel('Deps', `Check attempt ${attempts}/${maxAttempts}`, {
        InlineStorage: !!window.InlineStorage,
        InlineUI: !!window.InlineUI
      });
      
      if (window.InlineStorage && window.InlineUI) {
        lsDebugLogPanel('Deps', 'Dependencies found, injecting styles');
        // Inject styles
        injectStyles();
        
        // Create UI panel
        const elements = window.InlineUI.createSearchPanel();
        
        if (!elements) {
          console.log('[LS Search] Could not create panel');
          lsDebugLogPanel('Init', 'ERROR: createSearchPanel returned null');
          return;
        }
        
        lsDebugLogPanel('Init', 'Panel created successfully', {
          hasIndexBtn: !!elements.indexBtn,
          hasClearBtn: !!elements.clearBtn,
          hasSearchInput: !!elements.searchInput
        });
        
        // Initialize with stored data
        initPanel(elements);
      } else if (attempts < maxAttempts) {
        lsDebugLogPanel('Deps', 'Dependencies not ready, retrying in 100ms');
        setTimeout(checkDependencies, 100);
      } else {
        console.log('[LS Search] Dependencies not loaded');
        lsDebugLogPanel('Deps', 'ERROR: Dependencies not loaded after max attempts');
      }
    }
    
    checkDependencies();
  }
  
  // Inject CSS
  function injectStyles() {
    const styleId = 'ls-inline-styles';
    if (document.getElementById(styleId)) {
      lsDebugLogPanel('Styles', 'Styles already injected');
      return;
    }
    
    lsDebugLogPanel('Styles', 'Injecting styles');
    
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = chrome.runtime ? chrome.runtime.getURL('inline-styles.css') : 'inline-styles.css';
    
    lsDebugLogPanel('Styles', 'CSS href', { href: link.href, hasChromeRuntime: !!chrome.runtime });
    
    // For userscript without extension, try to load from same directory
    if (!chrome.runtime) {
      // Try to find the stylesheet in current directory
      const scripts = document.querySelectorAll('script[src*="inline-panel"]');
      lsDebugLogPanel('Styles', 'Looking for inline-panel scripts', { found: scripts.length });
      
      if (scripts.length > 0) {
        const baseUrl = scripts[0].src.replace(/[^\/]*$/, '');
        link.href = baseUrl + 'inline-styles.css';
        lsDebugLogPanel('Styles', 'Using baseUrl for styles', { baseUrl, fullUrl: link.href });
      }
    }
    
    document.head.appendChild(link);
    lsDebugLogPanel('Styles', 'Styles link appended to head');
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
      lsDebugLogPanel('Init', 'Attached click handler to indexBtn (overwritten)');
    }
    
    if (clearBtn) {
      // Remove old listener if exists
      if (clearBtn._clickListener) {
        clearBtn.removeEventListener('click', clearBtn._clickListener);
      }
      // Create new listener
      clearBtn._clickListener = onClearClick;
      clearBtn.addEventListener('click', onClearClick);
      lsDebugLogPanel('Init', 'Attached click handler to clearBtn (overwritten)');
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
  async function onIndexClick() {
    console.log('[LS Search] onIndexClick called - DIRECT');
    lsDebugLogPanel('Index', '=== onIndexClick CALLED (DIRECT) ===');
    
    const indexBtn = document.getElementById('ls-indexBtn');
    if (!indexBtn) {
      lsDebugLogPanel('Index', 'ERROR: indexBtn not found in DOM');
      return;
    }
    
    lsDebugLogPanel('Index', 'indexBtn found', { disabled: indexBtn.disabled });
    
    indexBtn.disabled = true;
    indexBtn.textContent = 'Индексация...';
    
    // Try to show loading
    if (window.InlineUI && window.InlineUI.showLoading) {
      window.InlineUI.showLoading();
    } else {
      lsDebugLogPanel('Index', 'ERROR: InlineUI.showLoading not available');
    }
    
    lsDebugLogPanel('Index', 'Checking chrome.runtime');
    
    lsDebugLogPanel('Index', '=== START INDEXING ===', {
      hasExtractAllMessages: typeof window.extractAllMessages === 'function',
      InlineStorageAvailable: !!window.InlineStorage,
      currentPath: window.location.pathname,
      hasChromeRuntime: !!chrome.runtime
    });
    
    // Check if we're running as extension (has chrome.runtime) or as userscript
    if (chrome.runtime && chrome.runtime.id) {
      lsDebugLogPanel('Index', 'Using background script for FULL indexing', {
        runtimeId: chrome.runtime.id
      });
      
      // Use background script for full indexing (same as popup)
      await indexViaBackgroundScript();
      
      lsDebugLogPanel('Index', 'indexViaBackgroundScript returned');
      
      // Reset button and exit
      if (indexBtn) {
        indexBtn.disabled = false;
        indexBtn.textContent = 'Индексировать';
      }
      return;
    }
    
    lsDebugLogPanel('Index', 'No chrome.runtime - using fallback extraction');
    
    try {
      // Use the content script extraction logic
      // Since we're in the page context, we can call the functions directly
      let messages = [];
      
      // Check if extraction functions are available from content.js
      lsDebugLogPanel('Index', 'Checking window.extractAllMessages', {
        type: typeof window.extractAllMessages
      });
      
      if (typeof window.extractAllMessages === 'function') {
        lsDebugLogPanel('Index', 'Using window.extractAllMessages - FULL extraction');
        messages = await window.extractAllMessages();
        lsDebugLogPanel('Index', 'extractAllMessages returned', { count: messages.length });
      } else {
        // Fallback: try to extract from current page
        lsDebugLogPanel('Index', 'Using FALLBACK - extractFromCurrentPage (PARTIAL)');
        messages = await extractFromCurrentPage();
        lsDebugLogPanel('Index', 'extractFromCurrentPage returned', { count: messages.length });
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
      
      lsDebugLogPanel('Index', 'Final result', {
        existingCount: existingMessages.length,
        newCount: messages.length,
        addedCount: addedCount,
        totalInStorage: allMessages.length
      });
      
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
    lsDebugLogPanel('Index-BG', 'Starting indexViaBackgroundScript');
    
    return new Promise((resolve, reject) => {
      lsDebugLogPanel('Index-BG', 'Sending indexAllSections request to background');
      
      chrome.runtime.sendMessage({ action: 'indexAllSections' }, (response) => {
        (async () => {
          lsDebugLogPanel('Index-BG', 'Got response from background', { response: response ? 'exists' : 'null' });
          try {
            if (chrome.runtime.lastError) {
              lsDebugLogPanel('Index-BG', 'Runtime error', { error: chrome.runtime.lastError.message });
              window.InlineUI.showStatus('Ошибка: ' + chrome.runtime.lastError.message, 'error');
              resolve();
              return;
            }
            
            if (response && response.error) {
              lsDebugLogPanel('Index-BG', 'Response error', { error: response.error });
              window.InlineUI.showStatus(response.error, 'error');
              resolve();
              return;
            }
            
            if (response && Array.isArray(response.messages)) {
              const newMessages = response.messages;
              const indexedSections = response.indexedSections || [];
              
              lsDebugLogPanel('Index-BG', 'Indexed sections', {
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
              
              lsDebugLogPanel('Index-BG', 'Final result', {
                existingCount: existingMessages.length,
                newCount: newMessages.length,
                addedCount: addedCount,
                totalInStorage: allMessages.length,
              });
              
              await window.InlineStorage.saveMessages(allMessages, { indexedAt: now });
              
              const stats = window.InlineStorage.getStats(allMessages);
              lsDebugLogPanel('Index-BG', 'Stats after save', {
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
              lsDebugLogPanel('Index-BG', 'No messages in response');
              window.InlineUI.showStatus('Не удалось извлечь сообщения', 'error');
              resolve();
            }
          } catch (err) {
            lsDebugLogPanel('Index-BG', 'Error processing response', { error: err.message });
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
      
      if (!text || text.length < 1) return null;
      
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
  
})();

