// src/screens/GidoApp.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import floorMap1F from "../assets/floor-1F-map.svg";
import floorMap2F from "../assets/floor-2F-map.svg";
import floorMap3F from "../assets/floor-3F-map.svg";
import floorMap4F from "../assets/floor-4F-map.svg";
import openTimeImage from "../assets/open-time.svg";

import { APP_CONFIG, POLLING_INTERVALS } from "../config";
import { fetchShops } from "../repositories/shopRepository";
import { loadShopCache, saveShopCache } from "../repositories/shopCache";
import { useBridgeEvents } from "../hooks/useBridgeEvents";
import VerticalVideoSlot from "../components/VerticalVideoSlot";

import type { LocationIconSettings } from "../types/locationIcon";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";
import type { ImageSettings } from "../types/imageSettings";
import type { FloorId } from "../types/floorLayout";
import { DEFAULT_GENRE_MAPPINGS, type GenreMappings, type GenreMemoSettings, DEFAULT_GENRE_MEMO_SETTINGS } from "../types/genreSettings";
import type { ShopSettings } from "../types/shopSettings";

import { logInfo, logError } from "../logs/logging";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

// Map floor id to image asset
const FLOOR_MAPS: Record<string, string> = {
  "1F": floorMap1F,
  "2F": floorMap2F,
  "3F": floorMap3F,
  "4F": floorMap4F,
};

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

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

interface GidoAppProps {
  locationIconSettings: LocationIconSettings;
  // Preview mode props (for UnifiedSettingsScreen)
  previewFloor?: string;
  previewFloorLayout?: FloorLayout;
  imageSettings?: ImageSettings;
  genreMappings?: GenreMappings;
  genreMemoSettings?: GenreMemoSettings;
  shopSettings?: ShopSettings;
}

const GidoApp: React.FC<GidoAppProps> = ({
  locationIconSettings,
  previewFloor,
  previewFloorLayout,
  imageSettings,
  genreMappings = DEFAULT_GENRE_MAPPINGS,
  genreMemoSettings = DEFAULT_GENRE_MEMO_SETTINGS,
  shopSettings,
}) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Current floor for this screen (default from APP_CONFIG for non-Electron)
  // Use previewFloor if available, otherwise load from Electron or use default
  const [floor, setFloor] = useState<string>(
    previewFloor ?? APP_CONFIG.floor
  );

  // Runtime floor layout (columns / rows per column)
  // Use previewFloorLayout if available, otherwise load from Electron or use default
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    previewFloorLayout ?? DEFAULT_FLOOR_LAYOUT
  );

  const [refreshKey, setRefreshKey] = useState(0);

  // ---------------------------------------------------------
  // 1. 起動ログ (SYS_INIT)
  // ---------------------------------------------------------
  useEffect(() => {
    logInfo("SYS_INIT", "Gido Signage App Monitor Started", {
      floor: APP_CONFIG.floor,
      platform: window.navigator.userAgent
    });
  }, []);

  // ---------------------------------------------------------
  // 2. ハートビート (Heartbeat) - 1時間に1回生存報告
  // ---------------------------------------------------------
  useEffect(() => {
    const heartbeat = () => {
      // @ts-ignore process might be available via Electron or node integration
      const uptime = (typeof process !== 'undefined' && process.uptime) ? process.uptime() : 'N/A';
      
      logInfo("SYS_INIT", "System Heartbeat - App is running", {
        uptime,
        shopCount: shops.length,
        currentFloor: floor
      });
    };
    
    const interval = setInterval(heartbeat, 60 * 60 * 1000); // 1 hour
    return () => clearInterval(interval);
  }, [shops.length, floor]);

  // References for visibility check
  const floorMapRef = useRef<HTMLImageElement>(null);
  const openTimeImageRef = useRef<HTMLImageElement>(null);

  // Periodic check for image visibility (every 5 minutes)
  useEffect(() => {
    // Skip checking in preview mode
    if (previewFloor) return;

    const checkVisibility = () => {
      let needsReload = false;

      // Check Floor Map
      if (floorMapRef.current) {
        const { naturalWidth, complete } = floorMapRef.current;
        if (!complete || naturalWidth === 0) {
          logError("ASSET_CHECK", "Floor map broken image detected", { floor, src: floorMap });
          needsReload = true;
        }
      }

      // Check Open Time Image
      if (openTimeImageRef.current) {
        const { naturalWidth, complete } = openTimeImageRef.current;
        if (!complete || naturalWidth === 0) {
          logError("ASSET_CHECK", "Open time broken image detected");
          needsReload = true;
        }
      }

      if (needsReload) {
        logInfo("ASSET_CHECK", "Triggering auto-reload due to asset failure");
        setRefreshKey(prev => prev + 1);
      } else {
        // logInfo("monitor", "Image visibility check passed");
      }
    };

    const intervalId = window.setInterval(checkVisibility, POLLING_INTERVALS.IMAGE_CHECK_MS);
    return () => window.clearInterval(intervalId);
  }, [floor, previewFloor]);

  // Floor synchronization with Electron main process (only if not in preview mode)
  useEffect(() => {
    if (previewFloor || !window.electronAPI?.getFloor) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const current = await window.electronAPI!.getFloor();
        if (!cancelled && current) {
          setFloor(current);
        }
      } catch (e) {
        console.error("Failed to get floor from Electron", e);
      }
    };

    init();

    window.electronAPI.onFloorChanged((nextFloor) => {
      if (!cancelled) {
        setFloor(nextFloor);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewFloor]); // Re-run if previewFloor changes

  // Floor layout synchronization with Electron (only if not in preview mode)
  useEffect(() => {
    const api = window.electronAPI;
    if (previewFloorLayout || !api) return;

    let cancelled = false;

    const init = async () => {
      try {
        const layout = await api.getFloorLayout();
        if (!cancelled && layout) {
          setFloorLayout(layout);
        }
      } catch (e) {
        console.error("Failed to get floor layout from Electron", e);
      }
    };

    init();

    const unsubscribe = api.onFloorLayoutChanged((layout) => {
      if (!cancelled) {
        setFloorLayout(layout);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe && unsubscribe();
    };
  }, [previewFloorLayout]); // Re-run if previewFloorLayout changes

  // Update local state when preview props change
  useEffect(() => {
    if (previewFloor !== undefined) {
      setFloor(previewFloor);
    }
  }, [previewFloor]);

  useEffect(() => {
    if (previewFloorLayout !== undefined) {
      setFloorLayout(previewFloorLayout);
    }
  }, [previewFloorLayout]);

  // Select floor map by floor id, use custom image if available, fallback to default
  const floorId = floor as FloorId;
  const customFloorMap = floorId ? imageSettings?.floorMaps?.[floorId] : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || floorMap1F;

  // Video area width (16:9 aspect ratio)
  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);

  // Shop list area width
  const listWidthVh = 100 - videoWidthVh;

  // Shop data loading
  const loadShops = useCallback(async (providedShops?: Shop[]) => {
    // Case 1: Updated data from SSE event
    if (providedShops && providedShops.length > 0) {
      logInfo("shopList", "Using shops from SSE event", { count: providedShops.length });
      
      const cleaned = providedShops.map((s) => ({
        ...s,
        // Remove furigana / kana in brackets from name
        name: s.name ? s.name.replace(/【.*?】/g, "").trim() : "",
      }));

      setShops(cleaned);
      setError(null);
      
      // Update cache when we receive fresh data from server
      saveShopCache(providedShops);
      return;
    }

    // Case 2: No data provided (startup or manual refresh)
    // Implement Stale-While-Revalidate strategy
    let hasShownCache = false;

    // 1. Try to load from cache first for immediate feedback
    try {
      const cached = loadShopCache();
      if (cached && cached.length > 0) {
        const cleaned = cached.map((s) => ({
          ...s,
          name: s.name ? s.name.replace(/【.*?】/g, "").trim() : "",
        }));
        setShops(cleaned);
        setError(null);
        hasShownCache = true;
        logInfo("shopList", "Displaying cached shop data", { count: cached.length });
      }
    } catch (e) {
      logError("shopList", "Failed to load shop cache", { error: String(e) });
    }

    // 2. Always fetch from API to ensure data is up-to-date
    try {
      logInfo("shopList", "Fetching fresh data from API...");
      const apiData = await fetchShops();
      
      // Update state and cache with fresh data
      if (apiData) {
        const cleaned = apiData.map((s) => ({
          ...s,
          name: s.name ? s.name.replace(/【.*?】/g, "").trim() : "",
        }));

        setShops(cleaned);
        setError(null);
        saveShopCache(apiData);
        
        logInfo("shopList", "Shop data synced from API", {
          count: cleaned.length,
        });
      }
    } catch (e: any) {
      const message = e?.message ?? "failed to load";
      logError("shopList", "Failed to fetch shops from API", {
        error: message,
      });

      // Only show error if we haven't shown cached data
      if (!hasShownCache) {
        setError(message);
        setShops([]); // Clear any potentially partial state
      } else {
        logInfo("shopList", "Keeping cached data due to API failure");
      }
    }
  }, []);

  // Initial sync on startup or refresh
  useEffect(() => {
    loadShops();
  }, [loadShops, refreshKey]);

  // Listen for Bridge events (SSE) to update shops
  useBridgeEvents(loadShops);

  const currentLayout =
    floorLayout[floor] ??
    DEFAULT_FLOOR_LAYOUT[floor] ??
    DEFAULT_FLOOR_LAYOUT["1F"];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        fontWeight: 700,
      }}
    >
      {/* Top: map + video area */}
      <div
        style={{
          display: "flex",
          height: `${TOP_HEIGHT_VH}vh`,
        }}
      >
        {/* Floor map */}
        <div
          style={{
            flex: 2,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            ref={floorMapRef}
            src={floorMap}
            alt={`Floor map ${floor}`}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            onLoad={() => {
              const srcLog = floorMap.startsWith('data:') 
                ? '(Base64 data truncated)' 
                : floorMap;
              logInfo("ASSET_CHECK", "Floor map rendered", {
                floor,
                src: srcLog,
              });
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Floor map load failed", {
                floor,
                src: floorMap,
                reason: "FILE_NOT_FOUND_OR_CORRUPT"
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />

          {/* Location icons overlay */}
          <LocationIconsOverlay settings={locationIconSettings} />
        </div>

        {/* Video area */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            background: "#000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              background: "#000",
            }}
          >
            {previewFloor ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                  fontSize: "1.5vh",
                  fontWeight: "normal",
                }}
              >
                (設定中は非表示)
              </div>
            ) : (
              <VerticalVideoSlot key={refreshKey} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom: shop list + open-time image */}
      <div
        style={{
          height: `${LIST_HEIGHT_VH}vh`,
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Bottom: shop list */}
        <div
          style={{
            flex: 2,
            width: `${listWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
          }}
        >
          {error ? (
            <div style={{ padding: "16px 32px", color: "red" }}>
              Error: {error}
            </div>
          ) : (
            <ShopList
              shops={shops}
              floor={floor}
              columnCount={currentLayout.columns}
              rowsPerColumn={currentLayout.rowsPerCol}
              perColumnRows={currentLayout.perColumnRows}
              perColumnPadding={currentLayout.perColumnPadding}
              genreMappings={genreMappings}
              genreMemoSettings={genreMemoSettings}
              shopSettings={shopSettings}
            />
          )}
        </div>

        {/* Bottom: Open-time image */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#fff",
            margin: "0 auto",
          }}
        >
          <img
            ref={openTimeImageRef}
            key={`opentime-${refreshKey}`}
            src={imageSettings?.openTimeImage || openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "1.4em",
            }}
            onLoad={() => {
              const src = imageSettings?.openTimeImage || openTimeImage;
              const srcLog = src.startsWith('data:') 
                ? '(Base64 data truncated)' 
                : src;
              logInfo("ASSET_CHECK", "Open-time image loaded", {
                src: srcLog,
              });
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Failed to load open-time image", {
                src: imageSettings?.openTimeImage || openTimeImage,
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>

    </div>
  );
};

export default GidoApp;
