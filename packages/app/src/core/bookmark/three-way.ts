/**
 * 三方对比检测（三方合并第 1 步：只检测、只记录，不改变任何合并行为）
 *
 * 以「上次同步完成时」的树为基线，对每个书签（按规范化 URL 认身份）判断
 * 本地与云端各自相对基线发生了什么，从而把真正的编辑冲突识别出来：
 * 当前算法（后推送者赢）下，这些冲突意味着一方的修改会被静默丢弃，
 * 本报告用于验证基线判定的准确性，为启用三树合并行为提供依据
 */
import type { BookmarkNode } from "../../types";
import { normalizeUrl } from "./normalizer";

/** 单个书签在树中的关键信息（标题 + 所在文件夹路径） */
interface BookmarkInfo {
  title: string;
  folderPath: string;
}

/** 检测到的单条真冲突样本 */
export interface ConflictSample {
  url: string;
  base?: string;
  local?: string;
  cloud?: string;
  /** 本地删除了、云端却有改动 */
  localDeleted?: boolean;
}

export interface ThreeWayReport {
  baselineCount: number;
  localCount: number;
  cloudCount: number;
  /** 仅云端有改动（本地未动）→ 现行覆盖拉取可正确采纳 */
  cloudChanged: number;
  /** 仅本地有改动（云端未动）→ 现行合并可正确保留 */
  localChanged: number;
  /** 真冲突：双方相对基线都改了且不一致（当前行为：后推送者赢） */
  conflictCount: number;
  conflicts: ConflictSample[];
  /** 本地删除了、云端却改了 → 现行行为：云端版本被重新创建，本地删除丢失 */
  deleteVsChange: number;
  /** 云端删除了、本地却改了 → 现行覆盖拉取会丢掉本地改动 */
  changeVsCloudDelete: number;
  localAdded: number;
  cloudAdded: number;
}

/** 收集一棵树里全部书签：规范化 URL → { 标题, 文件夹路径 }（同 URL 取首个） */
function collectBookmarks(
  nodes: BookmarkNode[],
  folderPath: string,
  map: Map<string, BookmarkInfo>,
): void {
  for (const node of nodes) {
    if (node.url) {
      const url = normalizeUrl(node.url);
      if (url && !map.has(url)) {
        map.set(url, { title: node.title ?? "", folderPath });
      }
    } else if (node.children?.length) {
      // 系统根用 folderType 做路径根（跨浏览器稳定），与合并器的路径约定一致
      const childPath = node.folderType
        ? node.folderType
        : folderPath
          ? `${folderPath}/${node.title ?? ""}`
          : (node.title ?? "");
      collectBookmarks(node.children, childPath, map);
    }
  }
}

function buildBookmarkMap(tree: BookmarkNode[]): Map<string, BookmarkInfo> {
  const map = new Map<string, BookmarkInfo>();
  collectBookmarks(tree, "", map);
  return map;
}

function sameInfo(a: BookmarkInfo | undefined, b: BookmarkInfo | undefined): boolean {
  if (!a || !b) return false;
  return a.title === b.title && a.folderPath === b.folderPath;
}

/**
 * 三树对比，产出冲突报告
 * @param baseline 上次同步完成时的树；null（从未记录/已损坏）时只统计双方新增
 */
export function detectThreeWayConflicts(
  baseline: BookmarkNode[] | null,
  local: BookmarkNode[],
  cloud: BookmarkNode[],
): ThreeWayReport {
  const baseMap = baseline ? buildBookmarkMap(baseline) : new Map<string, BookmarkInfo>();
  const localMap = buildBookmarkMap(local);
  const cloudMap = buildBookmarkMap(cloud);

  const report: ThreeWayReport = {
    baselineCount: baseMap.size,
    localCount: localMap.size,
    cloudCount: cloudMap.size,
    cloudChanged: 0,
    localChanged: 0,
    conflictCount: 0,
    conflicts: [],
    deleteVsChange: 0,
    changeVsCloudDelete: 0,
    localAdded: 0,
    cloudAdded: 0,
  };

  const urls = new Set<string>([...baseMap.keys(), ...localMap.keys(), ...cloudMap.keys()]);

  for (const url of urls) {
    const inBase = baseMap.get(url);
    const inLocal = localMap.get(url);
    const inCloud = cloudMap.get(url);

    // 双方或一方新增（基线没有）
    if (!inBase) {
      if (inLocal && !inCloud) report.localAdded++;
      if (inCloud && !inLocal) report.cloudAdded++;
      // 双方都新增：合并按 URL 去重，不会重复创建，不计冲突
      continue;
    }

    const localChanged = !inLocal || !sameInfo(inLocal, inBase);
    const cloudChanged = !inCloud || !sameInfo(inCloud, inBase);

    if (localChanged && cloudChanged) {
      // 一方删除、另一方修改，或双方都修改成不同内容：都是真冲突
      report.conflictCount++;
      if (report.conflicts.length < 10) {
        report.conflicts.push({
          url,
          base: inBase.title,
          local: inLocal?.title,
          cloud: inCloud?.title,
          localDeleted: !inLocal,
        });
      }
      if (!inLocal) report.deleteVsChange++;
      if (!inCloud) report.changeVsCloudDelete++;
      continue;
    }

    if (cloudChanged) report.cloudChanged++;
    if (localChanged) report.localChanged++;
  }

  return report;
}
