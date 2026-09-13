<p align="center">
  <img src="./packages/app/assets/icon.png" alt="marksync logo" width="96" height="96">
</p>

<h1 align="center">marksync 汇签</h1>

<p align="center">
  Cross-browser bookmark sync · Self-hosted over WebDAV
</p>

<p align="center">
  <a href="https://github.com/1378944437/marksync/releases/latest">
    <img src="https://img.shields.io/github/downloads/1378944437/marksync/total?style=flat-square&logo=github" alt="Downloads">
  </a>
  <a href="https://github.com/1378944437/marksync/releases/latest">
    <img src="https://img.shields.io/github/v/release/1378944437/marksync?style=flat-square&logo=github" alt="Release">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/1378944437/marksync?style=flat-square" alt="License">
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

All builds are available on the [Releases](https://github.com/1378944437/marksync/releases/latest) page.

#### Chrome / Edge

**Extension ID:** `fpccfkjndkjiljfj` (pinned, stays the same across updates)

1. Download the latest `chrome-extension.zip`
2. Extract it to a local folder
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

**Updating the extension:**

- Download the new zip and extract it to the **same folder** (overwrite the old files)
- Click the "Reload" button on the extension card in `chrome://extensions/`
- The extension ID and all local data are preserved

#### Firefox

**Requires Firefox 140 or later**

1. Download the latest `marksync-firefox-vX.X.X.xpi` (signed)
2. Drag the `.xpi` file into a Firefox window and click "Add" to confirm

**Or install manually:**

1. Open `about:addons`
2. Click the gear icon ⚙️ in the top-right corner
3. Choose "Install Add-on From File..." and select the `.xpi` file

### ⚙️ Usage

1. Click the extension icon in the toolbar to open the panel
2. Go to "Settings" → "WebDAV Configuration"
3. Enter your WebDAV server URL, username and password
4. Click "Save and Test Connection"
5. Return to the home page and click "Sync"

> 💡 Set it up once: bookmarks are uploaded automatically on change, and you can always sync manually or restore from a snapshot.

### 🔒 Privacy

- Bookmark data only travels between your local browser and the WebDAV server you configured — never through any third-party server
- A local snapshot is created before every sync, so you can roll back with one click
- There is no built-in account system; your WebDAV credentials are stored only in the extension's local storage

### 🛠️ Development

```bash
# Install dependencies
pnpm install

# Development mode (hot reload)
pnpm dev:chrome   # Chrome extension
pnpm dev:firefox  # Firefox extension

# Production build (includes tsc strict type checking)
pnpm build

# Package for distribution (signs Firefox, packs Chrome)
pnpm package
```

- Stack: TypeScript (strict) + React 19 + Vite 5 + Vitest 4 + Tailwind 3
- Unit tests: `pnpm test`
- Architecture notes: [REFACTORING.md](./REFACTORING.md)

### 📄 License

[GNU AGPLv3](./LICENSE)
