// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { SpoutCanvas } from './SpoutCanvas';

/**
 * VerticalVideoSlot - Wonder Flow映像表示スロット
 * 
 * Spout経由でWonder Flowから受信した映像をCanvasに表示する。
 * CMS動画再生（OptimizedVideo）は廃止済み。
 */
const VerticalVideoSlot: React.FC = () => {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      <SpoutCanvas style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }} />
    </div>
  );
};

export default VerticalVideoSlot;
