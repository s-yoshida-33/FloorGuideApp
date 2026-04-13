// src/screens/layouts/SakaikitahanadaVLayout.tsx
// Layout for 堺北花田（縦） mall — 縦長3列レイアウト
// Left: shop list | Center: vertical floor map | Right: video + open-time image

import React, { useRef } from "react";

import ShopList from "../../components/ShopList";
import BannerArea from "../../components/BannerArea";
import VerticalVideoSlot from "../../components/VerticalVideoSlot";
import { LocationIconsOverlay } from "../../components/LocationIconsOverlay";
import { DEFAULT_BANNER_SETTINGS } from "../../types/imageSettings";

import floorMap2F from "../../assets/malls/sakaikitahanada/floor-v-2F-map.webp";
import floorMap3F from "../../assets/malls/sakaikitahanada/floor-v-3F-map.webp";
import floorMap4F from "../../assets/malls/sakaikitahanada/floor-v-4F-map.webp";
import openTimeImage from "../../assets/malls/sakaikitahanada/open-time.webp";

import { APP_CONFIG } from "../../config";
import type { FloorId } from "../../types/floorLayout";
import {
  DEFAULT_GENRE_MAPPINGS,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "../../types/genreSettings";
import { logInfo, logError } from "../../logs/logging";
import type { LayoutProps } from "./types";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

const FLOOR_MAPS: Record<string, string> = {
  "2F": floorMap2F,
  "3F": floorMap3F,
  "4F": floorMap4F,
};

const DEFAULT_FLOOR_LAYOUT = {
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

// Column width ratios based on 3840x2160 (4K) target display
// Left (shop list): 960px, Center (map): 2115px, Right (video+open-time): 765px
const SHOP_LIST_WIDTH_VW = (960 / 3840) * 100;   // 25%
const MAP_WIDTH_VW = (2115 / 3840) * 100;         // ~55.08%

const SakaikitahanadaVLayout: React.FC<LayoutProps> = ({
  shops,
  floor,
  floorLayout,
  locationIconSettings,
  imageSettings,
  genreMappings = DEFAULT_GENRE_MAPPINGS,
  genreMemoSettings = DEFAULT_GENRE_MEMO_SETTINGS,
  shopSettings,
  isPreview = false,
  error,
}) => {
  const floorMapRef = useRef<HTMLImageElement>(null);
  const openTimeImageRef = useRef<HTMLImageElement>(null);
  const floorMapLoggedRef = useRef(false);
  const openTimeLoggedRef = useRef(false);

  const floorId = floor as FloorId;
  const customFloorMap = floorId
    ? imageSettings?.floorMaps?.[floorId]
    : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || floorMap2F;

  const banner = imageSettings?.banner ?? DEFAULT_BANNER_SETTINGS;

  const currentLayout =
    floorLayout[floor] ??
    DEFAULT_FLOOR_LAYOUT[floor as keyof typeof DEFAULT_FLOOR_LAYOUT] ??
    DEFAULT_FLOOR_LAYOUT["2F"];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        fontWeight: 700,
      }}
    >
      {/* Left: shop list + banner (full height) */}
      <div
        style={{
          width: `${SHOP_LIST_WIDTH_VW}vw`,
          height: "100vh",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
        }}
      >
        {error ? (
          <div style={{ padding: "16px 32px", color: "red" }}>
            Error: {error}
          </div>
        ) : (
          <>
            <ShopList
              shops={shops}
              floor={floor}
              columnCount={currentLayout.columns}
              rowsPerColumn={currentLayout.rowsPerCol}
              perColumnRows={currentLayout.perColumnRows}
              perColumnPadding={currentLayout.perColumnPadding}
              genreGap={currentLayout.genreGap}
              genreMappings={genreMappings}
              genreMemoSettings={genreMemoSettings}
              shopSettings={shopSettings}
              fitContent
            />
            {/* Spacer pushes banner to bottom */}
            <div style={{ flex: 1 }} />
            {banner.enabled && banner.images.length > 0 && (
              <div style={{ padding: "0 16px 10px" }}>
                <BannerArea
                  images={banner.images}
                  displayMode={banner.displayMode}
                  carouselIntervalMs={banner.carouselIntervalMs}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Center: floor map (full height) */}
      <div
        style={{
          width: `${MAP_WIDTH_VW}vw`,
          height: "100vh",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <img
          ref={floorMapRef}
          src={floorMap}
          alt={`Floor map ${floor}`}
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
          onLoad={(event) => {
            (event.target as HTMLImageElement).style.visibility = "";
            if (!floorMapLoggedRef.current) {
              logInfo("ASSET_CHECK", "Floor map rendered", { floor });
              floorMapLoggedRef.current = true;
            }
          }}
          onError={(event) => {
            logError("ASSET_CHECK", "Floor map load failed", {
              floor,
              reason: "FILE_NOT_FOUND_OR_CORRUPT",
            });
            (event.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <LocationIconsOverlay settings={locationIconSettings} />
      </div>

      {/* Right: video (top) + open-time image (bottom) — unchanged */}
      <div
        style={{
          flex: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Video area (vertical 9:16) */}
        <div
          style={{
            height: `${TOP_HEIGHT_VH}vh`,
            background: "#000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              background: "#000",
            }}
          >
            {isPreview ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                  fontSize: "1.5vh",
                  fontWeight: "normal",
                }}
              >
                (設定中は非表示)
              </div>
            ) : (
              <VerticalVideoSlot />
            )}
          </div>
        </div>

        {/* Open-time image */}
        <div
          style={{
            height: `${LIST_HEIGHT_VH}vh`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#fff",
          }}
        >
          <img
            ref={openTimeImageRef}
            src={imageSettings?.openTimeImage || openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "1.4em",
            }}
            onLoad={(event) => {
              (event.target as HTMLImageElement).style.visibility = "";
              if (!openTimeLoggedRef.current) {
                logInfo("ASSET_CHECK", "Open-time image loaded");
                openTimeLoggedRef.current = true;
              }
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Failed to load open-time image");
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SakaikitahanadaVLayout;
