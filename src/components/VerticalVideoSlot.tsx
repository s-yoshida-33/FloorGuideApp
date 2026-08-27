// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logInfo, logWarn, logError, logDebug } from '../logs/logging';
import { OptimizedVideo } from './OptimizedVideo';
import { useAudioSettingsContext } from '../contexts/AudioSettingsContext';

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const FREEZE_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 60000;
const MAX_RECREATE_COUNT = 3;

// 縦型・横型配信枠の基準値
const LINK_CONTENT_W = 1080;
const LINK_CONTENT_H = 1920;

// Returns true for external URLs (http or https) while excluding localhost
const isExternalLinkUrl = (src: string | undefined): boolean =>
  !!src &&
  /^https?:\/\//i.test(src) &&
  !/^https?:\/\/localhost(:\d+)?/i.test(src) &&
  !/^https?:\/\/127\./i.test(src);

const isImageAsset = (asset: any): boolean => 
  !!asset && (asset.mediaType === 'image' || (!!asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)([\?#].*)?$/i.test(asset.src)));

const isVideoAsset = (asset: any): boolean => 
  !!asset && (asset.mediaType === 'video' || (!!asset.src && /\.(mp4|webm|ogg|mov)([\?#].*)?$/i.test(asset.src)));

const isLinkAsset = (asset: any): boolean =>
  !!asset && (
    asset.mediaType === 'link' ||
    (isExternalLinkUrl(asset.src) && !isImageAsset(asset) && !isVideoAsset(asset))
  );

// WEB連携コンテンツ(dump_html webfeed)。CMS上はMedia種別`zip`として配信される
// (Gido Issue #36)。プレイヤー側が展開済みのindex.htmlをiframeで表示する点はisLinkAssetと同じ。
const isWebFeedAsset = (asset: any): boolean =>
  !!asset && asset.mediaType === 'zip';

// iframeレイヤーで描画するアセット全般(外部リンクURL + WEB連携コンテンツ)
const isIframeContentAsset = (asset: any): boolean =>
  isLinkAsset(asset) || isWebFeedAsset(asset);

// WEB連携コンテンツの展開先index.htmlが存在するまで最大約7.7秒リトライで待つ
// (検証観点1: SSEイベント到達時点でプレイヤー側の展開が完了しているとは限らないため)
const WEBFEED_CHECK_RETRY_DELAYS_MS = [200, 500, 1000, 2000, 4000];

async function waitForWebFeedEntry(rawPath: string | undefined, assetId: string): Promise<boolean> {
  if (!rawPath) {
    logError('WEBFEED', 'WEB連携コンテンツのrawPathが無いため存在確認をスキップ', { assetId });
    return false;
  }
  for (let attempt = 0; attempt <= WEBFEED_CHECK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const exists = await invoke<boolean>('webfeed_entry_exists', { path: rawPath });
      if (exists) {
        // logInfo(logDebugではなく): 本番ビルドではlogDebugが完全に無効化されるため、
        // 検証観点1〜3の実機ログ確認にはlogInfo以上が必須(Gido Issue #36で判明)
        if (attempt > 0) {
          logWarn('WEBFEED', 'WEB連携コンテンツの展開先ファイルがリトライ後に出現(検証観点1)', { assetId, rawPath, attempt });
        } else {
          logInfo('WEBFEED', 'WEB連携コンテンツの展開先ファイルを確認', { assetId, rawPath });
        }
        return true;
      }
    } catch (err) {
      logError('WEBFEED', '展開先ファイルの存在確認呼び出しに失敗', {
        assetId, rawPath, attempt, error: err instanceof Error ? err.message : String(err),
      });
    }
    if (attempt < WEBFEED_CHECK_RETRY_DELAYS_MS.length) {
      await new Promise(resolve => setTimeout(resolve, WEBFEED_CHECK_RETRY_DELAYS_MS[attempt]));
    }
  }
  logError('WEBFEED', 'WEB連携コンテンツの展開先ファイルが見つからない(検証観点2: 命名規則を要確認)', { assetId, rawPath });
  return false;
}

const VerticalVideoSlot: React.FC = () => {
  const { audioSettings } = useAudioSettingsContext();
  const muted = audioSettings.cmsMuted;
  const { asset, nextAsset, isLoading, isScheduleTransitioning } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
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
  const [iframeAssetId, setIframeAssetId] = React.useState<string | null>(null);
  const [iframeActive, setIframeActive] = React.useState(false);

  // プリロードの重複実行を防ぐための「スロット記憶用Ref」
  const lastPreloadedSlotRef = React.useRef<string>('');

  // 1. 次のアセットがURL/WEB連携コンテンツだと判明した瞬間に裏側で事前読み込みを開始する
  // (※どちらもロードに時間がかかるため、引き続きプリロードを行います。WEB連携コンテンツは
  // 展開先ファイルの存在確認が取れてからiframeへ読み込む)
  React.useEffect(() => {
    if (isIframeContentAsset(asset)) return;

    if (nextAsset && isIframeContentAsset(nextAsset)) {
      const slotKey = `${asset?.id || 'null'}-${asset?.startTime || 'null'}-${nextAsset.id}`;

      if (lastPreloadedSlotRef.current !== slotKey) {
        lastPreloadedSlotRef.current = slotKey;

        const activate = () => {
          const targetSrc = nextAsset.src as string;
          // WEB連携コンテンツ(ローカルのTauri asset protocol)にはキャッシュバスターのクエリ文字列を
          // 付けない。実URL(link)と違いローカルファイルには不要な上、Tauriのasset protocolが
          // クエリ文字列付きのパスを正しく解決できるとは限らないため(展開先自体がsyncごとに
          // 新しいUUIDディレクトリになるので、そもそもキャッシュバスターが無くても問題ない)
          const srcToUse = isWebFeedAsset(nextAsset)
            ? targetSrc
            : (() => {
                const ts = Date.now();
                return targetSrc.includes('?') ? `${targetSrc}&_ts=${ts}` : `${targetSrc}?_ts=${ts}`;
              })();
          setIframeSrc(srcToUse);
          setIframeAssetId(nextAsset.id);
        };

        if (isWebFeedAsset(nextAsset)) {
          logInfo('WEBFEED', 'WEB連携コンテンツのプリロードを開始', { slotKey, rawPath: nextAsset.rawPath, src: nextAsset.src });
          waitForWebFeedEntry(nextAsset.rawPath, nextAsset.id).then(exists => {
            if (exists) activate();
          });
        } else {
          logDebug('CMS_DELIVERY', 'Preloading link content for upcoming slot', { slotKey, src: nextAsset.src });
          activate();
        }
      }
    }
  }, [asset?.id, asset?.startTime, nextAsset?.id, nextAsset?.src]);

  // 2. ブラウザが描画する直前に、iframeを前面（アクティブ）に切り替える
  // WEB連携コンテンツはプリロードが間に合わなかった場合に備え、活性化前に展開先ファイルの
  // 存在を再確認する(未確認のまま前面化すると空白/壊れたiframeが表示されてしまうため)
  React.useLayoutEffect(() => {
    if (!asset) { setIframeActive(false); return; }

    if (isLinkAsset(asset)) {
      if (iframeAssetId !== asset.id || !iframeSrc) {
        const ts = Date.now();
        const srcWithTs = asset.src.includes('?') ? `${asset.src}&_ts=${ts}` : `${asset.src}?_ts=${ts}`;
        setIframeSrc(srcWithTs);
        setIframeAssetId(asset.id);
      }
      setIframeActive(true);
      return;
    }

    if (isWebFeedAsset(asset)) {
      if (iframeAssetId === asset.id && iframeSrc) {
        // プリロード側で既に存在確認済み
        logInfo('WEBFEED', 'WEB連携コンテンツiframeを前面化(プリロード済み)', {
          assetId: asset.id, iframeSrc, containerSize,
        });
        setIframeActive(true);
        return;
      }
      setIframeActive(false);
      let cancelled = false;
      waitForWebFeedEntry(asset.rawPath, asset.id).then(exists => {
        if (cancelled || !exists) return;
        // キャッシュバスター無し(理由は上のpreload effect内コメント参照)
        logInfo('WEBFEED', 'WEB連携コンテンツiframeを前面化(プリロード未完了のため即時確認)', {
          assetId: asset.id, iframeSrc: asset.src, containerSize,
        });
        setIframeSrc(asset.src);
        setIframeAssetId(asset.id);
        setIframeActive(true);
      });
      return () => { cancelled = true; };
    }

    setIframeActive(false);
  }, [asset?.id, asset?.mediaType, asset?.src, iframeAssetId, iframeSrc]);

  // 3. 今のコンテンツも次のコンテンツもiframe対象でなくなった場合、速やかにiframeを破棄してメモリを空ける
  React.useEffect(() => {
    if (!isIframeContentAsset(asset) && !isIframeContentAsset(nextAsset)) {
      setIframeSrc(null);
      setIframeAssetId(null);
    }
  }, [asset?.id, asset?.src, nextAsset?.id, nextAsset?.src]);

  // Unmount cleanup
  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current !== undefined) window.clearTimeout(retryTimerRef.current);
      if (freezeTimerRef.current !== undefined) window.clearInterval(freezeTimerRef.current);
      if (healthCheckTimerRef.current !== undefined) window.clearInterval(healthCheckTimerRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
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
    const isIframeContent = isIframeContentAsset(asset);
    if (isImage || isIframeContent) return;

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
    const isIframeContent = isIframeContentAsset(asset);
    if (isImage || isIframeContent) return;

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
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.src]);

  // Log when no active content is scheduled
  React.useEffect(() => {
    if (!asset && !isLoading) {
      logWarn('CMS_DELIVERY', 'No active content scheduled', { component: 'VerticalVideoSlot' });
    }
  }, [asset, isLoading]);

  // Compute CSS transform to scale link content into the container
  const isLandscape = containerSize.width > containerSize.height;
  const targetW = isLandscape ? 1920 : LINK_CONTENT_W;
  const targetH = isLandscape ? 1080 : LINK_CONTENT_H;

  let iframeTransform: string | undefined;
  if (containerSize.width > 0 && containerSize.height > 0) {
    const scale = Math.min(containerSize.width / targetW, containerSize.height / targetH);
    const tx = (containerSize.width - targetW * scale) / 2;
    const ty = (containerSize.height - targetH * scale) / 2;
    iframeTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  const isImage = isImageAsset(asset);
  const isIframeContent = isIframeContentAsset(asset);

  return (
    <div
      ref={outerContainerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
    >
      {/* Link content / WEB連携コンテンツ iframe. */}
      {iframeSrc && (
        <iframe
          key={`iframe-${iframeSrc}`}
          src={iframeSrc}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: `${targetW}px`, height: `${targetH}px`,
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

      {/* Video & Image layer */}
      {!iframeActive && !isIframeContent && (
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
          )}
        </div>
      )}
    </div>
  );
};

export default VerticalVideoSlot;