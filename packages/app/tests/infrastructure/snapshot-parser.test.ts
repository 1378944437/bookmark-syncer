/**
 * snapshot-parser.ts 单元测试
 * 验证新旧快照原因解析、分类标签提取与降级表现
 */
import { parseSnapshotReason } from "@src/infrastructure/utils/snapshot-parser";
import { describe, expect, it } from "vitest";

describe("SnapshotParser", () => {
  it("解析新格式上传前快照原因", () => {
    const parsed = parseSnapshotReason("上传前 (自动 备份)");
    expect(parsed.title).toBe("上传前");
    expect(parsed.triggerLabel).toBe("自动");
    expect(parsed.actionLabel).toBe("备份");
  });

  it("解析新格式下载前合并快照原因", () => {
    const parsed = parseSnapshotReason("下载前 (自动 合并)");
    expect(parsed.title).toBe("下载前");
    expect(parsed.triggerLabel).toBe("自动");
    expect(parsed.actionLabel).toBe("合并");
  });

  it("解析手动覆盖快照原因", () => {
    const parsed = parseSnapshotReason("下载前 (手动 覆盖)");
    expect(parsed.title).toBe("下载前");
    expect(parsed.triggerLabel).toBe("手动");
    expect(parsed.actionLabel).toBe("覆盖");
  });

  it("向下兼容老版本带逗号的旧文本：下载前自动备份 (自动, 合并)", () => {
    const parsed = parseSnapshotReason("下载前自动备份 (自动, 合并)");
    expect(parsed.title).toBe("下载前");
    expect(parsed.triggerLabel).toBe("自动");
    expect(parsed.actionLabel).toBe("合并");
  });

  it("向下兼容老版本上传前文本：上传前自动备份 (自动)", () => {
    const parsed = parseSnapshotReason("上传前自动备份 (自动)");
    expect(parsed.title).toBe("上传前");
    expect(parsed.triggerLabel).toBe("自动");
    expect(parsed.actionLabel).toBe("备份");
  });

  it("向下兼容老版本非括号文本：本地快照恢复前自动备份", () => {
    const parsed = parseSnapshotReason("本地快照恢复前自动备份");
    expect(parsed.title).toBe("恢复前");
    expect(parsed.triggerLabel).toBe("自动");
    expect(parsed.actionLabel).toBe("备份");
  });

  it("处理空值或默认值", () => {
    const parsedEmpty = parseSnapshotReason(undefined);
    expect(parsedEmpty.title).toBe("自动备份");
    expect(parsedEmpty.triggerLabel).toBe("自动");

    const parsedManual = parseSnapshotReason("manual");
    expect(parsedManual.title).toBe("手动备份");
    expect(parsedManual.triggerLabel).toBe("手动");
  });
});
