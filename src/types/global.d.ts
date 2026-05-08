// src/types/global.d.ts
// Tauri version - Electron APIs removed. All IPC via @tauri-apps/api/core invoke().
export {};

// html2canvas does not expose a `types` field in its package.json, so
// moduleResolution:"bundler" cannot locate dist/types/index.d.ts automatically.
declare module 'html2canvas' {
  interface Options {
    allowTaint?: boolean;
    useCORS?: boolean;
    logging?: boolean;
    scale?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    backgroundColor?: string | null;
    imageTimeout?: number;
    ignoreElements?: (element: Element) => boolean;
    [key: string]: unknown;
  }
  function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
