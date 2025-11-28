// src/App.tsx
import React, { useEffect, useState } from "react";
import GidoApp from "./screens/GidoApp";
import LocationIconSettingsScreen from "./screens/LocationIconSettingsScreen";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS,
} from "./config";
import type { LocationIconSettings } from "./types/locationIcon";

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
  const [savedLocationSettings, setSavedLocationSettings] =
    useState<LocationIconSettings>(DEFAULT_LOCATION_ICON_SETTINGS);

  // Floor and floor layout state for unified settings
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);

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
          setLocationSettings(saved);
          setSavedLocationSettings(saved);
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
    };

    init();

    const api = window.electronAPI;
    if (api) {
      if (api.onLocationIconSettingsUpdated) {
        unsubscribeUpdated =
          api.onLocationIconSettingsUpdated((updated) => {
            setLocationSettings(updated);
            setSavedLocationSettings(updated);
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
      setSavedLocationSettings(saved);
    } else {
      // Fallback: no Electron available (dev in browser)
      setLocationSettings(settings);
      setSavedLocationSettings(settings);
    }
  };

  const handleCancelLocationSettings = () => {
    // Revert to last saved settings
    setLocationSettings(savedLocationSettings);
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

  return (
    <>
      <GidoApp locationIconSettings={locationSettings} />
      <UnifiedSettingsScreen
        floor={floor}
        onSaveFloor={handleSaveFloor}
        floorLayout={floorLayout}
        onSaveFloorLayout={handleSaveFloorLayout}
        locationIconSettings={locationSettings}
        onSaveLocationIconSettings={handleSaveLocationSettings}
      />
      <LocationIconSettingsScreen
        settings={locationSettings}
        onChangeSettings={setLocationSettings}
        onSave={handleSaveLocationSettings}
        onCancel={handleCancelLocationSettings}
      />
      <VersionInfoScreen onClose={() => {}} />
    </>
  );
};

export default App;
