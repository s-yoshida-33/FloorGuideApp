// src/config/malls.ts
import type { MallId, MallConfig } from '../types/mall';

/**
 * Static configuration for each supported mall.
 * Add new malls here + create a matching layout component in screens/layouts/.
 */
export const MALL_CONFIGS: Record<MallId, MallConfig> = {
  sakaikitahanada: {
    id: "sakaikitahanada",
    name: "堺北花田",
    floors: ["1F", "2F", "3F", "4F"],
    defaultFloor: "3F",
    defaultFloorLayout: {
      "1F": { columns: 3, rowsPerCol: 20 },
      "2F": { columns: 2, rowsPerCol: 19 },
      "3F": { columns: 3, rowsPerCol: 20 },
      "4F": { columns: 2, rowsPerCol: 18 },
    },
    videoOrientation: "vertical",
    hasOpenTimeImage: true,
    hasBlackScreen: true,
    genreOrder: [
      "ファッション",
      "ファッション雑貨",
      "雑貨",
      "飲食店・食品",
      "サービス",
    ],
    genreEnglish: {
      "ファッション": "Fashion",
      "ファッション雑貨": "Fashion Goods",
      "雑貨": "Goods",
      "飲食店・食品": "Food & Beverage",
      "サービス": "Services",
    },
  },
  suzaka: {
    id: "suzaka",
    name: "須坂",
    floors: ["1F", "2F", "3F"],
    defaultFloor: "3F",
    defaultFloorLayout: {
      "1F": { columns: 3, rowsPerCol: 20 },
      "2F": { columns: 2, rowsPerCol: 19 },
      "3F": { columns: 3, rowsPerCol: 20 },
    },
    videoOrientation: "horizontal",
    hasOpenTimeImage: false,
    hasBlackScreen: false,
    genreOrder: [
      "ファッション",
      "ファッション雑貨",
      "雑貨",
      "飲食店・食品",
      "サービス",
    ],
    genreEnglish: {
      "ファッション": "Fashion",
      "ファッション雑貨": "Fashion Goods",
      "雑貨": "Goods",
      "飲食店・食品": "Food & Beverage",
      "サービス": "Services",
    },
  },
};

/** All available mall IDs */
export const ALL_MALL_IDS: MallId[] = Object.keys(MALL_CONFIGS) as MallId[];

/** Get config for a specific mall, with fallback to sakaikitahanada */
export function getMallConfig(mallId: MallId): MallConfig {
  return MALL_CONFIGS[mallId] ?? MALL_CONFIGS.sakaikitahanada;
}
