<p align="center">
  <img src="./packages/app/assets/icon.png" alt="MarkSync Logo" width="96" height="96">
</p>

<h1 align="center">MarkSync</h1>

<p align="center">
  <strong>Privacy-First · E2E Encrypted · Incremental · Cross-Browser WebDAV Bookmark Sync Extension</strong>
</p>

<p align="center">
  <a href="https://github.com/1378944437/marksync/releases/latest"><img src="https://img.shields.io/github/v/release/1378944437/marksync?color=2563eb&style=flat-square&logo=github" alt="Latest Release"></a>
  <a href="https://github.com/1378944437/marksync/releases"><img src="https://img.shields.io/github/downloads/1378944437/marksync/total?color=16a34a&style=flat-square&logo=github" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/tests-463%20passed-10b981?style=flat-square&logo=vitest" alt="463 Tests Passing">
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript" alt="TypeScript Strict">
  <img src="https://img.shields.io/badge/react-19-06b6d4?style=flat-square&logo=react" alt="React 19">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-amber?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README_en.md"><strong>English</strong></a>
</p>

---

## 💡 Why MarkSync?

Your bookmarks represent private digital assets. **MarkSync** removes third-party relay servers completely, returning total data sovereignty to you. Sync seamlessly between **Chrome, Edge, Firefox**, and mobile devices via your personal **WebDAV** storage (Nutstore, Nextcloud, Synology NAS, InfiniCLOUD, Alist) or **GitHub Gist (secret snippets)**.

```
┌──────────────────┐        E2E Encrypted Channel (TLS + AES-256-GCM)        ┌─────────────────────────┐
│  Local Browser   │ ◄─────────────────────────────────────────────────────► │  Private Cloud Storage  │
│  (Chrome/Edge/FF)│           Zero Relay Servers · 100% Data Sovereignty    │  (WebDAV / GitHub Gist) │
└──────────────────┘                                                         └─────────────────────────┘
```

---

## ✨ Core Feature Matrix

| Feature | Description |
| :--- | :--- |
| ☁️ **Multi-Protocol Cloud Storage** | Seamlessly switch between **WebDAV** and **GitHub Gist**; 1-click auto-creation of secret Gists with custom API proxy endpoint support. |
| 🔐 **End-to-End Encryption (E2E)** | Authenticated **AES-256-GCM + PBKDF2**. Bookmarks are encrypted before leaving your browser; zero-knowledge storage in the cloud with real-time strength indication. |
| ⚡ **Smart Incremental Sync** | Tree-level **SHA-256 hash** comparison detects minimal deltas in milliseconds. Smart folder normalization prevents duplicate bloating. |
| 🛡️ **Dual-Track Disaster Recovery** | **Local snapshots (IndexedDB)** and **cloud multi-version backups (WebDAV/Gist)**. **Guaranteed minimum 5 copies protection** with custom quota and auto-rotation. |
| 🎯 **Direct Access & Device Tags** | Click dashboard cards to directly open snapshots/backups. Native parsing of custom device names (e.g. `💻 Living Room PC (Edge) · 157 bookmarks`). |
| 📱 **Responsive & Mobile-Ready** | Optimized 380px desktop popup; fully responsive layout for mobile browsers (Firefox Android / Kiwi) with numeric keypad support and overflow protection. |
| 🔌 **1-Click Cloud Presets** | Built-in templates for Nutstore, Nextcloud, Synology NAS, InfiniCLOUD, and Alist — no manual URL construction needed. |

---

## 🚀 Quick Start in 1 Minute

### 1. Install Extension
- **Chrome / Edge / Chromium-based**: Download `marksync-chrome-v*.zip` from [Releases](https://github.com/1378944437/marksync/releases/latest), unpack it, and click "Load unpacked" on `chrome://extensions` (with Developer mode enabled).
- **Firefox**: Download Mozilla-signed `marksync-firefox-v*.xpi` from [Releases](https://github.com/1378944437/marksync/releases/latest) and drag it into your browser window.

### 2. Connect Cloud Storage (Choose Either)
Click the MarkSync icon ➔ **Settings** ➔ **Cloud Storage**:
- **Option A: WebDAV**
  - Choose your provider preset (e.g. Nutstore or Nextcloud) to auto-fill the server URL;
  - Enter your username and **app-specific password**, click "Test these inputs", then "Save connection settings". Testing does not save or upload.
- **Option B: GitHub Gist**
  - Enter your Personal Access Token (PAT) with `gist` scope;
  - Click "Auto Create" or enter an existing Gist ID, test, then save. For multiple unordered legacy backups, choose the current version under "Adopt legacy Gist backups".

### 3. Sync
Return to the main page and click **Sync Now**. Enable **Auto Sync** in settings to keep changes continuously synced in the background.

---

## Sync and recovery behavior

- Only the bookmarks bar syncs by default. Comparison, upload and cloud restore use the same scope; excluded bookmarks are never moved or deleted. Full local snapshot restore is independent of cloud scope.
- First use, account/target changes and scope changes require a direction choice when contents differ. Matching counts do not prove matching contents.
- Changing, enabling or disabling encryption verifies and publishes a new backup before committing local settings. Historical encrypted files still require their original password. Use "Resume encryption migration" after interruption; do not delete migration records manually.
- Failed restore writes pause auto sync and retain the safety snapshot. Restore it through the recovery notice or snapshot page. A failed snapshot prevents replacement.
- New Gist backups use a version index. Unordered legacy files are not automatically deleted. Invalid indexes or unindexed old-client writes stop sync; coordinate upgrades across devices sharing a target.
- "Create a new file on the next upload" does not upload immediately. Configuration export excludes passwords and Gist tokens by default. Imports missing credentials do not start auto sync.

Local repairs and isolated validation are complete, including Edge integration, specific crash recovery scenarios and cross-browser functionality in Playwright Firefox. Validation against real providers and actual usage environments has been explicitly deferred to later use; these scenarios remain unverified. No signing or release was performed. See the [current delivery status](docs/DELIVERY_STATUS.md) for results, evidence and limitations (Chinese).

Use the [actual usage checklist](docs/ACTUAL_USAGE_CHECKLIST.md) when validating in a real environment.

Version 1.6.0 redesigns the standalone desktop console and fixes the mobile dashboard snapshot entry layout. See the [release page](https://github.com/1378944437/marksync/releases/tag/v1.6.0) for packages.

## 🏢 Common WebDAV Provider Quick Reference

| Provider | WebDAV Server URL | Username | Password Note |
| :--- | :--- | :--- | :--- |
| **Nutstore (坚果云)** | `https://dav.jianguoyun.com/dav/` | Account email | ⚠️ Must use **App Password** generated from Security Settings |
| **Nextcloud** | `https://your-domain.com/remote.php/dav/files/USER/` | Account name | App-specific password recommended; keep trailing slash `/` |
| **Synology NAS** | `https://nas.example.com:5006/home/` | DSM account | Enable WebDAV Server package and open the HTTPS port |
| **InfiniCLOUD** | `https://my.infinicloud.com/dav/` | Connection ID | Generate Connection Password in the dashboard |
| **Alist / Custom** | `https://dav.example.com/dav/` | Custom user | Ensure `PROPFIND`, `PUT`, `MKCOL` verbs are supported |

---

## 🛠️ Minimal Developer Guide

```bash
# Install dependencies
pnpm install

# Run automated tests (371 tests passing 100%)
pnpm test

# Development mode (with HMR)
pnpm dev:chrome   # or pnpm dev:firefox

# Production build (with strict type checks)
pnpm build
```

- **Architecture**: Domain-Driven Design (`core` / `infrastructure` / `application` / `components`);
- **Code Standard**: Strict 300-line limit per file for single responsibility; pure strict TypeScript.

---

## 📄 License

Open-sourced under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE) to guarantee full user sovereignty and privacy.
