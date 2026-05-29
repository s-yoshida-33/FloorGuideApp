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

// Returns true for external URLs (http or https) while excluding localhost
// and loopback addresses used to serve local video files.
const isExternalLinkUrl = (src: string | undefined): boolean =>
  !!src &&
  /^https?:\/\//i.test(src) &&
  !/^https?:\/\/localhost(:\d+)?/i.test(src) &&
  !/^https?:\/\/127\./i.test(src);

const isImageAsset = (asset: any): boolean => 
  !!asset && (asset.mediaType === 'image' || (!!asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src)));
  
const isLinkAsset = (asset: any): boolean => 
  !!asset && (asset.mediaType === 'link' || isExternalLinkUrl(asset.src));  

const VerticalVideoSlot: React.FC = () => {
  const { audioSettings } = useAudioSettingsContext();
  const muted = audioSettings.cmsMuted;
  const { asset, nextAsset, isLoading, isScheduleTransitioning } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const preloadVideoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);

  const retryCountRef = React.useRef<number>(0);
  const retryTimerRef = React.useRef<number | undefined>(undefined);
  const lastTimeUpdateRef = React.useRef<number>(Date.now());
  const freezeTimerRef = React.useRef<number | undefined>(undefined);
  const healthCheckTimerRef = React.useRef<number | undefined>(undefined);
  const [videoKey, setVideoKey] = React.useState<number>(0);
  const recreateCountRef = React.useRef<number>(0);

  // Container size for iframe scaling (ResizeObserver on the outer wrapper)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const outerContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
    if (el) {
      const observer = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  // Iframe state: src while preloading or active, flag for when it is the visible content
  const [iframeSrc, setIframeSrc] = React.useState<string | null>(null);
  const [iframeActive, setIframeActive] = React.useState(false);

  // Begin preloading as soon as the next asset is known to be an external URL.
  // Guard with iframeActive so this effect never fires while a link is displayed —
  // otherwise it would overwrite the active iframeSrc with a local video URL.
  React.useEffect(() => {
    if (iframeActive) return;
    const src = nextAsset?.src;
    if (isExternalLinkUrl(src)) {
      setIframeSrc(prev => (prev === src ? prev : src as string));
    }
  }, [nextAsset?.src, iframeActive]);

  // Activate/deactivate the iframe synchronously — before the browser paints.
  // Deps include both asset.id AND asset.mediaType so the effect fires even
  // when the same schedule slot transitions between mediaTypes (e.g. video→link
  // with an identical asset id).
  React.useLayoutEffect(() => {
    if (!asset) { setIframeActive(false); return; }
    if (isLinkAsset(asset)) {
      setIframeSrc(prev => (prev === asset.src ? prev : asset.src));
      setIframeActive(true);
    } else {
      setIframeActive(false);
    }
  }, [asset?.id, asset?.mediaType, asset?.src]);

  // Release the iframe element when it is no longer active and the next asset
  // is not an external URL (no reason to keep it in the DOM consuming memory)
  React.useEffect(() => {
    if (!iframeActive) {
      if (!isExternalLinkUrl(nextAsset?.src)) {
        setIframeSrc(null);
      }
    }
  }, [iframeActive, nextAsset?.src]);

  // Unmount cleanup
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

  // Sync muted state to the video element
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Reset retry/recreation counts on asset change
  React.useEffect(() => {
    retryCountRef.current = 0;
    recreateCountRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    if (retryTimerRef.current !== undefined) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, [asset?.id, asset?.src]);

  // Pause video on last frame during CMS schedule recalculation
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !asset) return;
    const isImage = isImageAsset(asset);
    const isLink = isLinkAsset(asset);
    if (isImage || isLink) return;

    if (isScheduleTransitioning) {
      if (!video.paused) {
        video.pause();
        logDebug('VIDEO', 'Paused video for schedule recalculation (holding last frame)', { assetId: asset.id, currentTime: video.currentTime });
      }
    } else {
      lastTimeUpdateRef.current = Date.now();
      if (video.paused && video.readyState >= 2) {
        video.play().then(() => {
          logDebug('VIDEO', 'Resumed video after schedule recalculation', { assetId: asset.id, currentTime: video.currentTime });
        }).catch(err => {
          logError('VIDEO', 'Failed to resume video after schedule recalculation', { assetId: asset.id, error: err?.message });
        });
      }
    }
  }, [isScheduleTransitioning, asset?.id]);

  // Freeze detection & health check
  React.useEffect(() => {
    if (!asset) return;
    const isImage = isImageAsset(asset);
    const isLink = isLinkAsset(asset);
    if (isImage || isLink) return;

    freezeTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed > FREEZE_TIMEOUT_MS) {
        logWarn('VIDEO', 'Video freeze detected, attempting recovery', {
          assetId: asset.id, elapsed, readyState: video.readyState,
          networkState: video.networkState, currentTime: video.currentTime,
        });
        attemptRecovery(video);
      }
    }, 10000);

    healthCheckTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      logDebug('VIDEO', 'Video health check', {
        assetId: asset.id, paused: video.paused, readyState: video.readyState,
        networkState: video.networkState, currentTime: video.currentTime,
        duration: video.duration, error: video.error?.message || null,
      });
      if (!video.paused && video.readyState < 2 && !video.error) {
        const elapsed = Date.now() - lastTimeUpdateRef.current;
        if (elapsed > FREEZE_TIMEOUT_MS) {
          logWarn('VIDEO', 'Video stuck in low readyState, attempting recovery', { assetId: asset.id, readyState: video.readyState, elapsed });
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
      logWarn('VIDEO', `Attempting video recovery (${retryCountRef.current}/${MAX_RETRY_COUNT}), delay=${delay}ms`, { assetId: asset?.id });
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
      logWarn('VIDEO', `Recreating video element (${recreateCountRef.current}/${MAX_RECREATE_COUNT})`, { assetId: asset?.id });
      lastTimeUpdateRef.current = Date.now();
      setVideoKey(prev => prev + 1);
    } else {
      logError('VIDEO', 'All video recovery attempts exhausted', {
        assetId: asset?.id, retryCount: retryCountRef.current, recreateCount: recreateCountRef.current,
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
      logDebug('CMS_DELIVERY', 'CMS asset transition', { from: prevAssetIdRef.current, to: asset.id, mediaType: asset.mediaType });
      if (imgRef.current) imgRef.current.src = asset.src;
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

  // Preload next video asset.
  // Skip http/https URLs — those are handled by the iframe preloading above.
  React.useEffect(() => {
    const preloadVideo = preloadVideoRef.current;
    if (!preloadVideo || !nextAsset?.src) return;
    const isNextVideo =
      !/^https?:\/\//i.test(nextAsset.src) &&
      !/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(nextAsset.src);
    if (!isNextVideo) return;
    const currentPreloadSrc = decodeURIComponent(preloadVideo.src || '');
    if (currentPreloadSrc.includes(nextAsset.id) || preloadVideo.src === nextAsset.src) return;
    if (preloadVideo.src) { preloadVideo.removeAttribute('src'); preloadVideo.load(); }
    preloadVideo.src = nextAsset.src;
    preloadVideo.load();
    logDebug('CMS_DELIVERY', 'Preloading next CMS asset', { nextAssetId: nextAsset.id });
  }, [nextAsset?.id, nextAsset?.src]);

  // Log when no active content is scheduled
  React.useEffect(() => {
    if (!asset && !isLoading) {
      logWarn('CMS_DELIVERY', 'No active content scheduled', { component: 'VerticalVideoSlot' });
    }
  }, [asset, isLoading]);

  // Compute CSS transform to scale link content (1080x1920) into the container
  let iframeTransform: string | undefined;
  if (containerSize.width > 0 && containerSize.height > 0) {
    const scale = Math.min(containerSize.width / LINK_CONTENT_W, containerSize.height / LINK_CONTENT_H);
    const tx = (containerSize.width - LINK_CONTENT_W * scale) / 2;
    const ty = (containerSize.height - LINK_CONTENT_H * scale) / 2;
    iframeTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  const isImage = isImageAsset(asset);
  const isLink = isLinkAsset(asset);

  return (
    <div
      ref={outerContainerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
    >
      {/* Link content iframe.
          While the current video/image plays, the iframe loads silently at z-index 0.
          useLayoutEffect flips iframeActive before the browser paints, instantly
          promoting it to z-index 2 — no black frame is ever visible. */}
      {iframeSrc && (
        <iframe
          key={`iframe-${iframeSrc}`}
          src={iframeSrc}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: `${LINK_CONTENT_W}px`, height: `${LINK_CONTENT_H}px`,
            border: 'none', transformOrigin: 'top left',
            transform: iframeTransform,
            zIndex: iframeActive ? 2 : 0,
            pointerEvents: iframeActive ? 'auto' : 'none',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => logDebug('CMS_DELIVERY', iframeActive ? 'Link content active' : 'Link content preloaded', { src: iframeSrc })}
          onError={() => logError('CMS_DELIVERY', 'Link content load failed', { src: iframeSrc })}
        />
      )}

      {/* Non-link content at z-index 1 — covers the preloading iframe.
          Never renders video/image for link-type assets to prevent a broken
          media element from briefly showing during state transitions. */}
      {!iframeActive && !isLink && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#000' }}>
          {!asset ? (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12,
            }}>
              {isLoading ? 'Loading...' : 'Not connected.'}
            </div>
          ) : isImage ? (
            <img
              ref={imgRef}
              key={`img-${asset.id}`}
              src={asset.src}
              alt={asset.name || 'Media'}
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
              onLoad={() => logDebug('VIDEO', 'Content image loaded', { assetId: asset.id, src: asset.src, type: 'IMAGE' })}
              onError={() => logError('VIDEO', 'Content image load failed', { assetId: asset.id, src: asset.src, reason: 'LOAD_ERROR' })}
            />
          ) : (
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
                onStalled={() => logWarn('VIDEO', 'Video stalled (network throttle or buffer underrun)', {
                  assetId: asset.id, src: asset.src,
                  readyState: videoRef.current?.readyState, networkState: videoRef.current?.networkState,
                })}
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
              <video ref={preloadVideoRef} muted preload="metadata" playsInline style={{ display: 'none' }} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VerticalVideoSlot;
