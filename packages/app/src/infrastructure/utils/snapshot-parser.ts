/**
 * 快照原因解析与徽章标签格式化工具
 * 支持对新旧格式快照原因（如 "上传前 (自动 备份)"、"下载前自动备份 (自动, 合并)"、"本地快照恢复前自动备份"）
 * 进行智能语义提取，分离出主时机标题与分类徽章
 */

export interface ParsedSnapshotReason {
  /** 核心时机或标题（如 "上传前"、"下载前"、"快照恢复前"） */
  title: string;
  /** 触发方式标签（如 "自动"、"手动"） */
  triggerLabel?: string;
  /** 动作类型标签（如 "备份"、"合并"、"覆盖"、"恢复"） */
  actionLabel?: string;
}

/**
 * 解析快照原因字符串
 * @param reason 原始快照原因
 * @param fallbackTitle 缺省标题
 */
export function parseSnapshotReason(
  reason: string | undefined,
  fallbackTitle = '自动备份'
): ParsedSnapshotReason {
  if (!reason || reason === 'auto-backup') {
    return {
      title: '自动备份',
      triggerLabel: '自动',
      actionLabel: '备份',
    };
  }

  if (reason === 'manual') {
    return {
      title: '手动备份',
      triggerLabel: '手动',
      actionLabel: '备份',
    };
  }

  // 1. 匹配带括号属性的新旧格式：如 "上传前 (自动 备份)"、"下载前自动备份 (自动, 合并)"
  const bracketMatch = reason.match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
  if (bracketMatch) {
    let rawTitle = bracketMatch[1].trim();
    const tagsStr = bracketMatch[2].trim();

    // 去除标题中残留的 "自动备份" 重复字样
    rawTitle = rawTitle.replace(/自动备份$/, '').trim() || rawTitle;

    const isManual = tagsStr.includes('手动');
    const isAuto = tagsStr.includes('自动');
    const isMerge = tagsStr.includes('合并');
    const isOverwrite = tagsStr.includes('覆盖');
    const isRestore = tagsStr.includes('恢复');
    const isBackup = tagsStr.includes('备份');

    const triggerLabel = isManual ? '手动' : (isAuto ? '自动' : undefined);
    const actionLabel = isOverwrite
      ? '覆盖'
      : (isMerge
      ? '合并'
      : (isRestore
      ? '恢复'
      : (isBackup || reason.includes('备份') || rawTitle.includes('上传') ? '备份' : undefined)));

    return {
      title: rawTitle,
      triggerLabel,
      actionLabel,
    };
  }

  // 2. 匹配历史非括号格式：如 "本地快照恢复前自动备份"
  if (reason.includes('恢复前')) {
    return {
      title: '恢复前',
      triggerLabel: '自动',
      actionLabel: '备份',
    };
  }

  return {
    title: reason || fallbackTitle,
  };
}
