export function setupClientLogging() {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { __clientLogSetup?: boolean; __logGuard?: boolean };
  if (win.__clientLogSetup) return;
  win.__clientLogSetup = true;
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  } as const;
  (['log', 'warn', 'error'] as const).forEach(level => {
    console[level] = (...args: any[]) => {
      // Avoid recursive logging and skip internal HTTP markers
      if (win.__logGuard || (typeof args?.[0] === 'string' && String(args[0]).startsWith('[HTTP]'))) {
        return original[level](...args);
      }
      try {
        win.__logGuard = true;
        void fetch('/api/client-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            args,
            timestamp: new Date().toISOString(),
            pathname: window.location.pathname,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {/* ignore */});
      } catch {/* ignore */}
      finally { win.__logGuard = false; }
      return original[level](...args);
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
          if (url.includes('/api/client-log')) {
            return originalFetch(input as any, init);
          }
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
          original.info('[HTTP] →', method, url, bodySummary);
          const start = Date.now();
          const res = await originalFetch(input as any, init);
          const ms = Date.now() - start;
          original.info('[HTTP] ←', res.status, method, url, `${ms}ms`);
          return res;
        };
      }
    }
  } catch {
    // ignore
  }
}
