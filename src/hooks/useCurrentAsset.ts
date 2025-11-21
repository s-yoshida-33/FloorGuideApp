// src/hooks/useCurrentAsset.ts
import { useEffect, useState } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { fetchCurrentAsset } from '../repositories/wspRepository';
import { WSP_CONFIG } from '../config/wspConfig';

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

        setAsset(next);
        setIsLoading(false);
      } catch (error) {
        if (!isMounted) return;
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
