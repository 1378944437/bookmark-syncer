/**
 * three-way.ts 测试
 * 三方对比检测：以基线为参照识别各类改动与真冲突
 */
import { detectThreeWayConflicts } from "@src/core/bookmark/three-way";
import type { BookmarkNode } from "@src/types";

function bar(children: BookmarkNode[]): BookmarkNode[] {
  return [{ id: "1", title: "Bookmarks Bar", folderType: "bookmarks-bar", children }];
}

const bm = (title: string, url: string): BookmarkNode => ({ title, url });

describe("detectThreeWayConflicts", () => {
  it("无基线时只统计新增，不报冲突", () => {
    const report = detectThreeWayConflicts(
      null,
      bar([bm("A", "https://a.com")]),
      bar([bm("A", "https://a.com"), bm("B", "https://b.com")]),
    );
    expect(report.conflictCount).toBe(0);
    expect(report.cloudAdded).toBe(1);
    expect(report.localAdded).toBe(0);
  });

  it("仅云端改标题（本地未动）→ cloudChanged", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(base, bar([bm("A", "https://a.com")]), bar([bm("A2", "https://a.com")]));
    expect(report.cloudChanged).toBe(1);
    expect(report.localChanged).toBe(0);
    expect(report.conflictCount).toBe(0);
  });

  it("仅本地改标题（云端未动）→ localChanged", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(base, bar([bm("A1", "https://a.com")]), bar([bm("A", "https://a.com")]));
    expect(report.localChanged).toBe(1);
    expect(report.cloudChanged).toBe(0);
    expect(report.conflictCount).toBe(0);
  });

  it("双方都改名且不同 → 真冲突并记录样本", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(
      base,
      bar([bm("本地改名", "https://a.com")]),
      bar([bm("云端改名", "https://a.com")]),
    );
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0]).toMatchObject({
      base: "A",
      local: "本地改名",
      cloud: "云端改名",
    });
  });

  it("本地删除、云端改名 → deleteVsChange", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(base, bar([]), bar([bm("A2", "https://a.com")]));
    expect(report.deleteVsChange).toBe(1);
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0].localDeleted).toBe(true);
  });

  it("云端删除、本地改名 → changeVsCloudDelete（现行覆盖拉取会丢改动）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(base, bar([bm("A2", "https://a.com")]), bar([]));
    expect(report.changeVsCloudDelete).toBe(1);
    expect(report.conflictCount).toBe(1);
  });

  it("URL 规范化后视为同一书签（尾部斜杠差异不算改动）", () => {
    const base = bar([bm("A", "https://a.com")]);
    const report = detectThreeWayConflicts(base, bar([bm("A", "https://a.com")]), bar([bm("A", "https://a.com/")]));
    expect(report.conflictCount).toBe(0);
    expect(report.cloudChanged).toBe(0);
  });

  it("文件夹移动（所在路径变化）视为改动", () => {
    const base = [{ id: "1", title: "Bar", folderType: "bookmarks-bar", children: [bm("A", "https://a.com")] }];
    const cloud = [{ id: "2", title: "Other", folderType: "other", children: [bm("A", "https://a.com")] }];
    const report = detectThreeWayConflicts(base, base, cloud);
    expect(report.cloudChanged).toBe(1);
    expect(report.localChanged).toBe(0);
  });
});
