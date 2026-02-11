import React, { useEffect, useRef, useCallback } from 'react';

type SpoutFrame = {
  buffer: Uint8Array;
  width: number;
  height: number;
};

interface SpoutCanvasProps {
  style?: React.CSSProperties;
}

/**
 * SpoutCanvas - Spout 受信フレームをピクセルパーフェクトに描画するコンポーネント
 *
 * パフォーマンス最適化:
 * 1. ゼロコピーバッファ参照: Uint8Array → Uint8ClampedArray のビュー変換でコピーを回避
 * 2. requestAnimationFrame 同期: ディスプレイのリフレッシュレートに合わせて描画
 * 3. フレームドロップ: rAF 間に複数フレーム到着時は最新のみ描画
 * 4. ImageData 再利用: 同一解像度ならオブジェクト再生成を回避
 */
export const SpoutCanvas: React.FC<SpoutCanvasProps> = ({ style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isVisibleRef = useRef(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const lastFrameTimeRef = useRef<number>(0);
  const watchdogRef = useRef<number | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // rAF 用の状態管理
  const latestFrameRef = useRef<SpoutFrame | null>(null);
  const rafIdRef = useRef<number>(0);

  // 再利用可能な ImageData（同一解像度間でバッファを使い回す）
  const imageDataRef = useRef<ImageData | null>(null);
  const imageDimsRef = useRef({ width: 0, height: 0 });

  // Canvas のコンテキストを取得・キャッシュ
  const getCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctxRef.current = ctx;
    }
    return ctx;
  }, []);

  // rAF コールバック: 最新フレームのみ描画
  const renderFrame = useCallback(() => {
    rafIdRef.current = 0;

    const data = latestFrameRef.current;
    if (!data) return;
    latestFrameRef.current = null; // 消費済み

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas 解像度を sender の解像度に合わせる（変更時のみ）
    if (canvas.width !== data.width || canvas.height !== data.height) {
      canvas.width = data.width;
      canvas.height = data.height;
      ctxRef.current = null;
      imageDataRef.current = null; // 解像度変更時は ImageData も再作成
    }

    const ctx = getCtx();
    if (!ctx) return;

    try {
      // ゼロコピー: Uint8Array の underlying ArrayBuffer をそのまま参照
      // new Uint8ClampedArray(typedArray) はコピーが発生するが、
      // new Uint8ClampedArray(buffer, offset, length) はビュー（参照）のみ
      const ab = data.buffer.buffer as ArrayBuffer;
      const clamped = new Uint8ClampedArray(
        ab,
        data.buffer.byteOffset,
        data.buffer.byteLength
      );

      // ImageData を解像度が同じなら再利用（GC 圧を低減）
      if (
        imageDataRef.current &&
        imageDimsRef.current.width === data.width &&
        imageDimsRef.current.height === data.height
      ) {
        // 既存 ImageData のバッファに書き込み
        imageDataRef.current.data.set(clamped);
      } else {
        // 新規作成（初回 or 解像度変更時）
        imageDataRef.current = new ImageData(clamped, data.width, data.height);
        imageDimsRef.current = { width: data.width, height: data.height };
      }

      ctx.putImageData(imageDataRef.current, 0, 0);
    } catch (e) {
      console.error('SpoutCanvas: Failed to putImageData', e);
    }
  }, [getCtx]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !api.onSpoutFrame) {
      console.warn('SpoutCanvas: Electron API not available');
      return;
    }

    const handleFrame = (data: SpoutFrame) => {
      lastFrameTimeRef.current = Date.now();

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }

      // 最新フレームをバッファに格納
      // rAF 前に複数フレームが到着した場合、古いフレームは自動的にドロップ
      latestFrameRef.current = data;

      // rAF がまだスケジュールされていなければスケジュール
      // → ディスプレイのリフレッシュレートに同期した描画
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
      }
    };

    const unsubscribe = api.onSpoutFrame(handleFrame);

    // Watchdog: フレームが途絶えたら非表示にする
    watchdogRef.current = window.setInterval(() => {
      if (Date.now() - lastFrameTimeRef.current > 500) {
        if (isVisibleRef.current) {
          isVisibleRef.current = false;
          setIsVisible(false);
        }
      }
    }, 500);

    return () => {
      unsubscribe();
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      ctxRef.current = null;
      imageDataRef.current = null;
    };
  }, [renderFrame]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        imageRendering: 'auto',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'none',
        ...style
      }}
    />
  );
};
