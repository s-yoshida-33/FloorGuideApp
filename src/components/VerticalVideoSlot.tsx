// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';

const VerticalVideoSlot: React.FC = () => {
  const { asset, isLoading } = useCurrentAsset();

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
        {isLoading ? 'Loading…' : 'No conected.'}
      </div>
    );
  }

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
    />
  );
};

export default VerticalVideoSlot;
