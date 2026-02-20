// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset, TimelineStreamEvent } from '../types/wsp';
import { TIMELINE_STREAM_URL } from '../config';
import { logWarn, logError, logDebug } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

/**
 * Convert a TimelineStreamEvent (item_changed) into a CurrentAsset.
 */
function mapStreamEventToAsset(event: TimelineStreamEvent): CurrentAsset | null {
  if (!event.current_media_id) return null;

  const localPath = event.current_media_local_path || '';
  let src = '';
  if (localPath) {
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      src = localPath;
    } else {
      const normalized = localPath.replace(/\\/g, '/');
      src = `file:///${normalized}`;
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
        logDebug('video', 'Received current video asset via SSE', {
          assetId: next.id,
          src: next.src,
          name: next.name,
        });
      } else if (assetChanged) {
        logDebug('video', 'Asset changed via SSE', {
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
    logDebug('video', 'Connecting to SSE', { url });

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        logDebug('video', 'SSE connection established');
      };

      es.onerror = (e) => {
        if (es.readyState === 2) {
          logError('video', 'SSE connection closed/error', { state: es.readyState, error: e });
        }
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
          retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        }
      };

      // Event: item_changed
      es.addEventListener('item_changed', (e: MessageEvent) => {
        try {
          const data: TimelineStreamEvent = JSON.parse(e.data);
          const newAsset = mapStreamEventToAsset(data);
          handleAssetUpdate(newAsset);
        } catch (err) {
          logError('video', 'Failed to parse item_changed event', { error: err });
        }
      });

    } catch (error) {
      logError('video', 'Failed to initialize SSE', { error });
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
