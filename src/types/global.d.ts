// src/types/global.d.ts
export {};

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;
  }
}
