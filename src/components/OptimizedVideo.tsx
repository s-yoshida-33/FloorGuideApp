import React, { useEffect, useRef, forwardRef } from 'react';

interface OptimizedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export const OptimizedVideo = forwardRef<HTMLVideoElement, OptimizedVideoProps>(({ src, className, style, ...props }, ref) => {
  const innerRef = useRef<HTMLVideoElement>(null);
  
  // 外部からのrefと内部のrefを同期させる
  useEffect(() => {
    if (!ref) return;
    
    if (typeof ref === 'function') {
      ref(innerRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLVideoElement | null>).current = innerRef.current;
    }
  }, [ref]);

  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;
    
    // CPU負荷軽減のための設定
    video.preload = 'metadata';
    
    // 再生品質の調整（Chromiumの実験的機能）
    if ('requestVideoFrameCallback' in video) {
      const callback = () => {
        if (!video.paused) {
          (video as any).requestVideoFrameCallback(callback);
        }
      };
      (video as any).requestVideoFrameCallback(callback);
    }
  }, [src]);
  
  return (
    <video
      ref={innerRef}
      src={src}
      className={className}
      style={style}
      muted
      loop
      autoPlay
      playsInline
      // CPU負荷軽減のための属性
      disablePictureInPicture
      disableRemotePlayback
      {...props}
    />
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';
