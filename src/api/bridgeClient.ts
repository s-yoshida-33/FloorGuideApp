// src/api/bridgeClient.ts
import { API_BASE_URL, APP_CONFIG } from "../config";
import type { BridgeShop, Shop } from "../types/shop";

import { logInfo, logWarn, logError } from "../logging";

// Fetches shop list from BridgeWebPopper and normalizes it to Shop[]
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  logInfo("shopList", "Requesting shops from Bridge API", {
    url: `${API_BASE_URL}/api/shops`,
  });

  try {
    const res = await fetch(`${API_BASE_URL}/api/shops`, {
      method: "GET",
    });

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
      logWarn("shopList", "Bridge API returned data under json.data (legacy format)");
    } else if (Array.isArray((json as any).items)) {
      rawList = (json as any).items;
      logWarn("shopList", "Bridge API returned data under json.items (legacy format)");
    } else {
      logWarn("shopList", "Bridge API response did not contain an array", {
        receivedKeys: Object.keys(json),
      });
    }

    const defaultFloor = APP_CONFIG.floor;

    const shops: Shop[] = rawList.map((item) => ({
      shopId: item.shop_id,
      name: item.shop_name,
      genre: item.genre,
      genreMemo: item.genre_memo,
      number: item.number,
      floor: item.floor ?? defaultFloor,
    }));

    logInfo("shopList", "Shops fetched & normalized", {
      count: shops.length,
      defaultFloor,
    });

    return shops;
  } catch (error: any) {
    logError("shopList", "Failed to fetch shops from Bridge API", {
      error: error?.message,
      url: `${API_BASE_URL}/api/shops`,
    });
    throw error;
  }
}
