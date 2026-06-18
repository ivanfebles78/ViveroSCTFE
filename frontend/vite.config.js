import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: "/tmp/vite-cache-" + Date.now(),
  server: { port: 5476, strictPort: true },
});
