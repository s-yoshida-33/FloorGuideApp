// src/hooks/useBridgeRegistration.ts
import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import html2canvas from 'html2canvas';
import { getApiBaseUrl } from '../config';
import { logInfo, logWarn } from '../logs/logging';
import { bridgeState } from '../api/bridgeState';

const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_RECONNECT_DELAY_MS = 5_000;

async function registerApp(
  baseUrl: string,
  version: string,
  mallId: string,
  hostname: string,
  startedAt: string,
  logDir: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/apps/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gido', version, mallId, hostname, startedAt, logDir, logPrefix: 'gido' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  } catch (e) {
    logWarn('BRIDGE_REG', 'Registration failed', { error: String(e) });
    return null;
  }
}

async function sendHeartbeat(baseUrl: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/apps/${id}/heartbeat`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

async function captureScreenshot(baseUrl: string, id: string): Promise<void> {
  const canvas = await html2canvas(document.documentElement, {
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale: 1,
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('canvas.toBlob returned null');

  const res = await fetch(`${baseUrl}/api/apps/${id}/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload HTTP ${res.status}`);
  logInfo('BRIDGE_WS', 'Screenshot uploaded to Bridge-Ground');
}

// openScreenshotWS opens a WebSocket to receive screenshot_request commands.
// Returns a cleanup function that closes the socket and stops reconnection.
function openScreenshotWS(
  baseUrl: string,
  id: string,
  isCancelled: () => boolean,
): () => void {
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (isCancelled()) return;

    ws = new WebSocket(`${wsUrl}/api/apps/ws?id=${id}`);

    ws.onopen = () => {
      logInfo('BRIDGE_WS', 'WebSocket connected');
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type?: string };
        if (msg.type !== 'screenshot_request') return;
        await captureScreenshot(baseUrl, id);
      } catch (e) {
        logWarn('BRIDGE_WS', 'Screenshot capture failed', { error: String(e) });
      }
    };

    ws.onclose = () => {
      ws = null;
      if (!isCancelled()) {
        reconnectTimer = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      logWarn('BRIDGE_WS', 'WebSocket error — will reconnect');
    };
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}

export const useBridgeRegistration = (mallId: string, hostname: string, enabled: boolean) => {
  const appIdRef  = useRef<string | null>(null);
  // Capture start time once; stays constant across re-registrations (e.g. Bridge-Ground restart)
  const startedAt = useRef(new Date().toISOString());

  useEffect(() => {
    if (!enabled || !mallId) return;

    let intervalId: ReturnType<typeof setInterval>;
    let cancelled = false;
    let closeWS: (() => void) | null = null;

    const connectWS = (baseUrl: string, id: string) => {
      closeWS?.();
      closeWS = openScreenshotWS(baseUrl, id, () => cancelled);
    };

    const start = async () => {
      const [baseUrl, version, logDir] = await Promise.all([
        getApiBaseUrl(),
        getVersion().catch(() => 'unknown'),
        invoke<string>('get_log_directory').catch(() => ''),
      ]);

      bridgeState.baseUrl = baseUrl;

      const id = await registerApp(baseUrl, version, mallId, hostname, startedAt.current, logDir);
      if (cancelled) return;

      if (id) {
        appIdRef.current = id;
        bridgeState.appId = id;
        logInfo('BRIDGE_REG', 'Registered with Bridge-Ground', { id, mallId, hostname });
        connectWS(baseUrl, id);
      }

      intervalId = setInterval(async () => {
        const currentId = appIdRef.current;
        if (currentId) {
          const ok = await sendHeartbeat(baseUrl, currentId);
          if (!ok) {
            const newId = await registerApp(baseUrl, version, mallId, hostname, startedAt.current, logDir);
            if (newId) {
              appIdRef.current = newId;
              bridgeState.appId = newId;
              logInfo('BRIDGE_REG', 'Re-registered with Bridge-Ground', { id: newId });
              connectWS(baseUrl, newId);
            }
          }
        } else {
          const newId = await registerApp(baseUrl, version, mallId, hostname, startedAt.current, logDir);
          if (newId) {
            appIdRef.current = newId;
            bridgeState.appId = newId;
            logInfo('BRIDGE_REG', 'Registered with Bridge-Ground (retry)', { id: newId });
            connectWS(baseUrl, newId);
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    start();

    return () => {
      cancelled = true;
      bridgeState.appId = null;
      if (intervalId) clearInterval(intervalId);
      closeWS?.();
    };
  }, [enabled, mallId, hostname]);
};
