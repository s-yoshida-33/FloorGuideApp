// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logWarn, logError, logDebug } from '../logs/logging';
import { OptimizedVideo } from './OptimizedVideo';

interface VerticalVideoSlotProps {
  muted?: boolean;
}

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const FREEZE_TIMEOUT_MS = 30000; // 30秒間 timeupdate が来なければフリーズとみなす
const HEALTH_CHECK_INTERVAL_MS = 60000; // 60秒間隔でヘルスチェック
const MAX_RECREATE_COUNT = 3; // 動画要素の再生成上限

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ muted = false }) => {
  const { asset, isLoading } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);

  // Retry state
  const retryCountRef = React.useRef<number>(0);
  const retryTimerRef = React.useRef<number | undefined>(undefined);

  // Freeze detection
  const lastTimeUpdateRef = React.useRef<number>(Date.now());
  const freezeTimerRef = React.useRef<number | undefined>(undefined);
  const healthCheckTimerRef = React.useRef<number | undefined>(undefined);

  // Video element recreation
  const [videoKey, setVideoKey] = React.useState<number>(0);
  const recreateCountRef = React.useRef<number>(0);

  // Reset retry/recreation counts when asset changes
  React.useEffect(() => {
    retryCountRef.current = 0;
    recreateCountRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    if (retryTimerRef.current !== undefined) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, [asset?.id, asset?.src]);

  // Freeze detection & health check
  React.useEffect(() => {
    if (!asset) return;

    const isImage = asset.mediaType === 'image' ||
      (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    if (isImage) return;

    // Periodic freeze check
    freezeTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;

      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed > FREEZE_TIMEOUT_MS) {
        logWarn('CMS_DELIVERY', 'Video freeze detected - no timeupdate for 30s, attempting recovery', {
          assetId: asset.id,
          elapsed,
          readyState: video.readyState,
          networkState: video.networkState,
          currentTime: video.currentTime,
        });
        attemptRecovery(video);
      }
    }, 10000); // Check every 10s

    // Periodic health check
    healthCheckTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      logDebug('CMS_DELIVERY', 'Video health check', {
        assetId: asset.id,
        paused: video.paused,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: video.currentTime,
        duration: video.duration,
        error: video.error?.message || null,
      });

      // Detect stuck states: video should be playing but isn't
      if (!video.paused && video.readyState < 2 && !video.error) {
        const elapsed = Date.now() - lastTimeUpdateRef.current;
        if (elapsed > FREEZE_TIMEOUT_MS) {
          logWarn('CMS_DELIVERY', 'Video stuck in low readyState, attempting recovery', {
            assetId: asset.id,
            readyState: video.readyState,
            elapsed,
          });
          attemptRecovery(video);
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (freezeTimerRef.current !== undefined) window.clearInterval(freezeTimerRef.current);
      if (healthCheckTimerRef.current !== undefined) window.clearInterval(healthCheckTimerRef.current);
    };
  }, [asset?.id, asset?.src]);

  const attemptRecovery = React.useCallback((video: HTMLVideoElement) => {
    // First try: reload the video
    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current += 1;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
      logWarn('CMS_DELIVERY', `Attempting video recovery (${retryCountRef.current}/${MAX_RETRY_COUNT}), delay=${delay}ms`, {
        assetId: asset?.id,
      });

      retryTimerRef.current = window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(() => {});
          lastTimeUpdateRef.current = Date.now();
        }
      }, delay);
    } else if (recreateCountRef.current < MAX_RECREATE_COUNT) {
      // All retries exhausted - recreate the video element
      recreateCountRef.current += 1;
      retryCountRef.current = 0;
      logWarn('CMS_DELIVERY', `Recreating video element (${recreateCountRef.current}/${MAX_RECREATE_COUNT})`, {
        assetId: asset?.id,
      });
      lastTimeUpdateRef.current = Date.now();
      setVideoKey(prev => prev + 1);
    } else {
      logError('CMS_DELIVERY', 'All video recovery attempts exhausted', {
        assetId: asset?.id,
        retryCount: retryCountRef.current,
        recreateCount: recreateCountRef.current,
      });
    }
  }, [asset?.id]);

  // Reset media element when asset changes
  React.useEffect(() => {
    if (asset && asset.id !== prevAssetIdRef.current) {
      if (videoRef.current) {
        videoRef.current.load();
      }
      if (imgRef.current) {
        imgRef.current.src = asset.src;
      }
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.src]);

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('CMS_DELIVERY', 'No active content scheduled', { component: 'VerticalVideoSlot' });
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 12,
        }}
      >
        {isLoading ? 'Loading…' : 'No conected.'}
      </div>
    );
  }

  const isImage = asset.mediaType === 'image' ||
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));

  if (isImage) {
    return (
      <img
        ref={imgRef}
        key={`img-${asset.id}`}
        src={asset.src}
        alt={asset.name || 'Media'}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
        }}
        onLoad={() => {
          logDebug('CMS_DELIVERY', 'Content image loaded', {
            assetId: asset.id,
            src: asset.src,
            type: 'IMAGE'
          });
        }}
        onError={() => {
          logError('CMS_DELIVERY', 'Content image load failed', {
            assetId: asset.id,
            src: asset.src,
            reason: 'LOAD_ERROR'
          });
        }}
      />
    );
  }

  // Render as video (default)
  return (
    <OptimizedVideo
      ref={videoRef}
      key={`video-player-${videoKey}`}
      src={asset.src}
      autoPlay
      loop={true}
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'cover',
      }}
      onTimeUpdate={() => {
        lastTimeUpdateRef.current = Date.now();
      }}
      onLoadedData={() => {
        retryCountRef.current = 0; // Reset retry count on successful load
        lastTimeUpdateRef.current = Date.now();
        logDebug('CMS_DELIVERY', 'Content video ready', {
          assetId: asset.id,
          src: asset.src,
          type: 'VIDEO'
        });
      }}
      onPlay={() => {
        lastTimeUpdateRef.current = Date.now();
        logDebug('CMS_DELIVERY', 'Video playback started', {
          assetId: asset.id,
        });
      }}
      onStalled={() => {
        logWarn('CMS_DELIVERY', 'Video stalled (network throttle or buffer underrun)', {
          assetId: asset.id,
          src: asset.src,
          readyState: videoRef.current?.readyState,
          networkState: videoRef.current?.networkState,
        });
      }}
      onEnded={() => {
        logDebug('CMS_DELIVERY', 'Video playback ended (will loop)', {
          assetId: asset.id,
        });
      }}
      onError={() => {
        logError('CMS_DELIVERY', 'Content video load failed', {
          assetId: asset.id,
          src: asset.src,
          error: videoRef.current?.error?.message,
          errorCode: videoRef.current?.error?.code,
          networkState: videoRef.current?.networkState,
          readyState: videoRef.current?.readyState,
        });
        if (videoRef.current) {
          attemptRecovery(videoRef.current);
        }
      }}
    />
  );
};

export default VerticalVideoSlot;
