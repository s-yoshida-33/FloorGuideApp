// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logWarn, logError, logDebug } from '../logs/logging';
import { OptimizedVideo } from './OptimizedVideo';

interface VerticalVideoSlotProps {
  muted?: boolean;
}

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ muted = false }) => {
  const { asset, isLoading, deviceCode } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);

  // Reset media element when asset changes
  React.useEffect(() => {
    if (asset && asset.id !== prevAssetIdRef.current) {
      // Asset changed - reset media elements
      if (videoRef.current) {
        videoRef.current.load(); // Force reload
      }
      if (imgRef.current) {
        imgRef.current.src = asset.src; // Force reload
      }
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.src]);

  // Report missing asset once
  React.useEffect(() => {
    if (!asset && !isLoading) {
      logWarn('CMS_DELIVERY', 'No active content scheduled', { component: 'VerticalVideoSlot', deviceCode });
    }
  }, [asset, isLoading, deviceCode]);

  // No asset case
  if (!asset) {
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
        {isLoading ? 'Loading…' : 'No connected.'}
      </div>
    );
  }

  // Determine if asset is an image
  // Check mediaType first, then fall back to file extension
  const isImage = asset.mediaType === 'image' || 
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));

  if (isImage) {
    // Render as image
    return (
      <img
        ref={imgRef}
        key={`img-${asset.id}`} // Remount on image change is cheap and safer
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
      // Don't use key based on asset ID to prevent unmounting/remounting the video element.
      // This allows the video element to be reused, reducing CPU spikes during switching.
      // The src prop update is handled by the video element itself.
      key="video-player" 
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
      onLoadedData={() => {
        logDebug('CMS_DELIVERY', 'Content video ready', {
          assetId: asset.id,
          src: asset.src,
          type: 'VIDEO'
        });
      }}
      onPlay={() => {
        logDebug('CMS_DELIVERY', 'Video playback started', {
          assetId: asset.id,
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
          error: videoRef.current?.error?.message
        });
        // Try to reload on error
        if (videoRef.current) {
          setTimeout(() => {
            if (videoRef.current && asset.src) {
              videoRef.current.load();
            }
          }, 1000);
        }
      }}
    />
  );
};

export default VerticalVideoSlot;
