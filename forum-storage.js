// IndexedDB storage for the forum index.
// Shared by the offscreen indexer and the background search RPC.

(function (global) {
  'use strict';

  const DB_NAME = 'laststicker-search-forum';
  const DB_VERSION = 1;
  const STORE_COMMENTS = 'comments';
  const STORE_TOPICS = 'topics';
  const STORE_META = 'meta';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB недоступен'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_COMMENTS)) {
          const comments = db.createObjectStore(STORE_COMMENTS, {
            keyPath: 'key',
          });
          comments.createIndex('postId', 'postId', { unique: false });
          comments.createIndex('timestamp', 'timestamp', { unique: false });
          comments.createIndex('postIdTimestamp', ['postId', 'timestamp'], {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORE_TOPICS)) {
          const topics = db.createObjectStore(STORE_TOPICS, {
            keyPath: 'postId',
          });
          topics.createIndex('updatedAt', 'updatedAt', { unique: false });
          topics.createIndex('categoryPath', 'categoryPath', {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Не удалось открыть IndexedDB'));
      };

      request.onblocked = () => {
        dbPromise = null;
        reject(new Error('IndexedDB заблокирован другой вкладкой'));
      };
    });

    return dbPromise;
  }

  function normalizeComment(comment) {
    return {
      ...comment,
      key: String(comment.key || ''),
      postId: String(comment.postId || ''),
      commentId: comment.commentId ? String(comment.commentId) : '',
      text: String(comment.text || ''),
      author: String(comment.author || ''),
      topicTitle: String(comment.topicTitle || ''),
      timestamp: Number(comment.timestamp) || 0,
      page: Math.max(1, Number(comment.page) || 1),
      pageParam: Math.max(0, Number(comment.pageParam) || 0),
    };
  }

  function normalizeTopic(topic) {
    return {
      ...topic,
      postId: String(topic.postId || ''),
      title: String(topic.title || ''),
      indexedComments: Math.max(0, Number(topic.indexedComments) || 0),
      lastPageParam: Math.max(0, Number(topic.lastPageParam) || 0),
      lastCompletePageParam: Math.max(0, Number(topic.lastCompletePageParam) || 0),
      indexedAt: Number(topic.indexedAt) || Date.now(),
      updatedAt: Number(topic.updatedAt) || Date.now(),
    };
  }

  function transactionDone(tx, resolve, reject, result) {
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Ошибка IndexedDB'));
    tx.onabort = () => reject(tx.error || new Error('Транзакция отменена'));
  }

  function readMeta(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const request = tx.objectStore(STORE_META).get(key);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function getMeta(key, fallback = null) {
    const db = await openDb();
    const value = await readMeta(db, key);
    return value === undefined ? fallback : value;
  }

  async function setMeta(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
      transactionDone(tx, resolve, reject, true);
    });
  }

  async function getGeneration() {
    const value = await getMeta('generation', 0);
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? 0 : num;
  }

  function generationError() {
    return new Error('Индекс форума очищен во время индексации');
  }

  /**
   * Write comments and verify that the index was not cleared meanwhile.
   *
   * @param {object[]} comments
   * @param {number} [expectedGeneration]
   * @returns {Promise<boolean>}
   */
  async function putComments(comments, expectedGeneration) {
    const db = await openDb();
    const items = (comments || []).map(normalizeComment).filter((c) => c.key);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_COMMENTS, STORE_META], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const generationRequest = metaStore.get('generation');
      let storedGeneration = 0;

      generationRequest.onsuccess = () => {
        storedGeneration = generationRequest.result
          ? parseInt(generationRequest.result.value, 10) || 0
          : 0;

        if (expectedGeneration != null && storedGeneration !== Number(expectedGeneration)) {
          try {
            tx.abort();
          } catch {
            // The transaction is already aborted.
          }
          reject(generationError());
          return;
        }

        const store = tx.objectStore(STORE_COMMENTS);
        items.forEach((item) => store.put(item));
      };

      generationRequest.onerror = () => {
        try {
          tx.abort();
        } catch {
          // The transaction is already aborted.
        }
        reject(generationRequest.error || new Error('Ошибка IndexedDB'));
      };

      transactionDone(tx, () => resolve(true), reject, true);
    });
  }

  async function putTopic(topic, expectedGeneration) {
    if (!topic || !topic.postId) return false;
    const db = await openDb();
    const item = normalizeTopic(topic);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TOPICS, STORE_META], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const generationRequest = metaStore.get('generation');

      generationRequest.onsuccess = () => {
        const storedGeneration = generationRequest.result
          ? parseInt(generationRequest.result.value, 10) || 0
          : 0;

        if (expectedGeneration != null && storedGeneration !== Number(expectedGeneration)) {
          try {
            tx.abort();
          } catch {
            // The transaction is already aborted.
          }
          reject(generationError());
          return;
        }

        tx.objectStore(STORE_TOPICS).put(item);
      };

      generationRequest.onerror = () => {
        try {
          tx.abort();
        } catch {
          // The transaction is already aborted.
        }
        reject(generationRequest.error || new Error('Ошибка IndexedDB'));
      };

      transactionDone(tx, () => resolve(true), reject, true);
    });
  }

  async function getTopic(postId) {
    if (!postId) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TOPICS, 'readonly');
      const request = tx.objectStore(STORE_TOPICS).get(String(postId));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllTopics() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TOPICS, 'readonly');
      const request = tx.objectStore(STORE_TOPICS).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function countComments() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMMENTS, 'readonly');
      const request = tx.objectStore(STORE_COMMENTS).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  }

  async function countTopics() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TOPICS, 'readonly');
      const request = tx.objectStore(STORE_TOPICS).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  }

  async function countCommentsByPost(postId) {
    if (!postId) return 0;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMMENTS, 'readonly');
      const index = tx.objectStore(STORE_COMMENTS).index('postId');
      const request = index.count(IDBKeyRange.only(String(postId)));
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteTopic(postId) {
    if (!postId) return false;
    const db = await openDb();
    const id = String(postId);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_COMMENTS, STORE_TOPICS], 'readwrite');
      tx.objectStore(STORE_TOPICS).delete(id);

      const comments = tx.objectStore(STORE_COMMENTS);
      const index = comments.index('postId');
      const request = index.openCursor(IDBKeyRange.only(id));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };

      transactionDone(tx, () => resolve(true), reject, true);
    });
  }

  async function bumpGeneration() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const generationRequest = metaStore.get('generation');

      generationRequest.onsuccess = () => {
        const current = generationRequest.result
          ? parseInt(generationRequest.result.value, 10) || 0
          : 0;
        metaStore.put({ key: 'generation', value: current + 1 });
      };
      generationRequest.onerror = () => {
        try {
          tx.abort();
        } catch {
          // The transaction is already aborted.
        }
        reject(generationRequest.error || new Error('Ошибка IndexedDB'));
      };

      transactionDone(tx, () => resolve(true), reject, true);
    });
  }

  async function clearAll() {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_COMMENTS, STORE_TOPICS, STORE_META], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      tx.objectStore(STORE_COMMENTS).clear();
      tx.objectStore(STORE_TOPICS).clear();

      const generationRequest = metaStore.get('generation');
      generationRequest.onsuccess = () => {
        const current = generationRequest.result
          ? parseInt(generationRequest.result.value, 10) || 0
          : 0;
        metaStore.put({ key: 'generation', value: current + 1 });
        metaStore.put({ key: 'lastIndexedAt', value: 0 });
      };

      transactionDone(tx, () => resolve(true), reject, true);
    });
  }

  function matchesQuery(comment, queryLower) {
    if (!queryLower) return false;
    const haystack = [comment.text || '', comment.author || '', comment.topicTitle || '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(queryLower);
  }

  /**
   * Search comments by substring. Results are returned newest first.
   *
   * @param {string} query
   * @param {{postId?: string, limit?: number, offset?: number}} [options]
   * @returns {Promise<{results: object[], total: number, hasMore: boolean}>}
   */
  async function searchComments(query, options = {}) {
    const queryLower = String(query || '')
      .trim()
      .toLowerCase();
    if (!queryLower) return { results: [], total: 0, hasMore: false };

    const limit = Math.max(1, Number(options.limit) || 200);
    const offset = Math.max(0, Number(options.offset) || 0);
    const postId = options.postId ? String(options.postId) : '';
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMMENTS, 'readonly');
      const store = tx.objectStore(STORE_COMMENTS);
      const matches = [];
      let total = 0;

      const finish = () => {
        matches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const results = matches.slice(offset, offset + limit);
        resolve({
          results,
          total,
          hasMore: total > offset + results.length,
        });
      };

      const consumeCursor = (cursor) => {
        if (!cursor) {
          finish();
          return;
        }

        const comment = cursor.value;
        if ((!postId || comment.postId === postId) && matchesQuery(comment, queryLower)) {
          total += 1;
          if (matches.length < offset + limit) {
            matches.push(comment);
          }
        }

        cursor.continue();
      };

      let request;
      if (
        postId &&
        typeof IDBKeyRange !== 'undefined' &&
        store.indexNames.contains('postIdTimestamp')
      ) {
        const index = store.index('postIdTimestamp');
        const range = IDBKeyRange.bound([postId, 0], [postId, Number.MAX_SAFE_INTEGER]);
        request = index.openCursor(range, 'prev');
      } else if (!postId && typeof IDBKeyRange !== 'undefined') {
        request = store.index('timestamp').openCursor(null, 'prev');
      } else {
        request = store.openCursor();
      }

      request.onsuccess = () => consumeCursor(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error || new Error('Ошибка IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Транзакция отменена'));
    });
  }

  async function getStats(postId) {
    await openDb();
    const [messagesCount, topicsCount, generation] = await Promise.all([
      countComments(),
      countTopics(),
      getGeneration(),
    ]);

    let topic = null;
    if (postId) {
      topic = await getTopic(postId);
      if (topic) {
        topic = {
          ...topic,
          indexedComments: await countCommentsByPost(postId),
        };
      }
    }

    let sizeBytes = null;
    let quotaBytes = null;
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.estimate === 'function'
      ) {
        const estimate = await navigator.storage.estimate();
        sizeBytes = Number(estimate.usage) || 0;
        quotaBytes = Number(estimate.quota) || null;
      }
    } catch {
      // Storage estimates are best-effort.
    }

    return {
      messagesCount,
      topicsCount,
      generation,
      topic,
      sizeBytes,
      quotaBytes,
      lastIndexedAt: Number(await getMeta('lastIndexedAt', 0)) || null,
    };
  }

  function closeDb() {
    if (!dbPromise) return Promise.resolve();
    return dbPromise.then((db) => {
      db.close();
      dbPromise = null;
    });
  }

  async function deleteDatabase() {
    await closeDb();
    if (typeof indexedDB === 'undefined') return;
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  }

  const api = {
    DB_NAME,
    DB_VERSION,
    STORE_COMMENTS,
    STORE_TOPICS,
    STORE_META,
    openDb,
    getMeta,
    setMeta,
    getGeneration,
    bumpGeneration,
    putComments,
    putTopic,
    getTopic,
    getAllTopics,
    countComments,
    countTopics,
    countCommentsByPost,
    deleteTopic,
    clearAll,
    searchComments,
    getStats,
    closeDb,
    deleteDatabase,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.LSForumStorage = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
