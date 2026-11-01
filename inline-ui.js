// Inline UI - creates search panel embedded in the page
// For embedding directly into the page

// Debug logging function - saves to localStorage
  function debugLog() {
    // Debug logging disabled
  }

/**
 * @typedef {import('./inline-storage.js').StickerMessage} StickerMessage
 */

// Container reference
let resultsContainer = null;

/**
 * Create and inject the search panel into a single talk page
 * This panel only contains search input and message count
 */
function createTalkSearchPanel() {
  debugLog('UI', 'createTalkSearchPanel called');
  
  const existingPanel = document.getElementById('ls-talk-search-panel');
  if (existingPanel) {
    debugLog('UI', 'Talk panel already exists');
    return {
      searchInput: document.getElementById('ls-talk-searchInput'),
      results: document.getElementById('ls-results'),
    };
  }
  
  // Find the navigation area - try multiple selectors for single talk page
  let insertContainer = document.querySelector('#content .big_text');
  
  // For single talk pages, find a better insertion point - before first message or after .line
  if (!insertContainer) {
    insertContainer = document.querySelector('#content .line');
  }
  
  // Fallback: find #content itself
  if (!insertContainer) {
    insertContainer = document.querySelector('#content');
  }
  
  if (!insertContainer) {
    console.log('[LS Search] Could not find container for talk panel');
    return;
  }
  
  // Get current talk ID from URL
  const path = window.location.pathname;
  const talkIdMatch = path.match(/^\/users\/my_talks(?:\/hide)?\/(\d+)\/?/);
  const currentTalkId = talkIdMatch ? talkIdMatch[1] : null;
  
  // Get partner name from page title
  let partnerName = '';
  const titleLink = document.querySelector('#content h1 a');
  if (titleLink) {
    partnerName = titleLink.textContent.trim();
  }
  
  // Create the search panel container (simplified - no buttons)
  const panel = document.createElement('div');
  panel.id = 'ls-talk-search-panel';
  panel.className = 'ls-talk-search-panel';
  
  // Create stats for current conversation
  const stats = document.createElement('div');
  stats.className = 'ls-talk-stats';
  stats.id = 'ls-talk-stats';
  stats.innerHTML = `
    <span class="ls-stat-label">Сообщений в диалоге:</span>
    <span id="ls-talk-messageCount" class="ls-stat-value">0</span>
  `;
  
  // Store current talk ID for filtering
  panel.dataset.talkId = currentTalkId || '';
  panel.dataset.partnerName = partnerName || '';
  
  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'ls-search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'ls-talk-searchInput';
  searchInput.className = 'ls-search-input';
  searchInput.placeholder = 'Поиск в текущем диалоге...';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('aria-label', 'Поиск в текущем диалоге');
  searchInput.setAttribute('aria-controls', 'ls-results');
  
  searchContainer.appendChild(searchInput);
  
  // Create results container
  const results = document.createElement('div');
  results.id = 'ls-results';
  results.className = 'ls-results';
  
  // Add all to panel
  panel.appendChild(stats);
  panel.appendChild(searchContainer);
  panel.appendChild(results);

  // Find the best insertion point - before first .user_message or after the container
  const firstMessage = document.querySelector('.user_message');
  const pagesDiv = document.getElementById('pages');
  
  if (firstMessage) {
    // Make sure we're not inserting inside another element
    // Insert as a sibling, not as a child
    const parent = firstMessage.parentNode;
    if (parent.id === 'content' || parent.classList.contains('user_message')) {
      // Insert before first message in content
      parent.insertBefore(panel, firstMessage);
    } else {
      parent.insertBefore(panel, firstMessage);
    }
  } else if (pagesDiv) {
    // Insert before pagination
    pagesDiv.parentNode.insertBefore(panel, pagesDiv);
  } else if (insertContainer) {
    // Fallback: insert after the container
    insertContainer.parentNode.insertBefore(panel, insertContainer.nextSibling);
  }
  
  resultsContainer = results;
  
  console.log('[LS Search] Talk search panel created, talkId:', currentTalkId);
  
  return {
    searchInput,
    results,
    talkId: currentTalkId,
    partnerName,
  };
}

/**
 * Update stats for single talk page.
 * @param {number} count - Number of messages with current partner
 * @param {string} partnerName - Name of the conversation partner
 */
function renderTalkStats(count) {
  const countEl = document.getElementById('ls-talk-messageCount');
  if (countEl) countEl.textContent = String(count);
}
function createSearchPanel() {
  debugLog('UI', 'createSearchPanel called');
  
  // Check if panel already exists
  const existingPanel = document.getElementById('ls-search-panel');
  if (existingPanel) {
    debugLog('UI', 'Panel already exists, returning existing elements');
    // Return references to existing elements
    return {
      indexBtn: document.getElementById('ls-indexBtn'),
      cancelBtn: document.getElementById('ls-cancelBtn'),
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

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.id = 'ls-cancelBtn';
  cancelBtn.className = 'ls-btn ls-btn-danger';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.title = 'Остановить индексацию';
  cancelBtn.style.display = 'none';
  cancelBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
  });

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
    <span class="ls-stat-item ls-stat-size-item">
      <span class="ls-stat-label">Индекс:</span>
      <span id="ls-indexSize" class="ls-stat-value">—</span>
    </span>
  `;
  
  const lastIndexed = document.createElement('div');
  lastIndexed.id = 'ls-lastIndexedAt';
  lastIndexed.className = 'ls-last-index';
  lastIndexed.textContent = 'Ещё не индексировалось';
  
  controls.appendChild(indexBtn);
  controls.appendChild(cancelBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(stats);
  controls.appendChild(lastIndexed);

  // Automatic refresh settings
  const autoSettings = document.createElement('div');
  autoSettings.id = 'ls-autoSettings';
  autoSettings.className = 'ls-auto-settings';
  autoSettings.innerHTML = `
    <label class="ls-auto-toggle">
      <input type="checkbox" id="ls-autoEnabled">
      <span>Автообновление</span>
    </label>
    <span id="ls-autoStatus" class="ls-auto-status"></span>
  `;

  // Stale index banner
  const staleBanner = document.createElement('div');
  staleBanner.id = 'ls-staleBanner';
  staleBanner.className = 'ls-banner';
  staleBanner.setAttribute('role', 'status');
  staleBanner.hidden = true;
  staleBanner.innerHTML = `
    <span id="ls-staleText" class="ls-banner-text"></span>
    <span class="ls-banner-actions">
      <button type="button" id="ls-staleRefresh" class="ls-btn ls-btn-primary">Обновить</button>
      <button type="button" id="ls-staleDismiss" class="ls-btn ls-btn-secondary">Позже</button>
    </span>
  `;

  // One-time notice about dialogs being marked as read
  const readNotice = document.createElement('div');
  readNotice.id = 'ls-readNotice';
  readNotice.className = 'ls-notice';
  readNotice.hidden = true;
  readNotice.innerHTML = `
    <span class="ls-notice-text">
      При индексации сайт может отметить диалоги прочитанными.
      Архив (<code>/users/my_talks/hide/</code>) уже прочитан.
    </span>
    <button type="button" id="ls-readNoticeDismiss" class="ls-btn ls-btn-secondary">Понятно</button>
  `;

  // Indexing error details
  const indexErrors = document.createElement('div');
  indexErrors.id = 'ls-indexErrors';
  indexErrors.className = 'ls-index-errors';
  indexErrors.hidden = true;

  // Status line, kept outside the results so rendering does not erase it
  const statusArea = document.createElement('div');
  statusArea.id = 'ls-status';
  statusArea.className = 'ls-status-area';
  statusArea.setAttribute('role', 'status');
  statusArea.setAttribute('aria-live', 'polite');
  statusArea.hidden = true;
  
  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'ls-search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'ls-searchInput';
  searchInput.className = 'ls-search-input';
  searchInput.placeholder = 'Поиск по сообщениям...';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('aria-label', 'Поиск по сообщениям');
  searchInput.setAttribute('aria-controls', 'ls-results');

  searchContainer.appendChild(searchInput);
  
  // Create results container
  const results = document.createElement('div');
  results.id = 'ls-results';
  results.className = 'ls-results';
  results.setAttribute('aria-label', 'Результаты поиска');
  
  // Add all to panel
  panel.appendChild(controls);
  panel.appendChild(autoSettings);
  panel.appendChild(staleBanner);
  panel.appendChild(readNotice);
  panel.appendChild(indexErrors);
  panel.appendChild(statusArea);
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
    cancelBtn,
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
 * Format a byte count for the compact stats row.
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes <= 0) return '0 Б';

  const kb = 1024;
  const mb = kb * 1024;

  if (bytes < mb) {
    const value = bytes / kb;
    return `${value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value)} КБ`;
  }

  return `${(bytes / mb).toFixed(1).replace('.', ',')} МБ`;
}

/**
 * Render the stored index size and warn when it approaches the quota.
 * @param {number|null} bytes
 */
function renderIndexSize(bytes) {
  const sizeEl = document.getElementById('ls-indexSize');
  if (!sizeEl) return;

  sizeEl.textContent = formatBytes(bytes);
  const warning = typeof bytes === 'number' && bytes >= 8 * 1024 * 1024;
  sizeEl.classList.toggle('ls-stat-warning', warning);
  sizeEl.title = warning
    ? 'Индекс близок к лимиту chrome.storage.local (10 МБ)'
    : 'Размер локального индекса';
}

/**
 * Show the stale-index banner.
 * @param {number} days
 */
function showStaleBanner(days) {
  const banner = document.getElementById('ls-staleBanner');
  const text = document.getElementById('ls-staleText');
  if (!banner || !text) return;

  const safeDays = Math.max(1, Math.floor(days));
  const word = safeDays % 10 === 1 && safeDays % 100 !== 11
    ? 'день'
    : [2, 3, 4].includes(safeDays % 10) && ![12, 13, 14].includes(safeDays % 100)
      ? 'дня'
      : 'дней';

  text.textContent = `Индекс не обновлялся ${safeDays} ${word}. Обновить?`;
  banner.hidden = false;
}

function hideStaleBanner() {
  const banner = document.getElementById('ls-staleBanner');
  if (banner) banner.hidden = true;
}

/**
 * Show the one-time read-marking notice.
 */
function showReadNotice() {
  const notice = document.getElementById('ls-readNotice');
  if (notice) notice.hidden = false;
}

function hideReadNotice() {
  const notice = document.getElementById('ls-readNotice');
  if (notice) notice.hidden = true;
}

/**
 * Render indexing errors in a collapsible block with a retry button.
 * @param {string[]} errors
 */
function renderIndexErrors(errors) {
  const box = document.getElementById('ls-indexErrors');
  if (!box) return;

  if (!Array.isArray(errors) || errors.length === 0) {
    clearIndexErrors();
    return;
  }

  box.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'ls-index-errors-header';
  header.textContent = `Ошибки индексации: ${errors.length}`;
  box.appendChild(header);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Подробности';
  details.appendChild(summary);

  const list = document.createElement('ul');
  errors.slice(0, 50).forEach((error) => {
    const item = document.createElement('li');
    item.textContent = String(error);
    list.appendChild(item);
  });
  if (errors.length > 50) {
    const more = document.createElement('li');
    more.textContent = `…и ещё ${errors.length - 50}`;
    list.appendChild(more);
  }
  details.appendChild(list);
  box.appendChild(details);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.id = 'ls-retryBtn';
  retry.className = 'ls-btn ls-btn-primary';
  retry.textContent = 'Повторить индексацию';
  box.appendChild(retry);

  box.hidden = false;
}

function clearIndexErrors() {
  const box = document.getElementById('ls-indexErrors');
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
}

/**
 * Show status message at the top of results.
 * @param {string} message
 * @param {'success' | 'error'} [type]
 */
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('ls-status');
  if (!statusEl) return;

  statusEl.className = `ls-status-area ls-status-${type}`;
  statusEl.textContent = message;
  statusEl.hidden = false;

  if (statusEl._hideTimer) {
    clearTimeout(statusEl._hideTimer);
  }
  statusEl._hideTimer = setTimeout(() => {
    statusEl.hidden = true;
    statusEl.textContent = '';
  }, 5000);
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
 * @param {boolean} [canLoadMore]
 */
function renderResults(results, query, totalCount, limit, canLoadMore = false) {
  if (!resultsContainer) return;
  
  if (!results.length) {
    resultsContainer.innerHTML = '<div class="ls-no-results">Ничего не найдено</div>';
    return;
  }
  
  const escapedQuery = query.trim();
  const groups = groupByPartner(results);
  const resultIndexes = new Map();
  results.forEach((msg, index) => resultIndexes.set(msg, index));

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
              const messageUrl = msg.url
                ? `${msg.url}${msg.messageId ? `#msg_${msg.messageId}` : ''}`
                : '';
              const href = messageUrl ? ` href="${escapeAttribute(messageUrl)}"` : '';
              const tag = messageUrl ? 'a' : 'div';
              const resultIndex = resultIndexes.get(msg);

              return `
                <${tag} class="ls-result-item" id="ls-result-${resultIndex}" data-result-index="${resultIndex}" aria-selected="false"${href}>
                  <div class="ls-result-message">${text}</div>
                  <div class="ls-result-date">${date}</div>
                </${tag}>
              `;
            })
            .join('')}
        </div>`
      );
    });
  
  if (totalCount > limit) {
    parts.push(
      `<div class="ls-results-footer">
        Показаны первые ${limit} из ${totalCount} совпадений
        ${
          canLoadMore
            ? '<button type="button" id="ls-loadMoreBtn" class="ls-btn ls-btn-secondary">Показать ещё</button>'
            : ''
        }
      </div>`,
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

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  } catch {
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

/**
 * Create the separate forum search panel.
 *
 * @param {{postId?: string, isTopicPage?: boolean}} [options]
 * @returns {object|undefined}
 */
function createForumSearchPanel(options = {}) {
  const existing = document.getElementById('ls-forum-panel');
  if (existing) {
    return {
      panel: existing,
      indexBtn: document.getElementById('ls-forumIndexBtn'),
      cancelBtn: document.getElementById('ls-forumCancelBtn'),
      clearBtn: document.getElementById('ls-forumClearBtn'),
      searchInput: document.getElementById('ls-forumSearchInput'),
      results: document.getElementById('ls-forumResults'),
      status: document.getElementById('ls-forumStatus'),
      errors: document.getElementById('ls-forumErrors'),
    };
  }

  const topicHeader =
    document.querySelector('#content > .head_bg-l.clearer') ||
    document.querySelector('#content .head_bg-l.clearer');
  const contentHeading = document.querySelector('#content h1');
  const content = document.getElementById('content');

  let parent = content;
  let before = content ? content.firstChild : null;

  if (options.isTopicPage) {
    // On a topic page insert the panel after the last dashed separator and
    // directly above the "Комментарии" heading.
    const commentsHeading = document.getElementById('comments_list');
    if (commentsHeading) {
      parent = commentsHeading.parentNode;
      before = commentsHeading;
    } else if (topicHeader) {
      parent = topicHeader.parentNode;
      before = topicHeader.nextSibling;
    }
  } else {
    // On the forum index and category pages insert the panel after the last
    // dashed separator and directly above the "Обсуждаемые темы" heading.
    const listHeading = Array.from(
      document.querySelectorAll('#content > p.big_text, #content > .big_text'),
    ).find((element) =>
      /Обсуждаемые темы|Новые темы/i.test(element.textContent || ''),
    );
    const firstForumList = document.querySelector('#content .forum_list');

    if (listHeading) {
      parent = listHeading.parentNode;
      before = listHeading;
    } else if (firstForumList) {
      parent = firstForumList.parentNode;
      before = firstForumList;
    } else if (contentHeading) {
      parent = contentHeading.parentNode;
      before = contentHeading.nextSibling;
    }
  }

  if (!parent) {
    console.log('[LS Search] Could not find container for forum panel');
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'ls-forum-panel';
  panel.className = 'ls-search-panel ls-forum-panel';

  const controls = document.createElement('div');
  controls.className = 'ls-search-controls';

  const indexBtn = document.createElement('button');
  indexBtn.type = 'button';
  indexBtn.id = 'ls-forumIndexBtn';
  indexBtn.className = 'ls-btn ls-btn-primary';
  indexBtn.textContent = 'Индексировать тему';
  indexBtn.title = 'Собрать комментарии этой темы в локальный индекс';
  indexBtn.hidden = !options.isTopicPage;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.id = 'ls-forumCancelBtn';
  cancelBtn.className = 'ls-btn ls-btn-danger';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.title = 'Остановить индексацию форума';
  cancelBtn.hidden = true;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.id = 'ls-forumClearBtn';
  clearBtn.className = 'ls-btn ls-btn-danger';
  clearBtn.textContent = 'Очистить';
  clearBtn.title = options.isTopicPage
    ? 'Удалить индекс этой темы; остальные темы останутся'
    : 'Удалить индекс форума; личные диалоги останутся';

  const stats = document.createElement('div');
  stats.className = 'ls-stats';
  stats.innerHTML = `
    <span class="ls-stat-item">
      <span class="ls-stat-label">Тем:</span>
      <span id="ls-forumTopicCount" class="ls-stat-value">0</span>
    </span>
    <span class="ls-stat-item">
      <span class="ls-stat-label">Сообщений:</span>
      <span id="ls-forumMessageCount" class="ls-stat-value">0</span>
    </span>
    <span class="ls-stat-item ls-stat-size-item">
      <span class="ls-stat-label">Индекс:</span>
      <span id="ls-forumIndexSize" class="ls-stat-value">—</span>
    </span>
  `;

  controls.appendChild(indexBtn);
  controls.appendChild(cancelBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(stats);

  const topicStats = document.createElement('div');
  topicStats.id = 'ls-forumTopicStats';
  topicStats.className = 'ls-forum-topic-stats';
  topicStats.hidden = true;

  const lastIndexed = document.createElement('div');
  lastIndexed.id = 'ls-forumLastIndexed';
  lastIndexed.className = 'ls-last-index';
  lastIndexed.textContent = 'Индекс форума ещё не создавался';

  const status = document.createElement('div');
  status.id = 'ls-forumStatus';
  status.className = 'ls-status-area';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const errors = document.createElement('div');
  errors.id = 'ls-forumErrors';
  errors.className = 'ls-index-errors';
  errors.hidden = true;

  const searchContainer = document.createElement('div');
  searchContainer.className = 'ls-search-container';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'ls-forumSearchInput';
  searchInput.className = 'ls-search-input';
  searchInput.placeholder = 'Поиск по сообщениям форума...';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('aria-label', 'Поиск по сообщениям форума');
  searchInput.setAttribute('aria-controls', 'ls-forumResults');

  searchContainer.appendChild(searchInput);

  const results = document.createElement('div');
  results.id = 'ls-forumResults';
  results.className = 'ls-results';
  results.setAttribute('aria-label', 'Результаты поиска по форуму');

  panel.appendChild(controls);
  panel.appendChild(topicStats);
  panel.appendChild(lastIndexed);
  panel.appendChild(status);
  panel.appendChild(errors);
  panel.appendChild(searchContainer);
  panel.appendChild(results);

  parent.insertBefore(panel, before);

  return {
    panel,
    indexBtn,
    cancelBtn,
    clearBtn,
    searchInput,
    results,
    status,
    errors,
  };
}

/**
 * Render forum index/topic statistics.
 *
 * @param {object} stats
 */
function renderForumStats(stats) {
  const safe = stats || {};
  const topicCount = document.getElementById('ls-forumTopicCount');
  const messageCount = document.getElementById('ls-forumMessageCount');
  const sizeEl = document.getElementById('ls-forumIndexSize');
  const topicStats = document.getElementById('ls-forumTopicStats');
  const indexBtn = document.getElementById('ls-forumIndexBtn');

  if (topicCount) topicCount.textContent = String(safe.topicsCount || 0);
  if (messageCount) {
    messageCount.textContent = String(safe.messagesCount || 0);
  }
  if (sizeEl) {
    sizeEl.textContent = formatBytes(safe.sizeBytes);
    const large = Number(safe.sizeBytes) >= 100 * 1024 * 1024;
    sizeEl.classList.toggle('ls-stat-warning', large);
    sizeEl.title = large
      ? 'Индекс форума занимает много места; очистите старые темы'
      : 'Приблизительный размер индекса форума';
  }

  if (topicStats) {
    if (safe.topic) {
      const pages =
        safe.topic.pageCount ||
        (Number(safe.topic.lastPageParam) || 0) + 1;
      const state = safe.topic.complete ? 'полностью' : 'частично';
      topicStats.textContent = `В теме: ${
        safe.topic.indexedComments || 0
      } сообщений · ${pages} стр. · проиндексировано ${state}`;
      topicStats.hidden = false;
    } else {
      topicStats.hidden = true;
    }
  }

  if (indexBtn) {
    if (!safe.topic) {
      indexBtn.textContent = 'Индексировать тему';
    } else if (safe.topic.complete) {
      indexBtn.textContent = 'Обновить';
    } else {
      indexBtn.textContent = 'Продолжить';
    }
  }
}

/**
 * @param {number|null|undefined} timestamp
 */
function renderForumLastIndexedAt(timestamp) {
  const el = document.getElementById('ls-forumLastIndexed');
  if (!el) return;

  if (!timestamp) {
    el.textContent = 'Индекс форума ещё не создавался';
    return;
  }

  try {
    el.textContent = `Индекс форума обновлён: ${new Date(
      timestamp,
    ).toLocaleString('ru-RU')}`;
  } catch {
    el.textContent = 'Индекс форума обновлён';
  }
}

/**
 * Show a forum status message.
 *
 * @param {string} message
 * @param {'success'|'error'} [type]
 */
function showForumStatus(message, type = 'success') {
  const statusEl = document.getElementById('ls-forumStatus');
  if (!statusEl) return;

  statusEl.className = `ls-status-area ls-status-${type}`;
  statusEl.textContent = message;
  statusEl.hidden = false;

  if (statusEl._hideTimer) clearTimeout(statusEl._hideTimer);
  statusEl._hideTimer = setTimeout(() => {
    statusEl.hidden = true;
    statusEl.textContent = '';
  }, 6000);
}

/**
 * @param {'no-index'|'no-query'|'no-topic-index'|'loading'} reason
 */
function renderForumEmptyState(reason) {
  const container = document.getElementById('ls-forumResults');
  if (!container) return;

  if (reason === 'no-query') {
    container.innerHTML =
      '<div class="ls-empty-state">Введите запрос для поиска по форуму</div>';
    return;
  }

  if (reason === 'no-topic-index') {
    container.innerHTML =
      '<div class="ls-empty-state">Эта тема ещё не проиндексирована. Нажмите «Индексировать тему».</div>';
    return;
  }

  if (reason === 'loading') {
    container.innerHTML =
      '<div class="ls-loading">Идёт индексация темы...</div>';
    return;
  }

  container.innerHTML =
    '<div class="ls-empty-state">Индекс форума пуст. Откройте тему и нажмите «Индексировать тему».</div>';
}

/**
 * Render forum indexing errors.
 *
 * @param {string[]} errors
 */
function renderForumErrors(errors) {
  const container = document.getElementById('ls-forumErrors');
  if (!container) return;

  if (!errors || !errors.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const visible = errors.slice(0, 20);
  container.innerHTML = `
    <div class="ls-index-errors-header">Ошибки индексации форума</div>
    <details>
      <summary>Показать ${visible.length}${
        errors.length > visible.length ? ` из ${errors.length}` : ''
      }</summary>
      <ul>${visible
        .map((error) => `<li>${escapeHtml(error)}</li>`)
        .join('')}</ul>
    </details>
  `;
  container.hidden = false;
}

function forumSnippet(text, query) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '[без текста]';
  if (normalized.length <= 320) return normalized;

  const lower = normalized.toLowerCase();
  const queryLower = String(query || '').toLowerCase();
  const found = queryLower ? lower.indexOf(queryLower) : -1;
  const start = found > 120 ? found - 120 : 0;
  const end = Math.min(normalized.length, start + 320);

  return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${
    end < normalized.length ? '…' : ''
  }`;
}

function renderForumResultItem(result, index, query) {
  const text = highlightText(forumSnippet(result.text, query), query);
  const date = formatDate(result.timestamp);
  const page =
    result.page && Number(result.page) > 1
      ? ` · стр. ${Number(result.page)}`
      : '';
  const kind = result.kind === 'post' ? ' · первое сообщение' : '';
  const meta = [result.author || 'Неизвестно', date]
    .filter(Boolean)
    .join(' · ');
  const href = result.url
    ? ` href="${escapeAttribute(result.url)}"`
    : '';
  const tag = result.url ? 'a' : 'div';

  return `
    <${tag} class="ls-result-item" id="ls-forum-result-${index}" data-result-index="${index}" aria-selected="false"${href}>
      <div class="ls-result-message">${text}</div>
      <div class="ls-result-meta">${escapeHtml(meta)}${page}${kind}</div>
    </${tag}>
  `;
}

/**
 * Render forum search results. Global results are grouped by topic; a single
 * topic search is rendered as a flat list.
 *
 * @param {object[]} results
 * @param {string} query
 * @param {number} totalCount
 * @param {number} limit
 * @param {{groupByTopic?: boolean, canLoadMore?: boolean}} [options]
 */
function renderForumResults(results, query, totalCount, limit, options = {}) {
  const container = document.getElementById('ls-forumResults');
  if (!container) return;

  if (!results || !results.length) {
    container.innerHTML = '<div class="ls-no-results">Ничего не найдено</div>';
    return;
  }

  const indexes = new Map();
  results.forEach((result, index) => indexes.set(result, index));
  const parts = [];

  if (options.groupByTopic) {
    const groups = new Map();
    results.forEach((result) => {
      const key = String(result.postId || '');
      if (!groups.has(key)) {
        const rawUrl = result.url || '';
        const topicUrl = rawUrl
          .replace(/#.*$/, '')
          .replace(/\/page\d+\/?$/, '/');
        groups.set(key, {
          title: result.topicTitle || 'Без названия',
          url: topicUrl,
          items: [],
        });
      }
      groups.get(key).items.push(result);
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const timeA = a.items[0] ? a.items[0].timestamp || 0 : 0;
      const timeB = b.items[0] ? b.items[0].timestamp || 0 : 0;
      return timeB - timeA;
    });

    sortedGroups.forEach((group) => {
      const headerHref = group.url
        ? ` href="${escapeAttribute(group.url)}"`
        : '';
      const headerTag = group.url ? 'a' : 'span';
      parts.push(`
        <div class="ls-forum-topic-group">
          <div class="ls-forum-topic-header">
            <${headerTag} class="ls-forum-topic-link"${headerHref}>${escapeHtml(
              group.title,
            )}</${headerTag}>
            <span class="ls-partner-count">(${group.items.length})</span>
          </div>
          ${group.items
            .map((result) =>
              renderForumResultItem(result, indexes.get(result), query),
            )
            .join('')}
        </div>
      `);
    });
  } else {
    results.forEach((result) => {
      parts.push(renderForumResultItem(result, indexes.get(result), query));
    });
  }

  if (totalCount > limit) {
    parts.push(`
      <div class="ls-results-footer">
        Показаны первые ${limit} из ${totalCount} совпадений
        ${
          options.canLoadMore
            ? '<button type="button" id="ls-forumLoadMoreBtn" class="ls-btn ls-btn-secondary">Показать ещё</button>'
            : ''
        }
      </div>
    `);
  }

  container.innerHTML = parts.join('');
}

// Export functions
window.InlineUI = {
  createSearchPanel,
  createTalkSearchPanel,
  createForumSearchPanel,
  renderStats,
  renderTalkStats,
  renderForumStats,
  renderLastIndexedAt,
  renderForumLastIndexedAt,
  renderIndexSize,
  showStaleBanner,
  hideStaleBanner,
  showReadNotice,
  hideReadNotice,
  renderIndexErrors,
  renderForumErrors,
  clearIndexErrors,
  showStatus,
  showForumStatus,
  showLoading,
  renderEmptyState,
  renderForumEmptyState,
  renderResults,
  renderForumResults,
};
