const { fetchWithRetry, parseRetryAfter } = require('../fetch-retry');

function response(status, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name) => headers[name] ?? null,
    },
  };
}

describe('fetchWithRetry', () => {
  test('retries a 429 response and returns the next successful response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(429, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry('https://example.test', {}, {
      fetchImpl,
      retries: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
    });

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('returns the last 503 response after the retry limit', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(503));

    const result = await fetchWithRetry('https://example.test', {}, {
      fetchImpl,
      retries: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
    });

    expect(result.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('retries a network error and then succeeds', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry('https://example.test', {}, {
      fetchImpl,
      retries: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
    });

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not call fetch when indexing was cancelled', async () => {
    const fetchImpl = jest.fn();

    await expect(
      fetchWithRetry('https://example.test', {}, {
        fetchImpl,
        shouldCancel: () => true,
      }),
    ).rejects.toThrow('отменена');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('stops before sleeping when indexing is cancelled after a retryable response', async () => {
    let cancelled = false;
    const fetchImpl = jest.fn(async () => {
      cancelled = true;
      return response(429, { 'Retry-After': '30' });
    });

    await expect(
      fetchWithRetry('https://example.test', {}, {
        fetchImpl,
        retries: 2,
        shouldCancel: () => cancelled,
      }),
    ).rejects.toThrow('отменена');
  });

  test('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('')).toBeNull();

    const date = new Date(Date.now() + 5000).toUTCString();
    const delay = parseRetryAfter(date);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(5000);
  });
});
