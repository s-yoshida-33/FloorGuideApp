import React, { useEffect, useState } from "react";
import type {
  LocationIconSettings,
  IconPositionConfig,
} from "../types/locationIcon";

interface Props {
  settings: LocationIconSettings;
  onChangeSettings: (next: LocationIconSettings) => void;
  onSave: (next: LocationIconSettings) => Promise<void> | void;
  onCancel: () => void;
}

interface SectionProps {
  label: string;
  config: IconPositionConfig;
  onChange: (next: IconPositionConfig) => void;
}

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));

const clampRotation = (value: number) => {
  const v = Number.isNaN(value) ? 0 : value;
  if (v < 0) return 0;
  if (v > 360) return 360;
  return v;
};

const IconConfigSection: React.FC<SectionProps> = ({
  label,
  config,
  onChange,
}) => {
  const update = (partial: Partial<IconPositionConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <fieldset
      style={{
        border: "1px solid #ddd",
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <legend style={{ fontWeight: 700 }}>{label}</legend>

      <label style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ marginRight: 8 }}
        />
        <span>Enabled</span>
      </label>

      {/* Position */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>X position (%)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercent(Number(e.target.value)) })
              }
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercent(Number(e.target.value)) })
              }
              style={{ width: 70 }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Y position (%)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercent(Number(e.target.value)) })
              }
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercent(Number(e.target.value)) })
              }
              style={{ width: 70 }}
            />
          </div>
        </div>
      </div>

      {/* Size & rotation */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Size (px)</div>
          <input
            type="number"
            min={1}
            max={512}
            step={0.1}
            value={config.size}
            onChange={(e) =>
              update({
                size: Math.max(1, Math.min(512, Number(e.target.value) || 1)),
              })
            }
            style={{ width: 100 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Rotation (°)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{ width: 70 }}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
};

const LocationIconSettingsScreen: React.FC<Props> = ({
  settings,
  onChangeSettings,
  onSave,
  onCancel,
}) => {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Window position (fixed)
  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  // Subscribe to "open-location-icon-settings" from Electron
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenLocationIconSettings) {
      unsubscribe = window.electronAPI.onOpenLocationIconSettings(() => {
        // Center-ish default position when opening
        const width = 560;
        const height = 420; // rough estimate
        const left = Math.max(20, (window.innerWidth - width) / 2);
        const top = Math.max(20, (window.innerHeight - height) / 2);
        setWindowPos({ left, top });
        setVisible(true);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  const handleCancelClick = () => {
    onCancel();
    handleClose();
  };

  const handleSaveClick = async () => {
    try {
      setSaving(true);
      await onSave(settings);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (
    key: keyof LocationIconSettings,
    next: IconPositionConfig
  ) => {
    onChangeSettings({
      ...settings,
      [key]: next,
    });
  };

  // Drag logic for window (drag by header)
  const handleDragMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;

    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...windowPos };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextLeft = startPos.left + dx;
      const nextTop = startPos.top + dy;

      setWindowPos({
        left: Math.max(0, Math.min(window.innerWidth - 200, nextLeft)),
        top: Math.max(0, Math.min(window.innerHeight - 100, nextTop)),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.2)",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          position: "fixed",
          left: windowPos.left,
          top: windowPos.top,
          width: 560,
          maxWidth: "95vw",
          backgroundColor: "rgba(255, 255, 255)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 16px 32px rgba(0,0,0,0.25)",
          fontFamily: "'Rounded Mplus 1c', sans-serif",
        }}
      >
        {/* Drag handle header */}
        <div
          onMouseDown={handleDragMouseDown}
          style={{
            cursor: "move",
            margin: "-8px -8px 12px -8px",
            padding: "8px 8px 0 8px",
            userSelect: "none",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>
            Location icon settings
          </h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            Adjust position, size, and rotation. Changes are previewed on the
            main screen in real time. Click Save to apply permanently.
          </p>
        </div>

        <IconConfigSection
          label="SpeechBubble.svg"
          config={settings.speechBubble}
          onChange={(next) => updateSection("speechBubble", next)}
        />

        <IconConfigSection
          label="Location.svg"
          config={settings.location}
          onChange={(next) => updateSection("location", next)}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #ccc",
              backgroundColor: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #007aff, #00c6ff)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationIconSettingsScreen;
