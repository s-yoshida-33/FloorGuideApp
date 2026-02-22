// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CurrentAsset, TimelineStreamEvent } from '../types/wsp';
import { TIMELINE_STREAM_URL } from '../config';
import { logWarn, logError, logDebug } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

/**
 * Convert a TimelineStreamEvent into a CurrentAsset.
 * Uses convertFileSrc for local paths (Tauri asset protocol).
 */
function mapStreamEventToAsset(event: TimelineStreamEvent): CurrentAsset | null {
  if (!event.current_media_id) return null;

  const localPath = event.current_media_local_path || '';
  let src = '';
  if (localPath) {
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      src = localPath;
    } else {
      // Use Tauri asset protocol instead of file://
      const normalized = localPath.replace(/\\/g, '/');
      src = convertFileSrc(normalized);
    }
  }

  return {
    id: event.current_media_id,
    src,
    duration: 0,
    width: 0,
    height: 0,
    name: event.current_media_name || '',
    startTime: '',
    endTime: '',
    mediaType: event.current_media_type || '',
    type: event.current_media_type || '',
  };
}

export function useCurrentAsset(
  retryIntervalMs: number = 3000,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const isMountedRef = useRef<boolean>(true);
  const lastStatusRef = useRef<AssetStatus>(null);
  const lastAssetIdRef = useRef<string | undefined>(undefined);

  const handleAssetUpdate = useCallback((next: CurrentAsset | null) => {
    if (!isMountedRef.current) return;

    if (next) {
      const assetChanged = lastAssetIdRef.current !== next.id;
      if (lastStatusRef.current !== 'ok') {
        logDebug('CMS_DELIVERY', 'Received current video asset via SSE', {
          assetId: next.id,
          src: next.src,
          name: next.name,
        });
      } else if (assetChanged) {
        logDebug('CMS_DELIVERY', 'Asset changed via SSE', {
          oldAssetId: lastAssetIdRef.current,
          newAssetId: next.id,
        });
      }
      lastStatusRef.current = 'ok';
    } else {
      lastStatusRef.current = 'noAsset';
    }

    lastAssetIdRef.current = next?.id;
    setAsset(next);
    setIsLoading(false);
  }, []);

  const connectSSE = useCallback(() => {
    const url = TIMELINE_STREAM_URL;
    logDebug('CMS_DELIVERY', 'Connecting to timeline SSE', { url });

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        logDebug('CMS_DELIVERY', 'Timeline SSE connection established');
      };

      es.onerror = () => {
        if (es.readyState === 2) {
          logWarn('CMS_DELIVERY', 'Timeline SSE connection closed');
        }
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
          retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        }
      };

      // Event: item_changed - real-time schedule update from CMS player
      es.addEventListener('item_changed', (e: MessageEvent) => {
        try {
          const data: TimelineStreamEvent = JSON.parse(e.data);
          const newAsset = mapStreamEventToAsset(data);
          handleAssetUpdate(newAsset);
        } catch (err) {
          logError('CMS_DELIVERY', 'Failed to parse item_changed event', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    } catch (error) {
      logError('CMS_DELIVERY', 'Failed to initialize timeline SSE', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (isMountedRef.current) {
        retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
      }
    }
  }, [handleAssetUpdate, retryIntervalMs]);

  useEffect(() => {
    isMountedRef.current = true;
    connectSSE();

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current !== undefined) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [connectSSE]);

  return { asset, isLoading };
}
