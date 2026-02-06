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
