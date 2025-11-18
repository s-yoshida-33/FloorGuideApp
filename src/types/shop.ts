// src/types/shop.ts

export type FloorId = string;

export interface Shop {
  shopId?: string;
  name: string;
  genre: string;
  genreMemo: string;
  number: string;
  floor: FloorId;
}

// Raw data type from BridgeWebPopper /api/shops
export interface BridgeShop {
  genre: string;
  number: string;
  genre_memo: string;
  shop_name: string;
  floor?: string;
  shop_id?: string;
}
