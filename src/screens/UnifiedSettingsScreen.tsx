// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import type { MallId, MallSettingsFile } from "../types/mall";
import { MALL_CONFIGS, ALL_MALL_IDS, getMallConfig } from "../config/malls";
import { FloorSettingsTab } from "../components/FloorSettingsTab";
import { LayoutSettingsTab } from "../components/LayoutSettingsTab";
import { LocationSettingsTab } from "../components/LocationSettingsTab";
import { ImageSettingsTab } from "../components/ImageSettingsTab";
import { GenreSettingsTab } from "../components/GenreSettingsTab";
import { ShopSettingsTab } from "../components/ShopSettingsTab";
import { BlackScreenSettingsTab } from "../components/BlackScreenSettingsTab";
import iconSvg from "../assets/icon.svg";
import type { ImageSettings } from "../types/imageSettings";
import type { GenreMappings, GenreMemoSettings } from "../types/genreSettings";
import type { ShopSettings } from "../types/shopSettings";
import type { BlackScreenSettings } from "../types/blackScreenSettings";
import { DEFAULT_BLACK_SCREEN_SETTINGS } from "../types/blackScreenSettings";
import { DEFAULT_GENRE_MEMO_SETTINGS } from "../types/genreSettings";
import {
  ensureMallSettingsFile,
  loadMallSettings,
} from "../utils/settings";

type TabType = "floor" | "layout" | "location" | "image" | "genre" | "shop" | "blackScreen";

interface UnifiedSettingsScreenProps {
  mallId: MallId;
  floor: FloorId;
  floorLayout: FloorLayout;
  locationIconSettings: LocationIconSettings;
  imageSettings: ImageSettings;
  genreMappings: GenreMappings;
  genreMemoSettings: GenreMemoSettings;
  shopSettings: ShopSettings;
  blackScreenSettings?: BlackScreenSettings;
  isInitialSetup?: boolean;
  onSaveAll: (
    mallSettings: MallSettingsFile,
    floor: FloorId,
    mallId?: MallId,
  ) => Promise<void>;
  onClose: () => void;
}

const UnifiedSettingsScreen: React.FC<UnifiedSettingsScreenProps> = ({
  mallId: initialMallId,
  floor: initialFloor,
  floorLayout: initialFloorLayout,
  locationIconSettings: initialLocationIconSettings,
  imageSettings: initialImageSettings,
  genreMappings: initialGenreMappings,
  genreMemoSettings: initialGenreMemoSettings,
  shopSettings: initialShopSettings,
  blackScreenSettings: initialBlackScreenSettings = DEFAULT_BLACK_SCREEN_SETTINGS,
  isInitialSetup = false,
  onSaveAll,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("floor");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mall selection (editable in settings)
  const [mallId, setMallId] = useState<MallId>(initialMallId);

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(initialFloorLayout);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettings>(initialLocationIconSettings);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(initialImageSettings);
  const [genreMappings, setGenreMappings] = useState<GenreMappings>(initialGenreMappings);
  const [genreMemoSettings, setGenreMemoSettings] = useState<GenreMemoSettings>(initialGenreMemoSettings);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(initialShopSettings);
  const [blackScreenSettings, setBlackScreenSettings] = useState<BlackScreenSettings>(initialBlackScreenSettings);

  // Per-mall state cache to prevent cross-contamination when switching malls
  type MallLocalState = {
    floor: FloorId;
    floorLayout: FloorLayout;
    locationIconSettings: LocationIconSettings;
    imageSettings: ImageSettings;
    genreMappings: GenreMappings;
    genreMemoSettings: GenreMemoSettings;
    shopSettings: ShopSettings;
    blackScreenSettings: BlackScreenSettings;
  };
  const mallStateCacheRef = useRef<Partial<Record<MallId, MallLocalState>>>({
    [initialMallId]: {
      floor: initialFloor,
      floorLayout: initialFloorLayout,
      locationIconSettings: initialLocationIconSettings,
      imageSettings: initialImageSettings,
      genreMappings: initialGenreMappings,
      genreMemoSettings: initialGenreMemoSettings,
      shopSettings: initialShopSettings,
      blackScreenSettings: initialBlackScreenSettings,
    },
  });

  /** Snapshot current local state into the cache for the given mall */
  const snapshotToCache = (targetMallId: MallId) => {
    mallStateCacheRef.current[targetMallId] = {
      floor,
      floorLayout,
      locationIconSettings,
      imageSettings,
      genreMappings,
      genreMemoSettings,
      shopSettings,
      blackScreenSettings,
    };
  };

  /** Apply a cached (or freshly loaded) state snapshot to all local state */
  const applySnapshot = (s: MallLocalState) => {
    setFloor(s.floor);
    setFloorLayout(s.floorLayout);
    setLocationIconSettings(s.locationIconSettings);
    setImageSettings(s.imageSettings);
    setGenreMappings(s.genreMappings);
    setGenreMemoSettings(s.genreMemoSettings);
    setShopSettings(s.shopSettings);
    setBlackScreenSettings(s.blackScreenSettings);
  };

  // Transform wrapper ref for programmatic control
  const transformRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
    setTransform: (x: number, y: number, scale: number) => void;
    centerView: (scale?: number) => void;
  } | null>(null);
  
  // Container ref for calculating center position
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Mall config for the currently-selected mall
  const mallConfig = getMallConfig(mallId);

  // Sync local state with props on mount
  useEffect(() => {
    setMallId(initialMallId);
    setFloor(initialFloor);
    setFloorLayout(initialFloorLayout);
    setLocationIconSettings(initialLocationIconSettings);
    setImageSettings(initialImageSettings);
    setGenreMappings(initialGenreMappings);
    setGenreMemoSettings(initialGenreMemoSettings);
    setShopSettings(initialShopSettings);
    setBlackScreenSettings(initialBlackScreenSettings);
    setErrors({});
    if (transformRef.current) {
      transformRef.current.resetTransform();
    }
  }, [initialMallId, initialFloor, initialFloorLayout, initialLocationIconSettings, initialImageSettings, initialGenreMappings, initialGenreMemoSettings, initialShopSettings, initialBlackScreenSettings]);

  // ---------- Mall switch handler ----------
  const handleMallChange = async (newMallId: MallId) => {
    if (newMallId === mallId) return;

    // Save current editing state for the mall we're leaving
    snapshotToCache(mallId);

    setMallId(newMallId);
    const config = getMallConfig(newMallId);

    // Restore from cache if we've already visited this mall in this session
    const cached = mallStateCacheRef.current[newMallId];
    if (cached) {
      applySnapshot(cached);
    } else {
      // First visit — load from disk
      await ensureMallSettingsFile(newMallId);
      const ms = await loadMallSettings(newMallId);
      const snapshot: MallLocalState = {
        floor: ms.floor ?? config.defaultFloor,
        floorLayout: ms.floorLayout ?? config.defaultFloorLayout,
        locationIconSettings: ms.locationIcons ?? initialLocationIconSettings,
        imageSettings: ms.imageSettings ?? {} as ImageSettings,
        genreMappings: ms.genreMappings ?? {},
        genreMemoSettings: ms.genreMemoSettings ?? DEFAULT_GENRE_MEMO_SETTINGS,
        shopSettings: ms.shopSettings ?? {},
        blackScreenSettings: ms.blackScreenSettings ?? DEFAULT_BLACK_SCREEN_SETTINGS,
      };
      mallStateCacheRef.current[newMallId] = snapshot;
      applySnapshot(snapshot);
    }

    setErrors({});
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleCancel = () => {
    // Revert to initial values
    setMallId(initialMallId);
    setFloor(initialFloor);
    setFloorLayout(initialFloorLayout);
    setLocationIconSettings(initialLocationIconSettings);
    setImageSettings(initialImageSettings);
    setGenreMappings(initialGenreMappings);
    setGenreMemoSettings(initialGenreMemoSettings);
    setShopSettings(initialShopSettings);
    setBlackScreenSettings(initialBlackScreenSettings);
    setErrors({});
    if (transformRef.current) {
      transformRef.current.resetTransform();
    }
    handleClose();
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "layout") {
      const selectedFloor = floor;
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
      const mallSettings: MallSettingsFile = {
        floor,
        floorLayout,
        locationIcons: locationIconSettings,
        imageSettings,
        genreMappings,
        genreMemoSettings,
        shopSettings,
        blackScreenSettings,
      };
      await onSaveAll(mallSettings, floor, mallId);
      handleClose();
    } catch (e) {
      console.error("Failed to save settings", e);
      setErrors({ save: "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  // Zoom buttons
  const handleZoomIn = () => {
    if (transformRef.current) transformRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (transformRef.current) transformRef.current.zoomOut();
  };
  const handleReset = () => {
    if (transformRef.current && previewContainerRef.current) {
      const contentWidth = window.screen.width >= 3840 ? 3840 : 1920;
      const contentHeight = window.screen.height >= 2160 ? 2160 : 1080;
      const scale = 0.6;
      const scaledWidth = contentWidth * scale;
      const scaledHeight = contentHeight * scale;
      const containerWidth = previewContainerRef.current.clientWidth;
      const containerHeight = previewContainerRef.current.clientHeight;
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;
      transformRef.current.setTransform(centerX, centerY, scale);
    }
  };

  // Build tab list dynamically based on mall config
  const tabs: { id: TabType; label: string }[] = [
    { id: "floor", label: "フロア" },
    { id: "layout", label: "レイアウト" },
    { id: "location", label: "現在地" },
    { id: "image", label: "画像" },
    { id: "genre", label: "ジャンル表記" },
    { id: "shop", label: "ショップ別設定" },
    { id: "blackScreen", label: "ブラックスクリーン" },
  ];

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={iconSvg} alt="Gido" style={{ width: 24, height: 24 }} />
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600 }}>
            Gido
          </span>
        </div>

        {/* Error Message */}
        {errors.save && (
          <span style={{ color: "#ff4444", fontSize: 14 }}>{errors.save}</span>
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
            {isInitialSetup ? "戻る" : "キャンセル"}
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
      <div style={{ height: "96%", display: "flex", flexDirection: "row" }}>
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
          {/* Mall selector dropdown */}
          <div
            style={{
              padding: "16px 16px 8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <select
              value={mallId}
              onChange={(e) => handleMallChange(e.target.value as MallId)}
              style={{
                width: "100%",
                padding: "8px 10px",
                backgroundColor: "#3C3C3C",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 6,
                color: "#ffffff",
                fontSize: 14,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {ALL_MALL_IDS.map((id) => (
                <option key={id} value={id}>
                  {MALL_CONFIGS[id].name}
                </option>
              ))}
            </select>
          </div>

          {/* Tabs */}
          <div style={{ flex: 1, padding: "16px 0", overflowY: "auto" }}>
            {tabs.map((tab) => (
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
          ref={previewContainerRef}
          style={{
            width: "72%",
            backgroundColor: "#1C1C1C",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <TransformWrapper
              initialScale={0.6}
              minScale={0.6}
              maxScale={1.5}
              limitToBounds={false}
              centerOnInit={true}
              wheel={{ step: 0.05 }}
              doubleClick={{ disabled: true }}
              onInit={(ref) => {
                transformRef.current = ref;
              }}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{
                  width: `${window.screen.width >= 3840 ? 3840 : 1920}px`,
                  height: `${window.screen.height >= 2160 ? 2160 : 1080}px`,
                }}
              >
                <GidoApp
                  mallId={mallId}
                  locationIconSettings={locationIconSettings}
                  previewFloor={floor}
                  previewFloorLayout={floorLayout}
                  isPreview={true}
                  imageSettings={imageSettings}
                  genreMappings={genreMappings}
                  genreMemoSettings={genreMemoSettings}
                  shopSettings={shopSettings}
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
            {[
              { label: "+", handler: handleZoomIn },
              { label: "−", handler: handleZoomOut },
              { label: "↻", handler: handleReset },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.handler}
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
                {btn.label}
              </button>
            ))}
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
              floors={mallConfig.floors}
            />
          )}
          {activeTab === "layout" && (
            <LayoutSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              floorLayout={floorLayout}
              onChangeFloorLayout={setFloorLayout}
              errors={errors}
              floors={mallConfig.floors}
            />
          )}
          {activeTab === "location" && (
            <LocationSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
              floors={mallConfig.floors}
            />
          )}
          {activeTab === "image" && (
            <ImageSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              imageSettings={imageSettings}
              onChangeImageSettings={setImageSettings}
              floors={mallConfig.floors}
            />
          )}
          {activeTab === "genre" && (
            <GenreSettingsTab
              genreMappings={genreMappings}
              onChangeGenreMappings={setGenreMappings}
              genreMemoSettings={genreMemoSettings}
              onChangeGenreMemoSettings={setGenreMemoSettings}
            />
          )}
          {activeTab === "shop" && (
            <ShopSettingsTab
              shopSettings={shopSettings}
              onChangeShopSettings={setShopSettings}
            />
          )}
          {activeTab === "blackScreen" && (
            <BlackScreenSettingsTab
              settings={blackScreenSettings}
              onChangeSettings={setBlackScreenSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;