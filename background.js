// Background script for LastSticker Search
// Handles message passing and script injection

console.log('[LS Search] Background script loaded');

// Background script for LastSticker Search
// Handles message passing and script injection

console.log('[LS Search] Background script loaded');

// Note: Content script now handles initialization itself via messaging
// This listener is disabled to avoid double injection
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   console.log('[LS Search] Tab updated:', tabId, changeInfo.status);
//   
//   // Only inject at complete status (backup if content script fails)
//   if (changeInfo.status === 'complete') {
//     chrome.tabs.get(tabId, (updatedTab) => {
//       if (chrome.runtime.lastError) return;
//       const url = updatedTab.url;
//       console.log('[LS Search] Tab URL:', url);
//       
//       if (url && url.includes('/users/my_talks')) {
//         console.log('[LS Search] Injecting at complete stage');
//         // Check if already injected before injecting
//         checkAndInjectInlinePanel(tabId);
//       }
//     });
//   }
// });

// Early injection - inject all scripts at once
async function injectInlinePanelEarly(tabId) {
  try {
    console.log('[LS Search] Early injection starting for tab:', tabId);
    
    // Inject all scripts in order
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    console.log('[LS Search] content.js injected (early)');
    
    // Small delay then inject inline scripts
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
  console.log('[LS Search] injectInlinePanel called for tab:', tabId);
  
  // DEBUG: Check current state
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
    // Inject storage first, then UI, then main panel
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
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      const tab = tabs[0];
      
      // First try to send message directly to content script
      chrome.tabs.sendMessage(tab.id, request, (response) => {
        // Check if there was an error
        if (chrome.runtime.lastError) {
          // Content script not loaded - inject it
          console.log('Content script not found, injecting...');
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, (injectionResults) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }
            
            // Wait a bit for script to load
            setTimeout(() => {
              // Try again
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
          // Success
          sendResponse(response);
        }
      });
    });
    
    return true; // Keep channel open for async response
  }

  // Handle automatic indexing of all sections
  if (request.action === 'indexAllSections') {
    indexAllSectionsAsync(request, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  // Handle injection requests from content script
  if (request.action === 'injectDependencies') {
    // Get the tab that sent the message
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      const tab = tabs[0];
      
      // Check if URL is valid for injection
      if (!tab.url || !tab.url.startsWith('http')) {
        console.log('[LS Search] Skipping injection - invalid URL:', tab.url);
        sendResponse({ error: 'Cannot inject into this URL' });
        return;
      }
      
      try {
        // Check if already injected
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
        
        // Inject storage and UI
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
    return true; // Keep channel open for async response
  }

  // Handle inline-panel injection request
  if (request.action === 'injectInlinePanel') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      const tab = tabs[0];
      
      // Check if URL is valid for injection
      if (!tab.url || !tab.url.startsWith('http')) {
        console.log('[LS Search] Skipping injection - invalid URL:', tab.url);
        sendResponse({ error: 'Cannot inject into this URL' });
        return;
      }
      
      try {
        // Check if already injected
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
    return true; // Keep channel open for async response
  }
});

// Sections to index automatically
const SECTIONS = [
  { path: '/users/my_talks/', name: 'Мои разговоры' },
  { path: '/users/my_talks/hide/', name: 'Скрытые' }
];

async function indexAllSectionsAsync(request, sender, sendResponse) {
  const baseUrl = 'https://laststicker.ru';

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('laststicker.ru')) {
    sendResponse({ error: 'Откройте страницу laststicker.ru' });
    return;
  }

  console.log('[LastSticker Search] Starting full indexing from inline-panel');
  console.log('[LastSticker Search] Sections to index:', SECTIONS.map(s => s.name));
  
  // Collect all messages in array
  let allMessages = [];

  // First section: Navigate to page and extract (my_talks)
  const firstSection = SECTIONS[0];
  console.log(`[LastSticker Search] Navigating to ${firstSection.name}: ${baseUrl + firstSection.path}`);
  
  await chrome.tabs.update(tab.id, { url: baseUrl + firstSection.path });
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  const updatedTab = await chrome.tabs.get(tab.id);
  if (!updatedTab.url || updatedTab.url.includes('login')) {
    sendResponse({ error: 'Требуется авторизация' });
    return;
  }
  
  console.log(`[LastSticker Search] Page loaded: ${updatedTab.url}`);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    console.log(`[LastSticker Search] Injected content script for ${firstSection.name}`);
  } catch (e) {
    console.error(`Error injecting script for ${firstSection.name}:`, e);
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const sectionMessages = await extractMessagesFromTab(tab.id);
    console.log(`[LastSticker Search] Extracted ${sectionMessages.length} messages from ${firstSection.name}`);
    allMessages = allMessages.concat(sectionMessages);
  } catch (e) {
    console.error(`Error indexing ${firstSection.name}:`, e);
  }

  // Second section: Use fetch() to get HTML without navigation (Скрытые)
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
      
      // Parse HTML and get talk IDs from all pages (with pagination)
      const talkIds = await extractAllTalkIdsWithPagination(html, baseUrl + hiddenSection.path, tab.id);
      console.log(`[LastSticker Search] Found ${talkIds.length} talks in ${hiddenSection.name} (all pages)`);
      
      // Fetch all messages from each hidden talk
      const hiddenMessages = await fetchAllHiddenTalkMessages(talkIds, baseUrl, tab.id);
      console.log(`[LastSticker Search] Extracted ${hiddenMessages.length} messages from ${hiddenSection.name}`);
      allMessages = allMessages.concat(hiddenMessages);
    }
  } catch (e) {
    console.error(`Error fetching ${hiddenSection.name}:`, e);
  }

  console.log(`[LastSticker Search] Total messages collected: ${allMessages.length}`);
  console.log(`[LastSticker Search] Indexed sections: ${SECTIONS.map(s => s.name)}`);
  
  // Save to localStorage for inline-panel (only once at the end)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (messages) => {
        // First load existing messages
        let existing = [];
        try {
          const raw = localStorage.getItem('ls_search_messages');
          if (raw) {
            existing = JSON.parse(raw);
          }
        } catch (e) {}
        
        // Merge with new messages
        const map = new Map();
        existing.forEach(m => map.set(m.text + '|' + m.partner, m));
        messages.forEach(m => map.set(m.text + '|' + m.partner, m));
        const merged = Array.from(map.values());
        
        localStorage.setItem('ls_search_messages', JSON.stringify(merged));
        localStorage.setItem('ls_search_last_indexed_at', String(Date.now()));
        console.log('[LastSticker Search] Saved messages to localStorage:', merged.length);
        
        // Update UI stats after saving - with retry for page load timing
        const updateUI = () => {
          if (typeof window.InlineStorage !== 'undefined' && typeof window.InlineUI !== 'undefined') {
            const stats = window.InlineStorage.getStats(merged);
            window.InlineUI.renderStats(stats);
            window.InlineUI.renderLastIndexedAt(Date.now());
            
            // Show success message
            if (typeof window.InlineUI.showStatus === 'function') {
              window.InlineUI.showStatus('Индексация завершена: ' + stats.dialogsCount + ' диалогов, ' + stats.messagesCount + ' сообщений', 'success');
            }
          }
        };
        
        // Try immediately, then with delay
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

// Extract messages from HTML string (without page navigation)
async function extractMessagesFromHtml(html, baseUrl) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: 0 }, // dummy, will use func instead
      func: (htmlContent, pageUrl) => {
        // Create DOM from HTML string
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Use the existing extraction logic from content.js
        // We need to call extractAllFromTalksList with the parsed document
        
        // Get path to determine which extraction function to use
        const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        
        // Check if it's hidden talks
        const isHidden = path.includes('/hide/');
        const talksBasePath = isHidden ? '/users/my_talks/hide/' : '/users/my_talks/';
        
        // Collect all talk IDs from current page
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
        
        // Fetch messages from each talk
        const messages = [];
        
        // For now, just extract from list (last message from each talk)
        // Full pagination would require fetching each talk page
        talkRows.forEach((row) => {
          const talkId = row.id.replace('talk_', '').trim();
          if (!talkId) return;
          
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
          const messageDiv = doc.getElementById('talk_text_' + talkId);
          if (messageDiv) {
            const clone = messageDiv.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
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

// Extract messages from a specific tab
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

// Extract talk IDs from HTML with pagination (for hidden talks list)
async function extractAllTalkIdsWithPagination(html, baseUrl, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent, baseUrl) => {
        const allTalkIds = [];
        
        // Helper function to extract talk IDs from a document
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
        
        // Parse first page
        const parser = new DOMParser();
        let doc = parser.parseFromString(htmlContent, 'text/html');
        
        allTalkIds.push(...extractTalkIds(doc));
        
        // Get pagination links
        const pagesRoot = doc.querySelector('#pages');
        const pageUrls = new Set();
        
        if (pagesRoot) {
          const pageLinks = pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/hide/"]');
          pageLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href) pageUrls.add(href);
          });
        }
        
        console.log('[LS] Found pagination pages:', pageUrls.size);
        
        // Fetch other pages (limit to 50 pages)
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

// Extract talk IDs from HTML (for hidden talks) - uses current tab context
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

// Fetch all messages from all hidden talks
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

// Fetch all messages from a single talk (with pagination) - uses page context for parsing
async function fetchTalkMessages(talkId, baseUrl, tabId) {
  const messages = [];
  // Hidden talks use the same URL format as regular talks
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
    
    // Parse in page context
    const extracted = await parseTalkHtmlWithPagination(html, talkUrl, tabId);
    
    if (extracted && extracted.messages) {
      messages.push(...extracted.messages);
    }
    
  } catch (e) {
    console.error(`Error fetching talk ${talkId}:`, e);
  }
  
  return messages;
}

// Parse talk HTML with full pagination in page context
async function parseTalkHtmlWithPagination(html, talkUrl, tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (htmlContent, url) => {
        console.log('[LS] Parsing talk:', url);
        
        // Helper function to extract messages from document
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
        
        // Helper function to parse user message
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

            // Extract messageId
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
              timestamp = parseDateStr(dateText);
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
        
        // Parse date string
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
        
        // Debug: check what elements exist
        const userMessages = doc.querySelectorAll('.user_message');
        console.log('[LS] Found .user_message elements:', userMessages.length);
        
        const talkDiv = doc.querySelector('#talk');
        console.log('[LS] Found #talk:', !!talkDiv);
        
        const contentDiv = doc.querySelector('#content');
        console.log('[LS] Found #content:', !!contentDiv);
        
        // Get partner from page title
        let partner = '';
        const titleLink = doc.querySelector('#content h1 a');
        if (titleLink) {
          partner = titleLink.textContent.trim();
        }
        console.log('[LS] Partner:', partner);
        
        // Extract talkId from URL
        const match = url.match(/\/users\/my_talks\/(\d+)\//);
        const talkId = match ? match[1] : '';
        
        const messages = [];
        
        // Parse first page
        messages.push(...extractMessagesFromDoc(doc, partner, talkId));
        console.log('[LS] Parsed messages count:', messages.length);
        
        // Get all pagination pages
        const allUrls = new Set([url]);
        const pagesRoot = doc.querySelector('#pages');
        if (pagesRoot) {
          const pageLinks = pagesRoot.querySelectorAll('a.page[href*="/users/my_talks/"]');
          pageLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href) allUrls.add(href);
          });
        }
        
        // Fetch other pages (limit to 30 pages)
        const otherUrls = Array.from(allUrls).filter(u => u !== url).slice(0, 30);
        
        for (const pageUrl of otherUrls) {
          try {
            const pageResponse = await fetch(pageUrl, { credentials: 'include' });
            if (!pageResponse.ok) continue;
            
            const pageHtml = await pageResponse.text();
            const pageDoc = parser.parseFromString(pageHtml, 'text/html');
            
            messages.push(...extractMessagesFromDoc(pageDoc, partner, talkId));
          } catch (e) {
            // Continue to next page
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

// Extract messages from document (runs in page context)
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

// Parse a user message element (runs in page context)
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

    // Extract messageId
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
      timestamp = parseDateStr(dateText);
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

// Parse date string (runs in page context)
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
