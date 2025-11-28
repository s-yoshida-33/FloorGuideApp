import React from "react";

export type FloorId = "1F" | "2F" | "3F" | "4F";

export interface FloorSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
}

export const FloorSettingsTab: React.FC<FloorSettingsTabProps> = ({
  floor,
  onChangeFloor,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];

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
        フロア設定
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {floors.map((f) => (
          <label
            key={f}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="floor"
              value={f}
              checked={floor === f}
              onChange={() => onChangeFloor(f)}
              style={{
                marginRight: 12,
                width: 18,
                height: 18,
                accentColor: "#007aff",
              }}
            />
            <span style={{ color: "#ffffff", fontSize: 15 }}>{f}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

