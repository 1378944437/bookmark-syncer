import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import path from "node:path";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  publicDir: path.resolve(process.cwd(), "../../packages/app/assets"),
  build: {
    // 面板页不生成 modulepreload 提示：Chrome 会以 cross-world mismatch
    // 为由丢弃扩展页面的预加载提示并产生控制台警告
    modulePreload: false,
    rollupOptions: {
      onwarn(warning, warn) {
        // 屏蔽由第三方库（如 sonner, framer-motion）产生的 "use client" 警告
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
