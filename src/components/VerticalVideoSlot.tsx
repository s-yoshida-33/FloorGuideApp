// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logWarn, logError, logDebug } from '../logs/logging';
import { OptimizedVideo } from './OptimizedVideo';
import { useAudioSettingsContext } from '../contexts/AudioSettingsContext';

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const FREEZE_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 60000;
const MAX_RECREATE_COUNT = 3;

// Expected dimensions of link content pages (portrait 9:16)
const LINK_CONTENT_W = 1080;
const LINK_CONTENT_H = 1920;

const VerticalVideoSlot: React.FC = () => {
  const { audioSettings } = useAudioSettingsContext();
  const muted = audioSettings.cmsMuted;
  const { asset, nextAsset, isLoading, isScheduleTransitioning } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const preloadVideoRef = React.useRef<HTMLVideoElement>(null);
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

  // Link iframe: container size (for scaling) and loaded flag
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // Transition overlay to prevent black screen when switching to link content.
  //
  // Strategy:
  //   - While a video is playing, periodically capture the current frame (every 1 s).
  //   - When asset switches to 'link', promote the last captured frame (or the
  //     image URL for image assets) as an overlay that sits above the loading iframe.
  //   - Once the iframe fires onLoad, clear the overlay instantly (cut-style switch).
  const latestVideoFrameRef = React.useRef<string | null>(null); // JPEG data URL of recent frame
  const prevAssetRef = React.useRef<typeof asset>(null);          // asset from previous render
  const [overlaySnapshot, setOverlaySnapshot] = React.useState<string | null>(null);

  // Callback ref: attach ResizeObserver when the link container div mounts/unmounts
  const linkContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (el) {
      const observer = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    } else {
      setContainerSize({ width: 0, height: 0 });
    }
  }, []);

  // Reset iframe loaded state on asset change
  React.useEffect(() => {
    setIframeLoaded(false);
  }, [asset?.id]);

  // Continuously capture the current video frame while a video asset is playing.
  // This ensures a recent snapshot is always available when transitioning to link.
  React.useEffect(() => {
    if (!asset) return;
    const isVideo =
      asset.mediaType !== 'image' &&
      asset.mediaType !== 'link' &&
      !/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src || '');
    if (!isVideo) {
      latestVideoFrameRef.current = null;
      return;
    }

    const capture = () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      try {
        canvas.getContext('2d')?.drawImage(v, 0, 0);
        latestVideoFrameRef.current = canvas.toDataURL('image/jpeg', 0.85);
      } catch {
        // cross-origin or other error — leave existing snapshot in place
      }
    };

    const id = window.setInterval(capture, 1000);
    return () => {
      window.clearInterval(id);
      latestVideoFrameRef.current = null;
    };
  }, [asset?.id]);

  // Activate overlay when asset changes to link, using the most recent captured data.
  React.useEffect(() => {
    if (!asset) {
      prevAssetRef.current = null;
      return;
    }

    if (asset.mediaType === 'link') {
      const prev = prevAssetRef.current;
      if (prev && prev.id !== asset.id && prev.src) {
        const isPrevImage =
          prev.mediaType === 'image' ||
          /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(prev.src);
        if (isPrevImage) {
          setOverlaySnapshot(prev.src);
        } else {
          // Video: use the periodically-captured frame
          setOverlaySnapshot(latestVideoFrameRef.current);
        }
      }
    } else {
      // Not link — clear any stale overlay
      setOverlaySnapshot(null);
    }

    prevAssetRef.current = asset;
  }, [asset?.id]);

  // Clear overlay instantly when iframe finishes loading
  React.useEffect(() => {
    if (iframeLoaded) setOverlaySnapshot(null);
  }, [iframeLoaded]);

  // Cleanup all resources on unmount
  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current !== undefined) window.clearTimeout(retryTimerRef.current);
      if (freezeTimerRef.current !== undefined) window.clearInterval(freezeTimerRef.current);
      if (healthCheckTimerRef.current !== undefined) window.clearInterval(healthCheckTimerRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (preloadVideoRef.current) {
        preloadVideoRef.current.pause();
        preloadVideoRef.current.removeAttribute('src');
        preloadVideoRef.current.load();
      }
    };
  }, []);

  // Sync muted prop to video element (React doesn't reliably update muted attribute)
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

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

  // Pause video on last frame during CMS schedule recalculation.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !asset) return;

    const isImage = asset.mediaType === 'image' ||
      (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    if (isScheduleTransitioning) {
      if (!video.paused) {
        video.pause();
        logDebug('VIDEO', 'Paused video for schedule recalculation (holding last frame)', {
          assetId: asset.id,
          currentTime: video.currentTime,
        });
      }
    } else {
      lastTimeUpdateRef.current = Date.now();
      if (video.paused && video.readyState >= 2) {
        video.play().then(() => {
          logDebug('VIDEO', 'Resumed video after schedule recalculation', {
            assetId: asset.id,
            currentTime: video.currentTime,
          });
        }).catch((err) => {
          logError('VIDEO', 'Failed to resume video after schedule recalculation', {
            assetId: asset.id,
            error: err?.message,
          });
        });
      }
    }
  }, [isScheduleTransitioning, asset?.id]);

  // Freeze detection & health check
  React.useEffect(() => {
    if (!asset) return;

    const isImage = asset.mediaType === 'image' ||
      (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    freezeTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed > FREEZE_TIMEOUT_MS) {
        logWarn('VIDEO', 'Video freeze detected - no timeupdate for 30s, attempting recovery', {
          assetId: asset.id, elapsed,
          readyState: video.readyState, networkState: video.networkState, currentTime: video.currentTime,
        });
        attemptRecovery(video);
      }
    }, 10000);

    healthCheckTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      logDebug('VIDEO', 'Video health check', {
        assetId: asset.id, paused: video.paused,
        readyState: video.readyState, networkState: video.networkState,
        currentTime: video.currentTime, duration: video.duration,
        error: video.error?.message || null,
      });
      if (!video.paused && video.readyState < 2 && !video.error) {
        const elapsed = Date.now() - lastTimeUpdateRef.current;
        if (elapsed > FREEZE_TIMEOUT_MS) {
          logWarn('VIDEO', 'Video stuck in low readyState, attempting recovery', {
            assetId: asset.id, readyState: video.readyState, elapsed,
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

  const attemptRecovery = React.useCallback((_video: HTMLVideoElement) => {
    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current += 1;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
      logWarn('VIDEO', `Attempting video recovery (${retryCountRef.current}/${MAX_RETRY_COUNT}), delay=${delay}ms`, {
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
      recreateCountRef.current += 1;
      retryCountRef.current = 0;
      logWarn('VIDEO', `Recreating video element (${recreateCountRef.current}/${MAX_RECREATE_COUNT})`, {
        assetId: asset?.id,
      });
      lastTimeUpdateRef.current = Date.now();
      setVideoKey(prev => prev + 1);
    } else {
      logError('VIDEO', 'All video recovery attempts exhausted', {
        assetId: asset?.id,
        retryCount: retryCountRef.current,
        recreateCount: recreateCountRef.current,
      });
    }
  }, [asset?.id]);

  // Reset media element when asset changes
  React.useEffect(() => {
    if (asset && asset.id !== prevAssetIdRef.current) {
      if (!asset.src) {
        logWarn('VIDEO', 'Asset has empty src, skipping media load', { assetId: asset.id });
        prevAssetIdRef.current = asset.id;
        return;
      }
      logDebug('CMS_DELIVERY', 'CMS asset transition', {
        from: prevAssetIdRef.current, to: asset.id, mediaType: asset.mediaType,
      });
      if (imgRef.current) {
        imgRef.current.src = asset.src;
      }
      const preloadVideo = preloadVideoRef.current;
      if (preloadVideo && preloadVideo.src) {
        const preloadSrc = decodeURIComponent(preloadVideo.src);
        if (preloadSrc.includes(asset.id) || preloadVideo.src === asset.src) {
          preloadVideo.removeAttribute('src');
          preloadVideo.load();
        }
      }
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.src]);

  // Preload next asset for seamless video transition
  React.useEffect(() => {
    const preloadVideo = preloadVideoRef.current;
    if (!preloadVideo || !nextAsset?.src) return;
    const isNextVideo = !nextAsset.src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
    if (!isNextVideo) return;
    const currentPreloadSrc = decodeURIComponent(preloadVideo.src || '');
    if (currentPreloadSrc.includes(nextAsset.id) || preloadVideo.src === nextAsset.src) return;
    if (preloadVideo.src) {
      preloadVideo.removeAttribute('src');
      preloadVideo.load();
    }
    preloadVideo.src = nextAsset.src;
    preloadVideo.load();
    logDebug('CMS_DELIVERY', 'Preloading next CMS asset', { nextAssetId: nextAsset.id });
  }, [nextAsset?.id, nextAsset?.src]);

  // ─── No asset ─────────────────────────────────────────────────────────

  if (!asset) {
    if (!isLoading) {
      logWarn('CMS_DELIVERY', 'No active content scheduled', { component: 'VerticalVideoSlot' });
    }
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12,
      }}>
        {isLoading ? 'Loading...' : 'Not connected.'}
      </div>
    );
  }

  const isImage = asset.mediaType === 'image' ||
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
  const isLink = asset.mediaType === 'link';

  // ─── Image ──────────────────────────────────────────────────────────────

  if (isImage) {
    return (
      <img
        ref={imgRef}
        key={`img-${asset.id}`}
        src={asset.src}
        alt={asset.name || 'Media'}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        onLoad={() => logDebug('VIDEO', 'Content image loaded', { assetId: asset.id, src: asset.src, type: 'IMAGE' })}
        onError={() => logError('VIDEO', 'Content image load failed', { assetId: asset.id, src: asset.src, reason: 'LOAD_ERROR' })}
      />
    );
  }

  // ─── Link (iframe) ─────────────────────────────────────────────────────

  if (isLink) {
    let iframeTransform: string | undefined;
    if (containerSize.width > 0 && containerSize.height > 0) {
      const scale = Math.min(
        containerSize.width / LINK_CONTENT_W,
        containerSize.height / LINK_CONTENT_H,
      );
      const tx = (containerSize.width - LINK_CONTENT_W * scale) / 2;
      const ty = (containerSize.height - LINK_CONTENT_H * scale) / 2;
      iframeTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    return (
      <div
        ref={linkContainerRef}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
      >
        {/* Iframe loads in the background (z-index 1) */}
        <iframe
          key={`iframe-${asset.id}`}
          src={asset.src}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${LINK_CONTENT_W}px`,
            height: `${LINK_CONTENT_H}px`,
            border: 'none',
            transformOrigin: 'top left',
            transform: iframeTransform,
            zIndex: 1,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => {
            setIframeLoaded(true);
            logDebug('CMS_DELIVERY', 'Link content loaded', { assetId: asset.id, src: asset.src });
          }}
          onError={() => {
            logError('CMS_DELIVERY', 'Link content load failed', { assetId: asset.id, src: asset.src });
          }}
        />

        {/* Overlay: previous frame on top (z-index 2) while iframe loads.
            Cleared instantly on iframe load to match cut-style transitions. */}
        {overlaySnapshot && (
          <img
            src={overlaySnapshot}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    );
  }

  // ─── Video (default) ──────────────────────────────────────────────────

  return (
    <>
      <OptimizedVideo
        ref={videoRef}
        key={`video-player-${videoKey}`}
        src={asset.src}
        autoPlay
        loop={true}
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        onTimeUpdate={() => { lastTimeUpdateRef.current = Date.now(); }}
        onLoadedData={() => {
          retryCountRef.current = 0;
          lastTimeUpdateRef.current = Date.now();
          logDebug('VIDEO', 'Content video ready', { assetId: asset.id, src: asset.src });
        }}
        onPlay={() => {
          lastTimeUpdateRef.current = Date.now();
          logDebug('VIDEO', 'Video playback started', { assetId: asset.id });
        }}
        onStalled={() => {
          logWarn('VIDEO', 'Video stalled (network throttle or buffer underrun)', {
            assetId: asset.id, src: asset.src,
            readyState: videoRef.current?.readyState, networkState: videoRef.current?.networkState,
          });
        }}
        onEnded={() => logDebug('VIDEO', 'Video playback ended (will loop)', { assetId: asset.id })}
        onError={() => {
          logError('VIDEO', 'Content video load failed', {
            assetId: asset.id, src: asset.src,
            error: videoRef.current?.error?.message,
            errorCode: videoRef.current?.error?.code,
            networkState: videoRef.current?.networkState,
            readyState: videoRef.current?.readyState,
          });
          if (videoRef.current) attemptRecovery(videoRef.current);
        }}
      />
      {/* Hidden preload element for next CMS asset */}
      <video ref={preloadVideoRef} muted preload="metadata" playsInline style={{ display: 'none' }} />
    </>
  );
};

export default VerticalVideoSlot;
