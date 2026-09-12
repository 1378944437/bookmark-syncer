/**
 * 三树合并算法（三方合并第 2 步核心，纯函数）
 *
 * 输入基线（上次同步完成时的树）、本地树、云端树，输出「本地应变成的目标树」：
 * 把目标树交给既有的 restoreFromBackup（smartSync + 统一删除）执行即可，
 * 不需要为合并结果重新实现一套浏览器写入逻辑。
 *
 * 判定规则（每个书签按规范化 URL 认身份，比较标题与所在文件夹路径）：
 * - 基线没有：单侧新增→保留该侧；双侧新增且一致→保留一份；不一致→本地为准+云端副本
 * - 基线有：仅云端改→采纳云端（含删除）；仅本地改→保留本地（含删除）；
 *   双方都改：都删除→删除；一方删除一方修改→保留修改方（不丢内容）；
 *   双方都改成不同内容→本地为准 + 云端版本加后缀副本（双保留，绝不丢数据）
 *
 * 已知简化（有意为之，均记录在报告中）：文件夹级别不做三树判定，
 * 文件夹骨架取「本地 ∪ 云端」，书签按最终路径归位；同 URL 副本靠后续同步去重
 */
import type { BookmarkNode } from "../../types";
import { normalizeUrl } from "./normalizer";

export interface ThreeWayMergeOptions {
  /** 真冲突中云端副本的标题后缀，默认「（云端）」 */
  cloudCopySuffix?: string;
}

export interface ThreeWayMergeSample {
  url: string;
  base?: string;
  local?: string;
  cloud?: string;
  resolution: "kept-local-with-cloud-copy" | "kept-modified";
}

export interface ThreeWayMergeReport {
  /** 采纳的云端改动数（含随云端删除） */
  adoptedCloud: number;
  /** 保留的本地改动数（含本地删除生效） */
  keptLocal: number;
  /** 双保留的真冲突数 */
  conflicts: number;
  /** 随云端删除的书签数 */
  deletedByCloud: number;
  samples: ThreeWayMergeSample[];
}

interface BookmarkEntry {
  title: string;
  folderPath: string;
  node: BookmarkNode;
}

interface TreeIndex {
  bookmarks: Map<string, BookmarkEntry>;
  /** 文件夹路径 → 该树中的文件夹节点（含空文件夹） */
  folders: Map<string, BookmarkNode>;
}

const SYSTEM_FOLDER_ORDER = ["bookmarks-bar", "other", "mobile"];

function indexTree(tree: BookmarkNode[]): TreeIndex {
  const bookmarks = new Map<string, BookmarkEntry>();
  const folders = new Map<string, BookmarkNode>();

  const walk = (nodes: BookmarkNode[], folderPath: string): void => {
    for (const node of nodes) {
      if (node.url) {
        const url = normalizeUrl(node.url);
        if (url && !bookmarks.has(url)) {
          bookmarks.set(url, { title: node.title ?? "", folderPath, node });
        }
      } else {
        const childPath = node.folderType
          ? node.folderType
          : folderPath
            ? `${folderPath}/${node.title ?? ""}`
            : (node.title ?? "");
        // 空文件夹（children: []）也要注册，否则合并结果会丢结构
        if (childPath && !folders.has(childPath)) {
          folders.set(childPath, node);
        }
        if (node.children) {
          walk(node.children, childPath);
        }
      }
    }
  };

  walk(tree, "");
  return { bookmarks, folders };
}

export function mergeThreeWay(
  baseline: BookmarkNode[] | null,
  local: BookmarkNode[],
  cloud: BookmarkNode[],
  options: ThreeWayMergeOptions = {},
): { tree: BookmarkNode[]; report: ThreeWayMergeReport } {
  const suffix = options.cloudCopySuffix ?? "（云端）";
  const base = baseline ? indexTree(baseline) : null;
  const localIdx = indexTree(local);
  const cloudIdx = indexTree(cloud);

  const report: ThreeWayMergeReport = {
    adoptedCloud: 0,
    keptLocal: 0,
    conflicts: 0,
    deletedByCloud: 0,
    samples: [],
  };

  /** 最终放置：url → 合并后的条目 */
  const placements = new Map<string, BookmarkEntry>();
  /** 真冲突的云端副本：url → 条目（同 URL 第二份；与本地图标同文件夹时才加后缀） */
  const cloudCopies: { entry: BookmarkEntry; sample: ThreeWayMergeSample; suffixNeeded: boolean }[] = [];

  const urls = new Set<string>([
    ...(base?.bookmarks.keys() ?? []),
    ...localIdx.bookmarks.keys(),
    ...cloudIdx.bookmarks.keys(),
  ]);

  for (const url of urls) {
    const inBase = base?.bookmarks.get(url);
    const inLocal = localIdx.bookmarks.get(url);
    const inCloud = cloudIdx.bookmarks.get(url);

    // 基线没有：新增类
    if (!inBase) {
      if (inLocal && !inCloud) {
        placements.set(url, inLocal);
      } else if (inCloud && !inLocal) {
        placements.set(url, inCloud);
      } else if (inLocal && inCloud) {
        if (sameEntry(inLocal, inCloud)) {
          placements.set(url, inLocal);
        } else {
          // 双方各自新增同一 URL 但内容不同：本地为准 + 云端副本
          placements.set(url, inLocal);
          const sample: ThreeWayMergeSample = {
            url,
            local: inLocal.title,
            cloud: inCloud.title,
            resolution: "kept-local-with-cloud-copy",
          };
          cloudCopies.push({
            entry: inCloud,
            sample,
            suffixNeeded: inLocal.folderPath === inCloud.folderPath,
          });
          report.conflicts++;
          if (report.samples.length < 10) report.samples.push(sample);
        }
      }
      continue;
    }

    const localChanged = !inLocal || !sameEntry(inLocal, inBase);
    const cloudChanged = !inCloud || !sameEntry(inCloud, inBase);

    if (!localChanged && !cloudChanged) {
      placements.set(url, inBase);
      continue;
    }

    if (cloudChanged && !localChanged) {
      // 仅云端改（含删除）→ 采纳云端
      if (inCloud) placements.set(url, inCloud);
      else report.deletedByCloud++;
      report.adoptedCloud++;
      continue;
    }

    if (localChanged && !cloudChanged) {
      // 仅本地改（含删除）→ 保留本地
      if (inLocal) placements.set(url, inLocal);
      report.keptLocal++;
      continue;
    }

    // 双方都改
    if (!inLocal && !inCloud) {
      // 双方都删除 → 删除
      report.keptLocal++;
      continue;
    }
    if (!inLocal || !inCloud) {
      // 一方删除、一方修改 → 保留修改方（绝不丢内容）
      const modified = inLocal ?? inCloud;
      placements.set(url, modified!);
      report.conflicts++;
      if (report.samples.length < 10) {
        report.samples.push({
          url,
          base: inBase.title,
          local: inLocal?.title,
          cloud: inCloud?.title,
          resolution: "kept-modified",
        });
      }
      continue;
    }
    if (sameEntry(inLocal, inCloud)) {
      // 双方改成了一样 → 收敛
      placements.set(url, inLocal);
      continue;
    }

    // 双方改成不同内容 → 本地为准 + 云端副本（双保留）
    placements.set(url, inLocal);
    const sample: ThreeWayMergeSample = {
      url,
      base: inBase.title,
      local: inLocal.title,
      cloud: inCloud.title,
      resolution: "kept-local-with-cloud-copy",
    };
    cloudCopies.push({
      entry: inCloud,
      sample,
      suffixNeeded: inLocal.folderPath === inCloud.folderPath,
    });
    report.conflicts++;
    if (report.samples.length < 10) report.samples.push(sample);
  }

  // 文件夹骨架：本地 ∪ 云端（基线独有且两侧都没有的文件夹随删除消失）
  const folderPaths = new Set<string>([
    ...localIdx.folders.keys(),
    ...cloudIdx.folders.keys(),
  ]);
  for (const entry of placements.values()) {
    if (entry.folderPath) folderPaths.add(entry.folderPath);
  }

  const tree = reconstructTree(placements, cloudCopies, folderPaths, suffix);
  return { tree, report };
}

function sameEntry(a: BookmarkEntry, b: BookmarkEntry): boolean {
  return a.title === b.title && a.folderPath === b.folderPath;
}

/** 按最终放置重建树：系统根文件夹在前（顺序稳定），其余文件夹按插入序 */
function reconstructTree(
  placements: Map<string, BookmarkEntry>,
  cloudCopies: { entry: BookmarkEntry; sample: ThreeWayMergeSample; suffixNeeded: boolean }[],
  folderPaths: Set<string>,
  suffix: string,
): BookmarkNode[] {
  interface FolderNode extends BookmarkNode {
    children: BookmarkNode[];
  }
  const nodesByPath = new Map<string, FolderNode>();

  const ensureFolder = (path: string): FolderNode | null => {
    if (!path) return null;
    const existing = nodesByPath.get(path);
    if (existing) return existing;

    const segments = path.split("/");
    const last = segments.pop()!;
    const parentPath = segments.join("/");
    const parent = ensureFolder(parentPath);

    const node: FolderNode = {
      title: last,
      children: [],
    };
    // 首段若是已知系统文件夹类型，标注 folderType（跨浏览器匹配依赖它）
    if (segments.length === 0 && isSystemType(last)) {
      node.folderType = last;
    }
    nodesByPath.set(path, node);
    parent?.children.push(node);
    return node;
  };

  // 先建文件夹骨架（本地 ∪ 云端的结构，含空文件夹），再往里挂书签
  for (const path of folderPaths) {
    ensureFolder(path);
  }

  const attach = (entry: BookmarkEntry): void => {
    // 无兜底文件夹路径时归入 other（ensureFolder 会创建并标注 folderType）
    const parent = ensureFolder(entry.folderPath) ?? ensureFolder("other") ?? null;
    const bookmark: BookmarkNode = {
      title: entry.title,
      url: entry.node.url,
      hash: entry.node.hash,
    };
    parent?.children.push(bookmark);
  };

  for (const entry of placements.values()) attach(entry);
  for (const { entry, suffixNeeded } of cloudCopies) {
    // 副本与本地版同文件夹时才加后缀区分；跨文件夹副本靠位置自区分
    attach({
      ...entry,
      title: suffixNeeded ? `${entry.title}${suffix}` : entry.title,
    });
  }

  // 组装顶层：系统文件夹按稳定顺序，其余保持插入序
  const topLevel: FolderNode[] = [];
  for (const type of SYSTEM_FOLDER_ORDER) {
    const node = nodesByPath.get(type);
    if (node) topLevel.push(node);
  }
  for (const [path, node] of nodesByPath) {
    if (!path.includes("/") && !isSystemType(path)) topLevel.push(node);
  }

  return topLevel;
}

function isSystemType(segment: string): boolean {
  return segment === "bookmarks-bar" || segment === "other" || segment === "mobile";
}
