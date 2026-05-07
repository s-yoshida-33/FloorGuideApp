// src/hooks/useBridgeRegistration.ts
import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { getApiBaseUrl } from '../config';
import { logInfo, logWarn } from '../logs/logging';
import { bridgeState } from '../api/bridgeState';
import { sseClient } from '../api/sseClient';

const HEARTBEAT_INTERVAL_MS = 30_000;

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

async function captureAndSendScreenshot(baseUrl: string, id: string): Promise<void> {
  try {
    // Capture and POST are handled entirely by capture_and_send.ps1 running
    // as an independent process, avoiding WebView2 DirectComposition issues.
    await invoke('run_capture_script', { bridgeUrl: baseUrl, appId: id });
    logInfo('BRIDGE_REG', 'Screenshot sent to Bridge-Ground');
  } catch (e) {
    logWarn('BRIDGE_REG', 'Screenshot capture failed', { error: String(e) });
  }
}

export const useBridgeRegistration = (mallId: string, hostname: string, enabled: boolean) => {
  const appIdRef   = useRef<string | null>(null);
  // Capture start time once; stays constant across re-registrations (e.g. Bridge-Ground restart)
  const startedAt  = useRef(new Date().toISOString());

  useEffect(() => {
    if (!enabled || !mallId) return;

    let intervalId: ReturnType<typeof setInterval>;
    let cancelled = false;

    const handleScreenshotRequest = (data: unknown) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : (data as { appId?: string });
        if (parsed.appId !== appIdRef.current) return;
        if (bridgeState.baseUrl && appIdRef.current) {
          captureAndSendScreenshot(bridgeState.baseUrl, appIdRef.current);
        }
      } catch { /* ignore parse errors */ }
    };

    const unsubscribeScreenshot = sseClient.on('screenshot_request', handleScreenshotRequest);

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
            }
          }
        } else {
          const newId = await registerApp(baseUrl, version, mallId, hostname, startedAt.current, logDir);
          if (newId) {
            appIdRef.current = newId;
            bridgeState.appId = newId;
            logInfo('BRIDGE_REG', 'Registered with Bridge-Ground (retry)', { id: newId });
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    start();

    return () => {
      cancelled = true;
      bridgeState.appId = null;
      if (intervalId) clearInterval(intervalId);
      unsubscribeScreenshot();
    };
  }, [enabled, mallId, hostname]);
};
