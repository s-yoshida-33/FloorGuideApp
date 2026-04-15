import React, { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FloorId } from "../types/floorLayout";
import type { BannerDisplayMode, ImageSettings } from "../types/imageSettings";
import { DEFAULT_BANNER_SETTINGS } from "../types/imageSettings";
import { saveImageFile, deleteImageFile } from "../utils/settings";
import { logInfo, logError } from "../logs/logging";
import { useMapForceFetch } from "../hooks/useMapForceFetch";
import { useOpenTimeForceFetch } from "../hooks/useOpenTimeForceFetch";
import { useBannerForceFetch } from "../hooks/useBannerForceFetch";

export interface ImageSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  imageSettings: ImageSettings;
  onChangeImageSettings: (settings: ImageSettings) => void;
  floors?: FloorId[];
  mallId?: string;
  hostname?: string;
  /** Layout ID used for the banner S3 path (e.g. "sakaikitahanada-v"). If omitted, banner S3 fetch is hidden. */
  bannerLayoutId?: string;
  onMapsFetchedFromS3?: () => void;
  onOpenTimeFetchedFromS3?: () => void;
}

const DEFAULT_FLOORS: FloorId[] = ["1F", "2F", "3F", "4F"];

export const ImageSettingsTab: React.FC<ImageSettingsTabProps> = ({
  floor,
  onChangeFloor,
  imageSettings,
  onChangeImageSettings,
  floors: FLOORS = DEFAULT_FLOORS,
  mallId = '',
  hostname = '',
  bannerLayoutId,
  onMapsFetchedFromS3,
  onOpenTimeFetchedFromS3,
}) => {
  const floorMapInputRef = useRef<HTMLInputElement>(null);
  const openTimeInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { status: fetchStatus, fetchMaps, reset: resetFetch } = useMapForceFetch();
  const { status: openTimeFetchStatus, fetchOpenTime, reset: resetOpenTimeFetch } = useOpenTimeForceFetch();
  const { status: bannerFetchStatus, fetchBanners, reset: resetBannerFetch } = useBannerForceFetch();

  const handleFetchMapsFromS3 = async () => {
    resetFetch();
    const floorMaps = await fetchMaps(mallId, hostname);
    if (!floorMaps) return;
    onChangeImageSettings({
      ...imageSettings,
      floorMaps: { ...imageSettings.floorMaps, ...floorMaps },
    });
    onMapsFetchedFromS3?.();
  };

  const handleFetchOpenTimeFromS3 = async () => {
    resetOpenTimeFetch();
    const assetUrl = await fetchOpenTime(mallId);
    if (!assetUrl) return;
    onChangeImageSettings({
      ...imageSettings,
      openTimeImage: assetUrl,
    });
    onOpenTimeFetchedFromS3?.();
  };

  const handleFetchBannersFromS3 = async () => {
    if (!bannerLayoutId) return;
    resetBannerFetch();
    const assetUrls = await fetchBanners(bannerLayoutId, hostname);
    if (!assetUrls) return;
    onChangeImageSettings({
      ...imageSettings,
      banner: { ...(imageSettings.banner ?? DEFAULT_BANNER_SETTINGS), images: assetUrls },
    });
  };

  const isFetching = fetchStatus.status === 'fetching';
  const isOpenTimeFetching = openTimeFetchStatus.status === 'fetching';
  const isBannerFetching = bannerFetchStatus.status === 'fetching';

  /**
   * Handle file selection: read as bytes, save via Rust, store asset URL.
   * No Base64 encoding at any stage.
   */
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "floorMap" | "openTime",
    floorId?: FloorId,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrors({});

    // Validate file type (WebP, PNG, JPEG)
    const allowedTypes = ["image/webp", "image/png", "image/jpeg"];
    const allowedExts = [".webp", ".png", ".jpg", ".jpeg"];
    const isTypeValid = allowedTypes.includes(file.type);
    const isExtValid = allowedExts.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );

    if (!isTypeValid && !isExtValid) {
      const errorKey =
        type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors((prev) => ({
        ...prev,
        [errorKey]: "対応している画像形式は WebP, PNG, JPEG です",
      }));
      return;
    }

    try {
      // Read file as raw bytes (no Base64)
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Determine filename
      const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
      const filename =
        type === "floorMap"
          ? `floor-${floorId}-map.${ext}`
          : `open-time.${ext}`;

      // Save to disk via Rust backend
      const absPath = await saveImageFile(filename, data);
      const assetUrl = convertFileSrc(absPath);

      logInfo("CONFIG", "Image file saved", { type, filename, absPath });

      // Update settings with asset URL
      if (type === "floorMap" && floorId) {
        onChangeImageSettings({
          ...imageSettings,
          floorMaps: {
            ...imageSettings.floorMaps,
            [floorId]: assetUrl,
          },
        });
      } else if (type === "openTime") {
        onChangeImageSettings({
          ...imageSettings,
          openTimeImage: assetUrl,
        });
      }
    } catch (err) {
      logError("CONFIG", "Failed to save image file", {
        error: err instanceof Error ? err.message : String(err),
      });
      const errorKey =
        type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors((prev) => ({
        ...prev,
        [errorKey]: "画像の保存に失敗しました",
      }));
    }

    // Reset input
    event.target.value = "";
  };

  const banner = imageSettings.banner ?? DEFAULT_BANNER_SETTINGS;

  const handleBannerFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrors({});

    const allowedTypes = ["image/webp", "image/png", "image/jpeg"];
    const allowedExts = [".webp", ".png", ".jpg", ".jpeg"];
    const isTypeValid = allowedTypes.includes(file.type);
    const isExtValid = allowedExts.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );

    if (!isTypeValid && !isExtValid) {
      setErrors((prev) => ({
        ...prev,
        banner: "対応している画像形式は WebP, PNG, JPEG です",
      }));
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
      const index = banner.images.length;
      const filename = `banner-${index}.${ext}`;

      const absPath = await saveImageFile(filename, data);
      const assetUrl = convertFileSrc(absPath);

      logInfo("CONFIG", "Banner image saved", { filename, absPath });

      onChangeImageSettings({
        ...imageSettings,
        banner: {
          ...banner,
          images: [...banner.images, assetUrl],
        },
      });
    } catch (err) {
      logError("CONFIG", "Failed to save banner image", {
        error: err instanceof Error ? err.message : String(err),
      });
      setErrors((prev) => ({ ...prev, banner: "画像の保存に失敗しました" }));
    }

    event.target.value = "";
  };

  const handleMoveBannerImage = (index: number, direction: "up" | "down") => {
    const images = [...banner.images];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= images.length) return;
    [images[index], images[swapIndex]] = [images[swapIndex], images[index]];
    onChangeImageSettings({
      ...imageSettings,
      banner: { ...banner, images },
    });
  };

  const handleRemoveBannerImage = async (index: number) => {
    try {
      // Try common extensions
      for (const ext of ["webp", "png", "jpg", "jpeg"]) {
        await deleteImageFile(`banner-${index}.${ext}`).catch(() => {});
      }
    } catch {
      // ignore
    }
    const newImages = banner.images.filter((_, i) => i !== index);
    onChangeImageSettings({
      ...imageSettings,
      banner: { ...banner, images: newImages },
    });
  };

  const handleRemoveImage = async (
    type: "floorMap" | "openTime",
    floorId?: FloorId,
  ) => {
    try {
      if (type === "floorMap" && floorId) {
        await deleteImageFile(`floor-${floorId}-map.webp`).catch(() => {});
        await deleteImageFile(`floor-${floorId}-map.png`).catch(() => {});
        await deleteImageFile(`floor-${floorId}-map.jpg`).catch(() => {});
        onChangeImageSettings({
          ...imageSettings,
          floorMaps: {
            ...imageSettings.floorMaps,
            [floorId]: "",
          },
        });
      } else if (type === "openTime") {
        await deleteImageFile("open-time.webp").catch(() => {});
        await deleteImageFile("open-time.png").catch(() => {});
        await deleteImageFile("open-time.jpg").catch(() => {});
        onChangeImageSettings({
          ...imageSettings,
          openTimeImage: "",
        });
      }
    } catch (err) {
      logError("CONFIG", "Failed to delete image file", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div style={{ color: "#ffffff" }}>
      {/* S3 Map Fetch */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={handleFetchMapsFromS3}
          disabled={isFetching || !hostname}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: isFetching ? "#2E7D32" : "#388E3C",
            border: "none",
            borderRadius: 4,
            color: isFetching || !hostname ? "#9E9E9E" : "#ffffff",
            cursor: isFetching || !hostname ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
          title={!hostname ? "ホスト名を先に設定してください" : undefined}
        >
          {isFetching ? "取得中..." : "最新のマップ画像を取得"}
        </button>

        {fetchStatus.status !== 'idle' && (
          <div style={{ marginTop: 8 }}>
            {isFetching && (
              <div
                style={{
                  height: 4,
                  backgroundColor: "#2A3F55",
                  borderRadius: 2,
                  marginBottom: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${fetchStatus.progress}%`,
                    backgroundColor: "#4A9EFF",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: 12,
                color:
                  fetchStatus.status === 'error'
                    ? "#EF9A9A"
                    : fetchStatus.status === 'done'
                    ? "#A5D6A7"
                    : "#9E9E9E",
              }}
            >
              {fetchStatus.message}
            </div>
          </div>
        )}
      </div>

      {/* Floor Selection */}
      <div style={{ marginBottom: 32 }}>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          階を選択
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {FLOORS.map((f) => (
            <button
              key={f}
              onClick={() => onChangeFloor(f)}
              style={{
                flex: 1,
                padding: "8px 16px",
                backgroundColor: floor === f ? "#4A9EFF" : "#3A3A3A",
                border: `1px solid ${floor === f ? "#4A9EFF" : "#4A4A4A"}`,
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Floor Map Image */}
      <div style={{ marginBottom: 32 }}>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          {floor} マップ画像
        </label>
        <input
          ref={floorMapInputRef}
          type="file"
          accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e, "floorMap", floor)}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => floorMapInputRef.current?.click()}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#4A9EFF",
              border: "none",
              borderRadius: 4,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            画像を選択
          </button>
          {imageSettings.floorMaps[floor] && (
            <button
              onClick={() => handleRemoveImage("floorMap", floor)}
              style={{
                padding: "10px 16px",
                backgroundColor: "#E53935",
                border: "none",
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              削除
            </button>
          )}
        </div>
        {errors[`floorMap-${floor}`] && (
          <div style={{ color: "#E53935", fontSize: 12, marginTop: 4 }}>
            {errors[`floorMap-${floor}`]}
          </div>
        )}
        {imageSettings.floorMaps[floor] && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: "#1A1A1A",
              borderRadius: 4,
              border: "1px solid #3A3A3A",
            }}
          >
            <img
              src={imageSettings.floorMaps[floor]}
              alt={`${floor} map preview`}
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* Open Time Image */}
      <div>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          営業時間画像
        </label>
        {/* S3 Open-time Fetch */}
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleFetchOpenTimeFromS3}
            disabled={isOpenTimeFetching || !mallId}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: isOpenTimeFetching ? "#2E7D32" : "#388E3C",
              border: "none",
              borderRadius: 4,
              color: isOpenTimeFetching || !mallId ? "#9E9E9E" : "#ffffff",
              cursor: isOpenTimeFetching || !mallId ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
            title={!mallId ? "モールIDを先に設定してください" : undefined}
          >
            {isOpenTimeFetching ? "取得中..." : "最新の営業時間を取得"}
          </button>

          {openTimeFetchStatus.status !== 'idle' && (
            <div style={{ marginTop: 8 }}>
              {isOpenTimeFetching && (
                <div
                  style={{
                    height: 4,
                    backgroundColor: "#2A3F55",
                    borderRadius: 2,
                    marginBottom: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${openTimeFetchStatus.progress}%`,
                      backgroundColor: "#4A9EFF",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color:
                    openTimeFetchStatus.status === 'error'
                      ? "#EF9A9A"
                      : openTimeFetchStatus.status === 'done'
                      ? "#A5D6A7"
                      : "#9E9E9E",
                }}
              >
                {openTimeFetchStatus.message}
              </div>
            </div>
          )}
        </div>

        <input
          ref={openTimeInputRef}
          type="file"
          accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e, "openTime")}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => openTimeInputRef.current?.click()}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#4A9EFF",
              border: "none",
              borderRadius: 4,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            画像を選択
          </button>
          {imageSettings.openTimeImage && (
            <button
              onClick={() => handleRemoveImage("openTime")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#E53935",
                border: "none",
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              削除
            </button>
          )}
        </div>
        {errors.openTime && (
          <div style={{ color: "#E53935", fontSize: 12, marginTop: 4 }}>
            {errors.openTime}
          </div>
        )}
        {imageSettings.openTimeImage && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: "#1A1A1A",
              borderRadius: 4,
              border: "1px solid #3A3A3A",
            }}
          >
            <img
              src={imageSettings.openTimeImage}
              alt="Open time preview"
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* Banner Images */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <label
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#E0E0E0",
            }}
          >
            バナー画像
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={banner.enabled}
              onChange={(e) =>
                onChangeImageSettings({
                  ...imageSettings,
                  banner: { ...banner, enabled: e.target.checked },
                })
              }
            />
            <span style={{ fontSize: 13, color: "#BDBDBD" }}>表示する</span>
          </label>
        </div>

        {/* S3 Banner Fetch — only shown when bannerLayoutId is provided */}
        {bannerLayoutId && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleFetchBannersFromS3}
              disabled={isBannerFetching || !hostname}
              style={{
                width: "100%",
                padding: "10px 16px",
                backgroundColor: isBannerFetching ? "#2E7D32" : "#388E3C",
                border: "none",
                borderRadius: 4,
                color: isBannerFetching || !hostname ? "#9E9E9E" : "#ffffff",
                cursor: isBannerFetching || !hostname ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
              title={!hostname ? "ホスト名を先に設定してください" : undefined}
            >
              {isBannerFetching ? "取得中..." : "最新のバナーを取得"}
            </button>

            {bannerFetchStatus.status !== 'idle' && (
              <div style={{ marginTop: 8 }}>
                {isBannerFetching && (
                  <div
                    style={{
                      height: 4,
                      backgroundColor: "#2A3F55",
                      borderRadius: 2,
                      marginBottom: 6,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${bannerFetchStatus.progress}%`,
                        backgroundColor: "#4A9EFF",
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12,
                    color:
                      bannerFetchStatus.status === 'error'
                        ? "#EF9A9A"
                        : bannerFetchStatus.status === 'done'
                        ? "#A5D6A7"
                        : "#9E9E9E",
                  }}
                >
                  {bannerFetchStatus.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Display mode */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "#BDBDBD", marginBottom: 6 }}>
            表示方法
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["stack", "carousel"] as BannerDisplayMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  onChangeImageSettings({
                    ...imageSettings,
                    banner: { ...banner, displayMode: mode },
                  })
                }
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  backgroundColor:
                    banner.displayMode === mode ? "#4A9EFF" : "#3A3A3A",
                  border: `1px solid ${banner.displayMode === mode ? "#4A9EFF" : "#4A4A4A"}`,
                  borderRadius: 4,
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {mode === "stack" ? "縦並び" : "カルーセル"}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel interval */}
        {banner.displayMode === "carousel" && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{ fontSize: 13, color: "#BDBDBD", marginBottom: 6, display: "block" }}
            >
              切替間隔（秒）
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={Math.round(banner.carouselIntervalMs / 1000)}
              onChange={(e) => {
                const sec = Math.max(1, parseInt(e.target.value, 10) || 1);
                onChangeImageSettings({
                  ...imageSettings,
                  banner: { ...banner, carouselIntervalMs: sec * 1000 },
                });
              }}
              style={{
                width: 80,
                padding: "6px 8px",
                backgroundColor: "#2A2A2A",
                border: "1px solid #4A4A4A",
                borderRadius: 4,
                color: "#ffffff",
                fontSize: 14,
              }}
            />
          </div>
        )}

        {/* Gap between images */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{ fontSize: 13, color: "#BDBDBD", marginBottom: 6, display: "block" }}
          >
            画像間の余白（px）
          </label>
          <input
            type="number"
            min={0}
            max={200}
            value={banner.gap ?? 8}
            onChange={(e) => {
              const px = Math.max(0, parseInt(e.target.value, 10) || 0);
              onChangeImageSettings({
                ...imageSettings,
                banner: { ...banner, gap: px },
              });
            }}
            style={{
              width: 80,
              padding: "6px 8px",
              backgroundColor: "#2A2A2A",
              border: "1px solid #4A4A4A",
              borderRadius: 4,
              color: "#ffffff",
              fontSize: 14,
            }}
          />
        </div>

        {/* Bottom margin */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{ fontSize: 13, color: "#BDBDBD", marginBottom: 6, display: "block" }}
          >
            バナー下の余白（px）
          </label>
          <input
            type="number"
            min={0}
            max={500}
            value={banner.bottomMargin ?? 10}
            onChange={(e) => {
              const px = Math.max(0, parseInt(e.target.value, 10) || 0);
              onChangeImageSettings({
                ...imageSettings,
                banner: { ...banner, bottomMargin: px },
              });
            }}
            style={{
              width: 80,
              padding: "6px 8px",
              backgroundColor: "#2A2A2A",
              border: "1px solid #4A4A4A",
              borderRadius: 4,
              color: "#ffffff",
              fontSize: 14,
            }}
          />
        </div>

        {/* Auto-fit (stack mode only) */}
        {banner.displayMode === "stack" && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={banner.autoFit ?? false}
                style={{ marginTop: 2, flexShrink: 0 }}
                onChange={(e) =>
                  onChangeImageSettings({
                    ...imageSettings,
                    banner: { ...banner, autoFit: e.target.checked },
                  })
                }
              />
              <span style={{ fontSize: 13, color: "#BDBDBD", lineHeight: 1.4 }}>
                ショップリスト下の余白に自動で収める
                <span style={{ display: "block", fontSize: 11, color: "#757575", marginTop: 2 }}>
                  アスペクト比を保ちながら、各画像を残りのスペースに均等配置します
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Center align */}
        {!banner.autoFit && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={banner.centerAlign ?? false}
                style={{ marginTop: 2, flexShrink: 0 }}
                onChange={(e) =>
                  onChangeImageSettings({
                    ...imageSettings,
                    banner: { ...banner, centerAlign: e.target.checked },
                  })
                }
              />
              <span style={{ fontSize: 13, color: "#BDBDBD", lineHeight: 1.4 }}>
                余白の中央に配置
                <span style={{ display: "block", fontSize: 11, color: "#757575", marginTop: 2 }}>
                  複数枚の場合はグループごと中央に配置します
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Add banner image */}
        <input
          ref={bannerInputRef}
          type="file"
          accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
          style={{ display: "none" }}
          onChange={handleBannerFileSelect}
        />
        <button
          onClick={() => bannerInputRef.current?.click()}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: "#4A9EFF",
            border: "none",
            borderRadius: 4,
            color: "#ffffff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          バナー画像を追加
        </button>

        {errors.banner && (
          <div style={{ color: "#E53935", fontSize: 12, marginBottom: 8 }}>
            {errors.banner}
          </div>
        )}

        {/* Image list */}
        {banner.images.map((src, idx) => (
          <div
            key={src}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              padding: 8,
              backgroundColor: "#1A1A1A",
              borderRadius: 4,
              border: "1px solid #3A3A3A",
            }}
          >
            <img
              src={src}
              alt={`バナー ${idx + 1}`}
              style={{
                width: 80,
                height: 50,
                objectFit: "contain",
                flexShrink: 0,
                backgroundColor: "#2A2A2A",
              }}
            />
            <span style={{ flex: 1, fontSize: 12, color: "#9E9E9E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              バナー {idx + 1}
            </span>
            {/* Reorder buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <button
                onClick={() => handleMoveBannerImage(idx, "up")}
                disabled={idx === 0}
                style={{
                  padding: "2px 8px",
                  backgroundColor: idx === 0 ? "#2A2A2A" : "#4A4A4A",
                  border: "none",
                  borderRadius: 3,
                  color: idx === 0 ? "#555" : "#ffffff",
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                ▲
              </button>
              <button
                onClick={() => handleMoveBannerImage(idx, "down")}
                disabled={idx === banner.images.length - 1}
                style={{
                  padding: "2px 8px",
                  backgroundColor: idx === banner.images.length - 1 ? "#2A2A2A" : "#4A4A4A",
                  border: "none",
                  borderRadius: 3,
                  color: idx === banner.images.length - 1 ? "#555" : "#ffffff",
                  cursor: idx === banner.images.length - 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                ▼
              </button>
            </div>
            <button
              onClick={() => handleRemoveBannerImage(idx)}
              style={{
                padding: "6px 12px",
                backgroundColor: "#E53935",
                border: "none",
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
