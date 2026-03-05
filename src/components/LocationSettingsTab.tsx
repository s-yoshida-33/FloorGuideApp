// src/components/LocationSettingsTab.tsx
import React, { useEffect, useState, useCallback } from "react";
import type { FloorId } from "../types/floorLayout";
import type { LocationIconSettings, IconPositionConfig, AnimationType } from "../types/locationIcon";

export interface LocationSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  locationIconSettings: LocationIconSettings;
  onChangeLocationIconSettings: React.Dispatch<React.SetStateAction<LocationIconSettings>>;
  floors?: FloorId[];
}

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));

const clampRotation = (value: number) => {
  const v = Number.isNaN(value) ? 0 : value;
  if (v < 0) return 0;
  if (v > 360) return 360;
  return v;
};

const IconConfigSection: React.FC<{
  label: string;
  config: IconPositionConfig;
  onChange: (next: IconPositionConfig) => void;
  showAnimation?: boolean;
}> = ({ label, config, onChange, showAnimation = false }) => {
  const update = (partial: Partial<IconPositionConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <fieldset
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
      }}
    >
      <legend style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", padding: "0 8px", fontSize: 14 }}>{label}</legend>

      <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
        />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>表示</span>
      </label>

      {/* Position */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>X位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Y位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercent(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* Size & rotation */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>サイズ (px)</div>
          <input
            type="number"
            min={1}
            max={512}
            step={0.1}
            value={config.size}
            onChange={(e) =>
              update({
                size: Math.max(1, Math.min(512, Number(e.target.value) || 1)),
              })
            }
            style={{
              width: 100,
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#ffffff",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>回転 (°)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={360}
              value={config.rotation}
              onChange={(e) =>
                update({ rotation: clampRotation(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>

      {/* Shadow settings */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={config.shadow.enabled}
            onChange={(e) =>
              update({
                shadow: { ...config.shadow, enabled: e.target.checked },
              })
            }
            style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
          />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>シャドウ</span>
        </label>

        {config.shadow.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>オフセットX (px)</div>
              <input
                type="number"
                min={-20}
                max={20}
                step={0.1}
                value={config.shadow.offsetX}
                onChange={(e) =>
                  update({
                    shadow: {
                      ...config.shadow,
                      offsetX: Number(e.target.value) || 0,
                    },
                  })
                }
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#ffffff",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>オフセットY (px)</div>
              <input
                type="number"
                min={-20}
                max={20}
                step={0.1}
                value={config.shadow.offsetY}
                onChange={(e) =>
                  update({
                    shadow: {
                      ...config.shadow,
                      offsetY: Number(e.target.value) || 0,
                    },
                  })
                }
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#ffffff",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>ぼかし (px)</div>
              <input
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={config.shadow.blur}
                onChange={(e) =>
                  update({
                    shadow: {
                      ...config.shadow,
                      blur: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                    },
                  })
                }
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "#ffffff",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>不透明度 (0-1)</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.shadow.opacity}
                  onChange={(e) =>
                    update({
                      shadow: {
                        ...config.shadow,
                        opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  style={{
                    flex: 1,
                    accentColor: "#007aff",
                  }}
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.shadow.opacity}
                  onChange={(e) =>
                    update({
                      shadow: {
                        ...config.shadow,
                        opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  style={{
                    width: 70,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Animation settings (for both speech bubble and location) */}
      {showAnimation && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={config.animation?.enabled ?? false}
              onChange={(e) =>
                update({
                  animation: {
                    ...(config.animation ?? {
                      enabled: false,
                      type: "floating",
                      duration: 2.2,
                      amplitude: 18,
                    }),
                    enabled: e.target.checked,
                  },
                })
              }
              style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
            />
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>アニメーション</span>
          </label>

          {config.animation?.enabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>タイプ</div>
                <select
                  value={config.animation?.type ?? "floating"}
                  onChange={(e) =>
                    update({
                      animation: {
                        ...(config.animation ?? {
                          enabled: true,
                          type: "floating",
                          duration: 2.2,
                          amplitude: 18,
                        }),
                        type: e.target.value as AnimationType,
                      },
                    })
                  }
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                >
                  <option value="floating" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>
                    フローティング
                  </option>
                  <option value="pulse" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>
                    パルス
                  </option>
                  <option value="bounce" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>
                    バウンス
                  </option>
                  <option value="blink" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>
                    点滅 (波紋)
                  </option>
                  <option value="none" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>
                    なし
                  </option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>期間 (秒)</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="range"
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={config.animation?.duration ?? 2.2}
                    onChange={(e) =>
                      update({
                        animation: {
                          ...(config.animation ?? {
                            enabled: true,
                            type: "floating",
                            duration: 2.2,
                            amplitude: 18,
                          }),
                          duration: Math.max(0.5, Math.min(5, Number(e.target.value) || 2.2)),
                        },
                      })
                    }
                    style={{
                      flex: 1,
                      accentColor: "#007aff",
                    }}
                  />
                  <input
                    type="number"
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={config.animation?.duration ?? 2.2}
                    onChange={(e) =>
                      update({
                        animation: {
                          ...(config.animation ?? {
                            enabled: true,
                            type: "floating",
                            duration: 2.2,
                            amplitude: 18,
                          }),
                          duration: Math.max(0.5, Math.min(5, Number(e.target.value) || 2.2)),
                        },
                      })
                    }
                    style={{
                      width: 70,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {config.animation?.type === "blink" ? (
                <>
                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋の色</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="color"
                        value={config.animation?.rippleColor || "#FFFFFF"}
                        onChange={(e) =>
                          update({
                            animation: {
                              ...(config.animation ?? {
                                enabled: true,
                                type: "blink",
                                duration: 2.2,
                                amplitude: 18,
                              }),
                              rippleColor: e.target.value,
                            },
                          })
                        }
                        style={{
                          width: 40,
                          height: 32,
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                      {/* Fixed # styling */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "0 8px",
                          flex: 1,
                        }}
                      >
                        <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 4, userSelect: "none" }}>#</span>
                        <input
                          type="text"
                          value={(config.animation?.rippleColor || "#FFFFFF").replace(/^#/, "")}
                          onChange={(e) => {
                             // Allow typing hex, auto-prepend #
                             let val = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
                             update({
                                animation: {
                                  ...(config.animation ?? {
                                    enabled: true,
                                    type: "blink",
                                    duration: 2.2,
                                    amplitude: 18,
                                  }),
                                  rippleColor: `#${val}`,
                                },
                             })
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ffffff",
                            fontSize: 13,
                            width: "100%",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ripple Size (Max) */}
                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋サイズ (最大倍率)</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={config.animation?.rippleSize ?? 1.5}
                        onChange={(e) =>
                          update({
                            animation: {
                              ...(config.animation ?? {
                                enabled: true,
                                type: "blink",
                                duration: 2.2,
                                amplitude: 18,
                              }),
                              rippleSize: Math.max(1, Math.min(3, Number(e.target.value) || 1.5)),
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          accentColor: "#007aff",
                        }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={3}
                        step={0.1}
                        value={config.animation?.rippleSize ?? 1.5}
                        onChange={(e) =>
                          update({
                            animation: {
                              ...(config.animation ?? {
                                enabled: true,
                                type: "blink",
                                duration: 2.2,
                                amplitude: 18,
                              }),
                              rippleSize: Math.max(1, Math.min(3, Number(e.target.value) || 1.5)),
                            },
                          })
                        }
                        style={{
                          width: 70,
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          color: "#ffffff",
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  {/* Ripple Center Size (Start) */}
                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋サイズ (初期倍率)</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="range"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={config.animation?.rippleCenterSize ?? 0.95}
                        onChange={(e) =>
                          update({
                            animation: {
                              ...(config.animation ?? {
                                enabled: true,
                                type: "blink",
                                duration: 2.2,
                                amplitude: 18,
                              }),
                              rippleCenterSize: Math.max(0.1, Math.min(1.5, Number(e.target.value) || 0.95)),
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          accentColor: "#007aff",
                        }}
                      />
                      <input
                        type="number"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={config.animation?.rippleCenterSize ?? 0.95}
                        onChange={(e) =>
                          update({
                            animation: {
                              ...(config.animation ?? {
                                enabled: true,
                                type: "blink",
                                duration: 2.2,
                                amplitude: 18,
                              }),
                              rippleCenterSize: Math.max(0.1, Math.min(1.5, Number(e.target.value) || 0.95)),
                            },
                          })
                        }
                        style={{
                          width: 70,
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          color: "#ffffff",
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>振幅 (px)</div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={config.animation?.amplitude ?? 18}
                    onChange={(e) =>
                      update({
                        animation: {
                          ...(config.animation ?? {
                            enabled: true,
                            type: "floating",
                            duration: 2.2,
                            amplitude: 18,
                          }),
                          amplitude: Math.max(1, Math.min(50, Number(e.target.value) || 18)),
                        },
                      })
                    }
                    style={{
                      width: "100%",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
};

export const LocationSettingsTab: React.FC<LocationSettingsTabProps> = ({
  floor,
  onChangeFloor,
  locationIconSettings,
  onChangeLocationIconSettings,
  floors = ["1F", "2F", "3F", "4F"],
}) => {
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);

  // Update preview floor when selected floor changes
  useEffect(() => {
    onChangeFloor(selectedFloor);
  }, [selectedFloor, onChangeFloor]);

  const handleIconConfigChange = useCallback((
    iconKey: "speechBubble" | "location",
    next: IconPositionConfig
  ) => {
    onChangeLocationIconSettings((prev) => ({
      ...prev,
      [iconKey]: next,
    }));
  }, [onChangeLocationIconSettings]);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Floor Selection */}
        <div>
          <label
            style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            フロア選択
          </label>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value as FloorId)}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          >
            {floors.map((f) => (
              <option
                key={f}
                value={f}
                style={{
                  backgroundColor: "#2C2C2C",
                  color: "#ffffff",
                }}
              >
                {f}
              </option>
            ))}
          </select>
        </div>

        <IconConfigSection
          label="SpeechBubble 画像設定"
          config={locationIconSettings.speechBubble}
          onChange={(next) => handleIconConfigChange("speechBubble", next)}
          showAnimation={true}
        />
        <IconConfigSection
          label="Location 画像設定"
          config={locationIconSettings.location}
          onChange={(next) => handleIconConfigChange("location", next)}
          showAnimation={true}
        />
      </div>
    </div>
  );
};