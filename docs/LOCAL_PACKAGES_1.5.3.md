# MarkSync 1.5.3 本地安装包

> 日期：2026-09-15｜状态：本地包已生成并核对，未签名、未发布。

## 产物

| 文件 | 大小 | 用途 |
| --- | --- | --- |
| [marksync-chrome-v1.5.3.zip](../artifacts/marksync-v1.5.3/marksync-chrome-v1.5.3.zip) | 265,592 字节 | Chrome / Edge 解压加载，17 个运行文件 |
| [marksync-firefox-v1.5.3-unsigned.xpi](../artifacts/marksync-v1.5.3/marksync-firefox-v1.5.3-unsigned.xpi) | 265,166 字节 | Firefox 开发者临时加载，16 个运行文件；非永久安装签名包 |

[安装说明](../artifacts/marksync-v1.5.3/INSTALL.md) · [SHA-256 清单](../artifacts/marksync-v1.5.3/SHA256SUMS.txt) · [验证结果](validation/2026-09-15-packages/results.json)

## 构建与核对

基于本地修复提交 `bd477d1`，仅将根 `package.json` 版本从 1.5.2 更新到 1.5.3。两个 manifest 继续引用这一来源。使用本机已安装依赖构建和打包，无需下载项目依赖。

```powershell
# 分别在 apps/chrome-extension 与 apps/firefox-extension 执行
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

打包采用现有 `bestzip` 2.2.1 的程序接口，`cwd` 为对应 dist，`source` 为 `*`，输出为上表的绝对路径。遵循原打包规则，不包含 `.vite/manifest.json` 构建元数据。首次全目录数量检查发现这一排除项，随后按运行文件集合逐项核对；没有修改 dist 或压缩包来掩盖差异。

- 两平台 strict 类型检查和构建：**通过**。
- 包内根 manifest 版本 1.5.3、Manifest V3、入口及图标等资源存在性：**通过**。
- 包内每个运行文件与构建目录 SHA-256 相等、数量一致：**通过**。
- 应用源码与测试未改，463 项单元测试复用前序证据；本轮未重跑全量测试，也未将 1.5.2 的浏览器记录写成 1.5.3 实跑结果。
- 保留已有主包 500 kB 提示和 Browserslist 数据过期提示；Firefox 正式签名及真实服务验收未执行。

## 交接

- **结果**：Chrome/Edge ZIP 与 Firefox 未签名 XPI、安装说明和校验清单已生成。
- **验证**：本轮构建、类型和压缩包检查通过。
- **限制**：Chrome/Edge 需解压开发者加载；Firefox 需临时加载，永久安装需签名；真实验收继续延后。
- **交付状态**：已保存；版本与本地包说明尚未形成新提交。未推送、未签名、未发布。旧安装包及依赖缓存保留。
- **下一步**：按安装说明使用本地包；如以后需要永久 Firefox 安装或对外分发，再进入签名与发布流程。
