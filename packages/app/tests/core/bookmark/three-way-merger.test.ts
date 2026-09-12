/**
 * three-way-merger.ts 穷举测试矩阵
 * 三树合并算法：每个用例覆盖一种「基线/本地/云端」组合，
 * 同时断言合并结果树与报告计数。这是三方合并第 2 步的算法级验收。
 */
import { mergeThreeWay } from "@src/core/bookmark/three-way-merger";
import type { BookmarkNode } from "@src/types";

const bm = (title: string, url: string): BookmarkNode => ({ title, url });
const bar = (children: BookmarkNode[]): BookmarkNode[] => [
  { id: "1", title: "书签栏", folderType: "bookmarks-bar", children },
];
const other = (children: BookmarkNode[]): BookmarkNode[] => [
  { id: "2", title: "其他书签", folderType: "other", children },
];

/** 展开结果树中某个系统文件夹下（含子文件夹）的全部「标题@相对路径」 */
function flattenUnder(tree: BookmarkNode[], folderType: string): Set<string> {
  const out = new Set<string>();
  const walk = (nodes: BookmarkNode[], path: string): void => {
    for (const n of nodes) {
      if (n.url) {
        out.add(`${n.title}@${path}`);
      } else if (n.children) {
        const childPath = path ? `${path}/${n.title}` : n.title;
        walk(n.children, childPath);
      }
    }
  };
  const root = tree.find((n) => n.folderType === folderType);
  if (root?.children) walk(root.children, "");
  return out;
}

function topLevelTypes(tree: BookmarkNode[]): string[] {
  return tree.filter((n) => n.folderType).map((n) => n.folderType!);
}

describe("mergeThreeWay - 基础行为", () => {
  it("三树一致 → 结果树不变，报告全零", () => {
    const t = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(t, t, t);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A@"]));
    expect(report).toMatchObject({
      adoptedCloud: 0,
      keptLocal: 0,
      conflicts: 0,
      deletedByCloud: 0,
    });
  });

  it("基线为 null（从未记录）→ 本地 ∪ 云端并集", () => {
    const local = bar([bm("L", "https://l.com")]);
    const cloud = bar([bm("C", "https://c.com")]);
    const { tree, report } = mergeThreeWay(null, local, cloud);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(
      new Set(["L@", "C@"]),
    );
    expect(report.conflicts).toBe(0);
  });

  it("空树三树 → 空结果", () => {
    const { tree } = mergeThreeWay(bar([]), bar([]), bar([]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set());
  });

  it("两次合并同一输入 → 结果完全一致（确定性）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const local = bar([bm("A本地", "https://a.com")]);
    const cloud = bar([bm("A云端", "https://a.com")]);
    const r1 = mergeThreeWay(base, local, cloud);
    const r2 = mergeThreeWay(base, local, cloud);
    expect(JSON.stringify(r1.tree)).toBe(JSON.stringify(r2.tree));
  });
});

describe("mergeThreeWay - 标题修改", () => {
  it("仅云端改标题（本地未动）→ 采纳云端", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A", "https://a.com")]),
      bar([bm("A云", "https://a.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A云@"]));
    expect(report.adoptedCloud).toBe(1);
    expect(report.keptLocal).toBe(0);
    expect(report.conflicts).toBe(0);
  });

  it("仅本地改标题（云端未动）→ 保留本地", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A本", "https://a.com")]),
      bar([bm("A", "https://a.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A本@"]));
    expect(report.keptLocal).toBe(1);
    expect(report.adoptedCloud).toBe(0);
  });

  it("双方改成相同标题 → 收敛为一，无冲突", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A新", "https://a.com")]),
      bar([bm("A新", "https://a.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A新@"]));
    expect(report.conflicts).toBe(0);
  });

  it("双方改成不同标题 → 本地为准 + 云端加后缀副本（双保留）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A本", "https://a.com")]),
      bar([bm("A云", "https://a.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(
      new Set(["A本@", "A云（云端）@"]),
    );
    expect(report.conflicts).toBe(1);
    expect(report.samples[0]).toMatchObject({
      base: "A",
      local: "A本",
      cloud: "A云",
      resolution: "kept-local-with-cloud-copy",
    });
  });
});

describe("mergeThreeWay - 删除", () => {
  it("云端删除（本地未动）→ 随云端删除", () => {
    const base = bar([bm("A", "https://a.com"), bm("B", "https://b.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A", "https://a.com"), bm("B", "https://b.com")]),
      bar([bm("A", "https://a.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A@"]));
    expect(report.deletedByCloud).toBe(1);
  });

  it("本地删除（云端未动）→ 本地删除生效", () => {
    const base = bar([bm("A", "https://a.com"), bm("B", "https://b.com")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("A", "https://a.com")]),
      bar([bm("A", "https://a.com"), bm("B", "https://b.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A@"]));
    expect(report.keptLocal).toBe(1);
  });

  it("双方都删除 → 删除", () => {
    const base = bar([bm("A", "https://a.com"), bm("B", "https://b.com")]);
    const { tree } = mergeThreeWay(base, bar([bm("A", "https://a.com")]), bar([bm("A", "https://a.com")]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A@"]));
  });

  it("本地删除 + 云端改名 → 保留云端的修改版（不丢内容）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(base, bar([]), bar([bm("A云", "https://a.com")]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A云@"]));
    expect(report.conflicts).toBe(1);
    expect(report.samples[0].resolution).toBe("kept-modified");
    expect(report.samples[0].localDeleted).toBeUndefined();
  });

  it("云端删除 + 本地改名 → 保留本地改名版（不丢内容）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree, report } = mergeThreeWay(base, bar([bm("A本", "https://a.com")]), bar([]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A本@"]));
    expect(report.conflicts).toBe(1);
  });
});

describe("mergeThreeWay - 新增", () => {
  it("本地新增（云端/基线没有）→ 保留", () => {
    const base = bar([]);
    const { tree } = mergeThreeWay(base, bar([bm("新", "https://new.com")]), bar([]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["新@"]));
  });

  it("云端新增（本地/基线没有）→ 保留", () => {
    const base = bar([]);
    const { tree } = mergeThreeWay(base, bar([]), bar([bm("云", "https://c.com")]));
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["云@"]));
  });

  it("双方新增同一 URL 相同标题 → 保留一份", () => {
    const base = bar([]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("同", "https://same.com")]),
      bar([bm("同", "https://same.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["同@"]));
    expect(report.conflicts).toBe(0);
  });

  it("双方新增同一 URL 不同标题 → 本地为准 + 云端副本", () => {
    const base = bar([]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([bm("本地版", "https://same.com")]),
      bar([bm("云端版", "https://same.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(
      new Set(["本地版@", "云端版（云端）@"]),
    );
    expect(report.conflicts).toBe(1);
  });

  it("不同 URL 的新增互不干扰", () => {
    const base = bar([]);
    const { tree } = mergeThreeWay(
      base,
      bar([bm("L", "https://l.com")]),
      bar([bm("C", "https://c.com")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["L@", "C@"]));
  });
});

describe("mergeThreeWay - 文件夹", () => {
  it("云端把书签移动到其他文件夹（本地未动）→ 跟随云端位置", () => {
    const base = [...bar([bm("A", "https://a.com")]), ...other([])];
    const local = [...bar([bm("A", "https://a.com")]), ...other([])];
    const cloud = [...bar([]), ...other([bm("A", "https://a.com")])];
    const { tree, report } = mergeThreeWay(base, local, cloud);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set());
    expect(flattenUnder(tree, "other")).toEqual(new Set(["A@"]));
    expect(report.adoptedCloud).toBe(1);
  });

  it("本地把书签移动到其他文件夹（云端未动）→ 保留本地位置", () => {
    const base = [...bar([bm("A", "https://a.com")]), ...other([])];
    const local = [...bar([]), ...other([bm("A", "https://a.com")])];
    const cloud = [...bar([bm("A", "https://a.com")]), ...other([])];
    const { tree, report } = mergeThreeWay(base, local, cloud);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set());
    expect(flattenUnder(tree, "other")).toEqual(new Set(["A@"]));
    expect(report.keptLocal).toBe(1);
  });

  it("双方移动到不同文件夹 → 本地位置 + 云端位置副本", () => {
    const base = [...bar([bm("A", "https://a.com")]), ...other([])];
    const local = [...bar([]), ...other([bm("A本地", "https://a.com")])];
    const cloud = [...bar([bm("A云", "https://a.com")]), ...other([])];
    const { tree, report } = mergeThreeWay(base, local, cloud);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A云@"]));
    expect(flattenUnder(tree, "other")).toEqual(new Set(["A本地@"]));
    expect(report.conflicts).toBe(1);
  });

  it("本地独有的空文件夹保留", () => {
    const base = bar([]);
    const local = [...bar([]), ...other([])];
    const cloud = bar([]);
    const { tree } = mergeThreeWay(base, local, cloud);
    expect(topLevelTypes(tree)).toContain("other");
  });

  it("云端独有新增文件夹（含书签）→ 整体搬入", () => {
    const base = bar([]);
    const local = bar([]);
    const cloud = [
      ...bar([]),
      { id: "9", title: "工作", children: [bm("X", "https://x.com")] },
    ];
    const { tree } = mergeThreeWay(base, local, cloud);
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set());
    // 非系统文件夹按标题出现在顶层
    const work = tree.find((n) => n.title === "工作");
    expect(work?.children?.[0]).toMatchObject({ title: "X", url: "https://x.com" });
  });

  it("嵌套子文件夹中的书签正常参与三方判定", () => {
    const leaf = (title: string): BookmarkNode => ({
      title: "工作",
      children: [bm(title, "https://a.com")],
    });
    const base = bar([leaf("A")]);
    const { tree, report } = mergeThreeWay(
      base,
      bar([leaf("A")]),
      bar([leaf("A云")]),
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(new Set(["A云@工作"]));
    expect(report.adoptedCloud).toBe(1);
  });
});

describe("mergeThreeWay - 结构与顺序", () => {
  it("系统文件夹按 书签栏→其他→移动设备 稳定排序", () => {
    const base = bar([]);
    const local = [...bar([]), ...other([])];
    const cloud = [
      { id: "3", title: "移动设备", folderType: "mobile", children: [] },
    ];
    const { tree } = mergeThreeWay(base, local, cloud);
    expect(topLevelTypes(tree)).toEqual(["bookmarks-bar", "other", "mobile"]);
  });

  it("云端副本后缀可通过选项自定义", () => {
    const base = bar([bm("A", "https://a.com")]);
    const { tree } = mergeThreeWay(
      base,
      bar([bm("A本", "https://a.com")]),
      bar([bm("A云", "https://a.com")]),
      { cloudCopySuffix: " (cloud)" },
    );
    expect(flattenUnder(tree, "bookmarks-bar")).toEqual(
      new Set(["A本@", "A云 (cloud)@"]),
    );
  });

  it("合并目标树保留书签的 url 与 hash", () => {
    const base = bar([{ ...bm("A", "https://a.com"), hash: "hash_a" }]);
    const { tree } = mergeThreeWay(
      base,
      bar([{ ...bm("A", "https://a.com"), hash: "hash_a" }]),
      bar([{ ...bm("A云", "https://a.com"), hash: "hash_a" }]),
    );
    const node = tree[0].children![0];
    expect(node).toMatchObject({ url: "https://a.com", hash: "hash_a" });
  });
});
