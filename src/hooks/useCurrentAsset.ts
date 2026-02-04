// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { logWarn } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

export function useCurrentAsset(
  retryIntervalMs: number = 3000,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);

  // SSE connection removed. 
  // TODO: Implement native scheduler to update 'asset' state based on local schedule.

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(false);
    logWarn('video', 'Native player mode: Waiting for scheduler implementation');
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { asset, isLoading };
}
