// src/api/bridgeClient.ts
import { API_BASE_URL, APP_CONFIG } from "../config";
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

// Fetches shop list from BridgeWebPopper and normalizes it to Shop[]
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  const url = `${API_BASE_URL}/api/shops`;

  logInfo("shopList", "Requesting shops from Bridge API", { url });

  try {
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      logWarn("shopList", "Bridge API returned non-200 response", {
        status: res.status,
        statusText: res.statusText,
      });
      throw new Error(`Bridge API error: HTTP ${res.status}`);
    }

    const json = await res.json();

    // Detect structure
    let rawList: BridgeShop[] = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (Array.isArray((json as any).data)) {
      rawList = (json as any).data;
      logInfo(
        "shopList",
        "Bridge API returned data under json.data (legacy format)"
      );
    } else if (Array.isArray((json as any).items)) {
      rawList = (json as any).items;
      logInfo(
        "shopList",
        "Bridge API returned data under json.items (legacy format)"
      );
    } else {
      logInfo("shopList", "Bridge API response did not contain an array", {
        receivedKeys: Object.keys(json),
      });
    }

    const defaultFloor = APP_CONFIG.floor;

    const shops: Shop[] = rawList.map((item) => {
      const floors = parseFloorsFromBridge(item.floors, defaultFloor);

      if (floors.length === 0) {
        logWarn("shopList", "Shop has no floors after normalization", {
          shopId: item.shop_id,
          name: item.shop_name,
          rawFloors: item.floors,
          defaultFloor,
        });
      }

      return {
        shopId: item.shop_id,
        name: item.shop_name,
        genre: item.genre,
        genreMemo: item.genre_memo,
        number: item.number,
        floors,
      };
    });

    logInfo("shopList", "Shops fetched & normalized", {
      count: shops.length,
      defaultFloor,
    });

    return shops;
  } catch (error: any) {
    logError("shopList", "Failed to fetch shops from Bridge API", {
      error: error?.message,
      url,
    });
    throw error;
  }
}
