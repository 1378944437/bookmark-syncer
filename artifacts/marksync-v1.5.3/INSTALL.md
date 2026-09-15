# MarkSync 1.5.3 本地安装

## Chrome / Edge

1. 将 `marksync-chrome-v1.5.3.zip` 解压到一个固定目录，确保目录内直接包含 `manifest.json`。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择上述目录。
4. 在扩展详情中确认版本为 **1.5.3**。保留解压目录，后续浏览器会从这里加载文件。

ZIP 用于解压加载，不能作为签名安装包直接拖入安装。已有通过解压加载的版本可备份书签后，用此包更新原目录，再点击扩展卡片的重新加载；不要为了更新而先卸载扩展，卸载会影响扩展本地设置与快照。

## Firefox 临时测试

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”，选择 `marksync-firefox-v1.5.3-unsigned.xpi`。
3. 确认版本为 **1.5.3**。如选择器不接受 XPI，可将其作为 ZIP 解压，再选择根目录中的 `manifest.json`。

此 XPI **未签名**，用于开发者临时加载，浏览器重启后临时安装会失效；不能当作正式发行版 Firefox 的永久安装包。永久安装需要后续 Mozilla 签名。

## 校验与验证范围

`SHA256SUMS.txt` 记录两个文件的 SHA-256，可用 PowerShell `Get-FileHash -Algorithm SHA256 <文件路径>` 比较。

本轮已通过双平台类型检查、构建、包内 manifest 版本、资源引用和逐文件内容校验。此前的 463 项单元测试及隔离浏览器证据可参阅仓库的 `docs/DELIVERY_STATUS.md`；真实服务及实际环境验收按既定决定延后到使用中。此次没有签名、推送或发布。
