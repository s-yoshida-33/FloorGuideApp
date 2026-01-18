// src/api/bridgeClient.ts
import { getApiBaseUrl, APP_CONFIG } from "../config";
import type { BridgeShop, Shop, FloorId } from "../types/shop";

import { logInfo, logWarn, logError } from "../logs/logging";

// Normalize floor id string (you can extend this if needed)
function normalizeFloorId(value: string): FloorId {
  if (!value) return "";
  return value.trim().toUpperCase(); // e.g. "1f" -> "1F"
}

// Parse floors from BridgeShop into FloorId[]
function parseFloorsFromBridge(
  rawFloors: unknown,
  fallbackFloor: string
): FloorId[] {
  let floors: string[] = [];

  if (Array.isArray(rawFloors)) {
    // Already an array: ["1F", "2F", "3F"]
    floors = rawFloors.map((f) => String(f));
  } else if (typeof rawFloors === "string") {
    // Comma-separated string: "1F,2F,3F"
    floors = rawFloors
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  // If floors is still empty, fallback to provided default floor
  if (floors.length === 0 && fallbackFloor) {
    floors = [fallbackFloor];
  }

  // Normalize and remove empty values
  const normalized = floors
    .map((f) => normalizeFloorId(f))
    .filter((f) => f !== "");

  return normalized;
}

// Helper to extract raw list from various response formats
export function extractShopsFromResponse(json: any): BridgeShop[] {
  let rawList: BridgeShop[] = [];
  if (Array.isArray(json)) {
    rawList = json;
  } else if (Array.isArray(json?.data)) {
    rawList = json.data;
    // logInfo("shopList", "Data found under json.data");
  } else if (Array.isArray(json?.items)) {
    rawList = json.items;
    // logInfo("shopList", "Data found under json.items");
  }
  return rawList;
}

// Helper to normalize BridgeShop[] to Shop[]
export function normalizeBridgeShops(rawList: BridgeShop[]): Shop[] {
  const defaultFloor = APP_CONFIG.floor;

  return rawList.map((item) => {
    const floors = parseFloorsFromBridge(item.floors, defaultFloor);
    const shopId = item.shopId ?? item.shop_id;
    const shopName = item.shopName ?? item.shop_name;
    const genreMemo = item.genreMemo ?? item.genre_memo;

    if (floors.length === 0) {
      logWarn("shopList", "Shop has no floors after normalization", {
        shopId,
        name: shopName,
        rawFloors: item.floors,
        defaultFloor,
      });
    }

    return {
      shopId: shopId,
      name: shopName || "",
      genre: item.genre,
      genreMemo: genreMemo || "",
      number: item.number,
      floors,
    };
  });
}

// Fetches shop list from BridgeWebPopper and normalizes it to Shop[]
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/shops`;
  const startTime = Date.now();

  logInfo("DATA_SYNC", "Requesting shops from Bridge API", { url });

  try {
    const res = await fetch(url, { 
      method: "GET",
      cache: "no-store",
      headers: {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      }
    });

    if (!res.ok) {
      logWarn("DATA_SYNC", "Bridge API sync failed", {
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - startTime
      });
      throw new Error(`Bridge API error: HTTP ${res.status} - Check if Bridge app is running and port ${baseUrl} is correct.`);
    }

    const json = await res.json();
    const rawList = extractShopsFromResponse(json);
    
    // Warn if 0 items found
    if (rawList.length === 0) {
       logWarn("DATA_SYNC", "Bridge API returned 0 items", {
        receivedKeys: Object.keys(json),
        durationMs: Date.now() - startTime
      });
    }

    const shops = normalizeBridgeShops(rawList);

    logInfo("DATA_SYNC", "Shop data synced successfully", {
      count: shops.length,
      durationMs: Date.now() - startTime,
      defaultFloor: APP_CONFIG.floor,
    });

    return shops;
  } catch (error: any) {
    logError("DATA_SYNC", "Failed to fetch shops from Bridge API", {
      error: error?.message,
      url,
      durationMs: Date.now() - startTime,
      hint: "Ensure BridgeWebPopper is running and the port range (default: 8090-8099) is accessible."
    });
    throw error;
  }
}