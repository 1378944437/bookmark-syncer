<p align="center">
  <img src="./packages/app/assets/icon.png" alt="汇签 Logo" width="96" height="96">
</p>

<h1 align="center">汇签 marksync</h1>

<p align="center">
  跨浏览器书签同步工具 · 基于 WebDAV 的自托管方案
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
  <a href="./README_en.md">English</a>
</p>

---

### 📸 预览

|              深色模式               |               浅色模式               |
| :---------------------------------: | :----------------------------------: |
| ![深色模式](./screenshots/dark.png) | ![浅色模式](./screenshots/light.png) |

### ✨ 特性

- 🔒 **自托管数据** - 使用你自己的 WebDAV 服务器存储书签
- 🌐 **跨浏览器** - 支持 Chrome、Edge、Firefox 等主流浏览器
- 🔄 **智能同步** - 增量同步，只传输变化的内容
- 📱 **自动同步** - 书签变化时自动上传
- ⏰ **定时同步** - 定期检查云端更新
- 📦 **本地快照** - 同步前自动备份，支持一键恢复

### 📦 安装

所有版本均从 [Releases](https://github.com/1378944437/marksync/releases/latest) 页面下载。

#### Chrome / Edge

**扩展 ID：** `fpccfkjndkjiljfj`（已固定，更新时不会变化）

1. 下载最新版本的 `chrome-extension.zip`
2. 解压到本地文件夹
3. 打开 `chrome://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」，选择解压后的文件夹

**更新扩展：**

- 下载新版本 zip，解压到**相同文件夹**（覆盖旧文件）
- 在 `chrome://extensions/` 点击扩展卡片的「刷新」按钮
- 扩展 ID 和所有本地数据都会保留

#### Firefox

**最低版本要求：Firefox 140+**

1. 下载最新版本的 `marksync-firefox-vX.X.X.xpi`（已签名）
2. 将 `.xpi` 文件拖入 Firefox 窗口，点击「添加」确认安装

**或手动安装：**

1. 打开 `about:addons`
2. 点击右上角齿轮图标 ⚙️
3. 选择「从文件安装附加组件」，选择 `.xpi` 文件

### ⚙️ 使用方法

1. 点击工具栏中的扩展图标，打开面板
2. 进入「设置」→「WebDAV 配置」
3. 填写你的 WebDAV 服务器地址、账号与密码
4. 点击「保存并测试连接」
5. 返回主页，点击「同步」按钮

> 💡 配置一次即可：之后书签变更会自动上传，也可随时手动同步或从快照恢复。

### 🔒 隐私

- 书签数据只在你配置的 WebDAV 服务器与本地之间传输，不经过任何第三方服务器
- 同步前自动创建本地快照，同步出错时可一键回滚
- 项目不内置任何账号体系，WebDAV 凭证仅保存在本地扩展存储中

### 🛠️ 开发与构建

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev:chrome   # Chrome 扩展开发
pnpm dev:firefox  # Firefox 扩展开发

# 构建生产版本（含 tsc strict 类型检查）
pnpm build

# 打包分发（自动签名 Firefox，打包 Chrome）
pnpm package
```

- 技术栈：TypeScript（strict）+ React 19 + Vite 5 + Vitest 4 + Tailwind 3
- 单元测试：`pnpm test`
- 架构说明见 [REFACTORING.md](./REFACTORING.md)

### 📄 许可证

[GNU AGPLv3](./LICENSE)
