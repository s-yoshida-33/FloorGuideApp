// src/api/bridgeClient.ts
import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl, APP_CONFIG } from "../config";
import type { BridgeShop, Shop, FloorId } from "../types/shop";
import { logInfo, logWarn, logError, logDebug } from "../logs/logging";

// Normalize floor id string
function normalizeFloorId(value: string): FloorId {
  if (!value) return "";
  return value.trim().toUpperCase();
}

// Parse floors from BridgeShop into FloorId[]
function parseFloorsFromBridge(
  rawFloors: unknown,
  fallbackFloor: string,
): FloorId[] {
  let floors: string[] = [];

  if (Array.isArray(rawFloors)) {
    floors = rawFloors.map((f) => String(f));
  } else if (typeof rawFloors === "string") {
    floors = rawFloors
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  if (floors.length === 0 && fallbackFloor) {
    floors = [fallbackFloor];
  }

  return floors.map((f) => normalizeFloorId(f)).filter((f) => f !== "");
}

// Helper to extract raw list from various response formats
export function extractShopsFromResponse(json: unknown): BridgeShop[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray((json as Record<string, unknown>)?.data))
    return (json as Record<string, unknown>).data as BridgeShop[];
  if (Array.isArray((json as Record<string, unknown>)?.items))
    return (json as Record<string, unknown>).items as BridgeShop[];
  return [];
}

// Helper to normalize BridgeShop[] to Shop[]
export function normalizeBridgeShops(rawList: BridgeShop[]): Shop[] {
  const defaultFloor = APP_CONFIG.floor;

  return rawList.map((item) => {
    // `floors` (plural, legacy) takes precedence; fall back to `floor` (singular, new API)
    const floors = parseFloorsFromBridge(item.floors ?? item.floor, defaultFloor);
    const shopId = item.shopId ?? item.shop_id;
    const shopName = item.shopName ?? item.shop_name;
    const genreMemo = item.genreMemo ?? item.genre_memo;

    if (floors.length === 0) {
      logWarn("DATA_SYNC", "Shop has no floors after normalization", {
        shopId,
        name: shopName,
        rawFloors: item.floors ?? item.floor,
        defaultFloor,
      });
    }

    return {
      shopId,
      name: shopName ? shopName.replace(/【.*?】/g, "").trim() : "",
      genre: item.genre || "",
      genreMemo: genreMemo || "",
      number: item.number || "",
      floors,
    };
  });
}

/**
 * Fetch genre list from BridgeWebPopper via Rust proxy (CORS bypass).
 */
export async function fetchGenresFromBridge(): Promise<string[]> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/genres`;

  try {
    const response = await invoke<{ status: number; body: string }>(
      "fetch_shops_proxy",
      { url },
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Bridge API error: HTTP ${response.status}`);
    }

    const json: unknown = JSON.parse(response.body);
    const list = Array.isArray(json) ? json : [];
    return list
      .map((item: Record<string, unknown>) => String(item.genreName ?? "").trim())
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
}

/**
 * Fetch shop list from BridgeWebPopper via Rust proxy (CORS bypass).
 */
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/shops`;
  const startTime = Date.now();

  logDebug("DATA_SYNC", "Requesting shops from Bridge API", { url });

  try {
    const response = await invoke<{ status: number; body: string }>(
      "fetch_shops_proxy",
      { url },
    );

    if (response.status < 200 || response.status >= 300) {
      logWarn("DATA_SYNC", "Bridge API sync failed", {
        status: response.status,
        durationMs: Date.now() - startTime,
      });
      throw new Error(
        `Bridge API error: HTTP ${response.status} - Check if Bridge app is running.`,
      );
    }

    const json = JSON.parse(response.body);
    const rawList = extractShopsFromResponse(json);

    if (rawList.length === 0) {
      logWarn("DATA_SYNC", "Bridge API returned 0 items", {
        durationMs: Date.now() - startTime,
      });
    }

    const shops = normalizeBridgeShops(rawList);

    logInfo("DATA_SYNC", "Shop data synced successfully", {
      count: shops.length,
      durationMs: Date.now() - startTime,
    });

    return shops;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    logError("DATA_SYNC", "Failed to fetch shops from Bridge API", {
      error: message,
      url,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}
