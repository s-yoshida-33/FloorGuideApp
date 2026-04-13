import type { FloorId } from "./floorLayout";

export type BannerDisplayMode = 'stack' | 'carousel';

export type BannerSettings = {
  enabled: boolean;
  images: string[];
  displayMode: BannerDisplayMode;
  carouselIntervalMs: number;
  /** Gap between banner images in px (stack mode). Default: 8 */
  gap: number;
  /** Stack mode only: automatically fill the remaining space below the shop list.
   *  Each image scales to fit its equal share of the available height,
   *  maintaining its aspect ratio. */
  autoFit: boolean;
};

export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  enabled: false,
  images: [],
  displayMode: 'carousel',
  carouselIntervalMs: 5000,
  gap: 8,
  autoFit: false,
};

export type ImageSettings = {
  floorMaps: Record<FloorId, string>; // 各階のマップ画像パス（SVGファイルのパスまたはdata URL）
  openTimeImage: string; // 営業時間画像パス（SVGファイルのパスまたはdata URL）
  banner: BannerSettings;
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  floorMaps: {
    "1F": "",
    "2F": "",
    "3F": "",
    "4F": "",
  },
  openTimeImage: "",
  banner: DEFAULT_BANNER_SETTINGS,
};




