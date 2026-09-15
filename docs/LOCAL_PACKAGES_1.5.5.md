# MarkSync 1.5.5：手机留白与桌面弹窗尺寸修复

> 2026-09-15。本地修复、双平台构建及安装包校验完成。1.5.4 已发布；本文记录后续 1.5.5 修复，未创建新 Release。

## 原因与修复

- 手机同步页、设置页沿用了桌面固定 560px 高度，容器之外留下未使用的屏幕区域。现在移动设备的紧凑页面使用全宽、动态视口高度，并保留底部安全区。
- 1.5.4 的 `max-width:100%` 和 `max-height:100dvh` 使桌面原生弹窗依赖自己的初始视口进行测量。在隔离 Edge 原生 action popup 中复现为 **25×25**。桌面现在提供独立的 **360×560** 测量尺寸，避免循环约束。
- 移动设备通过 UA、移动客户端提示以及 iPad 桌面 UA 的触控特征识别。仅有触屏能力的 Windows 笔记本继续采用桌面弹窗尺寸。扩展宿主可能把手机触控页面的 `hover/pointer` 报告为桌面值，因此不以该媒体条件作为唯一依据。
- 保留 1.5.4 的设置页滚动通道、主题颜色和安全区处理；同步、恢复、加密逻辑未修改。

## 本轮验证

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| 原生桌面弹窗 | 3 次通过 | 隔离 Edge，`chrome.action.openPopup()`，直接读取 popup 调试目标；连续三次均为 360×560 |
| 手机同步页与设置页 | 10 项通过 | 同一页面不刷新，在 390×740、412×915、320×640、390×320、390×740 间调整；容器填满视口且无横向溢出 |
| 设置页滚动 | 24 项通过 | 中英文、手机短屏、桌面紧凑布局和完整控制台；WebDAV / Gist 底部按钮完整可见且中心可命中 |
| WebDAV 键盘访问 | 12 种场景通过 | Tab 可到达底部测试按钮 |
| 主题颜色 | 6 项通过 | 页面背景、主题元数据保持一致 |
| 针对性单元测试 | 10 项通过 | 8 项设备识别、2 项现有独立控制台导航 |
| Chrome / Firefox 类型检查及构建 | 通过 | 最终源码，保留既有大包和 Browserslist 提示 |
| 本地包逐文件校验 | 通过 | manifest 版本/引用及每个运行文件与 dist 的 SHA-256 一致 |
| Quetta 真机、Firefox 原生工具栏弹窗 | 未执行 | 手机为 Android UA、触控和视口模拟，不能视为真机已验收 |

上一轮仅在固定视口标签页中检查滚动，没有覆盖原生弹窗首次测量；本轮新增 [原生弹窗与移动视口脚本](../scripts/verify-viewport-layout.cjs) 修补该验证缺口。无头浏览器默认 800×600 虚拟屏幕会额外限制弹窗高度，本轮明确使用 1280×900 虚拟桌面。超小桌面可用区域下的浏览器自动尺寸限制不在本轮通过结论内。

[修复前原生弹窗](validation/2026-09-15-viewport-layout/baseline.json) · [最终尺寸结果](validation/2026-09-15-viewport-layout/results.json) · [滚动与主题](validation/2026-09-15-viewport-layout/settings/results.json) · [包校验](validation/2026-09-15-viewport-layout/packages.json)

## 安装包与交接

- **结果**：已保存两项 UI 修复并生成 1.5.5 本地包，旧包保留。
- **验证**：见上表；远端构建结果以对应提交的 GitHub Actions 为准。
- **限制**：真机表现仍在实际使用中确认；本地 Firefox 包未签名。
- **交付状态**：沿用此前用户授权提交并推送以触发远端测试和构建；1.5.5 尚未公开发布。
- **下一步**：更新扩展后核对实际手机和桌面表现。

[Chrome / Edge ZIP](../artifacts/marksync-v1.5.5/marksync-chrome-v1.5.5.zip) · [Firefox 临时测试 XPI](../artifacts/marksync-v1.5.5/marksync-firefox-v1.5.5-unsigned.xpi) · [安装说明](../artifacts/marksync-v1.5.5/INSTALL.md) · [校验清单](../artifacts/marksync-v1.5.5/SHA256SUMS.txt)
