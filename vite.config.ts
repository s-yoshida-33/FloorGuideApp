import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './', 
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api":  { target: "http://localhost:48080", changeOrigin: true },
      "/file": { target: "http://localhost:48080", changeOrigin: true },
    },
  },
});
