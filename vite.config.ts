/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  base: "./",
  // 프로젝트가 OneDrive 폴더에 있어 파일 변경 알림이 빠진다. 로컬 dev 서버만 폴링으로 감시한다.
  server: {
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    outDir: "dist",
    // Skip gzip-size reporting: our users don't optimize by bundle size,
    // and it only slows the build. Output is byte-identical.
    reportCompressedSize: false,
    // Game bundles (three/phaser) legitimately ship 1-3MB single chunks, so
    // the default 500 kB advisory fires on every build as noise. Keep the
    // warning only for genuinely pathological (5MB+) chunks.
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
