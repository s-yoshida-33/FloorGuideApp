import React, { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FloorId } from "../types/floorLayout";
import type { ImageSettings } from "../types/imageSettings";
import { saveImageFile, deleteImageFile } from "../utils/settings";
import { logInfo, logError } from "../logs/logging";
import { useMapForceFetch } from "../hooks/useMapForceFetch";

export interface ImageSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  imageSettings: ImageSettings;
  onChangeImageSettings: (settings: ImageSettings) => void;
  floors?: FloorId[];
  mallId?: string;
  hostname?: string;
  onMapsFetchedFromS3?: () => void;
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
  onMapsFetchedFromS3,
}) => {
  const floorMapInputRef = useRef<HTMLInputElement>(null);
  const openTimeInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { status: fetchStatus, fetchMaps, reset: resetFetch } = useMapForceFetch();

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

  const isFetching = fetchStatus.status === 'fetching';

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
          {isFetching ? "取得中..." : "S3からマップ取得"}
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
    </div>
  );
};
