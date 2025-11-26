// src/components/FloorSelectDialog.tsx
import React, { useState } from 'react';

interface FloorSelectDialogProps {
  isOpen: boolean;
  initialFloor: string;
  onClose: () => void;
}

const FLOORS = ['1F', '2F', '3F', '4F'];

export const FloorSelectDialog: React.FC<FloorSelectDialogProps> = ({
  isOpen,
  initialFloor,
  onClose,
}) => {
  const [selected, setSelected] = useState(initialFloor);

  if (!isOpen) return null;

  const handleSave = () => {
    window.electronAPI?.setFloor(selected);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 420,
          borderRadius: 24,
          padding: '24px 28px 20px',
          background: 'rgba(15,17,26,0.96)',
          color: '#f5f5f7',
          boxShadow: '0 22px 60px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Floor selection</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Choose which floor to display as the default. Changes are applied immediately.
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {FLOORS.map((floor) => (
            <button
              key={floor}
              onClick={() => setSelected(floor)}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 12,
                border: selected === floor ? '1px solid #3ec7ff' : '1px solid rgba(255,255,255,0.18)',
                background:
                  selected === floor
                    ? 'linear-gradient(135deg, #27f0ff, #4294ff)'
                    : 'rgba(30,34,48,0.9)',
                color: selected === floor ? '#000' : '#f5f5f7',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {floor}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            fontSize: 13,
          }}
        >
          <button
            onClick={onClose}
            style={{
              minWidth: 80,
              height: 32,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: '#f5f5f7',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              minWidth: 96,
              height: 32,
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #3BF0FF, #4294FF)',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
