// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logInfo, logWarn, logError } from '../logs/logging';

interface VerticalVideoSlotProps {
  muted?: boolean;
}

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ muted = false }) => {
  const { asset, isLoading } = useCurrentAsset();
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

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('video', 'No video asset available for VerticalVideoSlot');
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

  // Determine if asset is an image
  // Check mediaType first, then fall back to file extension
  const isImage = asset.mediaType === 'image' || 
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));

  // Use both id and src in key to ensure remount when either changes
  const mediaKey = `${asset.id}-${asset.src}`;

  if (isImage) {
    // Render as image
    return (
      <img
        ref={imgRef}
        key={mediaKey}
        src={asset.src}
        alt={asset.name || 'Media'}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
        }}
        onLoad={() => {
          logInfo('image', 'Image loaded in VerticalVideoSlot', {
            assetId: asset.id,
            src: asset.src,
          });
        }}
        onError={() => {
          logError('image', 'Image element error (VerticalVideoSlot)', {
            assetId: asset.id,
            src: asset.src,
          });
        }}
      />
    );
  }

  // Render as video (default)
  return (
    <video
      ref={videoRef}
      key={mediaKey}
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
        logInfo('video', 'Video loaded in VerticalVideoSlot', {
          assetId: asset.id,
          src: asset.src,
        });
      }}
      onPlay={() => {
        logInfo('video', 'Video playback started', {
          assetId: asset.id,
        });
      }}
      onEnded={() => {
        logInfo('video', 'Video playback ended (will loop)', {
          assetId: asset.id,
        });
      }}
      onError={() => {
        logError('video', 'Video element error (VerticalVideoSlot)', {
          assetId: asset.id,
          src: asset.src,
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
