// src/repositories/shopRepository.ts
import { DATA_SOURCE, GENRE_ORDER } from "../config";
import type { Shop } from "../types/shop";
import { fetchShopsFromBridge } from "../api/bridgeClient";

export interface GroupedShops {
  genres: string[];
  byGenre: Record<string, Shop[]>;
}

// Entry point for fetching shops
export async function fetchShops(): Promise<Shop[]> {
  switch (DATA_SOURCE) {
    case "bridge":
      return fetchShopsFromBridge();

    // case "api":
    //   return fetchShopsFromApi();

    // case "cms":
    //   return fetchShopsFromCms();

    // case "hybrid":
    //   return fetchShopsHybrid();

    default:
      return fetchShopsFromBridge();
  }
}

// Sort helper: compare shop numbers in ascending order (e.g. "103" < "110" < "112")
export function compareShopNumberAsc(a: Shop, b: Shop): number {
  return (a.number || "").localeCompare(b.number || "", "ja", {
    numeric: true,
    sensitivity: "base",
  });
}

// Group shops by genre and keep genre order for rendering
export function groupShopsByGenre(shops: Shop[]): GroupedShops {
  const byGenre: Record<string, Shop[]> = {};

  // Initialize known genres
  for (const g of GENRE_ORDER) {
    byGenre[g] = [];
  }

  // Put shops into buckets
  for (const shop of shops) {
    const key = shop.genre;
    if (!byGenre[key]) {
      byGenre[key] = [];
    }
    byGenre[key].push(shop);
  }

  // Sort shops in each genre by number
  for (const key of Object.keys(byGenre)) {
    byGenre[key].sort(compareShopNumberAsc);
  }

  // Build ordered genre list:
  //   1. genres defined in GENRE_ORDER that actually have data
  //   2. other genres (not in GENRE_ORDER) that also have data
  const genres: string[] = [];

  for (const g of GENRE_ORDER) {
    if (byGenre[g] && byGenre[g].length > 0) {
      genres.push(g);
    }
  }

  for (const key of Object.keys(byGenre)) {
    if (!GENRE_ORDER.includes(key) && byGenre[key].length > 0) {
      genres.push(key);
    }
  }

  return { genres, byGenre };
}
