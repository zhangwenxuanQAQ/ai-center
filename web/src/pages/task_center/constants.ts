/**
 * 任务中心共享常量与工具方法
 */

import React from 'react';

/** 任务类型值 */
export const TASK_TYPE = {
  DATA_EXTRACT: 'data_extract',
  API: 'api',
  DOC_CHUNK: 'doc_chunk',
} as const;

/** 状态Tag颜色映射 */
export const statusColorMap: Record<string, string> = {
  pending: 'default', waiting: 'warning', running: 'processing',
  cancel: 'default', done: 'success', fail: 'error', schedule: 'purple',
};

/** 任务类型Tag颜色映射 */
export const taskTypeColorMap: Record<string, string> = {
  data_extract: 'blue',
  api: 'geekblue',
  doc_chunk: 'green',
};

/** 耗时（数据库存毫秒）转为秒显示 */
export const formatDurationSeconds = (ms?: number | null): string => {
  if (ms == null || ms < 0) return '-';
  return `${(ms / 1000).toFixed(2)}秒`;
};

/** 主题检测Hook */
export const useTheme = (): 'light' | 'dark' => {
  const getTheme = () =>
    (document.body.getAttribute('data-theme') || 'dark') as 'light' | 'dark';
  const [theme, setTheme] = React.useState<'light' | 'dark'>(getTheme);
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
};
