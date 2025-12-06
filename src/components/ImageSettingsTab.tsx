import React, { useRef, useState } from "react";
import type { FloorId } from "../types/floorLayout";
import type { ImageSettings } from "../types/imageSettings";

export interface ImageSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  imageSettings: ImageSettings;
  onChangeImageSettings: (settings: ImageSettings) => void;
}

const FLOORS: FloorId[] = ["1F", "2F", "3F", "4F"];

export const ImageSettingsTab: React.FC<ImageSettingsTabProps> = ({
  floor,
  onChangeFloor,
  imageSettings,
  onChangeImageSettings,
}) => {
  const floorMapInputRef = useRef<HTMLInputElement>(null);
  const openTimeInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateSvgFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.type !== "image/svg+xml") {
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Basic SVG validation: check if it contains <svg> tag
        if (content && content.includes("<svg")) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "floorMap" | "openTime",
    floorId?: FloorId
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrors({});

    // Validate file type
    if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      const errorKey = type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors({
        ...errors,
        [errorKey]: "SVGファイルのみ選択できます",
      });
      return;
    }

    // Validate SVG content
    const isValid = await validateSvgFile(file);
    if (!isValid) {
      const errorKey = type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors({
        ...errors,
        [errorKey]: "無効なSVGファイルです",
      });
      return;
    }

    // Convert to data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === "floorMap" && floorId) {
        onChangeImageSettings({
          ...imageSettings,
          floorMaps: {
            ...imageSettings.floorMaps,
            [floorId]: dataUrl,
          },
        });
      } else if (type === "openTime") {
        onChangeImageSettings({
          ...imageSettings,
          openTimeImage: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = "";
  };

  const handleRemoveImage = (type: "floorMap" | "openTime", floorId?: FloorId) => {
    if (type === "floorMap" && floorId) {
      onChangeImageSettings({
        ...imageSettings,
        floorMaps: {
          ...imageSettings.floorMaps,
          [floorId]: "",
        },
      });
    } else if (type === "openTime") {
      onChangeImageSettings({
        ...imageSettings,
        openTimeImage: "",
      });
    }
  };

  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        画像設定
      </h2>

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
          accept=".svg,image/svg+xml"
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
          accept=".svg,image/svg+xml"
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




