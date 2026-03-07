// Inline UI - creates search panel embedded in the page
// For embedding directly into the page

// Debug logging function - saves to localStorage
  function debugLog(section, message, data = null) {
    // Debug logging disabled
  }

/**
 * @typedef {import('./inline-storage.js').StickerMessage} StickerMessage
 */

// Container reference
let resultsContainer = null;

/**
 * Create and inject the search panel into the page
 */
function createSearchPanel() {
  debugLog('UI', 'createSearchPanel called');
  
  // Check if panel already exists
  const existingPanel = document.getElementById('ls-search-panel');
  if (existingPanel) {
    debugLog('UI', 'Panel already exists, returning existing elements');
    // Return references to existing elements
    return {
      indexBtn: document.getElementById('ls-indexBtn'),
      clearBtn: document.getElementById('ls-clearBtn'),
      searchInput: document.getElementById('ls-searchInput'),
      results: document.getElementById('ls-results'),
    };
  }
  
  debugLog('UI', 'Panel does not exist, proceeding');
  
  // Find the navigation area - after "Архив" link
  const bigTextDiv = document.querySelector('#content .big_text');
  debugLog('UI', 'Looking for #content .big_text', { 
    found: !!bigTextDiv,
    html: bigTextDiv ? bigTextDiv.outerHTML.substring(0, 200) : 'NOT FOUND'
  });
  
  if (!bigTextDiv) {
    // Try alternative selectors
    const alternatives = [
      '#content .bigtext',
      '#content > .big_text',
      '.big_text',
      '#content'
    ];
    
    for (const selector of alternatives) {
      const altEl = document.querySelector(selector);
      debugLog('UI', `Trying alternative selector: ${selector}`, { found: !!altEl });
      if (altEl) {
        debugLog('UI', `Found element with selector: ${selector}`);
        break;
      }
    }
    
    console.log('[LS Search] Could not find navigation area');
    debugLog('UI', 'ERROR: Could not find any suitable container element');
    return;
  }
  
  // Create the search panel container
  const panel = document.createElement('div');
  panel.id = 'ls-search-panel';
  panel.className = 'ls-search-panel';
  
  debugLog('UI', 'Created panel element', { id: panel.id, className: panel.className });
  
  // Create controls (buttons + stats)
  const controls = document.createElement('div');
  controls.className = 'ls-search-controls';
  
  const indexBtn = document.createElement('button');
  indexBtn.type = 'button';
  indexBtn.id = 'ls-indexBtn';
  indexBtn.className = 'ls-btn ls-btn-primary';
  indexBtn.textContent = 'Индексировать';
  indexBtn.title = 'Собрать все сообщения со страниц разговоров';
  
  // Prevent default behavior
  indexBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  
  debugLog('UI', 'Created indexBtn', { id: indexBtn.id, text: indexBtn.textContent });
  
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.id = 'ls-clearBtn';
  clearBtn.className = 'ls-btn ls-btn-danger';
  clearBtn.textContent = 'Очистить';
  clearBtn.title = 'Удалить все индексированные сообщения';
  
  // Prevent default behavior
  clearBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  
  debugLog('UI', 'Created clearBtn', { id: clearBtn.id, text: clearBtn.textContent });
  
  const stats = document.createElement('div');
  stats.className = 'ls-stats';
  stats.innerHTML = `
    <span class="ls-stat-item">
      <span class="ls-stat-label">Диалогов:</span>
      <span id="ls-dialogCount" class="ls-stat-value">0</span>
    </span>
    <span class="ls-stat-item">
      <span class="ls-stat-label">Сообщений:</span>
      <span id="ls-messageCount" class="ls-stat-value">0</span>
    </span>
  `;
  
  const lastIndexed = document.createElement('div');
  lastIndexed.id = 'ls-lastIndexedAt';
  lastIndexed.className = 'ls-last-index';
  lastIndexed.textContent = 'Ещё не индексировалось';
  
  controls.appendChild(indexBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(stats);
  controls.appendChild(lastIndexed);
  
  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'ls-search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'ls-searchInput';
  searchInput.className = 'ls-search-input';
  searchInput.placeholder = 'Поиск по сообщениям...';
  
  searchContainer.appendChild(searchInput);
  
  // Create results container
  const results = document.createElement('div');
  results.id = 'ls-results';
  results.className = 'ls-results';
  
  // Add all to panel
  panel.appendChild(controls);
  panel.appendChild(searchContainer);
  panel.appendChild(results);
  
  // Insert after the big_text div (navigation)
  debugLog('UI', 'Inserting panel into DOM', {
    parent: bigTextDiv.parentNode ? bigTextDiv.parentNode.tagName : 'unknown',
    nextSibling: bigTextDiv.nextSibling ? bigTextDiv.nextSibling.tagName : 'null'
  });
  bigTextDiv.parentNode.insertBefore(panel, bigTextDiv.nextSibling);
  
  // Store reference
  resultsContainer = results;
  
  console.log('[LS Search] Search panel created');
  debugLog('UI', 'Panel successfully inserted into DOM');
  
  // Verify buttons exist in DOM
  const indexBtnInDom = document.getElementById('ls-indexBtn');
  const clearBtnInDom = document.getElementById('ls-clearBtn');
  debugLog('UI', 'Verifying buttons in DOM', {
    indexBtnFound: !!indexBtnInDom,
    clearBtnFound: !!clearBtnInDom,
    indexBtnVisible: indexBtnInDom ? (window.getComputedStyle(indexBtnInDom).display !== 'none') : false,
    clearBtnVisible: clearBtnInDom ? (window.getComputedStyle(clearBtnInDom).display !== 'none') : false
  });
  
  return {
    indexBtn,
    clearBtn,
    searchInput,
    results,
  };
}

/**
 * Update statistics section.
 * @param {{ dialogsCount: number, messagesCount: number }} stats
 */
function renderStats(stats) {
  const dialogCountEl = document.getElementById('ls-dialogCount');
  const messageCountEl = document.getElementById('ls-messageCount');
  
  if (dialogCountEl) dialogCountEl.textContent = String(stats.dialogsCount ?? 0);
  if (messageCountEl) messageCountEl.textContent = String(stats.messagesCount ?? 0);
}

/**
 * Render last indexed timestamp text.
 * @param {number|null} timestamp
 */
function renderLastIndexedAt(timestamp) {
  const lastIndexedEl = document.getElementById('ls-lastIndexedAt');
  if (!lastIndexedEl) return;
  
  if (!timestamp) {
    lastIndexedEl.textContent = 'Ещё не индексировалось';
    return;
  }
  
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    lastIndexedEl.textContent = 'Ещё не индексировалось';
    return;
  }
  
  lastIndexedEl.textContent = `Последняя индексация: ${date.toLocaleString('ru-RU')}`;
}

/**
 * Show status message at the top of results.
 * @param {string} message
 * @param {'success' | 'error'} [type]
 */
function showStatus(message, type = 'success') {
  if (!resultsContainer) return;
  
  const existingStatus = document.querySelector('.ls-status-message');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  const statusEl = document.createElement('div');
  statusEl.className = `ls-status-message ls-status-${type}`;
  statusEl.textContent = message;
  
  resultsContainer.insertBefore(statusEl, resultsContainer.firstChild);
  
  setTimeout(() => {
    if (statusEl.isConnected) {
      statusEl.remove();
    }
  }, 4000);
}

/**
 * Show "loading" block in results.
 */
function showLoading() {
  if (!resultsContainer) return;
  resultsContainer.innerHTML = '<div class="ls-loading">Идёт индексация сообщений...</div>';
}

/**
 * Render empty state hint.
 * @param {'no-index' | 'no-query'} reason
 */
function renderEmptyState(reason) {
  if (!resultsContainer) return;
  
  if (reason === 'no-query') {
    resultsContainer.innerHTML = '<div class="ls-empty-state">Введите запрос для поиска</div>';
    return;
  }
  
  resultsContainer.innerHTML = '<div class="ls-empty-state" id="ls-emptyState">Нажмите "Индексировать" для сбора сообщений</div>';
}

/**
 * Render search results grouped by partner.
 * @param {StickerMessage[]} results
 * @param {string} query
 * @param {number} totalCount
 * @param {number} limit
 */
function renderResults(results, query, totalCount, limit) {
  if (!resultsContainer) return;
  
  if (!results.length) {
    resultsContainer.innerHTML = '<div class="ls-no-results">Ничего не найдено</div>';
    return;
  }
  
  const escapedQuery = query.trim();
  const groups = groupByPartner(results);
  
  const parts = [];
  
  Object.keys(groups)
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .forEach((partner) => {
      const items = groups[partner];
      const safePartner = escapeHtml(partner || 'Неизвестно');
      
      parts.push(
        `<div class="ls-partner-group">
          <div class="ls-partner-header">${safePartner} <span class="ls-partner-count">(${items.length})</span></div>
          ${items
            .map((msg) => {
              const text = highlightText(msg.text || '', escapedQuery);
              const date = formatDate(msg.timestamp);
              
              return `
                <div class="ls-result-item">
                  <div class="ls-result-message">${text}</div>
                  <div class="ls-result-date">${date}</div>
                </div>
              `;
            })
            .join('')}
        </div>`
      );
    });
  
  if (totalCount > limit) {
    parts.push(
      `<div class="ls-results-footer">Показаны первые ${limit} из ${totalCount} совпадений</div>`
    );
  }
  
  resultsContainer.innerHTML = parts.join('');
}

/**
 * Highlight search query in text.
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const queryRegex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  
  return escapedText.replace(queryRegex, '<span class="ls-highlight">$1</span>');
}

/**
 * Escape HTML entities.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape regex special characters.
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format timestamp to human-readable Russian date.
 * @param {number|null|undefined} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  if (!timestamp) return 'Без даты';
  
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Без даты';
    
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return 'Без даты';
  }
}

/**
 * Group messages by partner.
 * @param {StickerMessage[]} messages
 * @returns {Record<string, StickerMessage[]>}
 */
function groupByPartner(messages) {
  /** @type {Record<string, StickerMessage[]>} */
  const groups = {};
  
  messages.forEach((msg) => {
    const key = msg.partner || 'Неизвестно';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(msg);
  });
  
  return groups;
}

// Export functions
window.InlineUI = {
  createSearchPanel,
  renderStats,
  renderLastIndexedAt,
  showStatus,
  showLoading,
  renderEmptyState,
  renderResults,
};
