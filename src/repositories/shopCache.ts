import type { Shop } from "../types/shop";
import { logInfo, logError } from "../logs/logging";

const SHOP_CACHE_KEY = 'gido_shop_data_cache';

export interface ShopCache {
  timestamp: number;
  shops: Shop[];
}

export function saveShopCache(shops: Shop[]) {
  try {
    const cache: ShopCache = {
      timestamp: Date.now(),
      shops,
    };
    localStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(cache));
    logInfo("shopCache", "Shop data cached", { count: shops.length });
  } catch (error) {
    logError("shopCache", "Failed to save shop cache", { error });
  }
}

export function loadShopCache(): Shop[] | null {
  try {
    const raw = localStorage.getItem(SHOP_CACHE_KEY);
    if (!raw) {
      logInfo("shopCache", "No shop cache found");
      return null;
    }
    const cache: ShopCache = JSON.parse(raw);
    logInfo("shopCache", "Shop cache loaded", { 
      count: cache.shops.length, 
      timestamp: new Date(cache.timestamp).toISOString() 
    });
    return cache.shops;
  } catch (error) {
    logError("shopCache", "Failed to load shop cache", { error });
    return null;
  }
}

