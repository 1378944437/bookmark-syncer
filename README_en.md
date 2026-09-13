<p align="center">
  <img src="./packages/app/assets/icon.png" alt="MarkSync Logo" width="100" height="100">
</p>

<h1 align="center">MarkSync 汇签</h1>

<p align="center">
  <strong>Modern, Privacy-First Cross-Browser WebDAV Bookmark Two-Way Sync Extension</strong>
</p>

<p align="center">
  <a href="https://github.com/1378944437/marksync/releases/latest">
    <img src="https://img.shields.io/github/v/release/1378944437/marksync?color=blue&style=flat-square&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/1378944437/marksync/releases">
    <img src="https://img.shields.io/github/downloads/1378944437/marksync/total?color=success&style=flat-square&logo=github" alt="Total Downloads">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/1378944437/marksync?color=orange&style=flat-square" alt="License">
  </a>
  <img src="https://img.shields.io/badge/tests-346%20passed-brightgreen?style=flat-square&logo=vitest" alt="Tests">
  <img src="https://img.shields.io/badge/typescript-strict-blue?style=flat-square&logo=typescript" alt="TypeScript Strict">
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react" alt="React 19">
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <a href="./README_en.md"><strong>English</strong></a>
</p>

---

## 📖 Introduction

**MarkSync (汇签)** is a lightweight, privacy-focused browser extension designed to synchronize bookmarks across multiple browsers and devices using your private WebDAV server. With no intermediate proprietary server involved, users maintain 100% data sovereignty.

Whether you run **Nutstore (坚果云)**, **Nextcloud / ownCloud**, **Synology NAS**, **InfiniCLOUD**, or self-hosted **Alist / Apache / Nginx WebDAV**, MarkSync works seamlessly out of the box with end-to-end encryption, incremental sync, and automatic local snapshot rollback.

---

## 📸 Preview

| Dark Mode | Light Mode |
| :-------: | :--------: |
| ![Dark Mode](./screenshots/dark.png) | ![Light Mode](./screenshots/light.png) |

---

## ✨ Key Features

- 🛡️ **End-to-End Encryption (E2E AES-256-GCM)**
  - Client-side encryption powered by PBKDF2 key derivation and authenticated AES-256-GCM cipher;
  - Bookmarks are encrypted before leaving your browser — even your cloud storage provider cannot read your data or folder hierarchy.
- 🔄 **Smart Incremental Sync & Three-Way Merge**
  - Structural SHA-256 tree hashing compares local and cloud bookmarks in milliseconds;
  - Only transfers differential changes, saving network bandwidth;
  - Intelligent deduplication and sibling-node collision resolution prevent duplicate bookmark explosion.
- 🧩 **One-Click Cloud Provider Presets**
  - Built-in configuration templates for Nutstore, Nextcloud, Synology NAS, InfiniCLOUD, and more;
  - Automatically populates standard WebDAV endpoint paths and recommended filenames.
- 📦 **Local Snapshot & Time Machine Rollback**
  - Automatically captures full local bookmark snapshots prior to every sync operation;
  - Configurable snapshot history limit with one-click restore, completely guarding against accidental deletions or overwrites.
- 🎨 **Modern Grouped Settings & UI/UX**
  - Four distinct domains: **General**, **Provider & Connection**, **Security & Encryption**, and **Backup & Maintenance**;
  - System-adaptive Dark / Light modes with zero-flicker theme provider, polished micro-interactions, and visual CheckCheck status micro-badge.
- ⚡ **Auto-Save on Blur & Viewport Stability**
  - Sensitive passwords feature toggleable visibility and persist automatically on blur/enter without manual clicks;
  - Compact 380px × 560px popup viewport with isolated drawer navigation and smooth gesture transitions.
- 🌐 **True Cross-Browser Compatibility**
  - Built on standard W3C WebExtensions API and Chrome Manifest V3;
  - Works on Google Chrome, Microsoft Edge, Brave, Vivaldi, 360 Extreme Browser, and Firefox 140+.

---

## 📦 Installation

Download the latest release from the [GitHub Releases Page](https://github.com/1378944437/marksync/releases/latest).

### Chrome / Microsoft Edge / Brave / Chromium-based Browsers

> 💡 **Fixed Extension ID**: This extension is packaged with a pinned key (pccfkjndkjiljfj). Updating the extension preserves your settings, storage, and ID.

1. Download marksync-chrome-vX.X.X.zip (or chrome-extension.zip) from the [Releases Page](https://github.com/1378944437/marksync/releases/latest);
2. Extract the ZIP archive into a permanent local directory (e.g. D:\extensions\marksync);
3. Navigate to the extension management page in your browser:
   - Chrome / Brave: chrome://extensions/
   - Microsoft Edge: dge://extensions/
4. Toggle on **"Developer mode"** in the top right corner;
5. Click **"Load unpacked"** in the top left;
6. Select the folder where you extracted the files.

**Upgrading to a new release:**
- Download the new ZIP, extract and **overwrite** the files in your existing folder;
- Return to chrome://extensions/ and click the **"Reload"** icon on the MarkSync card.

---

### Firefox Browser

> **Requirement**: Firefox 140 or higher.

1. Download the latest signed package marksync-firefox-vX.X.X.xpi from the [Releases Page](https://github.com/1378944437/marksync/releases/latest);
2. Drag and drop the .xpi file directly into your Firefox window, then click **"Add"** when prompted;
3. Alternatively, visit bout:addons, click the gear icon ⚙️, choose **"Install Add-on From File..."** and pick the .xpi file.

---

## ⚙️ Quick Start

1. **Open the Extension**: Click the MarkSync icon in your browser toolbar;
2. **Access Connection Settings**: Click the gear icon ⚙️ in the upper right corner to open Settings → **Provider & Connection**;
3. **Select Provider Preset** (or enter manually):
   - Choose your provider from the preset dropdown (e.g. "Nutstore" or "Nextcloud");
   - Fill in your username and app-specific password;
4. **Test & Save**: Click **"Test Connection"** to verify server accessibility and credentials;
5. **Enable E2E Encryption (Recommended)**:
   - Go to Settings → **Security & Encryption**;
   - Enable encryption and configure a strong Master Password. Note: you must use the exact same master password across all syncing devices;
6. **Trigger Sync**: Return to the home screen and click **"Sync Now"**. Once synchronized, the status card will display the double-check badge.

---

## 🏢 WebDAV Provider Cheat Sheet

| Provider | Recommended URL Format | Username | Password / Notes |
| :--- | :--- | :--- | :--- |
| **Nutstore (坚果云)** | https://dav.jianguoyun.com/dav/ | Email | ⚠️ **Must use an App Password** (generate in Nutstore Security Settings → Third-party Apps) |
| **Nextcloud** | https://your-cloud.com/remote.php/dav/files/USER/ | Username | Recommended to create an app password in Personal Settings → Security; ensure trailing slash / |
| **Synology NAS** | https://nas.example.com:5006/home/ | DSM account | Install WebDAV Server in DSM Package Center and expose port 5006 (HTTPS) |
| **InfiniCLOUD** | https://my.infinicloud.com/dav/ | Connection ID | Enable WebDAV Connection in InfiniCLOUD user dashboard and generate connection password |
| **Custom / Alist** | https://dav.example.com/dav/ | Account | Ensure standard HTTP verbs (PROPFIND, GET, PUT, MKCOL) are supported |

---

## 🛡️ Security & Privacy Architecture

`mermaid
flowchart LR
    subgraph Browser ["Local Browser (Chrome / Edge / Firefox)"]
        A[Local Bookmarks] <--> B[MarkSync Core Engine]
        B --> C[Local Snapshot Store]
        B --> D[AES-256-GCM Crypto Engine]
    end

    subgraph WebDAV ["Your Private WebDAV Server"]
        E[Encrypted / Plain Bookmarks]
    end

    D -- Direct TLS Connection --> E
`

1. **Zero Intermediate Servers**: MarkSync has no central backend, logs zero telemetry, and collects no user data;
2. **Local Credential Storage**: WebDAV credentials and encryption keys are isolated inside browser-sandboxed local storage (rowser.storage.local);
3. **Reversible Operations**: Prior to any remote mutation, a local snapshot is created, allowing instant recovery in the event of conflicts or network failure.

---

## 🏗️ Architecture & DDD Boundaries

MarkSync adopts **Domain-Driven Design (DDD)** principles to maintain clear boundaries:

`
packages/app/src/
├── core/                # Domain Core: entities, incremental merger, hashing, crypto, snapshot manager
├── infrastructure/      # Infrastructure: WebDAV client, local storage adapter, browser bookmark adapter
├── application/         # Application Services: sync orchestration, event dispatching, auto-sync polling
└── components/          # Presentation Layer: React 19 UI, settings drawers, status cards, atomic widgets
`

- **File Size Limit**: Each source code file strictly adheres to the Single Responsibility Principle and stays under 300 lines of code;
- **Platform Decoupling**: Browser-specific APIs are isolated behind infrastructure interfaces, making the core domain 100% unit-testable;
- **Robust Test Coverage**: 31 test suites containing 346+ unit test cases, thoroughly covering three-way merge algorithms, deduplication, and failure recovery.

---

## 🛠️ Development & Building

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Commands

`ash
# 1. Clone repository
git clone https://github.com/1378944437/marksync.git
cd marksync

# 2. Install dependencies
pnpm install

# 3. Run unit tests
pnpm test

# 4. Start Chrome extension in dev mode (hot reload)
pnpm dev:chrome

# 5. Start Firefox extension in dev mode
pnpm dev:firefox

# 6. Production build (with strict tsc type check)
pnpm build

# 7. Package extension archives
pnpm package
`

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q1: Nutstore reports "401 Unauthorized" when testing connection?</strong></summary>

> Nutstore requires a dedicated **App Password** for WebDAV access. Log in to Nutstore web portal, navigate to "Account Information" → "Security" → "Third-Party App Management", generate an App Password and paste it into MarkSync.
</details>

<details>
<summary><strong>Q2: Nextcloud returns "405 Method Not Allowed"?</strong></summary>

> Verify that your WebDAV URL includes the full path. The standard format is https://domain.com/remote.php/dav/files/<username>/ and must end with a trailing /.
</details>

<details>
<summary><strong>Q3: Will bookmarks be duplicated after syncing between multiple browsers?</strong></summary>

> No. MarkSync uses canonical URL hashing and smart folder matching algorithms. Bookmarks sharing identical URLs within the same folder are automatically unified. If an accidental conflict occurs, you can restore immediately from a local snapshot.
</details>

<details>
<summary><strong>Q4: What if I forget my E2E Master Password?</strong></summary>

> MarkSync uses authenticated AES-256-GCM encryption with **no backdoors or password recovery mechanisms**. If forgotten, you will need to re-initialize your encryption password and push your local bookmarks as a new cloud baseline. We strongly recommend storing your master password in a password manager.
</details>

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).
