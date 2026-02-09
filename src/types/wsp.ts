// src/types/wsp.ts

export interface WspMediaAsset {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    url: string;
    sequence: number;
    duration: number;
    type: string;
    mediaType: string;
    [key: string]: unknown;
  }
  
  export interface WspMediaInfo {
    id: string;
    filename: string;
    [key: string]: unknown;
  }
  
  export interface WspTimelineItem {
    timeline_index: number;
    schedule_id: string;
    event_id: string;
    program_item_index: number;
    program_item_sequence: number;
    program_item_duration: number;
    start_time: string;
    end_time: string;
    generated_at: string;
    media_names: string[];
    media_assets: WspMediaAsset[];
    x_program: number;
    y_program: number;
    width_program: number;
    height_program: number;
    priority: string;
    priority_value: number;
    media_info: WspMediaInfo[];
    [key: string]: unknown;
  }
  
  export interface WspCurrentTimelineResponse {
    retrieved_at: string;
    current_timeline: WspTimelineItem | null;
  }
  
  export interface WspTimelineResponse {
    retrieved_at: string;
    timelines: WspTimelineItem[];
  }

  export interface WonderFlowItemChangedEvent {
    event_type: 'item_changed';
    current_media_id: string;
    current_media_name: string;
    current_media_type: 'video' | 'image' | string;
    next_media_id: string;
    timeline_count: number;
    timestamp: string;
  }
  
  export interface MediaMapItem {
    id: string;
    filename: string;
    mediaType: string;
    name: string;
    duration: number;
  }
  
  export interface WspScheduleJson {
    data: {
      schedule: {
        id: string;
        events: {
          items: Array<{
            programs: {
              items: Array<{
                layers: {
                  items: Array<{
                    media: {
                      id: string;
                      filename: string;
                      media_type: string;
                      duration: number;
                      name: string;
                    };
                  }>;
                };
              }>;
            };
          }>;
        };
      };
    };
  }

  /**
   * Simplified current asset object used by the renderer.
   * This matches the object returned from "wsp:get-current-asset".
   */
  export interface CurrentAsset {
    id: string;
    src: string;
    duration: number;
    width: number;
    height: number;
    name: string;
    startTime: string;
    endTime: string;
    mediaType?: string; // 'video', 'image', etc.
    type?: string; // Additional type information
  }
  