// Retry wrapper for network requests with timeout and backoff.
// Loaded by the service worker through importScripts and by Jest directly.

(function (global) {
  'use strict';

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parseRetryAfter(value) {
    if (!value) return null;

    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }

    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }

    return null;
  }

  function backoffDelay(attempt, baseDelayMs, maxDelayMs) {
    const base = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
    return base + Math.floor(Math.random() * 250);
  }

  /**
   * Fetch with a per-attempt timeout, retries on 429/503 and network errors.
   * @param {string} url
   * @param {RequestInit} [options]
   * @param {{
   *   timeoutMs?: number,
   *   retries?: number,
   *   baseDelayMs?: number,
   *   maxDelayMs?: number,
   *   fetchImpl?: typeof fetch,
   *   shouldCancel?: () => boolean,
   *   onRetry?: (info: { attempt: number, status?: number, error?: Error, delay: number }) => void,
   * }} [config]
   */
  async function fetchWithRetry(url, options = {}, config = {}) {
    const {
      timeoutMs = 30000,
      retries = 2,
      baseDelayMs = 500,
      maxDelayMs = 5000,
      fetchImpl = global.fetch,
      shouldCancel = () => false,
      onRetry = null,
    } = config;

    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch is not available');
    }

    for (let attempt = 0; ; attempt++) {
      if (shouldCancel()) {
        throw new Error('Индексация отменена');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;

      try {
        response = await fetchImpl(url, { ...options, signal: controller.signal });
      } catch (error) {
        clearTimeout(timer);

        if (error.name === 'AbortError' && options.signal && options.signal.aborted) {
          throw error;
        }
        if (attempt >= retries) {
          throw error;
        }

        const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
        if (onRetry) {
          onRetry({ attempt: attempt + 1, error, delay });
        }
        if (shouldCancel()) {
          throw new Error('Индексация отменена', { cause: error });
        }
        await sleep(delay);
        continue;
      }

      clearTimeout(timer);

      const retryable = response.status === 429 || response.status === 503;
      if (!retryable || attempt >= retries) {
        return response;
      }

      const retryAfter = parseRetryAfter(
        response.headers && typeof response.headers.get === 'function'
          ? response.headers.get('Retry-After')
          : null,
      );
      const delay = retryAfter ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);

      if (onRetry) {
        onRetry({ attempt: attempt + 1, status: response.status, delay });
      }
      if (shouldCancel()) {
        throw new Error('Индексация отменена');
      }
      await sleep(delay);
    }
  }

  const api = { fetchWithRetry, parseRetryAfter, backoffDelay };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    global.LSFetch = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
