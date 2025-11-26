// src/components/TopMenuBar.tsx
import React from 'react';
import type { CSSWithDrag } from '../types/CSSWithDrag';

interface TopMenuBarProps {
  onOpenFloorSelect: () => void;
  onOpenFloorLayout: () => void;
  onOpenLocationIconSettings: () => void;
}

const MenuButton: React.FC<{
    onClick?: () => void;
    children: React.ReactNode;
  }> = ({ onClick, children }) => {
    const [hover, setHover] = React.useState(false);

    const baseButtonStyle: CSSWithDrag = {
        padding: '0 12px',
        height: 30,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 6,
        fontSize: 13,
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        WebkitAppRegion: 'no-drag',
        transition: 'background 120ms ease-out, color 120ms ease-out',
    };
    
    const style: CSSWithDrag = {
        ...baseButtonStyle,
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: '#f5f5f7',
    };
    
    return (
        <button
          type="button"
          style={style}
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {children}
        </button>
    );
};

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  onOpenFloorSelect,
  onOpenFloorLayout,
  onOpenLocationIconSettings,
}) => {
  const containerStyle: CSSWithDrag = {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    background: 'rgba(20, 22, 30, 0.96)',
    color: '#f5f5f7',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    WebkitAppRegion: 'drag',
  };

  const titleBlockStyle: CSSWithDrag = {
    marginRight: 8,
    paddingRight: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRight: '1px solid rgba(255, 255, 255, 0.12)',
    WebkitAppRegion: 'no-drag',
  };

  const logoStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 6,
    background:
      'radial-gradient(circle at 20% 0%, #3BF0FF, transparent 60%), radial-gradient(circle at 80% 100%, #4294FF, transparent 55%)',
    boxShadow: '0 0 12px rgba(59, 240, 255, 0.85)',
  };

  const separatorStyle: CSSWithDrag = {
    width: 1,
    height: 18,
    margin: '0 4px',
    background: 'rgba(255, 255, 255, 0.12)',
    WebkitAppRegion: 'no-drag',
  };

  return (
    <div style={containerStyle}>
      {/* Left side: App name */}
      <div style={titleBlockStyle}>
        <div style={logoStyle} />
        <span style={{ fontSize: 12, opacity: 0.8 }}>FloorGuideDisplay</span>
      </div>

      {/* Menu group */}
      <MenuButton onClick={onOpenFloorSelect}>Floor</MenuButton>
      <MenuButton onClick={onOpenFloorLayout}>ShopList layout</MenuButton>
      <MenuButton onClick={onOpenLocationIconSettings}>Location icon</MenuButton>

      <div style={separatorStyle} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right-side action */}
      <MenuButton onClick={() => window.electronAPI?.manualUpdateCheck()}>
        Check for updates
      </MenuButton>
      <MenuButton onClick={() => window.electronAPI?.oneClickUpdate()}>
        Update now
      </MenuButton>
      <MenuButton onClick={() => window.electronAPI?.quitApp()}>Quit</MenuButton>
    </div>
  );
};
