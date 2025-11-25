// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { fetchCurrentAsset } from '../repositories/wspRepository';
import { POLLING_INTERVALS } from '../config/appConfig';
import { logInfo, logWarn, logError } from '../logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

/**
 * Polls wsp.exe API via Electron IPC and returns the current asset.
 * Default interval is configured in WSP_CONFIG.
 */
export function useCurrentAsset(
  pollIntervalMs: number = POLLING_INTERVALS.VIDEO_MS,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep track of last status to avoid spamming logs / Slack alerts
  const lastStatusRef = useRef<AssetStatus>(null);

  useEffect(() => {
    let isMounted = true;
    let timerId: number | undefined;

    const tick = async () => {
      try {
        const next = await fetchCurrentAsset();
        if (!isMounted) return;

        if (next) {
          // Status: ok (asset available)
          if (lastStatusRef.current !== 'ok') {
            logInfo('video', 'Fetched current video asset', {
              assetId: next.id,
              src: next.src,
              duration: next.duration,
              name: next.name,
            });
          }
          lastStatusRef.current = 'ok';
        } else {
          // Status: noAsset (API OK but no current asset)
          if (lastStatusRef.current !== 'noAsset') {
            logWarn('video', 'No current video asset returned by WSP');
          }
          lastStatusRef.current = 'noAsset';
        }

        setAsset(next);
        setIsLoading(false);
      } catch (error: any) {
        if (!isMounted) return;

        // Status: error (API communication error)
        if (lastStatusRef.current !== 'error') {
          logError('video', 'Failed to fetch current video asset', {
            error: error?.message,
          });
        }
        lastStatusRef.current = 'error';

        setIsLoading(false);
      } finally {
        if (!isMounted) return;
        timerId = window.setTimeout(tick, pollIntervalMs);
      }
    };

    tick();

    return () => {
      isMounted = false;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [pollIntervalMs]);

  return { asset, isLoading };
}
