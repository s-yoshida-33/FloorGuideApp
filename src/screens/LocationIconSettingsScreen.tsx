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
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
      }}
    >
      <legend style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", padding: "0 8px", fontSize: 14 }}>{label}</legend>

      <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
        />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>表示</span>
      </label>

      {/* Position */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>X位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
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
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Y位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
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
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* Size & rotation */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>サイズ (px)</div>
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
            style={{
              width: 100,
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#ffffff",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>回転 (°)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
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
        const width = 900;
        const height = 500;
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
        left: windowPos.left,
        top: windowPos.top,
        width: 900,
        maxWidth: "95vw",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: 9999,
      }}
    >
        {/* Drag handle header */}
        <div
          onMouseDown={handleDragMouseDown}
          style={{
            cursor: "move",
            margin: "-8px -8px 16px -8px",
            padding: "8px 8px 0 8px",
            userSelect: "none",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 6, color: "#ffffff", fontSize: 20, fontWeight: 600 }}>
            位置アイコン設定
          </h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            位置、サイズ、回転を調整します。変更はメイン画面でリアルタイムにプレビューされます。保存をクリックすると永続的に適用されます。
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 20,
          }}
        >
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
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.9)",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #007aff, #00c6ff)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              opacity: saving ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 122, 255, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 122, 255, 0.3)";
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
    </div>
  );
};

export default LocationIconSettingsScreen;
