// src/components/BlackScreenOverlay.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { BlackScreenSettings } from '../types/blackScreenSettings';
import { shouldShowBlackScreen } from '../types/blackScreenSettings';

interface BlackScreenOverlayProps {
  settings: BlackScreenSettings;
  /** 設定画面を開くコールバック */
  onOpenSettings: () => void;
  /** 設定画面が開いている場合は暗転を表示しない */
  isSettingsOpen: boolean;
  /** ブラックスクリーンの表示状態が変わったときに通知 */
  onBlackScreenChange?: (active: boolean) => void;
}

/**
 * ブラックスクリーンオーバーレイ
 *
 * 設定された時間帯外は画面全体を黒で覆う。
 * - 右クリックで「設定を開く」「一時解除」メニューを表示
 * - 一時解除は手動で再ロックするまで有効
 */
const BlackScreenOverlay: React.FC<BlackScreenOverlayProps> = ({
  settings,
  onOpenSettings,
  isSettingsOpen,
  onBlackScreenChange,
}) => {
  const [isBlack, setIsBlack] = useState(false);
  const [isTemporarilyUnlocked, setIsTemporarilyUnlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 毎10秒チェックして暗転状態を更新
  useEffect(() => {
    const check = () => {
      const black = shouldShowBlackScreen(settings);
      setIsBlack(black);

      // 点灯時間帯に入ったら一時解除フラグをリセット
      if (!black) {
        setIsTemporarilyUnlocked(false);
      }
    };

    check();
    const interval = setInterval(check, 10_000); // 10秒ごとにチェック
    return () => clearInterval(interval);
  }, [settings]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!showMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowMenu(false);
    setIsTemporarilyUnlocked(true); // 設定画面を開くために一時解除
    onOpenSettings();
  }, [onOpenSettings]);

  const handleTemporaryUnlock = useCallback(() => {
    setShowMenu(false);
    setIsTemporarilyUnlocked(true);
  }, []);

  const handleRelock = useCallback(() => {
    setShowMenu(false);
    setIsTemporarilyUnlocked(false);
  }, []);

  // 表示条件: 暗転すべき & 一時解除されていない & 設定画面が閉じている
  const shouldShow = isBlack && !isTemporarilyUnlocked && !isSettingsOpen;

  // ブラックスクリーン表示状態を親に通知（音声ミュート連携用）
  useEffect(() => {
    onBlackScreenChange?.(shouldShow);
    return () => onBlackScreenChange?.(false);
  }, [shouldShow, onBlackScreenChange]);

  if (!shouldShow) {
    // 一時解除中の場合、再ロックボタンを表示
    if (isBlack && isTemporarilyUnlocked && !isSettingsOpen) {
      return (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 99998,
          }}
        >
          <button
            onClick={handleRelock}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#ff6b6b',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'opacity 0.2s',
            }}
            title="ブラックスクリーンを再適用"
          >
            暗転を再適用
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000000',
        zIndex: 99990,
        cursor: 'default',
      }}
    >
      {/* 右クリックメニュー */}
      {showMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.y,
            left: menuPos.x,
            backgroundColor: '#2c2c2c',
            border: '1px solid #555',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 99991,
            minWidth: 180,
            overflow: 'hidden',
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <button
            onClick={handleOpenSettings}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              borderBottom: '1px solid #444',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#3a3a3a'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            設定を開く
          </button>
          <button
            onClick={handleTemporaryUnlock}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#34C759',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#3a3a3a'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            一時的に解除
          </button>
        </div>
      )}
    </div>
  );
};

export default BlackScreenOverlay;
