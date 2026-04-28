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
// Covers both legacy API (suzaka) and new API (sakaikitahanada) field names.
export interface BridgeShop {
  shopId?: string;
  shopName?: string;
  genre?: string;
  genreMemo?: string;
  number?: string;
  floors?: string | string[];  // legacy: comma-separated string or array
  floor?: string;              // new API: singular "1F" / "2F" / "3F"

  // New API additional fields (not yet used in display but declared for type safety)
  shopNameKana?: string;
  shopNameEnglish?: string;
  genreSub?: string;
  genreSubEnglish?: string;
  genreMemoEnglish?: string;
  tenantCode?: string;
  area?: string;
  areaSub?: string;
  description?: string;
  openTime?: string;
  tel?: string;
  userUrl?: string;
  closeFlg?: string | number;
  takeOut?: string;
  alcohol?: string;
  options?: string;
  photo1?: string;
  photo2?: string;
  shopLogo?: string;
  updateDate?: string;

  // snake_case fallbacks for legacy API compatibility
  genre_memo?: string;
  shop_name?: string;
  shop_id?: string;
}

