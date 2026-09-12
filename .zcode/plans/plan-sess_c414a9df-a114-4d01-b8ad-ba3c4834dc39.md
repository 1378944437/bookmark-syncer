# 推送规范改动到 fork（1378944437/bookmark-syncer）

## 背景
本地目录 = 远端 master（`56c6acb`）快照 + 两个新改动（AGENTS.md、根 package.json 的 test 脚本）。目标：把这两个改动作为新提交推到 fork 的 master。

## 步骤
1. `git init -b master`，仓库级配置 `core.autocrlf false`（防止换行符把全库标记为改动）。
2. `git remote add origin https://github.com/1378944437/bookmark-syncer.git`，`git fetch origin master`。
3. `git reset origin/master`（mixed，**不动工作区文件**）：把本地分支指到远端最新提交，index 对齐远端树。此时 `git status` 只应显示真实差异——AGENTS.md（新增）和 package.json（修改，仅 test 一行）。若出现其他差异，停下报告而不是继续提交。
4. 若 git 身份未配置，设置仓库级身份：`user.name=1378944437`、`user.email=44130009+1378944437@users.noreply.github.com`（GitHub 官方 noreply 格式，不暴露真实邮箱）。
5. 提交（遵循仓库现有英文 conventional 风格）：
   `chore: add AGENTS.md workflow spec and root test script`
6. `git push origin master`（需 GitHub 凭证；若凭证管理器无存储凭证导致失败，报告阻塞并给出 `gh auth login` 或 PAT 的下一步，不重试硬推）。
7. 推送后查询 `api.github.com/repos/1378944437/bookmark-syncer/actions/runs` 确认 release-drafter 是否被触发及结果（CI 已触发 ≠ 已通过，分别报告）。

## 验证
- `git log --oneline`：新提交叠在 `56c6acb` 之上，历史为远端原历史 + 1 个新提交。
- 推送后 API 确认远端 master tip = 新提交，AGENTS.md 出现在仓库文件列表。
- `pnpm test` 已在上一轮验证通过（复用该证据，内容未再变化）。

## 交付后下一步（需另行授权，不在本次范围）
- 修复上面两个高风险 bug（拉取覆盖保护、时间戳基准统一）——属于 `core/sync` 高风险区，需方案确认后实施。
- 实现多设备来源标注方案 A（metadata 设备字段 + UI）。
- AGENTS.md 将随此提交公开到 GitHub，已确认不含敏感信息。