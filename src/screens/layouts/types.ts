// src/screens/layouts/types.ts
import type { LocationIconSettings } from "../../types/locationIcon";
import type { ImageSettings } from "../../types/imageSettings";
import type { GenreMappings, GenreMemoSettings } from "../../types/genreSettings";
import type { ShopSettings } from "../../types/shopSettings";
import type { FloorLayout } from "../../types/floorLayout";
import type { Shop } from "../../types/shop";

/**
 * Common props passed to all mall-specific layout components.
 */
export interface LayoutProps {
  shops: Shop[];
  floor: string;
  floorLayout: FloorLayout;
  locationIconSettings: LocationIconSettings;
  imageSettings?: ImageSettings;
  genreMappings?: GenreMappings;
  genreMemoSettings?: GenreMemoSettings;
  shopSettings?: ShopSettings;
  isPreview?: boolean;
  refreshKey: number;
  error: string | null;
}
