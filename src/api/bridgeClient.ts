// src/api/bridgeClient.ts
import { API_BASE_URL, APP_CONFIG } from "../config";
import type { BridgeShop, Shop } from "../types/shop";

// Fetches shop list from BridgeWebPopper and normalizes it to Shop[]
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  const res = await fetch(`${API_BASE_URL}/api/shops`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error(`Bridge API error: HTTP ${res.status}`);
  }

  const json = await res.json();

  // BridgeWebPopper currently returns a flat array,
  // but we keep a small compatibility wrapper for safety.
  const rawList: BridgeShop[] = Array.isArray(json)
    ? json
    : Array.isArray((json as any).data)
    ? (json as any).data
    : Array.isArray((json as any).items)
    ? (json as any).items
    : [];

  const defaultFloor = APP_CONFIG.floor;

  const shops: Shop[] = rawList.map((item) => ({
    shopId: item.shop_id,
    name: item.shop_name,
    genre: item.genre,
    genreMemo: item.genre_memo,
    number: item.number,
    floor: item.floor ?? defaultFloor,
  }));

  return shops;
}
