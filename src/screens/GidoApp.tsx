// src/screens/GidoApp.tsx
// Mall-aware layout router: delegates rendering to per-mall layout components
// while keeping shared data-fetching logic (shops, SSE, cache) here.

import React, { useEffect, useState, useCallback, useMemo } from "react";

import type { Shop } from "../types/shop";
import type { MallId } from "../types/mall";
import { useShopChangeDetection } from "../hooks/useShopChangeDetection";

import { APP_CONFIG, POLLING_INTERVALS } from "../config";
import { fetchShops } from "../repositories/shopRepository";
import { loadShopCache, saveShopCache } from "../repositories/shopCache";
import { useBridgeEvents } from "../hooks/useBridgeEvents";

import type { LocationIconSettings } from "../types/locationIcon";
import type { ImageSettings } from "../types/imageSettings";
import type { FloorLayout } from "../types/floorLayout";
import {
  DEFAULT_GENRE_MAPPINGS,
  type GenreMappings,
  type GenreMemoSettings,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "../types/genreSettings";
import type { ShopSettings } from "../types/shopSettings";

import { logInfo, logError } from "../logs/logging";

import { SakaikitahanadaLayout, SakaikitahanadaVLayout, SuzakaLayout } from "./layouts";
import type { LayoutProps } from "./layouts";

// --------------------------------------------------------------------------
// Layout registry: add new mall layouts here
// --------------------------------------------------------------------------
const LAYOUT_MAP: Record<MallId, React.FC<LayoutProps>> = {
  sakaikitahanada: SakaikitahanadaLayout,
  "sakaikitahanada-v": SakaikitahanadaVLayout,
  suzaka: SuzakaLayout,
};

// --------------------------------------------------------------------------
// Default floor layout (fallback only)
// --------------------------------------------------------------------------
const DEFAULT_FLOOR_LAYOUT: Record<string, { columns: number; rowsPerCol: number }> = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

interface GidoAppProps {
  mallId: MallId;
  locationIconSettings: LocationIconSettings;
  previewFloor?: string;
  previewFloorLayout?: FloorLayout;
  isPreview?: boolean;
  imageSettings?: ImageSettings;
  genreMappings?: GenreMappings;
  genreMemoSettings?: GenreMemoSettings;
  shopSettings?: ShopSettings;
}

const GidoApp: React.FC<GidoAppProps> = ({
  mallId,
  locationIconSettings,
  previewFloor,
  previewFloorLayout,
  isPreview = false,
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

  // Sync preview props
  useEffect(() => {
    if (previewFloor !== undefined) setFloor(previewFloor);
  }, [previewFloor]);

  useEffect(() => {
    if (previewFloorLayout !== undefined) setFloorLayout(previewFloorLayout);
  }, [previewFloorLayout]);

  // Periodic image-visibility check (every 5 minutes)
  useEffect(() => {
    if (isPreview) return;
    const intervalId = window.setInterval(() => {
      // Simple reload trigger — the layout components handle their own refs
      setRefreshKey((prev) => prev + 1);
    }, POLLING_INTERVALS.IMAGE_CHECK_MS);
    return () => window.clearInterval(intervalId);
  }, [isPreview]);

  // Shop data loading with SWR pattern
  const loadShops = useCallback(async (providedShops?: Shop[]) => {
    if (providedShops && providedShops.length > 0) {
      logInfo("DATA_SYNC", "Using shops from SSE event", {
        count: providedShops.length,
      });
      setShops(providedShops);
      setError(null);
      saveShopCache(providedShops);
      return;
    }

    let hasShownCache = false;

    try {
      const cached = loadShopCache();
      if (cached && cached.length > 0) {
        setShops(cached);
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
        setShops(apiData);
        setError(null);
        saveShopCache(apiData);
        logInfo("DATA_SYNC", "Shop data synced from API", {
          count: apiData.length,
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

  // Initial shop data load (once on mount).
  // Subsequent updates are driven by SSE events via useBridgeEvents.
  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useBridgeEvents(loadShops);

  // ショップリストの変化（追加・削除）を検出して Slack 通知
  const shopChangeItems = useMemo(
    () => shops.map(s => ({ id: s.shopId || s.number || '', name: s.name })).filter(s => s.id),
    [shops],
  );
  useShopChangeDetection(shopChangeItems, mallId);

  // Select the layout component for the active mall
  const LayoutComponent = LAYOUT_MAP[mallId] ?? SakaikitahanadaLayout;

  return (
    <LayoutComponent
      shops={shops}
      floor={floor}
      floorLayout={floorLayout}
      locationIconSettings={locationIconSettings}
      imageSettings={imageSettings}
      genreMappings={genreMappings}
      genreMemoSettings={genreMemoSettings}
      shopSettings={shopSettings}
      isPreview={isPreview}
      refreshKey={refreshKey}
      error={error}
    />
  );
};

export default GidoApp;
