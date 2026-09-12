<p align="center">
  <img src="./packages/app/assets/icon.png" alt="Logo" width="80" height="80">
</p>

<h1 align="center">MarkSync</h1>

<p align="center">
  Cross-browser bookmark sync tool with self-hosted WebDAV solution.
</p>

<p align="center">
  <a href="https://github.com/1378944437/bookmark-syncer/releases/latest">
    <img src="https://img.shields.io/github/downloads/1378944437/bookmark-syncer/total?style=flat-square&logo=github" alt="Downloads">
  </a>
  <a href="https://github.com/1378944437/bookmark-syncer/releases/latest">
    <img src="https://img.shields.io/github/v/release/1378944437/bookmark-syncer?style=flat-square&logo=github" alt="Release">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/1378944437/bookmark-syncer?style=flat-square" alt="License">
  </a>
</p>

<p align="center">
  <a href="./README.md">简体中文</a>
</p>

---

### 📸 Preview

|              Dark Mode               |               Light Mode               |
| :----------------------------------: | :------------------------------------: |
| ![Dark Mode](./screenshots/dark.png) | ![Light Mode](./screenshots/light.png) |

### ✨ Features

- 🔒 **Self-Hosted** - Store bookmarks on your own WebDAV server
- 🌐 **Cross-Browser** - Supports Chrome, Edge, Firefox and more
- 🔄 **Smart Sync** - Incremental sync, only transfers changes
- 📱 **Auto Sync** - Automatically uploads when bookmarks change
- ⏰ **Scheduled Sync** - Periodically checks for cloud updates
- 📦 **Local Snapshots** - Auto backup before sync, one-click restore

### 📦 Installation

#### Chrome / Edge

1. Download the latest `chrome-extension.zip`
2. Extract to a local folder
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the extracted folder

#### Firefox

1. Download the latest `firefox-extension.zip`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the zip file

### ⚙️ Usage

1. Click the extension icon to open the panel
2. Go to "Settings" → "WebDAV Configuration"
3. Enter your WebDAV server details
4. Click "Save and Test Connection"
5. Return to home and click "Sync"

### 🛠️ Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev:chrome   # Chrome extension
pnpm dev:firefox  # Firefox extension

# Build
pnpm build
```

### 📄 License

[GNU AGPLv3](./LICENSE) - Open Source
