import React from 'react';
import type { AudioSettings } from '../types/audioSettings';

interface AudioSettingsTabProps {
  audioSettings: AudioSettings;
  onChangeAudioSettings: (settings: AudioSettings) => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        backgroundColor: "#333",
        borderRadius: 8,
        border: "1px solid #555",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 50,
          height: 30,
          backgroundColor: checked ? "#34C759" : "#e9e9ea",
          borderRadius: 15,
          position: "relative",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 26,
            height: 26,
            backgroundColor: "white",
            borderRadius: "50%",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </div>
    </div>
  );
};

export const AudioSettingsTab: React.FC<AudioSettingsTabProps> = ({
  audioSettings,
  onChangeAudioSettings,
}) => {
  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        オーディオ設定
      </h2>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, borderBottom: "1px solid #444", paddingBottom: 8 }}>
          音声設定
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={!audioSettings.cmsMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, cmsMuted: !checked })}
            label="CMS配信の音声を有効にする"
          />
          <ToggleSwitch
            checked={!audioSettings.localMediaMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, localMediaMuted: !checked })}
            label="ローカルメディアの音声を有効にする"
          />
        </div>
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
          ※両方の音声を同時に有効にすることも可能です。
        </p>
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
          ※ブラックスクリーン表示中は自動的にすべての音声がミュートされます。
        </p>
      </div>
    </div>
  );
};
