// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import iconSvg from "../assets/icon.svg";

type FloorId = "1F" | "2F" | "3F" | "4F";

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

type TabType = "floor" | "layout" | "location";

interface UnifiedSettingsScreenProps {
  floor: FloorId;
  onSaveFloor: (floor: FloorId) => Promise<void> | void;
  floorLayout: FloorLayout;
  onSaveFloorLayout: (layout: FloorLayout) => Promise<void> | void;
  locationIconSettings: LocationIconSettings;
  onSaveLocationIconSettings: (settings: LocationIconSettings) => Promise<void> | void;
}

const UnifiedSettingsScreen: React.FC<UnifiedSettingsScreenProps> = ({
  floor: initialFloor,
  onSaveFloor,
  floorLayout: initialFloorLayout,
  onSaveFloorLayout,
  locationIconSettings: initialLocationIconSettings,
  onSaveLocationIconSettings,
}) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("floor");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(initialFloorLayout);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettings>(initialLocationIconSettings);

  // Preview zoom and pan state
  const [zoom, setZoom] = useState(0.6); // 60% initial
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Track if preview has been manually panned
  const [hasBeenPanned, setHasBeenPanned] = useState(false);

  // Calculate initial center position for preview
  useEffect(() => {
    if (!visible || !previewContainerRef.current) return;

    // Use setTimeout to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (!previewContainerRef.current) return;

      const container = previewContainerRef.current;
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      // GidoApp size (1920x1080) - use original size, not scaled
      // The transform scale will handle the scaling
      const appWidth = 1920;
      const appHeight = 1080;

      // Calculate center offset (before scaling)
      // Since transformOrigin is "center center", we need to adjust for the scale
      const centerX = (containerWidth - appWidth * zoom) / 2;
      const centerY = (containerHeight - appHeight * zoom) / 2;

      // Set center position when screen opens or zoom changes (if not manually panned)
      if (!hasBeenPanned) {
        setPanX(centerX);
        setPanY(centerY);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [visible, zoom, hasBeenPanned]);

  // Load initial values when screen opens
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenSettings) {
      unsubscribe = window.electronAPI.onOpenSettings(() => {
        setVisible(true);
        setActiveTab("floor");
        setFloor(initialFloor);
        setFloorLayout(initialFloorLayout);
        setLocationIconSettings(initialLocationIconSettings);
        setZoom(0.6);
        // Reset pan position - will be centered by useEffect
        setPanX(0);
        setPanY(0);
        setHasBeenPanned(false);
        setErrors({});
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialFloor, initialFloorLayout, initialLocationIconSettings]);

  // Sync with external changes when screen is closed
  useEffect(() => {
    if (!visible) {
      setFloor(initialFloor);
      setFloorLayout(initialFloorLayout);
      setLocationIconSettings(initialLocationIconSettings);
    }
  }, [visible, initialFloor, initialFloorLayout, initialLocationIconSettings]);

  const handleClose = () => {
    setVisible(false);
    setErrors({});
  };

  const handleCancel = () => {
    // Revert to initial values
    setFloor(initialFloor);
    setFloorLayout(initialFloorLayout);
    setLocationIconSettings(initialLocationIconSettings);
    setZoom(0.6);
    // Reset pan position - will be centered by useEffect
    setPanX(0);
    setPanY(0);
    setHasBeenPanned(false);
    setErrors({});
    handleClose();
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "layout") {
      const selectedFloor = floor; // Use current floor for layout validation
      const layout = floorLayout[selectedFloor];
      if (layout) {
        if (layout.columns <= 0 || layout.columns > 10) {
          newErrors["layout.columns"] = "列数は1〜10の範囲で入力してください";
        }
        if (layout.rowsPerCol <= 0 || layout.rowsPerCol > 100) {
          newErrors["layout.rowsPerCol"] = "行数は1〜100の範囲で入力してください";
        }
        if (layout.perColumnRows) {
          layout.perColumnRows.forEach((rows, idx) => {
            if (rows !== undefined && (rows <= 0 || rows > 100)) {
              newErrors[`layout.perColumnRows.${idx}`] = "行数は1〜100の範囲で入力してください";
            }
          });
        }
        if (layout.perColumnPadding) {
          layout.perColumnPadding.forEach((padding, idx) => {
            if (padding) {
              Object.entries(padding).forEach(([key, value]) => {
                if (value !== undefined && value < 0) {
                  newErrors[`layout.perColumnPadding.${idx}.${key}`] = "間隔は0以上の値を入力してください";
                }
              });
            }
          });
        }
      }
    }

    if (activeTab === "location") {
      // Validate location icon settings
      if (locationIconSettings.speechBubble.size <= 0 || locationIconSettings.speechBubble.size > 512) {
        newErrors["location.speechBubble.size"] = "サイズは1〜512の範囲で入力してください";
      }
      if (locationIconSettings.location.size <= 0 || locationIconSettings.location.size > 512) {
        newErrors["location.location.size"] = "サイズは1〜512の範囲で入力してください";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        onSaveFloor(floor),
        onSaveFloorLayout(floorLayout),
        onSaveLocationIconSettings(locationIconSettings),
      ]);
      handleClose();
    } catch (e) {
      console.error("Failed to save settings", e);
      setErrors({ save: "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(1.5, prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.6, prev - 0.1));
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.max(0.6, Math.min(1.5, prev + delta)));
  }, []);

  // Drag controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    // Check if the event target is from GidoApp content
    const target = e.target as HTMLElement;
    // If clicking on interactive elements (buttons, inputs, etc.), don't start dragging
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
    setHasBeenPanned(true);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#1C1C1C",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
      }}
    >
      {/* Header (4%) */}
      <div
        style={{
          height: "4%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Logo and App Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src={iconSvg}
            alt="Gido"
            style={{
              width: 24,
              height: 24,
            }}
          />
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600 }}>
            Gido
          </span>
        </div>

        {/* Error Message */}
        {errors.save && (
          <span style={{ color: "#ff4444", fontSize: 14 }}>
            {errors.save}
          </span>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "#007aff",
            border: "none",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        </div>
      </div>

      {/* Main Area (96%) */}
      <div
        style={{
          height: "96%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Left Sidebar (13%) */}
        <div
          style={{
            width: "13%",
            backgroundColor: "#2C2C2C",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Tabs */}
          <div style={{ flex: 1, padding: "16px 0" }}>
            {[
              { id: "floor" as TabType, label: "フロア" },
              { id: "layout" as TabType, label: "レイアウト" },
              { id: "location" as TabType, label: "現在地" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  backgroundColor:
                    activeTab === tab.id ? "#007aff" : "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 15,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Preview (72%) */}
        <div
          style={{
            width: "72%",
            backgroundColor: "#1C1C1C",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            ref={previewContainerRef}
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none", // Prevent text selection during drag
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onDragStart={(e) => e.preventDefault()} // Prevent default drag behavior
          >
            <div
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: "center center",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  maxWidth: "1920px",
                  maxHeight: "1080px",
                }}
              >
                <GidoApp
                  locationIconSettings={locationIconSettings}
                  previewFloor={floor}
                  previewFloorLayout={floorLayout}
                />
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 1.5}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: zoom >= 1.5 ? "not-allowed" : "pointer",
                opacity: zoom >= 1.5 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.6}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: zoom <= 0.6 ? "not-allowed" : "pointer",
                opacity: zoom <= 0.6 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
          </div>
        </div>

        {/* Right Edit Panel (15%) */}
        <div
          style={{
            width: "15%",
            backgroundColor: "#2C2C2C",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {activeTab === "floor" && (
            <FloorSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
            />
          )}
          {activeTab === "layout" && (
            <LayoutSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              floorLayout={floorLayout}
              onChangeFloorLayout={setFloorLayout}
              errors={errors}
            />
          )}
          {activeTab === "location" && (
            <LocationSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
              errors={errors}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Floor Settings Tab
interface FloorSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
}

const FloorSettingsTab: React.FC<FloorSettingsTabProps> = ({
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

// Layout Settings Tab
interface LayoutSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  floorLayout: FloorLayout;
  onChangeFloorLayout: (layout: FloorLayout) => void;
  errors: Record<string, string>;
}

const LayoutSettingsTab: React.FC<LayoutSettingsTabProps> = ({
  floor,
  onChangeFloor,
  floorLayout,
  onChangeFloorLayout,
  errors,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
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
      <h3
        style={{
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        ショップリストレイアウト
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

// Location Settings Tab
interface LocationSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  locationIconSettings: LocationIconSettings;
  onChangeLocationIconSettings: (settings: LocationIconSettings) => void;
  errors: Record<string, string>;
}

const LocationSettingsTab: React.FC<LocationSettingsTabProps> = ({
  floor,
  onChangeFloor,
  locationIconSettings,
  onChangeLocationIconSettings,
  errors,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);

  // Update preview floor when selected floor changes
  useEffect(() => {
    onChangeFloor(selectedFloor);
  }, [selectedFloor, onChangeFloor]);
  const updateIcon = (
    iconKey: "speechBubble" | "location",
    partial: Partial<LocationIconSettings["speechBubble"]>
  ) => {
    onChangeLocationIconSettings({
      ...locationIconSettings,
      [iconKey]: {
        ...locationIconSettings[iconKey],
        ...partial,
      },
    });
  };

  const clampPercent = (value: number) =>
    Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));

  const clampRotation = (value: number) => {
    const v = Number.isNaN(value) ? 0 : value;
    if (v < 0) return 0;
    if (v > 360) return 360;
    return v;
  };

  const IconSection: React.FC<{
    label: string;
    iconKey: "speechBubble" | "location";
    config: LocationIconSettings["speechBubble"];
  }> = ({ label, iconKey, config }) => (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        backgroundColor: "rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "rgba(255,255,255,0.9)",
          marginBottom: 16,
          fontSize: 14,
        }}
      >
        {label}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => updateIcon(iconKey, { enabled: e.target.checked })}
          style={{
            marginRight: 10,
            width: 18,
            height: 18,
            accentColor: "#007aff",
          }}
        />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>
          表示
        </span>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              marginBottom: 6,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 500,
            }}
          >
            X位置 (%)
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                updateIcon(iconKey, {
                  xPercent: clampPercent(Number(e.target.value)),
                })
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
                updateIcon(iconKey, {
                  xPercent: clampPercent(Number(e.target.value)),
                })
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
          <div
            style={{
              fontSize: 12,
              marginBottom: 6,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 500,
            }}
          >
            Y位置 (%)
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                updateIcon(iconKey, {
                  yPercent: clampPercent(Number(e.target.value)),
                })
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
                updateIcon(iconKey, {
                  yPercent: clampPercent(Number(e.target.value)),
                })
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
          <div
            style={{
              fontSize: 12,
              marginBottom: 6,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 500,
            }}
          >
            サイズ (px)
          </div>
          <input
            type="number"
            min={1}
            max={512}
            step={0.1}
            value={config.size}
            onChange={(e) =>
              updateIcon(iconKey, {
                size: Math.max(1, Math.min(512, Number(e.target.value) || 1)),
              })
            }
            style={{
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: errors[`location.${iconKey}.size`]
                ? "1px solid #ff4444"
                : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#ffffff",
              fontSize: 13,
            }}
          />
          {errors[`location.${iconKey}.size`] && (
            <div style={{ color: "#ff4444", fontSize: 12, marginTop: 4 }}>
              {errors[`location.${iconKey}.size`]}
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              marginBottom: 6,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 500,
            }}
          >
            回転 (°)
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                updateIcon(iconKey, {
                  rotation: clampRotation(Number(e.target.value)),
                })
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
                updateIcon(iconKey, {
                  rotation: clampRotation(Number(e.target.value)),
                })
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
    </div>
  );

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

        <IconSection
          label="SpeechBubble.svg"
          iconKey="speechBubble"
          config={locationIconSettings.speechBubble}
        />
        <IconSection
          label="Location.svg"
          iconKey="location"
          config={locationIconSettings.location}
        />
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;

