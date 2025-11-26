// src/screens/FloorGuideApp.tsx
import React, { useEffect, useState } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import floorMap1F from "../assets/floor-1F-map.svg";
import floorMap2F from "../assets/floor-2F-map.svg";
import floorMap3F from "../assets/floor-3F-map.svg";
import floorMap4F from "../assets/floor-4F-map.svg";
import openTimeImage from "../assets/open-time.svg";

import { APP_CONFIG } from "../config";
import { POLLING_INTERVALS } from "../config/appConfig";
import { fetchShops } from "../repositories/shopRepository";
import VerticalVideoSlot from "../components/VerticalVideoSlot";

import type { LocationIconSettings } from "../types/locationIcon";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";

import { logInfo, logError } from "../logging";
import FloorLayoutSettingsScreen from "./FloorLayoutSettingsScreen";
import FloorSettingsScreen from "./FloorSettingsScreen";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

// Map floor id to image asset
const FLOOR_MAPS: Record<string, string> = {
  "1F": floorMap1F,
  "2F": floorMap2F,
  "3F": floorMap3F,
  "4F": floorMap4F,
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

interface FloorGuideAppProps {
  locationIconSettings: LocationIconSettings;
}

const FloorGuideApp: React.FC<FloorGuideAppProps> = ({
  locationIconSettings,
}) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Current floor for this screen (default from APP_CONFIG for non-Electron)
  const [floor, setFloor] = useState<string>(APP_CONFIG.floor);

  // Runtime floor layout (columns / rows per column)
  const [floorLayout, setFloorLayout] =
    useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);

  // Floor synchronization with Electron main process
  useEffect(() => {
    if (!window.electronAPI?.getFloor) {
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
  }, []);

  // Floor layout synchronization with Electron
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

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
  }, []);

  // Select floor map by floor id, fallback to 1F
  const floorMap = FLOOR_MAPS[floor] ?? floorMap1F;

  // Video area width (16:9 aspect ratio)
  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);

  // Shop list area width
  const listWidthVh = 100 - videoWidthVh;

  // Shop data loading
  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const loadShops = async () => {
      try {
        const data = await fetchShops();
        if (cancelled) return;

        const cleaned = data.map((s) => ({
          ...s,
          // Remove furigana / kana in brackets from name
          name: s.name.replace(/【.*?】/g, "").trim(),
        }));

        setShops(cleaned);
        setError(null);

        logInfo("shopList", "Shop data synced", {
          count: cleaned.length,
        });
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;

        const message = e?.message ?? "failed to load";
        setError(message);

        logError("shopList", "Failed to load shop list", {
          error: message,
        });
      } finally {
        if (cancelled) return;
        timerId = window.setTimeout(loadShops, POLLING_INTERVALS.SHOP_LIST_MS);
      }
    };

    // Initial sync on startup
    loadShops();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const handleSaveFloorLayout = async (next: FloorLayout) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveFloorLayout(next);
      setFloorLayout(saved);
    } catch (e) {
      console.error("Failed to save floor layout", e);
    }
  };

  const handleCancelFloorLayout = () => {
    const api = window.electronAPI;
    if (!api) return;

    api
      .getFloorLayout()
      .then((layout) => {
        if (layout) setFloorLayout(layout);
      })
      .catch((e) => {
        console.error("Failed to reload floor layout on cancel", e);
      });
  };

  const handleSaveFloor = async (nextFloor: "1F" | "2F" | "3F" | "4F") => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      // Use IPC to update floor setting in main process
      // The main process will broadcast the change via onFloorChanged
      api.setFloor(nextFloor);
    } catch (e) {
      console.error("Failed to save floor", e);
    }
  };

  const handleCancelFloor = () => {
    const api = window.electronAPI;
    if (!api) return;

    api
      .getFloor()
      .then((currentFloor) => {
        if (currentFloor) setFloor(currentFloor);
      })
      .catch((e) => {
        console.error("Failed to reload floor on cancel", e);
      });
  };

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
            src={floorMap}
            alt={`Floor map ${floor}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            onLoad={() => {
              logInfo("map", "Floor map image loaded", {
                floor,
                src: floorMap,
              });
            }}
            onError={(event) => {
              logError("map", "Failed to load floor map image", {
                floor,
                src: floorMap,
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
            <VerticalVideoSlot />
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
            src={openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "30px",
            }}
            onLoad={() => {
              logInfo("openTime", "Open-time image loaded", {
                src: openTimeImage,
              });
            }}
            onError={(event) => {
              logError("openTime", "Failed to load open-time image", {
                src: openTimeImage,
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>

      {/* Floor layout settings modal (always mounted, opened via app menu) */}
      <FloorLayoutSettingsScreen
        layout={floorLayout}
        onChangeLayout={setFloorLayout}
        onSave={handleSaveFloorLayout}
        onCancel={handleCancelFloorLayout}
      />

      {/* Floor settings modal (always mounted, opened via app menu) */}
      <FloorSettingsScreen
        floor={floor as "1F" | "2F" | "3F" | "4F"}
        onChangeFloor={(f) => setFloor(f)}
        onSave={handleSaveFloor}
        onCancel={handleCancelFloor}
      />
    </div>
  );
};

export default FloorGuideApp;
