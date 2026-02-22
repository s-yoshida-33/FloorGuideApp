// src/screens/GidoApp.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import floorMap1F from "../assets/floor-1F-map.webp";
import floorMap2F from "../assets/floor-2F-map.webp";
import floorMap3F from "../assets/floor-3F-map.webp";
import floorMap4F from "../assets/floor-4F-map.webp";
import openTimeImage from "../assets/open-time.webp";

import { APP_CONFIG, POLLING_INTERVALS } from "../config";
import { fetchShops } from "../repositories/shopRepository";
import { loadShopCache, saveShopCache } from "../repositories/shopCache";
import { useBridgeEvents } from "../hooks/useBridgeEvents";
import VerticalVideoSlot from "../components/VerticalVideoSlot";

import type { LocationIconSettings } from "../types/locationIcon";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";
import type { ImageSettings } from "../types/imageSettings";
import type { FloorId } from "../types/floorLayout";
import {
  DEFAULT_GENRE_MAPPINGS,
  type GenreMappings,
  type GenreMemoSettings,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "../types/genreSettings";
import type { ShopSettings } from "../types/shopSettings";

import { logInfo, logError } from "../logs/logging";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

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
  const [floor, setFloor] = useState<string>(previewFloor ?? APP_CONFIG.floor);
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    previewFloorLayout ?? DEFAULT_FLOOR_LAYOUT,
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // Startup log
  useEffect(() => {
    logInfo("SYS_INIT", "Gido Signage App Started", {
      floor: APP_CONFIG.floor,
      platform: window.navigator.userAgent,
    });
  }, []);

  // Heartbeat - once per hour
  useEffect(() => {
    const heartbeat = () => {
      logInfo("SYS_INIT", "System Heartbeat - App is running", {
        shopCount: shops.length,
        currentFloor: floor,
      });
    };
    const interval = setInterval(heartbeat, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [shops.length, floor]);

  const floorMapRef = useRef<HTMLImageElement>(null);
  const openTimeImageRef = useRef<HTMLImageElement>(null);

  // Periodic image visibility check (every 5 minutes)
  useEffect(() => {
    if (previewFloor) return;

    const checkVisibility = () => {
      let needsReload = false;

      if (floorMapRef.current) {
        const { naturalWidth, complete } = floorMapRef.current;
        if (!complete || naturalWidth === 0) {
          logError("ASSET_CHECK", "Floor map broken image detected", { floor });
          needsReload = true;
        }
      }

      if (openTimeImageRef.current) {
        const { naturalWidth, complete } = openTimeImageRef.current;
        if (!complete || naturalWidth === 0) {
          logError("ASSET_CHECK", "Open time broken image detected");
          needsReload = true;
        }
      }

      if (needsReload) {
        logInfo("ASSET_CHECK", "Triggering auto-reload due to asset failure");
        setRefreshKey((prev) => prev + 1);
      }
    };

    const intervalId = window.setInterval(
      checkVisibility,
      POLLING_INTERVALS.IMAGE_CHECK_MS,
    );
    return () => window.clearInterval(intervalId);
  }, [floor, previewFloor]);

  // Sync preview props
  useEffect(() => {
    if (previewFloor !== undefined) setFloor(previewFloor);
  }, [previewFloor]);

  useEffect(() => {
    if (previewFloorLayout !== undefined) setFloorLayout(previewFloorLayout);
  }, [previewFloorLayout]);

  // Select floor map: custom (asset URL from settings) > bundled default
  const floorId = floor as FloorId;
  const customFloorMap = floorId
    ? imageSettings?.floorMaps?.[floorId]
    : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || floorMap1F;

  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);
  const listWidthVh = 100 - videoWidthVh;

  // Shop data loading with SWR pattern
  const loadShops = useCallback(async (providedShops?: Shop[]) => {
    if (providedShops && providedShops.length > 0) {
      logInfo("DATA_SYNC", "Using shops from SSE event", {
        count: providedShops.length,
      });
      const cleaned = providedShops.map((s) => ({
        ...s,
        name: s.name ? s.name.replace(/【.*?】/g, "").trim() : "",
      }));
      setShops(cleaned);
      setError(null);
      saveShopCache(providedShops);
      return;
    }

    let hasShownCache = false;

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
        logInfo("DATA_SYNC", "Displaying cached shop data", {
          count: cached.length,
        });
      }
    } catch (e) {
      logError("DATA_SYNC", "Failed to load shop cache", {
        error: String(e),
      });
    }

    try {
      const apiData = await fetchShops();
      if (apiData) {
        const cleaned = apiData.map((s) => ({
          ...s,
          name: s.name ? s.name.replace(/【.*?】/g, "").trim() : "",
        }));
        setShops(cleaned);
        setError(null);
        saveShopCache(apiData);
        logInfo("DATA_SYNC", "Shop data synced from API", {
          count: cleaned.length,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "failed to load";
      logError("DATA_SYNC", "Failed to fetch shops from API", {
        error: message,
      });
      if (!hasShownCache) {
        setError(message);
        setShops([]);
      } else {
        logInfo("DATA_SYNC", "Keeping cached data due to API failure");
      }
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops, refreshKey]);

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
      <div style={{ display: "flex", height: `${TOP_HEIGHT_VH}vh` }}>
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
              logInfo("ASSET_CHECK", "Floor map rendered", { floor });
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Floor map load failed", {
                floor,
                reason: "FILE_NOT_FOUND_OR_CORRUPT",
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
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

        {/* Open-time image */}
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
              logInfo("ASSET_CHECK", "Open-time image loaded");
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Failed to load open-time image");
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GidoApp;
