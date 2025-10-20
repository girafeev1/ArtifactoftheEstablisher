export function setupClientLogging() {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { __clientLogSetup?: boolean };
  if (win.__clientLogSetup) return;
  win.__clientLogSetup = true;
  (['log', 'warn', 'error'] as const).forEach(level => {
    const original = console[level].bind(console);
    console[level] = (...args: any[]) => {
      try {
        fetch('/api/client-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            args,
            timestamp: new Date().toISOString(),
            pathname: window.location.pathname,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {
          /* ignore network errors */
        });
      } catch (_) {
        /* ignore logging errors */
      }
      original(...args);
    };
  });

  // In development, wrap fetch to log requests/responses
  try {
    const g: any = window;
    if (!g.__wrappedFetch && process.env.NODE_ENV !== 'production') {
      g.__wrappedFetch = true;
      const originalFetch = g.fetch?.bind(g) as typeof fetch;
      if (typeof originalFetch === 'function') {
        g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          const method = (init?.method || (typeof input !== 'string' && (input as Request).method) || 'GET').toUpperCase();
          let bodySummary = '';
          try {
            const raw = init?.body as any;
            if (raw) {
              if (typeof raw === 'string') {
                const parsed = JSON.parse(raw);
                bodySummary = ` keys=${Object.keys(parsed).join(',')}`;
              } else if (raw instanceof FormData) {
                bodySummary = ` formdata_keys=${Array.from(raw.keys()).join(',')}`;
              } else {
                bodySummary = ` body=${String(raw).slice(0, 128)}`;
              }
            }
          } catch {}
          console.log('[HTTP] →', method, url, bodySummary);
          const start = Date.now();
          const res = await originalFetch(input as any, init);
          const ms = Date.now() - start;
          console.log('[HTTP] ←', res.status, method, url, `${ms}ms`);
          return res;
        };
      }
    }
  } catch {
    // ignore
  }
}
