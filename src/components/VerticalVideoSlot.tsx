// src/components/VerticalVideoSlot.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logError, logDebug } from '../logs/logging';
import { OptimizedVideo } from './OptimizedVideo';
import type { CurrentAsset } from '../types/wsp';

interface VerticalVideoSlotProps {
  muted?: boolean;
}

// アセットが画像か動画かを判定
const isImageAsset = (asset: CurrentAsset | null): boolean => {
  if (!asset) return false;
  return asset.mediaType === 'image' || 
    !!(asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
};

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ muted = false }) => {
  const { asset: targetAsset, isLoading, nextAsset } = useCurrentAsset();
  
  // ダブルバッファリング用のステート
  // A/B どちらのスロットが現在アクティブ（表示中）か
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  
  // 各スロットに割り当てられたアセット
  const [slotAssets, setSlotAssets] = useState<{A: CurrentAsset | null, B: CurrentAsset | null}>({
    A: null,
    B: null
  });

  // ロード完了フラグ
  const [isLoaded, setIsLoaded] = useState<{A: boolean, B: boolean}>({
    A: false,
    B: false
  });

  // アセットロード完了時のハンドラ
  // 単にフラグを立てるだけにし、切り替え判断はuseEffectで行う
  const handleAssetReady = useCallback((slot: 'A' | 'B', assetId: string) => {
    setSlotAssets(currentAssets => {
      // 念のため、現在のアセットIDと一致しているか確認（古いロード完了通知を無視）
      if (currentAssets[slot]?.id === assetId) {
        setIsLoaded(prev => {
           if (prev[slot]) return prev; // 既にtrueなら変更しない
           logDebug('CMS_DELIVERY', `Slot ${slot} loaded asset ${assetId}`);
           return { ...prev, [slot]: true };
        });
      }
      return currentAssets;
    });
  }, []);

  // 初回表示時の処理: Aスロットに強制セット
  useEffect(() => {
    if (targetAsset && !slotAssets.A && !slotAssets.B) {
        setSlotAssets({ A: targetAsset, B: null });
        setActiveSlot('A');
    }
  }, [targetAsset, slotAssets.A, slotAssets.B]);

  // メインの制御ロジック（切り替え ＆ プリロード）
  useEffect(() => {
    const nextSlot = activeSlot === 'A' ? 'B' : 'A';
    
    // --- 1. ターゲットアセットの反映（切り替え） ---
    if (targetAsset) {
        const currentActive = slotAssets[activeSlot];
        
        // 現在表示中のものがターゲットと異なる場合（切り替えが必要）
        if (currentActive?.id !== targetAsset.id) {
            const currentBack = slotAssets[nextSlot];
            
            // 裏スロットにターゲットが入っているか確認
            if (currentBack?.id === targetAsset.id) {
                // 裏スロットにターゲットがある場合
                // ロード済みなら即切り替え
                if (isLoaded[nextSlot]) {
                     logDebug('CMS_DELIVERY', `Switching active slot to ${nextSlot} (Preloaded)`, { id: targetAsset.id });
                     setActiveSlot(nextSlot);
                }
                // 未ロードの場合は何もしない（ロード完了を待つ -> isLoadedが変わって再度ここに来る）
            } else {
                // 裏スロットにターゲットが入っていない場合（急な変更や初回など）
                // 即座にターゲットをセットしてロードを開始させる
                logDebug('CMS_DELIVERY', `Scheduling target ${targetAsset.id} to slot ${nextSlot}`);
                setSlotAssets(prev => ({ ...prev, [nextSlot]: targetAsset }));
                setIsLoaded(prev => ({ ...prev, [nextSlot]: false }));
            }
            
            // 切り替え処理中なので、プリロード処理はスキップしてreturnする
            return;
        }
    }

    // --- 2. プリロード（ターゲット処理が落ち着いている時） ---
    if (nextAsset && targetAsset) {
        // 現在アクティブなスロットが、正しくターゲットを表示している場合のみプリロードを行う
        // （切り替え待ちの間に次のプリロードを始めてしまうと競合するため）
        if (slotAssets[activeSlot]?.id === targetAsset.id) {
            const currentBack = slotAssets[nextSlot];
            
            // 裏スロットが「次のアセット」と異なる場合（空、または古いアセット）
            if (currentBack?.id !== nextAsset.id) {
                 // nextAsset用のオブジェクト作成（useCurrentAssetフック内と同様のパス構築）
                 const nextAssetSrc = `file:///C:/SignageData/assets/${nextAsset.filename}`;
                 const nextAssetObj: CurrentAsset = {
                    id: nextAsset.id,
                    src: nextAssetSrc,
                    name: nextAsset.name,
                    mediaType: nextAsset.mediaType,
                    duration: nextAsset.duration,
                    width: 0, height: 0, startTime: '', endTime: ''
                 };
                 
                 logDebug('CMS_DELIVERY', `Preloading next asset ${nextAsset.id} to slot ${nextSlot}`);
                 setSlotAssets(prev => ({ ...prev, [nextSlot]: nextAssetObj }));
                 setIsLoaded(prev => ({ ...prev, [nextSlot]: false }));
            }
        }
    }

  }, [targetAsset, nextAsset, activeSlot, slotAssets, isLoaded]);


  // レンダリング用ヘルパー
  const renderSlot = (slot: 'A' | 'B') => {
    const asset = slotAssets[slot];
    const isActive = slot === activeSlot;
    
    if (!asset) return null;

    const isImage = isImageAsset(asset);
    
    const style: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: isActive ? 1 : 0, 
      transition: 'opacity 0.2s linear',
      zIndex: isActive ? 2 : 1,
      visibility: 'visible',
    };

    // 非アクティブ（裏）のスロットは必ずミュートにする
    // これにより音声重複を防ぐ
    const isMuted = muted || !isActive;

    if (isImage) {
      return (
        <img
          key={`img-${asset.id}`}
          src={asset.src}
          alt={asset.name}
          style={style}
          onLoad={() => handleAssetReady(slot, asset.id)}
          onError={() => {
              logError('CMS_DELIVERY', 'Image load failed', { id: asset.id, src: asset.src });
              handleAssetReady(slot, asset.id); 
          }}
        />
      );
    } else {
      return (
        <OptimizedVideo
          key={`vid-${asset.id}`}
          src={asset.src}
          style={style}
          isActive={isActive} // アクティブ時のみ再生、裏ではポーズ（待機）
          muted={isMuted}
          onLoadedData={() => handleAssetReady(slot, asset.id)}
          onError={() => {
              logError('CMS_DELIVERY', 'Video load failed', { id: asset.id, src: asset.src });
              handleAssetReady(slot, asset.id);
          }}
        />
      );
    }
  };

  if (!targetAsset && !slotAssets.A && !slotAssets.B) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#666' }}>
        {isLoading ? 'Loading...' : 'No Content'}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      {renderSlot('A')}
      {renderSlot('B')}
    </div>
  );
};

export default VerticalVideoSlot;
