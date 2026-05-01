// src/App.tsx
import React, { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import GidoApp from "./screens/GidoApp";
import MallSelectScreen from "./screens/MallSelectScreen";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import { ContextMenu } from "./components/ContextMenu";
import { PatchScreen } from "./screens/PatchScreen";
import BlackScreenOverlay from "./components/BlackScreenOverlay";
import { useHeartbeat } from "./hooks/useHeartbeat";
import { useBridgeRegistration } from "./hooks/useBridgeRegistration";
import { useWebViewPing } from "./hooks/useWebViewPing";
import { useMapSync } from "./hooks/useMapSync";
import { useOpenTimeSync } from "./hooks/useOpenTimeSync";
import { useBannerSync } from "./hooks/useBannerSync";
import { DEFAULT_LOCATION_ICON_SETTINGS } from "./config";
import { getMallConfig } from "./config/malls";
import type { MallId, MallSettingsFile } from "./types/mall";
import type { LocationIconSettings } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import {
  DEFAULT_GENRE_MAPPINGS,
  DEFAULT_GENRE_MEMO_SETTINGS,
  buildDefaultGenreMappingsForMall,
} from "./types/genreSettings";
import type { GenreMappings, GenreMemoSettings } from "./types/genreSettings";
import type { ShopSettings } from "./types/shopSettings";
import type { BlackScreenSettings } from "./types/blackScreenSettings";
import { DEFAULT_BLACK_SCREEN_SETTINGS } from "./types/blackScreenSettings";
import type { FloorId, FloorLayout } from "./types/floorLayout";
import { sseClient } from "./api/sseClient";
import type { SseConnectionStatus } from "./api/sseClient";
import {
  loadGlobalSettings,
  saveGlobalSettings,
  loadMallSettings,
  saveMallSettings,
  ensureMallSettingsFile,
  migrateFromLegacyIfNeeded,
} from "./utils/settings";
import type { AudioSettings } from "./types/audioSettings";
import { DEFAULT_AUDIO_SETTINGS } from "./types/audioSettings";
import { AudioSettingsProvider } from "./contexts/AudioSettingsContext";
import { logInfo, logError } from "./logs/logging";

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

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
          <h1 style={{ fontSize: "2em", marginBottom: "1em" }}>System Error</h1>
          <p>
            予期せぬエラーが発生しました。自動的に復旧しない場合は再起動してください。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// App phases
// ---------------------------------------------------------------------------

type AppPhase = "boot" | "loading" | "mall_select" | "settings_initial" | "running";

const App: React.FC = () => {
  // --- Phase management ---
  const [appPhase, setAppPhase] = useState<AppPhase>("boot");

  // --- Mall ---
  const [mallId, setMallId] = useState<MallId>("sakaikitahanada");
  const [hostname, setHostname] = useState<string>('');

  // --- Per-mall settings state ---
  const [locationSettings, setLocationSettings] =
    useState<LocationIconSettings>(DEFAULT_LOCATION_ICON_SETTINGS);
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    getMallConfig("sakaikitahanada").defaultFloorLayout,
  );
  const [imageSettings, setImageSettings] =
    useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [genreMappings, setGenreMappings] =
    useState<GenreMappings>(DEFAULT_GENRE_MAPPINGS);
  const [genreMemoSettings, setGenreMemoSettings] =
    useState<GenreMemoSettings>(DEFAULT_GENRE_MEMO_SETTINGS);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({});
  const [blackScreenSettings, setBlackScreenSettings] =
    useState<BlackScreenSettings>(DEFAULT_BLACK_SCREEN_SETTINGS);

  const [audioSettings, setAudioSettings] =
    useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- UI visibility ---
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isVersionInfoVisible, setIsVersionInfoVisible] = useState(false);

  // --- Debug / SSE ---
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>("disconnected");
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  // Heartbeat
  useHeartbeat();

  // Bridge-Ground app registration & heartbeat (only after settings have loaded)
  useBridgeRegistration(mallId, hostname, appPhase === 'running');

  // WebView watchdog ping
  useWebViewPing();

  // S3 map sync on startup
  const handleMapUpdated = useCallback(
    (floorMaps: Partial<Record<FloorId, string>>) => {
      setImageSettings((prev) => ({
        ...prev,
        floorMaps: { ...prev.floorMaps, ...floorMaps },
      }));
    },
    [],
  );
  useMapSync(mallId, hostname, { onMapUpdated: handleMapUpdated });

  // S3 open-time sync on startup
  const handleOpenTimeUpdated = useCallback(
    (assetUrl: string) => {
      setImageSettings((prev) => ({ ...prev, openTimeImage: assetUrl }));
    },
    [],
  );
  useOpenTimeSync(mallId, { onOpenTimeUpdated: handleOpenTimeUpdated });

  // S3 banner sync on startup (only active for layouts that use banners)
  const handleBannerUpdated = useCallback(
    (assetUrls: string[]) => {
      setImageSettings((prev) => ({
        ...prev,
        banner: { ...prev.banner, images: assetUrls },
      }));
    },
    [],
  );
  // Pass mallId as layoutId — for sakaikitahanada-v this equals "sakaikitahanada-v"
  useBannerSync(mallId, hostname, { onBannerUpdated: handleBannerUpdated });

  // -----------------------------------------------------------------------
  // Apply a MallSettingsFile to local state
  // -----------------------------------------------------------------------
  const applyMallSettings = useCallback(
    (ms: MallSettingsFile, floorOverride?: FloorId) => {
      if (ms.floorLayout) setFloorLayout(ms.floorLayout);
      if (ms.locationIcons) setLocationSettings(ms.locationIcons);
      if (ms.imageSettings) {
        setImageSettings(ms.imageSettings);
      }
      if (ms.genreMappings) setGenreMappings(ms.genreMappings);
      if (ms.genreMemoSettings) setGenreMemoSettings(ms.genreMemoSettings);
      if (ms.shopSettings !== undefined) setShopSettings(ms.shopSettings ?? {});
      if (ms.blackScreenSettings) setBlackScreenSettings(ms.blackScreenSettings);
      if (ms.audioSettings) setAudioSettings(ms.audioSettings);
      if (floorOverride) setFloor(floorOverride);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Boot → load global settings → decide phase
  // -----------------------------------------------------------------------
  const handleBootComplete = useCallback(async () => {
    setAppPhase("loading");
    try {
      // 1. Migrate legacy single-file settings (v1.x → v2.x)
      await migrateFromLegacyIfNeeded();

      // 2. Load global settings
      const global = await loadGlobalSettings();
      setMallId(global.mallId);
      setHostname(global.hostname ?? '');

      if (!global.setupCompleted) {
        setAppPhase("mall_select");
        return;
      }

      // 3. Load per-mall settings
      await ensureMallSettingsFile(global.mallId);
      const ms = await loadMallSettings(global.mallId);
      const config = getMallConfig(global.mallId);
      const loadedFloor = ms.floor ?? config.defaultFloor;
      setFloor(loadedFloor);

      // Use mall-specific default genre mappings if none are saved yet
      if (!ms.genreMappings) {
        ms.genreMappings = buildDefaultGenreMappingsForMall(config);
      }

      // 4. Overlay locally cached map/open-time files so the first render
      //    already has the correct images (no white flash).
      const hostname = global.hostname ?? '';
      if (global.mallId && hostname) {
        try {
          const localMaps = await invoke<Array<{ filename: string; abs_path: string }>>(
            'list_local_maps', { mallId: global.mallId, hostname }
          );
          const floorMaps: Record<string, string> = {};
          for (const entry of localMaps) {
            const m = entry.filename.match(/^(\dF)-map/);
            if (m) floorMaps[m[1]] = convertFileSrc(entry.abs_path);
          }
          if (Object.keys(floorMaps).length > 0) {
            ms.imageSettings = {
              ...DEFAULT_IMAGE_SETTINGS,
              ...ms.imageSettings,
              floorMaps: { ...DEFAULT_IMAGE_SETTINGS.floorMaps, ...ms.imageSettings?.floorMaps, ...floorMaps } as Record<FloorId, string>,
            };
          }
        } catch { /* offline or no maps yet — skip */ }
      }
      if (global.mallId) {
        try {
          const localOpenTimes = await invoke<Array<{ filename: string; abs_path: string }>>(
            'list_local_open_times', { mallId: global.mallId }
          );
          if (localOpenTimes.length > 0) {
            ms.imageSettings = {
              ...DEFAULT_IMAGE_SETTINGS,
              ...ms.imageSettings,
              openTimeImage: convertFileSrc(localOpenTimes[0].abs_path),
            };
          }
        } catch { /* offline or no open-time yet — skip */ }
      }

      applyMallSettings(ms, loadedFloor);

      logInfo("SYS_INIT", "Settings loaded successfully", {
        mallId: global.mallId,
      });
      setAppPhase("running");
    } catch (e) {
      logError("CONFIG", "Failed to load initial settings", {
        error: e instanceof Error ? e.message : String(e),
      });
      // Fall back to running with defaults
      setAppPhase("running");
    }
  }, [applyMallSettings]);

  // -----------------------------------------------------------------------
  // Mall selection (initial setup)
  // -----------------------------------------------------------------------
  const handleMallSelect = useCallback(
    async (selectedMallId: MallId) => {
      setMallId(selectedMallId);
      const config = getMallConfig(selectedMallId);
      setFloor(config.defaultFloor);
      setFloorLayout(config.defaultFloorLayout);

      // Ensure per-mall file exists with defaults
      await ensureMallSettingsFile(selectedMallId);
      const ms = await loadMallSettings(selectedMallId);
      // Use mall-specific default genre mappings if none are saved yet
      if (!ms.genreMappings) {
        ms.genreMappings = buildDefaultGenreMappingsForMall(config);
      }
      applyMallSettings(ms, config.defaultFloor);

      // Open settings screen for initial configuration
      setAppPhase("settings_initial");
    },
    [applyMallSettings],
  );

  // -----------------------------------------------------------------------
  // Initial setup save (from UnifiedSettingsScreen in setup mode)
  // -----------------------------------------------------------------------
  const handleInitialSetupSave = useCallback(
    async (mallSettings: MallSettingsFile, newFloor: FloorId) => {
      try {
        // Save per-mall settings (includes floor)
        await saveMallSettings(mallId, { ...mallSettings, floor: newFloor });
        applyMallSettings(mallSettings, newFloor);

        // Save global settings with setupCompleted = true
        await saveGlobalSettings({
          mallId,
          setupCompleted: true,
        });

        logInfo("CONFIG", "Initial setup completed", { mallId });
        setAppPhase("running");
      } catch (e) {
        logError("CONFIG", "Failed to save initial setup", {
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [mallId, applyMallSettings],
  );

  // -----------------------------------------------------------------------
  // Normal save (from settings screen in running mode)
  // -----------------------------------------------------------------------
  const handleSaveAll = useCallback(
    async (
      mallSettings: MallSettingsFile,
      newFloor: FloorId,
      newMallId: MallId,
    ) => {
      try {
        // Save per-mall settings (includes floor)
        await saveMallSettings(newMallId, { ...mallSettings, floor: newFloor });
        applyMallSettings(mallSettings, newFloor);

        // Save global settings
        await saveGlobalSettings({
          mallId: newMallId,
          setupCompleted: true,
        });

        setMallId(newMallId);
        logInfo("CONFIG", "All settings saved successfully", {
          mallId: newMallId,
        });
      } catch (e) {
        logError("CONFIG", "Failed to save settings", {
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [applyMallSettings],
  );

  // -----------------------------------------------------------------------
  // Soft reload
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handleReload = () => {
      logInfo(
        "SYS_INIT",
        "Soft reload triggered via context menu (no PatchScreen restart)",
      );
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener("reload-current-view", handleReload);
    return () => window.removeEventListener("reload-current-view", handleReload);
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

  // -----------------------------------------------------------------------
  // Image settings with cache-bust
  // -----------------------------------------------------------------------
  // Local asset:// URLs already have unique timestamped filenames — no ?v= needed.
  // Using ?v= on asset:// URLs breaks Tauri's asset protocol file lookup.
  const displayImageSettings = React.useMemo(() => {
    return imageSettings;
  }, [imageSettings]);

  // --- RENDER ---

  // Boot / PatchScreen
  if (appPhase === "boot") {
    return (
      <ErrorBoundary>
        <PatchScreen onComplete={handleBootComplete} />
      </ErrorBoundary>
    );
  }

  // Loading
  if (appPhase === "loading") {
    return (
      <ErrorBoundary>
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1C1C1C",
            color: "#fff",
            fontFamily: "'Rounded Mplus 1c', sans-serif",
            fontSize: 20,
          }}
        >
          読み込み中...
        </div>
      </ErrorBoundary>
    );
  }

  // Mall selection (initial setup)
  if (appPhase === "mall_select") {
    return (
      <ErrorBoundary>
        <MallSelectScreen onSelect={handleMallSelect} />
      </ErrorBoundary>
    );
  }

  // Initial settings (after first mall selection)
  if (appPhase === "settings_initial") {
    return (
      <ErrorBoundary>
        <UnifiedSettingsScreen
          mallId={mallId}
          floor={floor}
          floorLayout={floorLayout}
          locationIconSettings={locationSettings}
          imageSettings={imageSettings}
          genreMappings={genreMappings}
          genreMemoSettings={genreMemoSettings}
          shopSettings={shopSettings}
          blackScreenSettings={blackScreenSettings}
          audioSettings={audioSettings}
          isInitialSetup={true}
          onSaveAll={(ms, newFloor) =>
            handleInitialSetupSave(ms, newFloor)
          }
          onClose={() => setAppPhase("mall_select")}
        />
      </ErrorBoundary>
    );
  }

  // Running (normal operation)
  return (
    <ErrorBoundary>
      <AudioSettingsProvider mallId={mallId} externalAudioSettings={audioSettings}>
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
            <div>Mall: {mallId}</div>
            <div>SSE: {sseStatus}</div>
            <div>Floor: {floor}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
              Ctrl+Shift+D to hide
            </div>
          </div>
        )}

        <GidoApp
          key={`${mallId}-${refreshKey}`}
          mallId={mallId}
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
            mallId={mallId}
            floor={floor}
            floorLayout={floorLayout}
            locationIconSettings={locationSettings}
            imageSettings={imageSettings}
            genreMappings={genreMappings}
            genreMemoSettings={genreMemoSettings}
            shopSettings={shopSettings}
            blackScreenSettings={blackScreenSettings}
            audioSettings={audioSettings}
            onSaveAll={(ms, newFloor, newMallId) =>
              handleSaveAll(ms, newFloor, newMallId ?? mallId)
            }
            onClose={() => setIsSettingsVisible(false)}
          />
        )}

        {isVersionInfoVisible && (
          <VersionInfoScreen onClose={() => setIsVersionInfoVisible(false)} />
        )}
      </ContextMenu>
      </AudioSettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
