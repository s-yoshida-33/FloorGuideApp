// src/App.tsx
import React, { useEffect, useState } from "react";
import FloorGuideApp from "./screens/FloorGuideApp";
import LocationIconSettingsScreen from "./screens/LocationIconSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS,
} from "./config";
import type { LocationIconSettings } from "./types/locationIcon";

const App: React.FC = () => {
  const [locationSettings, setLocationSettings] = useState<LocationIconSettings>(
    DEFAULT_LOCATION_ICON_SETTINGS
  );
  const [savedLocationSettings, setSavedLocationSettings] =
    useState<LocationIconSettings>(DEFAULT_LOCATION_ICON_SETTINGS);

  // Load initial settings from Electron and subscribe to updates
  useEffect(() => {
    let unsubscribeUpdated: (() => void) | undefined;

    const init = async () => {
      if (window.electronAPI?.getLocationIconSettings) {
        const saved = await window.electronAPI.getLocationIconSettings();
        if (saved) {
          setLocationSettings(saved);
          setSavedLocationSettings(saved);
        }
      }
    };

    init();

    if (window.electronAPI?.onLocationIconSettingsUpdated) {
      unsubscribeUpdated =
        window.electronAPI.onLocationIconSettingsUpdated((updated) => {
          setLocationSettings(updated);
          setSavedLocationSettings(updated);
        });
    }

    return () => {
      if (unsubscribeUpdated) unsubscribeUpdated();
    };
  }, []);

  const handleSave = async (settings: LocationIconSettings) => {
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

  const handleCancel = () => {
    // Revert to last saved settings
    setLocationSettings(savedLocationSettings);
  };

  return (
    <>
      <FloorGuideApp locationIconSettings={locationSettings} />
      <LocationIconSettingsScreen
        settings={locationSettings}
        onChangeSettings={setLocationSettings}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
};

export default App;
