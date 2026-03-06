import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const PING_INTERVAL_MS = 10_000;

/**
 * Periodically pings the Rust backend so the system-level watchdog knows
 * the WebView is still alive. If this ping stops (e.g. WebView2 crash,
 * white-screen), the Rust watchdog will restart the application.
 */
export function useWebViewPing() {
  useEffect(() => {
    const id = setInterval(() => {
      invoke('webview_ping').catch(() => {
        // Rust side unreachable — nothing we can do from JS
      });
    }, PING_INTERVAL_MS);

    // Send an initial ping immediately
    invoke('webview_ping').catch(() => {});

    return () => clearInterval(id);
  }, []);
}
