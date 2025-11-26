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
      const startTime = Date.now();
      try {
        const next = await fetchCurrentAsset();
        const fetchDuration = Date.now() - startTime;
        if (!isMounted) return;

        if (next) {
          // Check if asset has changed
          const assetChanged = asset?.id !== next.id;
          
          // Status: ok (asset available)
          if (lastStatusRef.current !== 'ok') {
            logInfo('video', 'Fetched current video asset', {
              assetId: next.id,
              src: next.src,
              duration: next.duration,
              name: next.name,
              fetchDurationMs: fetchDuration,
            });
          } else if (assetChanged) {
            // Asset changed - log the change
            logInfo('video', 'Asset changed', {
              oldAssetId: asset?.id,
              newAssetId: next.id,
              oldSrc: asset?.src,
              newSrc: next.src,
              fetchDurationMs: fetchDuration,
            });
          }
          lastStatusRef.current = 'ok';
        } else {
          // Status: noAsset (API OK but no current asset)
          if (lastStatusRef.current !== 'noAsset') {
            logWarn('video', 'No current video asset returned by WSP', {
              fetchDurationMs: Date.now() - startTime,
            });
          }
          lastStatusRef.current = 'noAsset';
        }

        setAsset(next);
        setIsLoading(false);
      } catch (error: any) {
        const fetchDuration = Date.now() - startTime;
        if (!isMounted) return;

        // Status: error (API communication error)
        if (lastStatusRef.current !== 'error') {
          logError('video', 'Failed to fetch current video asset', {
            error: error?.message,
            fetchDurationMs: fetchDuration,
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
  }, [pollIntervalMs, asset?.id]);

  return { asset, isLoading };
}
