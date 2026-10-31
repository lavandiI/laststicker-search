describe('inline-storage migration', () => {
  let store;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    store = {};

    const local = {
      get: async (keys) => {
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((key) => {
            if (store[key] !== undefined) result[key] = store[key];
          });
          return result;
        }
        return store[keys] !== undefined ? { [keys]: store[keys] } : {};
      },
      set: async (values) => {
        Object.assign(store, values);
      },
      remove: async (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => {
          delete store[key];
        });
      },
    };

    global.chrome = { storage: { local } };
    window.chrome = global.chrome;
    require('../inline-storage');
  });

  afterEach(() => {
    delete global.chrome;
    delete window.chrome;
    localStorage.clear();
  });

  test('moves legacy localStorage messages into chrome.storage.local', async () => {
    const legacy = [{ talkId: '1', messageId: '10', text: 'hello', partner: 'p', timestamp: 1 }];
    localStorage.setItem('ls_search_messages', JSON.stringify(legacy));
    localStorage.setItem('ls_search_last_indexed_at', '123');

    const messages = await window.InlineStorage.loadMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('hello');
    expect(JSON.parse(store.ls_search_messages)).toHaveLength(1);
    expect(store.ls_search_last_indexed_at).toBe('123');
    expect(store.ls_search_storage_migrated).toBe(true);
    expect(localStorage.getItem('ls_search_messages')).toBeNull();
    expect(localStorage.getItem('ls_search_last_indexed_at')).toBeNull();
  });

  test('saves and loads messages through chrome.storage.local', async () => {
    const messages = [{ talkId: '1', messageId: '10', text: 'hello', partner: 'p', timestamp: 1 }];

    const saved = await window.InlineStorage.saveMessages(messages, { indexedAt: 456 });
    const loaded = await window.InlineStorage.loadMessages();

    expect(saved).toBe(true);
    expect(loaded).toHaveLength(1);
    expect(store.ls_search_last_indexed_at).toBe('456');
  });

  test('clears messages from chrome.storage.local', async () => {
    store.ls_search_messages = '[]';
    store.ls_search_last_indexed_at = '1';

    await window.InlineStorage.clearMessages();

    expect(store.ls_search_messages).toBeUndefined();
    expect(store.ls_search_last_indexed_at).toBeUndefined();
  });
});
