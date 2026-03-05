// src/types/blackScreenSettings.ts

/**
 * ブラックスクリーン（暗転）設定
 * モニターの長時間稼働による焼き付き防止のため、
 * 指定した時間帯のみ画面を点灯し、それ以外は黒画面にする。
 *
 * 例: startTime="09:00", endTime="21:00" の場合
 *   00:00~08:59 → 黒画面
 *   09:00~21:00 → 点灯
 *   21:01~23:59 → 黒画面
 */
export interface BlackScreenSettings {
  /** 機能の有効/無効 */
  enabled: boolean;
  /** 点灯開始時間 (HH:MM 形式, 例: "09:00") */
  startTime: string;
  /** 点灯終了時間 (HH:MM 形式, 例: "21:00") */
  endTime: string;
}

export const DEFAULT_BLACK_SCREEN_SETTINGS: BlackScreenSettings = {
  enabled: false,
  startTime: '09:00',
  endTime: '21:00',
};

/**
 * 現在時刻がブラックスクリーン（暗転）状態であるべきかを判定する。
 * @param settings ブラックスクリーン設定
 * @param now 現在時刻 (テスト用に指定可能)
 * @returns true の場合、画面を暗転させる
 */
export function shouldShowBlackScreen(
  settings: BlackScreenSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.enabled) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = settings.startTime.split(':').map(Number);
  const [endH, endM] = settings.endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // 通常: 例 09:00 ～ 21:00 → この範囲内は点灯
    return currentMinutes < startMinutes || currentMinutes > endMinutes;
  } else {
    // 日跨ぎ: 例 21:00 ～ 09:00 → この範囲内は点灯（外が暗転）
    return currentMinutes > endMinutes && currentMinutes < startMinutes;
  }
}
