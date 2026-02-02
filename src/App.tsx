// src/App.tsx
import React, { useEffect, useState } from "react";
import GidoApp from "./screens/GidoApp";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS,
  getApiBaseUrl
} from "./config";
import type { LocationIconSettings } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import { DEFAULT_GENRE_MAPPINGS, DEFAULT_GENRE_MEMO_SETTINGS } from "./types/genreSettings";
import type { GenreMappings, GenreMemoSettings } from "./types/genreSettings";
import type { ShopSettings } from "./types/shopSettings";
import { sseClient } from "./api/sseClient";
import type { SseConnectionStatus } from "./api/sseClient";

// 【追加1】 エラー境界コンポーネントの定義
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Electronのロガーへエラーを送信（gido.logに記録される）
    if ((window as any).logger) {
      (window as any).logger.error("React ErrorBoundary caught an error", {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        scope: "RENDERER_FATAL"
      });
    } else {
      console.error("React ErrorBoundary:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // エラー発生時のフォールバック表示（真っ白ではなくエラーメッセージを出す）
      return (
        <div style={{ padding: 40, color: 'white', background: '#333', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '2em', marginBottom: '1em' }}>System Error</h1>
          <p>予期せぬエラーが発生しました。自動的に復旧しない場合は再起動してください。</p>
        </div>
      );
    }

    return this.props.children;
  }
}

type FloorId = "1F" | "2F" | "3F" | "4F";

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

const App: React.FC = () => {
  const [locationSettings, setLocationSettings] = useState<LocationIconSettings>(
    DEFAULT_LOCATION_ICON_SETTINGS
  );

  // Floor and floor layout state for unified settings
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [imageUpdateTs, setImageUpdateTs] = useState(Date.now());
  const [genreMappings, setGenreMappings] = useState<GenreMappings>(DEFAULT_GENRE_MAPPINGS);
  const [genreMemoSettings, setGenreMemoSettings] = useState<GenreMemoSettings>(DEFAULT_GENRE_MEMO_SETTINGS);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({});

  // DEBUG STATE
  const [debugLog, setDebugLog] = useState<{text: string, level: string}[]>([]);
  const addDebug = (msg: string, level: string = 'INFO') => setDebugLog(prev => [...prev.slice(-999), {text: msg, level}]);
  const logEndRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLog]);

  // Debug Window UI State
  const [debugPos, setDebugPos] = useState({ x: 20, y: 20 });
  const [debugSize, setDebugSize] = useState({ w: 600, h: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  
  // API Status State
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>('disconnected');
  const [bridgeBaseUrl, setBridgeBaseUrl] = useState<string>("Loading...");
  const [cmsBaseUrl, setCmsBaseUrl] = useState<string>("Loading...");
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [cmsStatus, setCmsStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Debug Settings Info
  const [debugSettingsInfo, setDebugSettingsInfo] = useState<any>(null);

  // Subscribe to Electron Logs
  useEffect(() => {
    if (window.electronAPI?.onDebugLog) {
      const unsubscribe = window.electronAPI.onDebugLog((entry) => {
        // Format: [HH:mm:ss] [LEVEL] [Scope] Message
        const time = new Date().toLocaleTimeString();
        const level = entry.level?.toUpperCase() || 'INFO';
        const scope = entry.context?.scope || 'main';
        const source = entry.context?.source === 'renderer' ? '(R)' : '';
        const msg = `[${time}]${source} [${level}] [${scope}] ${entry.message}`;
        addDebug(msg, level);
      });
      return unsubscribe;
    }
  }, []);

  // SSE Status Subscription
  useEffect(() => {
    try {
        setSseStatus(sseClient.status);
    } catch (e) { console.error(e); }

    const unsubscribeStatus = sseClient.on('status_change', (data: { status: SseConnectionStatus }) => {
      setSseStatus(data.status);
      addDebug(`SSE Status: ${data.status}`, 'INFO');
    });

    const unsubscribeUpdate = sseClient.on('update', () => {
      addDebug('SSE Update received, triggering video optimization', 'INFO');
      if (window.electronAPI?.notifyScheduleUpdated) {
        window.electronAPI.notifyScheduleUpdated();
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeUpdate();
    };
  }, []);

  // Drag, Resize, Shortcut Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setDebugPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      } else if (isResizing) {
        setDebugSize({ w: Math.max(300, e.clientX - debugPos.x), h: Math.max(200, e.clientY - debugPos.y) });
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        setIsDebugVisible(prev => !prev);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, isResizing, dragOffset, debugPos]);

  // Mouse Down Handlers
  const handleDebugMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - debugPos.x, y: e.clientY - debugPos.y });
  };
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  // Debug Initialization
  useEffect(() => {
    const initDebug = async () => {
      try {
        // App Version
        if (window.appInfo?.getVersion) {
            const v = await window.appInfo.getVersion();
            setAppVersion(v);
        }
        
        // Check Bridge URL
        try {
            const bUrl = await getApiBaseUrl();
            setBridgeBaseUrl(bUrl);
            setBridgeStatus('connected'); // Simplified check
        } catch(e) {
            setBridgeStatus('error');
        }

        // Check CMS URL
        try {
            if (window.wspApi?.getCmsBaseUrl) {
                const cUrl = await window.wspApi.getCmsBaseUrl();
                setCmsBaseUrl(cUrl);
                setCmsStatus('connected'); // Simplified check
            } else {
                setCmsBaseUrl("N/A");
                setCmsStatus('error');
            }
        } catch(e) {
            setCmsStatus('error');
        }
        
        // Detailed Debug Info from Electron
        if (window.electronAPI?.getDebugSettingsStatus) {
           const status = await window.electronAPI.getDebugSettingsStatus();
           setDebugSettingsInfo(status);
           addDebug(`DEBUG STATUS loaded`, 'INFO');
        }
      } catch (e: any) { 
          addDebug(`Init error: ${e.message}`, 'ERROR');
      }
    };
    initDebug();
  }, []);

  // Load initial settings from Electron and subscribe to updates
  useEffect(() => {
    let unsubscribeUpdated: (() => void) | undefined;
    let unsubscribeFloorLayout: (() => void) | undefined;

    const init = async () => {
      const api = window.electronAPI;
      if (!api) return;

      // Load location icon settings
      if (api.getLocationIconSettings) {
        const saved = await api.getLocationIconSettings();
        if (saved) {
          // Ensure shadow and animation config exists for backward compatibility
          const mergedSettings: LocationIconSettings = {
            speechBubble: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
              ...saved.speechBubble,
              shadow: saved.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
              animation: saved.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
            },
            location: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.location,
              ...saved.location,
              shadow: saved.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
            },
          };
          setLocationSettings(mergedSettings);
        }
      }

      // Load floor
      if (api.getFloor) {
        const currentFloor = await api.getFloor();
        if (currentFloor) {
          setFloor(currentFloor as FloorId);
        }
      }

      // Load floor layout
      if (api.getFloorLayout) {
        const layout = await api.getFloorLayout();
        if (layout) {
          setFloorLayout(layout);
        }
      }

      // Load image settings
      if (api.getImageSettings) {
        const saved = await api.getImageSettings();
        if (saved) {
          setImageSettings(saved);
        }
      }

      // Load genre mappings
      if (api.getGenreMappings) {
        const saved = await api.getGenreMappings();
        if (saved) {
          setGenreMappings(saved);
        }
      }

      // Load genre memo settings
      if (api.getGenreMemoSettings) {
        const saved = await api.getGenreMemoSettings();
        if (saved) {
          setGenreMemoSettings(saved);
        }
      }

      // Load shop settings
      if (api.getShopSettings) {
        try {
          const saved = await api.getShopSettings();
          if (saved) {
            setShopSettings(saved);
          }
        } catch (e) {
          console.error("Failed to load shop settings", e);
        }
      }
    };

    init();

    const api = window.electronAPI;
    if (api) {
      if (api.onLocationIconSettingsUpdated) {
        unsubscribeUpdated = api.onLocationIconSettingsUpdated((updated) => {
          // Ensure shadow and animation config exists for backward compatibility
          const mergedSettings: LocationIconSettings = {
            speechBubble: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
              ...updated.speechBubble,
              shadow: updated.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
              animation: updated.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
            },
            location: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.location,
              ...updated.location,
              shadow: updated.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
            },
          };
          setLocationSettings(mergedSettings);
        });
      }

      if (api.onFloorChanged) {
        api.onFloorChanged((nextFloor) => {
          setFloor(nextFloor as FloorId);
        });
      }

      if (api.onFloorLayoutChanged) {
        unsubscribeFloorLayout = api.onFloorLayoutChanged((layout) => {
          setFloorLayout(layout);
        });
      }

      if (api.onImageSettingsUpdated) {
        api.onImageSettingsUpdated((updated) => {
          setImageSettings(updated);
          setImageUpdateTs(Date.now());
        });
      }

      if (api.onGenreMappingsUpdated) {
        api.onGenreMappingsUpdated((updated) => {
          setGenreMappings(updated);
        });
      }

      if (api.onGenreMemoSettingsUpdated) {
        api.onGenreMemoSettingsUpdated((updated) => {
            setGenreMemoSettings(updated);
        });
      }

      if (api.onShopSettingsUpdated) {
        api.onShopSettingsUpdated((updated) => {
          setShopSettings(updated);
        });
      }
    }

    return () => {
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeFloorLayout) unsubscribeFloorLayout();
    };
  }, []);

  const handleSaveLocationSettings = async (settings: LocationIconSettings) => {
    // Persist to Electron settings.json
    if (window.electronAPI?.saveLocationIconSettings) {
      const saved =
        (await window.electronAPI.saveLocationIconSettings(settings)) ??
        settings;
      setLocationSettings(saved);
    } else {
      // Fallback: no Electron available (dev in browser)
      setLocationSettings(settings);
    }
  };


  const handleSaveFloor = async (nextFloor: FloorId) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      api.setFloor(nextFloor);
    } catch (e) {
      console.error("Failed to save floor", e);
    }
  };

  const handleSaveFloorLayout = async (layout: FloorLayout) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveFloorLayout(layout);
      if (saved) {
        setFloorLayout(saved); // Update current state with saved layout
      }
    } catch (e) {
      console.error("Failed to save floor layout", e);
    }
  };

  const handleSaveImageSettings = async (settings: ImageSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveImageSettings(settings);
      if (saved) {
        // Base64 Guard to prevent memory crashes
        const hasBase64 = 
          Object.values(saved.floorMaps).some(v => v && v.startsWith('data:')) ||
          (saved.openTimeImage && saved.openTimeImage.startsWith('data:'));

        if (hasBase64) {
          console.error("Critical: Received Base64 image data. Rejecting state update.");
          const cleanSettings = await api.getImageSettings();
          if (cleanSettings) {
             setImageSettings(cleanSettings);
             setImageUpdateTs(Date.now());
          }
          return;
        }

        setImageSettings(saved);
        setImageUpdateTs(Date.now());
      }
    } catch (e) {
      console.error("Failed to save image settings", e);
    }
  };

  const handleSaveGenreMappings = async (mappings: GenreMappings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveGenreMappings(mappings);
      if (saved) {
        setGenreMappings(saved);
      }
    } catch (e) {
      console.error("Failed to save genre mappings", e);
    }
  };

  const handleSaveGenreMemoSettings = async (settings: GenreMemoSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveGenreMemoSettings(settings);
      if (saved) {
        setGenreMemoSettings(saved);
      }
    } catch (e) {
      console.error("Failed to save genre memo settings", e);
    }
  };

  const handleSaveShopSettings = async (settings: ShopSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveShopSettings(settings);
      if (saved) {
        setShopSettings(saved);
      }
    } catch (e) {
      console.error("Failed to save shop settings", e);
    }
  };

  const displayImageSettings = React.useMemo(() => {
    const processed = { ...imageSettings, floorMaps: { ...imageSettings.floorMaps } };
    
    // Add timestamp to force reload
    (Object.keys(processed.floorMaps) as Array<keyof typeof processed.floorMaps>).forEach(key => {
      if (processed.floorMaps[key] && processed.floorMaps[key].startsWith('file://')) {
        processed.floorMaps[key] = `${processed.floorMaps[key]}?v=${imageUpdateTs}`;
      }
    });

    if (processed.openTimeImage && processed.openTimeImage.startsWith('file://')) {
      processed.openTimeImage = `${processed.openTimeImage}?v=${imageUpdateTs}`;
    }

    return processed;
  }, [imageSettings, imageUpdateTs]);

  return (
    <ErrorBoundary>
      {isDebugVisible && (
      <div style={{
        position: 'fixed',
        top: debugPos.y,
        left: debugPos.x,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.9)',
        color: 'lime',
        border: '1px solid lime',
        borderRadius: '4px',
        width: `${debugSize.w}px`,
        height: `${debugSize.h}px`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: '12px',
        boxShadow: '0 0 10px rgba(0,255,0,0.2)'
      }}>
        {/* Header (Draggable) */}
        <div 
            onMouseDown={handleDebugMouseDown} 
            style={{ 
                padding: '5px 10px', 
                borderBottom: '1px solid lime', 
                cursor: 'move',
                display: 'flex',
                justifyContent: 'space-between',
                userSelect: 'none',
                background: 'rgba(0,255,0,0.1)'
            }}
        >
          <span>Debug Monitor</span>
          <span>Ctrl+Shift+D to hide</span>
        </div>
        
        {/* System Info */}
        <div style={{ padding: '5px 10px', borderBottom: '1px solid #333' }}>
          <div>Version: {appVersion} | Window: {window.innerWidth}x{window.innerHeight}</div>
        </div>

        {/* Upper Content (Status & Settings) */}
        <div style={{ maxHeight: '30%', overflowY: 'auto', padding: '10px', borderBottom: '1px solid #333' }}>
          
          {/* API Status (Expandable) */}
          <details open>
            <summary style={{cursor:'pointer', color: '#fff', marginBottom: '5px'}}>API Status</summary>
            <div style={{marginLeft: '15px', marginBottom: '10px'}}>
              <div>SSE: <span style={{color: sseStatus === 'connected' ? 'lime' : 'red'}}>{sseStatus}</span></div>
              <div>Bridge: <span style={{color: bridgeStatus === 'connected' ? 'lime' : 'red'}}>{bridgeStatus}</span> ({bridgeBaseUrl})</div>
              <div>CMS: <span style={{color: cmsStatus === 'connected' ? 'lime' : 'red'}}>{cmsStatus}</span> ({cmsBaseUrl})</div>
            </div>
          </details>

          {/* Settings Status (Expandable) */}
          <details>
             <summary style={{cursor:'pointer', color: '#fff', marginBottom: '5px'}}>Settings Status</summary>
             <div style={{marginLeft: '15px', marginBottom: '10px'}}>
                 {debugSettingsInfo ? (
                     <>
                        <div>Path: {debugSettingsInfo.path} ({debugSettingsInfo.exists ? 'Exists' : 'Missing'})</div>
                        <div>JSON Parse: {debugSettingsInfo.jsonParseResult ? 'OK' : 'Failed'}</div>
                        <details>
                            <summary>Internal Load Logic</summary>
                            <pre style={{whiteSpace: 'pre-wrap'}}>{JSON.stringify(debugSettingsInfo.internalDebug, null, 2)}</pre>
                        </details>
                        <details>
                            <summary>Content Preview</summary>
                            <pre style={{whiteSpace: 'pre-wrap'}}>{debugSettingsInfo.contentPreview}</pre>
                        </details>
                     </>
                 ) : <div>Loading...</div>}
             </div>
          </details>

          {/* Full Settings (Expandable) */}
          <details>
            <summary style={{cursor:'pointer', color: '#fff', marginBottom: '5px'}}>Full Loaded Settings</summary>
            <pre style={{marginLeft: '15px', whiteSpace: 'pre-wrap'}}>
                {JSON.stringify({
                    locationSettings,
                    floor,
                    floorLayout,
                    imageSettings,
                    genreMappings,
                    genreMemoSettings,
                    shopSettings
                }, null, 2)}
            </pre>
          </details>
        </div>

        {/* Logs Area (Main Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
                color:'#fff', 
                marginBottom:'5px', 
                display:'flex', 
                justifyContent:'space-between',
                position: 'sticky',
                top: 0,
                background: '#000', // Sticky header background to hide scrolling content
                paddingBottom: '5px',
                borderBottom: '1px solid #333',
                zIndex: 1
            }}>
                <span>Logs</span>
                <button 
                    onClick={() => setDebugLog([])} 
                    style={{
                        background: 'transparent', 
                        border: '1px solid #555', 
                        color: '#aaa', 
                        cursor: 'pointer',
                        fontSize: '10px'
                    }}
                >
                    Clear
                </button>
            </div>
            <div style={{ flex: 1 }}>
                {debugLog.map((log, i) => (
                    <div 
                        key={i} 
                        style={{
                            borderBottom:'1px solid #222', 
                            fontSize:'11px', 
                            whiteSpace:'pre-wrap', 
                            wordBreak:'break-all',
                            color: log.level === 'WARN' ? 'orange' : log.level === 'ERROR' ? 'red' : 'inherit'
                        }}
                    >
                        {log.text}
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>

        {/* Resizer Handle */}
        <div 
            onMouseDown={handleResizeMouseDown} 
            style={{ 
                height: '10px', 
                cursor: 'se-resize', 
                background: 'rgba(0,255,0,0.1)',
                display: 'flex',
                justifyContent: 'flex-end',
                paddingRight: '2px'
            }}
        >
          <span style={{fontSize:'8px'}}>◢</span>
        </div>
      </div>
      )}

      <GidoApp
        locationIconSettings={locationSettings} 
        imageSettings={displayImageSettings} 
        genreMappings={genreMappings}
        genreMemoSettings={genreMemoSettings}
        shopSettings={shopSettings}
      />
      <UnifiedSettingsScreen
        floor={floor}
        onSaveFloor={handleSaveFloor}
        floorLayout={floorLayout}
        onSaveFloorLayout={handleSaveFloorLayout}
        locationIconSettings={locationSettings}
        onSaveLocationIconSettings={handleSaveLocationSettings}
        imageSettings={imageSettings}
        onSaveImageSettings={handleSaveImageSettings}
        genreMappings={genreMappings}
        onSaveGenreMappings={handleSaveGenreMappings}
        genreMemoSettings={genreMemoSettings}
        onSaveGenreMemoSettings={handleSaveGenreMemoSettings}
        shopSettings={shopSettings}
        onSaveShopSettings={handleSaveShopSettings}
      />
      <VersionInfoScreen onClose={() => {}} />
    </ErrorBoundary>
  );
};

export default App;
