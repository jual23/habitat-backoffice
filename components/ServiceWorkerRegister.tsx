'use client';

import { useEffect } from 'react';

/** Registers public/sw.js once on mount. Renders nothing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installability/speed only — a failed registration shouldn't be
        // user-visible or block the app.
      });
    }
  }, []);

  return null;
}
