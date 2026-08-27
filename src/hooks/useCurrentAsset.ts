// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CurrentAsset, TimelineStreamEvent } from '../types/wsp';
import { TIMELINE_STREAM_URL } from '../config';
import { logWarn, logError, logDebug } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  nextAsset: CurrentAsset | null;
  isLoading: boolean;
  isScheduleTransitioning: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

const BASE_RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 60000;
const NULL_GRACE_PERIOD_MS = 30000;

/**
 * WEB連携コンテンツ(zip)の展開先エントリポイントを解決する。
 * プレイヤー側がZIPと同じUUID名・拡張子無しのディレクトリに展開済みコンテンツを
 * 配置する前提(実機確認済み)で、`<uuid>.zip` → `<uuid>/index.html` を導出する。
 * 実際に展開が完了しているかどうかはここでは確認しない(呼び出し側でタイミング検証を行う)。
 */
function deriveWebFeedEntry(zipLocalPath: string): { src: string; rawPath: string } {
  const dirPath = zipLocalPath.replace(/\.zip$/i, '');
  const normalized = dirPath.replace(/\\/g, '/');
  const rawPath = `${normalized}/index.html`;
  return { src: convertFileSrc(rawPath), rawPath };
}

/**
 * Convert a TimelineStreamEvent into a CurrentAsset.
 * Uses convertFileSrc for local paths (Tauri asset protocol).
 */
function mapStreamEventToAsset(event: TimelineStreamEvent): CurrentAsset | null {
  if (!event.current_media_id) return null;

  const localPath = event.current_media_local_path || '';
  const mediaType = event.current_media_type || '';
  let src = '';
  let rawPath: string | undefined;
  if (localPath) {
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      src = localPath;
    } else if (mediaType === 'zip') {
      const entry = deriveWebFeedEntry(localPath);
      src = entry.src;
      rawPath = entry.rawPath;
    } else {
      // Use Tauri asset protocol instead of file://
      const normalized = localPath.replace(/\\/g, '/');
      src = convertFileSrc(normalized);
    }
  }

  return {
    id: event.current_media_id,
    src,
    rawPath,
    duration: 0,
    width: 0,
    height: 0,
    name: event.current_media_name || '',
    startTime: '',
    endTime: '',
    mediaType,
    type: mediaType,
  };
}

function mapStreamEventToNextAsset(event: TimelineStreamEvent): CurrentAsset | null {
  if (!event.next_media_id || !event.next_media_local_path) return null;

  const localPath = event.next_media_local_path;
  // Note: TimelineStreamEvent does not carry a next_media_type field, so a zip
  // (WEB連携コンテンツ) entry cannot be distinguished here by type alone. Fall back to
  // detecting it by the `.zip` extension, matching how current_media_local_path looks
  // for zip assets (see the item_changed sample in Gido Issue #36).
  const isZip = /\.zip$/i.test(localPath);
  let src = '';
  let rawPath: string | undefined;
  if (localPath) {
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      src = localPath;
    } else if (isZip) {
      const entry = deriveWebFeedEntry(localPath);
      src = entry.src;
      rawPath = entry.rawPath;
    } else {
      const normalized = localPath.replace(/\\/g, '/');
      src = convertFileSrc(normalized);
    }
  }

  return {
    id: event.next_media_id,
    src,
    rawPath,
    duration: 0,
    width: 0,
    height: 0,
    name: '',
    startTime: '',
    endTime: '',
    mediaType: isZip ? 'zip' : '',
    type: isZip ? 'zip' : '',
  };
}

/**
 * Calculate retry delay with exponential backoff and jitter.
 */
function calcRetryDelay(attempt: number): number {
  const exponential = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const capped = Math.min(exponential, MAX_RETRY_DELAY_MS);
  // Add ±30% jitter to prevent thundering herd
  const jitter = capped * (0.7 + Math.random() * 0.6);
  return Math.round(jitter);
}

export function useCurrentAsset(): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [nextAsset, setNextAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScheduleTransitioning, setIsScheduleTransitioning] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const retryAttemptRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const lastStatusRef = useRef<AssetStatus>(null);
  const lastAssetIdRef = useRef<string | undefined>(undefined);
  const nullGraceTimerRef = useRef<number | undefined>(undefined);

  const clearNullGraceTimer = useCallback(() => {
    if (nullGraceTimerRef.current !== undefined) {
      window.clearTimeout(nullGraceTimerRef.current);
      nullGraceTimerRef.current = undefined;
    }
  }, []);

  const handleAssetUpdate = useCallback((next: CurrentAsset | null, nextMedia: CurrentAsset | null) => {
    if (!isMountedRef.current) return;

    if (next) {
      clearNullGraceTimer();
      setIsScheduleTransitioning(false);

      const assetChanged = lastAssetIdRef.current !== next.id;
      if (lastStatusRef.current !== 'ok') {
        logDebug('CMS_DELIVERY', 'Received current video asset via SSE', {
          assetId: next.id,
          src: next.src,
          name: next.name,
          nextMediaId: nextMedia?.id,
        });
      } else if (assetChanged) {
        logDebug('CMS_DELIVERY', 'Asset changed via SSE', {
          oldAssetId: lastAssetIdRef.current,
          newAssetId: next.id,
          nextMediaId: nextMedia?.id,
        });
      }
      lastStatusRef.current = 'ok';
      lastAssetIdRef.current = next.id;

      setAsset(prevAsset => {
        if (prevAsset && prevAsset.id === next.id && prevAsset.src === next.src) {
          return prevAsset;
        }
        return next;
      });

      setNextAsset(prevNext => {
        if (!nextMedia) return null;
        if (prevNext && prevNext.id === nextMedia.id && prevNext.src === nextMedia.src) {
          return prevNext;
        }
        return nextMedia;
      });

      setIsLoading(false);
      return;
    }

    // next is null: schedule recalculation in progress
    if (lastAssetIdRef.current && nullGraceTimerRef.current === undefined) {
      logDebug('CMS_DELIVERY', 'Received null asset during schedule recalculation, entering grace period', {
        previousAssetId: lastAssetIdRef.current,
        gracePeriodMs: NULL_GRACE_PERIOD_MS,
        nextMediaId: nextMedia?.id,
      });
      setIsScheduleTransitioning(true);

      if (nextMedia) {
        setNextAsset(prevNext => {
          if (prevNext && prevNext.id === nextMedia.id && prevNext.src === nextMedia.src) {
            return prevNext;
          }
          return nextMedia;
        });
      }

      nullGraceTimerRef.current = window.setTimeout(() => {
        nullGraceTimerRef.current = undefined;
        if (!isMountedRef.current) return;
        logWarn('CMS_DELIVERY', 'Null grace period expired, treating as no asset', {
          previousAssetId: lastAssetIdRef.current,
        });
        setIsScheduleTransitioning(false);
        lastStatusRef.current = 'noAsset';
        lastAssetIdRef.current = undefined;
        setAsset(null);
        setNextAsset(null);
        setIsLoading(false);
      }, NULL_GRACE_PERIOD_MS);
      return;
    }

    // No previous asset or grace timer already running: fall through to original null behavior
    if (!lastAssetIdRef.current) {
      lastStatusRef.current = 'noAsset';
      setAsset(null);
      setNextAsset(prevNext => {
        if (!nextMedia) return null;
        if (prevNext && prevNext.id === nextMedia.id && prevNext.src === nextMedia.src) {
          return prevNext;
        }
        return nextMedia;
      });
      setIsLoading(false);
    }
  }, [clearNullGraceTimer]);

  const connectSSE = useCallback(() => {
    const url = TIMELINE_STREAM_URL;
    logDebug('CMS_DELIVERY', 'Connecting to timeline SSE', { url, attempt: retryAttemptRef.current });

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        logDebug('CMS_DELIVERY', 'Timeline SSE connection established');
        retryAttemptRef.current = 0; // Reset on successful connection
      };

      es.onerror = () => {
        if (es.readyState === 2) {
          logWarn('CMS_DELIVERY', 'Timeline SSE connection closed');
        }
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
          const delay = calcRetryDelay(retryAttemptRef.current);
          logDebug('CMS_DELIVERY', `SSE reconnecting in ${delay}ms (attempt ${retryAttemptRef.current + 1})`, {
            attempt: retryAttemptRef.current,
            delay,
          });
          retryAttemptRef.current += 1;
          retryTimeoutRef.current = window.setTimeout(connectSSE, delay);
        }
      };

      // Event: item_changed - real-time schedule update from CMS player
      es.addEventListener('item_changed', (e: MessageEvent) => {
        try {
          const data: TimelineStreamEvent = JSON.parse(e.data);
          const newAsset = mapStreamEventToAsset(data);
          const newNextAsset = mapStreamEventToNextAsset(data);
          handleAssetUpdate(newAsset, newNextAsset);
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
        const delay = calcRetryDelay(retryAttemptRef.current);
        retryAttemptRef.current += 1;
        retryTimeoutRef.current = window.setTimeout(connectSSE, delay);
      }
    }
  }, [handleAssetUpdate]);

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
      clearNullGraceTimer();
    };
  }, [connectSSE, clearNullGraceTimer]);

  return { asset, nextAsset, isLoading, isScheduleTransitioning };
}
