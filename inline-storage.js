// Inline Storage - extension storage with a localStorage fallback for userscript mode.
// For embedding directly into the page.

const LS_KEY_MESSAGES = 'ls_search_messages';
const LS_KEY_LAST_QUERY = 'ls_search_last_query';
const LS_KEY_LAST_INDEXED_AT = 'ls_search_last_indexed_at';
const LS_KEY_MIGRATED = 'ls_search_storage_migrated';
const LS_KEY_READ_NOTICE_SEEN = 'ls_search_read_notice_seen';
const LS_KEY_FULL_INDEX_AT = 'ls_search_full_index_at';
const LS_KEY_AUTO_ENABLED = 'ls_search_auto_enabled';
const LS_KEY_AUTO_META = 'ls_search_auto_meta';
const LS_KEY_INDEX_GENERATION = 'ls_search_index_generation';

const hasChromeStorage =
  typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
const hasChromeRuntime =
  typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
const isOffscreenContext =
  typeof window !== 'undefined' &&
  window.location &&
  window.location.protocol === 'chrome-extension:';
const useStorageRpc = !hasChromeStorage && hasChromeRuntime;

let migrationPromise = null;

function storageRpc(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { target: 'background', action, ...payload },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('Storage RPC returned no response'));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.result);
      },
    );
  });
}

function localGet(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function localSet(key, value) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

function localRemove(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

function removeLegacyLocalKeys() {
  localRemove(LS_KEY_MESSAGES);
  localRemove(LS_KEY_LAST_QUERY);
  localRemove(LS_KEY_LAST_INDEXED_AT);
}

function removeOffscreenLocalKeys() {
  [
    LS_KEY_MESSAGES,
    LS_KEY_LAST_QUERY,
    LS_KEY_LAST_INDEXED_AT,
    LS_KEY_MIGRATED,
    LS_KEY_READ_NOTICE_SEEN,
    LS_KEY_FULL_INDEX_AT,
    LS_KEY_AUTO_ENABLED,
    LS_KEY_AUTO_META,
    LS_KEY_INDEX_GENERATION,
    'ls_search_test_backup',
  ].forEach(localRemove);
}

async function migrateOffscreenLocalStorage() {
  if (!hasChromeRuntime) return;

  try {
    const current = await storageRpc('lsStorageGet', {
      keys: [
        LS_KEY_MESSAGES,
        LS_KEY_LAST_INDEXED_AT,
        LS_KEY_FULL_INDEX_AT,
        LS_KEY_AUTO_ENABLED,
        LS_KEY_AUTO_META,
        LS_KEY_INDEX_GENERATION,
        LS_KEY_LAST_QUERY,
        LS_KEY_READ_NOTICE_SEEN,
      ],
    });

    if (current && current[LS_KEY_MESSAGES]) {
      // The normal extension storage already has an index. Offscreen-local
      // data is a stale fallback from the broken 1.4.0 build.
      removeOffscreenLocalKeys();
      return;
    }

    const localMessages = localGet(LS_KEY_MESSAGES);
    if (!localMessages) {
      removeOffscreenLocalKeys();
      return;
    }

    const values = { [LS_KEY_MESSAGES]: localMessages };
    [
      LS_KEY_LAST_INDEXED_AT,
      LS_KEY_FULL_INDEX_AT,
      LS_KEY_AUTO_ENABLED,
      LS_KEY_AUTO_META,
      LS_KEY_INDEX_GENERATION,
      LS_KEY_LAST_QUERY,
      LS_KEY_READ_NOTICE_SEEN,
    ].forEach((key) => {
      const value = localGet(key);
      if (value !== null) values[key] = value;
    });

    await storageRpc('lsStorageSet', { items: values });
    removeOffscreenLocalKeys();
    console.log('[LS Search] Migrated offscreen localStorage to chrome.storage');
  } catch (e) {
    // Keep local data if the copy failed, so a later attempt can retry.
    console.error('[LS Search] Offscreen storage migration failed:', e);
  }
}

async function migrateFromLocalStorage() {
  if (isOffscreenContext) {
    await migrateOffscreenLocalStorage();
    return;
  }

  if (!hasChromeStorage) return;

  try {
    const current = await chrome.storage.local.get([LS_KEY_MESSAGES, LS_KEY_MIGRATED]);
    if (current[LS_KEY_MIGRATED]) return;

    // If extension storage already has messages, keep them: they are newer
    // than whatever may still be in the page's localStorage.
    if (current[LS_KEY_MESSAGES]) {
      await chrome.storage.local.set({ [LS_KEY_MIGRATED]: true });
      removeLegacyLocalKeys();
      return;
    }

    const values = {};
    for (const key of [LS_KEY_MESSAGES, LS_KEY_LAST_QUERY, LS_KEY_LAST_INDEXED_AT]) {
      const raw = localGet(key);
      if (raw !== null) values[key] = raw;
    }

    if (Object.keys(values).length > 0) {
      await chrome.storage.local.set(values);
      removeLegacyLocalKeys();
    }

    await chrome.storage.local.set({ [LS_KEY_MIGRATED]: true });
  } catch (e) {
    // Keep localStorage untouched if the copy failed.
    console.error('[LS Search] Storage migration failed:', e);
  }
}

function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrateFromLocalStorage();
  }
  return migrationPromise;
}

async function storageGet(key) {
  await ensureMigrated();

  if (useStorageRpc) {
    const result = await storageRpc('lsStorageGet', { keys: [key] });
    return result[key];
  }

  if (hasChromeStorage) {
    const result = await chrome.storage.local.get(key);
    if (result[key] !== undefined) {
      return result[key];
    }
  }

  // If the extension storage is empty (for example, migration failed due to
  // quota), keep reading the legacy page storage until it can be migrated.
  return localGet(key);
}

async function storageSet(key, value) {
  await ensureMigrated();

  if (useStorageRpc) {
    await storageRpc('lsStorageSet', { items: { [key]: value } });
    localRemove(key);
    return;
  }

  if (hasChromeStorage) {
    await chrome.storage.local.set({ [key]: value });
    localRemove(key);
    return;
  }

  localSet(key, value);
}

async function storageRemove(key) {
  await ensureMigrated();

  if (useStorageRpc) {
    await storageRpc('lsStorageRemove', { keys: [key] });
    localRemove(key);
    return;
  }

  if (hasChromeStorage) {
    await chrome.storage.local.remove(key);
  }

  localRemove(key);
}

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
    const raw = await storageGet(LS_KEY_MESSAGES);
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
 * @returns {Promise<boolean>}
 */
async function saveMessages(messages, meta = {}) {
  try {
    console.log('[LS Storage] Saving messages:', messages.length);
    await storageSet(LS_KEY_MESSAGES, JSON.stringify(messages));

    if (meta.indexedAt) {
      await storageSet(LS_KEY_LAST_INDEXED_AT, String(meta.indexedAt));
    }

    console.log('[LS Storage] Messages saved');
    return true;
  } catch (e) {
    console.error('[LS Search] Error saving messages:', e);
    return false;
  }
}

/**
 * Clear all stored messages and related metadata.
 */
async function clearMessages() {
  await bumpIndexGeneration();
  await storageRemove(LS_KEY_MESSAGES);
  await storageRemove(LS_KEY_LAST_QUERY);
  await storageRemove(LS_KEY_LAST_INDEXED_AT);
  await storageRemove(LS_KEY_FULL_INDEX_AT);
  await storageRemove(LS_KEY_AUTO_META);
}

/**
 * Load last search query.
 * @returns {Promise<string>}
 */
async function loadLastQuery() {
  return (await storageGet(LS_KEY_LAST_QUERY)) || '';
}

/**
 * Save last search query.
 * @param {string} query
 */
async function saveLastQuery(query) {
  try {
    await storageSet(LS_KEY_LAST_QUERY, query);
  } catch (e) {
    console.error('[LS Search] Error saving last query:', e);
  }
}

/**
 * Load last indexed timestamp.
 * @returns {Promise<number|null>}
 */
async function loadLastIndexedAt() {
  const value = await storageGet(LS_KEY_LAST_INDEXED_AT);
  if (!value) return null;

  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

/**
 * Load the one-time notice about dialogs being marked as read.
 * @returns {Promise<boolean>}
 */
async function loadReadNoticeSeen() {
  const value = await storageGet(LS_KEY_READ_NOTICE_SEEN);
  return value === '1' || value === true;
}

/**
 * Remember that the read-marking notice was shown and dismissed.
 * @returns {Promise<void>}
 */
async function saveReadNoticeSeen() {
  await storageSet(LS_KEY_READ_NOTICE_SEEN, '1');
}

/**
 * Size of the stored message index in bytes, or null when unavailable.
 * @returns {Promise<number|null>}
 */
async function getIndexBytes() {
  await ensureMigrated();

  if (useStorageRpc) {
    try {
      return await storageRpc('lsStorageGetBytes', { key: LS_KEY_MESSAGES });
    } catch {
      return null;
    }
  }

  if (hasChromeStorage) {
    if (typeof chrome.storage.local.getBytesInUse === 'function') {
      try {
        return await chrome.storage.local.getBytesInUse(LS_KEY_MESSAGES);
      } catch {
        return null;
      }
    }

    try {
      const stored = await chrome.storage.local.get(LS_KEY_MESSAGES);
      const rawStored = stored[LS_KEY_MESSAGES];
      return rawStored ? new TextEncoder().encode(rawStored).length : 0;
    } catch {
      return null;
    }
  }

  const raw = localGet(LS_KEY_MESSAGES);
  if (!raw) return 0;

  try {
    return new TextEncoder().encode(raw).length;
  } catch {
    return raw.length;
  }
}

/**
 * Timestamp of the last complete index, or null.
 * @returns {Promise<number|null>}
 */
async function loadFullIndexAt() {
  const value = await storageGet(LS_KEY_FULL_INDEX_AT);
  if (!value) return null;

  const num = parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Mark the index as complete.
 * @param {number} [timestamp]
 */
async function saveFullIndexAt(timestamp = Date.now()) {
  await storageSet(LS_KEY_FULL_INDEX_AT, String(timestamp));
}

/**
 * Existing users already have an index but no full-index flag. Treat a
 * non-empty index with a lastIndexedAt timestamp as complete.
 * @returns {Promise<boolean>}
 */
async function ensureFullIndexFlag() {
  const existing = await loadFullIndexAt();
  if (existing) return true;

  const lastIndexedAt = await loadLastIndexedAt();
  if (!lastIndexedAt) return false;

  const messages = await loadMessages();
  if (!messages.length) return false;

  await saveFullIndexAt(lastIndexedAt);
  return true;
}

/**
 * Monotonic generation of the index. Incremented by "Clear" so a running
 * indexer cannot save a result into a cleared storage.
 * @returns {Promise<number>}
 */
async function loadIndexGeneration() {
  const value = await storageGet(LS_KEY_INDEX_GENERATION);
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * @returns {Promise<number>}
 */
async function bumpIndexGeneration() {
  const next = (await loadIndexGeneration()) + 1;
  await storageSet(LS_KEY_INDEX_GENERATION, String(next));
  return next;
}

/**
 * Automatic refresh is enabled by default once a full index exists.
 * @returns {Promise<boolean>}
 */
async function loadAutoEnabled() {
  const value = await storageGet(LS_KEY_AUTO_ENABLED);
  if (value === null || value === undefined || value === '') return true;
  return value === '1' || value === true;
}

/**
 * @param {boolean} enabled
 */
async function saveAutoEnabled(enabled) {
  await storageSet(LS_KEY_AUTO_ENABLED, enabled ? '1' : '0');
}

/**
 * @returns {Promise<{lastRun?: number, lastCheck?: number, lastError?: string, lastResult?: string}>}
 */
async function loadAutoMeta() {
  const raw = await storageGet(LS_KEY_AUTO_META);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {object} meta
 */
async function saveAutoMeta(meta) {
  await storageSet(LS_KEY_AUTO_META, JSON.stringify(meta || {}));
}

/**
 * Key used before messageId was extracted from the page.
 * @param {StickerMessage} msg
 * @returns {string}
 */
function buildLegacyMessageKey(msg) {
  const talkId = msg.talkId || '';
  const partner = msg.partner || '';
  const text = msg.text || '';
  const ts = msg.timestamp || '';
  return `legacy::${partner}::${text}::${ts}::${talkId}`;
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

  return buildLegacyMessageKey(msg);
}

/**
 * Merge incoming messages into existing ones. A legacy record is upgraded to
 * its id-keyed form instead of producing a duplicate after messageId extraction
 * starts working.
 * @param {StickerMessage[]} existing
 * @param {StickerMessage[]} incoming
 * @returns {StickerMessage[]}
 */
function mergeMessages(existing, incoming) {
  const map = new Map();

  existing.forEach((msg) => {
    map.set(buildMessageKey(msg), msg);
  });

  incoming.forEach((msg) => {
    const key = buildMessageKey(msg);
    const legacyKey = buildLegacyMessageKey(msg);

    if (key !== legacyKey && !map.has(key) && map.has(legacyKey)) {
      map.delete(legacyKey);
    }

    map.set(key, msg);
  });

  return Array.from(map.values());
}

/**
 * Compute statistics for dialogs and messages.
 * @param {StickerMessage[]} messages
 * @returns {{ dialogsCount: number, partnersCount: number, messagesCount: number }}
 */
function getStats(messages) {
  const dialogs = new Set();
  const partners = new Set();

  messages.forEach((msg) => {
    if (!msg) return;

    if (msg.talkId) {
      dialogs.add(`talk:${msg.talkId}`);
    } else if (msg.partner) {
      // Old records without talkId: fall back to the partner name.
      dialogs.add(`partner:${msg.partner}`);
    }

    if (msg.partner) {
      partners.add(msg.partner);
    }
  });

  return {
    dialogsCount: dialogs.size,
    partnersCount: partners.size,
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
  let safeUrl =
    typeof safe.url === 'string' &&
    (safe.url.startsWith('https://') || safe.url.startsWith('http://') || safe.url.startsWith('/'))
      ? safe.url
      : undefined;

  if (safeUrl) {
    if (safeUrl.startsWith('https://laststicker.ru/')) {
      safeUrl = safeUrl.replace('https://laststicker.ru/', 'https://www.laststicker.ru/');
    } else if (safeUrl.startsWith('http://laststicker.ru/')) {
      safeUrl = safeUrl.replace('http://laststicker.ru/', 'https://www.laststicker.ru/');
    } else if (safeUrl.startsWith('http://www.laststicker.ru/')) {
      safeUrl = safeUrl.replace('http://www.laststicker.ru/', 'https://www.laststicker.ru/');
    }
  }

  return {
    text: typeof safe.text === 'string' ? safe.text : '',
    partner: typeof safe.partner === 'string' ? safe.partner : '',
    timestamp:
      typeof safe.timestamp === 'number' && !Number.isNaN(safe.timestamp) ? safe.timestamp : null,
    url: safeUrl,
    talkId: typeof safe.talkId === 'string' ? safe.talkId : undefined,
    messageId:
      typeof safe.messageId === 'string' && /^\d+$/.test(safe.messageId)
        ? safe.messageId
        : undefined,
  };
}

// Export functions
if (typeof window !== 'undefined') {
  window.InlineStorage = {
    loadMessages,
    saveMessages,
    clearMessages,
    loadLastQuery,
    saveLastQuery,
    loadLastIndexedAt,
    loadReadNoticeSeen,
    saveReadNoticeSeen,
    loadFullIndexAt,
    saveFullIndexAt,
    loadIndexGeneration,
    bumpIndexGeneration,
    ensureFullIndexFlag,
    loadAutoEnabled,
    saveAutoEnabled,
    loadAutoMeta,
    saveAutoMeta,
    getIndexBytes,
    buildMessageKey,
    buildLegacyMessageKey,
    mergeMessages,
    getStats,
    normalizeMessage,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadMessages,
    saveMessages,
    clearMessages,
    loadLastQuery,
    saveLastQuery,
    loadLastIndexedAt,
    loadReadNoticeSeen,
    saveReadNoticeSeen,
    loadFullIndexAt,
    saveFullIndexAt,
    loadIndexGeneration,
    bumpIndexGeneration,
    ensureFullIndexFlag,
    loadAutoEnabled,
    saveAutoEnabled,
    loadAutoMeta,
    saveAutoMeta,
    getIndexBytes,
    buildMessageKey,
    buildLegacyMessageKey,
    mergeMessages,
    getStats,
    normalizeMessage,
  };
}
