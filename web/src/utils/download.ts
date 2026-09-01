/**
 * 文件下载公共工具
 * 统一处理blob下载触发与批量下载逻辑
 */

export interface DownloadResult {
  blob: Blob;
  fileName: string;
}

export interface BatchDownloadSummary {
  /** 成功下载的任务ID列表 */
  success: string[];
  /** 无结果/文件过期而跳过的任务ID列表 */
  skipped: string[];
  /** 下载失败的任务及原因 */
  failed: { id: string; reason: string }[];
}

/** 通过blob URL触发浏览器下载（同源blob，不跳转、不弹框） */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'result';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 判断下载错误是否为"无结果/文件不存在或已过期" */
export function isResultMissingError(errMsg: string): boolean {
  return /404|不存在|已过期|无结果/.test(errMsg || '');
}

/**
 * 批量下载任务结果文件：逐个下载，每个之间间隔300ms避免浏览器拦截连续下载
 *
 * Args:
 *   ids: 任务ID列表
 *   downloadOne: 单个任务下载函数（返回blob与后端文件名）
 *
 * Returns:
 *   批量下载汇总（成功/跳过/失败）
 */
export async function batchDownloadTaskResults(
  ids: string[],
  downloadOne: (id: string) => Promise<DownloadResult>
): Promise<BatchDownloadSummary> {
  const summary: BatchDownloadSummary = { success: [], skipped: [], failed: [] };
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const { blob, fileName } = await downloadOne(id);
      triggerBlobDownload(blob, fileName);
      summary.success.push(id);
    } catch (e: any) {
      const msg = e?.message || '未知错误';
      if (isResultMissingError(msg)) {
        summary.skipped.push(id);
      } else {
        summary.failed.push({ id, reason: msg });
      }
    }
    // 间隔触发，避免浏览器拦截连续多个下载
    if (i < ids.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return summary;
}
