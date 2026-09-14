<p align="center">
  <img src="./packages/app/assets/icon.png" alt="MarkSync Logo" width="96" height="96">
</p>

<h1 align="center">MarkSync · 汇签</h1>

<p align="center">
  <strong>私有主权 · 端到端加密 · 毫秒级增量 · 跨浏览器 WebDAV 书签双向同步扩展</strong>
</p>

<p align="center">
  <a href="https://github.com/1378944437/marksync/releases/latest"><img src="https://img.shields.io/github/v/release/1378944437/marksync?color=2563eb&style=flat-square&logo=github" alt="Latest Release"></a>
  <a href="https://github.com/1378944437/marksync/releases"><img src="https://img.shields.io/github/downloads/1378944437/marksync/total?color=16a34a&style=flat-square&logo=github" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/tests-371%20passed-10b981?style=flat-square&logo=vitest" alt="371 Tests Passing">
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript" alt="TypeScript Strict">
  <img src="https://img.shields.io/badge/react-19-06b6d4?style=flat-square&logo=react" alt="React 19">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-amber?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a> · <a href="./README_en.md">English</a>
</p>

---

## 💡 为什么选择 MarkSync？

书签是私密的数字资产。**MarkSync** 彻底摒弃中心化中转服务器，利用你自己的 **WebDAV 云盘**（坚果云、Nextcloud、群晖 NAS、InfiniCLOUD、Alist）或 **GitHub Gist（私密代码片段）**，在 **Chrome、Edge、Firefox** 及移动端之间实现安全、快速、自主的双向书签同步。

```
┌─────────────────┐       端到端加密通道 (TLS + AES-256-GCM)       ┌────────────────────────┐
│  本地浏览器      │ ◄────────────────────────────────────────────► │ 私有云存储 (零中转)    │
│  (Chrome/Edge/FF)│          全密态/明态多协议 · 数据完全自主掌控   │ (WebDAV / GitHub Gist) │
└─────────────────┘                                                └────────────────────────┘
```

---

## ✨ 核心特性矩阵

| 模块 | 核心能力 |
| :--- | :--- |
| ☁️ **多协议云存储驱动** | 支持 **WebDAV** 与 **GitHub Gist** 双驱动无缝切换；一键自动创建私密 Gist，支持自建 API 反代加速 |
| 🔐 **端到端加密 (E2E)** | 基于 **AES-256-GCM + PBKDF2**，数据离机即密文，云端零知识存储，支持实时强度指示与多端密码认证 |
| ⚡ **智能增量同步** | 树形 **SHA-256 结构哈希**比对，毫秒级探测增量变更，同名目录智能合并去重，杜绝书签膨胀翻倍 |
| 🛡️ **双轨快照与容灾配额** | **本地时光机快照 (IndexedDB)** 与**云端多版本备份 (WebDAV/Gist)** 双重保护；**最低强制保底 5 份**，支持用户自定义配额与自动清理 |
| 🎯 **看板直达与设备识别** | 主看板点击直达本地快照与云端备份；原生解析多端**自定义设备名称**（如 `💻 客厅电脑 (Edge) · 157 书签`） |
| 📱 **极致双端适配** | 桌面端紧凑精致（380px 视口）；移动端（Firefox Android / Kiwi）触控优化、数字键盘唤起、防右侧裁切遮挡 |
| 🔌 **主流服务商一键配置** | 内置坚果云、Nextcloud、群晖 Synology NAS、InfiniCLOUD、Alist 预设模板，免去繁琐拼接 URL |

---

## 🚀 1 分钟极速上手

### 1. 安装扩展
- **Chrome / Edge / Chromium 内核**：前往 [Releases 页面](https://github.com/1378944437/marksync/releases/latest) 下载 `marksync-chrome-v*.zip`，解压后在 `chrome://extensions`（开启开发者模式）点击「加载已解压的扩展程序」。
- **Firefox 火狐浏览器**：在 [Releases 页面](https://github.com/1378944437/marksync/releases/latest) 下载经 Mozilla 官方签名的 `marksync-firefox-v*.xpi`，鼠标拖入浏览器即可直接安装。

### 2. 连接云端存储（二选一）
点击扩展图标 ➔ **「设置」** ➔ **「云端存储服务」**：
- **方式 A：WebDAV**
  - 选择你的服务商预设（如坚果云或 Nextcloud），系统会自动填充 WebDAV 地址；
  - 填入账号与**应用授权密码**，点击「保存并测试连接」。
- **方式 B：GitHub Gist**
  - 填入具有 `gist` 权限的 Personal Access Token；
  - 点击「自动创建」即可一键生成云端私密 Gist 仓库，点击「测试 Gist 连通性」。

### 3. 开始同步
返回首页点击 **「立即同步」** 即可。你也可以在「同步策略」中开启 **「自动同步」**，书签变动时自动静默上云。

---

## 🏢 常用云盘配置速览

| 服务商 | WebDAV 服务器 URL | 用户名 | 密码注意 |
| :--- | :--- | :--- | :--- |
| **坚果云** | `https://dav.jianguoyun.com/dav/` | 注册邮箱 | ⚠️ 须使用网页端「安全设置」生成的**应用授权密码** |
| **Nextcloud** | `https://your-domain.com/remote.php/dav/files/用户名/` | 登录账号 | 推荐使用应用专用密码；URL 末尾须保留斜杠 `/` |
| **群晖 NAS** | `https://nas.example.com:5006/home/` | DSM 账号 | 需安装 WebDAV Server 套件并开放对应端口 |
| **InfiniCLOUD**| `https://my.infinicloud.com/dav/` | Connection ID | 登录控制台开启 WebDAV Connection 获取连接密码 |
| **Alist / 自建** | `https://dav.example.com/dav/` | 自建用户名 | 确保开启 `PROPFIND`、`PUT`、`MKCOL` 等标准动词 |

---

## 🛠️ 极简开发者指南

```bash
# 安装依赖
pnpm install

# 运行自动化测试（371 个单测用例 100% 通过）
pnpm test

# 开发调试（支持热重载）
pnpm dev:chrome   # 或 pnpm dev:firefox

# 生产全量构建（包含 strict 类型检查）
pnpm build
```

- **架构规范**：遵循 DDD 领域分层架构（`core` / `infrastructure` / `application` / `components`）；
- **代码红线**：每个单文件严守 300 行以内单一职责标准，纯严格 TypeScript 开发。

---

## 📄 开源许可证

本项目基于 [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE) 协议开源，保障用户绝对的数据自主与自由。
