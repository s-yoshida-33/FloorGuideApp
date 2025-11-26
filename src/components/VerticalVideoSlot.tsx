// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logInfo, logWarn, logError } from '../logging';

const VerticalVideoSlot: React.FC = () => {
  const { asset, isLoading } = useCurrentAsset();

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

  if (isImage) {
    // Render as image
    return (
      <img
        key={asset.id}
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
      key={asset.id}
      src={asset.src}
      autoPlay
      loop={false}
      playsInline
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
        logInfo('video', 'Video playback ended', {
          assetId: asset.id,
        });
      }}
      onError={() => {
        logError('video', 'Video element error (VerticalVideoSlot)', {
          assetId: asset.id,
          src: asset.src,
        });
      }}
    />
  );
};

export default VerticalVideoSlot;
