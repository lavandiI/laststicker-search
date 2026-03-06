// Inline Storage - uses localStorage (fallback for userscript mode)
// For embedding directly into the page

const LS_KEY_MESSAGES = 'ls_search_messages';
const LS_KEY_LAST_QUERY = 'ls_search_last_query';
const LS_KEY_LAST_INDEXED_AT = 'ls_search_last_indexed_at';

// Use localStorage or fallback to global (for extension context)
const storage = (typeof localStorage !== 'undefined') ? localStorage : window;

/**
 * @typedef {Object} StickerMessage
 * @property {string} text
 * @property {string} partner
 * @property {number|null} [timestamp]
 * @property {string} [url]
 * @property {string} [talkId]
 * @property {string} [messageId]
 */

/**
 * Load all stored messages.
 * @returns {Promise<StickerMessage[]>}
 */
async function loadMessages() {
  try {
    const raw = storage.getItem(LS_KEY_MESSAGES);
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map(normalizeMessage);
  } catch (e) {
    console.error('[LS Search] Error loading messages:', e);
    return [];
  }
}

/**
 * Save messages and optional metadata.
 * @param {StickerMessage[]} messages
 * @param {{ indexedAt?: number }} [meta]
 */
async function saveMessages(messages, meta = {}) {
  try {
    console.log('[LS Storage] Saving messages:', messages.length);
    storage.setItem(LS_KEY_MESSAGES, JSON.stringify(messages));
    console.log('[LS Storage] Messages saved');
    
    if (meta.indexedAt) {
      storage.setItem(LS_KEY_LAST_INDEXED_AT, String(meta.indexedAt));
    }
  } catch (e) {
    console.error('[LS Search] Error saving messages:', e);
  }
}

/**
 * Clear all stored messages and related metadata.
 */
async function clearMessages() {
  storage.removeItem(LS_KEY_MESSAGES);
  storage.removeItem(LS_KEY_LAST_QUERY);
  storage.removeItem(LS_KEY_LAST_INDEXED_AT);
}

/**
 * Load last search query.
 * @returns {Promise<string>}
 */
async function loadLastQuery() {
  return storage.getItem(LS_KEY_LAST_QUERY) || '';
}

/**
 * Save last search query.
 * @param {string} query
 */
async function saveLastQuery(query) {
  storage.setItem(LS_KEY_LAST_QUERY, query);
}

/**
 * Load last indexed timestamp.
 * @returns {Promise<number|null>}
 */
async function loadLastIndexedAt() {
  const value = storage.getItem(LS_KEY_LAST_INDEXED_AT);
  if (!value) return null;
  
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

/**
 * Build stable key for deduplication.
 * @param {StickerMessage} msg
 * @returns {string}
 */
function buildMessageKey(msg) {
  const talkId = msg.talkId || '';
  const messageId = msg.messageId || '';
  
  if (talkId && messageId) {
    return `id::${talkId}::${messageId}`;
  }
  
  const partner = msg.partner || '';
  const text = msg.text || '';
  const ts = msg.timestamp || '';
  return `legacy::${partner}::${text}::${ts}::${talkId}`;
}

/**
 * Compute statistics for dialogs and messages.
 * @param {StickerMessage[]} messages
 * @returns {{ dialogsCount: number, messagesCount: number }}
 */
function getStats(messages) {
  const dialogs = new Set();
  
  messages.forEach((msg) => {
    if (msg && msg.partner) {
      dialogs.add(msg.partner);
    }
  });
  
  return {
    dialogsCount: dialogs.size,
    messagesCount: messages.length,
  };
}

/**
 * Ensure message object has expected shape.
 * @param {any} value
 * @returns {StickerMessage}
 */
function normalizeMessage(value) {
  const safe = typeof value === 'object' && value !== null ? value : {};
  
  return {
    text: typeof safe.text === 'string' ? safe.text : '',
    partner: typeof safe.partner === 'string' ? safe.partner : '',
    timestamp: typeof safe.timestamp === 'number' && !Number.isNaN(safe.timestamp) ? safe.timestamp : null,
    url: typeof safe.url === 'string' ? safe.url : undefined,
    talkId: typeof safe.talkId === 'string' ? safe.talkId : undefined,
    messageId: typeof safe.messageId === 'string' ? safe.messageId : undefined,
  };
}

// Export functions
window.InlineStorage = {
  loadMessages,
  saveMessages,
  clearMessages,
  loadLastQuery,
  saveLastQuery,
  loadLastIndexedAt,
  buildMessageKey,
  getStats,
};
