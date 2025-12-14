export interface ShopDisplaySetting {
  genreMemoMaxItems?: number;
}

// Key is ShopId
export type ShopSettings = Record<string, ShopDisplaySetting>;

export const INITIAL_SHOP_SETTINGS: ShopSettings = {};


