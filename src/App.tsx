// src/App.tsx
import React, { useEffect, useState, useCallback } from "react";
import GidoApp from "./screens/GidoApp";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import { ContextMenu } from "./components/ContextMenu";
import { PatchScreen } from "./screens/PatchScreen";
import BlackScreenOverlay from "./components/BlackScreenOverlay";
import { useHeartbeat } from "./hooks/useHeartbeat";
import { DEFAULT_LOCATION_ICON_SETTINGS } from "./config";
import type { LocationIconSettings } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import {
  DEFAULT_GENRE_MAPPINGS,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "./types/genreSettings";
import type { GenreMappings, GenreMemoSettings } from "./types/genreSettings";
import type { ShopSettings } from "./types/shopSettings";
import type { BlackScreenSettings } from "./types/blackScreenSettings";
import { DEFAULT_BLACK_SCREEN_SETTINGS } from "./types/blackScreenSettings";
import type { FloorId, FloorLayout } from "./types/floorLayout";
import { sseClient } from "./api/sseClient";
import type { SseConnectionStatus } from "./api/sseClient";
import {
  loadSettings,
  saveAllSettings,
  type GidoSettings,
} from "./utils/settings";
import { logInfo, logError } from "./logs/logging";

// Error boundary for React render failures
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError("RENDERER_ERROR", "React ErrorBoundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 40,
            color: "white",
            background: "#333",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1 style={{ fontSize: "2em", marginBottom: "1em" }}>
            System Error
          </h1>
          <p>
            予期せぬエラーが発生しました。自動的に復旧しない場合は再起動してください。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

const App: React.FC = () => {
  // --- ALL hooks must be called unconditionally at the top ---
  const [bootComplete, setBootComplete] = useState(false);
  const [locationSettings, setLocationSettings] =
    useState<LocationIconSettings>(DEFAULT_LOCATION_ICON_SETTINGS);
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] =
    useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);
  const [imageSettings, setImageSettings] =
    useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [imageUpdateTs, setImageUpdateTs] = useState(Date.now());
  const [genreMappings, setGenreMappings] =
    useState<GenreMappings>(DEFAULT_GENRE_MAPPINGS);
  const [genreMemoSettings, setGenreMemoSettings] =
    useState<GenreMemoSettings>(DEFAULT_GENRE_MEMO_SETTINGS);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({});
  const [blackScreenSettings, setBlackScreenSettings] = useState<BlackScreenSettings>(
    DEFAULT_BLACK_SCREEN_SETTINGS
  );

  const [refreshKey, setRefreshKey] = useState(0);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isVersionInfoVisible, setIsVersionInfoVisible] = useState(false);

  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>("disconnected");
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  // Heartbeat + system monitoring (Grain-Link pattern)
  useHeartbeat();

  // Soft reload: re-fetch data without restarting app / BootScreen
  useEffect(() => {
    const handleReload = () => {
      logInfo("SYS_INIT", "Soft reload triggered via context menu (no PatchScreen restart)");
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener('reload-current-view', handleReload);
    return () => window.removeEventListener('reload-current-view', handleReload);
  }, []);

  // Load initial settings from disk
  useEffect(() => {
    const init = async () => {
      try {
        const settings = await loadSettings();
        if (settings.floor) setFloor(settings.floor);
        if (settings.floorLayout) setFloorLayout(settings.floorLayout);
        if (settings.locationIcons) setLocationSettings(settings.locationIcons);
        if (settings.imageSettings) setImageSettings(settings.imageSettings);
        if (settings.genreMappings) setGenreMappings(settings.genreMappings);
        if (settings.genreMemoSettings)
          setGenreMemoSettings(settings.genreMemoSettings);
        if (settings.shopSettings) setShopSettings(settings.shopSettings);
        if (settings.blackScreenSettings) setBlackScreenSettings(settings.blackScreenSettings);
        logInfo("SYS_INIT", "Settings loaded successfully");
      } catch (e) {
        logError("CONFIG", "Failed to load initial settings", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    };
    init();
  }, []);

  // SSE status subscription
  useEffect(() => {
    setSseStatus(sseClient.status);
    const unsubscribe = sseClient.on(
      "status_change",
      (data: { status: SseConnectionStatus }) => {
        setSseStatus(data.status);
      },
    );
    return unsubscribe;
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D = debug overlay toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "d" || e.key === "D")) {
        setIsDebugVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Batch save
  const handleSaveAll = useCallback(async (settings: GidoSettings) => {
    try {
      await saveAllSettings(settings);
      if (settings.floor) setFloor(settings.floor);
      if (settings.floorLayout) setFloorLayout(settings.floorLayout);
      if (settings.locationIcons) setLocationSettings(settings.locationIcons);
      if (settings.imageSettings) {
        setImageSettings(settings.imageSettings);
        setImageUpdateTs(Date.now());
      }
      if (settings.genreMappings) setGenreMappings(settings.genreMappings);
      if (settings.genreMemoSettings)
        setGenreMemoSettings(settings.genreMemoSettings);
      if (settings.shopSettings) setShopSettings(settings.shopSettings);
      if (settings.blackScreenSettings) setBlackScreenSettings(settings.blackScreenSettings);
      logInfo("CONFIG", "All settings saved successfully");
    } catch (e) {
      logError("CONFIG", "Failed to save settings", {
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }, []);

  // Process image settings: append cache-bust timestamp to asset URLs
  const displayImageSettings = React.useMemo(() => {
    const processed = {
      ...imageSettings,
      floorMaps: { ...imageSettings.floorMaps },
    };

    (
      Object.keys(processed.floorMaps) as Array<
        keyof typeof processed.floorMaps
      >
    ).forEach((key) => {
      const val = processed.floorMaps[key];
      if (
        val &&
        (val.startsWith("asset:") || val.startsWith("https://asset."))
      ) {
        processed.floorMaps[key] = `${val}?v=${imageUpdateTs}`;
      }
    });

    if (
      processed.openTimeImage &&
      (processed.openTimeImage.startsWith("asset:") ||
        processed.openTimeImage.startsWith("https://asset."))
    ) {
      processed.openTimeImage = `${processed.openTimeImage}?v=${imageUpdateTs}`;
    }

    return processed;
  }, [imageSettings, imageUpdateTs]);

  // --- RENDER ---
  // PatchScreen is shown INSIDE JSX, never as an early return (hooks rule)
  if (!bootComplete) {
    return (
      <ErrorBoundary>
        <PatchScreen onComplete={() => setBootComplete(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ContextMenu
        onOpenSettings={() => setIsSettingsVisible(true)}
        onOpenVersionInfo={() => setIsVersionInfoVisible(true)}
      >
        {isDebugVisible && (
          <div
            style={{
              position: "fixed",
              bottom: 10,
              right: 10,
              zIndex: 99999,
              background: "rgba(0,0,0,0.85)",
              color: "lime",
              padding: "10px 16px",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            <div>SSE: {sseStatus}</div>
            <div>Floor: {floor}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
              Ctrl+Shift+D to hide
            </div>
          </div>
        )}

        <GidoApp
          key={refreshKey}
          locationIconSettings={locationSettings}
          previewFloor={floor}
          previewFloorLayout={floorLayout}
          imageSettings={displayImageSettings}
          genreMappings={genreMappings}
          genreMemoSettings={genreMemoSettings}
          shopSettings={shopSettings}
        />

        <BlackScreenOverlay
          settings={blackScreenSettings}
          onOpenSettings={() => setIsSettingsVisible(true)}
          isSettingsOpen={isSettingsVisible}
        />

        {isSettingsVisible && (
          <UnifiedSettingsScreen
            floor={floor}
            floorLayout={floorLayout}
            locationIconSettings={locationSettings}
            imageSettings={imageSettings}
            genreMappings={genreMappings}
            genreMemoSettings={genreMemoSettings}
            shopSettings={shopSettings}
            blackScreenSettings={blackScreenSettings}
            onSaveAll={handleSaveAll}
            onClose={() => setIsSettingsVisible(false)}
          />
        )}

        {isVersionInfoVisible && (
          <VersionInfoScreen onClose={() => setIsVersionInfoVisible(false)} />
        )}
      </ContextMenu>
    </ErrorBoundary>
  );
};

export default App;
