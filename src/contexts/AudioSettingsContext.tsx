import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AudioSettings } from '../types/audioSettings';
import { DEFAULT_AUDIO_SETTINGS } from '../types/audioSettings';
import { loadMallSettings, saveMallSettings } from '../utils/settings';
import type { MallId } from '../types/mall';

interface AudioSettingsContextType {
  /** Effective audio settings (force-muted when black screen is active) */
  audioSettings: AudioSettings;
  setAudioSettings: (settings: AudioSettings) => void;
  saveAudioSettings: (settings: AudioSettings) => Promise<void>;
  /** Set to true when the black screen overlay is visible — forces all audio muted */
  setBlackScreenActive: (active: boolean) => void;
  isLoading: boolean;
}

const AudioSettingsContext = createContext<AudioSettingsContextType>({
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  setAudioSettings: () => {},
  saveAudioSettings: async () => {},
  setBlackScreenActive: () => {},
  isLoading: true,
});

interface AudioSettingsProviderProps {
  mallId: MallId;
  /** External audio settings kept in App.tsx — synced after settings-screen save */
  externalAudioSettings?: AudioSettings;
  children: React.ReactNode;
}

export const AudioSettingsProvider: React.FC<AudioSettingsProviderProps> = ({ mallId, externalAudioSettings, children }) => {
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(externalAudioSettings ?? DEFAULT_AUDIO_SETTINGS);
  const [blackScreenActive, setBlackScreenActive] = useState(false);
  const [isLoading] = useState(false);

  // Sync with external state (App.tsx) whenever it changes (e.g. after settings save)
  useEffect(() => {
    if (externalAudioSettings) {
      setAudioSettings(externalAudioSettings);
    }
  }, [externalAudioSettings]);

  // Save audio settings to file and update state immediately
  const saveAudioSettings = useCallback(async (newSettings: AudioSettings) => {
    // Update state immediately for instant UI feedback
    setAudioSettings(newSettings);
    try {
      const mallSettings = await loadMallSettings(mallId);
      mallSettings.audioSettings = newSettings;
      await saveMallSettings(mallId, mallSettings);
    } catch (e) {
      console.error('Failed to save audio settings', e);
    }
  }, [mallId]);

  // When black screen is active, force all audio muted (runtime-only, not persisted)
  const effectiveAudioSettings: AudioSettings = blackScreenActive
    ? { cmsMuted: true, localMediaMuted: true }
    : audioSettings;

  return (
    <AudioSettingsContext.Provider value={{ audioSettings: effectiveAudioSettings, setAudioSettings, saveAudioSettings, setBlackScreenActive, isLoading }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};

export const useAudioSettingsContext = () => useContext(AudioSettingsContext);
