/* Shared connection feedback and bounded requests. Provider outages stay isolated. */
(function (root) {
  'use strict';
  function classify(error, status = Number(error?.status) || 0) {
    if (status === 401) return 'auth';
    if (status === 403) return 'permission';
    if (status === 429) return 'rate-limit';
    if (status >= 500) return 'server';
    if (status >= 400) return 'validation';
    if (error?.kind) return error.kind;
    if (error?.name === 'TimeoutError') return 'timeout';
    if (error?.name === 'AbortError') return 'cancelled';
    if (error instanceof TypeError) return 'network';
    return 'programming';
  }
  let state = root.navigator?.onLine === false ? 'offline' : 'online',
    banner,
    reconnectTimer,
    hideTimer;
  const failures = new Map();
  function update(next) {
    state = next;
    root.dispatchEvent?.(new CustomEvent('hv-connection', { detail: { state } }));
    render();
  }
  function render() {
    if (!banner) return;
    banner.hidden = state === 'online';
    banner.textContent =
      state === 'offline'
        ? "You're offline - saved Herald data is still available."
        : state === 'reconnecting'
          ? 'Back online - checking your connection…'
          : 'Connection restored.';
  }
  async function request(input, options = {}, policy = {}) {
    const url = new URL(
        typeof input === 'string' ? input : input.url,
        root.location?.href || 'http://localhost/',
      ),
      external = url.origin !== root.location?.origin,
      service = url.host;
    const signal = options.signal || (typeof input === 'object' ? input.signal : null),
      controller = new AbortController();
    let timedOut = false;
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (root.navigator?.onLine === false && external) {
      const e = new Error(
        'This action needs an internet connection. Your saved information is still available.',
      );
      e.kind = 'offline';
      throw e;
    }
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, policy.timeout || 25000);
    try {
      // Include body consumption in the deadline, not just response headers.
      const response = await root.fetch(input, { ...options, signal: controller.signal });
      if ([204, 205].includes(response.status)) return response;
      const bytes = await response.arrayBuffer(),
        buffered = new Response(bytes, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      if (response.ok) {
        failures.delete(service);
        if (state === 'reconnecting') {
          update('restored');
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => update('online'), 3500);
        }
        return buffered;
      }
      failures.set(service, { kind: classify(null, response.status), at: Date.now() });
      return buffered;
    } catch (error) {
      if (timedOut) {
        error = new Error(
          'The service took too long to respond. Your saved information is unchanged.',
        );
        error.name = 'TimeoutError';
      }
      const kind = classify(error);
      if (kind !== 'cancelled' && kind !== 'programming')
        failures.set(service, { kind, at: Date.now() });
      if (root.navigator?.onLine === false) update('offline');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  const api = {
    request,
    classify,
    get state() {
      return state;
    },
    failures,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.HVNetwork = api;
  root.addEventListener('offline', () => {
    clearTimeout(reconnectTimer);
    clearTimeout(hideTimer);
    update('offline');
  });
  root.addEventListener('online', () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (root.navigator.onLine) {
        update('reconnecting');
        root.dispatchEvent(new Event('hv-reconnect'));
      }
    }, 1000);
  });
  document.addEventListener('DOMContentLoaded', () => {
    banner = document.createElement('div');
    banner.className = 'herald-connection';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.prepend(banner);
    render();
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .register(new URL('sw.js', document.querySelector('script[src*="network.js"]').src), {
          updateViaCache: 'none',
        })
        .catch(() => {});
  });
})(typeof window !== 'undefined' ? window : globalThis);
