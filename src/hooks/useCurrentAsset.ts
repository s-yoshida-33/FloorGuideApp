// src/hooks/useCurrentAsset.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset, WonderFlowItemChangedEvent, WspScheduleJson, MediaMapItem } from '../types/wsp';
import { getCmsBaseUrl } from '../repositories/wspRepository';
import { logWarn, logError, logDebug, logInfo } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
  nextAsset: MediaMapItem | null;
}

export function useCurrentAsset(
  retryIntervalMs: number = 3000,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [nextAsset, setNextAsset] = useState<MediaMapItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // マップのロード状態管理 (null = 未ロード)
  const [mediaMap, setMediaMap] = useState<Map<string, MediaMapItem> | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const isMountedRef = useRef<boolean>(true);

  // 1. スケジュールファイルを読み込んでマップを作成
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        if (!window.wspApi?.getLocalSchedule) {
            logWarn('video', 'wspApi.getLocalSchedule not found');
            setMediaMap(new Map());
            return;
        }
        
        const json: WspScheduleJson | null = await window.wspApi.getLocalSchedule();
        if (!json?.data?.schedule?.events?.items) {
             logWarn('video', 'Invalid schedule json structure or file not found');
             setMediaMap(new Map());
             return;
        }

        const newMap = new Map<string, MediaMapItem>();
        
        // 深いネストを走査して全てのメディア情報を抽出
        const events = json.data.schedule.events.items || [];
        for (const ev of events) {
            // programs はオブジェクトとして定義されている
            const program = ev.programs;
            if (program && program.items) {
                for (const pItem of program.items) {
                    if (pItem.layers && pItem.layers.items) {
                        for (const lItem of pItem.layers.items) {
                            const media = lItem.media;
                            // filenameが存在するものだけを登録
                            if (media && media.id && media.filename) {
                                // 実際のファイル名は ID + 拡張子
                                const ext = media.filename.split('.').pop();
                                const realFilename = `${media.id}.${ext}`;
                                
                                newMap.set(media.id, {
                                    id: media.id,
                                    filename: realFilename,
                                    mediaType: media.media_type,
                                    name: media.name,
                                    duration: media.duration
                                });
                            }
                        }
                    }
                }
            }
        }

        setMediaMap(newMap);
        logInfo('video', 'Schedule map loaded', { count: newMap.size });
      } catch (error) {
        logError('video', 'Failed to load local schedule', { error });
        setMediaMap(new Map());
      }
    };

    loadSchedule();
  }, []);

  // 2. SSE接続とイベントハンドリング
  const connectSSE = useCallback(async () => {
    // マップがロードされるまでは接続しない（イベントが来ても処理できないため）
    if (!mediaMap) return;

    try {
      const baseUrl = await getCmsBaseUrl();
      if (!baseUrl) {
        logWarn('video', 'CMS base URL not found, retrying...');
        retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        return;
      }

      const url = `${baseUrl}/api/timeline/stream`;
      logDebug('video', 'Connecting to SSE', { url });

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        logDebug('video', 'SSE connection established');
      };

      es.onerror = (_e) => {
        // es.readyState === 2 means closed
        if (es.readyState === 2) {
             // logError('video', 'SSE connection closed/error', { state: es.readyState });
        }
        logDebug('video', 'SSE connection error/closed', { state: es.readyState });
        es.close();
        eventSourceRef.current = null;
        if (isMountedRef.current) {
             retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
        }
      };

      // item_changed イベント処理
      es.addEventListener('item_changed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as WonderFlowItemChangedEvent;
          
          const currentMediaInfo = mediaMap.get(data.current_media_id);
          
          let src = '';
          if (data.current_media_local_path) {
             const normalized = data.current_media_local_path.replace(/\\/g, '/');
             src = normalized.startsWith('file://') ? normalized : `file:///${normalized}`;
          } else if (currentMediaInfo?.filename) {
             src = `file:///C:/SignageData/assets/${currentMediaInfo.filename}`;
          }
          
          if (!src) {
             // パスが特定できない場合はスキップ
             if (!currentMediaInfo) {
                 logWarn('video', 'Asset info not found for ID', { id: data.current_media_id });
                 return;
             }
             // filenameもない場合
             if (!currentMediaInfo.filename) {
                 logWarn('video', 'Filename not found in schedule for ID', { id: data.current_media_id });
                 return;
             }
          }

          const newAsset: CurrentAsset = {
            id: data.current_media_id,
            src: src,
            name: data.current_media_name,
            mediaType: data.current_media_type,
            duration: currentMediaInfo?.duration || 0,
            width: 0,
            height: 0,
            startTime: data.timestamp,
            endTime: '',
          };

          setAsset(newAsset);
          setIsLoading(false);

          // 次のメディア情報の取得
          if (data.next_media_id) {
            const nextInfo = mediaMap.get(data.next_media_id);
            let nextItem: MediaMapItem | null = nextInfo ? { ...nextInfo } : null;
            
            // SSEからのパス情報があれば、srcプロパティとして注入
            if (data.next_media_local_path) {
                const normalizedNext = data.next_media_local_path.replace(/\\/g, '/');
                const nextSrc = normalizedNext.startsWith('file://') ? normalizedNext : `file:///${normalizedNext}`;
                
                // マップ情報がなくても、最低限の情報でオブジェクトを作成することも検討できるが、
                // durationなどが不明なため、一旦はマップ情報がある場合にsrcを追加する形にする
                if (nextItem) {
                    nextItem.src = nextSrc;
                }
            }
            
            setNextAsset(nextItem);
          } else {
            setNextAsset(null);
          }

        } catch (err) {
          logError('video', 'Failed to parse item_changed event', { error: err });
        }
      });

    } catch (error) {
      logError('video', 'Failed to initialize SSE', { error });
      if (isMountedRef.current) {
        retryTimeoutRef.current = window.setTimeout(connectSSE, retryIntervalMs);
      }
    }
  }, [mediaMap, retryIntervalMs]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (mediaMap) {
        connectSSE();
    }

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current !== undefined) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [mediaMap, connectSSE]);

  return { asset, isLoading, nextAsset };
}
