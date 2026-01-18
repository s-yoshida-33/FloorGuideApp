// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { getCmsBaseUrl } from '../repositories/wspRepository'; // fetchCurrentAsset を削除
import { logInfo, logWarn, logError, logDebug } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

/**
 * Helper to convert TimelineItem (from SSE/REST) to CurrentAsset
 */
function mapTimelineToAsset(timelineItem: any): CurrentAsset | null {
  if (!timelineItem) return null;
  const data = timelineItem.data || timelineItem;
  const assets = data.media_assets || timelineItem.media_assets || [];
  
  if (!Array.isArray(assets) || assets.length === 0) return null;

  const asset = assets[0];
  const assetPath = asset.url || asset.localPath || '';
  
  // Convert to file URL if local path
  let src = '';
  if (assetPath) {
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      src = assetPath;
    } else {
      const normalized = assetPath.replace(/\\/g, '/');
      src = `file:///${normalized}`;
    }
  }

  const mediaNames = data.media_names || timelineItem.media_names || [];
  
  let mediaType = asset.mediaType || asset.type || '';
   if (!mediaType) {
      const pathLower = assetPath.toLowerCase();
      if (pathLower.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/)) {
          mediaType = 'video';
      } else if (pathLower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
          mediaType = 'image';
      }
  }

  return {
      id: asset.id,
      src,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      name: mediaNames[0] || '',
      startTime: data.start_time || timelineItem.start_time || '',
      endTime: data.end_time || timelineItem.end_time || '',
      mediaType,
      type: asset.type
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

  const handleAssetUpdate = useCallback((next: CurrentAsset | null) => {
    if (!isMountedRef.current) return;

    if (next) {
      const assetChanged = asset?.id !== next.id;
      if (lastStatusRef.current !== 'ok') {
        logInfo('video', 'Received current video asset via SSE', {
          assetId: next.id,
          src: next.src,
          name: next.name,
        });
      } else if (assetChanged) {
        logInfo('video', 'Asset changed via SSE', {
          oldAssetId: asset?.id,
          newAssetId: next.id,
        });
      }
      lastStatusRef.current = 'ok';
    } else {
      if (lastStatusRef.current !== 'noAsset') {
        // Suppress repeated warnings if we are just waiting for the first event
        // logWarn('video', 'No current video asset available yet');
      }
      lastStatusRef.current = 'noAsset';
    }

    setAsset(next);
    setIsLoading(false);
  }, [asset?.id]);

  const connectSSE = useCallback(async () => {
    try {
      const baseUrl = await getCmsBaseUrl();
      if (!baseUrl) {
        logWarn('video', 'CMS base URL not found, retrying...');
        retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        return;
      }

      const url = `${baseUrl}/api/events`;
      logInfo('video', 'Connecting to SSE', { url });

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        logInfo('video', 'SSE connection established');
      };

      es.onerror = (e) => {
        // Only log error if it's not a normal reconnection attempt or if verbose
        // es.readyState === 0 means connecting, 1 open, 2 closed
        if (es.readyState === 2) {
             logError('video', 'SSE connection closed/error', { state: es.readyState, error: e });
        }
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
             retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        }
      };

      // Event: connected
      // NOTE: Assuming the 'connected' event sends the current state payload
      es.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          logInfo('video', 'SSE: connected event', data);
          
          // Try to extract initial asset from connected event if available
          if (data.current_timeline) {
              const initialAsset = mapTimelineToAsset(data.current_timeline);
              if (initialAsset) {
                  handleAssetUpdate(initialAsset);
              }
          }
        } catch (err) {
          console.error('Failed to parse connected event', err);
        }
      });

      // Event: switch (Content switching)
      es.addEventListener('switch', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const newAsset = mapTimelineToAsset(data.current_timeline);
          handleAssetUpdate(newAsset);
        } catch (err) {
          logError('video', 'Failed to parse switch event', { error: err });
        }
      });

      // Event: update (Timeline update)
      // Since legacy fetch is disabled, we rely on the payload in the event or wait for next switch
      es.addEventListener('update', (e: MessageEvent) => {
          logDebug('video', 'SSE: update event received');
          // If update event carries data, use it. Otherwise we might need to wait or use a different endpoint.
          // Currently assuming update might trigger a reload in legacy, but here we just log.
          // If `update` event contains `current_timeline`, use it:
          try {
             if (e.data) {
                 const data = JSON.parse(e.data);
                 if (data.current_timeline) {
                     const updatedAsset = mapTimelineToAsset(data.current_timeline);
                     handleAssetUpdate(updatedAsset);
                 }
             }
          } catch(err) { /* ignore */ }
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
