# marksync 代码审查与改进建议

> 审查日期：2026-09-14｜代码版本：1.5.2｜Git 基准：`83ce836`
> 状态：审查完成；建议尚未实施。本文是当前代码的审查记录，不替代架构与流程权威文档。

## 1. 结论与范围

当前项目通过既有单元测试、双浏览器类型检查和构建，但仍存在影响同步范围、备份选择、恢复可靠性和交互闭环的缺陷。建议下一轮先修复数据安全与同步正确性，再扩展功能或重塑视觉。

- **核心发现**：14 项功能与可靠性问题，其中 P1 10 项、P2 4 项；另列 7 项 UI/UX 改进。
- **证据**：既有 41 个测试文件、427 个用例通过；额外 9 个隔离检查复现了异常行为。
- **优先处理**：F01/F02 范围越界、F03 Gist 版本选择、F04/F05/F06/F14 失败保护，再处理 F07/F08/F09。
- **审查方式**：追踪重点调用链、检查既有测试夹具、运行测试与构建、使用模拟浏览器和模拟网络复现。未修改业务源码，未访问真实云端账号或操作真实书签。
- **范围**：`core/bookmark`、`core/sync`、`core/storage`、`core/backup`、应用调度、后台消息、WebDAV/Gist、配置与加密交互、popup/fulltab、manifest、CI 及文档。属于重点链路审查，不承诺穷尽所有缺陷。

### 1.1 严重性与证据口径

| 标记 | 定义 |
| --- | --- |
| P0 | 无需特定边界条件即可造成广泛严重事故；本次没有足够证据认定 P0 |
| P1 | 有具体触发路径的数据损失、隐私边界失效、危险操作或关键流程中断，应优先修复 |
| P2 | 可恢复的功能错误、状态误报、调度遗漏或明显体验缺陷 |
| P3 | 维护性与性能候选优化，需要实际收益支撑 |
| 已复现 | 用真实业务函数和模拟外部依赖观察到异常；不等于真实浏览器端到端验证 |
| 静态确认 | 调用链或渲染代码可明确证明缺口；事故概率及实际设备表现未测 |

### 1.2 与旧报告的区别

实际目录已有 `.git`，审查开始时 `git status --short` 为空；`AGENTS.md` 的“没有 Git 仓库”描述已过时。源码目录盘点为 144 个文件，未发现超过 300 行的文件；存储提供者接口与 Gist 实现已存在，原 Core → Application 状态依赖已下沉。本次构建未出现旧报告所述同步策略循环依赖警告。

旧 UI 报告中的“密码无显隐按钮”“整块抽屉可拖动”“360×520 固定尺寸”等结论不再直接适用：当前 WebDAV 已有密码显隐，Drawer 仅手柄启动拖拽，popup 为 360×560，并有独立标签页。本文不复用旧报告的分数或历史测试结果。

## 2. Bug、缺陷与修复验收

### F01 · P1 · 同步范围过滤不适配真实根节点，范围开关失效

- **位置**：[sync-scope.ts:35](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/sync-scope.ts:35)；[push-strategy.ts:65](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/strategies/push-strategy.ts:65)、[pull-strategy.ts:97](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/strategies/pull-strategy.ts:97)。
- **触发**：浏览器返回 `[root]`，系统文件夹位于 `root.children`；使用默认“仅书签栏”。
- **原因与影响**：过滤器只检查传入数组元素的 `folderType`，根节点没有该字段便整体保留。其他书签、移动书签仍进入上传、比较和恢复，违反用户选择的隐私与删除边界。
- **证据**：R01 已复现；既有 `sync-scope.test.ts` 用平铺系统文件夹数组测试，未覆盖真实根结构。
- **建议与验收**：保留根容器，仅过滤系统文件夹层；以 Chrome/Firefox 真实根结构验证上传不包含排除项、拉取不改动排除项。修复后统一后台脏检测与云端恢复的范围哈希口径，避免当前全树哈希与过滤后哈希混用。

### F02 · P1 · 恢复的全局索引可从未参与恢复的文件夹搬走书签

- **位置**：[repository.ts:100](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/repository.ts:100)；[sync-bookmark-item.ts:60](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/sync-bookmark-item.ts:60)。
- **触发**：备份只包含书签栏，其中某 URL 本地仅存在于“其他书签”。
- **原因与影响**：仓储用完整本地树建索引；当前目标文件夹匹配失败后，会从整个索引寻找 URL 并执行移动。即使修正 F01，未参与恢复的文件夹仍可能失去书签。
- **证据**：R02 已复现：仅恢复 Bar，却调用 `move('10', { parentId: '1', index: 0 })`，原节点属于 Other。
- **建议与验收**：全局复用限定在本轮参与恢复的系统根中；范围外同 URL 应在目标内新建。补验范围内跨文件夹移动仍复用节点，范围外节点内容、ID 和位置均不变。

### F03 · P1 · Gist 所有文件共用更新时间，可能读旧版本、删新版本

- **位置**：[gist-provider.ts:81](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/infrastructure/storage/gist-provider.ts:81)；[file-manager.ts:180](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/storage/file-manager.ts:180)，同文件清理排序逻辑。
- **触发**：一个 Gist 保存多份备份，返回文件枚举顺序为旧文件在前、新文件在后。
- **原因与影响**：适配器把 `gist.updated_at` 赋给每个文件的 `lastModified`；排序全部并列，最新选择与保留清理实际上依赖响应中的枚举顺序。可能恢复旧内容，也可能删掉刚上传的最新备份。
- **证据**：R03 已复现：六份顺序排列的文件中选中第一份旧文件，保留上限为五时删除第六份新文件。这里证明的是允许发生的顺序条件，不是假定服务端永远如此排序。
- **建议与验收**：为 Gist 明确定义当前备份引用和修订标识，避免把容器更新时间冒充文件时间；清理必须保护本次成功上传文件。用多设备、多版本、任意枚举顺序测试最新选择和保留结果。

### F04 · P1 · 云端读取失败被当成无备份，预检仍放行上传

- **位置**：[file-manager.ts:180](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/storage/file-manager.ts:180)、[upload-precheck.ts:158](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/utils/upload-precheck.ts:158)、[gist-provider.ts:96](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/infrastructure/storage/gist-provider.ts:96)；[queue-manager.ts:92](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/storage/queue-manager.ts:92)。
- **触发**：列目录返回 503/认证错误，或下载后的 gzip 内容损坏，而后续写请求可以成功。
- **原因与影响**：最新文件查询捕获错误返回 `null`；Gist 列表捕获错误返回 `[]`；上传预检对普通错误返回 `proceed`。gzip 损坏也只抛普通 `Error`，不受 `CloudDataError` 中止保护。未确认远端状态便可能上传旧本地内容，使其成为新版本并触发保留清理。
- **证据**：R04 已复现远端列表拒绝后预检返回 `proceed`；gzip 错误路径为静态确认。Gist 的错误还会使 UI 将鉴权失败误显示为空列表。
- **建议与验收**：只在明确“目录/备份不存在”时允许首次上传；认证、超时、服务错误、解压或解析失败均中止。注入这些错误时断言不发生 PUT/PATCH/DELETE，界面显示可操作的错误原因。

### F05 · P1 · 恢复写入失败被吞掉，仍删除旧节点并报告成功

- **位置**：[sync-bookmark-item.ts:140](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/sync-bookmark-item.ts:140)、[sync-folder-item.ts:128](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/sync-folder-item.ts:128)、[repository.ts:175](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/repository.ts:175)。
- **触发**：目标书签或文件夹创建失败，例如浏览器拒绝某 URL、节点已变化或 API 写入异常。
- **原因与影响**：创建、更新、移动错误只记日志，上层继续删除未处理节点；仓储 Promise 仍成功完成，拉取随后保存成功基线。用户可能失去旧节点，也没有得到完整目标树。
- **证据**：R05 已复现：模拟新书签创建失败，恢复仍删除旧书签，且 Promise 正常完成。
- **建议与验收**：必要写入失败时停止删除阶段，向上返回失败和已完成范围；不得保存成功基线。分别注入 create/update/move 错误，验证不继续危险删除、UI 不显示成功，并能定位前置快照。

### F06 · P1 · 前置快照失败仍执行覆盖恢复，失去回滚依据

- **位置**：[pull-strategy.ts:61](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/strategies/pull-strategy.ts:61)、[cloud-operations.ts:157](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/cloud-operations.ts:157)。
- **触发**：IndexedDB 配额、读写或初始化失败，随后用户执行覆盖拉取/指定云端备份恢复。
- **原因与影响**：快照异常被捕获后继续恢复；一旦目标有误或写入部分失败，没有承诺的恢复前快照。普通上传与破坏性覆盖不应共用“快照失败也继续”的策略。
- **证据**：静态确认；本地快照恢复路径会因快照失败退出，云端恢复路径却继续，保护行为不一致。
- **建议与验收**：覆盖操作必须先确认安全快照落盘；失败时停止并提示存储问题。模拟 `createSnapshot` 拒绝，断言不调用任何书签修改 API。若需允许无备份恢复，应是单独明确授权的危险操作。

### F07 · P1 · 本地恢复、清空与重置未纳入统一后台互斥

- **位置**：[useSnapshots.ts:49](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/hooks/useSnapshots.ts:49)、[FullTabSnapshots.tsx:72](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/fulltab/FullTabSnapshots.tsx:72)、[danger-operations.ts:20](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/danger-operations.ts:20)、[op-handler.ts:58](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/background/op-handler.ts:58)。
- **触发**：popup 本地恢复过程中关闭面板；两个标签页同时恢复；同步执行期间清空书签、清空云端或恢复出厂。
- **原因与影响**：这些操作在页面直接执行，没有获取同步锁；恢复标志只抑制部分自动任务，无法阻止已运行或手动同步。FullTab 恢复按钮也没有执行中禁用。可能发生中途停止、重复恢复、边删边同步或重置时锁状态被清除。
- **证据**：静态确认入口与后台消息列表缺口；真实浏览器关闭面板及并发事故尚未端到端复现。
- **建议与验收**：复用后台操作入口，所有书签/云端破坏性操作共用互斥与执行状态；前置快照、执行、结果落盘作为同一流程。验收关闭 popup、重复点击、双标签页及定时同步同时触发。

### F08 · P1 · 修改加密密码先覆盖旧密码，重传被旧密文预检阻断

- **位置**：[E2EEncryptionSection.tsx:80](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/settings/E2EEncryptionSection.tsx:80)；[push-strategy.ts:58](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/strategies/push-strategy.ts:58)、[upload-precheck.ts:56](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/utils/upload-precheck.ts:56)。
- **触发**：云端已有旧密码加密的备份，在设置中保存新密码并自动重传。
- **原因与影响**：先持久化新密码，再用它解密旧云端进行预检，必然失败；本地新密码已经保存，云端仍是旧密码，后续同步持续失败。关闭加密时，读取路径也不再传递保留的密码，遇到旧 `.enc` 文件会阻断。
- **证据**：R09 已复现真实加解密与预检的拒绝；UI 先保存后重传顺序为静态确认。
- **建议与验收**：把“读取旧备份的密码”和“写新备份的密码”分离；旧密码验证、新备份上传验证成功后再提交设置。失败保留旧配置，历史备份明确标注所需密码；补验改密、关闭、重开以及网络失败。

### F09 · P1 · FullTab 未接入冲突界面，且覆盖推送绕过二次确认

- **位置**：[FullTabDashboard.tsx:44](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/fulltab/FullTabDashboard.tsx:44)、同文件第 87、177 行；[useSyncActions.ts:90](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/hooks/useSyncActions.ts:90)、同文件第 212 行。
- **触发**：独立标签页首次同步或双方都有改动；点击“覆盖推送到云端”；熔断后点击“恢复快照”。
- **原因与影响**：Hook 设置 `drawerOpen`、`drawerMode`、`msg`，但 FullTab 没有渲染对应冲突面板和错误反馈；覆盖按钮直接调用 `executePush`，没有走现有 `requestForcePush` 确认路径；恢复快照回调为空函数。
- **证据**：静态确认。用户可能看到按钮恢复空闲却不知道该选方向；危险推送缺少 popup 已有的确认；安全恢复入口点击无效果。
- **建议与验收**：复用现有冲突/确认组件和状态反馈，接通快照导航。首次冲突可选择方向；取消推送不发网络写请求；熔断恢复按钮可到达快照；失败原因必须可见。

### F10 · P2 · “内容一致”分支擦除本地哈希基线

- **位置**：[smart-sync-strategy.ts:113](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/strategies/smart-sync-strategy.ts:113)；[state-manager.ts:36](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/state-manager.ts:36)、[sync-executor.ts:174](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/sync-executor.ts:174)。
- **触发**：已有正确同步基线，用户再次点击智能同步，恰好两端内容一致；之后另一设备删除书签。
- **原因与影响**：`setSyncState` 整体覆盖状态，但该分支未写 `localHash`；后台随后把无哈希当作本地脏数据，走合并拉取再推送，可能重新带回远端已删除的条目。
- **证据**：R06 已复现一次“已同步”操作将原有哈希清空，并触发 `isLocalDirty`；后续合并路径为静态追踪。
- **建议与验收**：一致分支同样保存当前范围内容哈希；验证重复同步后哈希存在，远端删除可正常传播，同时保留真正的本地未上传改动。

### F11 · P2 · 上传期间的新事件或离线事件可能永久漏同步

- **位置**：[bookmark-monitor.ts:24](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/bookmark-monitor.ts:24)、同文件第 65 行；[sync-executor.ts:30](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/sync-executor.ts:30)。
- **触发**：一次慢上传尚未结束，又编辑书签；新防抖到期时仍在上传。或事件到期时离线，之后恢复网络但没有新的书签事件。
- **原因与影响**：计时器先清除兜底 alarm，`uploadInFlight` 或离线检查随后直接返回，没有待处理标志/重排队。当前上传若已经取完树，新修改不在其中；定时任务仅拉取远端更新，也不能保证补上传。
- **证据**：静态确认。该问题有明确时间条件，并非每次快速编辑都会发生。
- **建议与验收**：持久化“仍有本地变更”的轻量标志，成功上传对应版本后再清除；执行中收到变更时补跑一次。测试慢上传中再编辑、离线编辑后联网、恢复冷却期内真实编辑。

### F12 · P2 · Gist 切换只覆盖部分入口，设置行为不一致

- **位置**：[E2EEncryptionSection.tsx:43](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/settings/E2EEncryptionSection.tsx:43)、[application/state-manager.ts:95](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/state-manager.ts:95)、[DangerZoneSection.tsx:17](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/settings/DangerZoneSection.tsx:17)、[FullTabConsole.tsx:16](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/fulltab/FullTabConsole.tsx:16)、[settings-migrator.ts:45](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/settings-migrator.ts:45)。
- **触发**：当前存储选择 Gist，并使用加密重传、云端清空、顶部配置状态或配置迁移。
- **原因与影响**：加密重传调用 WebDAV 兼容函数，在 Gist 下返回空配置；危险区仅读取 WebDAV 并明确清理该服务器；顶部就绪状态只检查 WebDAV URL；迁移未包含 `storage_type/gist_id/gist_endpoint/gist_token`。Gist 用户会遭遇错误提示或迁移不完整，残留 WebDAV 配置也使操作目标易混淆。
- **证据**：静态确认；危险区正文写的是 WebDAV，因此不将其描述成“代码偷偷把 Gist 请求发错服务器”，而是活跃存储行为未统一。
- **建议与验收**：复用 `useActiveStorage/getActiveStorageConfig`，危险确认明确显示目标；迁移按驱动保存配置，Token 遵守已有敏感信息选项。分别验证仅 Gist、仅 WebDAV 和两者都配置。

### F13 · P2 · 缓存和部分状态未按存储目标隔离

- **位置**：[cloud-operations.ts:77](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/cloud-operations.ts:77)、[cache-manager.ts:125](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/storage/cache-manager.ts:125)、[storage/types.ts:147](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/storage/types.ts:147)、[sync-settings.ts:237](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/sync-settings.ts:237)。
- **触发**：缓存有效期内切换服务器、账号或存储驱动，然后打开云端备份列表。
- **原因与影响**：列表缓存只有一个全局键，读取不带目标；上次备份文件信息也全局共用；存储标识对 WebDAV 不区分账号，对 Gist 不区分 endpoint。可能展示旧目标备份、恢复不存在的路径，或把上个目标的文件路径用于当前目标的窗口清理。
- **证据**：R07 已复现 B 服务器读到 A 的缓存列表；其他状态复用为静态确认，不假定两个目标一定存在同名文件。
- **建议与验收**：使用规范化驱动、端点、账号/库标识作键，禁止把密码放入键或日志；配置切换同步清理相关 UI 数据。测试同 URL 不同账号、同 Gist ID 不同端点及并发列表响应。

### F14 · P1 · 云端“结构校验”只验证外层数组，畸形节点可进入删除恢复

- **位置**：[cloud-data-helper.ts:30](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/sync/utils/cloud-data-helper.ts:30)、[repository.ts:74](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/repository.ts:74)、[smart-sync-engine.ts:85](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/smart-sync-engine.ts:85)。
- **触发**：JSON 可解析且 `data` 为数组，但内部节点缺 URL/children、根结构畸形或字段类型错误；用户从云端历史执行恢复。
- **原因与影响**：校验器只检查 `data` 数组，恢复仅补查根和 children；引擎跳过既无 URL 又无 children 的节点，后续却删除本地未处理项。输入无效可能被解释成“本地数据应删除”。
- **证据**：R08 已复现畸形内部节点被校验器接受；与删除阶段的组合风险为静态确认。正常 `smartPull` 的大幅数量下降保护覆盖部分情况，指定历史恢复没有该限制。
- **建议与验收**：在任何写入前递归验证节点类型、根/系统文件夹结构、标题与 URL 类型，并设置合理体积/深度边界；从实际字段重算身份哈希。合法空文件夹与非法节点必须区分，非法输入不得触发写入。

## 3. UI/UX 可改进处

下列交互结论来自源码；视觉拥挤程度、触控表现、读屏体验和字号建议需要实机验收，不给未经测量的视觉分数。

| 编号 / 优先级 | 当前问题与位置 | 最小改进与验收 |
| --- | --- | --- |
| U01 / P2 | [Dashboard:64](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/fulltab/FullTabDashboard.tsx:64) 仅凭书签数量相等显示“两端已一致”；相同数量可能是完全不同 URL | 展示“数量相同，待核对”或采用最近一次内容比对结果，并在变更后失效；两端不同 URL、相同数量不得显示一致 |
| U02 / P2 | [Modal:24](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/Modal.tsx:24)、[Drawer:24](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/Drawer.tsx:24) 缺对话框语义、焦点管理、Escape 处理，关闭图标无可访问名称；[WebDAV:181](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/settings/WebDAVPage.tsx:181) 标签与输入未通过 ID 关联 | 优先使用平台对话框能力或完善现有组件；补 `aria` 名称、焦点进入/约束/返回、标签关联，纯键盘完成危险确认与取消 |
| U03 / P2 | [SyncStatusFeedback:38](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/sync/SyncStatusFeedback.tsx:38) 用 800/2200ms 定时切换“分析/同步”，并不代表后台真实阶段；错误被截断到 200px | 无真实进度时显示“处理中＋耗时”，有后台阶段事件后再展示阶段；错误可展开阅读，不能只靠悬浮 title |
| U04 / P2 | FullTab、危险区及 [useActiveStorage:35](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/hooks/useActiveStorage.ts:35) 多处硬编码中文；全局语言选项不能覆盖这些界面 | 复用现有中英字典，包含提示、日期、状态与确认正文；英文模式遍历全部页面和失败状态 |
| U05 / P2 | [WebDAV:46](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/settings/WebDAVPage.tsx:46) 失焦即写活跃配置，点击模板也直接保存；连接按钮在“本页此前已成功连接后再次换配置”时还会自动上传 | 使用一份完整草稿，验证后一次提交；“测试连接”与“备份到新目标”分开。测试失败不改变原配置、不发备份写请求 |
| U06 / P2 | [FullTabSnapshots:31](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/fulltab/FullTabSnapshots.tsx:31) 加载失败仅日志，最后会显示“未找到”；没有明显加载骨架或重试入口 | 明确区分加载中、无快照、搜索无结果、读取失败；失败提供重试。恢复执行状态与按钮禁用随 F07 一起补齐 |
| U07 / P3 | [LayoutWrapper:41](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/components/LayoutWrapper.tsx:41) popup 为 360×560，多处 10/11px 文本；“强制创建新文件”实际上仅清除下一次上传的时间窗口记录 | 在中英文、长错误和 125%/150% 缩放下核对溢出后再调宽度/字号；按钮改为“下次上传创建新备份”，或实现明确的立即创建动作 |

F09 的冲突不可见、覆盖缺确认和安全入口无效属于功能缺陷，应先于上述视觉微调处理。

## 4. 功能逻辑与工程优化

| 方向 | 当前依据 | 建议及启动条件 |
| --- | --- | --- |
| 统一一次同步的数据版本 | Push 在预检前读取本地树，又在 `createCloudBackup()` 内重读；最终哈希来自第一次读取，上传内容来自第二次 | 对一次操作使用同一份树、范围与摘要；若期间有新事件，标记后续补同步。先解决一致性，再量化少一次取树/哈希的收益 |
| 明确文件夹同步语义 | [comparator.ts:39](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/core/bookmark/comparator.ts:39) 明确忽略顺序、路径和空文件夹；移动、重命名文件夹不会触发内容同步 | 这是当前设计取舍，不直接当成新 Bug；在中英 README 与 UI 说明。只有用户明确需要结构同步，再加入稳定系统根映射与目录结构比对，避免重现跨浏览器来回覆盖 |
| 减少无效安全快照 | Push 在云端预检前创建快照，后续即使跳过或失败也占用保留配额 | 无变化时不轮换同内容快照；破坏性操作仍强制保留安全快照。验证连续无变化操作不会挤走唯一有价值的旧状态 |
| 按需加载独立标签页 | [App.tsx:10](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/App.tsx:10) 静态导入 FullTab；本次主 UI chunk 为 579.10 kB，gzip 173.04 kB，有 500 kB 告警 | 先测 popup 冷启动与内存；必要时用已有 React 的 lazy/Suspense 延后加载 FullTab/统计页，不新增框架，不通过调大告警阈值假装修复 |
| 持久化后台执行结果 | 手动/自动入口的反馈分散，popup 关闭后缺统一的任务结果展示 | 复用现有 storage 与消息通道存最小操作记录：阶段、结果、错误码、目标、时间、快照引用；重新打开仍可见真实结果，日志脱敏 |
| 收紧配置导入校验 | [settings-migrator.ts:115](C:/Users/z1768/Desktop/bookmark-syncer-master/packages/app/src/application/settings-migrator.ts:115) 未严格校验版本、范围值、频率、阈值及 URL；类型断言不能验证外部 JSON | 复用现有默认值与规范化函数，验证字段和数值区间；敏感字段缺失时保持待配置状态，禁止半配置自动同步 |
| 缩减重复契约与测试耦合 | 多处同时接受 `IStorageProvider` 与旧 WebDAV 接口；executor 为兼容 mock 使用运行时函数存在性回退 | 完成驱动契约测试后移除已经没有真实消费者的兼容分支；更新 mock，不让生产代码迁就旧测试。无需引入依赖注入容器 |
| 校正文档和发布证据 | AGENTS/旧报告存在过期事实；release 工作流打包签名但不在该作业内运行测试，也不校验 tag 与根版本一致 | 当前规则留在权威文档，旧报告标历史；发布前验证同一提交测试、版本和双平台构建。工作流变更按项目高风险流程另行确认 |

## 5. 后续方向与实施顺序

| 阶段 | 目标与范围 | 完成门槛 |
| --- | --- | --- |
| A：数据安全修复 | F01–F08、F14；先修范围/输入/错误传播，再统一后台互斥和加密迁移 | 对应回归测试通过；无效数据、网络异常、快照失败均不触发破坏性写入；用隔离浏览器配置验证恢复与回滚 |
| B：同步行为收敛 | F10–F13；统一驱动配置、基线、目标隔离与待同步标志 | 双设备新增/删除/离线/改密/换目标场景可重复通过；原生浏览器同步开启和关闭分别验证 |
| C：交互闭环 | F09、U01–U06；先接通冲突、确认、错误与恢复，再统一多语言/键盘体验 | popup 与 FullTab 同一操作有一致的结果和安全确认；中文/英文、鼠标/键盘都可完成 |
| D：以数据决定优化 | U07、懒加载、重复计算、快照去重；考虑展示真实同步历史和可读差异预览 | 用 100/1,000/10,000 条合成书签记录冷启动、总耗时、请求数、快照空间；收益实测后再扩大优化 |

暂不建议新增更多云存储后端、通用工作流框架或另起 UI 系统。当前已有接口、后台消息与组件足够承载本轮修复。真正的三方合并、冲突逐项处理、结构同步可作为后续产品方向，但应在基线与删除传播稳定后单独定义语义和验收。

高风险修复的建议停止条件：出现范围外改动、删除无法解释、备份验证失败、操作目标不明或未取得互斥时立即停止。实施应先在独立测试 profile/专用空云端目录验证，保留恢复前快照与云端旧版本；本次报告不授权执行删除或发布。

## 6. 本次验证与限制

| 检查 | 结果 | 能证明的范围 |
| --- | --- | --- |
| `pnpm test` | 无法执行 | 本机 fallback 启动器尝试联网/依赖检查失败；不是测试断言失败，未进行依赖重装 |
| 在 `packages/app` 直接执行 `node node_modules/vitest/vitest.mjs run --reporter=dot` | 通过：41 文件、427 用例 | 当前既有用例；因 esbuild 沙箱目录访问失败，获自动审批后在沙箱外运行 |
| 隔离异常复现 R01–R09 | 通过：9/9 复现预期异常 | 这些断言验证“缺陷现象出现”，不代表功能正确或修复通过；网络与浏览器 API 均为模拟 |
| Chrome/Firefox 各执行 `node node_modules/typescript/bin/tsc --noEmit` | 通过 | 两个壳工程及其引用的源码类型检查 |
| Chrome/Firefox 各执行 `node node_modules/vite/bin/vite.js build` | 通过，存在体积告警 | 与脚本中类型检查一起覆盖本地构建；两个构建分别约 3.05s / 2.89s，不是性能基准 |
| 实际浏览器 UI、关闭 popup、SW 重启、真实 WebDAV/Gist、多设备原生同步 | 未执行 | 需隔离环境实机验收；不声称端到端通过 |
| 发布、签名、远程 CI、依赖漏洞数据库审计 | 未执行 / 本次不适用 | 未读取凭据、未发布或连接真实云端 |

复现采用当前真实根树结构和真实业务函数；例如 R01 输入 `[root(children=[Bar, Other])]`，默认仅 Bar，实际结果仍包含 Other。R02 仅提供 Bar 的备份，其他文件夹的同 URL 节点却被移动。R03 使用六份不同文件名但共享 Gist 时间的响应，验证旧版选择与新版被清理。

本机复现脚本：[review.test.ts](C:/Users/z1768/AppData/Local/Temp/marksync-review-20260914/review.test.ts)；[隔离配置](C:/Users/z1768/AppData/Local/Temp/marksync-review-20260914/vitest.config.mjs)。在 `packages/app` 执行 `node node_modules/vitest/vitest.mjs run --config C:/Users/z1768/AppData/Local/Temp/marksync-review-20260914/vitest.config.mjs` 可复核。临时文件可能被系统清理；正式修复时应将相应“正确行为”回归用例放入镜像源码层级的 `packages/app/tests/`。

本机证据：[既有测试日志](C:/Users/z1768/AppData/Local/Temp/marksync-review-tests.log)、[复现日志](C:/Users/z1768/AppData/Local/Temp/marksync-review-repro.log)、[Chrome 构建日志](C:/Users/z1768/AppData/Local/Temp/marksync-review-build-chrome.log)、[Firefox 构建日志](C:/Users/z1768/AppData/Local/Temp/marksync-review-build-firefox.log)。均为本次运行；没有以旧报告代替验证。

## 7. 交接

- **结果**：完成缺陷、UI、逻辑优化和后续方向审查，给出证据等级、触发条件及验收要求；建议未实施。
- **验证**：427 个既有测试通过、9 个异常复现成立、双平台类型检查和构建通过；详细限制见第 6 节。
- **限制**：实机 UI、多设备、真实存储与生命周期场景待验证；不存在“已修复”或“可安全发布”的结论。
- **交付状态**：新增本 Markdown 文档，已保存、未提交、未推送、未发布；旧报告及业务源码保持原样。构建重新生成各自 `dist/`；首次 pnpm 启动尝试另生成未跟踪 `.pnpm-store/` 缓存目录，未将其纳入版本控制，也未擅自删除。
- **下一步**：从阶段 A 开始拟定最小修复方案；涉及同步、恢复、加密与发布链路的实施依照项目高风险流程确认方案后推进。
