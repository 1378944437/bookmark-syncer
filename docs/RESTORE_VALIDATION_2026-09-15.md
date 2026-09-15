# MarkSync 本地书签恢复中断验收

> 后续更新：Playwright Firefox 的 6 项跨浏览器功能检查已通过，见 [Firefox 验收记录](FIREFOX_VALIDATION_2026-09-15.md)。下文保留本阶段历史结果及当时未执行项。

> 日期：2026-09-15｜版本：1.5.2｜状态：**最终 3 项集成验收通过，仍为待发布验收候选版。**
> 前序：[加密迁移中断恢复验收](INTERRUPTION_VALIDATION_2026-09-15.md)。本轮覆盖本地快照恢复发生部分写入后的浏览器崩溃。

## 1. 测试范围与中断方式

使用实际 Chrome 构建和隔离 Edge profile，以合成书签建立两个不同的完整树：目标快照包含书签栏文件夹、6 个子书签和 Other 书签；操作前树包含另一个文件夹、子书签、书签栏书签及 Other 书签。目标快照通过实际清空前备份创建，操作前树正常关闭并重开浏览器确认持久化。

开始恢复目标快照时，测试在该临时 Service Worker 内包装 `chrome.bookmarks.create`：每次创建均调用真实 API，唯独第 3 次创建完成后暂不交还结果，使流程稳定停在部分写入状态。此时核对实际书签树既不同于操作前树，也不同于目标树，并读取真实 IndexedDB 确认安全快照内容。

等待 6 秒给浏览器原生书签文件落盘后，通过 CDP `Browser.crash` 中断整个测试浏览器。重启后重新读取实际树，必须与中断点的部分结果一致。包装只存在于被终止的 Worker 内，重启后的回滚使用原生 API。未修改应用源码或构建产物。

整个过程使用独立临时 profile、本机 WebDAV 夹具及测试书签，不读写个人 profile 或真实云端账号。

## 2. 验收目标与当前结果

| 场景 | 实际断言 | 状态 |
| --- | --- | --- |
| 部分写入后崩溃 | 半成品书签树、恢复标记和完整操作前快照均跨重启保留；真实 UI 显示恢复入口 | 通过 |
| 恢复标记阻止上传 | 启用自动同步并新增合成书签，pending 标记不变；自然等待锁到期后，手动上传仍被恢复标记拒绝；全程无额外 PUT | 通过 |
| 从恢复提示回滚 | 点击恢复按钮及确认弹窗后，完整树的标题、URL、嵌套关系、顺序及 Other 内容与操作前一致；恢复标记、锁和旧同步基线清除；不新增安全快照，不上传；再重开后状态仍一致 | 通过 |

树比较忽略浏览器生成的物理 ID、时间和哈希等元数据，比较实际内容和顺序。用户仍可编辑书签；第二项验证的是恢复未完成期间这些事件不能触发上传，并非禁止用户编辑。显式回滚会按确认文案覆盖恢复期间的新增内容。

锁按照原实现的 `timestamp + 300000` 自然过期，没有修改锁记录或时钟。恢复标记必须在锁到期后继续有效，不能仅靠未到期锁阻止上传。

## 3. 复现与质量证据

```powershell
# 仓库根目录；需要 Windows、Edge 和本机已有 Playwright
$env:MARKSYNC_PLAYWRIGHT = '<已安装的 playwright 模块绝对路径>'
node scripts/verify-extension.cjs --restore-interruption

# packages/app：本轮执行的相关回归
node node_modules/vitest/vitest.mjs run tests/core/sync/local-restore.test.ts tests/core/backup/snapshot-manager.test.ts --reporter=dot
```

- 入口：[verify-extension.cjs](../scripts/verify-extension.cjs)，场景：[verify-restore-interruption.cjs](../scripts/verify-restore-interruption.cjs)。沿用已有 profile、消息、服务和结果记录逻辑。
- 集成结果：[results.json](validation/2026-09-15-restore/results.json)，最终 failure=null；中断提示截图：[interrupted-restore.png](validation/2026-09-15-restore/interrupted-restore.png) 已目视核对恢复入口。
- 本轮相关单元回归：**2 文件、17 用例通过**，包含本地恢复失败保留证据、显式回滚、快照 CRUD 和保留数量等既有用例。
- 两个验收脚本语法、300 行限制和 `git diff --check` 通过。应用源码、测试和两平台产物的 SHA-256 摘要均与上一轮一致；复用此前 **46 文件、463 用例、双平台类型检查及构建通过**的证据，不声称此次重新执行全量检查。
- 最终摘要：[evidence.json](validation/2026-09-15-restore/evidence.json)。运行结束后另行核对，未发现本轮测试浏览器或验收脚本残留进程。

## 4. 限制与后续

本轮是通过临时 API 回调暂停和 CDP 主动崩溃进行的故障注入，不是无调试器自然崩溃。它覆盖实际创建节点后中断的窗口，不能推断删除、移动、IndexedDB 提交等所有可能中断点，也不证明设备断电或磁盘损坏下的数据持久性。

本轮 UI 检查针对真实扩展标签页中的恢复提示与确认框，不是工具栏原生 popup、屏幕阅读器或真实浏览器缩放验收。真实 WebDAV/Gist、Firefox、移动端与双物理设备等环境仍待验证；真实服务及 Firefox 尚需专用配置文件和可执行文件路径，不在聊天中发送密码或令牌。

## 5. 交接

- **结果**：完成本地快照恢复部分创建节点后崩溃、安全阻断及 UI 回滚的 3 项真实扩展验收；本轮未发现需要修改应用源码的问题。
- **验证**：3 项集成、17 项相关单元回归及脚本检查通过；应用输入摘要与前序测试、构建证据一致。
- **限制**：见第 4 节，仍为待发布验收候选版。
- **交付状态**：脚本、文档、截图和最终证据已保存；未提交、未推送、未签名、未发布。
- **下一步**：优先完成专用 WebDAV/Gist 服务及 Firefox 实机验收；其余环境限制见第 4 节。
