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
  } catch (e) {
    return true;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
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

// Early injection - inject all scripts at once
async function injectInlinePanelEarly(tabId) {
  if (!(await isExtensionEnabled())) {
    console.log('[LS Search] Extension disabled, skipping injection');
    return;
  }
  
  try {
    console.log('[LS Search] Early injection starting for tab:', tabId);
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    console.log('[LS Search] content.js injected (early)');
    
    await new Promise(r => setTimeout(r, 100));
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-storage.js']
    });
    console.log('[LS Search] inline-storage.js injected (early)');
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-ui.js']
    });
    console.log('[LS Search] inline-ui.js injected (early)');
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-panel.js']
    });
    console.log('[LS Search] inline-panel.js injected (early)');
    
  } catch (e) {
    console.error('[LS Search] Early injection error:', e);
  }
}

async function injectInlinePanel(tabId) {
  if (!(await isExtensionEnabled())) {
    console.log('[LS Search] Extension disabled, skipping injection');
    return;
  }
  
  console.log('[LS Search] injectInlinePanel called for tab:', tabId);
  
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          hasInlineStorage: typeof window.InlineStorage,
          hasInlineUI: typeof window.InlineUI,
          hasInlinePanelReady: typeof window.InlinePanelReady,
          inlinePanelExists: !!document.getElementById('ls-search-inline-panel')
        };
      }
    });
    console.log('[LS Search] Current page state:', results[0]?.result);
  } catch (e) {
    console.log('[LS Search] Could not check page state:', e.message);
  }
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-storage.js']
    });
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-ui.js']
    });
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inline-panel.js']
    });
    
    console.log('[LS Search] Inline panel injected');
  } catch (e) {
    console.error('[LS Search] Error injecting inline panel:', e);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LS Search] Background received message:', request.action);
  
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
            }, (injectionResults) => {
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
      indexAllSectionsAsync(request, sender, sendResponse);
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
  const baseUrl = 'https://laststicker.ru';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('laststicker.ru')) {
    sendResponse({ error: 'Откройте страницу laststicker.ru' });
    return;
  }

  console.log('[LastSticker Search] Starting full indexing from inline-panel');
  console.log('[LastSticker Search] Sections to index:', SECTIONS.map(s => s.name));
  
  let allMessages = [];

  const firstSection = SECTIONS[0];
  console.log(`[LastSticker Search] Fetching ${firstSection.name} without navigation`);
  
  try {
    const response = await fetch(baseUrl + firstSection.path, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log(`[LastSticker Search] Failed to fetch ${firstSection.name}: ${response.status}`);
    } else {
      const html = await response.text();
      console.log(`[LastSticker Search] Fetched ${firstSection.name}, extracting talk IDs from all pages...`);
      
      const talkIds = await extractAllTalkIdsWithPagination(html, baseUrl + firstSection.path, tab.id);
      console.log(`[LastSticker Search] Found ${talkIds.length} talks in ${firstSection.name} (all pages)`);
      
      const talkMessages = await fetchAllHiddenTalkMessages(talkIds, baseUrl, tab.id);
      console.log(`[LastSticker Search] Extracted ${talkMessages.length} messages from ${firstSection.name}`);
      allMessages = allMessages.concat(talkMessages);
    }
  } catch (e) {
    console.error(`Error fetching ${firstSection.name}:`, e);
  }
  
  const hiddenSection = SECTIONS[1];
  console.log(`[LastSticker Search] Fetching ${hiddenSection.name} without navigation`);
  
  try {
    const response = await fetch(baseUrl + hiddenSection.path, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log(`[LastSticker Search] Failed to fetch ${hiddenSection.name}: ${response.status}`);
    } else {
      const html = await response.text();
      console.log(`[LastSticker Search] Fetched ${hiddenSection.name}, extracting talk IDs from all pages...`);
      
      const talkIds = await extractAllTalkIdsWithPagination(html, baseUrl + hiddenSection.path, tab.id);
      console.log(`[LastSticker Search] Found ${talkIds.length} talks in ${hiddenSection.name} (all pages)`);
      
      const hiddenMessages = await fetchAllHiddenTalkMessages(talkIds, baseUrl, tab.id);
      console.log(`[LastSticker Search] Extracted ${hiddenMessages.length} messages from ${hiddenSection.name}`);
      allMessages = allMessages.concat(hiddenMessages);
    }
  } catch (e) {
    console.error(`Error fetching ${hiddenSection.name}:`, e);
  }

  console.log(`[LastSticker Search] Total messages collected: ${allMessages.length}`);
  console.log(`[LastSticker Search] Indexed sections: ${SECTIONS.map(s => s.name)}`);
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (messages) => {
        let existing = [];
        try {
          const raw = localStorage.getItem('ls_search_messages');
          if (raw) {
            existing = JSON.parse(raw);
          }
        } catch (e) {}
        
        function buildKey(msg) {
          const talkId = msg.talkId || '';
          const messageId = msg.messageId || '';
          if (talkId && messageId) {
            return 'id::' + talkId + '::' + messageId;
          }
          const partner = msg.partner || '';
          const text = msg.text || '';
          const ts = msg.timestamp || '';
          return 'legacy::' + partner + '::' + text + '::' + ts + '::' + talkId;
        }
        
        const map = new Map();
        existing.forEach(m => map.set(buildKey(m), m));
        messages.forEach(m => map.set(buildKey(m), m));
        const merged = Array.from(map.values());
        
        localStorage.setItem('ls_search_messages', JSON.stringify(merged));
        localStorage.setItem('ls_search_last_indexed_at', String(Date.now()));
        console.log('[LastSticker Search] Saved messages to localStorage:', merged.length);
        
        const updateUI = () => {
          if (typeof window.InlineStorage !== 'undefined' && typeof window.InlineUI !== 'undefined') {
            const stats = window.InlineStorage.getStats(merged);
            window.InlineUI.renderStats(stats);
            window.InlineUI.renderLastIndexedAt(Date.now());
            
            if (typeof window.InlineUI.showStatus === 'function') {
              window.InlineUI.showStatus('Индексация завершена: ' + stats.dialogsCount + ' диалогов, ' + stats.messagesCount + ' сообщений', 'success');
            }
          }
        };
        
        updateUI();
        setTimeout(updateUI, 500);
        setTimeout(updateUI, 1500);
      },
      args: [allMessages]
    });
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
  
  sendResponse({ messages: allMessages, indexedSections: SECTIONS.map(s => s.name) });
}

async function extractMessagesFromHtml(html, baseUrl) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: 0 },
      func: (htmlContent, pageUrl) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        
        const isHidden = path.includes('/hide/');
        const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';
        
        const talks = [];
        const talkRows = doc.querySelectorAll('#talks_table tr[id^="talk_"]');
        
        talkRows.forEach((row) => {
          const idAttr = row.id || '';
          const talkId = idAttr.replace('talk_', '').trim();
          if (!talkId) return;
          
          talks.push({
            talkId,
            url: `/users/my_talks/${talkId}/`,
          });
        });
        
        const messages = [];
        
        talkRows.forEach((row) => {
          const talkId = row.id.replace('talk_', '').trim();
          if (!talkId) return;
          
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
          
          let text = '';
          const messageDiv = doc.getElementById('talk_text_' + talkId);
          if (messageDiv) {
            const clone = messageDiv.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
            text = clone.textContent.trim();
          }
          
          let timestamp = null;
          const secondCol = row.querySelector('td:last-child');
          if (secondCol) {
            const timeSpan = secondCol.querySelector('.clear span');
            if (timeSpan) {
              const dateText = timeSpan.textContent.trim();
              timestamp = parseRussianDate(dateText);
            }
          }
          
          if (text && text.length >= 1) {
            messages.push({
              text: text.replace(/\s+/g, ' ').trim(),
              partner: partner,
              timestamp: timestamp,
              talkId: talkId,
              url: `/users/my_talks/${talkId}/`
            });
          }
        });
        
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
              
              const months = {
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
              
              const normalized = monthName.toLowerCase().replace('&nbsp;', '');
              const monthNum = months[normalized];
              if (monthNum !== undefined) {
                return new Date(currentYear, monthNum, day, hours, minutes).getTime();
              }
            }
            
            return null;
          } catch (e) {
            return null;
          }
        }
        
        return messages;
      },
      args: [html, baseUrl]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log('Error extracting from HTML:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      if (results && results[0] && results[0].result) {
        resolve(results[0].result);
      } else {
        resolve([]);
      }
    });
  });
}

function extractMessagesFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractMessages' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Runtime error:', chrome.runtime.lastError);
        resolve([]);
        return;
      }

      if (response && Array.isArray(response.messages)) {
        resolve(response.messages);
      } else {
        resolve([]);
      }
    });
  });
}

async function extractAllTalkIdsWithPagination(html, baseUrl, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent, baseUrl) => {
        const allTalkIds = [];
        
        function extractTalkIds(doc) {
          const talkIds = [];
          const talkRows = doc.querySelectorAll('#talks_table tr[id^="talk_"]');
          
          talkRows.forEach((row) => {
            const idAttr = row.id || '';
            const talkId = idAttr.replace('talk_', '').trim();
            if (talkId) {
              talkIds.push(talkId);
            }
          });
          
          return talkIds;
        }
        
        const parser = new DOMParser();
        let doc = parser.parseFromString(htmlContent, 'text/html');
        
        allTalkIds.push(...extractTalkIds(doc));
        
        const pagesRoot = doc.querySelector('#pages');
        const pageUrls = new Set();
        
        if (pagesRoot) {
          const isHidden = baseUrl.includes('/hide/');
          const hrefPattern = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/page';
          
          const pageLinks = pagesRoot.querySelectorAll('a.page[href*="' + hrefPattern + '"]');
          pageLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href) pageUrls.add(href);
          });
        }
        
        console.log('[LS] Found pagination pages:', pageUrls.size);
        
        const otherPages = Array.from(pageUrls).slice(0, 50);
        
        for (const pageUrl of otherPages) {
          try {
            const pageResponse = await fetch(pageUrl, { credentials: 'include' });
            if (!pageResponse.ok) continue;
            
            const pageHtml = await pageResponse.text();
            const pageDoc = parser.parseFromString(pageHtml, 'text/html');
            
            const pageTalkIds = extractTalkIds(pageDoc);
            allTalkIds.push(...pageTalkIds);
            
            console.log('[LS] Page', pageUrl, 'has', pageTalkIds.length, 'talks');
          } catch (e) {
            console.log('[LS] Error fetching page:', pageUrl, e);
          }
        }
        
        return allTalkIds;
      },
      args: [html, baseUrl]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log('Error extracting talk IDs with pagination:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      if (results && results[0] && results[0].result) {
        resolve(results[0].result);
      } else {
        resolve([]);
      }
    });
  });
}

async function extractTalkIdsFromHtml(html, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (htmlContent) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const talkIds = [];
        const talkRows = doc.querySelectorAll('#talks_table tr[id^="talk_"]');
        
        talkRows.forEach((row) => {
          const idAttr = row.id || '';
          const talkId = idAttr.replace('talk_', '').trim();
          if (talkId) {
            talkIds.push(talkId);
          }
        });
        
        return talkIds;
      },
      args: [html]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.log('Error extracting talk IDs:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      if (results && results[0] && results[0].result) {
        resolve(results[0].result);
      } else {
        resolve([]);
      }
    });
  });
}

async function fetchAllHiddenTalkMessages(talkIds, baseUrl, tabId) {
  const allMessages = [];
  const MAX_TALKS = 2000;
  const limitedTalks = talkIds.slice(0, MAX_TALKS);
  
  console.log(`[LastSticker Search] Fetching messages from ${limitedTalks.length} hidden talks`);
  
  for (let i = 0; i < limitedTalks.length; i++) {
    const talkId = limitedTalks[i];
    
    if (i % 10 === 0) {
      console.log(`[LastSticker Search] Processing hidden talk ${i + 1}/${limitedTalks.length}`);
    }
    
    try {
      const talkMessages = await fetchTalkMessages(talkId, baseUrl, tabId);
      allMessages.push(...talkMessages);
    } catch (e) {
      console.error(`Error fetching talk ${talkId}:`, e);
    }
  }
  
  return allMessages;
}

async function fetchTalkMessages(talkId, baseUrl, tabId) {
  const messages = [];
  const talkUrl = `${baseUrl}/users/my_talks/${talkId}/`;
  
  console.log(`[LS] Fetching hidden talk: ${talkUrl}`);
  
  try {
    const response = await fetch(talkUrl, { credentials: 'include' });
    console.log(`[LS] Response status for ${talkUrl}: ${response.status}`);
    
    if (!response.ok) {
      console.log(`[LS] Failed to fetch ${talkUrl}: ${response.status}`);
      return messages;
    }
    
    const html = await response.text();
    
    const extracted = await parseTalkHtmlWithPagination(html, talkUrl, tabId);
    
    if (extracted && extracted.messages) {
      messages.push(...extracted.messages);
    }
    
  } catch (e) {
    console.error(`Error fetching talk ${talkId}:`, e);
  }
  
  return messages;
}

async function parseTalkHtmlWithPagination(html, talkUrl, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent, url) => {
        console.log('[LS] Parsing talk:', url);
        
        function extractMessagesFromDoc(doc, defaultPartner, talkId) {
          const messages = [];
          const messageElements = doc.querySelectorAll('.user_message');
          console.log('[LS] extractMessagesFromDoc: found elements:', messageElements.length);
          
          messageElements.forEach((el) => {
            const msg = parseUserMessageEl(el, defaultPartner, talkId);
            if (msg) {
              messages.push(msg);
            }
          });
          
          return messages;
        }
        
        function parseUserMessageEl(el, defaultPartner, talkId) {
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
            const wrapper = headerDiv.parentNode;
            if (wrapper && wrapper.id) {
              const idMatch = String(wrapper.id).match(/^msg_(\d+)/);
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
              url: `https://laststicker.ru/users/my_talks/${talkId}/`,
              talkId: talkId,
              messageId: messageId || undefined
            };
            
          } catch (e) {
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
          } catch (e) {
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
        
        const messages = [];
        
        messages.push(...extractMessagesFromDoc(doc, partner, talkId));
        console.log('[LS] Parsed messages count:', messages.length);
        
        const allUrls = new Set([url]);
        const pagesRoot = doc.querySelector('#pages');
        if (pagesRoot) {
          const pageLinks = pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]');
          pageLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href) allUrls.add(href);
          });
        }
        
        const otherUrls = Array.from(allUrls).filter(u => u !== url).slice(0, 30);
        
        for (const pageUrl of otherUrls) {
          try {
            const pageResponse = await fetch(pageUrl, { credentials: 'include' });
            if (!pageResponse.ok) continue;
            
            const pageHtml = await pageResponse.text();
            const pageDoc = parser.parseFromString(pageHtml, 'text/html');
            
            messages.push(...extractMessagesFromDoc(pageDoc, partner, talkId));
          } catch (e) {
          }
        }
        
        return { messages: messages };
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

function extractMessagesFromDoc(doc, defaultPartner, talkId) {
  const messages = [];
  const messageElements = doc.querySelectorAll('.user_message');
  
  messageElements.forEach((el) => {
    const msg = parseUserMessageEl(el, defaultPartner, talkId);
    if (msg) {
      messages.push(msg);
    }
  });
  
  return messages;
}

function parseUserMessageEl(el, defaultPartner, talkId) {
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
    const wrapper = headerDiv.parentNode;
    if (wrapper && wrapper.id) {
      const idMatch = String(wrapper.id).match(/^msg_(\d+)/);
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
      
      if (!text) {
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
          text = '[Image: ' + imgSrcs.join(', ') + ']';
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
      url: `https://laststicker.ru/users/my_talks/${talkId}/`,
      talkId: talkId,
      messageId: messageId || undefined
    };
    
  } catch (e) {
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
  } catch (e) {
    return null;
  }
}
