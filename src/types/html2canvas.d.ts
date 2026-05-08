// Ambient module declaration for html2canvas v1.x.
// The package ships dist/types/index.d.ts but does NOT set a "types" or
// "exports" field in package.json, so moduleResolution:"bundler" cannot
// locate the declarations automatically.
//
// This file is a script (no top-level import/export), which makes
// "declare module" an ambient declaration usable as a module-resolution
// fallback — unlike a module file where it would be treated as augmentation.
declare module 'html2canvas' {
  interface Html2CanvasOptions {
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
  }
  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions,
  ): Promise<HTMLCanvasElement>;
  export default html2canvas;
}
