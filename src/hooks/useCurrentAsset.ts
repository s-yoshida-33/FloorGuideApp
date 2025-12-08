// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { getCmsBaseUrl, fetchCurrentAsset } from '../repositories/wspRepository';
import { logInfo, logWarn, logError } from '../logs/logging';

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
  // Support both direct object and nested data object
  const data = timelineItem.data || timelineItem;
  
  // Support both old format (tl.media_assets) and new format (tl.data.media_assets)
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
      // Simple conversion for Windows paths
      const normalized = assetPath.replace(/\\/g, '/');
      src = `file:///${normalized}`;
    }
  }

  // Support both old format (tl.media_names) and new format (data.media_names)
  const mediaNames = data.media_names || timelineItem.media_names || [];
  
  // Infer media type
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

/**
 * Connects to CMS SSE endpoint and updates current asset.
 * Falls back to polling if SSE fails or is not available.
 */
export function useCurrentAsset(
  retryIntervalMs: number = 3000,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const isMountedRef = useRef<boolean>(true);

  // Keep track of last status to avoid spamming logs
  const lastStatusRef = useRef<AssetStatus>(null);

  const handleAssetUpdate = useCallback((next: CurrentAsset | null) => {
    if (!isMountedRef.current) return;

    if (next) {
      // Check if asset has changed
      const assetChanged = asset?.id !== next.id;
      
      // Status: ok (asset available)
      if (lastStatusRef.current !== 'ok') {
        logInfo('video', 'Received current video asset', {
          assetId: next.id,
          src: next.src,
          name: next.name,
        });
      } else if (assetChanged) {
        logInfo('video', 'Asset changed', {
          oldAssetId: asset?.id,
          newAssetId: next.id,
        });
      }
      lastStatusRef.current = 'ok';
    } else {
      // Status: noAsset
      if (lastStatusRef.current !== 'noAsset') {
        logWarn('video', 'No current video asset available');
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
        // Fetch initial state via REST when connected, to ensure we have data immediately
        fetchCurrentAsset().then(initialAsset => {
           if (initialAsset) handleAssetUpdate(initialAsset);
        });
      };

      es.onerror = (e) => {
        logError('video', 'SSE connection error', { error: e });
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
             retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        }
      };

      // Event: connected
      es.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          logInfo('video', 'SSE: connected event', data);
        } catch (err) {
          console.error('Failed to parse connected event', err);
        }
      });

      // Event: switch (Content switching)
      es.addEventListener('switch', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          // data.current_timeline contains the new timeline item
          const newAsset = mapTimelineToAsset(data.current_timeline);
          handleAssetUpdate(newAsset);
        } catch (err) {
          logError('video', 'Failed to parse switch event', { error: err });
        }
      });

      // Event: update (Timeline update)
      es.addEventListener('update', () => {
          logInfo('video', 'SSE: update event received, refreshing asset');
          // Fetch latest state on update event
          fetchCurrentAsset().then(next => handleAssetUpdate(next));
      });
      
      // Event: heartbeat (Keep-alive)
      es.addEventListener('heartbeat', () => {
          // Optional: implement watchdog if needed
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
    
    // Initial fetch to show something while connecting
    fetchCurrentAsset().then(initialAsset => {
        if (isMountedRef.current && initialAsset) {
            handleAssetUpdate(initialAsset);
        }
    });

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
