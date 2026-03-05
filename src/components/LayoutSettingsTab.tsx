import React, { useEffect, useState } from "react";
import type { FloorId, FloorLayout } from "../types/floorLayout";

export interface LayoutSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  floorLayout: FloorLayout;
  onChangeFloorLayout: (layout: FloorLayout) => void;
  errors: Record<string, string>;
  floors?: FloorId[];
}

export const LayoutSettingsTab: React.FC<LayoutSettingsTabProps> = ({
  floor,
  onChangeFloor,
  floorLayout,
  onChangeFloorLayout,
  errors,
  floors = ["1F", "2F", "3F", "4F"],
}) => {
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);

  // Update preview floor when selected floor changes
  useEffect(() => {
    onChangeFloor(selectedFloor);
  }, [selectedFloor, onChangeFloor]);

  const currentLayout = floorLayout[selectedFloor] || {
    columns: 3,
    rowsPerCol: 20,
    perColumnRows: [],
    perColumnPadding: [],
  };

  const handleChange = (
    key: "columns" | "rowsPerCol",
    value: string
  ) => {
    const num = value === "" ? 0 : Number(value);
    if (value !== "" && Number.isNaN(num)) return;

    const next: FloorLayout = {
      ...floorLayout,
      [selectedFloor]: {
        ...currentLayout,
        [key]: num,
      },
    };

    onChangeFloorLayout(next);
  };

  const handlePerColumnRowsChange = (colIndex: number, value: string) => {
    const num = value === "" ? undefined : Number(value);
    if (value !== "" && (Number.isNaN(num) || num === undefined)) return;

    const arr = [...(currentLayout.perColumnRows || [])];
    if (num !== undefined) {
      arr[colIndex] = num;
    } else {
      // Remove the entry if empty (will use default)
      delete arr[colIndex];
    }

    const next: FloorLayout = {
      ...floorLayout,
      [selectedFloor]: {
        ...currentLayout,
        perColumnRows: arr,
      },
    };

    onChangeFloorLayout(next);
  };

  const handlePerColumnPaddingChange = (
    colIndex: number,
    side: "top" | "right" | "bottom" | "left",
    value: string
  ) => {
    const num = value === "" ? undefined : Number(value);
    if (value !== "" && Number.isNaN(num)) return;

    const arr = [...(currentLayout.perColumnPadding || [])];
    if (!arr[colIndex]) {
      arr[colIndex] = {};
    }
    const padding = { ...arr[colIndex] };
    if (num !== undefined && num >= 0) {
      padding[side] = num;
    } else {
      delete padding[side];
    }
    arr[colIndex] = padding;

    const next: FloorLayout = {
      ...floorLayout,
      [selectedFloor]: {
        ...currentLayout,
        perColumnPadding: arr,
      },
    };

    onChangeFloorLayout(next);
  };

  return (
    <div>
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

        {/* Columns */}
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
            列数
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={currentLayout.columns || ""}
            onChange={(e) => handleChange("columns", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: errors["layout.columns"]
                ? "1px solid #ff4444"
                : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          />
          {errors["layout.columns"] && (
            <div style={{ color: "#ff4444", fontSize: 12, marginTop: 4 }}>
              {errors["layout.columns"]}
            </div>
          )}
        </div>

        {/* Rows Per Column (Default) */}
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
            行数列 (デフォルト)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={currentLayout.rowsPerCol || ""}
            onChange={(e) => handleChange("rowsPerCol", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: errors["layout.rowsPerCol"]
                ? "1px solid #ff4444"
                : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          />
          {errors["layout.rowsPerCol"] && (
            <div style={{ color: "#ff4444", fontSize: 12, marginTop: 4 }}>
              {errors["layout.rowsPerCol"]}
            </div>
          )}
        </div>

        {/* Per Column Rows */}
        {currentLayout.columns > 0 && (
          <div>
            <label
              style={{
                display: "block",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: 13,
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              列ごとの行数
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: currentLayout.columns }).map((_, idx) => (
                <div key={idx}>
                  <div
                    style={{
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    列{idx + 1}:
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={
                      currentLayout.perColumnRows?.[idx] !== undefined
                        ? currentLayout.perColumnRows[idx]
                        : ""
                    }
                    onChange={(e) =>
                      handlePerColumnRowsChange(idx, e.target.value)
                    }
                    placeholder={`デフォルト: ${currentLayout.rowsPerCol}`}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: errors[`layout.perColumnRows.${idx}`]
                        ? "1px solid #ff4444"
                        : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 14,
                    }}
                  />
                  {errors[`layout.perColumnRows.${idx}`] && (
                    <div
                      style={{ color: "#ff4444", fontSize: 12, marginTop: 4 }}
                    >
                      {errors[`layout.perColumnRows.${idx}`]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per Column Padding */}
        {currentLayout.columns > 0 && (
          <div>
            <label
              style={{
                display: "block",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: 13,
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              列ごとの間隔 (em)
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: currentLayout.columns }).map((_, idx) => (
                <div key={idx}>
                  <div
                    style={{
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    列{idx + 1}:
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {[
                      { key: "top" as const, label: "上" },
                      { key: "right" as const, label: "右" },
                      { key: "bottom" as const, label: "下" },
                      { key: "left" as const, label: "左" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <div
                          style={{
                            color: "rgba(255, 255, 255, 0.6)",
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={
                            currentLayout.perColumnPadding?.[idx]?.[key] !==
                            undefined
                              ? currentLayout.perColumnPadding[idx][key]
                              : ""
                          }
                          onChange={(e) =>
                            handlePerColumnPaddingChange(idx, key, e.target.value)
                          }
                          placeholder="0"
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: errors[`layout.perColumnPadding.${idx}.${key}`]
                              ? "1px solid #ff4444"
                              : "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 4,
                            color: "#ffffff",
                            fontSize: 12,
                          }}
                        />
                        {errors[`layout.perColumnPadding.${idx}.${key}`] && (
                          <div
                            style={{
                              color: "#ff4444",
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            {errors[`layout.perColumnPadding.${idx}.${key}`]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

