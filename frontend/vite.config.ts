import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 本机（Windows + 火绒）会拦截 esbuild 在 %TEMP% 下删除自己写的请求文件，
// 报 "[vite:esbuild-transpile] remove ...: Access is denied"。
// 这里把本进程的临时目录指到项目内，esbuild 读写就不再跨出信任目录。
const here = path.dirname(fileURLToPath(import.meta.url));
const localTmp = path.resolve(here, "..", ".tmp", "vite-tmp");
mkdirSync(localTmp, { recursive: true });
process.env.TEMP = localTmp;
process.env.TMP = localTmp;
process.env.TMPDIR = localTmp;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
