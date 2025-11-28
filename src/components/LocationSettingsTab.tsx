import React, { useEffect, useState, useCallback } from "react";
import type { FloorId } from "../types/floorLayout";
import type { LocationIconSettings, IconPositionConfig } from "../types/locationIcon";

export interface LocationSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  locationIconSettings: LocationIconSettings;
  onChangeLocationIconSettings: React.Dispatch<React.SetStateAction<LocationIconSettings>>;
}

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));

const clampRotation = (value: number) => {
  const v = Number.isNaN(value) ? 0 : value;
  if (v < 0) return 0;
  if (v > 360) return 360;
  return v;
};

const IconConfigSection: React.FC<{
  label: string;
  config: IconPositionConfig;
  onChange: (next: IconPositionConfig) => void;
}> = ({ label, config, onChange }) => {
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

export const LocationSettingsTab: React.FC<LocationSettingsTabProps> = ({
  floor,
  onChangeFloor,
  locationIconSettings,
  onChangeLocationIconSettings,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);

  // Update preview floor when selected floor changes
  useEffect(() => {
    onChangeFloor(selectedFloor);
  }, [selectedFloor, onChangeFloor]);

  const handleIconConfigChange = useCallback((
    iconKey: "speechBubble" | "location",
    next: IconPositionConfig
  ) => {
    onChangeLocationIconSettings((prev) => ({
      ...prev,
      [iconKey]: next,
    }));
  }, [onChangeLocationIconSettings]);

  return (
    <div>
      <h3
        style={{
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        位置アイコン設定
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Floor Selection */}
        <div>
          <label
            style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            フロア選択
          </label>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value as FloorId)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          >
            {floors.map((f) => (
              <option
                key={f}
                value={f}
                style={{
                  backgroundColor: "#2C2C2C",
                  color: "#ffffff",
                }}
              >
                {f}
              </option>
            ))}
          </select>
        </div>

        <IconConfigSection
          label="SpeechBubble.svg 設定"
          config={locationIconSettings.speechBubble}
          onChange={(next) => handleIconConfigChange("speechBubble", next)}
        />
        <IconConfigSection
          label="Location.svg 設定"
          config={locationIconSettings.location}
          onChange={(next) => handleIconConfigChange("location", next)}
        />
      </div>
    </div>
  );
};

