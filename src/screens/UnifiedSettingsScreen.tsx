// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import { FloorSettingsTab } from "../components/FloorSettingsTab";
import { LayoutSettingsTab } from "../components/LayoutSettingsTab";
import { LocationSettingsTab } from "../components/LocationSettingsTab";
import iconSvg from "../assets/icon.svg";

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

  // Transform wrapper ref for programmatic control
  const transformRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
    setTransform: (x: number, y: number, scale: number) => void;
  } | null>(null);

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
        setErrors({});
        // Reset transform when opening settings
        if (transformRef.current) {
          transformRef.current.resetTransform();
        }
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
    setErrors({});
    // Reset transform
    if (transformRef.current) {
      transformRef.current.resetTransform();
    }
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


  // Zoom buttons using library methods
  const handleZoomIn = () => {
    if (transformRef.current) {
      transformRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (transformRef.current) {
      transformRef.current.zoomOut();
    }
  };


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
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <TransformWrapper
              initialScale={0.6}
              minScale={0.6}
              maxScale={1.5}
              limitToBounds={false}
              centerOnInit={true}
              wheel={{
                step: 0.05,
              }}
              doubleClick={{
                disabled: true,
              }}
              onInit={(ref) => {
                transformRef.current = ref;
              }}
            >
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                height: "100%",
              }}
              contentStyle={{
                width: `${window.screen.width >= 3840 ? 3840 : 1920}px`,
                height: `${window.screen.height >= 2160 ? 2160 : 1080}px`,
              }}
            >
              <GidoApp
                locationIconSettings={locationIconSettings}
                previewFloor={floor}
                previewFloorLayout={floorLayout}
              />
            </TransformComponent>
          </TransformWrapper>
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
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
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
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;