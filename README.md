<p align="center">
  <img src="./packages/app/assets/icon.png" alt="MarkSync Logo" width="100" height="100">
</p>

<h1 align="center">汇签 MarkSync</h1>

<p align="center">
  <strong>现代化、隐私优先的跨浏览器 WebDAV 书签双向同步工具</strong>
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
  <a href="./README.md"><strong>简体中文</strong></a> | <a href="./README_en.md">English</a>
</p>

---

## 📖 简介

**汇签 (MarkSync)** 是一款面向现代多浏览器生态打造的跨平台书签同步浏览器扩展。它彻底摒弃了第三方中转服务器，将完全的数据主权交还给用户。通过私有 WebDAV 协议，在 Chrome、Edge、Firefox 等不同浏览器及多台设备间实现书签的毫秒级双向同步、增量更新与端到端加密保护。

无论你使用的是 **坚果云 (Nutstore)**、**Nextcloud / ownCloud**、**群晖 Synology NAS**、**InfiniCLOUD** 还是自建的 **Alist / Apache / Nginx WebDAV**，MarkSync 都能开箱即用。

---

## 📸 界面预览

| 深色模式 (Dark Mode) | 浅色模式 (Light Mode) |
| :------------------: | :-------------------: |
| ![深色模式](./screenshots/dark.png) | ![浅色模式](./screenshots/light.png) |

---

## ✨ 核心特性

- 🛡️ **端到端加密 (E2E AES-256-GCM)**
  - 支持基于 PBKDF2 强密钥派生与 AES-256-GCM 算法的客户端端到端加密；
  - 数据在离开浏览器前已被加密，即使云盘提供商也无法获知任何书签明文与层级结构。
- 🔄 **智能增量双向同步与三路合并**
  - 基于树形 SHA-256 结构哈希对比，毫秒级探测本地与云端差异；
  - 仅传输增量变更，带宽占用极低；
  - 具备智能去重与兄弟节点防碰撞合并算法，有效防止多端同步造成书签翻倍。
- 🧩 **主流云存储一键预设模板**
  - 内置坚果云、Nextcloud、群晖 NAS、InfiniCLOUD 等服务商模板；
  - 自动填充服务商标准 WebDAV 路径与建议文件名，告别繁琐的手动配置。
- 📦 **本地快照安全回滚体系**
  - 每次同步操作前自动创建完整的本地书签时光机快照；
  - 支持快照留存数量配置，随时一键全量回滚，彻底杜绝数据误删或意外覆盖。
- 🎨 **全新四大业务设置架构与现代 UI**
  - **常规设置**：自动同步、定时全量轮询、快照配额与指标展示；
  - **服务商连接**：地址、账号、应用密码安全测试与配置；
  - **安全与加密**：独立加密管理页，主密码强度与加解密状态指示；
  - **备份与维护**：快照时光机与同步底层诊断。
  - 支持暗黑/浅色自适应、无闪烁全局主题、微交互动效与双勾状态感知微徽章。
- ⚡ **失焦即存与防误触保障**
  - 敏感密码支持一键显隐，并在失焦或回车时立即原子化持久化；
  - 标准 380px × 560px 紧凑弹窗视口，平滑抽屉导航与滚动隔离。
- 🌐 **全平台无缝兼容**
  - 严格遵循 W3C WebExtensions 标准与 Chrome Manifest V3；
  - 支持 Chrome、Microsoft Edge、Brave、Vivaldi、360 极速浏览器以及 Firefox 140+。

---

## 📦 安装指南

最新版本安装包可直接前往 [GitHub Releases 页面](https://github.com/1378944437/marksync/releases/latest) 下载。

### Chrome / Microsoft Edge / Brave / Chromium 内核浏览器

> 💡 **固定扩展 ID 说明**：本扩展打包时内置了固定密钥，离线安装后生成的扩展 ID 为 pccfkjndkjiljfj。后续更新版本直接覆盖文件即可，配置与书签映射不会丢失！

1. 在 [Releases 页面](https://github.com/1378944437/marksync/releases/latest) 下载 marksync-chrome-vX.X.X.zip（或 chrome-extension.zip）；
2. 将下载的 ZIP 压缩包解压到本地指定目录（例如：D:\extensions\marksync）；
3. 打开浏览器，在地址栏输入对应页：
   - Chrome / Brave: chrome://extensions/
   - Microsoft Edge: dge://extensions/
4. 开启页面右上角的 **「开发者模式」 (Developer Mode)**；
5. 点击左上角的 **「加载已解压的扩展程序」 (Load unpacked)**；
6. 选择刚才解压出来的文件夹，安装完成！

**后续版本无缝升级步骤：**
- 下载最新版 ZIP 包，解压并**直接覆盖**原文件夹中的文件；
- 回到扩展管理页面，点击 MarkSync 卡片上的 **「刷新」** 按钮即可完成升级。

---

### Firefox 浏览器

> **环境要求**：Firefox 140 或更高版本。

1. 在 [Releases 页面](https://github.com/1378944437/marksync/releases/latest) 下载最新签名文件 marksync-firefox-vX.X.X.xpi；
2. 直接将 .xpi 文件拖入 Firefox 浏览器窗口中，在弹出的权限对话框中点击 **「添加」** 即可。
3. 也可在 Firefox 中打开 bout:addons，点击右上角齿轮图标 ⚙️，选择 **「从文件安装附加组件...」** 并选中下载的 .xpi 文件。

---

## ⚙️ 快速配置与使用指南

1. **打开扩展面板**：点击浏览器右上角扩展栏中的 MarkSync 图标；
2. **进入连接配置**：点击右上角齿轮图标进入「设置」→「服务商与连接」；
3. **选择服务商预设**（或手动输入）：
   - 点击预设下拉菜单选择您的服务商（如「坚果云」或「Nextcloud」），系统将自动填入规范 URL；
   - 填入您的用户名与密码/应用专用密码；
4. **测试连接并保存**：点击 **「测试连接」** 按钮，验证网络与授权无误后保存；
5. **开启端到端加密（强烈推荐）**：
   - 进入「设置」→「安全与加密」；
   - 开启加密并设置您的主密码（Master Password）。请务必牢记主密码，多台设备同步时须保持密码完全一致；
6. **一键同步**：返回首页，点击 **「立即同步」** 按钮。同步成功后首页状态卡片将点亮双勾徽章。

---

## 🏢 主流 WebDAV 服务商配置速查

| 服务商 | 推荐 WebDAV 服务器 URL 格式 | 账号 / 用户名 | 密码类型 / 注意事项 |
| :--- | :--- | :--- | :--- |
| **坚果云 (Nutstore)** | https://dav.jianguoyun.com/dav/ | 注册邮箱 | ⚠️ **必须使用应用授权密码**（安全中心-第三方应用管理中生成），不能使用登录主密码 |
| **Nextcloud** | https://your-cloud.com/remote.php/dav/files/USER/ | 登录用户名 | 推荐在「个人设置」→「安全」中生成设备专用密码；URL 末尾记得保留 / |
| **群晖 NAS (Synology)** | https://nas.example.com:5006/home/ | DSM 账号 | 需在 DSM 套件中心安装 WebDAV Server 并开放 HTTPS 端口（默认 5006） |
| **InfiniCLOUD** | https://my.infinicloud.com/dav/ | 连接 ID | 在 InfiniCLOUD 个人仪表盘开启 WebDAV Connection 并生成专用连接密码 |
| **自建 WebDAV / Alist** | https://dav.example.com/dav/ | 自建账号 | 确保服务器支持标准 PROPFIND、GET、PUT、MKCOL 等 HTTP 动词 |

---

## 🛡️ 数据隐私与安全模型

`mermaid
flowchart LR
    subgraph Browser ["本地浏览器 (Chrome / Edge / Firefox)"]
        A[本地书签树] <--> B[MarkSync 核心引擎]
        B --> C[本地时光机快照库]
        B --> D[AES-256-GCM 加密模块]
    end

    subgraph WebDAV ["您的私有 WebDAV 云盘"]
        E[密文/明文书签数据]
    end

    D -- TLS 加密通道直连传输 --> E
`

1. **绝对零中转**：MarkSync 没有后台服务器，没有数据上报，不收集任何用户隐私或使用追踪；
2. **凭据安全隔离**：您的 WebDAV 账号、密码及加密密钥仅保存在浏览器受沙箱保护的本地存储中（rowser.storage.local）；
3. **数据可逆与时光机**：任何云端覆写前均对本地书签进行版本归档，无论遇到断网、冲突还是误操作，随时可无损回滚。

---

## 🏗️ 架构设计与分层约束

MarkSync 严格遵循 **领域驱动设计 (DDD)** 分层原则与高内聚低耦合规范：

`
packages/app/src/
├── core/                # 领域核心层：实体定义、增量合并、哈希计算、加解密、快照管理器
├── infrastructure/      # 基础设施层：WebDAV 客户端封装、本地存储适配器、浏览器书签 API 适配器
├── application/         # 应用服务层：同步编排、事件调度、自动化同步轮询
└── components/          # 表现展示层：现代 React 19 组件、设置抽屉、状态卡片、原子 UI
`

- **单文件规范**：严格恪守单一职责原则，每个源代码文件控制在 300 行以内；
- **平台解耦**：浏览器差异性 API 经由基础设施层统一适配，核心逻辑具备 100% 独立单测能力；
- **完备单测保障**：包含 31 个测试套件，346+ 个单元测试用例，覆盖三路合并算法、同名去重、错误回滚等关键边界场景。

---

## 🛠️ 本地开发与贡献指南

### 环境依赖
- Node.js >= 20.0.0
- pnpm >= 10.0.0

### 快速开始

`ash
# 1. 克隆代码仓库
git clone https://github.com/1378944437/marksync.git
cd marksync

# 2. 安装项目依赖
pnpm install

# 3. 运行自动化单元测试套件
pnpm test

# 4. 启动 Chrome 扩展开发模式（支持热重载）
pnpm dev:chrome

# 5. 启动 Firefox 扩展开发模式
pnpm dev:firefox

# 6. 全量生产构建（执行 strict 类型检查）
pnpm build

# 7. 打包扩展分发制品
pnpm package
`

---

## ❓ 常见问题排查 (FAQ)

<details>
<summary><strong>Q1: 坚果云测试连接提示「401 Unauthorized」？</strong></summary>

> 坚果云禁止直接使用账户登录密码访问 WebDAV。请登录坚果云网页版，进入「账户信息」→「安全设置」→「第三方应用管理」，点击「添加应用密码」生成专用授权密码并在 MarkSync 中填入。
</details>

<details>
<summary><strong>Q2: Nextcloud 提示「405 Method Not Allowed」？</strong></summary>

> 请检查 WebDAV 服务器地址是否输入完整。标准 Nextcloud WebDAV 路径格式为：https://domain.com/remote.php/dav/files/用户名/，末尾必须带有斜杠 /。
</details>

<details>
<summary><strong>Q3: 多个浏览器同步后书签是否会发生重复？</strong></summary>

> 不会。MarkSync 拥有成熟的 URL 指纹比对算法与同名目录合并策略。在同步合并过程中，相同层级下的同 URL 书签会自动归一化去重。如果不小心误操作，可随时通过「备份与维护」中的历史快照恢复至初始状态。
</details>

<details>
<summary><strong>Q4: 开启端到端加密后忘记主密码怎么办？</strong></summary>

> 因安全模型基于 AES-256-GCM 强加密算法，**无任何后门或恢复途径**。若遗失密码，您需要在新设备上重置密码并从本地书签重新推送到云端覆盖。强烈建议将主密码妥善保存至密码管理器中。
</details>

---

## 📄 开源许可证

本项目基于 [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE) 协议开源。
