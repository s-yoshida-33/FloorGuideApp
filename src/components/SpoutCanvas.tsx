import React, { useEffect, useRef } from 'react';

type SpoutFrame = {
  buffer: Uint8Array;
  width: number;
  height: number;
  isMock?: boolean;
};

interface SpoutCanvasProps {
  style?: React.CSSProperties;
}

export const SpoutCanvas: React.FC<SpoutCanvasProps> = ({ style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const lastFrameTimeRef = useRef<number>(0);
  const watchdogRef = useRef<number | null>(null);

  useEffect(() => {
    // リサイズ処理用のオフスクリーンCanvasを作成（メモリバッファ用）
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
    }

    const api = window.electronAPI;
    if (!api || !api.onSpoutFrame) {
      console.warn('SpoutCanvas: Electron API not available');
      return;
    }

    const handleFrame = (data: SpoutFrame) => {
      lastFrameTimeRef.current = Date.now();
      if (!isVisible) setIsVisible(true);

      const canvas = canvasRef.current;
      const offscreen = offscreenRef.current;
      if (!canvas || !offscreen) return;
      
      const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false で高速化
      const offCtx = offscreen.getContext('2d');
      if (!ctx || !offCtx) return;

      // 1. 受信データに合わせてオフスクリーンCanvasをリサイズ
      if (offscreen.width !== data.width || offscreen.height !== data.height) {
        offscreen.width = data.width;
        offscreen.height = data.height;
      }

      // 2. バッファデータをImageDataとしてオフスクリーンCanvasに描画
      try {
        const imageData = new ImageData(
          new Uint8ClampedArray(data.buffer), 
          data.width, 
          data.height
        );
        offCtx.putImageData(imageData, 0, 0);
      } catch (e) {
        console.error('SpoutCanvas: Failed to putImageData', e);
        return;
      }

      // 3. メインCanvasに描画 (object-fit: cover 相当の計算)
      // 表示先のCanvasサイズ（現在サイズ）
      // const destW = canvas.width;
      // const destH = canvas.height;
      
      // ソースのアスペクト比
      const srcAspect = data.width / data.height;
      // ターゲットのアスペクト比
      // const destAspect = destW / destH;

      // let drawW, drawH, startX, startY;

      /*
      if (srcAspect > destAspect) {
        // ソースの方が横長 -> 左右をカット
        drawH = destH;
        drawW = destH * srcAspect;
        startY = 0;
        startX = (destW - drawW) / 2;
      } else {
        // ソースの方が縦長 -> 上下をカット（またはフィット）
        drawW = destW;
        drawH = destW / srcAspect;
        startX = 0;
        startY = (destH - drawH) / 2;
      }
      */
      
      // ここでは Canvas の解像度自体を描画領域に合わせるかどうか？
      // 高解像度を維持するなら canvas.width/height を大きく保つべきだが、
      // ここでは CSS でサイズが決まっているので、描画解像度は固定（例: 1080x1920）にしたい。
      // しかし、Canvas要素のwidth/height属性が設定されていないとデフォルト300x150になる。
      
      // 初期化時にCanvas解像度を設定（またはpropsで受け取る）
      // ここでは、ソースサイズ（data.width/height）またはターゲット想定サイズ（1080x1920）に合わせる
      // 毎回設定すると重いので、変更時のみ
      if (canvas.width !== 1080 || canvas.height !== 1920) {
         canvas.width = 1080;
         canvas.height = 1920;
         // リセットされたコンテキストを再取得する必要があるかもだが、2dコンテキストは維持されることが多い
      }

      // 再計算（解像度 1080x1920 固定前提）
      // ソース全体を 1080x1920 に描画（アスペクト比維持・中央トリミング）
      const cW = 1080;
      const cH = 1920;
      const cAspect = cW / cH;
      
      let sX, sY, sW, sH;
      
      if (srcAspect > cAspect) {
        // ソースが横長（例: 1920x1080） -> 左右カットして中央を使う
        sH = data.height;
        sW = data.height * cAspect; // 1080 * (1080/1920) = 607.5
        sY = 0;
        sX = (data.width - sW) / 2;
      } else {
        // ソースが縦長（例: 1080x1920） -> そのまま、あるいは上下カット
        sW = data.width;
        sH = data.width / cAspect;
        sX = 0;
        sY = (data.height - sH) / 2;
      }
      
      // クリア
      // ctx.clearRect(0, 0, cW, cH); // putImageData/drawImageで上書きするなら不要
      
      // 描画
      ctx.drawImage(
        offscreen, 
        sX, sY, sW, sH, // Source crop
        0, 0, cW, cH    // Dest rect
      );
      
      if (data.isMock) {
         // モック用のデバッグ表示
         ctx.fillStyle = 'white';
         ctx.font = '40px sans-serif';
         ctx.fillText('Spout Mock', 50, 100);
      }
    };

    const unsubscribe = api.onSpoutFrame(handleFrame);

    // Watchdog timer (check every 500ms)
    watchdogRef.current = window.setInterval(() => {
      const now = Date.now();
      if (now - lastFrameTimeRef.current > 500) {
        if (isVisible) setIsVisible(false);
      }
    }, 500);

    return () => {
      unsubscribe();
      if (watchdogRef.current) clearInterval(watchdogRef.current);
    };
  }, [isVisible]); // isVisible依存を追加

  return (
    <canvas 
      ref={canvasRef} 
      width={1080}
      height={1920}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'contain', 
        opacity: isVisible ? 1 : 0, // フェード切り替え
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'none', // クリック透過
        ...style 
      }} 
    />
  );
};
