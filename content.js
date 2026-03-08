// LastSticker Search - Content Script
// Extracts messages from laststicker.ru pages

console.log('[LS Search] Content script starting...');

// Parallel fetch helper - processes URLs in batches
async function fetchBatch(urls, concurrency = 10, processor = null) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const text = await response.text();
          return processor ? processor(text, url) : text;
        } catch (e) {
          console.error('Fetch error:', url, e);
          return null;
        }
      })
    );
    results.push(...batchResults.filter(Boolean));
  }
  return results;
}

// Load inline-panel dependencies - delegate to background script
async function loadInlineDependencies() {
  // Check if already loaded by background script
  if (window.InlineStorage && window.InlineUI) {
    return Promise.resolve();
  }
  
  // Ask background script to inject dependencies
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'injectDependencies' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      // Wait for dependencies to load with retry logic
      waitForDependencies(0, 10, resolve, reject);
    });
  });
}

// Wait for dependencies with retry logic
function waitForDependencies(attempt, maxAttempts, resolve, reject) {
  if (window.InlineStorage && window.InlineUI) {
    resolve();
    return;
  }
  
  if (attempt >= maxAttempts) {
    reject(new Error('Dependencies not available'));
    return;
  }
  
  setTimeout(() => {
    waitForDependencies(attempt + 1, maxAttempts, resolve, reject);
  }, 200);
}

// Load dependencies and then inject inline-panel
async function initInlinePanel() {
  try {
    await loadInlineDependencies();
    
    // Check if InlineStorage and InlineUI are available (may be loaded by background)
    if (!window.InlineStorage || !window.InlineUI) {
      // Wait for background script to inject them
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (window.InlineStorage && window.InlineUI) break;
      }
    }
    
    if (!window.InlineStorage || !window.InlineUI) {
      console.error('[LS Search] Dependencies not available:', {
        InlineStorage: typeof window.InlineStorage,
        InlineUI: typeof window.InlineUI
      });
      return;
    }
    
    // Check if inline-panel already loaded
    if (window.InlinePanelReady) {
      return;
    }
    
    // Load inline-panel - wait for it to load
    await loadInlinePanelScript();
    
  } catch (error) {
    console.error('[LS Search] Error initializing inline panel:', error);
  }
}

// Load inline-panel.js - delegate to background script
async function loadInlinePanelScript() {
  // Check if already loaded
  if (window.InlinePanelReady) {
    return Promise.resolve();
  }
  
  // Ask background to inject the panel
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'injectInlinePanel' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LS Search] Error requesting inline-panel injection:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      
      // Wait for panel to load with retry logic
      waitForInlinePanel(0, 10, resolve, reject);
    });
  });
}

// Wait for InlinePanelReady with retry logic
function waitForInlinePanel(attempt, maxAttempts, resolve, reject) {
  if (window.InlinePanelReady) {
    resolve();
    return;
  }
  
  if (attempt >= maxAttempts) {
    reject(new Error('InlinePanel still not ready after injection'));
    return;
  }
  
  setTimeout(() => {
    waitForInlinePanel(attempt + 1, maxAttempts, resolve, reject);
  }, 200);
}

// Initialize inline panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInlinePanel);
} else {
  initInlinePanel();
}

// Helper function to detect if we're on hidden talks
function isHiddenTalksPath(path) {
  return path.includes('/hide/');
}

// Main extraction function - handles pagination
async function extractAllMessages() {
  const path = window.location.pathname;

  // Talks list page - support base URL and paginated pages
  // /users/my_talks/, /users/my_talks/page2/, /users/my_talks/page3/ etc.
  if (path.match(/^\/users\/my_talks\/?$/) || 
      path.match(/^\/users\/my_talks\/page\d+\/?$/) || 
      path === '/users/my_talks/') {
    console.log('[LastSticker Search] Detected: Talks list page (my_talks)');
    return await extractAllFromTalksList(document);
  }

  // Hidden talks list page - support base URL and paginated pages
  // /users/my_talks/hide/, /users/my_talks/hide/page2/, /users/my_talks/hide/page3/ etc.
  if (path.match(/^\/users\/my_talks\/hide\/?$/) || 
      path.match(/^\/users\/my_talks\/hide\/page\d+\/?$/) || 
      path === '/users/my_talks/hide/') {
    console.log('[LastSticker Search] Detected: Hidden talks list page (hide)');
    return await extractAllFromTalksList(document);
  }

  // Archive talks list page - SUPPORT NEEDED
  // Check for common archive URL patterns
  if (path.match(/^\/users\/my_talks\/archive\/?$/) || 
      path.match(/^\/users\/my_talks\/archive\/page\d+\/?$/) || 
      path.match(/^\/users\/my_talks\/archived\/?$/) ||
      path.match(/^\/users\/archive\/?$/) ||
      path.match(/^\/users\/archive\/page\d+\/?$/)) {
    console.log('[LastSticker Search] Detected: Archive talks list page');
    return await extractAllFromTalksList(document);
  }

  // Single talk page (/users/my_talks/XXXXX/ or /users/my_talks/XXXXX/pageN/)
  // Also hidden talk page (/users/my_talks/hide/XXXXX/ or /users/my_talks/hide/XXXXX/pageN/)
  if (isSingleTalkPath(path)) {
    console.log('[LastSticker Search] Detected: Single talk page');
    return await extractFromSingleTalk(document);
  }

  console.log('[LastSticker Search] WARNING: No matching route for path:', path);
  return [];
}

function extractFromTalksList(doc) {
  const messages = [];
  const talkRows = doc.querySelectorAll('#talks_table tr[id^="talk_"]');
  
  talkRows.forEach((row) => {
    const talkId = row.id.replace('talk_', '');
    const msg = parseTalkRow(row, talkId);
    if (msg) {
      messages.push(msg);
    }
  });

  return messages;
}

async function extractAllFromTalksList(doc) {
  const messages = [];
  const origin = window.location.origin;
  const currentPath = doc.location.pathname;
  const isHidden = isHiddenTalksPath(currentPath);
  const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';

  // Collect all talk IDs from current page
  const talks = [];
  const talkRows = doc.querySelectorAll('#talks_table tr[id^="talk_"]');

  talkRows.forEach((row) => {
    const idAttr = row.id || '';
    const talkId = idAttr.replace('talk_', '').trim();
    if (!talkId) return;

    // NOTE: Talk URLs don't include /hide/ - they're just /users/my_talks/XXXXX/
    // regardless of whether the talk is in hidden or regular list
    talks.push({
      talkId,
      url: `/users/my_talks/${talkId}/`,
    });
  });

  // Collect pagination links from #pages
  const pagesRoot = doc.querySelector('#pages');
  const pageUrls = new Set();
  
  // Always add base talks URL for pagination
  pageUrls.add(talksBasePath);
  
  if (pagesRoot) {
    const pageLinks = pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]');
    pageLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href) {
        pageUrls.add(href);
      }
    });
    
    // Also add base URL if we're on a paginated page
    if (doc.location.pathname.includes('/page')) {
      pageUrls.add(talksBasePath);
    }
  }

  // Fetch messages from all pagination pages
  const normalizedCurrentPath = currentPath.endsWith('/') 
    ? currentPath 
    : currentPath + '/';
  
  // Determine if we're on a paginated page (page2, page3, etc.)
  const isPaginatedPage = /\/page\d+\/?$/.test(currentPath);
  
  // If on paginated page (page2, page3, etc.), don't filter out base URL
  // If on base page, we already have its talk rows from current document
  const filteredPageUrls = Array.from(pageUrls).filter(url => {
    const urlPath = new URL(url, origin).pathname;
    const normalizedUrlPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';
    
    // Always include other pagination pages
    if (normalizedUrlPath !== normalizedCurrentPath) {
      return true;
    }
    
    // For base page: we already have its talk rows, no need to re-fetch
    // For paginated pages: we need to fetch the base page to get all talk IDs
    return isPaginatedPage && normalizedUrlPath === normalizedCurrentPath;
  });

  // Fetch all pages if there are pagination links - parallel
  if (filteredPageUrls.length > 0) {
    const MAX_TALKS_PAGES = 20;
    const limitedPageUrls = filteredPageUrls.slice(0, MAX_TALKS_PAGES);
    
    const existingTalkIds = new Set(talks.map(t => t.talkId));
    
    await fetchBatch(limitedPageUrls, 10, (html, rawUrl) => {
      const parser = new DOMParser();
      const pageDoc = parser.parseFromString(html, 'text/html');
      const pageTalkRows = pageDoc.querySelectorAll('#talks_table tr[id^="talk_"]');
      const newTalks = [];
      pageTalkRows.forEach((row) => {
        const idAttr = row.id || '';
        const talkId = idAttr.replace('talk_', '').trim();
        if (!talkId || existingTalkIds.has(talkId)) return;
        existingTalkIds.add(talkId);
        newTalks.push({ talkId, url: `/users/my_talks/${talkId}/` });
      });
      return newTalks;
    }).then(newTalksArrays => {
      newTalksArrays.forEach(newTalks => {
        newTalks.forEach(t => talks.push(t));
      });
    });
  }

  const MAX_TALKS = 2000;
  const limitedTalks = talks.slice(0, MAX_TALKS);

  // Fetch all talks in parallel batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < limitedTalks.length; i += BATCH_SIZE) {
    const batch = limitedTalks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(talk => fetchFullTalkConversation(talk.talkId, talk.url, isHidden))
    );
    batchResults.forEach(fullMessages => {
      if (fullMessages && fullMessages.length) {
        messages.push(...fullMessages);
      }
    });
    console.log(`[LS] Processed talks ${i + 1}-${Math.min(i + BATCH_SIZE, limitedTalks.length)} / ${limitedTalks.length}`);
  }

  return messages;
}

function isSingleTalkPath(path) {
  // /users/my_talks/41292/ or /users/my_talks/41292/page5/ (with optional trailing slash)
  // Also: /users/my_talks/hide/41292/ or /users/my_talks/hide/41292/page5/
  return /^(?:\/users\/my_talks(?:\/hide)?\/\d+\/?)(?:page\d+\/?)?$/.test(path);
}

function getTalkIdFromPath(path) {
  // Match both /users/my_talks/XXXXX/ and /users/my_talks/hide/XXXXX/
  const match = path.match(/^\/users\/my_talks(?:\/hide)?\/(\d+)\/?/);
  return match ? match[1] : null;
}

function extractMessagesFromTalkDocument(doc, defaultPartner, talkId, pageUrl) {
  const result = [];
  const messageElements = doc.querySelectorAll('.user_message');
  
  messageElements.forEach((el) => {
    const msg = parseUserMessage(el, defaultPartner);
    if (msg) {
      if (talkId) {
        msg.talkId = talkId;
      }
      if (pageUrl) {
        msg.url = pageUrl;
      }
      result.push(msg);
    }
  });

  return result;
}

async function extractFromSingleTalk(doc) {
  const messages = [];
  const path = window.location.pathname;
  
  const talkId = getTalkIdFromPath(path);
  const isHidden = isHiddenTalksPath(path);
  const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';

  // Get current conversation partner from page title
  let currentPartner = '';
  const titleLink = doc.querySelector('#content h1 a');
  if (titleLink) {
    currentPartner = titleLink.textContent.trim();
  }

  const currentPageUrl = window.location.href;

  // currentPartner может быть пустым, тогда partner будет добываться из самих сообщений

  // Messages from the current page
  messages.push(
    ...extractMessagesFromTalkDocument(doc, currentPartner, talkId, currentPageUrl),
  );

  // Collect pagination links
  const pagesRoot = doc.querySelector('#pages');
  const pageLinks = pagesRoot
    ? Array.from(pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]'))
    : [];

  const urlSet = new Set();

  // Ensure base talk URL (page 1) is present if we know talkId
  if (talkId) {
    urlSet.add(`${talksBasePath}${talkId}/`);
  }

  pageLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      urlSet.add(href);
    }
  });

  const normalizedPath = path.endsWith('/') ? path : `${path}/`;

  // Normalize and filter out current page
  const pageUrls = Array.from(urlSet).filter((rawUrl) => {
    try {
      const urlObj = new URL(rawUrl, window.location.origin);
      const pagePath = urlObj.pathname.endsWith('/')
        ? urlObj.pathname
        : `${urlObj.pathname}/`;
      return pagePath !== normalizedPath;
    } catch (e) {
      return true;
    }
  });

  const otherMessages = await fetchTalkPages(pageUrls, currentPartner, talkId);
  messages.push(...otherMessages);

  return messages;
}

async function fetchFullTalkConversation(talkId, talkUrl, isHidden) {
  const messages = [];
  const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';

  try {
    const response = await fetch(talkUrl);
    if (!response.ok) {
      console.error('Failed to fetch talk page (list):', talkUrl, response.status);
      return messages;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const absoluteFirstPageUrl = new URL(talkUrl, window.location.origin).href;

    // Partner from fetched talk page
    let currentPartner = '';
    const titleLink = doc.querySelector('#content h1 a');
    if (titleLink) {
      currentPartner = titleLink.textContent.trim();
    }

    // Messages from the first page of this talk
    messages.push(
      ...extractMessagesFromTalkDocument(doc, currentPartner, talkId, absoluteFirstPageUrl),
    );

    // Collect pagination links inside this talk
    const pagesRoot = doc.querySelector('#pages');
    const pageLinks = pagesRoot
      ? Array.from(pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]'))
      : [];

    const urlSet = new Set();

    // Ensure base talk URL (page 1) is present
    urlSet.add(talkUrl);

    pageLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href) {
        urlSet.add(href);
      }
    });

    const firstPath = new URL(absoluteFirstPageUrl).pathname;
    const normalizedFirstPath = firstPath.endsWith('/') ? firstPath : `${firstPath}/`;

    // Normalize and filter out first page
    const pageUrls = Array.from(urlSet).filter((rawUrl) => {
      try {
        const urlObj = new URL(rawUrl, window.location.origin);
        const pagePath = urlObj.pathname.endsWith('/')
          ? urlObj.pathname
          : `${urlObj.pathname}/`;
        return pagePath !== normalizedFirstPath;
      } catch (e) {
        return true;
      }
    });

    const otherMessages = await fetchTalkPages(pageUrls, currentPartner, talkId);
    messages.push(...otherMessages);
  } catch (e) {
    console.error('Error while fetching full talk conversation:', talkUrl, e);
  }

  return messages;
}

async function fetchTalkPages(urls, defaultPartner, talkId) {
  const MAX_TALK_PAGES = 30;
  const limitedUrls = urls.slice(0, MAX_TALK_PAGES);

  const allPageMessages = await fetchBatch(limitedUrls, 10, (html, rawUrl) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const absoluteUrl = new URL(rawUrl, window.location.origin).href;
    return extractMessagesFromTalkDocument(doc, defaultPartner, talkId, absoluteUrl);
  });

  return allPageMessages.flat();
}

// Parse a .user_message element
function parseUserMessage(el, defaultPartner) {
  try {
    // Get all child divs
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

    // Extract messageId from wrapper id="msg_XXXXX" if available
    let messageId = null;
    const wrapper = headerDiv.parentNode;
    if (wrapper && wrapper.id) {
      const idMatch = String(wrapper.id).match(/^msg_(\d+)/);
      if (idMatch) {
        messageId = idMatch[1];
      }
    }
    
    // Get timestamp from span
    let timestamp = null;
    const timeSpan = headerDiv.querySelector('span');
    if (timeSpan) {
      const dateText = timeSpan.textContent.trim();
      timestamp = parseDate(dateText);
    }
    
    // Get user/partner from anchor
    let partner = defaultPartner;
    const userLink = headerDiv.querySelector('a[href^="/users/"]');
    
    if (userLink) {
      const href = userLink.getAttribute('href');
      // If link is to self - filter it out, keep defaultPartner
      if (href && href.includes('/83061/')) {
        // partner already = defaultPartner
      } else {
        // Try to get partner name from link text
        const linkText = userLink.textContent.trim();
        if (linkText) {
          partner = linkText;
        } else {
          // Link exists but has no text - keep defaultPartner (from page title)
        }
      }
    }

    // Get message text
    let text = '';
    if (textDiv) {
      text = textDiv.textContent.trim();
      
      // Always extract image URLs and append to text
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
      url: window.location.href,
      messageId: messageId || undefined
    };
    
  } catch (e) {
    return null;
  }
}

// Parse a talk row from the list page
function parseTalkRow(row, talkId) {
  try {
    const currentPath = window.location.pathname;
    const isHidden = isHiddenTalksPath(currentPath);
    const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';
    
    // Get partner username from the first column
    let partner = '';
    const firstCol = row.querySelector('td:first-child');
    
    if (firstCol) {
      // Find ALL links starting with /users/
      const allLinks = firstCol.querySelectorAll('a[href^="/users/"]');
      
      let partnerLink = null;
      // Use the second link (first one is for image)
      if (allLinks.length >= 2) {
        partnerLink = allLinks[1];
      } else if (allLinks.length === 1) {
        // If only one link, check if it has text
        if (allLinks[0].textContent.trim()) {
          partnerLink = allLinks[0];
        }
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

// Parse date from format "13.12.2024 18:15"
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

// Parse Russian date format from talks list
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
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.getTime();
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extractMessages') {
    extractAllMessages()
      .then(function(messages) {
        sendResponse({ messages: messages });
      })
      .catch(function(error) {
        console.error('extractAllMessages error:', error);
        sendResponse({ messages: [] });
      });
  }
  return true;
});

// Expose functions globally for inline-panel
window.extractAllMessages = extractAllMessages;
window.extractAllFromTalksList = extractAllFromTalksList;
window.extractFromSingleTalk = extractFromSingleTalk;
