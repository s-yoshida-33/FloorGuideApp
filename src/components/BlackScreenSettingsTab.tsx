// src/components/BlackScreenSettingsTab.tsx
import React from 'react';
import type { BlackScreenSettings } from '../types/blackScreenSettings';
import { shouldShowBlackScreen } from '../types/blackScreenSettings';

interface BlackScreenSettingsTabProps {
  settings: BlackScreenSettings;
  onChangeSettings: (settings: BlackScreenSettings) => void;
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

const TimeInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        backgroundColor: disabled ? "#2a2a2a" : "#333",
        borderRadius: 8,
        border: "1px solid #555",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          backgroundColor: "#444",
          color: "#fff",
          border: "1px solid #666",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 16,
          fontFamily: "monospace",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
};

/**
 * 現在時刻と設定からスケジュールのプレビューバーを生成する
 */
const SchedulePreview: React.FC<{ settings: BlackScreenSettings }> = ({ settings }) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = settings.startTime.split(':').map(Number);
  const [endH, endM] = settings.endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isBlack = shouldShowBlackScreen(settings);

  // 24時間のバーを生成 (各時間 = 1ブロック)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hourStart = i * 60;
    const hourEnd = (i + 1) * 60 - 1;

    let isLit: boolean;
    if (startMinutes <= endMinutes) {
      // 通常パターン
      isLit = hourStart >= startMinutes && hourEnd <= endMinutes;
    } else {
      // 日跨ぎパターン
      isLit = hourStart >= startMinutes || hourEnd <= endMinutes;
    }

    const isCurrent = currentMinutes >= hourStart && currentMinutes <= hourEnd;

    return { hour: i, isLit, isCurrent };
  });

  return (
    <div style={{ marginTop: 8 }}>
      {/* タイムバー */}
      <div style={{ display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden' }}>
        {hours.map(({ hour, isLit, isCurrent }) => (
          <div
            key={hour}
            style={{
              flex: 1,
              height: 24,
              backgroundColor: isLit ? '#34C759' : '#333',
              position: 'relative',
              border: isCurrent ? '2px solid #007aff' : 'none',
              boxSizing: 'border-box',
            }}
            title={`${String(hour).padStart(2, '0')}:00 - ${isLit ? '点灯' : '暗転'}`}
          />
        ))}
      </div>
      {/* 時刻ラベル */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#888' }}>
        <span>0</span>
        <span>3</span>
        <span>6</span>
        <span>9</span>
        <span>12</span>
        <span>15</span>
        <span>18</span>
        <span>21</span>
        <span>24</span>
      </div>
      {/* 凡例 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#aaa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, backgroundColor: '#34C759', borderRadius: 2 }} />
          <span>点灯</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, backgroundColor: '#333', borderRadius: 2, border: '1px solid #555' }} />
          <span>暗転</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, border: '2px solid #007aff', borderRadius: 2 }} />
          <span>現在</span>
        </div>
      </div>
      {/* 現在のステータス */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          backgroundColor: isBlack ? '#1a1a1a' : 'rgba(52, 199, 89, 0.15)',
          borderRadius: 8,
          border: `1px solid ${isBlack ? '#444' : 'rgba(52, 199, 89, 0.3)'}`,
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        現在の状態: <strong style={{ color: isBlack ? '#ff6b6b' : '#34C759' }}>
          {isBlack ? '暗転中' : '点灯中'}
        </strong>
        <span style={{ color: '#888', marginLeft: 8 }}>
          ({String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')})
        </span>
      </div>
    </div>
  );
};

export const BlackScreenSettingsTab: React.FC<BlackScreenSettingsTabProps> = ({
  settings,
  onChangeSettings,
}) => {
  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        ブラックスクリーン設定
      </h2>

      {/* 説明 */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 16px",
          backgroundColor: "rgba(0, 122, 255, 0.1)",
          borderRadius: 8,
          border: "1px solid rgba(0, 122, 255, 0.2)",
          fontSize: 12,
          lineHeight: 1.6,
          color: "#ccc",
        }}
      >
        モニターの長時間稼働による焼き付きを防止するため、
        指定した時間帯のみ画面を点灯し、それ以外は黒画面にします。
        <br />
        暗転中も右クリックメニューから設定画面にアクセスできます。
      </div>

      {/* 有効/無効トグル */}
      <div style={{ marginBottom: 24 }}>
        <ToggleSwitch
          checked={settings.enabled}
          onChange={(checked) =>
            onChangeSettings({ ...settings, enabled: checked })
          }
          label="ブラックスクリーンを有効にする"
        />
      </div>

      {/* 時間設定 */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            borderBottom: "1px solid #444",
            paddingBottom: 8,
          }}
        >
          点灯スケジュール
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TimeInput
            label="開始時間（点灯）"
            value={settings.startTime}
            onChange={(startTime) =>
              onChangeSettings({ ...settings, startTime })
            }
            disabled={!settings.enabled}
          />
          <TimeInput
            label="終了時間（消灯）"
            value={settings.endTime}
            onChange={(endTime) =>
              onChangeSettings({ ...settings, endTime })
            }
            disabled={!settings.enabled}
          />
        </div>
      </div>

      {/* スケジュールプレビュー */}
      {settings.enabled && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 12,
              borderBottom: "1px solid #444",
              paddingBottom: 8,
            }}
          >
            スケジュールプレビュー
          </h3>
          <SchedulePreview settings={settings} />
        </div>
      )}
    </div>
  );
};
