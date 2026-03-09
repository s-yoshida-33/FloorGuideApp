export interface AudioSettings {
  cmsMuted: boolean;
  localMediaMuted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  cmsMuted: true,
  localMediaMuted: false,
};
