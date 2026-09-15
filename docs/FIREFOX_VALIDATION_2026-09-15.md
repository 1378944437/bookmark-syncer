# MarkSync Firefox 跨浏览器功能验收

> 最新决定：用户已明确将真实验收延后到实际使用中。本轮已收尾，当前交付范围与状态见 [交付状态](DELIVERY_STATUS.md)；下文保留本阶段历史结果和当时的后续安排。

> 日期：2026-09-15｜版本：1.5.2｜状态：**Playwright Firefox 中 6 项功能验收通过，仍为待发布验收候选版。**
> 前序：[本地恢复中断验收](RESTORE_VALIDATION_2026-09-15.md)。本轮补充实际 Firefox 引擎及扩展 API 的功能证据，不将其等同于正式发行版人工验收。

## 1. 环境与结果

本机没有找到现成 Firefox，已通过已有 Playwright CLI 下载其配套 Firefox 153.0，放在系统临时目录 `marksync-browser-runtime`，没有安装到系统程序目录。运行时标识为 Nightly，Playwright revision 为 1538，BuildID 为 `20260722113508`；同机对端为 Edge 153.0.4234.32。

两个浏览器均使用新建临时 profile，分别加载实际 Firefox 和 Chrome 构建。Firefox 扩展由项目已有 `web-ext` 9.2.0 临时安装；操作使用真实后台消息、bookmarks、storage 和 IndexedDB，服务仅为监听 `127.0.0.1` 的内存 WebDAV 夹具。仅操作合成书签及测试 profile 的默认种子书签。

最终运行于北京时间 **17:16**，**6 项全部通过**，failure=null。未修改应用源码、测试、manifest、版本号、依赖或构建产物；没有签名或发布。

## 2. 已验证场景

| 场景 | 实际断言 | 结果 |
| --- | --- | --- |
| Firefox 临时安装及后台连接 | 后台状态为 RUNNING；真实后台连接测试成功 | 通过 |
| Edge → Firefox 首次同步 | 首次内容不同要求选择方向；覆盖拉取更新工具栏；菜单与范围外 Other 中同 URL 节点的原 ID 保留 | 通过 |
| 跨浏览器删除传播 | Firefox 确认相同基线后，Edge 删除并上传，Firefox 下次智能同步传播删除，菜单节点保留 | 通过 |
| Firefox 本地未上传修改 | 本地改名且 Edge 有新版本时要求选择方向，保留 Firefox 改名 | 通过 |
| Firefox → Edge 同步 | Firefox 明确上传后，Edge 智能同步得到其内容，过时书签移除 | 通过 |
| Firefox 完整本地快照恢复 | 真实清空前快照包含工具栏、菜单与 Other；清空后恢复得到相同内容、嵌套和顺序，恢复标记及旧同步基线清除 | 通过 |

“智能同步”由脚本发送实际后台请求，不代表本轮验证了 Firefox 自动闹钟或后台休眠。完整树比较忽略浏览器生成的物理 ID、时间和哈希；范围保护场景另行断言原 ID。

最终夹具收到 40 次 PROPFIND、5 次 PUT、17 次 GET、3 次 DELETE，全部针对合成文件。详情见 [results.json](validation/2026-09-15-firefox/results.json)。

## 3. 验收工具与复现

Playwright 能控制 Firefox 普通页面，但此配套运行时没有将扩展标签页暴露为可控制页面。初次导航超时记录保存在 [initial-navigation-timeout.json](validation/2026-09-15-firefox/initial-navigation-timeout.json)，不能算作业务验收通过。

最终使用 `web-ext` 已有 Firefox Remote Debugging Protocol 连接：从已安装扩展描述读取实际 URL，通过 Firefox 自身页面创建接口打开扩展标签页，再在该标签页执行真实 API 调用。RDP 辅助代码只负责传递与读取调用结果，不替换应用 provider 或浏览器数据。没有保留排查时尝试的扩展进程配置或 UUID 覆盖。

维护源：

- [verify-extension.cjs](../scripts/verify-extension.cjs)：沿用 WebDAV 服务、Edge profile 和结果记录，新增 `--firefox` 分支。
- [verify-firefox.cjs](../scripts/verify-firefox.cjs)：Firefox 启动、临时安装和 6 项场景。
- [firefox-page.cjs](../scripts/firefox-page.cjs)：基于项目 `web-ext` 9.2 的 RDP 适配；该依赖升级后需复验协议兼容性。

```powershell
# 仓库根目录；使用本机已有 Playwright，无需修改项目依赖
$env:MARKSYNC_PLAYWRIGHT = '<已安装的 playwright 模块绝对路径>'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $env:TEMP 'marksync-browser-runtime'

# 本机未准备运行时时执行；CLI 与模块使用同一 Playwright 版本
node (Join-Path $env:MARKSYNC_PLAYWRIGHT 'cli.js') install firefox
node scripts/verify-extension.cjs --firefox
```

初次下载的 CDN 连接重置，Playwright 自动切换其备用下载源后成功。最终脚本运行结束后测试浏览器、调试连接和本机服务关闭，临时 profile 与运行时保留供复验；已另外查询未发现本轮验收进程残留。

## 4. 质量证据与限制

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| 最终 Firefox/Edge 实际扩展功能验收 | 通过 | 6 项断言；清理调试配置后重新运行通过 |
| 三个脚本语法、每文件 300 行约束、`git diff --check` | 通过 | 本轮执行 |
| 应用源码、测试和两平台产物摘要 | 一致 | 与前序证据逐项比较；详见 [evidence.json](validation/2026-09-15-firefox/evidence.json) |
| 463 用例及双平台类型检查、构建 | 复用前序通过证据 | 本轮应用输入未改变；没有重新运行全量测试或构建 |
| Firefox 视觉、键盘及工具栏 popup | 未执行 | 本轮不提供页面截图或视觉通过结论 |
| 正式发行版 Firefox、签名安装、无调试器生命周期 | 未执行 | 当前为临时安装、带调试连接的 Playwright Nightly 运行时 |
| 真实 WebDAV/Gist 服务、移动端、双物理设备 | 未执行 | 本机夹具与同机 profile 不能代替真实权限、限流、网络及设备差异 |

Firefox 临时安装报告 `web_accessible_resources[].use_dynamic_url` 为不识别的属性。该属性由现有构建生成，本轮实际加载和功能检查均通过；没有手工修改 dist 来消除提示，也未将正式签名兼容性写成已通过。

## 5. 交接

- **结果**：完成真实 Firefox 引擎下的跨浏览器同步、菜单隔离和完整快照恢复，6 项通过。
- **验证**：最终脚本实跑及静态检查通过，输入摘要与此前应用测试、构建证据一致。
- **限制**：第 4 节列出的正式发行版、实际 UI 与真实服务场景仍待验收。
- **交付状态**：脚本、Markdown 和证据已保存；未提交、未推送、未签名、未发布。
- **下一步**：优先提供专用 WebDAV/Gist 测试目标的本机配置文件路径，完成真实服务验收；密码和令牌不在聊天或文档中发送。另需正式发行版 Firefox 的 UI、签名安装及后台生命周期验收。
