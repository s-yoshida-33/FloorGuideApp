// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import { FloorSettingsTab } from "../components/FloorSettingsTab";
import { LayoutSettingsTab } from "../components/LayoutSettingsTab";
import { LocationSettingsTab } from "../components/LocationSettingsTab";
import iconSvg from "../assets/icon.svg";

type TabType = "floor" | "layout" | "location";

interface UnifiedSettingsScreenProps {
  floor: FloorId;
  onSaveFloor: (floor: FloorId) => Promise<void> | void;
  floorLayout: FloorLayout;
  onSaveFloorLayout: (layout: FloorLayout) => Promise<void> | void;
  locationIconSettings: LocationIconSettings;
  onSaveLocationIconSettings: (settings: LocationIconSettings) => Promise<void> | void;
}

const UnifiedSettingsScreen: React.FC<UnifiedSettingsScreenProps> = ({
  floor: initialFloor,
  onSaveFloor,
  floorLayout: initialFloorLayout,
  onSaveFloorLayout,
  locationIconSettings: initialLocationIconSettings,
  onSaveLocationIconSettings,
}) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("floor");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(initialFloorLayout);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettings>(initialLocationIconSettings);

  // Preview zoom and pan state
  const [zoom, setZoom] = useState(0.6); // 60% initial
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Track if preview has been manually panned
  const [hasBeenPanned, setHasBeenPanned] = useState(false);
  
  // Track if the container has been properly measured
  const [containerInitialized, setContainerInitialized] = useState(false);

  // Calculate initial center position for preview
  const calculateCenterPosition = useCallback((force = false) => {
    if (!previewContainerRef.current) return false;

    const container = previewContainerRef.current;
    
    // Get container dimensions
    // Use offsetWidth/offsetHeight for CSS pixel dimensions (more reliable for layout calculations)
    // getBoundingClientRect() returns physical pixels which can differ on high-DPI displays
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // Also get rect for debugging
    const rect = container.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Ensure container has valid dimensions
    if (containerWidth <= 0 || containerHeight <= 0) {
      console.warn('Container dimensions invalid:', { 
        containerWidth, 
        containerHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        rectWidth: rect.width,
        rectHeight: rect.height,
        devicePixelRatio
      });
      return false;
    }

    // GidoApp size - in preview mode, it's always rendered at 1920x1080
    // However, on 4K displays, the actual rendered size might differ
    // Use the screen resolution to determine the base size for calculations
    const actualScreenWidth = window.screen.width;
    const actualScreenHeight = window.screen.height;
    
    // For 4K displays (3840x2160), use the actual screen size
    // For other displays, use 1920x1080
    // This matches what GidoApp actually renders at
    const appWidth = actualScreenWidth >= 3840 ? 3840 : 1920;
    const appHeight = actualScreenHeight >= 2160 ? 2160 : 1080;

    // Calculate scaled dimensions after zoom
    // zoom is applied as CSS transform scale, so it's in CSS pixels
    const scaledWidth = appWidth * zoom;
    const scaledHeight = appHeight * zoom;

    // Calculate center position in CSS pixels
    // When using transformOrigin: "top left", the element scales from its top-left corner
    // So we need to position it such that after scaling, it's centered
    // The left/top position is the position of the top-left corner before scaling
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;

    // Only update if not manually panned (unless forced)
    if (force || !hasBeenPanned) {
      setPanX(centerX);
      setPanY(centerY);
      setContainerInitialized(true);
      console.log('Preview centered:', {
        containerWidth,
        containerHeight,
        scaledWidth,
        scaledHeight,
        centerX,
        centerY,
        zoom,
        devicePixelRatio,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      });
      return true;
    }

    return false;
  }, [zoom, hasBeenPanned]);

  // Initialize center position when screen becomes visible
  useEffect(() => {
    if (!visible || !previewContainerRef.current) return;

    // Reset initialization state when becoming visible
    setContainerInitialized(false);
    
    // Use a more reliable approach: wait for layout to be complete
    const attemptCentering = () => {
      let attempts = 0;
      const maxAttempts = 8;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      
      const tryCenter = () => {
        attempts++;
        
        // Clear any pending timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Progressive delay: longer for first attempts, shorter for retries
        const delay = attempts <= 2 ? 200 : attempts <= 4 ? 100 : 50;
        
        timeoutId = setTimeout(() => {
          if (!previewContainerRef.current) return;
          
          const success = calculateCenterPosition(true);
          
          if (!success && attempts < maxAttempts) {
            // Use requestAnimationFrame for next attempt to ensure layout is updated
            requestAnimationFrame(() => {
              requestAnimationFrame(tryCenter);
            });
          } else if (success) {
            console.log(`Preview centered successfully after ${attempts} attempt(s)`);
          } else {
            console.warn(`Failed to center preview after ${attempts} attempts`);
          }
        }, delay);
      };
      
      // Start with double RAF to ensure DOM is ready and layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tryCenter();
        });
      });
      
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    };
    
    const cleanup = attemptCentering();
    return cleanup;
  }, [visible, calculateCenterPosition]);

  // Recalculate center position on zoom changes (only if not manually panned)
  useEffect(() => {
    if (!visible || !containerInitialized || hasBeenPanned) return;
    
    // Recalculate center when zoom changes
    requestAnimationFrame(() => {
      calculateCenterPosition();
    });
  }, [zoom, visible, containerInitialized, hasBeenPanned, calculateCenterPosition]);

  // Handle container resize
  useEffect(() => {
    if (!visible || !previewContainerRef.current) return;

    const container = previewContainerRef.current;

    // Use ResizeObserver with debouncing
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only recalculate if not manually panned
        if (!hasBeenPanned) {
          requestAnimationFrame(() => {
            calculateCenterPosition();
          });
        }
      }, 100);
    });

    resizeObserver.observe(container);

    // Also listen to window resize as fallback
    const handleWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!hasBeenPanned) {
          requestAnimationFrame(() => {
            calculateCenterPosition();
          });
        }
      }, 100);
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [visible, hasBeenPanned, calculateCenterPosition]);

  // Load initial values when screen opens
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenSettings) {
      unsubscribe = window.electronAPI.onOpenSettings(() => {
        // First reset to initial state
        setPanX(0);
        setPanY(0);
        setZoom(0.6);
        setHasBeenPanned(false);
        setContainerInitialized(false);
        setErrors({});
        
        // Then set visibility and other states
        setVisible(true);
        setActiveTab("floor");
        setFloor(initialFloor);
        setFloorLayout(initialFloorLayout);
        setLocationIconSettings(initialLocationIconSettings);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialFloor, initialFloorLayout, initialLocationIconSettings]);

  // Sync with external changes when screen is closed
  useEffect(() => {
    if (!visible) {
      setFloor(initialFloor);
      setFloorLayout(initialFloorLayout);
      setLocationIconSettings(initialLocationIconSettings);
    }
  }, [visible, initialFloor, initialFloorLayout, initialLocationIconSettings]);

  const handleClose = () => {
    setVisible(false);
    setErrors({});
  };

  const handleCancel = () => {
    // Revert to initial values
    setFloor(initialFloor);
    setFloorLayout(initialFloorLayout);
    setLocationIconSettings(initialLocationIconSettings);
    setZoom(0.6);
    setHasBeenPanned(false);
    setContainerInitialized(false);
    setErrors({});
    setPanX(0);
    setPanY(0);
    handleClose();
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "layout") {
      const selectedFloor = floor; // Use current floor for layout validation
      const layout = floorLayout[selectedFloor];
      if (layout) {
        if (layout.columns <= 0 || layout.columns > 10) {
          newErrors["layout.columns"] = "列数は1〜10の範囲で入力してください";
        }
        if (layout.rowsPerCol <= 0 || layout.rowsPerCol > 100) {
          newErrors["layout.rowsPerCol"] = "行数は1〜100の範囲で入力してください";
        }
        if (layout.perColumnRows) {
          layout.perColumnRows.forEach((rows, idx) => {
            if (rows !== undefined && (rows <= 0 || rows > 100)) {
              newErrors[`layout.perColumnRows.${idx}`] = "行数は1〜100の範囲で入力してください";
            }
          });
        }
        if (layout.perColumnPadding) {
          layout.perColumnPadding.forEach((padding, idx) => {
            if (padding) {
              Object.entries(padding).forEach(([key, value]) => {
                if (value !== undefined && value < 0) {
                  newErrors[`layout.perColumnPadding.${idx}.${key}`] = "間隔は0以上の値を入力してください";
                }
              });
            }
          });
        }
      }
    }

    if (activeTab === "location") {
      // Validate location icon settings
      if (locationIconSettings.speechBubble.size <= 0 || locationIconSettings.speechBubble.size > 512) {
        newErrors["location.speechBubble.size"] = "サイズは1〜512の範囲で入力してください";
      }
      if (locationIconSettings.location.size <= 0 || locationIconSettings.location.size > 512) {
        newErrors["location.location.size"] = "サイズは1〜512の範囲で入力してください";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        onSaveFloor(floor),
        onSaveFloorLayout(floorLayout),
        onSaveLocationIconSettings(locationIconSettings),
      ]);
      handleClose();
    } catch (e) {
      console.error("Failed to save settings", e);
      setErrors({ save: "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  // Zoom controls - mouse wheel zooms from cursor position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (!previewContainerRef.current) return;
    
    const container = previewContainerRef.current.getBoundingClientRect();
    
    // Get mouse position relative to container (in container coordinates)
    const mouseX = e.clientX - container.left;
    const mouseY = e.clientY - container.top;
    
    // Current zoom level
    const currentZoom = zoom;
    
    // Calculate new zoom level
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.6, Math.min(1.5, currentZoom + delta));
    
    // Calculate the point in the unscaled content that corresponds to the mouse position
    // mouseX is in container coordinates
    // The content's top-left is at (panX, panY) in container coordinates
    // So the point in content coordinates is: (mouseX - panX) / currentZoom
    const contentX = (mouseX - panX) / currentZoom;
    const contentY = (mouseY - panY) / currentZoom;
    
    // After zoom, we want this same content point to be under the mouse
    // So: mouseX = newPanX + contentX * newZoom
    // Therefore: newPanX = mouseX - contentX * newZoom
    const newPanX = mouseX - contentX * newZoom;
    const newPanY = mouseY - contentY * newZoom;
    
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
    setHasBeenPanned(true);
  }, [zoom, panX, panY]);

  // Zoom buttons zoom from center
  const handleZoomIn = () => {
    if (!previewContainerRef.current) {
      setZoom((prev) => Math.min(1.5, prev + 0.1));
      return;
    }
    
    const container = previewContainerRef.current.getBoundingClientRect();
    const centerX = container.width / 2;
    const centerY = container.height / 2;
    
    const currentZoom = zoom;
    const newZoom = Math.min(1.5, currentZoom + 0.1);
    const zoomRatio = newZoom / currentZoom;
    
    const newPanX = centerX - (centerX - panX) * zoomRatio;
    const newPanY = centerY - (centerY - panY) * zoomRatio;
    
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handleZoomOut = () => {
    if (!previewContainerRef.current) {
      setZoom((prev) => Math.max(0.6, prev - 0.1));
      return;
    }
    
    const container = previewContainerRef.current.getBoundingClientRect();
    const centerX = container.width / 2;
    const centerY = container.height / 2;
    
    const currentZoom = zoom;
    const newZoom = Math.max(0.6, currentZoom - 0.1);
    const zoomRatio = newZoom / currentZoom;
    
    const newPanX = centerX - (centerX - panX) * zoomRatio;
    const newPanY = centerY - (centerY - panY) * zoomRatio;
    
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  // Drag controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    // Check if the event target is from GidoApp content
    const target = e.target as HTMLElement;
    // If clicking on interactive elements (buttons, inputs, etc.), don't start dragging
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
    setHasBeenPanned(true);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#1C1C1C",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
      }}
    >
      {/* Header (4%) */}
      <div
        style={{
          height: "4%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Logo and App Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src={iconSvg}
            alt="Gido"
            style={{
              width: 24,
              height: 24,
            }}
          />
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600 }}>
            Gido
          </span>
        </div>

        {/* Error Message */}
        {errors.save && (
          <span style={{ color: "#ff4444", fontSize: 14 }}>
            {errors.save}
          </span>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "#007aff",
            border: "none",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        </div>
      </div>

      {/* Main Area (96%) */}
      <div
        style={{
          height: "96%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Left Sidebar (13%) */}
        <div
          style={{
            width: "13%",
            backgroundColor: "#2C2C2C",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Tabs */}
          <div style={{ flex: 1, padding: "16px 0" }}>
            {[
              { id: "floor" as TabType, label: "フロア" },
              { id: "layout" as TabType, label: "レイアウト" },
              { id: "location" as TabType, label: "現在地" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  backgroundColor:
                    activeTab === tab.id ? "#007aff" : "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 15,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Preview (72%) */}
        <div
          style={{
            width: "72%",
            backgroundColor: "#1C1C1C",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            ref={previewContainerRef}
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none", // Prevent text selection during drag
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onDragStart={(e) => e.preventDefault()} // Prevent default drag behavior
          >
            <div
              style={{
                // Use top-left origin for simpler calculations
                // panX/panY is already calculated to center the scaled content
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                position: "absolute",
                left: `${panX}px`,
                top: `${panY}px`,
                // Use actual screen size for 4K, otherwise 1920x1080
                width: `${window.screen.width >= 3840 ? 3840 : 1920}px`,
                height: `${window.screen.height >= 2160 ? 2160 : 1080}px`,
                willChange: "transform",
              }}
            >
              <GidoApp
                locationIconSettings={locationIconSettings}
                previewFloor={floor}
                previewFloorLayout={floorLayout}
              />
            </div>
          </div>

          {/* Zoom Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 1.5}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: zoom >= 1.5 ? "not-allowed" : "pointer",
                opacity: zoom >= 1.5 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.6}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: zoom <= 0.6 ? "not-allowed" : "pointer",
                opacity: zoom <= 0.6 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
          </div>
        </div>

        {/* Right Edit Panel (15%) */}
        <div
          style={{
            width: "15%",
            backgroundColor: "#2C2C2C",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {activeTab === "floor" && (
            <FloorSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
            />
          )}
          {activeTab === "layout" && (
            <LayoutSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              floorLayout={floorLayout}
              onChangeFloorLayout={setFloorLayout}
              errors={errors}
            />
          )}
          {activeTab === "location" && (
            <LocationSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;