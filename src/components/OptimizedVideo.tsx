import React, { useEffect, useRef, forwardRef } from 'react';

interface OptimizedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  isActive?: boolean;
}

export const OptimizedVideo = forwardRef<HTMLVideoElement, OptimizedVideoProps>(({ 
  src, 
  className, 
  style, 
  isActive = true, // デフォルトはアクティブ
  ...props 
}, ref) => {
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

  // アクティブ状態の変更監視
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;

    if (isActive) {
      // 表示中は再生を試みる
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // 自動再生ポリシーなどで失敗する可能性はあるが、サイネージ用途なら通常OK
          // console.debug('Auto-play prevented:', error);
        });
      }
    } else {
      // 非表示中は停止してCPU/GPU負荷を下げる
      video.pause();
    }
  }, [isActive]);

  // srcが変わった時の処理
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;
    
    // CPU負荷軽減のための設定
    // ※ダブルバッファリングの裏読み込み時は 'auto' にしてロードを進める
    // isActiveに関わらずロードは必要
    video.preload = 'auto';
    
    // srcが変わったらロードを開始する
    // isActive=trueなら上のuseEffectで再生される
    // isActive=falseならロードだけ行われる（はず）
  }, [src]);

  // マウント/アンマウント時の処理（クリーンアップのみ）
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;

    // クリーンアップ処理: コンポーネントが完全に破棄される時だけ実行する
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
      muted // デフォルトでミュート（propsで上書き可能だが、ブラウザポリシー的に安全）
      loop
      playsInline
      // CPU負荷軽減のための属性
      disablePictureInPicture
      disableRemotePlayback
      // isActiveがfalseならautoPlayさせない
      autoPlay={isActive} 
      {...props}
    />
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';
