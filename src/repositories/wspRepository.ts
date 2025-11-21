// src/repositories/wspRepository.ts
import type {
    CurrentAsset,
    WspCurrentTimelineResponse,
    WspTimelineResponse,
  } from '../types/wsp';
  
  /**
   * Fetch current asset from wsp.exe API via Electron IPC bridge.
   */
  export async function fetchCurrentAsset(): Promise<CurrentAsset | null> {
    if (!window.wspApi?.getCurrentAsset) {
      return null;
    }
  
    try {
      const asset = await window.wspApi.getCurrentAsset();
      return asset ?? null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[fetchCurrentAsset] failed:', error);
      return null;
    }
  }
  
  /**
   * Fetch /current-timeline raw JSON.
   */
  export async function fetchCurrentTimeline(): Promise<WspCurrentTimelineResponse | null> {
    if (!window.wspApi?.getCurrentTimeline) {
      return null;
    }
  
    try {
      const data = await window.wspApi.getCurrentTimeline();
      return data ?? null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[fetchCurrentTimeline] failed:', error);
      return null;
    }
  }
  
  /**
   * Fetch /timeline or /timeline?hour=... raw JSON.
   */
  export async function fetchTimeline(
    hour?: number,
  ): Promise<WspTimelineResponse | null> {
    if (!window.wspApi?.getTimeline) {
      return null;
    }
  
    try {
      const data = await window.wspApi.getTimeline(hour);
      return data ?? null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[fetchTimeline] failed:', error);
      return null;
    }
  }
  