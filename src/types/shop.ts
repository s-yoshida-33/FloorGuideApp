// src/types/shop.ts

export type FloorId = string;

export interface Shop {
  shopId?: string;
  name: string;
  genre: string;
  genreMemo: string;
  number: string;
  floors: FloorId[];
}

// Raw data type from BridgeWebPopper /api/shops
export interface BridgeShop {
  genre: string;
  number: string;
  genreMemo: string; // CamelCase from API
  shopName: string;  // CamelCase from API
  shopId: string;    // CamelCase from API
  floors?: string | string[];
  
  // Also support snake_case for compatibility if mixed
  genre_memo?: string;
  shop_name?: string;
  shop_id?: string;
}
