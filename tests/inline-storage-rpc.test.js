let store;

function createRuntimeMock() {
  return {
    id: 'test-extension',
    lastError: undefined,
    sendMessage: (message, callback) => {
      const finish = (result) => callback && callback({ result });

      if (message.action === 'lsStorageGet') {
        const keys = Array.isArray(message.keys) ? message.keys : [message.keys];
        const result = {};
        keys.forEach((key) => {
          if (store[key] !== undefined) result[key] = store[key];
        });
        finish(result);
        return;
      }

      if (message.action === 'lsStorageSet') {
        Object.assign(store, message.items || {});
        finish(true);
        return;
      }

      if (message.action === 'lsStorageRemove') {
        const keys = Array.isArray(message.keys) ? message.keys : [message.keys];
        keys.forEach((key) => delete store[key]);
        finish(true);
        return;
      }

      if (message.action === 'lsStorageGetBytes') {
        finish(Buffer.byteLength(String(store[message.key] || ''), 'utf8'));
        return;
      }

      callback && callback({ error: `Unknown action: ${message.action}` });
    },
  };
}

describe('offscreen storage RPC', () => {
  beforeAll(() => {
    store = {};
    localStorage.clear();

    const chrome = { runtime: createRuntimeMock() };
    global.chrome = chrome;
    window.chrome = chrome;

    require('../inline-storage');
  });

  test('saves and reads messages through storage RPC', async () => {
    await window.InlineStorage.saveMessages(
      [{ talkId: '3', messageId: '4', text: 'rpc', partner: 'p', timestamp: 2 }],
      { indexedAt: 456 },
    );

    const loaded = await window.InlineStorage.loadMessages();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].text).toBe('rpc');
    expect(store.ls_search_last_indexed_at).toBe('456');
    expect(await window.InlineStorage.getIndexBytes()).toBeGreaterThan(0);
  });

  test('uses the default auto settings through storage RPC', async () => {
    expect(await window.InlineStorage.loadAutoEnabled()).toBe(true);
  });

  test('bumps the index generation when clearing', async () => {
    store.ls_search_messages = '[]';
    await window.InlineStorage.clearMessages();

    expect(store.ls_search_messages).toBeUndefined();
    expect(store.ls_search_index_generation).toBe('1');
  });
});
