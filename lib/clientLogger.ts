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
          /* empty */
        });
      } catch (_) {
        /* empty */
      }
      original(...args);
    };
  });
}
