import { defineManifest } from "@crxjs/vite-plugin";

// @ts-ignore
import { version } from "../../package.json";

const manifest = defineManifest({
  manifest_version: 3,
  // 名称/描述通过 _locales 本地化（packages/app/assets/_locales/）
  default_locale: "zh_CN",
  name: "__MSG_extName__",
  version: version,
  description: "__MSG_extDescription__",
  action: {
    default_popup: "index.html",
    default_icon: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon.png",
    },
  },
  permissions: ["bookmarks", "storage", "alarms"],
  host_permissions: ["<all_urls>"],
  // 内容脚本：同步完成时在网页底部中央弹出轻提示
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
  ],
  background: {
    scripts: ["src/background.ts"],
    type: "module",
  },
  icons: {
    "16": "icon-16.png",
    "32": "icon-32.png",
    "48": "icon-48.png",
    "128": "icon.png",
  },
});

// Firefox 特定配置 - 手动添加到最终 manifest
// @ts-expect-error Firefox-specific property not in Chrome types
manifest.browser_specific_settings = {
  gecko: {
    // 独立 ID：上游（Yueby）已用 bookmark-syncer@example.com 签名，
    // Mozilla 将该 ID 绑定在其账号上；fork 必须使用自己的 ID 才能签名分发
    id: "bookmark-syncer@1378944437.github.io",
    strict_min_version: "140.0", // Firefox 140+ 支持 data_collection_permissions
    data_collection_permissions: {
      required: ["none"], // 声明不收集任何数据
    },
  },
};

export default manifest;
