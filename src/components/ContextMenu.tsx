import React, { useEffect, useState, useCallback } from 'react';
import { exit } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';

interface ContextMenuProps {
  onOpenSettings: () => void;
  onOpenVersionInfo: () => void;
  children: React.ReactNode;
}

type Position = { x: number; y: number };

export const ContextMenu: React.FC<ContextMenuProps> = ({
  onOpenSettings,
  onOpenVersionInfo,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  const hideMenu = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
      setVisible(true);
    };

    const handleClick = () => hideMenu();

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
    };
  }, [hideMenu]);

  const reloadApp = useCallback(() => {
    window.location.reload();
  }, []);

  const quitApp = useCallback(async () => {
    await exit(0);
  }, []);

  const minimizeWindow = useCallback(async () => {
    await invoke('minimize_window');
  }, []);

  type MenuItem = { label: string; action: () => void; separator?: boolean };
  const items: MenuItem[] = [
    { label: '設定', action: onOpenSettings, separator: true },
    { label: 'リロード', action: reloadApp },
    { label: 'バージョン情報', action: onOpenVersionInfo, separator: true },
    { label: '最小化', action: minimizeWindow },
    { label: '終了', action: quitApp },
  ];

  return (
    <>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            backgroundColor: '#1c1c1c',
            color: '#f8f8f8',
            border: '1px solid #333',
            borderRadius: 4,
            minWidth: 220,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                hideMenu();
                item.action();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                backgroundColor: 'transparent',
                color: '#f8f8f8',
                border: 'none',
                borderBottom: index === items.length - 1 ? 'none'
                  : item.separator ? '1px solid #444'
                  : '1px solid #2a2a2a',
                cursor: 'pointer',
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
