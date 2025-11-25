// src/hooks/useCurrentAsset.ts
import { useEffect, useState } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { fetchCurrentAsset } from '../repositories/wspRepository';
import { WSP_CONFIG } from '../config/wspConfig';
import { logInfo, logWarn, logError } from '../logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

/**
 * Polls wsp.exe API via Electron IPC and returns the current asset.
 * Default interval is configured in WSP_CONFIG.
 */
export function useCurrentAsset(
  pollIntervalMs: number = WSP_CONFIG.pollIntervalMs,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    let timerId: number | undefined;

    const tick = async () => {
      try {
        const next = await fetchCurrentAsset();
        if (!isMounted) return;

        if (next) {
          // API success & asset received
          logInfo('video', 'Fetched current video asset', {
            assetId: next.id,
            src: next.src,
            duration: next.duration,
            name: next.name,
          });
        } else {
          // API success but no asset returned
          logWarn('video', 'No current video asset returned by WSP');
        }

        setAsset(next);
        setIsLoading(false);
      } catch (error: any) {
        if (!isMounted) return;

        // API communication error
        logError('video', 'Failed to fetch current video asset', {
          error: error?.message,
        });

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
