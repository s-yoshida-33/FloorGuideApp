// src/hooks/useBridgeRegistration.ts
import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { getApiBaseUrl } from '../config';
import { logInfo, logWarn } from '../logs/logging';

const HEARTBEAT_INTERVAL_MS = 30_000;

async function registerApp(
  baseUrl: string,
  version: string,
  mallId: string,
  hostname: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/apps/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gido', version, mallId, hostname }),
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

export const useBridgeRegistration = (mallId: string, hostname: string) => {
  const appIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mallId) return;

    let intervalId: ReturnType<typeof setInterval>;
    let cancelled = false;

    const start = async () => {
      const [baseUrl, version] = await Promise.all([
        getApiBaseUrl(),
        getVersion().catch(() => 'unknown'),
      ]);

      const id = await registerApp(baseUrl, version, mallId, hostname);
      if (cancelled) return;

      if (id) {
        appIdRef.current = id;
        logInfo('BRIDGE_REG', 'Registered with Bridge-Ground', { id, mallId, hostname });
      }

      intervalId = setInterval(async () => {
        if (appIdRef.current) {
          const ok = await sendHeartbeat(baseUrl, appIdRef.current);
          if (!ok) {
            // Bridge-Ground may have restarted — re-register
            const newId = await registerApp(baseUrl, version, mallId, hostname);
            if (newId) {
              appIdRef.current = newId;
              logInfo('BRIDGE_REG', 'Re-registered with Bridge-Ground', { id: newId });
            }
          }
        } else {
          // Previous registration failed — retry
          const newId = await registerApp(baseUrl, version, mallId, hostname);
          if (newId) {
            appIdRef.current = newId;
            logInfo('BRIDGE_REG', 'Registered with Bridge-Ground (retry)', { id: newId });
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [mallId, hostname]);
};
