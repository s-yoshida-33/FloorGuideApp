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

  // srcが変わった時の処理（属性設定のみ）
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;
    
    // CPU負荷軽減のための設定
    video.preload = 'metadata';
  }, [src]);

  // マウント/アンマウント時の処理（クリーンアップのみ）
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;

    // クリーンアップ処理: コンポーネントが完全に破棄される時だけ実行する
    // ※srcの変更時には実行されないように依存配列を空にする
    return () => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load(); // 読み込みをリセットして完全に停止させる
      } catch (e) {
        console.warn('Video cleanup failed:', e);
      }
    };
  }, []);
  
  return (
    <video
      ref={innerRef}
      src={src}
      className={className}
      style={style}
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
